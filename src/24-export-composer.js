  // ===========================================================================
  // Export Composer
  //
  // One modal for building a pool export. The centrepiece is a live preview
  // that draws the real layout — the actual thumbnails in the actual cells,
  // numbered, with each clip's real label text where it will land — so the
  // person arranges the thing itself instead of filling in a form about it.
  // Everything is visible at once: five aligned settings rows under the
  // preview, the clip list beside it (reorder by dragging, open a row for
  // trim / custom text / duplicate / remove). No panel toggles, no sub-screens.
  //
  // onStart(cfg) receives exactly what performGridExport needs.
  // ===========================================================================
  var COMPOSER_MAX_MUSIC = 5;

  function openExportComposer(pool, videoPosts, onStart) {
    var st = {
      format: 'grid',            // 'grid' | 'serial'
      orientation: 'landscape',
      featured: false,           // first clip larger above the rest (grid only)
      loopMode: 'replay',        // 'replay' | 'stop'
      labelsOn: false,
      labelStyle: 'outline',     // 'outline' | 'box'
      labelPos: { fx: 0, fy: 1 },// fractions of the free room inside a clip; 0,1 = bottom-left
      musicFiles: [],
      musicLoop: false,
      clips: [],                 // [{post, instId}]
      trims: {},                 // instId -> {start, end}
      overrides: {},             // instId -> custom label text
      expanded: null,            // instId of the open row
      focus: null                // instId shown in the frame in Back to back mode
    };
    var nextInst = 0;
    function mk(post) { return { post: post, instId: 'inst' + (nextInst++) }; }
    st.clips = safeMap(videoPosts.slice(0, MAX_GRID_CLIPS), mk);

    function seg(key, opts) {
      var h = '<span class="sk-xc-seg" data-seg="' + key + '">';
      for (var i = 0; i < opts.length; i++) h += '<button type="button" data-v="' + opts[i][0] + '">' + opts[i][1] + '</button>';
      return h + '</span>';
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'sk-media-backdrop';
    backdrop.innerHTML =
      '<div class="sk-media-box sk-xc-box" role="dialog" aria-label="Export clips">' +
        '<div class="sk-media-top"><span class="sk-xc-title">Export <span>' + esc(pool.name) + '</span></span>' +
          '<span class="sk-media-close" data-close style="margin-left:auto" title="close (Esc)">&times;</span></div>' +
        '<div class="sk-xc-body">' +
          '<div class="sk-xc-left">' +
            '<div class="sk-xc-stage" id="xc-stage"><div class="sk-xc-canvas" id="xc-canvas"></div></div>' +
            '<div class="sk-xc-film" id="xc-film" style="display:none"></div>' +
            '<div class="sk-xc-hint" id="xc-hint"></div>' +
            '<div class="sk-xc-set">' +
              '<div class="sk-xc-line"><span class="k">Layout</span>' +
                seg('format', [['grid', 'Grid'], ['serial', 'Back to back']]) + ' ' +
                seg('orientation', [['landscape', 'Landscape'], ['portrait', 'Portrait']]) + '</div>' +
              '<div class="sk-xc-line" data-gridonly><span class="k">First clip</span>' +
                seg('featured', [['no', 'Same size'], ['yes', 'Featured']]) + '</div>' +
              '<div class="sk-xc-line" data-gridonly><span class="k">Shorter clips</span>' +
                seg('loopMode', [['replay', 'Replay'], ['stop', 'Hold last frame']]) + '</div>' +
              '<div class="sk-xc-line"><span class="k">Labels</span>' +
                seg('labels', [['off', 'Off'], ['on', 'Animator names']]) +
                '<span id="xc-style-wrap"> ' + seg('labelStyle', [['outline', 'Outline'], ['box', 'Box']]) + '</span></div>' +
              '<div class="sk-xc-line" id="xc-posline"><span class="k">Label position</span>' +
                '<span class="sk-xc-pos" id="xc-pos"></span>' +
                '<span class="sk-xc-poshint" id="xc-poshint">or drag the label in the preview</span></div>' +
              '<div class="sk-xc-line" id="xc-music-line"><span class="k">Music <span class="sk-mad-tag">Sakuga MAD</span></span>' +
                '<span class="sk-xc-tracks" id="xc-tracks"></span>' +
                '<button class="sk-nav-btn" id="xc-addaudio" type="button">+ Add audio</button>' +
                '<span id="xc-musicloop-wrap"> ' + seg('musicLoop', [['once', 'Play once'], ['loop', 'Loop']]) + '</span>' +
                '<input type="file" id="xc-audiofile" accept="audio/*" multiple style="display:none"></div>' +
              '<div class="sk-xc-cap" id="xc-music-cap"></div>' +
            '</div>' +
          '</div>' +
          '<div class="sk-xc-right">' +
            '<div class="sk-xc-listhead"><span>Clips <b id="xc-count"></b></span>' +
              '<select class="sk-select" id="xc-add" style="max-width:55%"></select></div>' +
            '<div class="sk-xc-list" id="xc-list"></div>' +
          '</div>' +
        '</div>' +
        '<div class="sk-xc-foot">' +
          '<span class="sk-xc-sum" id="xc-sum"></span>' +
          '<button class="sk-nav-btn" data-close type="button">Cancel</button>' +
          '<button class="sk-btn" id="xc-go" type="button">Export</button>' +
        '</div>' +
      '</div>';

    function $(sel) { return backdrop.querySelector(sel); }
    var stageEl = $('#xc-stage'), canvasEl = $('#xc-canvas'), listEl = $('#xc-list'), filmEl = $('#xc-film'), boxEl = $('.sk-xc-box');
    var tagsReady = false;

    // ---------- derived layout ----------
    function effectiveMode() { return st.format === 'grid' && st.featured && st.clips.length >= 3 ? 'stretch' : 'center'; }
    function frameInfo() {
      var n = st.clips.length;
      if (st.format === 'serial') {
        var w = st.orientation === 'portrait' ? SERIAL_SHORT : SERIAL_LONG;
        var h = st.orientation === 'portrait' ? SERIAL_LONG : SERIAL_SHORT;
        return { W: w, H: h, positions: [{ x: 0, y: 0, w: w, h: h }] };
      }
      var pos = computeCellPositions(Math.max(n, 1), st.orientation, effectiveMode());
      var W = 0, H = 0;
      for (var i = 0; i < pos.length; i++) {
        if (pos[i].x + pos[i].w > W) W = pos[i].x + pos[i].w;
        if (pos[i].y + pos[i].h > H) H = pos[i].y + pos[i].h;
      }
      return { W: W, H: H, positions: pos };
    }
    function posName() {
      var fx = st.labelPos.fx, fy = st.labelPos.fy;
      var xs = fx === 0 ? 'left' : fx === 1 ? 'right' : fx === 0.5 ? 'centre' : null;
      var ys = fy === 0 ? 'top' : fy === 1 ? 'bottom' : fy === 0.5 ? 'middle' : null;
      if (!xs || !ys) return 'custom position';
      if (xs === 'centre' && ys === 'middle') return 'centre';
      if (xs === 'centre') return ys + ' centre';
      if (ys === 'middle') return 'middle ' + xs;
      return ys + ' ' + xs;
    }
    function pct(f) { return (Math.round(f * 10000) / 100) + '%'; }

    // ---------- preview ----------
    // The order on screen right now: the in-flight drag order while one is
    // happening, otherwise the committed one.
    function liveIds() {
      return drag && drag.live ? drag.live : safeMap(st.clips, function (c) { return c.instId; });
    }
    function focusInst() {
      for (var i = 0; i < st.clips.length; i++) if (st.clips[i].instId === st.focus) return st.clips[i];
      return st.clips[0];
    }
    function renderFilm() {
      var show = st.format === 'serial' && st.clips.length > 0;
      filmEl.style.display = show ? 'flex' : 'none';
      filmEl.className = 'sk-xc-film' + (st.orientation === 'portrait' ? ' port' : '');
      if (!show) { filmEl.innerHTML = ''; return; }
      var fi = focusInst();
      filmEl.innerHTML = safeMap(st.clips, function (c, i) {
        return '<div class="sk-xc-fr' + (c === fi ? ' on' : '') + '" data-inst="' + c.instId + '" title="' + esc(rowName(c.post)) + '">' +
          '<img src="' + esc(c.post.preview_url || '') + '" alt="" draggable="false"><span class="sk-xc-frn">' + (i + 1) + '</span></div>';
      }).join('');
    }
    var previewScale = 0.4;
    function renderPreview() {
      var n = st.clips.length;
      var f = frameInfo();
      var availW = Math.max(160, (stageEl.clientWidth || 440) - 20);
      var maxH = Math.max(180, Math.round((window.innerHeight || 700) * 0.46));
      var aspect = f.W / f.H;
      var boxW = Math.min(availW, maxH * aspect);
      var boxH = boxW / aspect;
      canvasEl.style.width = Math.round(boxW) + 'px';
      canvasEl.style.height = Math.round(boxH) + 'px';
      var s = boxW / f.W;
      previewScale = s;
      if (n < 1) { canvasEl.innerHTML = ''; return; }

      var html = '';
      var cells = st.format === 'serial' ? 1 : n;
      for (var i = 0; i < cells; i++) {
        var inst = st.format === 'serial' ? focusInst() : st.clips[i];
        var pz = f.positions[i];
        var p = inst.post;
        html += '<div class="sk-xc-cell" data-inst="' + inst.instId + '" style="left:' + pct(pz.x / f.W) + ';top:' + pct(pz.y / f.H) +
          ';width:' + pct(pz.w / f.W) + ';height:' + pct(pz.h / f.H) + '">' +
          '<img src="' + esc(p.preview_url || '') + '" alt="" draggable="false">' +
          '<span class="sk-xc-num">' + (st.format === 'serial' ? (st.clips.indexOf(inst) + 1) + ' of ' + n : (i + 1)) + '</span>';
        if (st.labelsOn) {
          var built = buildLabelFor(p, st.overrides[inst.instId], pz.w, pz.h);
          if (built) {
            var lines = built.text.split(String.fromCharCode(10));
            var fs = built.fontSize * s;
            var chipStyle = 'font-size:' + fs.toFixed(2) + 'px;line-height:' + ((built.fontSize + 4) / built.fontSize).toFixed(3) + ';' +
              (st.labelStyle === 'box'
                ? 'background:rgba(0,0,0,.5);padding:' + (6 * s).toFixed(2) + 'px;'
                : '-webkit-text-stroke:' + (4 * s).toFixed(2) + 'px #000;paint-order:stroke fill;text-shadow:0 0 ' + (2 * s).toFixed(2) + 'px #000;');
            html += '<div class="sk-xc-lblwrap" style="inset:' + (10 * s).toFixed(2) + 'px">' +
              '<div class="sk-xc-chip" data-chip style="' + chipStyle + '">' + safeMap(lines, esc).join('<br>') + '</div></div>';
          }
        }
        html += '</div>';
      }
      canvasEl.innerHTML = html;
      renderFilm();
      applyChipPos();
      hlRow(st.expanded);
    }
    // 3x3 position picker: the nine snap points as buttons. Highlights the
    // one in use; a dragged-to custom position leaves all nine unlit.
    (function buildPosPicker() {
      var box = $('#xc-pos'), h = '';
      [0, 0.5, 1].forEach(function (fy) {
        [0, 0.5, 1].forEach(function (fx) {
          h += '<button type="button" data-fx="' + fx + '" data-fy="' + fy + '" title="' +
            (fy === 0 ? 'top' : fy === 1 ? 'bottom' : 'middle') + ' ' + (fx === 0 ? 'left' : fx === 1 ? 'right' : 'centre') + '"></button>';
        });
      });
      box.innerHTML = h;
      box.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('button') : null;
        if (!b) return;
        st.labelPos = { fx: parseFloat(b.getAttribute('data-fx')), fy: parseFloat(b.getAttribute('data-fy')) };
        applyChipPos();
      });
    })();
    function syncPosPicker() {
      var btns = $('#xc-pos').querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('on', parseFloat(btns[i].getAttribute('data-fx')) === st.labelPos.fx && parseFloat(btns[i].getAttribute('data-fy')) === st.labelPos.fy);
      }
    }
    function applyChipPos() {
      var chips = canvasEl.querySelectorAll('.sk-xc-chip');
      var fx = st.labelPos.fx, fy = st.labelPos.fy;
      for (var i = 0; i < chips.length; i++) {
        chips[i].style.left = pct(fx);
        chips[i].style.top = pct(fy);
        chips[i].style.transform = 'translate(' + pct(-fx) + ',' + pct(-fy) + ')';
      }
      syncPosPicker();
      renderHint();
    }
    function renderHint() {
      var h = $('#xc-hint');
      var parts = [];
      if (st.format === 'serial') {
        parts.push('Clip ' + (liveIds().indexOf(focusInst().instId) + 1) + ' of ' + st.clips.length + ' &middot; drag the strip to reorder');
      } else if (st.clips.length > 1) {
        parts.push('Drag a clip to rearrange');
      }
      if (st.labelsOn) {
        var any = canvasEl.querySelector('.sk-xc-chip');
        var moved = st.labelPos.fx !== 0 || st.labelPos.fy !== 1;
        parts.push(any
          ? 'label: ' + esc(posName()) + ' on every clip' + (moved ? ' <a href="#" id="xc-resetpos">reset</a>' : '')
          : 'no animator tag on this clip: open it and type a label');
      }
      h.innerHTML = parts.join(' &middot; ');
      var r = $('#xc-resetpos');
      if (r) r.onclick = function (e) { e.preventDefault(); st.labelPos = { fx: 0, fy: 1 }; applyChipPos(); };
    }

    // Dragging a chip: movement is measured against the free room inside its
    // own clip (the same maths the export uses), applied to every clip at once.
    var chipDrag = null;
    function snap(v) {
      var t = [0, 0.5, 1];
      for (var i = 0; i < t.length; i++) if (Math.abs(v - t[i]) < 0.06) return t[i];
      return v;
    }
    canvasEl.addEventListener('pointerdown', function (e) {
      var chip = e.target.closest ? e.target.closest('.sk-xc-chip') : null;
      if (!chip) return;
      var wrap = chip.parentNode;
      chipDrag = {
        x: e.clientX, y: e.clientY, fx: st.labelPos.fx, fy: st.labelPos.fy,
        freeW: wrap.clientWidth - chip.offsetWidth, freeH: wrap.clientHeight - chip.offsetHeight, moved: false
      };
      try { canvasEl.setPointerCapture(e.pointerId); } catch (err) { /* non-fatal */ }
      e.preventDefault();
    });
    canvasEl.addEventListener('pointermove', function (e) {
      if (!chipDrag) return;
      var d = chipDrag;
      var fx = d.freeW > 1 ? d.fx + (e.clientX - d.x) / d.freeW : d.fx;
      var fy = d.freeH > 1 ? d.fy + (e.clientY - d.y) / d.freeH : d.fy;
      d.moved = d.moved || Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 2;
      st.labelPos = { fx: snap(Math.max(0, Math.min(1, fx))), fy: snap(Math.max(0, Math.min(1, fy))) };
      applyChipPos();
    });
    function endChipDrag() { chipDrag = null; }
    canvasEl.addEventListener('pointerup', endChipDrag);
    canvasEl.addEventListener('pointercancel', endChipDrag);
    canvasEl.addEventListener('mouseover', function (e) {
      var cell = e.target.closest ? e.target.closest('.sk-xc-cell') : null;
      var cid = cell ? cell.getAttribute('data-inst') : null;
      hlCell(cid);
      if (!drag) hlListRow(cid);
    });
    canvasEl.addEventListener('mouseleave', function () { hlCell(st.expanded); hlListRow(null); });

    function hlCell(id) {
      var cells = canvasEl.querySelectorAll('.sk-xc-cell');
      for (var i = 0; i < cells.length; i++) cells[i].classList.toggle('hl', id != null && cells[i].getAttribute('data-inst') === id);
    }
    function hlListRow(id) {
      var rows = listEl.children;
      for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('hl', id != null && rows[i].getAttribute('data-inst') === id);
    }
    function hlRow(id) { hlCell(id); }

    // ---------- clip list ----------
    function rowName(p) {
      var names = clipAnimatorNames(p);
      if (names.length) return names.join(', ');
      return safeFilter((p.tags || '').split(/\s+/), function (t) { return !!t; }).slice(0, 3).join(' ') || ('post ' + p.id);
    }
    // Second line under a clip's name, so clips by the same animator can be
    // told apart: the show, the episode/OP/ED when the source says so, a
    // "repeat" marker for a second showing of the same post, and always the
    // post number (the one thing that is unique).
    function rowSub(inst) {
      var p = inst.post, parts = [];
      var shows = safeMap(
        safeFilter((p.tags || '').split(/\s+/), function (t) { return t && tagTypeMap && tagTypeMap[t] === 3; }),
        function (t) { return titleCase(t.replace(/_/g, ' ')); }
      ).slice(0, 2);
      if (shows.length) parts.push(esc(shows.join(', ')));
      var ep = parseEpisodeKey(p.source);
      if (ep.key !== 'unsorted' && ep.key !== 'other') parts.push(esc(ep.key.indexOf('ep:') === 0 ? 'Ep ' + ep.sortNum : ep.label));
      var seen = 0;
      for (var i = 0; i < st.clips.length && st.clips[i] !== inst; i++) if (st.clips[i].post.id === p.id) seen++;
      if (seen) parts.push('repeat');
      parts.push('<span class="id">#' + esc(String(p.id)) + '</span>');
      return parts.join(' &middot; ');
    }
    function badgeText(inst) {
      var parts = [];
      var tr = st.trims[inst.instId];
      if (tr) parts.push(formatTimeInput(tr.start) + '–' + formatTimeInput(tr.end));
      if (st.overrides[inst.instId]) parts.push('own label');
      return parts.join(' · ');
    }
    var durCache = {};
    function clipDuration(p) {
      if (durCache[p.id] != null) return Promise.resolve(durCache[p.id]);
      return probeVideoDuration(p.file_url).then(function (d) { durCache[p.id] = d; return d; });
    }

    function renderList() {
      listEl.innerHTML = '';
      st.clips.forEach(function (inst, i) {
        var p = inst.post, id = inst.instId;
        var open = st.expanded === id;
        var row = document.createElement('div');
        row.className = 'sk-xc-row' + (open ? ' open' : '');
        row.setAttribute('data-inst', id);
        row.innerHTML =
          '<div class="sk-xc-rowhead" data-toggle>' +
            '<span class="sk-xc-grip" tabindex="0" title="drag to reorder, or focus and press Up / Down. Enter opens the clip">&#8942;&#8942;</span>' +
            '<span class="sk-xc-n">' + (i + 1) + '</span>' +
            '<img src="' + esc(p.preview_url || '') + '" alt="" draggable="false">' +
            '<span class="sk-xc-who"><span class="sk-xc-name">' + esc(rowName(p)) + '</span>' +
              '<span class="sk-xc-sub">' + rowSub(inst) + '</span></span>' +
            '<span class="sk-xc-badge" data-badge>' + esc(badgeText(inst)) + '</span>' +
            '<span class="sk-xc-chev">' + (open ? '&#9662;' : '&#9656;') + '</span>' +
          '</div>' +
          (open
            ? '<div class="sk-xc-edit">' +
                '<div class="sk-xc-field"><span class="k">Trim</span>' +
                  '<input class="sk-input" data-s placeholder="0:00" value="' + (st.trims[id] ? esc(formatTimeInput(st.trims[id].start)) : '') + '">' +
                  '<span class="dash">&ndash;</span>' +
                  '<input class="sk-input" data-e placeholder="end" value="' + (st.trims[id] ? esc(formatTimeInput(st.trims[id].end)) : '') + '">' +
                  '<button class="sk-nav-btn" data-pick type="button" title="open the clip, mark a range, send it back here">Pick in video</button>' +
                  (st.trims[id] ? '<span class="sk-close" data-cleartrim title="clear trim">&times;</span>' : '') +
                '</div>' +
                '<div class="sk-xc-field"><span class="k">Label</span>' +
                  '<input class="sk-input" data-text placeholder="' + esc(clipAnimatorNames(p).join(', ') || 'no animator tag — type a label') + '" value="' + esc(st.overrides[id] || '') + '">' +
                '</div>' +
                '<div class="sk-xc-actions">' +
                  '<button class="sk-nav-btn" data-dup type="button" title="add this clip again right after, e.g. to show a different segment">Duplicate</button>' +
                  '<button class="sk-nav-btn" data-rm type="button"' + (st.clips.length <= 2 ? ' disabled title="an export needs at least 2 clips"' : '') + '>Remove</button>' +
                '</div>' +
              '</div>'
            : '');
        listEl.appendChild(row);

        row.onmouseenter = function () { if (!drag) hlCell(id); };
        row.onmouseleave = function () { if (!drag) hlCell(st.expanded); };
        var grip = row.querySelector('.sk-xc-grip');
        grip.onkeydown = function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectClip(id, true); return; }
          var to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
          if (to < 0 || to >= st.clips.length) return;
          e.preventDefault();
          moveClip(i, to);
          var g = listEl.querySelectorAll('.sk-xc-grip')[to];
          if (g) g.focus();
        };

        if (!open) return;
        var sEl = row.querySelector('[data-s]'), eEl = row.querySelector('[data-e]');
        if (!st.trims[id]) clipDuration(p).then(function (d) { if (d > 0) eEl.placeholder = 'end (' + formatTimeInput(d) + ')'; });
        function commitTrim() {
          var a = parseTimeInput(sEl.value), b = parseTimeInput(eEl.value);
          if (a == null && b == null) delete st.trims[id];
          else {
            a = a || 0;
            if (b == null || b <= a) delete st.trims[id]; else st.trims[id] = { start: a, end: b };
          }
          row.querySelector('[data-badge]').textContent = badgeText(inst);
        }
        sEl.onchange = commitTrim;
        eEl.onchange = commitTrim;
        row.querySelector('[data-pick]').onclick = function () {
          openVideoModal(p, function (start, end) {
            st.trims[id] = { start: start, end: end };
            renderList();
          });
        };
        var clr = row.querySelector('[data-cleartrim]');
        if (clr) clr.onclick = function () { delete st.trims[id]; renderList(); };
        row.querySelector('[data-text]').oninput = function (e) {
          var v = e.currentTarget.value.trim();
          if (v) st.overrides[id] = v; else delete st.overrides[id];
          // Typing a label is a clear sign you want labels shown.
          if (v && !st.labelsOn) { st.labelsOn = true; renderSettings(); }
          row.querySelector('[data-badge]').textContent = badgeText(inst);
          renderPreview();
        };
        row.querySelector('[data-dup]').onclick = function () {
          var copy = mk(p);
          st.clips.splice(i + 1, 0, copy);
          st.expanded = copy.instId;
          renderAll();
        };
        row.querySelector('[data-rm]').onclick = function () {
          if (st.clips.length <= 2) return;
          st.clips.splice(i, 1);
          delete st.trims[id]; delete st.overrides[id];
          st.expanded = null;
          renderAll();
        };
      });
      renderAddSelect();
      $('#xc-count').textContent = '(' + st.clips.length + ')';
    }

    // Only offered when there is something to add: clips beyond the first 9
    // or ones that were removed.
    function renderAddSelect() {
      var sel = $('#xc-add');
      var used = {};
      st.clips.forEach(function (c) { used[c.post.id] = true; });
      var rest = safeFilter(videoPosts, function (p) { return !used[p.id]; });
      var html = '<option value="">+ Add clip (' + rest.length + ' left)</option>';
      rest.forEach(function (p) {
        var showNames = safeMap(safeFilter((p.tags || '').split(/\s+/), function (t) { return t && tagTypeMap && tagTypeMap[t] === 3; }), function (t) { return titleCase(t.replace(/_/g, ' ')); })[0];
        html += '<option value="' + esc(String(p.id)) + '">' + esc(rowName(p) + (showNames ? ' \u2013 ' + showNames : '') + ' #' + p.id) + '</option>';
      });
      sel.innerHTML = html;
      sel.style.display = rest.length ? '' : 'none';
    }
    $('#xc-add').onchange = function (e) {
      var v = e.currentTarget.value;
      if (!v) return;
      var hit = safeFilter(videoPosts, function (p) { return String(p.id) === v; })[0];
      if (hit) { var inst = mk(hit); st.clips.push(inst); st.expanded = inst.instId; renderAll(); listEl.scrollTop = listEl.scrollHeight; }
    };

    function moveClip(from, to) {
      var item = st.clips.splice(from, 1)[0];
      st.clips.splice(to, 0, item);
      renderAll();
    }

    // ---------- drag to reorder ----------
    // One drag session serves all three views of the order: the preview
    // (grid cells), the clip list, and the filmstrip shown in Back to back
    // mode. While you drag, a lifted copy follows the pointer and the
    // others slide aside live in every view; the order is committed on
    // release. A press that never moves is a click (select / open the clip).
    var drag = null;
    function startPending(e, id, src, el) {
      if (e.button) return;
      var r = el.getBoundingClientRect();
      drag = {
        id: id, src: src, x: e.clientX, y: e.clientY, started: false, ghost: null, live: null,
        offX: e.clientX - r.left, offY: e.clientY - r.top, w: r.width, h: r.height,
        noDrag: e.pointerType === 'touch' && src === 'list' && !(e.target.closest && e.target.closest('.sk-xc-grip'))
      };
      document.addEventListener('pointermove', onDragMove, true);
      document.addEventListener('pointerup', onDragEnd, true);
      document.addEventListener('pointercancel', onDragEnd, true);
    }
    function viewEl(src) { return src === 'stage' ? canvasEl : src === 'list' ? listEl : filmEl; }
    function elFor(view, id) { return view.querySelector('[data-inst="' + id + '"]'); }
    function inRect(r, x, y) { return r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }

    function beginDrag() {
      var d = drag;
      d.started = true;
      if (st.expanded) { st.expanded = null; renderList(); } // every row the same height while dragging
      d.live = safeMap(st.clips, function (c) { return c.instId; });
      var srcEl = elFor(viewEl(d.src), d.id);
      var g = document.createElement('div');
      var inner = srcEl ? (d.src === 'list' ? srcEl.querySelector('.sk-xc-rowhead').innerHTML : srcEl.innerHTML) : '';
      g.className = 'sk-xc-ghost ' + (d.src === 'stage' ? 'sk-xc-cell' : d.src === 'list' ? 'sk-xc-rowhead' : 'sk-xc-fr');
      g.innerHTML = inner;
      g.style.width = d.w + 'px';
      g.style.height = d.h + 'px';
      boxEl.appendChild(g);
      d.ghost = g;
      [canvasEl, listEl, filmEl].forEach(function (v) {
        if (v === canvasEl && st.format === 'serial') return; // the frame there is a viewer, not a slot
        var el = elFor(v, d.id);
        if (el) el.classList.add('ph');
      });
      backdrop.classList.add('xc-dragging');
    }

    // Index (in the order without the dragged clip's old slot) the pointer
    // is asking for, or -1 when it is over none of the views.
    function hitIndex(x, y) {
      var d = drag, n = d.live.length;
      if (st.format === 'grid') {
        var cr = canvasEl.getBoundingClientRect();
        if (inRect(cr, x, y)) {
          var f = frameInfo();
          var fx = (x - cr.left) / cr.width * f.W, fy = (y - cr.top) / cr.height * f.H;
          var best = -1, bd = Infinity;
          for (var i = 0; i < n && i < f.positions.length; i++) {
            var p = f.positions[i];
            if (fx >= p.x && fx <= p.x + p.w && fy >= p.y && fy <= p.y + p.h) return i;
            var dd = Math.pow(fx - (p.x + p.w / 2), 2) + Math.pow(fy - (p.y + p.h / 2), 2);
            if (dd < bd) { bd = dd; best = i; }
          }
          return best;
        }
      }
      var lr = listEl.getBoundingClientRect();
      if (inRect(lr, x, y)) {
        var rows = Array.prototype.slice.call(listEl.children), idx = 0;
        for (var j = 0; j < rows.length; j++) {
          if (rows[j].getAttribute('data-inst') === d.id) continue;
          var mid = lr.top - listEl.scrollTop + rows[j].offsetTop + rows[j].offsetHeight / 2;
          if (y > mid) idx++;
        }
        return idx;
      }
      if (st.format === 'serial') {
        var fr = filmEl.getBoundingClientRect();
        if (inRect(fr, x, y)) {
          var items = safeFilter(Array.prototype.slice.call(filmEl.children), function (c) { return c.getAttribute('data-inst') !== d.id; });
          var bestI = 0, bestD = Infinity;
          for (var k = 0; k < items.length; k++) {
            var r = items[k].getBoundingClientRect();
            var dist = Math.pow(x - (r.left + r.width / 2), 2) + Math.pow(y - (r.top + r.height / 2), 2);
            if (dist < bestD) { bestD = dist; bestI = k + (x > r.left + r.width / 2 ? 1 : 0); }
          }
          return bestI;
        }
      }
      return -1;
    }

    // Re-flow every view to a new order without rebuilding anything:
    // grid cells slide via CSS transitions, rows and filmstrip frames via FLIP.
    function flipReorder(container, order, numSel) {
      var nodes = {}, before = {};
      Array.prototype.forEach.call(container.children, function (c) { nodes[c.getAttribute('data-inst')] = c; });
      order.forEach(function (id) { if (nodes[id]) before[id] = nodes[id].getBoundingClientRect(); });
      order.forEach(function (id) { if (nodes[id]) container.appendChild(nodes[id]); });
      order.forEach(function (id, j) {
        var nd = nodes[id];
        if (!nd) return;
        var num = nd.querySelector(numSel);
        if (num) num.textContent = j + 1;
        if (id === drag.id || !nd.animate) return;
        var b = nd.getBoundingClientRect();
        var dx = before[id].left - b.left, dy = before[id].top - b.top;
        if (dx || dy) nd.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 170, easing: 'ease-out' });
      });
    }
    function applyLive(order) {
      if (st.format === 'grid') {
        var f = frameInfo();
        order.forEach(function (id, j) {
          var c = elFor(canvasEl, id), pz = f.positions[j];
          if (!c || !pz) return;
          c.style.left = pct(pz.x / f.W); c.style.top = pct(pz.y / f.H);
          c.style.width = pct(pz.w / f.W); c.style.height = pct(pz.h / f.H);
          var num = c.querySelector('.sk-xc-num');
          if (num) num.textContent = j + 1;
        });
      }
      flipReorder(listEl, order, '.sk-xc-n');
      if (st.format === 'serial') {
        flipReorder(filmEl, order, '.sk-xc-frn');
        var fnum = canvasEl.querySelector('.sk-xc-num');
        if (fnum) fnum.textContent = (order.indexOf(focusInst().instId) + 1) + ' of ' + order.length;
        renderHint();
      }
      // the lifted copy shows its own new number too
      if (drag && drag.ghost) {
        var gn = drag.ghost.querySelector('.sk-xc-num, .sk-xc-n, .sk-xc-frn');
        if (gn) gn.textContent = order.indexOf(drag.id) + 1;
      }
    }

    function onDragMove(e) {
      var d = drag;
      if (!d || d.noDrag) return;
      if (!d.started) {
        if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < 6) return;
        beginDrag();
      }
      d.ghost.style.left = (e.clientX - d.offX) + 'px';
      d.ghost.style.top = (e.clientY - d.offY) + 'px';
      var to = hitIndex(e.clientX, e.clientY);
      var from = d.live.indexOf(d.id);
      if (to < 0 || to === from) return;
      d.live.splice(from, 1);
      d.live.splice(to, 0, d.id);
      applyLive(d.live);
    }

    function selectClip(id, toggle) {
      st.expanded = toggle && st.expanded === id ? null : id;
      st.focus = id;
      renderList();
      if (st.format === 'serial') renderPreview();
      hlRow(st.expanded);
      var row = elFor(listEl, id);
      if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
    }

    function onDragEnd(e) {
      var d = drag;
      drag = null;
      document.removeEventListener('pointermove', onDragMove, true);
      document.removeEventListener('pointerup', onDragEnd, true);
      document.removeEventListener('pointercancel', onDragEnd, true);
      if (!d) return;
      if (!d.started) {
        if (e.type !== 'pointercancel') selectClip(d.id, d.src === 'list');
        return;
      }
      var byId = {};
      st.clips.forEach(function (c) { byId[c.instId] = c; });
      st.clips = safeMap(d.live, function (id) { return byId[id]; });
      backdrop.classList.remove('xc-dragging');
      renderAll();
      // The lifted copy settles into its new slot, then goes.
      var g = d.ghost;
      var home = st.format === 'grid' ? elFor(canvasEl, d.id) : d.src === 'film' ? elFor(filmEl, d.id) : elFor(listEl, d.id);
      if (home && d.src === 'list' && st.format !== 'grid') home = home.querySelector('.sk-xc-rowhead');
      var r = home ? home.getBoundingClientRect() : null;
      if (g && r && r.width > 0) {
        g.classList.add('settling');
        g.style.left = r.left + 'px'; g.style.top = r.top + 'px';
        g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
        setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, 200);
      } else if (g && g.parentNode) {
        g.parentNode.removeChild(g);
      }
    }

    canvasEl.addEventListener('pointerdown', function (e) {
      if (st.format !== 'grid') return;
      if (e.target.closest && e.target.closest('.sk-xc-chip')) return;
      var cell = e.target.closest ? e.target.closest('.sk-xc-cell') : null;
      if (!cell) return;
      startPending(e, cell.getAttribute('data-inst'), 'stage', cell);
      e.preventDefault();
    });
    listEl.addEventListener('pointerdown', function (e) {
      var head = e.target.closest ? e.target.closest('.sk-xc-rowhead') : null;
      if (!head || e.target.closest('input,button,select,textarea')) return;
      startPending(e, head.parentNode.getAttribute('data-inst'), 'list', head);
      if (e.pointerType !== 'touch') e.preventDefault();
    });
    filmEl.addEventListener('pointerdown', function (e) {
      var fr = e.target.closest ? e.target.closest('.sk-xc-fr') : null;
      if (!fr) return;
      startPending(e, fr.getAttribute('data-inst'), 'film', fr);
      e.preventDefault();
    });

    // ---------- settings ----------
    function segValue(key) {
      if (key === 'format') return st.format;
      if (key === 'orientation') return st.orientation;
      if (key === 'featured') return st.featured && st.clips.length >= 3 ? 'yes' : 'no';
      if (key === 'loopMode') return st.loopMode;
      if (key === 'labels') return st.labelsOn ? 'on' : 'off';
      if (key === 'labelStyle') return st.labelStyle;
      if (key === 'musicLoop') return st.musicLoop ? 'loop' : 'once';
      return '';
    }
    function setSeg(key, v) {
      if (key === 'format') st.format = v === 'serial' ? 'serial' : 'grid';
      else if (key === 'orientation') st.orientation = v === 'portrait' ? 'portrait' : 'landscape';
      else if (key === 'featured') st.featured = v === 'yes';
      else if (key === 'loopMode') st.loopMode = v === 'stop' ? 'stop' : 'replay';
      else if (key === 'labels') st.labelsOn = v === 'on';
      else if (key === 'labelStyle') st.labelStyle = v === 'box' ? 'box' : 'outline';
      else if (key === 'musicLoop') st.musicLoop = v === 'loop';
    }
    backdrop.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.sk-xc-seg button') : null;
      if (!b) return;
      setSeg(b.parentNode.getAttribute('data-seg'), b.getAttribute('data-v'));
      renderSettings();
      renderPreview();
      renderSummary();
    });

    function renderSettings() {
      var segs = backdrop.querySelectorAll('.sk-xc-seg');
      for (var i = 0; i < segs.length; i++) {
        var key = segs[i].getAttribute('data-seg');
        var val = segValue(key);
        var btns = segs[i].querySelectorAll('button');
        for (var j = 0; j < btns.length; j++) btns[j].classList.toggle('on', btns[j].getAttribute('data-v') === val);
        if (key === 'featured') segs[i].classList.toggle('dis', st.clips.length < 3);
      }
      var gridOnly = backdrop.querySelectorAll('[data-gridonly]');
      for (var g = 0; g < gridOnly.length; g++) gridOnly[g].style.display = st.format === 'serial' ? 'none' : 'flex';
      $('#xc-style-wrap').style.display = st.labelsOn ? '' : 'none';
      $('#xc-posline').style.display = st.labelsOn ? 'flex' : 'none';
      $('#xc-musicloop-wrap').style.display = st.musicFiles.length ? '' : 'none';
      $('#xc-addaudio').style.display = st.musicFiles.length >= COMPOSER_MAX_MUSIC ? 'none' : '';
      $('#xc-music-cap').textContent = st.musicFiles.length
        ? 'Played back to back from the start, cut to the length of the video' + (st.musicFiles.length >= COMPOSER_MAX_MUSIC ? ' (5 tracks max)' : '') + '.'
        : '';
      renderTracks();
    }

    function renderTracks() {
      var box = $('#xc-tracks');
      box.innerHTML = '';
      st.musicFiles.forEach(function (f, i) {
        var chip = document.createElement('span');
        chip.className = 'sk-xc-track';
        chip.innerHTML = '<span class="nm">' + (i + 1) + '. ' + esc(f.name) + '</span><span class="sk-close" title="remove this track">&times;</span>';
        chip.querySelector('.sk-close').onclick = function () {
          st.musicFiles.splice(i, 1);
          if (!st.musicFiles.length) st.musicLoop = false;
          renderSettings();
        };
        box.appendChild(chip);
      });
    }
    function addAudio(fileList) {
      var files = fileList || [];
      for (var i = 0; i < files.length; i++) {
        if (st.musicFiles.length >= COMPOSER_MAX_MUSIC) break;
        var f = files[i];
        if (f.type && f.type.indexOf('audio/') !== 0) continue;
        st.musicFiles.push(f);
      }
      renderSettings();
    }
    var audioInput = $('#xc-audiofile');
    $('#xc-addaudio').onclick = function () { audioInput.click(); };
    audioInput.onchange = function (e) { addAudio(e.currentTarget.files); audioInput.value = ''; };
    var musicLine = $('#xc-music-line');
    musicLine.ondragover = function (e) { e.preventDefault(); musicLine.classList.add('is-dragover'); };
    musicLine.ondragleave = function () { musicLine.classList.remove('is-dragover'); };
    musicLine.ondrop = function (e) { e.preventDefault(); musicLine.classList.remove('is-dragover'); addAudio(e.dataTransfer.files); };

    // ---------- summary + export ----------
    function renderSummary() {
      var n = st.clips.length;
      var f = frameInfo();
      var text;
      if (st.format === 'serial') {
        text = n + ' clips back to back';
      } else if (effectiveMode() === 'stretch') {
        var rl = computeGridLayout(n - 1, st.orientation);
        text = n + ' clips: 1 featured + ' + rl.cols + '×' + rl.rows;
      } else {
        var l = computeGridLayout(Math.max(n, 1), st.orientation);
        text = n + ' clips in a ' + l.cols + '×' + l.rows + ' grid';
      }
      text += ' · ' + f.W + '×' + f.H;
      if (n > MAX_GRID_CLIPS) text += ' · more than ' + MAX_GRID_CLIPS + ' clips gets slow and memory-heavy';
      $('#xc-sum').textContent = text;
      $('#xc-go').disabled = n < 2;
    }

    function renderAll() {
      renderSettings();
      renderList();
      renderPreview();
      renderSummary();
    }

    function close() {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('pointermove', onDragMove, true);
      document.removeEventListener('pointerup', onDragEnd, true);
      document.removeEventListener('pointercancel', onDragEnd, true);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }
    function onKey(e) {
      if (e.key !== 'Escape') return;
      var all = document.querySelectorAll('.sk-media-backdrop');
      if (all[all.length - 1] !== backdrop) return; // a clip viewer is open on top; let it handle Esc
      close();
    }
    var resizeTimer = null;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderPreview, 80);
    }
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);

    var closers = backdrop.querySelectorAll('[data-close]');
    for (var ci = 0; ci < closers.length; ci++) closers[ci].onclick = close;

    $('#xc-go').onclick = function () {
      if (st.clips.length < 2) return;
      var cfg = {
        clips: st.clips.slice(),
        orientation: st.orientation,
        mode: effectiveMode(),
        trims: JSON.parse(JSON.stringify(st.trims)),
        loopMode: st.loopMode,
        labelMode: st.labelsOn ? 'on' : 'off',
        format: st.format,
        labelStyle: st.labelStyle,
        labelOverrides: JSON.parse(JSON.stringify(st.overrides)),
        musicFiles: st.musicFiles.slice(),
        musicLoop: st.musicLoop,
        labelPos: { fx: st.labelPos.fx, fy: st.labelPos.fy }
      };
      close();
      onStart(cfg);
    };

    document.body.appendChild(backdrop);
    renderAll();
    renderPreview(); // second pass: the first measured the stage before it was in the page
    // Animator names come from the site's tag types; once they arrive the
    // list names and label previews fill in.
    ensureTagTypes().then(function () { tagsReady = true; if (backdrop.parentNode) renderAll(); });
  }

