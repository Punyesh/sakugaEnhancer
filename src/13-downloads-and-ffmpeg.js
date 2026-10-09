  function triggerDownload(url, filename) {
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function triggerBlobDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // ---------- ffmpeg.wasm (client-side, real trimming) ----------
  // Uses the current 0.12.x API deliberately, not the older 0.11.x one: 0.12.x
  // is specifically designed to let us fetch the core/wasm files ourselves and
  // hand them over as same-origin blob: URLs, which avoids the cross-origin
  // worker-loading problems that come from just pointing at a raw CDN URL from
  // inside a bookmarklet running on someone else's page. Its single-threaded
  // "core" package (not "core-mt") also genuinely doesn't reference
  // SharedArrayBuffer at all, so there's no shim needed — sakugabooru.com
  // doesn't send the cross-origin-isolation headers real SharedArrayBuffer
  // needs, and the previous version's crash traced back to faking that
  // reference rather than avoiding the need for it.
  var FFMPEG_CONSENT_KEY = 'sk-enh-ffmpeg-consent';
  var FFMPEG_PKG_BASE = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm';
  var FFMPEG_PKG_URL = FFMPEG_PKG_BASE + '/index.js';
  var FFMPEG_UTIL_URL = 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';
  var FFMPEG_CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  var ffmpegInstance = null;
  var ffmpegLoadPromise = null;

  // Reused from ffmpeg.wasm's own official documentation example for
  // drawtext (freetype2, which drawtext needs, has been part of
  // @ffmpeg/core since v0.8.4 — well before the 0.12.x branch already in
  // use here) — a real TTF file known to already work with this exact
  // core build, rather than an untested font pulled from elsewhere.
  var LABEL_FONT_URL = 'https://raw.githubusercontent.com/ffmpegwasm/testdata/master/arial.ttf';
  var labelFontLoaded = false;
  function ensureLabelFont(ffmpeg) {
    if (labelFontLoaded) return Promise.resolve();
    return fetch(LABEL_FONT_URL).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      // Written to ffmpeg's own virtual FS for actual rendering, and
      // registered as a real browser FontFace from those exact same bytes
      // for measurement — confirmed directly that measuring against a
      // generic "Arial, sans-serif" instead is a real, structural problem,
      // not just a rounding error: different platforms substitute
      // different actual fonts for that generic name, none of which are
      // guaranteed to share metrics with the specific arial.ttf ffmpeg
      // always renders with regardless of platform. Using the same bytes
      // for both closes that gap instead of papering over it with a
      // bigger safety margin.
      //
      // Each consumer gets its OWN copy (.slice(0), a real byte copy, not
      // just another view over the same memory) rather than sharing one
      // ArrayBuffer between them — ffmpeg.wasm's writeFile runs across a
      // Web Worker boundary and very plausibly transfers (not copies) the
      // buffer via postMessage for performance, which would detach the
      // original and leave whichever consumer reads it second holding an
      // empty buffer. That failure mode matches a real "Invalid font data
      // in ArrayBuffer" error seen from this exact shared-buffer pattern,
      // so this isn't a hypothetical precaution.
      var ffmpegBytes = new Uint8Array(buf.slice(0));
      var fontFaceBuffer = buf.slice(0);
      return Promise.all([
        ffmpeg.writeFile('label_font.ttf', ffmpegBytes),
        (new FontFace('SkGridLabelFont', fontFaceBuffer)).load().then(function (loaded) {
          document.fonts.add(loaded);
        })
      ]);
    }).then(function () { labelFontLoaded = true; });
  }

  // Confirmed directly (against real ffmpeg, including a name with an
  // apostrophe) that this two-stage escape — the filtergraph parser and
  // drawtext's own string parser each need their own layer — renders
  // correctly rather than leaving stray backslashes visible. Animator tags
  // here are near-universally plain identifiers (letters/underscores), so
  // this mostly matters for the rare edge case rather than everyday names.
  function escapeDrawtext(s) {
    return String(s)
      .replace(/\\/g, '\\\\\\\\')
      .replace(/:/g, '\\\\:')
      .replace(/'/g, "'\\\\\\''");
  }

  // A separate canvas purely for text measurement, never appended to the
  // DOM — same technique browsers use internally for ctx.measureText.
  // Reused across calls rather than recreated each time.
  var labelMeasureCanvas = null;
  function measureLabelTextWidth(text, fontSize) {
    if (!labelMeasureCanvas) labelMeasureCanvas = document.createElement('canvas');
    var ctx = labelMeasureCanvas.getContext('2d');
    if (!ctx) return String(text).length * fontSize * 0.56; // no canvas support: rough estimate rather than failing
    // The exact same font file (and bytes) ffmpeg renders with — see
    // ensureLabelFont — not a generic system font name, which measuring
    // confirmed can silently under-report width by a wide margin.
    ctx.font = fontSize + 'px SkGridLabelFont, sans-serif';
    return ctx.measureText(text).width;
  }

  // Capitalizes each word of an auto-detected animator name (tag names are
  // plain lowercase with underscores, e.g. "yutaka_nakamura" — there's no
  // real capitalization in the source to preserve). Never applied to a
  // person's own custom label text, which is used verbatim — that's
  // hand-authored, and forcing a casing convention on someone's own typed
  // text would be presumptuous, unlike a raw tag name that never had any
  // intentional casing to begin with.
  function titleCase(s) {
    return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // General wrapping shared by both label sources: auto-detected animator
  // names (joined with ", ", each name kept atomic — never split mid-name)
  // and a person's own freeform custom text (joined with " ", wrapped at
  // its own natural word breaks like ordinary text). Same fitting logic
  // either way:
  //  - font size scales with the cell's own size (a small cell in a 9-clip
  //    grid and a large featured-clip box shouldn't use the same absolute
  //    size), clamped so it's never too small to read;
  //  - tokens are measured with the browser's real Canvas API (a ~8% safety
  //    margin covers the residual gap between canvas and freetype's own
  //    metrics once both use the identical font file) and wrapped onto
  //    additional lines rather than shrunk to fit on one;
  //  - only if that still needs more than 4 lines does the font shrink further.
  function buildClipLabel(tokens, joiner, cellW, cellH) {
    var maxLineWidth = cellW - 36; // room for margins (and the box's own padding, when that style is on)
    var maxLines = 4;
    // Divisor and clamp chosen against this tool's actual cell sizes (270
    // for a normal cell, up to 540 for a doubled 'stretch' featured box) —
    // confirmed these numbers actually produce a visibly different size
    // between them (18 vs 32) rather than both landing on the same clamped
    // ceiling, which an earlier, narrower range did without differentiating
    // anything in practice.
    var fontSize = Math.max(14, Math.min(32, Math.round(cellH / 15)));

    function wrapAt(size) {
      var lines = [];
      var current = '';
      for (var i = 0; i < tokens.length; i++) {
        var tok = tokens[i];
        var candidate = current ? current + joiner + tok : tok;
        if (!current || measureLabelTextWidth(candidate, size) * 1.08 <= maxLineWidth) {
          current = candidate;
        } else {
          lines.push(current);
          current = tok;
        }
      }
      if (current) lines.push(current);
      return lines;
    }

    var lines = wrapAt(fontSize);
    while (lines.length > maxLines && fontSize > 12) {
      fontSize -= 1;
      lines = wrapAt(fontSize);
    }
    return { text: lines.join(String.fromCharCode(10)), fontSize: fontSize };
  }

  // Only beyond 9 credited animators (rare) does the list itself get
  // truncated with a "+N more" — short lists never pay that cost, and it
  // only applies to the auto-detected name list, not a custom override
  // (which is one freeform block of text, not a list of discrete names).
  function buildAnimatorLabel(names, cellW, cellH) {
    var extra = 0;
    if (names.length > 9) {
      extra = names.length - 9;
      names = names.slice(0, 9);
    }
    var displayNames = names.slice();
    if (extra > 0) displayNames.push('+' + extra + ' more');
    return buildClipLabel(displayNames, ', ', cellW, cellH);
  }

  // Used for every in-progress status message across trimming and grid
  // export — both can genuinely take a while (grid export especially, since
  // it decodes/re-encodes multiple clips at once), so a spinner distinguishes
  // "still working" from "stalled" at a glance rather than relying on text
  // alone. Never used for a final "done"/error state — those stay plain text.
  // frac: omitted = spinner + text only (as before); a number 0..1 = determinate
  // progress bar; null = indeterminate (moving) bar for a step with no
  // measurable progress.
  function setBusyStatus(el, text, frac) {
    var bar = '';
    if (frac !== undefined) {
      bar = '<div class="sk-progress' + (frac === null ? ' ind' : '') + '"><div class="sk-progress-fill" style="width:' +
        (frac === null ? 0 : Math.round(frac * 100)) + '%"></div></div>';
    }
    el.innerHTML = '<span class="sk-spinner"></span>' + esc(text) +
      (frac === undefined || frac === null ? '' : '<span class="sk-st-pct">' + Math.round(frac * 100) + '%</span>') + bar;
  }

  // Updates an existing bar in place (no re-render, so no flicker).
  function setProgressFraction(el, frac) {
    var fill = el.querySelector('.sk-progress-fill');
    if (!fill) return;
    var pct = Math.round(Math.max(0, Math.min(1, frac)) * 100);
    fill.style.width = pct + '%';
    var label = el.querySelector('.sk-st-pct');
    if (label) label.textContent = pct + '%';
  }

  // Runs ffmpeg.exec while driving the status bar. Progress comes from
  // ffmpeg's own periodic "time=HH:MM:SS.xx" stats line (output time encoded
  // so far) divided by how long the output is expected to be — a plain-text
  // format, so it doesn't depend on ffmpeg.wasm's own progress-event units.
  // `base`/`span` map this one pass onto a slice of a larger multi-step bar.
  // Without an expected duration it falls back to the library's progress
  // event, which is a ratio against the first input's length.
  function execTracked(ffmpeg, args, statusEl, expectedSec, base, span) {
    base = base || 0;
    span = span === undefined ? 1 : span;
    var seenTime = false;
    function report(f) {
      setProgressFraction(statusEl, base + span * Math.max(0, Math.min(0.99, f)));
    }
    function onLog(e) {
      if (!(expectedSec > 0)) return;
      var m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec((e && e.message) || '');
      if (!m) return;
      seenTime = true;
      report((parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3])) / expectedSec);
    }
    function onProg(e) {
      if (expectedSec > 0 || seenTime) return;
      if (e && isFinite(e.progress) && e.progress >= 0) report(e.progress);
    }
    function detach() {
      try { ffmpeg.off('log', onLog); ffmpeg.off('progress', onProg); } catch (err) { /* non-fatal */ }
    }
    try { ffmpeg.on('log', onLog); ffmpeg.on('progress', onProg); } catch (err) { /* no event support — bar just stays put */ }
    return ffmpeg.exec(args).then(function (r) {
      detach();
      setProgressFraction(statusEl, base + span);
      return r;
    }, function (err) { detach(); throw err; });
  }

  function withTimeout(promise, ms, message) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error(message)); }, ms);
      promise.then(
        function (v) { clearTimeout(timer); resolve(v); },
        function (e) { clearTimeout(timer); reject(e); }
      );
    });
  }

  // worker.js (the "class worker" ffmpeg's main thread talks to) imports two
  // sibling modules by relative path — './const.js' and './errors.js' — which
  // can't resolve once worker.js itself is loaded from a blob: URL (blobs have
  // no real path for relative imports to resolve against). So: fetch all three
  // as text ourselves, blob the two dependencies first, then patch worker.js's
  // own source text to point at those blob URLs before blobbing it too. This
  // is a manual version of the workaround ffmpeg.wasm's own maintainers
  // describe (see their GitHub issue #767) for the non-bundled single-file case.
  function buildPatchedWorkerBlobURL() {
    console.log('[sakuga-enhancer] ffmpeg: fetching worker.js + its dependencies…');
    return Promise.all([
      fetch(FFMPEG_PKG_BASE + '/worker.js').then(function (r) { return r.text(); }),
      fetch(FFMPEG_PKG_BASE + '/const.js').then(function (r) { return r.text(); }),
      fetch(FFMPEG_PKG_BASE + '/errors.js').then(function (r) { return r.text(); })
    ]).then(function (texts) {
      var workerSrc = texts[0], constSrc = texts[1], errorsSrc = texts[2];
      var constBlobUrl = URL.createObjectURL(new Blob([constSrc], { type: 'text/javascript' }));
      var errorsBlobUrl = URL.createObjectURL(new Blob([errorsSrc], { type: 'text/javascript' }));
      var patched = workerSrc.split('./const.js').join(constBlobUrl).split('./errors.js').join(errorsBlobUrl);
      console.log('[sakuga-enhancer] ffmpeg: patched worker.js imports, sizes —',
        'worker:', workerSrc.length, 'const:', constSrc.length, 'errors:', errorsSrc.length);
      return URL.createObjectURL(new Blob([patched], { type: 'text/javascript' }));
    });
  }

  function ensureFfmpegLoaded(statusEl) {
    if (ffmpegInstance) return Promise.resolve(ffmpegInstance);
    if (ffmpegLoadPromise) return ffmpegLoadPromise;
    ffmpegLoadPromise = (function () {
      setBusyStatus(statusEl, 'loading video tool… (first time only, your browser caches it after this)');
      console.log('[sakuga-enhancer] ffmpeg: importing wrapper + util modules…');
      return Promise.all([import(FFMPEG_PKG_URL), import(FFMPEG_UTIL_URL)]).then(function (mods) {
        console.log('[sakuga-enhancer] ffmpeg: modules imported, fetching core/wasm/worker…');
        var FFmpeg = mods[0].FFmpeg;
        var toBlobURL = mods[1].toBlobURL;
        return Promise.all([
          toBlobURL(FFMPEG_CORE_BASE + '/ffmpeg-core.js', 'text/javascript'),
          toBlobURL(FFMPEG_CORE_BASE + '/ffmpeg-core.wasm', 'application/wasm'),
          buildPatchedWorkerBlobURL()
        ]).then(function (urls) {
          console.log('[sakuga-enhancer] ffmpeg: all files ready, calling ffmpeg.load()…');
          var ffmpeg = new FFmpeg();
          try {
            ffmpeg.on('log', function (e) { console.log('[ffmpeg]', e.message); });
          } catch (e) { /* .on not available on this build — non-fatal */ }
          var loadPromise = ffmpeg.load({ coreURL: urls[0], wasmURL: urls[1], classWorkerURL: urls[2] });
          return withTimeout(loadPromise, 20000,
            "video tool took too long to start (over 20s) — its worker likely failed silently. " +
            "Check the console for [sakuga-enhancer]/[ffmpeg] messages to see where it stopped."
          ).then(function () {
            console.log('[sakuga-enhancer] ffmpeg: loaded successfully.');
            ffmpegInstance = ffmpeg;
            return ffmpeg;
          });
        });
      });
    })().catch(function (err) { ffmpegLoadPromise = null; throw err; });
    return ffmpegLoadPromise;
  }

  function getFfmpegConsent(statusEl) {
    if (localStorage.getItem(FFMPEG_CONSENT_KEY) === '1') return Promise.resolve();
    return new Promise(function (resolve, reject) {
      statusEl.innerHTML =
        'this needs a one-time ~25–30MB download (your browser caches it afterward, so this only happens once) — ' +
        '<a href="#" id="sk-ffmpeg-yes" style="color:' + C.amber + '">continue</a> · ' +
        '<a href="#" id="sk-ffmpeg-no" style="color:' + C.dim + '">cancel</a>';
      statusEl.querySelector('#sk-ffmpeg-yes').onclick = function (e) {
        e.preventDefault();
        localStorage.setItem(FFMPEG_CONSENT_KEY, '1');
        statusEl.textContent = '';
        resolve();
      };
      statusEl.querySelector('#sk-ffmpeg-no').onclick = function (e) {
        e.preventDefault();
        statusEl.textContent = '';
        reject(new Error('cancelled'));
      };
    });
  }

  // Takes an already-available source buffer rather than fetching p.file_url
  // itself, so the same trim logic works both for a remote post (fetch
  // first, then call this) and a local in-memory result like a freshly
  // generated grid export (already have the bytes, no fetch needed).
  function performTrim(sourceBuffer, sourceExt, inTime, outTime, statusEl, accurate) {
    return getFfmpegConsent(statusEl)
      .then(function () { return ensureFfmpegLoaded(statusEl); })
      .then(function (ffmpeg) {
        var inputName = 'input.' + (sourceExt || 'webm');
        var outputName = accurate ? 'output.mp4' : 'output.' + (sourceExt || 'webm');
        var startedAt = Date.now();
        return ffmpeg.writeFile(inputName, new Uint8Array(sourceBuffer)).then(function () {
          var args;
          if (accurate) {
            setBusyStatus(statusEl, 'trimming (re-encoding for frame accuracy — slower)…', 0);
            // `-ss`/`-to` placed AFTER `-i`, with real encoders instead of `-c copy`:
            // stream-copy can only cut on keyframe boundaries since it never decodes
            // the video, so the actual start/end can drift from what was marked.
            // Re-encoding is the only way to land on the exact requested frame —
            // slower and a generation of quality loss, but genuinely frame-accurate.
            args = ['-i', inputName, '-ss', String(inTime), '-to', String(outTime),
              '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15', '-c:a', 'aac', outputName];
          } else {
            setBusyStatus(statusEl, 'trimming (fast mode)…', 0);
            // Fast stream-copy: no decoding, just remuxing existing compressed data —
            // much quicker, but can only cut on the nearest keyframe, so the actual
            // start/end may land a little before/after what was marked.
            args = ['-ss', String(inTime), '-to', String(outTime), '-i', inputName, '-c', 'copy', outputName];
          }
          return execTracked(ffmpeg, args, statusEl, outTime - inTime);
        }).then(function () {
          return ffmpeg.readFile(outputName);
        }).then(function (data) {
          var seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
          statusEl.textContent = 'done in ' + seconds + 's';
          var ext = accurate ? 'mp4' : (sourceExt || 'webm');
          return { blob: new Blob([data.buffer], { type: 'video/' + ext }), ext: ext };
        });
      });
  }

