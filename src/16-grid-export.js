  // Real tag names on this booru always write a colon-subtitle boundary as
  // ":_" (space becomes underscore just like everywhere else) — e.g.
  // "re:_zero_kara_hajimeru...", "hunter_x_hunter:_greed_island". The type
  // input's own space->underscore conversion means typing "re: zero" (a
  // literal space after the colon) happens to reconstruct that exact ":_"
  // sequence and matches fine, while "re:zero" (no space) doesn't — an
  // arbitrary, non-obvious requirement to type a space there. Collapsing
  // ":_" to ":" on both sides of the comparison makes the colon match
  // regardless of whether that incidental space was typed.
  function normalizeForTagMatch(s) {
    return (s || '').replace(/:_/g, ':');
  }

  function probeVideoDuration(url) {
    return new Promise(function (resolve) {
      var v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.src = url;
      var done = false;
      function finish(d) {
        if (done) return;
        done = true;
        v.src = '';
        resolve(d);
      }
      v.addEventListener('loadedmetadata', function () { finish(v.duration || 0); });
      v.addEventListener('error', function () { finish(0); }); // unreadable — treated as 0, excluded from the max-duration calc
      setTimeout(function () { finish(0); }, 15000); // don't let one bad clip hang the whole export
    });
  }

  // Advanced-only: extracts a clip's chosen sub-range to its own file before
  // looping it. Confirmed directly (against real ffmpeg) that looping and
  // trimming the SAME input together doesn't do what you'd expect — combining
  // -stream_loop with input-side -ss/-t on one -i either has no looping
  // effect at all, or (seeking after -i instead) loops the WHOLE original
  // clip and just starts playback at an offset — meaning a "trim to 5-15s"
  // selection would eventually drift into showing 15s+ content once the
  // target duration ran long enough, not repeat 5-15s indefinitely. The only
  // way that actually holds up: extract the sub-range to a real intermediate
  // file first, then loop that file like any other input. Costs a real,
  // separate encode pass per trimmed clip — worth knowing before turning on
  // trims for a lot of clips at once.
  function extractTrimSegment(ffmpeg, inputName, start, duration, outputName, statusEl, base, span) {
    return execTracked(ffmpeg, [
      '-ss', String(start), '-t', String(duration), '-i', inputName,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
      outputName
    ], statusEl, duration, base, span);
  }

  // Names credited on one clip: its artist-type tags, title-cased.
  function clipAnimatorNames(p) {
    return safeMap(
      safeFilter((p.tags || '').split(/\s+/), function (t) { return t && tagTypeMap && tagTypeMap[t] === 1; }),
      function (t) { return titleCase(t.replace(/_/g, ' ')); }
    );
  }

  // The text block drawn on one clip: the custom override if there is one
  // (wrapped at its own word breaks), else the animator names, else null.
  // Shared by the real export and the composer's live preview so the two
  // can never disagree about what a label says or how it wraps.
  function buildLabelFor(p, override, cellW, cellH) {
    if (override && override.trim()) {
      return buildClipLabel(safeFilter(override.trim().split(/\s+/), function (w) { return !!w; }), ' ', cellW, cellH);
    }
    var names = clipAnimatorNames(p);
    return names.length ? buildAnimatorLabel(names, cellW, cellH) : null;
  }

  function performGridExport(clips, statusEl, orientation, mode, trims, loopMode, labelMode, format, labelStyle, labelOverrides, musicFiles, musicLoop, labelPos) {
    if (clips.length < 2) return Promise.reject(new Error('need at least 2 video clips in this pool'));
    // Each entry in clips is a {post, instId} occurrence, not a bare post —
    // this is what lets the same clip appear twice in a sequence (see the
    // export panel's 'duplicate' button) with its own independent trim
    // range and label the second time. Flattening to the post's own fields
    // plus .id = instId here, once, means nothing below this point needs to
    // change at all: every existing p.id / p.file_url / p.tags / p.file_ext
    // reference already does the right thing, whether or not this
    // particular occurrence shares its underlying post with another one.
    clips = safeMap(clips, function (c) {
      var flat = {};
      for (var k in c.post) { if (Object.prototype.hasOwnProperty.call(c.post, k)) flat[k] = c.post[k]; }
      flat.id = c.instId;
      return flat;
    });
    trims = trims || {};
    loopMode = loopMode || 'replay';
    labelMode = labelMode || 'off';
    format = format || 'grid';
    labelStyle = labelStyle || 'outline';
    labelOverrides = labelOverrides || {};
    musicFiles = musicFiles || [];
    labelPos = labelPos || { fx: 0, fy: 1 };

    return getFfmpegConsent(statusEl)
      .then(function () { return ensureFfmpegLoaded(statusEl); })
      .then(function (ffmpeg) {
        var fontReady = labelMode !== 'off' ? ensureLabelFont(ffmpeg) : Promise.resolve();
        var tagsReady = labelMode !== 'off' ? ensureTagTypes() : Promise.resolve();
        return Promise.all([fontReady, tagsReady]).then(function () {
        setBusyStatus(statusEl, 'checking clip lengths…', null);
        return Promise.all(safeMap(clips, function (p) { return probeVideoDuration(p.file_url); })).then(function (naturalDurations) {
          // Effective duration is the trimmed range's length when a clip has
          // one, not the full clip's natural length. For grid mode this
          // feeds the target-duration/looping decision; for serial mode
          // there's no target to loop toward — each clip just plays once,
          // for however long its own (possibly trimmed) length is — but the
          // number is still needed there too, just for the trim-extraction
          // step below, not for any duration/looping decision.
          var effectiveDurations = safeMap(clips, function (p, i) {
            var trim = trims[p.id];
            if (!trim) return naturalDurations[i];
            var end = Math.min(trim.end, naturalDurations[i] > 0 ? naturalDurations[i] : trim.end);
            return Math.max(0.1, end - trim.start);
          });

          var targetDuration = 1; // guard against every probe failing; unused in serial mode
          for (var di = 0; di < effectiveDurations.length; di++) {
            if (effectiveDurations[di] > targetDuration) targetDuration = effectiveDurations[di];
          }

          // Serial mode has no grid to subdivide — every clip gets the same
          // single, larger frame (see SERIAL_LONG/SHORT) instead of a
          // computed cell position within a shared canvas.
          var positions, canvasW, canvasH;
          if (format === 'serial') {
            var serialW = orientation === 'portrait' ? SERIAL_SHORT : SERIAL_LONG;
            var serialH = orientation === 'portrait' ? SERIAL_LONG : SERIAL_SHORT;
            canvasW = serialW; canvasH = serialH;
            positions = safeMap(clips, function () { return { x: 0, y: 0, w: serialW, h: serialH }; });
          } else {
            positions = computeCellPositions(clips.length, orientation, mode);
            canvasW = 0; canvasH = 0;
            for (var pi0 = 0; pi0 < positions.length; pi0++) {
              if (positions[pi0].x + positions[pi0].w > canvasW) canvasW = positions[pi0].x + positions[pi0].w;
              if (positions[pi0].y + positions[pi0].h > canvasH) canvasH = positions[pi0].y + positions[pi0].h;
            }
          }

          // Fetch + write each input sequentially rather than all at once —
          // keeps peak memory lower given everything is decoded/held in the
          // same wasm heap during the actual encode step regardless.
          // Progress bar budget across the whole export: fetching clips,
          // extracting trims (if any), combining music (if more than one
          // track) and the main encode, which gets whatever's left.
          var trimCount = 0;
          clips.forEach(function (p) { if (trims[p.id]) trimCount++; });
          var fetchW = 0.1;
          var trimW = trimCount ? 0.2 : 0;
          var musicW = musicFiles.length > 1 ? 0.05 : 0;
          var compBase = fetchW + trimW + musicW;
          var compSpan = 1 - compBase;

          var writeChain = Promise.resolve();
          clips.forEach(function (p, i) {
            writeChain = writeChain.then(function () {
              setBusyStatus(statusEl, 'fetching clip ' + (i + 1) + ' of ' + clips.length + '…', fetchW * (i / clips.length));
              return fetch(p.file_url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
                return ffmpeg.writeFile('grid_in' + i + '.' + (p.file_ext || 'mp4'), new Uint8Array(buf));
              });
            });
          });

          // Extract each trimmed clip's sub-range to its own file — has to
          // happen after every clip is downloaded (each is its own ffmpeg
          // exec pass) but before the main compositing pass, which needs to
          // know the final filename for every input up front.
          var effectiveNames = new Array(clips.length);
          var trimDone = 0;
          clips.forEach(function (p, i) {
            effectiveNames[i] = 'grid_in' + i + '.' + (p.file_ext || 'mp4');
            var trim = trims[p.id];
            if (!trim) return;
            writeChain = writeChain.then(function () {
              var tBase = fetchW + trimW * (trimDone / trimCount);
              var tSpan = trimW / trimCount;
              trimDone++;
              setBusyStatus(statusEl, 'trimming clip ' + (i + 1) + ' of ' + clips.length + '…', tBase);
              var outputName = 'grid_trim' + i + '.mp4';
              return extractTrimSegment(ffmpeg, effectiveNames[i], trim.start, trim.end - trim.start, outputName, statusEl, tBase, tSpan).then(function () {
                effectiveNames[i] = outputName;
              });
            });
          });

          return writeChain.then(function () {
            var startedAt = Date.now();
            var args = [];
            var filterParts = [];

            // Explicit black background, then chained `overlay` filters
            // instead of `xstack` — confirmed directly (by reproducing this
            // exact filter graph locally, not just reasoned about) that
            // xstack leaves any canvas area no input covers as uninitialized
            // memory rather than actually black, which rendered as bright
            // green in exactly the gaps a "center leftover row" layout
            // produces. Only grid mode needs this at all — serial mode's
            // concat has no gaps to cover, every clip fills the one shared
            // frame completely in its own turn.
            if (format === 'grid') {
              filterParts.push('color=c=black:s=' + canvasW + 'x' + canvasH + ':r=24[bg]');
            }

            clips.forEach(function (p, i) {
              var needsLoop = format === 'grid' && effectiveDurations[i] > 0 && effectiveDurations[i] < targetDuration - 0.1;
              var willStopInstead = needsLoop && loopMode === 'stop';
              if (needsLoop && !willStopInstead) args.push('-stream_loop', '-1');
              args.push('-i', effectiveNames[i]);
              // Every box — including a 'stretch' mode featured clip's, or
              // serial mode's single shared frame — is sized to the
              // source's own natural aspect ratio, so the same
              // aspect-preserving scale+pad works uniformly everywhere; no
              // distortion needed anywhere.
              var pos = positions[i];
              var chain =
                '[' + i + ':v]scale=' + pos.w + ':' + pos.h +
                ':force_original_aspect_ratio=decrease,pad=' + pos.w + ':' + pos.h +
                ':(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=24';
              if (willStopInstead) {
                // Confirmed directly (against real ffmpeg, with a clip whose
                // content changes partway through so looping vs. freezing
                // would actually look different) that tpad's clone mode
                // holds the clip's own last frame rather than restarting it
                // — this is a genuine freeze, not a disguised loop. Without
                // this, simply omitting -stream_loop would let this input
                // hit EOF early and cut the whole composite short at that
                // point, since xstack/overlay's default policy is bounded
                // by the shortest input. (Serial mode never sets needsLoop
                // in the first place, so this never applies there — every
                // clip in a sequence is meant to just play through once.)
                chain += ',tpad=stop_mode=clone:stop_duration=' + (targetDuration - effectiveDurations[i]).toFixed(2);
              }
              if (labelMode !== 'off') {
                // A custom label replaces the auto-detected staff names
                // entirely for this clip; otherwise only this clip's own
                // animator tags are used (not the show or other tags).
                var built = buildLabelFor(p, labelOverrides[p.id], pos.w, pos.h);
                if (built) {
                  // Free room = frame size minus the text block; the label sits
                  // at that fraction of it (0 = left/top, 1 = right/bottom),
                  // then is clamped to keep a 10px margin from every edge.
                  // The escaped commas are required inside a filtergraph.
                  var fxNum = Math.max(0, Math.min(1, Number(labelPos.fx))) || 0;
                  var fyNum = Math.max(0, Math.min(1, Number(labelPos.fy)));
                  if (isNaN(fyNum)) fyNum = 1;
                  var xExpr = 'max(10\\,min(w-tw-10\\,(w-tw)*' + fxNum.toFixed(4) + '))';
                  var yExpr = 'max(10\\,min(h-th-10\\,(h-th)*' + fyNum.toFixed(4) + '))';
                  var styleExpr = labelStyle === 'box'
                    ? 'box=1:boxcolor=black@0.5:boxborderw=6'
                    : 'bordercolor=black:borderw=2';
                  chain += ',drawtext=fontfile=label_font.ttf:text=\'' + escapeDrawtext(built.text) + '\'' +
                    ':fontsize=' + built.fontSize + ':fontcolor=white:' + styleExpr + ':line_spacing=4' +
                    ':x=' + xExpr + ':y=' + yExpr;
                }
              }
              filterParts.push(chain + '[v' + i + ']');
            });

            if (format === 'serial') {
              // Confirmed directly (against real ffmpeg, including a
              // mid-sequence trimmed clip and per-clip labels together) that
              // concat plays each input fully, in order, for its own
              // natural/trimmed length — no explicit background or
              // positions needed, unlike the grid's overlay chain, since
              // nothing ever shares the frame with anything else.
              var concatInputs = safeMap(clips, function (p, i) { return '[v' + i + ']'; }).join('');
              filterParts.push(concatInputs + 'concat=n=' + clips.length + ':v=1:a=0[outv]');
            } else {
              var prevLabel = 'bg';
              clips.forEach(function (p, i) {
                var pos = positions[i];
                var outLabel = (i === clips.length - 1) ? 'outv' : 't' + i;
                filterParts.push('[' + prevLabel + '][v' + i + ']overlay=' + pos.x + ':' + pos.y + '[' + outLabel + ']');
                prevLabel = outLabel;
              });
            }

            var filterComplex = filterParts.join(';');

            // Serial mode's own total length is the SUM of every clip's
            // real length (nothing overlaps in time); grid mode's is
            // whatever the longest single clip's own length is (everything
            // else loops or freezes to fill that). Only actually needed as
            // an explicit cap when music is involved (see below) — grid
            // mode already computed and used targetDuration for its own -t
            // regardless of music.
            var outputDurationSec = targetDuration;
            if (format === 'serial') {
              outputDurationSec = 0;
              for (var sdi = 0; sdi < effectiveDurations.length; sdi++) outputDurationSec += effectiveDurations[sdi];
            }

            // Reading the uploaded music file is plain synchronous-feeling
            // browser I/O (no separate ffmpeg pass needed, unlike the
            // trim-extraction step), so this can happen right before the
            // main exec call rather than earlier in the pipeline.
            // Reading the uploaded music file(s) is plain synchronous-feeling
            // browser I/O (no separate ffmpeg pass needed for a single
            // track, unlike the trim-extraction step), so this can happen
            // right before the main exec call rather than earlier in the
            // pipeline.
            var musicReady = musicFiles.length === 0
              ? Promise.resolve(null)
              : Promise.all(safeMap(musicFiles, function (f, i) {
                  return f.arrayBuffer().then(function (buf) {
                    var ext = (f.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
                    var name = 'grid_music_in' + i + '.' + ext;
                    return ffmpeg.writeFile(name, new Uint8Array(buf)).then(function () { return name; });
                  });
                })).then(function (musicNames) {
                  if (musicNames.length === 1) return musicNames[0];
                  // More than one track: combine them into a single track
                  // first, in their own separate ffmpeg pass, before this
                  // gets treated as "the music" for everything below —
                  // confirmed directly (against real ffmpeg, using three
                  // tracks with deliberately different sample rates,
                  // channel layouts, and even container formats/codecs)
                  // that normalizing each to a common sample rate and
                  // channel layout via aformat before concatenating
                  // produces a correctly-ordered combined track regardless
                  // of how mismatched the originals were — verified by
                  // checking the dominant frequency of three distinct test
                  // tones landed in the right order at the right times in
                  // the combined result, not just that the total duration
                  // added up.
                  var inputArgs = [];
                  var filterParts = [];
                  musicNames.forEach(function (name, i) {
                    inputArgs.push('-i', name);
                    filterParts.push('[' + i + ':a]aformat=sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[ma' + i + ']');
                  });
                  var concatInputs = safeMap(musicNames, function (n, i) { return '[ma' + i + ']'; }).join('');
                  filterParts.push(concatInputs + 'concat=n=' + musicNames.length + ':v=0:a=1[outa]');
                  var combinedName = 'grid_music_combined.m4a';
                  var concatArgs = inputArgs.concat([
                    '-filter_complex', filterParts.join(';'), '-map', '[outa]',
                    '-c:a', 'aac', '-b:a', '192k', combinedName
                  ]);
                  setBusyStatus(statusEl, 'combining ' + musicNames.length + ' music tracks…', null);
                  return ffmpeg.exec(concatArgs).then(function () {
                    musicNames.forEach(function (name) { ffmpeg.deleteFile(name).catch(function () {}); });
                    return combinedName;
                  });
                });

            return musicReady.then(function (musicName) {
              if (musicName) {
                // Confirmed directly (against real ffmpeg) that mixing a
                // LONGER audio track in without an explicit -t is genuinely
                // broken, not just untidy: it silently extends the whole
                // output past where the video itself ends (the video
                // stream simply has no frames there, while the container
                // still claims the longer duration) rather than the video
                // freezing or looping. An explicit -t matching the video's
                // own real length avoids that regardless of format.
                //
                // For a SHORTER track, -stream_loop -1 (the same technique
                // already used to loop a shorter video clip elsewhere in
                // this file) repeats it to fill the remainder instead of
                // leaving silence, when that's what's asked for. Confirmed
                // directly this is a genuine loop, not just an extended
                // duration: comparing raw waveform samples at the same
                // offset in two different loop iterations showed identical
                // values (an AAC-encoded first attempt at this same
                // comparison showed mismatched samples, which turned out to
                // be a lossy-compression artifact from encoding the test
                // source itself, not an actual looping bug — re-verified
                // with uncompressed PCM audio throughout to be sure).
                var musicInputIndex = clips.length;
                if (musicLoop) args.push('-stream_loop', '-1');
                args.push('-i', musicName);
                args.push('-filter_complex', filterComplex, '-map', '[outv]', '-map', musicInputIndex + ':a');
                args.push('-t', String(outputDurationSec.toFixed(2)));
                args.push('-c:a', 'aac', '-b:a', '192k');
              } else {
                args.push('-filter_complex', filterComplex, '-map', '[outv]', '-an');
                // Only grid mode needs an explicit cap without music — its
                // duration is "however long until every looping/frozen clip
                // has filled the longest one", which needs the -t to
                // actually stop there. Serial mode's own total length
                // already falls out naturally from concatenating each
                // clip's real length once.
                if (format === 'grid') args.push('-t', String(targetDuration.toFixed(2)));
              }
              args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-r', '24', 'grid_out.mp4');

              setBusyStatus(statusEl, (format === 'serial' ? 'joining clips' : 'compositing grid') + ' (this can take a while)…', compBase);
              return execTracked(ffmpeg, args, statusEl, outputDurationSec, compBase, compSpan).then(function () {
                return ffmpeg.readFile('grid_out.mp4');
              }).then(function (data) {
              var seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
              statusEl.textContent = 'done in ' + seconds + 's';
              // Best-effort cleanup — frees the wasm heap for a subsequent
              // export in the same session; a failure here doesn't affect
              // the result already in hand.
              clips.forEach(function (p, i) {
                ffmpeg.deleteFile('grid_in' + i + '.' + (p.file_ext || 'mp4')).catch(function () {});
                if (trims[p.id]) ffmpeg.deleteFile('grid_trim' + i + '.mp4').catch(function () {});
              });
              ffmpeg.deleteFile('grid_out.mp4').catch(function () {});
              if (musicName) ffmpeg.deleteFile(musicName).catch(function () {});
              return { blob: new Blob([data.buffer], { type: 'video/mp4' }), width: canvasW, height: canvasH, count: clips.length, hasAudio: !!musicName };
            });
            });
          });
        });
        });
      });
  }

