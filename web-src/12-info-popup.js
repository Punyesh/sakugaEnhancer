  var currentInfoPopupClose = null;
  var currentInfoPopupAnchor = null;
  function openInfoPopup(anchorEl, p) {
    if (currentInfoPopupAnchor === anchorEl) {
      // clicking the same badge that's already open toggles it closed
      if (currentInfoPopupClose) currentInfoPopupClose();
      return;
    }
    if (currentInfoPopupClose) currentInfoPopupClose();

    // The credits panel for a clip opens beside the Enhancer panel, on its left, and looks like the
    // credits panel in the clip viewer (same chips, same sizing) — it never covers the results.
    var pop = document.createElement('div');
    pop.id = 'sk-info-popup';
    pop.className = 'sk-info-popup';
    document.body.appendChild(pop);

    var tags = safeFilter((p.tags || '').split(/\s+/), function (t) { return !!t; });
    // The `source` field is often just descriptive text (e.g. "Attack_on_Titan #12"),
    // not an actual URL — putting non-URL text straight into an href causes the
    // browser to treat it as a same-page fragment link (the "#12" jumps nowhere real).
    // Only render it as a clickable link when it's genuinely an absolute URL.
    var isRealUrl = /^https?:\/\//i.test(p.source || '');
    var sourceHtml = isRealUrl
      ? '<a href="' + esc(p.source) + '" target="_blank" rel="noopener">source ↗</a>'
      : (p.source ? '<span class="sk-badge" title="' + esc(p.source) + '">' + esc(p.source.slice(0, 22)) +
          (p.source.length > 22 ? '…' : '') + '</span>' : '');
    var linkHtml = sourceHtml + ' <a href="/post/show/' + p.id + '" target="_blank" rel="noopener">view post ↗</a>';
    var head =
      '<div class="sk-dock-head">' +
        '<div class="sk-dock-badges">' +
          '<span class="sk-badge score">▲ ' + (p.score || 0) + '</span>' +
          '<span class="sk-badge">' + esc(p.rating || '?') + '</span>' +
        '</div>' +
        '<span class="sk-close" id="sk-info-popup-close">&times;</span>' +
      '</div>' +
      '<div class="sk-info-links">' + linkHtml + '</div>';

    function position() {
      var panel = document.getElementById('sk-enh-panel');
      var pr = panel ? panel.getBoundingClientRect() : { left: window.innerWidth, right: window.innerWidth, top: 8, height: window.innerHeight - 16 };
      var margin = 8, gap = 12, minW = 200, maxW = 320;
      var roomL = pr.left - gap - margin;
      var roomR = window.innerWidth - pr.right - gap - margin;
      var side = roomL >= minW ? 'left' : (roomR >= minW ? 'right' : 'over');
      var room = side === 'left' ? roomL : (side === 'right' ? roomR : window.innerWidth - 2 * margin);
      pop.style.maxWidth = Math.max(160, Math.min(maxW, room)) + 'px';
      var top = Math.max(margin, pr.top);
      pop.style.maxHeight = Math.max(160, window.innerHeight - top - margin) + 'px';
      var w = pop.getBoundingClientRect().width;
      var left = side === 'left' ? pr.left - gap - w : (side === 'right' ? pr.right + gap : margin);
      pop.style.left = Math.max(margin, left) + 'px';
      pop.style.top = top + 'px';
    }

    pop.innerHTML = head +
      '<div class="sk-dock-body"><div class="sk-loading" style="padding:2px 0">loading tag info…</div></div>';
    position();

    function close() {
      pop.remove();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onOutside, true);
      window.removeEventListener('resize', position);
      if (currentInfoPopupClose === close) { currentInfoPopupClose = null; currentInfoPopupAnchor = null; }
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    function onOutside(e) { if (!pop.contains(e.target) && e.target !== anchorEl) close(); }
    pop.querySelector('#sk-info-popup-close').onclick = close;
    document.addEventListener('keydown', onKey);
    // Deferred so the same click that opened the popup doesn't immediately
    // register as an "outside" click and close it right back again.
    setTimeout(function () { document.addEventListener('mousedown', onOutside, true); }, 0);
    window.addEventListener('resize', position);
    currentInfoPopupClose = close;
    currentInfoPopupAnchor = anchorEl;

    ensureTagTypes().then(function (map) {
      if (!document.body.contains(pop)) return; // closed before this resolved
      var chipsHtml = buildTagChipsHtml(tags, map);
      pop.innerHTML = head + '<div class="sk-dock-body">' + chipsHtml + '</div>';
      wireTagChipClicks(pop, close);
      pop.querySelector('#sk-info-popup-close').onclick = close;
      position(); // real content may be a different height than the loading state
    });
  }

