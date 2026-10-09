  // Lets the person watch the grid exactly as generated, then optionally
  // trim its own length down afterward — deciding "how long should this
  // be" by looking at the actual result rather than guessing a number
  // before ever seeing it. Deliberately not built on buildMediaShell/
  // openVideoModal: those carry post-specific UI (voting, comments, add to
  // pool, a "view post" link) that makes no sense for a local, ephemeral
  // result with no real post behind it — this is a smaller, standalone
  // modal that reuses the same frame-stepping bar and the same generalized
  // performTrim used for single-clip trimming, just fed the grid's own
  // in-memory bytes instead of a fetched URL.
  function openGridResultModal(blob, filenamePrefix, hasAudio) {
    var backdrop = document.createElement('div');
    backdrop.className = 'sk-media-backdrop';
    var box = document.createElement('div');
    box.className = 'sk-media-box';
    box.innerHTML =
      '<div class="sk-media-top">' +
        '<span class="sk-caption" style="margin:0 auto 0 0">Export Result</span>' +
        '<span class="sk-media-close" id="sk-media-close" title="close">&times;</span>' +
      '</div>';
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    var extraCleanup = [];
    function close() {
      var v = box.querySelector('video');
      if (v) v.pause();
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      extraCleanup.forEach(function (fn) { fn(); });
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    box.querySelector('#sk-media-close').onclick = close;
    box._onClose = function (fn) { extraCleanup.push(fn); }; // buildFrameSteppingBar registers its own keydown cleanup through this

    var videoUrl = URL.createObjectURL(blob);
    extraCleanup.push(function () { URL.revokeObjectURL(videoUrl); });

    var vid = document.createElement('video');
    vid.controls = true;
    // Autoplay-with-sound is commonly blocked by browsers regardless of the
    // recent "Start Export" click, since the gesture wasn't on this
    // specific element — attempting it anyway would just fail silently,
    // leaving the person no clue why nothing happened. A silent export has
    // no such policy to run into, so it keeps the immediate preview it had
    // before; a music export simply opens paused with controls visible,
    // same as any normal video player waiting for a tap.
    vid.autoplay = !hasAudio;
    vid.playsInline = true;
    vid.loop = true; // grids are made to be watched looping, same as wherever they end up posted
    vid.src = videoUrl;
    box.appendChild(vid);

    buildFrameSteppingBar(box, vid, 24); // matches the fixed -r 24 used when compositing

    var inTime = null, outTime = null;

    var trimCaption = document.createElement('div');
    trimCaption.className = 'sk-caption';
    trimCaption.style.padding = '8px 10px 0';
    trimCaption.textContent = 'optional: mark a start/end below to trim the exported grid itself before downloading.';
    box.appendChild(trimCaption);

    var trimRow = document.createElement('div');
    trimRow.className = 'sk-trim-row';
    trimRow.innerHTML =
      '<button class="sk-frame-btn" id="sk-mark-in" title="set the trim start to the current playhead position">Mark In</button>' +
      '<span class="sk-trim-label" id="sk-trim-in">in: —</span>' +
      '<button class="sk-frame-btn" id="sk-mark-out" title="set the trim end to the current playhead position">Mark Out</button>' +
      '<span class="sk-trim-label" id="sk-trim-out">out: —</span>' +
      '<button class="sk-frame-btn" id="sk-trim-clear" title="clear the marked range">✕</button>';
    box.appendChild(trimRow);

    var accuracyRow = document.createElement('div');
    accuracyRow.className = 'sk-trim-row';
    accuracyRow.innerHTML =
      '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:' + C.dim + ';cursor:pointer">' +
        '<input type="checkbox" id="sk-accurate-trim" style="accent-color:' + C.amber + '">' +
        'frame-accurate (re-encodes — slower, but exact; unchecked is a fast copy that may drift a few frames)' +
      '</label>';
    box.appendChild(accuracyRow);

    var getExportOpts = buildExportOptions(box, vid, hasAudio);

    var actionRow = document.createElement('div');
    actionRow.className = 'sk-action-row';
    actionRow.innerHTML =
      '<button class="sk-frame-btn" id="sk-dl-full" title="downloads the grid exactly as generated">⬇ Download Full</button>' +
      '<button class="sk-frame-btn" id="sk-dl-trim" disabled title="mark a range above first — trims the grid to it and downloads the result">⬇ Download Trim</button>';
    box.appendChild(actionRow);

    var statusEl = document.createElement('div');
    statusEl.className = 'sk-action-status';
    box.appendChild(statusEl);

    var inLabel = trimRow.querySelector('#sk-trim-in');
    var outLabel = trimRow.querySelector('#sk-trim-out');
    var dlTrimBtn = actionRow.querySelector('#sk-dl-trim');
    var accurateCheckbox = accuracyRow.querySelector('#sk-accurate-trim');

    function updateTrimBtn() {
      var hasTrim = inTime !== null && outTime !== null && outTime > inTime;
      dlTrimBtn.disabled = !hasTrim;
      dlTrimBtn.title = hasTrim
        ? 'trims the grid to your marked range and downloads the result (takes a moment)'
        : 'mark a range above first — trims the grid to it and downloads the result';
    }
    updateTrimBtn();

    trimRow.querySelector('#sk-mark-in').onclick = function () {
      inTime = vid.currentTime;
      inLabel.textContent = 'in: ' + formatVideoTime(inTime);
      updateTrimBtn();
    };
    trimRow.querySelector('#sk-mark-out').onclick = function () {
      outTime = vid.currentTime;
      outLabel.textContent = 'out: ' + formatVideoTime(outTime);
      updateTrimBtn();
    };
    trimRow.querySelector('#sk-trim-clear').onclick = function () {
      inTime = null; outTime = null;
      inLabel.textContent = 'in: —';
      outLabel.textContent = 'out: —';
      updateTrimBtn();
    };

    var dlFullBtn = actionRow.querySelector('#sk-dl-full');
    dlFullBtn.onclick = function () {
      var xo = getExportOpts();
      if (!xo) { triggerBlobDownload(blob, filenamePrefix + '-grid.mp4'); return; }
      dlFullBtn.disabled = true;
      setBusyStatus(statusEl, 'reading grid…');
      blob.arrayBuffer().then(function (buf) {
        return performExport(buf, 'mp4', null, null, xo, statusEl);
      }).then(function (res) {
        triggerBlobDownload(res.blob, filenamePrefix + '-grid.' + res.ext);
        dlFullBtn.disabled = false;
      }).catch(function (err) {
        if (err.message !== 'cancelled') statusEl.textContent = 'export failed: ' + err.message;
        dlFullBtn.disabled = false;
      });
    };

    dlTrimBtn.onclick = function () {
      if (dlTrimBtn.disabled) return;
      dlTrimBtn.disabled = true;
      setBusyStatus(statusEl, 'reading grid…');
      var xo = getExportOpts();
      blob.arrayBuffer().then(function (buf) {
        return xo ? performExport(buf, 'mp4', inTime, outTime, xo, statusEl)
                  : performTrim(buf, 'mp4', inTime, outTime, statusEl, accurateCheckbox.checked);
      }).then(function (res) {
        triggerBlobDownload(res.blob, filenamePrefix + '-grid-trim.' + res.ext);
        updateTrimBtn();
      }).catch(function (err) {
        if (err.message !== 'cancelled') statusEl.textContent = 'trim failed: ' + err.message;
        updateTrimBtn();
      });
    };

    return box;
  }

