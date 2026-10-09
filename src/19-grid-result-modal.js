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
    var box = document.createElement('div');
    box.className = 'sk-media-box';
    box.innerHTML =
      '<div class="sk-media-top">' +
        '<span class="sk-caption" style="margin:0 auto 0 0">Export Result</span>' +
        '<span class="sk-media-close" id="sk-media-close" title="close">&times;</span>' +
      '</div>';
    var modal = mountModal(box);
    box.querySelector('#sk-media-close').onclick = modal.close;

    var videoUrl = URL.createObjectURL(blob);
    box._onClose(function () { URL.revokeObjectURL(videoUrl); });

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

    buildTrimDownloadPanel(box, vid, {
      caption: 'optional: mark a start/end below to trim the exported grid itself before downloading.',
      clearTitle: 'clear the marked range',
      hasAudio: hasAudio,
      noun: 'grid',
      fullTitle: 'downloads the grid exactly as generated',
      trimTitleOff: 'mark a range above first — trims the grid to it and downloads the result',
      trimTitleOn: 'trims the grid to your marked range and downloads the result (takes a moment)',
      sourceExt: 'mp4',
      readBuffer: function () { return blob.arrayBuffer(); },
      downloadOriginal: function () { triggerBlobDownload(blob, filenamePrefix + '-grid.mp4'); },
      fullName: function (ext) { return filenamePrefix + '-grid.' + ext; },
      trimName: function (ext) { return filenamePrefix + '-grid-trim.' + ext; }
    });

    return box;
  }

