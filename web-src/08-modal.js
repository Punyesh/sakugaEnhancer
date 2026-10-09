  // ---------- shared overlay-window plumbing ----------
  // Every full-screen window (clip viewer, export result, add-to-pool, login)
  // needs the same thing: a dimmed backdrop around `box`, closed by Esc or a
  // click outside the box. Returns { backdrop, close }; also exposes
  // box._close() and box._onClose(fn) so content inside the window (a clicked
  // tag, the frame-stepping bar's key handler) can close it or register cleanup.
  function mountModal(box) {
    var backdrop = document.createElement('div');
    backdrop.className = 'sk-media-backdrop';
    backdrop.appendChild(box);
    document.body.appendChild(backdrop); // the real page body, so it overlays everything and not just our panel

    var cleanups = [];
    function close() {
      var v = box.querySelector('video');
      if (v) v.pause();
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      cleanups.forEach(function (fn) { fn(); });
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });

    box._onClose = function (fn) { cleanups.push(fn); };
    box._close = close;
    return { backdrop: backdrop, close: close };
  }

