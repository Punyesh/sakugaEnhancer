  // ---------- trim + download panel (shared by the clip viewer and the export result) ----------
  // Mark In / Mark Out range, the frame-accurate toggle, the format/quality
  // options and the Download Full / Download Trim buttons. Both windows
  // render this identically and differ only in where the bytes come from and
  // how the text reads, so those are passed in:
  //   cfg.caption          help text above the Mark buttons
  //   cfg.clearTitle       tooltip of the ✕ button
  //   cfg.hasAudio         passed to the export options (decides the mute option)
  //   cfg.noun             'clip' | 'grid' — used in the reading/failed texts
  //   cfg.fullTitle        tooltip of Download Full
  //   cfg.trimTitleOff/On  tooltip of Download Trim without / with a marked range
  //   cfg.sourceExt        container of the source bytes ('mp4', or the post's file_ext)
  //   cfg.readBuffer()     -> Promise<ArrayBuffer> of the source
  //   cfg.downloadOriginal() saves the untouched source (Download Full with no options set)
  //   cfg.fullName(ext), cfg.trimName(ext)   file names for the results
  //   cfg.onGridPick       (clip viewer opened from the grid only) adds "Use This Range"
  function buildTrimDownloadPanel(box, vid, cfg) {
    var inTime = null, outTime = null;

    var trimCaption = document.createElement('div');
    trimCaption.className = 'sk-caption';
    trimCaption.style.padding = '8px 10px 0';
    trimCaption.textContent = cfg.caption;
    box.appendChild(trimCaption);

    var trimRow = document.createElement('div');
    trimRow.className = 'sk-trim-row';
    trimRow.innerHTML =
      '<button class="sk-frame-btn" id="sk-mark-in" title="set the trim start to the current playhead position">Mark In</button>' +
      '<span class="sk-trim-label" id="sk-trim-in">in: —</span>' +
      '<button class="sk-frame-btn" id="sk-mark-out" title="set the trim end to the current playhead position">Mark Out</button>' +
      '<span class="sk-trim-label" id="sk-trim-out">out: —</span>' +
      '<button class="sk-frame-btn" id="sk-trim-clear" title="' + cfg.clearTitle + '">✕</button>';
    box.appendChild(trimRow);

    var accuracyRow = document.createElement('div');
    accuracyRow.className = 'sk-trim-row';
    accuracyRow.innerHTML =
      '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:' + C.dim + ';cursor:pointer">' +
        '<input type="checkbox" id="sk-accurate-trim" style="accent-color:' + C.amber + '">' +
        'frame-accurate (re-encodes — slower, but exact; unchecked is a fast copy that may drift a few frames)' +
      '</label>';
    box.appendChild(accuracyRow);

    var getExportOpts = buildExportOptions(box, vid, cfg.hasAudio);

    var actionRow = document.createElement('div');
    actionRow.className = 'sk-action-row';
    actionRow.innerHTML =
      '<button class="sk-frame-btn" id="sk-dl-full" title="' + cfg.fullTitle + '">⬇ Download Full</button>' +
      '<button class="sk-frame-btn" id="sk-dl-trim" disabled title="' + cfg.trimTitleOff + '">⬇ Download Trim</button>' +
      (cfg.onGridPick ? '<button class="sk-frame-btn" id="sk-use-range" disabled title="mark a range above first">Use This Range</button>' : '');
    box.appendChild(actionRow);

    var statusEl = document.createElement('div');
    statusEl.className = 'sk-action-status';
    box.appendChild(statusEl);

    var inLabel = trimRow.querySelector('#sk-trim-in');
    var outLabel = trimRow.querySelector('#sk-trim-out');
    var dlFullBtn = actionRow.querySelector('#sk-dl-full');
    var dlTrimBtn = actionRow.querySelector('#sk-dl-trim');
    var useRangeBtn = actionRow.querySelector('#sk-use-range');
    var accurateCheckbox = accuracyRow.querySelector('#sk-accurate-trim');

    function updateTrimBtn() {
      var hasTrim = inTime !== null && outTime !== null && outTime > inTime;
      dlTrimBtn.disabled = !hasTrim;
      dlTrimBtn.title = hasTrim ? cfg.trimTitleOn : cfg.trimTitleOff;
      if (useRangeBtn) {
        useRangeBtn.disabled = !hasTrim;
        useRangeBtn.title = hasTrim ? 'use this marked range for the grid clip' : 'mark a range above first';
      }
    }
    updateTrimBtn(); // initial state: no trim range yet

    if (useRangeBtn) {
      useRangeBtn.onclick = function () {
        if (inTime === null || outTime === null || outTime <= inTime) return;
        cfg.onGridPick(inTime, outTime);
        box._close();
      };
    }

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

    dlFullBtn.onclick = function () {
      var xo = getExportOpts();
      if (!xo) { cfg.downloadOriginal(); return; }
      dlFullBtn.disabled = true;
      setBusyStatus(statusEl, 'reading ' + cfg.noun + '…');
      cfg.readBuffer().then(function (buf) {
        return performExport(buf, cfg.sourceExt, null, null, xo, statusEl);
      }).then(function (res) {
        triggerBlobDownload(res.blob, cfg.fullName(res.ext));
        dlFullBtn.disabled = false;
      }).catch(function (err) {
        if (err.message !== 'cancelled') statusEl.textContent = 'export failed: ' + err.message;
        dlFullBtn.disabled = false;
      });
    };

    dlTrimBtn.onclick = function () {
      if (dlTrimBtn.disabled) return;
      dlTrimBtn.disabled = true;
      setBusyStatus(statusEl, 'reading ' + cfg.noun + '…');
      var xo = getExportOpts();
      cfg.readBuffer().then(function (buf) {
        return xo ? performExport(buf, cfg.sourceExt, inTime, outTime, xo, statusEl)
                  : performTrim(buf, cfg.sourceExt, inTime, outTime, statusEl, accurateCheckbox.checked);
      }).then(function (res) {
        triggerBlobDownload(res.blob, cfg.trimName(res.ext));
        updateTrimBtn();
      }).catch(function (err) {
        if (err.message !== 'cancelled') statusEl.textContent = 'trim failed: ' + err.message;
        updateTrimBtn();
      });
    };
  }

