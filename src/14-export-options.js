  // ---------- Export options (format / quality) for the download windows ----------
  // Ported from Klippit's export logic: MP4 re-encodes with libx264 at a
  // chosen CRF, GIF uses a single palettegen+paletteuse graph, APNG is a
  // direct lossless pass with -plays 0 (loop forever). Resolution means the
  // SHORT side of the frame (so 480p is sensible for portrait grids too) and
  // never upscales. GIF/APNG have no audio, so audio is dropped for them.
  function performExport(sourceBuffer, sourceExt, inTime, outTime, opts, statusEl) {
    return getFfmpegConsent(statusEl)
      .then(function () { return ensureFfmpegLoaded(statusEl); })
      .then(function (ffmpeg) {
        var inputName = 'input.' + (sourceExt || 'mp4');
        var outExt = opts.format === 'gif' ? 'gif' : opts.format === 'apng' ? 'png' : 'mp4';
        var outputName = 'output.' + outExt;
        var paletteName = 'palette.png';
        var startedAt = Date.now();
        var hasRange = inTime !== null && outTime !== null;
        // How long the output will be — what the progress bar measures against.
        var expectedSec = hasRange ? (outTime - inTime) : (opts.duration || 0);

        var scale = '';
        if (opts.res && opts.srcW && opts.srcH && Math.min(opts.srcW, opts.srcH) > opts.res) {
          scale = opts.srcH <= opts.srcW ? ('scale=-2:' + opts.res) : ('scale=' + opts.res + ':-2');
        }
        // Range as INPUT options: seeks first, then decodes+re-encodes only
        // the wanted span, still frame-accurate since this always re-encodes.
        var inArgs = hasRange ? ['-ss', String(inTime), '-to', String(outTime), '-i', inputName] : ['-i', inputName];
        var shape = 'fps=' + opts.fps + (scale ? ',' + scale + ':flags=lanczos' : '');
        var label = opts.format.toUpperCase();

        function cleanup() {
          [inputName, outputName, paletteName].forEach(function (n) { ffmpeg.deleteFile(n).catch(function () {}); });
        }

        return ffmpeg.writeFile(inputName, new Uint8Array(sourceBuffer)).then(function () {
          if (opts.format === 'gif') {
            // Two passes (palette, then encode) rather than one split graph:
            // the palette pass can't report progress (it emits a single
            // frame at the very end), so it gets a moving bar of its own and
            // the encode pass gets the real percentage.
            setBusyStatus(statusEl, 'GIF 1 of 2: building palette…', null);
            return ffmpeg.exec(inArgs.concat(['-vf', shape + ',palettegen', paletteName])).then(function () {
              setBusyStatus(statusEl, 'GIF 2 of 2: encoding…', 0);
              return execTracked(ffmpeg, inArgs.concat([
                '-i', paletteName,
                '-filter_complex', shape + '[x];[x][1:v]paletteuse=dither=bayer',
                '-loop', '0', outputName]), statusEl, expectedSec);
            });
          }
          var args = inArgs.slice();
          if (opts.format === 'apng') {
            args.push('-an', '-vf', shape, '-plays', '0', '-f', 'apng', outputName);
          } else {
            args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(opts.crf));
            if (scale) args.push('-vf', scale);
            if (opts.mute) args.push('-an'); else args.push('-c:a', 'aac');
            args.push(outputName);
          }
          setBusyStatus(statusEl, 'exporting ' + label + '… (re-encoding — can take a while for long or large clips)', 0);
          return execTracked(ffmpeg, args, statusEl, expectedSec);
        }).then(function () {
          return ffmpeg.readFile(outputName);
        }).then(function (data) {
          cleanup();
          statusEl.textContent = 'done in ' + ((Date.now() - startedAt) / 1000).toFixed(1) + 's' +
            ' (' + (data.length / 1048576).toFixed(1) + ' MB)';
          var mime = outExt === 'mp4' ? 'video/mp4' : 'image/' + (outExt === 'gif' ? 'gif' : 'png');
          return { blob: new Blob([data.buffer], { type: mime }), ext: outExt };
        }, function (err) { cleanup(); throw err; });
      });
  }

  // Adds a quiet "more options" tickbox + a collapsible settings block above
  // the Download buttons. Returns getOpts(): null while unticked (so callers
  // keep their existing behavior untouched), else the chosen settings.
  function buildExportOptions(box, vid, hasAudio) {
    var wrap = document.createElement('div');
    wrap.className = 'sk-trim-row';
    wrap.innerHTML =
      '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:' + C.dim + ';cursor:pointer">' +
        '<input type="checkbox" id="sk-more-opts" style="accent-color:' + C.amber + '">' +
        'more options (format, quality)' +
      '</label>';
    box.appendChild(wrap);

    var panel = document.createElement('div');
    panel.className = 'sk-trim-row';
    panel.style.display = 'none';
    var selStyle = 'style="min-width:0"';
    panel.innerHTML =
      '<span class="sk-trim-label">format</span>' +
      '<select class="sk-select" id="sk-xo-fmt" ' + selStyle + '>' +
        '<option value="mp4">MP4</option><option value="gif">GIF</option><option value="apng">APNG</option></select>' +
      '<span class="sk-trim-label">size</span>' +
      '<select class="sk-select" id="sk-xo-res" ' + selStyle + '></select>' +
      '<span id="sk-xo-crf-wrap" style="display:flex;align-items:center;gap:6px">' +
        '<span class="sk-trim-label">crf <b id="sk-xo-crf-val">23</b></span>' +
        '<input type="range" id="sk-xo-crf" min="15" max="35" value="23" style="width:90px;accent-color:' + C.amber + '" ' +
        'title="lower = better quality, bigger file">' +
      '</span>' +
      '<span id="sk-xo-fps-wrap" style="display:none;align-items:center;gap:6px">' +
        '<span class="sk-trim-label">fps</span>' +
        '<select class="sk-select" id="sk-xo-fps" ' + selStyle + '>' +
          '<option value="24">24</option><option value="15" selected>15</option><option value="10">10</option></select>' +
      '</span>' +
      (hasAudio
        ? '<label id="sk-xo-mute-wrap" style="display:flex;align-items:center;gap:6px;font-size:11px;color:' + C.dim + ';cursor:pointer">' +
          '<input type="checkbox" id="sk-xo-mute" style="accent-color:' + C.amber + '">mute audio</label>'
        : '');
    box.appendChild(panel);

    var tick = wrap.querySelector('#sk-more-opts');
    var fmt = panel.querySelector('#sk-xo-fmt');
    var res = panel.querySelector('#sk-xo-res');
    var crf = panel.querySelector('#sk-xo-crf');
    var crfVal = panel.querySelector('#sk-xo-crf-val');
    var fps = panel.querySelector('#sk-xo-fps');
    var mute = panel.querySelector('#sk-xo-mute');
    var muteWrap = panel.querySelector('#sk-xo-mute-wrap');

    function syncFormat() {
      var isMp4 = fmt.value === 'mp4';
      panel.querySelector('#sk-xo-crf-wrap').style.display = isMp4 ? 'flex' : 'none';
      panel.querySelector('#sk-xo-fps-wrap').style.display = isMp4 ? 'none' : 'flex';
      if (muteWrap) muteWrap.style.display = isMp4 ? 'flex' : 'none';
    }
    // Booru clips are 480p, so bigger-than-source choices are pointless —
    // only offer sizes below the actual video's short side (a large grid
    // or serial export can still be scaled down). Rebuilt once the video's
    // real dimensions are known.
    function refreshResOptions() {
      var short = Math.min(vid.videoWidth || 0, vid.videoHeight || 0);
      var html = '<option value="0">Source</option>';
      [480, 360, 240].forEach(function (h) {
        if (!short || h < short) html += '<option value="' + h + '">' + h + 'p</option>';
      });
      var prev = res.value;
      res.innerHTML = html;
      res.value = prev;
      if (!res.value) res.value = '0';
    }
    function applyFormatDefaultRes() {
      // GIF/APNG get big fast, so start small when a smaller size exists.
      res.value = fmt.value === 'mp4' ? '0' : '480';
      if (!res.value) res.value = '0'; // 480p isn't offered when the video is already 480p or smaller
    }
    refreshResOptions();
    vid.addEventListener('loadedmetadata', refreshResOptions);
    fmt.onchange = function () {
      applyFormatDefaultRes();
      syncFormat();
    };
    crf.oninput = function () { crfVal.textContent = crf.value; };
    tick.onchange = function () { panel.style.display = tick.checked ? 'flex' : 'none'; };

    return function getOpts() {
      if (!tick.checked) return null;
      return {
        format: fmt.value,
        res: parseInt(res.value, 10) || 0,
        crf: parseInt(crf.value, 10) || 23,
        fps: parseInt(fps.value, 10) || 15,
        mute: !!(mute && mute.checked),
        srcW: vid.videoWidth || 0,
        srcH: vid.videoHeight || 0,
        duration: isFinite(vid.duration) ? vid.duration : 0
      };
    };
  }

