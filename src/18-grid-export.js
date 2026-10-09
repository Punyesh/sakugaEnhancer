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

  // Each entry in `clips` is a {post, instId} occurrence, not a bare post —
  // that is what lets the same clip appear twice in a sequence (the
  // composer's "duplicate") with its own trim range and label. Flattening to
  // the post's own fields plus .id = instId, once, means nothing downstream
  // needs to care whether two occurrences share an underlying post.
  function flattenGridClips(clips) {
    return safeMap(clips, function (c) {
      var flat = {};
      for (var k in c.post) { if (Object.prototype.hasOwnProperty.call(c.post, k)) flat[k] = c.post[k]; }
      flat.id = c.instId;
      return flat;
    });
  }

  // The output frame and where each clip sits in it. Serial mode has no grid
  // to subdivide — every clip gets the same single, larger frame (see
  // SERIAL_LONG/SHORT). Grid mode computes cell positions and takes the
  // canvas as the bounding box of all of them. Shared with the composer's
  // live preview so the preview and the export can never disagree.
  function computeFrame(format, orientation, mode, n) {
    if (format === 'serial') {
      var w = orientation === 'portrait' ? SERIAL_SHORT : SERIAL_LONG;
      var h = orientation === 'portrait' ? SERIAL_LONG : SERIAL_SHORT;
      return { W: w, H: h, positions: [{ x: 0, y: 0, w: w, h: h }] };
    }
    var pos = computeCellPositions(Math.max(n, 1), orientation, mode);
    var W = 0, H = 0;
    for (var i = 0; i < pos.length; i++) {
      if (pos[i].x + pos[i].w > W) W = pos[i].x + pos[i].w;
      if (pos[i].y + pos[i].h > H) H = pos[i].y + pos[i].h;
    }
    return { W: W, H: H, positions: pos };
  }

  // Effective duration is the trimmed range's length when a clip has one, not
  // the full clip's natural length. Grid mode uses the longest as the target
  // everything else loops/freezes up to; serial mode just plays each once
  // (the number is still needed there for the trim step and the total length).
  function computeEffectiveDurations(clips, trims, naturalDurations) {
    var effective = safeMap(clips, function (p, i) {
      var trim = trims[p.id];
      if (!trim) return naturalDurations[i];
      var end = Math.min(trim.end, naturalDurations[i] > 0 ? naturalDurations[i] : trim.end);
      return Math.max(0.1, end - trim.start);
    });
    var target = 1; // guard against every probe failing; unused in serial mode
    for (var i = 0; i < effective.length; i++) {
      if (effective[i] > target) target = effective[i];
    }
    return { effective: effective, target: target };
  }

  // Downloads every clip into the ffmpeg filesystem (one at a time — peak
  // memory is lower, and everything lives in the same wasm heap during the
  // encode anyway), then extracts the sub-range of each trimmed clip to its
  // own file. Trims have to come after every download (each is its own
  // ffmpeg pass) but before the compositing pass, which needs every input's
  // final filename up front. Resolves to those filenames, one per clip.
  function loadGridInputs(ffmpeg, clips, trims, statusEl, w) {
    var trimCount = 0;
    clips.forEach(function (p) { if (trims[p.id]) trimCount++; });
    var chain = Promise.resolve();
    clips.forEach(function (p, i) {
      chain = chain.then(function () {
        setBusyStatus(statusEl, 'fetching clip ' + (i + 1) + ' of ' + clips.length + '…', w.fetch * (i / clips.length));
        return fetch(p.file_url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
          return ffmpeg.writeFile('grid_in' + i + '.' + (p.file_ext || 'mp4'), new Uint8Array(buf));
        });
      });
    });
    var names = new Array(clips.length);
    var trimDone = 0;
    clips.forEach(function (p, i) {
      names[i] = 'grid_in' + i + '.' + (p.file_ext || 'mp4');
      var trim = trims[p.id];
      if (!trim) return;
      chain = chain.then(function () {
        var tBase = w.fetch + w.trim * (trimDone / trimCount);
        var tSpan = w.trim / trimCount;
        trimDone++;
        setBusyStatus(statusEl, 'trimming clip ' + (i + 1) + ' of ' + clips.length + '…', tBase);
        var outputName = 'grid_trim' + i + '.mp4';
        return extractTrimSegment(ffmpeg, names[i], trim.start, trim.end - trim.start, outputName, statusEl, tBase, tSpan).then(function () {
          names[i] = outputName;
        });
      });
    });
    return chain.then(function () { return names; });
  }

  // The drawtext fragment for one clip's label, placed at fraction (fx, fy) of
  // the free room inside the frame (0 = left/top, 1 = right/bottom), clamped
  // to keep a 10px margin from every edge. Escaped commas are required inside
  // a filtergraph.
  function buildDrawtext(built, labelPos, labelStyle) {
    var fxNum = Math.max(0, Math.min(1, Number(labelPos.fx))) || 0;
    var fyNum = Math.max(0, Math.min(1, Number(labelPos.fy)));
    if (isNaN(fyNum)) fyNum = 1;
    var xExpr = 'max(10\\,min(w-tw-10\\,(w-tw)*' + fxNum.toFixed(4) + '))';
    var yExpr = 'max(10\\,min(h-th-10\\,(h-th)*' + fyNum.toFixed(4) + '))';
    var styleExpr = labelStyle === 'box'
      ? 'box=1:boxcolor=black@0.5:boxborderw=6'
      : 'bordercolor=black:borderw=2';
    return ',drawtext=fontfile=label_font.ttf:text=\'' + escapeDrawtext(built.text) + '\'' +
      ':fontsize=' + built.fontSize + ':fontcolor=white:' + styleExpr + ':line_spacing=4' +
      ':x=' + xExpr + ':y=' + yExpr;
  }

  // The ffmpeg input arguments and -filter_complex graph for the composite.
  // Pure: everything it needs is passed in, nothing is read or written.
  //   o.clips, o.names, o.durations, o.target, o.positions, o.canvas {W,H}
  //   o.format, o.loopMode, o.labelMode, o.labelOverrides, o.labelPos, o.labelStyle
  function buildGridFilterGraph(o) {
    var clips = o.clips;
    var inputArgs = [];
    var filterParts = [];

    // Explicit black background, then chained `overlay` filters instead of
    // `xstack` — confirmed directly (by reproducing this exact filter graph
    // locally) that xstack leaves any canvas area no input covers as
    // uninitialized memory rather than black, which rendered as bright green
    // in exactly the gaps a "center leftover row" layout produces. Only grid
    // mode needs this — serial mode's concat has no gaps to cover.
    if (o.format === 'grid') {
      filterParts.push('color=c=black:s=' + o.canvas.W + 'x' + o.canvas.H + ':r=24[bg]');
    }

    clips.forEach(function (p, i) {
      var needsLoop = o.format === 'grid' && o.durations[i] > 0 && o.durations[i] < o.target - 0.1;
      var willStopInstead = needsLoop && o.loopMode === 'stop';
      if (needsLoop && !willStopInstead) inputArgs.push('-stream_loop', '-1');
      inputArgs.push('-i', o.names[i]);
      // Every box — a 'stretch' featured clip's, or serial mode's single
      // shared frame — is sized to the source's own aspect ratio, so the
      // same aspect-preserving scale+pad works uniformly; nothing distorts.
      var pos = o.positions[i];
      var chain =
        '[' + i + ':v]scale=' + pos.w + ':' + pos.h +
        ':force_original_aspect_ratio=decrease,pad=' + pos.w + ':' + pos.h +
        ':(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=24';
      if (willStopInstead) {
        // Confirmed directly (against real ffmpeg, with a clip whose content
        // changes partway through) that tpad's clone mode holds the clip's
        // own last frame rather than restarting it — a genuine freeze, not a
        // disguised loop. Without this, omitting -stream_loop would let the
        // input hit EOF early and cut the composite short, since overlay's
        // default policy is bounded by the shortest input. (Serial mode
        // never sets needsLoop: every clip just plays through once.)
        chain += ',tpad=stop_mode=clone:stop_duration=' + (o.target - o.durations[i]).toFixed(2);
      }
      if (o.labelMode !== 'off') {
        // A custom label replaces the auto-detected staff names for this
        // clip; otherwise only its own animator tags are used.
        var built = buildLabelFor(p, o.labelOverrides[p.id], pos.w, pos.h);
        if (built) chain += buildDrawtext(built, o.labelPos, o.labelStyle);
      }
      filterParts.push(chain + '[v' + i + ']');
    });

    if (o.format === 'serial') {
      // Confirmed directly (against real ffmpeg, including a mid-sequence
      // trimmed clip and per-clip labels together) that concat plays each
      // input fully, in order, for its own natural/trimmed length.
      var concatInputs = safeMap(clips, function (p, i) { return '[v' + i + ']'; }).join('');
      filterParts.push(concatInputs + 'concat=n=' + clips.length + ':v=1:a=0[outv]');
    } else {
      var prevLabel = 'bg';
      clips.forEach(function (p, i) {
        var pos = o.positions[i];
        var outLabel = (i === clips.length - 1) ? 'outv' : 't' + i;
        filterParts.push('[' + prevLabel + '][v' + i + ']overlay=' + pos.x + ':' + pos.y + '[' + outLabel + ']');
        prevLabel = outLabel;
      });
    }
    return { inputArgs: inputArgs, filterComplex: filterParts.join(';') };
  }

  // Writes the uploaded music into ffmpeg's filesystem and resolves to the
  // single filename to mix in (or null for no music). More than one track:
  // they are first combined into one, in their own ffmpeg pass — confirmed
  // directly (against real ffmpeg, three tracks with deliberately different
  // sample rates, channel layouts and container formats) that normalizing
  // each to a common sample rate and channel layout with aformat before
  // concatenating yields a correctly ordered combined track, verified by the
  // dominant frequency of three distinct test tones landing in the right
  // order at the right times.
  function prepareMusicTrack(ffmpeg, musicFiles, statusEl) {
    if (musicFiles.length === 0) return Promise.resolve(null);
    return Promise.all(safeMap(musicFiles, function (f, i) {
      return f.arrayBuffer().then(function (buf) {
        var ext = (f.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
        var name = 'grid_music_in' + i + '.' + ext;
        return ffmpeg.writeFile(name, new Uint8Array(buf)).then(function () { return name; });
      });
    })).then(function (musicNames) {
      if (musicNames.length === 1) return musicNames[0];
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
  }

  // Best-effort cleanup — frees the wasm heap for a later export in the same
  // session; a failure here doesn't affect the result already in hand.
  function cleanupGridFiles(ffmpeg, clips, trims, musicName) {
    clips.forEach(function (p, i) {
      ffmpeg.deleteFile('grid_in' + i + '.' + (p.file_ext || 'mp4')).catch(function () {});
      if (trims[p.id]) ffmpeg.deleteFile('grid_trim' + i + '.mp4').catch(function () {});
    });
    ffmpeg.deleteFile('grid_out.mp4').catch(function () {});
    if (musicName) ffmpeg.deleteFile(musicName).catch(function () {});
  }

  function performGridExport(clips, statusEl, orientation, mode, trims, loopMode, labelMode, format, labelStyle, labelOverrides, musicFiles, musicLoop, labelPos) {
    if (clips.length < 2) return Promise.reject(new Error('need at least 2 video clips in this pool'));
    clips = flattenGridClips(clips);
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
          return Promise.all(safeMap(clips, function (p) { return probeVideoDuration(p.file_url); }));
        }).then(function (naturalDurations) {
          var dur = computeEffectiveDurations(clips, trims, naturalDurations);
          var frame = computeFrame(format, orientation, mode, clips.length);
          var positions = format === 'serial'
            ? safeMap(clips, function () { return frame.positions[0]; })
            : frame.positions;

          // Progress bar budget across the whole export: fetching clips,
          // extracting trims (if any), combining music (if more than one
          // track) and the main encode, which gets whatever's left.
          var trimCount = 0;
          clips.forEach(function (p) { if (trims[p.id]) trimCount++; });
          var weights = { fetch: 0.1, trim: trimCount ? 0.2 : 0 };
          var musicW = musicFiles.length > 1 ? 0.05 : 0;
          var compBase = weights.fetch + weights.trim + musicW;
          var compSpan = 1 - compBase;

          return loadGridInputs(ffmpeg, clips, trims, statusEl, weights).then(function (names) {
            var startedAt = Date.now();
            var graph = buildGridFilterGraph({
              clips: clips, names: names, durations: dur.effective, target: dur.target,
              positions: positions, canvas: { W: frame.W, H: frame.H },
              format: format, loopMode: loopMode, labelMode: labelMode,
              labelOverrides: labelOverrides, labelPos: labelPos, labelStyle: labelStyle
            });

            // Serial mode's total length is the SUM of every clip's real
            // length (nothing overlaps in time); grid mode's is the longest
            // single clip (everything else loops or freezes to fill that).
            var outputDurationSec = dur.target;
            if (format === 'serial') {
              outputDurationSec = 0;
              for (var sdi = 0; sdi < dur.effective.length; sdi++) outputDurationSec += dur.effective[sdi];
            }

            return prepareMusicTrack(ffmpeg, musicFiles, statusEl).then(function (musicName) {
              var args = graph.inputArgs.slice();
              if (musicName) {
                // Confirmed directly (against real ffmpeg) that mixing a
                // LONGER audio track in without an explicit -t is genuinely
                // broken: it silently extends the output past where the
                // video ends (no frames there, but the container still
                // claims the longer duration). An explicit -t matching the
                // video's own length avoids that regardless of format.
                //
                // For a SHORTER track, -stream_loop -1 (the same technique
                // used to loop a shorter video clip) repeats it to fill the
                // remainder, when asked for. Confirmed a genuine loop by
                // comparing raw PCM samples at the same offset in two
                // different iterations (an AAC-encoded comparison showed
                // mismatches that were a lossy-compression artifact of the
                // test source, not a looping bug).
                var musicInputIndex = clips.length;
                if (musicLoop) args.push('-stream_loop', '-1');
                args.push('-i', musicName);
                args.push('-filter_complex', graph.filterComplex, '-map', '[outv]', '-map', musicInputIndex + ':a');
                args.push('-t', String(outputDurationSec.toFixed(2)));
                args.push('-c:a', 'aac', '-b:a', '192k');
              } else {
                args.push('-filter_complex', graph.filterComplex, '-map', '[outv]', '-an');
                // Only grid mode needs an explicit cap without music: its
                // length is "until every looping/frozen clip has filled the
                // longest one". Serial mode's total falls out of
                // concatenating each clip's real length once.
                if (format === 'grid') args.push('-t', String(dur.target.toFixed(2)));
              }
              args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-r', '24', 'grid_out.mp4');

              setBusyStatus(statusEl, (format === 'serial' ? 'joining clips' : 'compositing grid') + ' (this can take a while)…', compBase);
              return execTracked(ffmpeg, args, statusEl, outputDurationSec, compBase, compSpan).then(function () {
                return ffmpeg.readFile('grid_out.mp4');
              }).then(function (data) {
                var seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
                statusEl.textContent = 'done in ' + seconds + 's';
                cleanupGridFiles(ffmpeg, clips, trims, musicName);
                return { blob: new Blob([data.buffer], { type: 'video/mp4' }), width: frame.W, height: frame.H, count: clips.length, hasAudio: !!musicName };
              });
            });
          });
        });
      });
  }
