  // ===================== PANEL GEOMETRY (drag + resize) =====================
  // The panel used to be pinned via CSS (bottom-right, fixed width, 80vh cap).
  // Now position/size are explicit px, tracked in `geom` and written straight
  // to inline styles, so drag/resize math has one source of truth to clamp
  // against instead of fighting the stylesheet.
  var GEOM_KEY = 'sk-enh-geom';
  var GEOM_MIN_W = 320, GEOM_MIN_H = 280, GEOM_MARGIN = 8;

  function loadGeometry() {
    try {
      var raw = localStorage.getItem(GEOM_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveGeometry(g) {
    try { localStorage.setItem(GEOM_KEY, JSON.stringify(g)); } catch (e) { /* non-fatal */ }
  }
  function defaultGeometry() {
    var width = 460;
    var height = Math.min(640, Math.round(window.innerHeight * 0.8));
    return {
      width: width,
      height: height,
      left: window.innerWidth - width - 20,
      top: window.innerHeight - height - 84 // clears the 52px toggle + its own gap
    };
  }
  // Free to adjust both size AND position — used for the very first render
  // and to recover a geometry that no longer fits (e.g. restored on a
  // smaller screen than it was saved on).
  function clampFull(g) {
    var maxW = Math.max(GEOM_MIN_W, window.innerWidth - GEOM_MARGIN * 2);
    var maxH = Math.max(GEOM_MIN_H, window.innerHeight - GEOM_MARGIN * 2);
    var width = Math.min(Math.max(g.width, GEOM_MIN_W), maxW);
    var height = Math.min(Math.max(g.height, GEOM_MIN_H), maxH);
    var left = Math.min(Math.max(g.left, GEOM_MARGIN), Math.max(GEOM_MARGIN, window.innerWidth - width - GEOM_MARGIN));
    var top = Math.min(Math.max(g.top, GEOM_MARGIN), Math.max(GEOM_MARGIN, window.innerHeight - height - GEOM_MARGIN));
    return { left: left, top: top, width: width, height: height };
  }
  // Dragging by the header: size stays put, position is what's constrained.
  function clampPosition(g) {
    var left = Math.min(Math.max(g.left, GEOM_MARGIN), Math.max(GEOM_MARGIN, window.innerWidth - g.width - GEOM_MARGIN));
    var top = Math.min(Math.max(g.top, GEOM_MARGIN), Math.max(GEOM_MARGIN, window.innerHeight - g.height - GEOM_MARGIN));
    return { left: left, top: top, width: g.width, height: g.height };
  }
  // Resizing by any corner/edge handle: a handle's `dirs` string names which
  // edge(s) it drags ('n'/'s'/'e'/'w', or a corner pair like 'se'). Whichever
  // edge is being dragged is free to move; the opposite edge stays anchored,
  // and everything is clamped to the viewport plus the min-size floor.
  function clampResize(dirs, start, dx, dy) {
    var left = start.left, top = start.top, width = start.width, height = start.height;

    if (dirs.indexOf('e') !== -1) {
      var maxW = Math.max(GEOM_MIN_W, window.innerWidth - start.left - GEOM_MARGIN);
      width = Math.min(Math.max(start.width + dx, GEOM_MIN_W), maxW);
    } else if (dirs.indexOf('w') !== -1) {
      var rightEdge = start.left + start.width;
      var newLeft = Math.max(start.left + dx, GEOM_MARGIN);
      newLeft = Math.min(newLeft, rightEdge - GEOM_MIN_W);
      left = newLeft;
      width = rightEdge - left;
    }

    if (dirs.indexOf('s') !== -1) {
      var maxH = Math.max(GEOM_MIN_H, window.innerHeight - start.top - GEOM_MARGIN);
      height = Math.min(Math.max(start.height + dy, GEOM_MIN_H), maxH);
    } else if (dirs.indexOf('n') !== -1) {
      var bottomEdge = start.top + start.height;
      var newTop = Math.max(start.top + dy, GEOM_MARGIN);
      newTop = Math.min(newTop, bottomEdge - GEOM_MIN_H);
      top = newTop;
      height = bottomEdge - top;
    }

    return { left: left, top: top, width: width, height: height };
  }
  function applyGeometry(g) {
    panel.style.left = g.left + 'px';
    panel.style.top = g.top + 'px';
    panel.style.width = g.width + 'px';
    panel.style.height = g.height + 'px';
  }

  var geom = clampFull(loadGeometry() || defaultGeometry());
  applyGeometry(geom);

  // Window itself getting resized can invalidate a perfectly fine geometry
  // (panel now bigger than the viewport, or hanging off an edge) — re-clamp
  // automatically rather than leaving it stranded off-screen.
  var geomSaveTimer = null;
  window.addEventListener('resize', function () {
    geom = clampFull(geom);
    applyGeometry(geom);
    clearTimeout(geomSaveTimer);
    geomSaveTimer = setTimeout(function () { saveGeometry(geom); }, 300);
  });

  head.addEventListener('pointerdown', function (e) {
    if (e.target.closest('#sk-enh-head-actions')) return; // don't start a drag from any header button
    e.preventDefault();
    var startX = e.clientX, startY = e.clientY;
    var startLeft = geom.left, startTop = geom.top;
    head.setPointerCapture(e.pointerId);
    function onMove(ev) {
      geom = clampPosition({ left: startLeft + (ev.clientX - startX), top: startTop + (ev.clientY - startY), width: geom.width, height: geom.height });
      applyGeometry(geom);
    }
    function onUp() {
      head.releasePointerCapture(e.pointerId);
      head.removeEventListener('pointermove', onMove);
      head.removeEventListener('pointerup', onUp);
      saveGeometry(geom);
    }
    head.addEventListener('pointermove', onMove);
    head.addEventListener('pointerup', onUp);
  });

  var resizeHandles = root.querySelectorAll('[data-dir]');
  for (var ri = 0; ri < resizeHandles.length; ri++) {
    (function (handleEl) {
      var dirs = handleEl.getAttribute('data-dir');
      handleEl.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var start = { left: geom.left, top: geom.top, width: geom.width, height: geom.height };
        var startX = e.clientX, startY = e.clientY;
        handleEl.setPointerCapture(e.pointerId);
        function onMove(ev) {
          geom = clampResize(dirs, start, ev.clientX - startX, ev.clientY - startY);
          applyGeometry(geom);
        }
        function onUp() {
          handleEl.releasePointerCapture(e.pointerId);
          handleEl.removeEventListener('pointermove', onMove);
          handleEl.removeEventListener('pointerup', onUp);
          saveGeometry(geom);
        }
        handleEl.addEventListener('pointermove', onMove);
        handleEl.addEventListener('pointerup', onUp);
      });
    })(resizeHandles[ri]);
  }

  root.querySelector('#sk-enh-toggle').onclick = function () {
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  };
  root.querySelector('#sk-enh-x').onclick = function () { panel.style.display = 'none'; };
  root.querySelector('#sk-enh-reset').onclick = function () {
    geom = clampFull(defaultGeometry());
    applyGeometry(geom);
    saveGeometry(geom);
  };

