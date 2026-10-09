  // ---------- Pool grid export (multiple clips composited into one video) ----------
  // Genuinely heavier than trimming: that's a lossless stream-copy (no
  // decoding at all), this decodes, scales, and re-encodes every clip
  // simultaneously via ffmpeg's xstack filter — on ffmpeg.wasm's
  // single-threaded, no-hardware-acceleration build, that scales badly past
  // a handful of clips. Capped hard rather than left to degrade silently.
  var MAX_GRID_CLIPS = 9;
  var GRID_CELL_W = 480, GRID_CELL_H = 270; // 16:9 per cell; 3 cols = 1440px wide, a reasonable ceiling for wasm encode time
  // Serial export shows one clip at a time, not a grid of small cells, so
  // it can afford a noticeably bigger single frame for the same wasm-encode
  // budget — double the grid cell's own linear size, still 16:9.
  var SERIAL_LONG = 960, SERIAL_SHORT = 540;

  // Picks cols/rows for N clips minimizing empty cells, tie-broken toward
  // whichever candidate's aspect ratio is closest to 16:9 — e.g. 8 clips
  // gets a 4x2 grid (0 waste, landscape) rather than a portrait 2x4 or a
  // wasteful 3x3 with an empty cell. Single-row/column "strips" (1xN or Nx1)
  // are excluded once there are enough clips to actually form a grid — a
  // prime count like 5 or 7 technically fits with zero waste as a 1x5/1x7
  // strip, but that's a degenerate shape, not "a grid"; a 3x2 with one
  // empty cell looks like the feature that was asked for.
  // Picks a per-row cap and row count for N clips: rather than picking a
  // single fixed rectangle and leaving leftover cells black (5 clips in a
  // 3x2 grid has one dead cell), the last row is allowed to have fewer
  // items than the others — same tile size throughout, no empty gap,
  // matching how Discord/Zoom/Meet lay out an uneven participant count
  // (centering the shorter final row rather than resizing any one tile,
  // which would raise the arbitrary question of *which* clip gets to be
  // bigger). Single-row/column "strips" are still excluded once there are
  // enough clips to actually form a grid.
  function computeGridLayout(n, orientation) {
    var targetAspect = orientation === 'portrait' ? 9 / 16 : 16 / 9;
    var best = null;
    for (var rows = 1; rows <= n; rows++) {
      var cols = Math.ceil(n / rows);
      if (n > 3 && (cols === 1 || rows === 1)) continue;
      var aspect = cols / rows;
      var aspectDiff = Math.abs(aspect - targetAspect);
      var lastRowCount = n - cols * (rows - 1);
      var sparseness = (cols - lastRowCount) / cols; // 0 = last row full, near 1 = last row nearly empty
      var score = aspectDiff + sparseness * 2; // weight both a good overall shape and not leaving too sparse a final row
      if (!best || score < best.score) {
        best = { cols: cols, rows: rows, score: score };
      }
    }
    // Defensive fallback only — in practice the loop above always finds a
    // candidate (for n<=3 no configuration gets excluded at all; for n>3
    // there's always at least one non-degenerate rows/cols pair). The
    // actual portrait/landscape choice for small n happens through the
    // scoring above, not here — e.g. n=3 already lands on 3x1 for
    // landscape or 1x3 for portrait via targetAspect alone.
    if (!best) best = orientation === 'portrait' ? { cols: 1, rows: n } : { cols: n, rows: 1 };
    return { cols: best.cols, rows: best.rows };
  }

  // Per-clip pixel position within the grid canvas — every row is `cols`
  // wide, but a short final row is horizontally centered within that width
  // rather than left-aligned, so the empty space reads as intentional
  // framing rather than a mistake.
  // Per-clip pixel box within the grid canvas, in one of two modes:
  //   'center' — every clip stays a uniform cell size; an incomplete final
  //     row is horizontally (or, in portrait, vertically) centered rather
  //     than left-aligned.
  //   'stretch' — clip index 0 (whichever clip the person put first) is
  //     featured above the rest: the remaining n-1 clips are laid out with
  //     the normal 'center' logic first, then the featured clip is scaled
  //     to match that leftover grid's width, at its own natural 16:9 (no
  //     distortion needed — its box is just a bigger ordinary rectangle,
  //     not a differently-shaped one), and placed above it. Needs at least
  //     3 clips to mean anything (hero + a real 2+ clip grid below it);
  //     falls back to 'center' otherwise.
  // Always returns {x, y, w, h} per clip so the caller doesn't need to know
  // which mode or branch produced them.
  function computeCellPositions(n, orientation, mode) {
    if (mode === 'stretch' && n >= 3) {
      var restN = n - 1;
      var restLayout = computeGridLayout(restN, orientation);
      var restPositions = computeCellPositions(restN, orientation, 'center');
      var heroW = restLayout.cols * GRID_CELL_W;
      var heroH = Math.round(heroW * 9 / 16);
      var positions = new Array(n);
      positions[0] = { x: 0, y: 0, w: heroW, h: heroH };
      for (var i = 0; i < restPositions.length; i++) {
        positions[i + 1] = { x: restPositions[i].x, y: restPositions[i].y + heroH, w: restPositions[i].w, h: restPositions[i].h };
      }
      return positions;
    }

    // 'center' mode — also the fallback for 'stretch' with n<3, and the
    // base case 'stretch' itself uses (recursively) for the clips below
    // the featured one.
    var layout = computeGridLayout(n, orientation);
    var cols = layout.cols, rows = layout.rows;
    var out = new Array(n);
    var idx = 0;
    for (var row = 0; row < rows; row++) {
      var itemsInRow = Math.min(cols, n - idx);
      var rowOffset = Math.floor((cols - itemsInRow) * GRID_CELL_W / 2);
      for (var col = 0; col < itemsInRow; col++) {
        out[idx] = { x: rowOffset + col * GRID_CELL_W, y: row * GRID_CELL_H, w: GRID_CELL_W, h: GRID_CELL_H };
        idx++;
      }
    }
    return out;
  }

