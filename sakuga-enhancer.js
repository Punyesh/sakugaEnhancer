/*!
 * Sakuga Enhancer — bookmarklet overlay for sakugabooru.com
 * Runs same-origin, hits the site's own Moebooru JSON API (/post.json, /artist.json).
 * No external dependencies, no CDN calls (site CSP may block them anyway).
 */
(function () {
  'use strict';
  console.log('%c[sakuga-enhancer] build SF27 (show pagination + order) loaded', 'color:#ffb020;font-weight:bold');

  // Re-clicking the bookmarklet toggles the panel instead of double-injecting.
  var EXISTING = document.getElementById('sk-enh-root');
  if (EXISTING) {
    console.log('[sakuga-enhancer] found existing panel — toggling only, NOT re-initializing. ' +
      'If you need a fresh reload of the code, reload the page first (Ctrl/Cmd+Shift+R), then click the bookmark again.');
    EXISTING.style.display = EXISTING.style.display === 'none' ? 'block' : 'none';
    return;
  }

  if (!/sakugabooru\.com$/.test(location.hostname)) {
    alert('Sakuga Enhancer only works on sakugabooru.com — navigate there first.');
    return;
  }

  // ---------- design tokens ----------
  var C = {
    bg: '#15130f',
    panel: '#1c1a15',
    panel2: '#242119',
    line: '#3a3527',
    text: '#eae4d3',
    dim: '#9c9581',
    amber: '#ffb020',
    amberDim: '#7a5a1e',
    red: '#d9634a'
  };

  var css = [
    '#sk-enh-root *{box-sizing:border-box;}',
    '#sk-enh-root{position:fixed;z-index:2147483000;bottom:20px;right:20px;',
    'font-family:"Neue Haas Grotesk","Helvetica Neue",Arial,sans-serif;color:' + C.text + ';}',
    '#sk-enh-toggle{width:52px;height:52px;border-radius:50%;background:' + C.panel + ';',
    'border:1px solid ' + C.line + ';color:' + C.amber + ';font-size:20px;cursor:pointer;',
    'box-shadow:0 4px 18px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;',
    'font-family:"Courier New",monospace;letter-spacing:-1px;}',
    '#sk-enh-toggle:hover{border-color:' + C.amber + ';}',
    '#sk-enh-panel{position:absolute;bottom:64px;right:0;width:460px;max-height:80vh;',
    'background:' + C.panel + ';border:1px solid ' + C.line + ';border-radius:6px;',
    'box-shadow:0 12px 40px rgba(0,0,0,.6);display:flex;flex-direction:column;overflow:hidden;}',
    '#sk-enh-head{display:flex;align-items:center;justify-content:space-between;',
    'padding:10px 12px;border-bottom:1px solid ' + C.line + ';background:' + C.panel2 + ';}',
    '#sk-enh-head .brand{font-family:"Courier New",monospace;font-size:12px;color:' + C.dim + ';letter-spacing:1px;}',
    '#sk-enh-head .brand b{color:' + C.amber + ';}',
    '#sk-enh-tabs{display:flex;border-bottom:1px solid ' + C.line + ';}',
    '.sk-tab{flex:1;padding:9px 0;text-align:center;font-size:12px;letter-spacing:.5px;',
    'text-transform:uppercase;cursor:pointer;color:' + C.dim + ';border-bottom:2px solid transparent;}',
    '.sk-tab.active{color:' + C.amber + ';border-bottom-color:' + C.amber + ';}',
    '.sk-body{padding:12px;overflow-y:auto;}',
    '.sk-row{display:flex;gap:6px;margin-bottom:8px;}',
    '.sk-input{flex:1;background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';',
    'padding:7px 9px;border-radius:4px;font-size:13px;outline:none;}',
    '.sk-input:focus{border-color:' + C.amber + ';}',
    '.sk-select{background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';',
    'padding:7px 6px;border-radius:4px;font-size:12px;}',
    '.sk-btn{background:' + C.amberDim + ';border:1px solid ' + C.amber + ';color:' + C.amber + ';',
    'padding:7px 12px;border-radius:4px;font-size:12px;cursor:pointer;white-space:nowrap;}',
    '.sk-btn:hover{background:' + C.amber + ';color:#1a1509;}',
    '.sk-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;min-height:0;}',
    '.sk-chip{background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';',
    'font-size:11px;padding:3px 7px;border-radius:20px;display:flex;align-items:center;gap:5px;',
    'font-family:"Courier New",monospace;}',
    '.sk-chip span{cursor:pointer;color:' + C.red + ';font-weight:bold;}',
    '.sk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}',
    '.sk-card{position:relative;border:1px solid ' + C.line + ';border-radius:4px;overflow:hidden;',
    'aspect-ratio:1/1;background:#000;cursor:pointer;}',
    '.sk-card img,.sk-card video{width:100%;height:100%;object-fit:cover;display:block;opacity:.9;}',
    '.sk-card:hover img,.sk-card:hover video{opacity:1;}',
    '.sk-card video{position:absolute;top:0;left:0;}',
    '.sk-card .score{position:absolute;top:3px;right:4px;background:rgba(0,0,0,.7);',
    'color:' + C.amber + ';font-size:10px;padding:1px 5px;border-radius:8px;z-index:2;',
    'font-family:"Courier New",monospace;}',
    '.sk-card .vidmark{position:absolute;top:3px;left:4px;background:rgba(0,0,0,.7);',
    'color:' + C.text + ';font-size:9px;padding:1px 4px;border-radius:8px;z-index:2;',
    'font-family:"Courier New",monospace;}',
    '.sk-meta{font-size:11px;color:' + C.dim + ';margin:8px 0 4px;font-family:"Courier New",monospace;}',
    '.sk-info-dock{margin-top:10px;padding:0;background:' + C.bg + ';border:1px solid ' + C.line + ';',
    'border-radius:6px;overflow:hidden;opacity:0;transition:opacity .12s ease;}',
    '.sk-info-dock.show{opacity:1;}',
    '.sk-dock-head{display:flex;align-items:center;justify-content:space-between;',
    'padding:8px 10px;background:' + C.panel2 + ';border-bottom:1px solid ' + C.line + ';}',
    '.sk-dock-badges{display:flex;gap:6px;align-items:center;}',
    '.sk-badge{font-family:"Courier New",monospace;font-size:11px;padding:2px 7px;',
    'border-radius:10px;background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';}',
    '.sk-badge.score{color:' + C.amber + ';border-color:' + C.amberDim + ';}',
    '.sk-dock-head a{font-size:11px;color:' + C.amber + ';text-decoration:none;',
    'border:1px solid ' + C.amberDim + ';padding:2px 8px;border-radius:10px;}',
    '.sk-dock-head a:hover{background:' + C.amberDim + ';}',
    '.sk-dock-body{padding:10px;}',
    '.sk-dock-section + .sk-dock-section{margin-top:9px;}',
    '.sk-tagblock-label{color:' + C.dim + ';font-size:10px;text-transform:uppercase;',
    'letter-spacing:.6px;margin:0 0 5px;display:flex;align-items:center;gap:5px;}',
    '.sk-tagblock-label:before{content:"";width:3px;height:3px;border-radius:50%;',
    'background:' + C.dim + ';display:inline-block;}',
    '.sk-chipwrap{display:flex;flex-wrap:wrap;gap:5px;max-height:110px;overflow-y:auto;}',
    '.sk-mini-chip{display:inline-block;font-size:10px;padding:3px 8px;border-radius:10px;',
    'margin:0 4px 4px 0;font-family:"Courier New",monospace;border:1px solid ' + C.line + ';',
    'background:' + C.panel2 + ';}',
    '.sk-mini-chip.artist{background:' + C.amberDim + ';border-color:' + C.amber + ';color:' + C.amber + ';font-weight:bold;}',
    '.sk-mini-chip.other{color:' + C.dim + ';}',
    '.sk-facet-item{display:flex;align-items:center;gap:5px;font-size:11px;padding:4px 2px;',
    'border-radius:3px;cursor:pointer;color:' + C.text + ';min-width:0;}',
    '.sk-facet-item:hover{background:' + C.panel2 + ';}',
    '.sk-facet-item.off{color:' + C.dim + ';text-decoration:line-through;opacity:.6;}',
    '.sk-facet-item input{accent-color:' + C.amber + ';flex-shrink:0;width:13px;height:13px;margin:0;}',
    '.sk-facet-item .fname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
    'font-family:"Courier New",monospace;}',
    '.sk-facet-item .fcount{flex-shrink:0;color:' + C.dim + ';font-family:"Courier New",monospace;font-size:10px;}',
    '.sk-facet-item.is-artist .fname{color:' + C.amber + ';font-weight:bold;}',
    '.sk-filter-toggle{display:inline-flex;align-items:center;gap:6px;background:transparent;',
    'border:1px solid ' + C.line + ';color:' + C.text + ';padding:4px 10px;border-radius:14px;',
    'font-size:11px;cursor:pointer;font-family:inherit;}',
    '.sk-filter-toggle:hover{border-color:' + C.amber + ';color:' + C.amber + ';}',
    '.sk-filter-toggle .chev{font-size:8px;color:' + C.dim + ';transition:transform .15s ease;}',
    '.sk-filter-toggle.open .chev{transform:rotate(180deg);}',
    '.sk-filter-badge{background:' + C.amberDim + ';color:' + C.amber + ';border-radius:8px;',
    'padding:0 6px;font-family:"Courier New",monospace;font-size:10px;line-height:1.5;}',
    '.sk-mode-row{display:flex;gap:6px;margin-bottom:10px;}',
    '.sk-mode-btn{flex:1;background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.dim + ';',
    'padding:7px 6px;border-radius:5px;font-size:11px;cursor:pointer;font-family:inherit;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.sk-mode-btn:hover{border-color:' + C.amber + ';}',
    '.sk-mode-btn.active{background:' + C.amberDim + ';border-color:' + C.amber + ';color:' + C.amber + ';font-weight:bold;}',
    '.sk-facet-grid{border:1px solid ' + C.line + ';border-radius:6px;padding:8px 8px 6px;',
    'margin:-2px 0 8px;background:' + C.bg + ';',
    'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:2px 10px;',
    'max-height:220px;overflow-y:auto;overflow-x:hidden;}',
    '.sk-caption{color:' + C.dim + ';font-size:10.5px;line-height:1.5;margin-bottom:10px;}',
    '.sk-show-pick{display:flex;justify-content:space-between;align-items:center;padding:8px 9px;',
    'border:1px solid ' + C.line + ';border-radius:5px;margin-bottom:5px;cursor:pointer;}',
    '.sk-show-pick:hover{border-color:' + C.amber + ';background:' + C.panel2 + ';}',
    '.sk-show-pick .name{font-family:"Courier New",monospace;font-size:12px;}',
    '.sk-show-pick .cnt{color:' + C.dim + ';font-size:11px;}',
    '.sk-show-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;}',
    '.sk-show-head .title{font-size:15px;color:' + C.amber + ';font-family:"Courier New",monospace;}',
    '.sk-show-head a{font-size:11px;color:' + C.dim + ';text-decoration:none;}',
    '.sk-show-head a:hover{color:' + C.amber + ';}',
    '.sk-show-nav{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:10px;}',
    '.sk-nav-btn{background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';',
    'padding:5px 10px;border-radius:14px;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap;}',
    '.sk-nav-btn:hover:not(:disabled){border-color:' + C.amber + ';color:' + C.amber + ';}',
    '.sk-nav-btn:disabled{opacity:.35;cursor:default;}',
    '.sk-nav-crumb{flex:1;text-align:center;font-size:11px;color:' + C.dim + ';font-family:"Courier New",monospace;',
    'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.sk-page-jump{display:flex;align-items:center;gap:4px;margin-bottom:10px;}',
    '.sk-page-input{width:58px;background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';',
    'padding:5px 7px;border-radius:14px;font-size:11px;text-align:center;font-family:"Courier New",monospace;outline:none;}',
    '.sk-page-input:focus{border-color:' + C.amber + ';}',
    '.sk-page-go{background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';',
    'padding:5px 9px;border-radius:14px;font-size:11px;cursor:pointer;font-family:inherit;}',
    '.sk-page-go:hover{border-color:' + C.amber + ';color:' + C.amber + ';}',
    '.sk-page-total{font-size:11px;color:' + C.dim + ';}',
    '.sk-show-order-row{display:flex;align-items:center;gap:6px;margin-bottom:10px;}',
    '.sk-show-order-label{font-size:11px;color:' + C.dim + ';white-space:nowrap;}',
    '.sk-show-order-select{flex:1;background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';',
    'padding:5px 7px;border-radius:14px;font-size:11px;outline:none;font-family:inherit;}',
    '.sk-show-order-select:focus{border-color:' + C.amber + ';}',
    '.sk-related-row{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px;}',
    '.sk-chip.clickable{cursor:pointer;}',
    '.sk-chip.clickable:hover{border-color:' + C.amber + ';color:' + C.amber + ';}',
    '.sk-ep-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}',
    '.sk-ep-btn{background:' + C.bg + ';border:1px solid ' + C.line + ';border-radius:5px;',
    'padding:8px 4px;text-align:center;cursor:pointer;}',
    '.sk-ep-btn:hover{border-color:' + C.amber + ';}',
    '.sk-ep-btn .num{display:block;font-family:"Courier New",monospace;color:' + C.amber + ';',
    'font-size:13px;font-weight:bold;}',
    '.sk-ep-btn .cnt{display:block;font-size:10px;color:' + C.dim + ';margin-top:2px;}',
    '.sk-stat-big{font-size:34px;color:' + C.amber + ';font-family:"Courier New",monospace;',
    'font-weight:bold;line-height:1;}',
    '.sk-stat-label{font-size:11px;color:' + C.dim + ';text-transform:uppercase;letter-spacing:.5px;margin-top:2px;}',
    '.sk-stat-block{display:flex;gap:22px;margin:6px 0 14px;}',
    '.sk-taglist{display:flex;flex-direction:column;gap:5px;}',
    '.sk-tagrow{display:flex;align-items:center;gap:8px;font-size:12px;}',
    '.sk-tagrow .name{width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + C.text + ';}',
    '.sk-tagrow .bar{flex:1;height:6px;background:' + C.bg + ';border-radius:3px;overflow:hidden;}',
    '.sk-tagrow .bar i{display:block;height:100%;background:' + C.amber + ';}',
    '.sk-tagrow .n{width:28px;text-align:right;color:' + C.dim + ';font-family:"Courier New",monospace;font-size:11px;}',
    '.sk-filmstrip{display:flex;align-items:flex-end;gap:2px;height:70px;margin:10px 0 4px;',
    'border-bottom:1px solid ' + C.line + ';padding-bottom:2px;}',
    '.sk-frame{flex:1;background:' + C.amberDim + ';border-radius:1px 1px 0 0;min-height:2px;position:relative;}',
    '.sk-frame:hover{background:' + C.amber + ';}',
    '.sk-frame .yr{position:absolute;bottom:-16px;left:0;right:0;text-align:center;',
    'font-size:9px;color:' + C.dim + ';font-family:"Courier New",monospace;}',
    '.sk-frame .ct{position:absolute;top:-15px;left:0;right:0;text-align:center;',
    'font-size:9px;color:' + C.amber + ';font-family:"Courier New",monospace;opacity:0;}',
    '.sk-frame:hover .ct{opacity:1;}',
    '.sk-empty{color:' + C.dim + ';font-size:12px;text-align:center;padding:20px 0;}',
    '.sk-loading{color:' + C.amber + ';font-size:12px;text-align:center;padding:20px 0;',
    'font-family:"Courier New",monospace;}',
    '.sk-close{cursor:pointer;color:' + C.dim + ';font-size:16px;line-height:1;}',
    '.sk-media-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:2147483600;',
    'display:flex;align-items:center;justify-content:center;padding:24px;}',
    '.sk-media-box{max-width:760px;width:100%;background:' + C.panel + ';border:1px solid ' + C.line + ';',
    'border-radius:8px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6);}',
    '.sk-media-box video,.sk-media-box img{width:100%;max-height:72vh;display:block;background:#000;',
    'object-fit:contain;}',
    '.sk-media-top{display:flex;align-items:center;gap:8px;padding:8px 10px;background:' + C.panel2 + ';}',
    '.sk-media-viewpost{margin-left:auto;color:' + C.amber + ';font-size:12px;text-decoration:none;',
    'font-family:"Courier New",monospace;}',
    '.sk-media-viewpost:hover{text-decoration:underline;}',
    '.sk-media-close{cursor:pointer;color:' + C.dim + ';font-size:22px;line-height:1;padding:0 2px 2px;}',
    '.sk-media-close:hover{color:' + C.red + ';}',
    '.sk-frame-bar{padding:8px 10px;background:' + C.panel2 + ';border-top:1px solid ' + C.line + ';}',
    '.sk-frame-row{display:flex;align-items:center;gap:4px;}',
    '.sk-frame-btn{background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';',
    'padding:5px 9px;border-radius:5px;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap;}',
    '.sk-frame-btn:hover{border-color:' + C.amber + ';color:' + C.amber + ';}',
    '.sk-frame-count{flex:1;text-align:center;font-size:13px;font-weight:bold;color:' + C.amber + ';',
    'font-family:"Courier New",monospace;}',
    '.sk-frame-time{text-align:center;font-size:11px;color:' + C.dim + ';margin-top:5px;',
    'font-family:"Courier New",monospace;}',
    '.sk-trim-row{display:flex;align-items:center;gap:6px;padding:8px 10px 0;flex-wrap:wrap;}',
    '.sk-trim-label{font-size:10px;color:' + C.dim + ';font-family:"Courier New",monospace;}',
    '.sk-action-row{display:flex;gap:6px;padding:8px 10px;}',
    '.sk-action-row .sk-frame-btn{flex:1;}',
    '.sk-frame-btn:disabled{opacity:.35;cursor:default;}',
    '.sk-frame-btn:disabled:hover{border-color:' + C.line + ';color:' + C.text + ';}',
    '.sk-action-status{padding:0 10px 8px;font-size:11px;color:' + C.amber + ';',
    'font-family:"Courier New",monospace;min-height:14px;}',
    '.sk-comments-row{padding:0 10px 8px;border-top:1px solid ' + C.line + ';padding-top:8px;}',
    '.sk-comments-panel{max-height:220px;overflow-y:auto;padding:0 10px 10px;}',
    '.sk-comment{padding:8px 0;border-top:1px solid ' + C.line + ';}',
    '.sk-comment:first-child{border-top:none;}',
    '.sk-comment-head{display:flex;justify-content:space-between;font-size:11px;color:' + C.amber + ';',
    'font-family:"Courier New",monospace;margin-bottom:3px;}',
    '.sk-comment-head span{color:' + C.dim + ';font-weight:normal;}',
    '.sk-comment-body{font-size:12px;color:' + C.text + ';line-height:1.5;white-space:pre-wrap;}',
    '.sk-close:hover{color:' + C.red + ';}'
  ].join('');

  var styleTag = document.createElement('style');
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  var root = document.createElement('div');
  root.id = 'sk-enh-root';
  root.innerHTML =
    '<div id="sk-enh-panel" style="display:none">' +
      '<div id="sk-enh-head"><div class="brand">SAKUGA <b>ENHANCER</b></div>' +
        '<div class="sk-close" id="sk-enh-x">&times;</div></div>' +
      '<div id="sk-enh-tabs">' +
        '<div class="sk-tab active" data-tab="search">Search</div>' +
        '<div class="sk-tab" data-tab="shows">Shows</div>' +
      '</div>' +
      '<div class="sk-body" id="sk-enh-body"></div>' +
    '</div>' +
    '<div id="sk-enh-toggle" title="Sakuga Enhancer">##</div>';
  document.body.appendChild(root);

  var panel = root.querySelector('#sk-enh-panel');
  var body = root.querySelector('#sk-enh-body');
  root.querySelector('#sk-enh-toggle').onclick = function () {
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  };
  root.querySelector('#sk-enh-x').onclick = function () { panel.style.display = 'none'; };

  var tabs = root.querySelectorAll('.sk-tab');
  function switchToTab(name) {
    tabs.forEach(function (o) { o.classList.toggle('active', o.getAttribute('data-tab') === name); });
    renderTab(name);
  }
  tabs.forEach(function (t) {
    t.onclick = function () { switchToTab(t.getAttribute('data-tab')); };
  });

  // ---------- tiny fetch helper ----------
  function getJSON(path) {
    return fetch(path, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // Sakugabooru loads Prototype.js, which globally overwrites Array.prototype's
  // filter/map/sort/every/some/find with its own Ruby-Enumerable-style aliases
  // (filter->findAll, map->collect, every->all, some->any, find->detect). These
  // don't reliably behave like the native versions, so anywhere the RESULT is
  // used for real logic, we use these hand-rolled versions instead — .push(),
  // .slice(), and .forEach() are left alone since they weren't found aliased.
  function safeFilter(arr, fn) {
    var out = [];
    for (var i = 0; i < arr.length; i++) { if (fn(arr[i], i)) out.push(arr[i]); }
    return out;
  }
  function safeMap(arr, fn) {
    var out = [];
    for (var i = 0; i < arr.length; i++) { out.push(fn(arr[i], i)); }
    return out;
  }
  function safeSort(arr, cmp) {
    var a = arr.slice();
    if (a.length <= 1) return a;
    var mid = Math.floor(a.length / 2);
    var left = safeSort(a.slice(0, mid), cmp);
    var right = safeSort(a.slice(mid), cmp);
    var result = [];
    var i = 0, j = 0;
    while (i < left.length && j < right.length) {
      if (cmp(left[i], right[j]) <= 0) { result.push(left[i]); i++; }
      else { result.push(right[j]); j++; }
    }
    while (i < left.length) { result.push(left[i]); i++; }
    while (j < right.length) { result.push(right[j]); j++; }
    return result;
  }
  function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
  }); }

  // ---------- cross-tab sync state ----------
  // Keeps the two tabs in lockstep so switching tabs never requires re-searching.
  var sync = { artistTag: null }; // canonical animator tag currently "in focus"
  var searchCache = null; // { tags, order, posts, excluded, facetTags }
  var statsCache = null;  // { tagName, allPosts }

  // ===================== SEARCH TAB =====================
  var searchState = { tags: [], order: 'score', rating: '' };
  var searchViewMode = 'results'; // 'results' | 'stats'

  function tagsEqual(a, b) {
    return a.length === b.length && safeFilter(a, function (t, i) { return t === b[i]; }).length === a.length;
  }

  function renderSearch() {
    body.innerHTML =
      '<div class="sk-row">' +
        '<input class="sk-input" id="sk-tag-input" placeholder="add tag, enter to confirm">' +
        '<select class="sk-select" id="sk-order">' +
          '<option value="score">top score</option>' +
          '<option value="date">newest</option>' +
          '<option value="random">random</option>' +
        '</select>' +
      '</div>' +
      '<div class="sk-chips" id="sk-chips"></div>' +
      '<div class="sk-row">' +
        '<button class="sk-btn" id="sk-go" style="flex:1">Search</button>' +
      '</div>' +
      '<div class="sk-mode-row">' +
        '<button class="sk-mode-btn active" id="sk-mode-results" type="button">▤ Results</button>' +
        '<button class="sk-mode-btn" id="sk-mode-stats" type="button">📊 Animator Stats</button>' +
      '</div>' +
      '<div id="sk-search-view"></div>';

    renderChips();

    body.querySelector('#sk-order').value = searchState.order;
    body.querySelector('#sk-order').onchange = function (e) { searchState.order = e.target.value; };

    var input = body.querySelector('#sk-tag-input');
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && input.value.trim()) {
        commitPendingTag();
      }
    });

    body.querySelector('#sk-go').onclick = function () {
      commitPendingTag();
      searchViewMode = 'results';
      ensureResultsMarkup();
      runSearch();
    };

    body.querySelector('#sk-mode-results').onclick = function () { searchViewMode = 'results'; renderSearchView(); };
    body.querySelector('#sk-mode-stats').onclick = function () { searchViewMode = 'stats'; renderSearchView(); };

    renderSearchView();
  }

  function renderSearchView() {
    var toggleResults = body.querySelector('#sk-mode-results');
    var toggleStats = body.querySelector('#sk-mode-stats');
    toggleResults.classList.toggle('active', searchViewMode === 'results');
    toggleStats.classList.toggle('active', searchViewMode === 'stats');
    toggleStats.textContent = sync.artistTag ? '📊 Stats: ' + sync.artistTag : '📊 Animator Stats';

    var view = body.querySelector('#sk-search-view');

    if (searchViewMode === 'stats') {
      view.innerHTML =
        '<div class="sk-row">' +
          '<input class="sk-input" id="sk-artist-input" placeholder="animator name, e.g. yutaka_nakamura">' +
          '<button class="sk-btn" id="sk-artist-go">Look up</button>' +
        '</div>' +
        '<div id="sk-stats-out"></div>';

      var input = view.querySelector('#sk-artist-input');
      var go = function () {
        var name = input.value.trim().replace(/\s+/g, '_').toLowerCase();
        if (name) loadArtistStats(name);
      };
      view.querySelector('#sk-artist-go').onclick = go;
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });

      // Reuse the cached lookup if it's already for the animator currently "in focus".
      if (statsCache && sync.artistTag && statsCache.tagName === sync.artistTag) {
        input.value = statsCache.tagName;
        renderArtistStats(view.querySelector('#sk-stats-out'), statsCache.tagName, statsCache.allPosts);
      } else if (sync.artistTag && (!statsCache || statsCache.tagName !== sync.artistTag)) {
        input.value = sync.artistTag;
        loadArtistStats(sync.artistTag);
      } else if (statsCache) {
        input.value = statsCache.tagName;
        renderArtistStats(view.querySelector('#sk-stats-out'), statsCache.tagName, statsCache.allPosts);
      }
      return;
    }

    ensureResultsMarkup();

    // Reuse an exact cached result if nothing's changed since we last saw this tab.
    if (searchCache && tagsEqual(searchCache.tags, searchState.tags) && searchCache.order === searchState.order) {
      paintSearchResults(searchCache);
    // Otherwise, if Stats just identified an animator we haven't searched yet, sync to it.
    } else if (sync.artistTag && !(searchCache && searchCache.tags.indexOf(sync.artistTag) !== -1)) {
      searchState.tags = [sync.artistTag];
      renderChips();
      runSearch();
    }
  }

  function ensureResultsMarkup() {
    var view = body.querySelector('#sk-search-view');
    view.innerHTML =
      '<div class="sk-meta" id="sk-facet-head" style="display:none;justify-content:space-between;align-items:center">' +
        '<button class="sk-filter-toggle" id="sk-filter-toggle" type="button">' +
          'Filter <span class="sk-filter-badge" id="sk-filter-badge" style="display:none"></span>' +
          '<span class="chev">▾</span></button>' +
        '<span><a href="#" id="sk-facet-all" style="color:' + C.amber + '">reset</a></span>' +
      '</div>' +
      '<div class="sk-facet-grid" id="sk-facet-grid" style="display:none"></div>' +
      '<div id="sk-results"></div>' +
      '<div class="sk-info-dock" id="sk-info-dock" style="display:none"></div>';
  }

  function commitPendingTag() {
    var input = body.querySelector('#sk-tag-input');
    if (!input) return;
    var val = input.value.trim().toLowerCase();
    if (val) {
      searchState.tags.push(val.replace(/\s+/g, '_'));
      input.value = '';
      renderChips();
    }
  }

  function renderChips() {
    var wrap = body.querySelector('#sk-chips');
    wrap.innerHTML = '';
    searchState.tags.forEach(function (t, i) {
      var chip = document.createElement('div');
      chip.className = 'sk-chip';
      chip.innerHTML = esc(t) + ' <span data-i="' + i + '">&times;</span>';
      chip.querySelector('span').onclick = function () {
        searchState.tags.splice(i, 1);
        renderChips();
      };
      wrap.appendChild(chip);
    });
  }

  // ---------- full tag dictionary (name, type, count) ----------
  // Fetched once and reused everywhere: hover tooltips need type, the Shows
  // tab needs it for real substring search since the server's name_pattern
  // behavior turned out to be unreliable to guess at. Cached in localStorage
  // so it survives page reloads — only slow the first time or after expiry.
  var allTagsList = null;
  var allTagsLoading = null;
  var tagTypeMap = null;
  var TAG_CACHE_KEY = 'sk-enh-tagdict-v1';
  var TAG_CACHE_MAX_AGE = 6 * 60 * 60 * 1000; // 6 hours

  function loadTagCache() {
    try {
      var raw = localStorage.getItem(TAG_CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.tags || !obj.fetchedAt) return null;
      if (Date.now() - obj.fetchedAt > TAG_CACHE_MAX_AGE) return null;
      return obj.tags;
    } catch (e) { return null; }
  }
  function saveTagCache(tags) {
    try { localStorage.setItem(TAG_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), tags: tags })); }
    catch (e) { /* storage full/blocked — non-fatal, just skip caching */ }
  }

  function fetchAllTagsPaged(onProgress) {
    var all = [];
    var PAGE_SIZE = 1000;
    var CONCURRENCY = 5; // fetch several pages in parallel instead of one at a time
    var MAX_TAG_PAGES = 150; // politeness/sanity cap — generous since real per-page size is unconfirmed
    var nextPage = 1;

    function fetchOne(n) {
      return getJSON('/tag.json?limit=' + PAGE_SIZE + '&page=' + n + '&order=name')
        .then(function (batch) {
          if (!Array.isArray(batch)) throw new Error('unexpected /tag.json response shape');
          return batch;
        });
    }

    function runBatch() {
      var pages = [];
      for (var i = 0; i < CONCURRENCY && nextPage <= MAX_TAG_PAGES; i++) { pages.push(nextPage); nextPage++; }
      if (!pages.length) return Promise.resolve();
      return Promise.all(safeMap(pages, fetchOne)).then(function (batches) {
        var reachedEnd = false;
        for (var i = 0; i < batches.length; i++) {
          all = all.concat(batches[i]);
          if (batches[i].length === 0) reachedEnd = true;
        }
        if (onProgress) onProgress(all.length);
        if (!reachedEnd && nextPage <= MAX_TAG_PAGES) {
          return sleep(80).then(runBatch); // brief pause between batches, not between individual requests
        }
      });
    }

    return runBatch().then(function () { return all; });
  }

  function ensureAllTags(onProgress) {
    if (allTagsList) return Promise.resolve(allTagsList);
    if (allTagsLoading) return allTagsLoading;

    var cached = loadTagCache();
    if (cached && cached.length) {
      allTagsList = cached;
      window.__skDebugTags = cached;
      tagTypeMap = {};
      for (var i = 0; i < cached.length; i++) { tagTypeMap[cached[i].name] = cached[i].type; }
      return Promise.resolve(allTagsList);
    }

    // Confirmed by direct testing: this fork's name_pattern parameter is a no-op
    // (identical results regardless of pattern), and limit=0 silently returns a
    // small default set rather than "everything" despite what the docs claim.
    // So: real pagination with an explicit limit, no shortcuts.
    allTagsLoading = fetchAllTagsPaged(onProgress)
      .then(function (list) {
        allTagsList = list;
        window.__skDebugTags = list; // debug hook — check in console with:
        // window.__skDebugTags.filter(t => t.name.includes('sometag'))
        tagTypeMap = {};
        for (var i = 0; i < list.length; i++) { tagTypeMap[list[i].name] = list[i].type; }
        saveTagCache(list);
        return allTagsList;
      })
      .catch(function (err) {
        allTagsLoading = null; // allow retrying on the next call instead of sticking forever
        tagTypeMap = tagTypeMap || {};
        throw err;
      });
    return allTagsLoading;
  }
  function ensureTagTypes() { return ensureAllTags().then(function () { return tagTypeMap; }).catch(function () { return tagTypeMap || {}; }); }

  function isVideoFile(url) { return /\.(webm|mp4|mov)(\?|$)/i.test(url || ''); }

  function renderInfoDock(dock, p) {
    dock.style.display = 'block';
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
        '</div>' + linkHtml +
      '</div>';
    dock.innerHTML = head +
      '<div class="sk-dock-body"><div class="sk-loading" style="padding:2px 0">loading tag info…</div></div>';
    dock.classList.add('show');

    ensureTagTypes().then(function (map) {
      var artistTags = safeFilter(tags, function (t) { return map[t] === 1; });
      var otherTags = safeFilter(tags, function (t) { return map[t] !== 1; });
      var body =
        '<div class="sk-dock-section">' +
          '<div class="sk-tagblock-label">' + (artistTags.length ? 'Animator' : 'Animator — untagged') + '</div>' +
          '<div class="sk-chipwrap">' +
            (artistTags.length
              ? safeMap(artistTags, function (t) { return '<span class="sk-mini-chip artist">' + esc(t) + '</span>'; }).join('')
              : '<span class="sk-mini-chip other">not credited on this post</span>') +
          '</div>' +
        '</div>' +
        '<div class="sk-dock-section">' +
          '<div class="sk-tagblock-label">Tags (' + otherTags.length + ')</div>' +
          '<div class="sk-chipwrap">' +
            safeMap(otherTags, function (t) { return '<span class="sk-mini-chip other">' + esc(t) + '</span>'; }).join('') +
          '</div>' +
        '</div>';
      dock.innerHTML = head + '<div class="sk-dock-body">' + body + '</div>';
    });
  }

  function triggerDownload(url, filename) {
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function triggerBlobDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // ---------- ffmpeg.wasm (client-side, real trimming) ----------
  // Uses the current 0.12.x API deliberately, not the older 0.11.x one: 0.12.x
  // is specifically designed to let us fetch the core/wasm files ourselves and
  // hand them over as same-origin blob: URLs, which avoids the cross-origin
  // worker-loading problems that come from just pointing at a raw CDN URL from
  // inside a bookmarklet running on someone else's page. Its single-threaded
  // "core" package (not "core-mt") also genuinely doesn't reference
  // SharedArrayBuffer at all, so there's no shim needed — sakugabooru.com
  // doesn't send the cross-origin-isolation headers real SharedArrayBuffer
  // needs, and the previous version's crash traced back to faking that
  // reference rather than avoiding the need for it.
  var FFMPEG_CONSENT_KEY = 'sk-enh-ffmpeg-consent';
  var FFMPEG_PKG_BASE = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm';
  var FFMPEG_PKG_URL = FFMPEG_PKG_BASE + '/index.js';
  var FFMPEG_UTIL_URL = 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';
  var FFMPEG_CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  var ffmpegInstance = null;
  var ffmpegLoadPromise = null;

  function withTimeout(promise, ms, message) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error(message)); }, ms);
      promise.then(
        function (v) { clearTimeout(timer); resolve(v); },
        function (e) { clearTimeout(timer); reject(e); }
      );
    });
  }

  // worker.js (the "class worker" ffmpeg's main thread talks to) imports two
  // sibling modules by relative path — './const.js' and './errors.js' — which
  // can't resolve once worker.js itself is loaded from a blob: URL (blobs have
  // no real path for relative imports to resolve against). So: fetch all three
  // as text ourselves, blob the two dependencies first, then patch worker.js's
  // own source text to point at those blob URLs before blobbing it too. This
  // is a manual version of the workaround ffmpeg.wasm's own maintainers
  // describe (see their GitHub issue #767) for the non-bundled single-file case.
  function buildPatchedWorkerBlobURL() {
    console.log('[sakuga-enhancer] ffmpeg: fetching worker.js + its dependencies…');
    return Promise.all([
      fetch(FFMPEG_PKG_BASE + '/worker.js').then(function (r) { return r.text(); }),
      fetch(FFMPEG_PKG_BASE + '/const.js').then(function (r) { return r.text(); }),
      fetch(FFMPEG_PKG_BASE + '/errors.js').then(function (r) { return r.text(); })
    ]).then(function (texts) {
      var workerSrc = texts[0], constSrc = texts[1], errorsSrc = texts[2];
      var constBlobUrl = URL.createObjectURL(new Blob([constSrc], { type: 'text/javascript' }));
      var errorsBlobUrl = URL.createObjectURL(new Blob([errorsSrc], { type: 'text/javascript' }));
      var patched = workerSrc.split('./const.js').join(constBlobUrl).split('./errors.js').join(errorsBlobUrl);
      console.log('[sakuga-enhancer] ffmpeg: patched worker.js imports, sizes —',
        'worker:', workerSrc.length, 'const:', constSrc.length, 'errors:', errorsSrc.length);
      return URL.createObjectURL(new Blob([patched], { type: 'text/javascript' }));
    });
  }

  function ensureFfmpegLoaded(statusEl) {
    if (ffmpegInstance) return Promise.resolve(ffmpegInstance);
    if (ffmpegLoadPromise) return ffmpegLoadPromise;
    ffmpegLoadPromise = (function () {
      statusEl.textContent = 'loading video tool… (first time only, your browser caches it after this)';
      console.log('[sakuga-enhancer] ffmpeg: importing wrapper + util modules…');
      return Promise.all([import(FFMPEG_PKG_URL), import(FFMPEG_UTIL_URL)]).then(function (mods) {
        console.log('[sakuga-enhancer] ffmpeg: modules imported, fetching core/wasm/worker…');
        var FFmpeg = mods[0].FFmpeg;
        var toBlobURL = mods[1].toBlobURL;
        return Promise.all([
          toBlobURL(FFMPEG_CORE_BASE + '/ffmpeg-core.js', 'text/javascript'),
          toBlobURL(FFMPEG_CORE_BASE + '/ffmpeg-core.wasm', 'application/wasm'),
          buildPatchedWorkerBlobURL()
        ]).then(function (urls) {
          console.log('[sakuga-enhancer] ffmpeg: all files ready, calling ffmpeg.load()…');
          var ffmpeg = new FFmpeg();
          try {
            ffmpeg.on('log', function (e) { console.log('[ffmpeg]', e.message); });
          } catch (e) { /* .on not available on this build — non-fatal */ }
          var loadPromise = ffmpeg.load({ coreURL: urls[0], wasmURL: urls[1], classWorkerURL: urls[2] });
          return withTimeout(loadPromise, 20000,
            "video tool took too long to start (over 20s) — its worker likely failed silently. " +
            "Check the console for [sakuga-enhancer]/[ffmpeg] messages to see where it stopped."
          ).then(function () {
            console.log('[sakuga-enhancer] ffmpeg: loaded successfully.');
            ffmpegInstance = ffmpeg;
            return ffmpeg;
          });
        });
      });
    })().catch(function (err) { ffmpegLoadPromise = null; throw err; });
    return ffmpegLoadPromise;
  }

  function getFfmpegConsent(statusEl) {
    if (localStorage.getItem(FFMPEG_CONSENT_KEY) === '1') return Promise.resolve();
    return new Promise(function (resolve, reject) {
      statusEl.innerHTML =
        'trimming needs a one-time ~25–30MB download (your browser caches it afterward, so this only happens once) — ' +
        '<a href="#" id="sk-ffmpeg-yes" style="color:' + C.amber + '">continue</a> · ' +
        '<a href="#" id="sk-ffmpeg-no" style="color:' + C.dim + '">cancel</a>';
      statusEl.querySelector('#sk-ffmpeg-yes').onclick = function (e) {
        e.preventDefault();
        localStorage.setItem(FFMPEG_CONSENT_KEY, '1');
        statusEl.textContent = '';
        resolve();
      };
      statusEl.querySelector('#sk-ffmpeg-no').onclick = function (e) {
        e.preventDefault();
        statusEl.textContent = '';
        reject(new Error('cancelled'));
      };
    });
  }

  function performTrim(p, inTime, outTime, statusEl) {
    return getFfmpegConsent(statusEl)
      .then(function () { return ensureFfmpegLoaded(statusEl); })
      .then(function (ffmpeg) {
        statusEl.textContent = 'reading clip…';
        return fetch(p.file_url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
          var ext = p.file_ext || 'webm';
          var inputName = 'input.' + ext;
          var outputName = 'output.' + ext;
          return ffmpeg.writeFile(inputName, new Uint8Array(buf)).then(function () {
            statusEl.textContent = 'trimming…';
            return ffmpeg.exec(['-ss', String(inTime), '-to', String(outTime), '-i', inputName, '-c', 'copy', outputName]);
          }).then(function () {
            return ffmpeg.readFile(outputName);
          }).then(function (data) {
            statusEl.textContent = '';
            return { blob: new Blob([data.buffer], { type: 'video/' + ext }), ext: ext };
          });
        });
      });
  }

  function formatCommentDate(raw) {
    if (raw === null || raw === undefined || raw === '') return '';
    var d;
    if (typeof raw === 'number') {
      d = new Date(raw * 1000); // most likely: unix seconds, matching post.json's created_at
      if (isNaN(d.getTime())) d = new Date(raw); // fallback: maybe already milliseconds
    } else {
      d = new Date(raw); // fallback: maybe an ISO date string instead of a number
    }
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
  }

  function renderComments(panel, comments) {
    if (!comments || !comments.length) {
      panel.innerHTML = '<div class="sk-empty" style="padding:10px 0">no comments yet</div>';
      return;
    }
    var html = '';
    comments.forEach(function (c) {
      var name = esc(c.creator || (c.creator_id ? 'user #' + c.creator_id : 'anonymous'));
      var body = esc(c.body || c.comment || '');
      var when = formatCommentDate(c.created_at);
      html += '<div class="sk-comment">' +
        '<div class="sk-comment-head"><b>' + name + '</b><span>' + when + '</span></div>' +
        '<div class="sk-comment-body">' + body.replace(/\n/g, '<br>') + '</div>' +
      '</div>';
    });
    panel.innerHTML = html;
  }

  function addCommentsSection(box, p) {
    var row = document.createElement('div');
    row.className = 'sk-comments-row';
    row.innerHTML = '<button class="sk-frame-btn" id="sk-comments-toggle">💬 Comments</button>';
    box.appendChild(row);

    var panel = document.createElement('div');
    panel.className = 'sk-comments-panel';
    panel.style.display = 'none';
    box.appendChild(panel);

    var loaded = false;
    row.querySelector('#sk-comments-toggle').onclick = function () {
      var showing = panel.style.display !== 'none';
      panel.style.display = showing ? 'none' : 'block';
      if (showing || loaded) return;
      loaded = true;
      panel.innerHTML = '<div class="sk-loading" style="padding:10px 0">loading comments…</div>';
      getJSON('/comment.json?post_id=' + p.id).then(function (comments) {
        renderComments(panel, Array.isArray(comments) ? comments : null);
      }).catch(function (err) {
        panel.innerHTML = '<div class="sk-empty" style="padding:10px 0">couldn\'t load comments — ' + esc(err.message) + '</div>';
      });
    };
  }

  function buildMediaShell(p) {
    var backdrop = document.createElement('div');
    backdrop.className = 'sk-media-backdrop';
    var box = document.createElement('div');
    box.className = 'sk-media-box';
    box.innerHTML =
      '<div class="sk-media-top">' +
        '<span class="sk-badge score">▲ ' + (p.score || 0) + '</span>' +
        '<span class="sk-badge">' + esc(p.rating || '?') + '</span>' +
        '<a href="/post/show/' + p.id + '" target="_blank" rel="noopener" class="sk-media-viewpost">view post ↗</a>' +
        '<span class="sk-media-close" id="sk-media-close" title="close">&times;</span>' +
      '</div>';
    backdrop.appendChild(box);
    document.body.appendChild(backdrop); // attach to the real page body so it overlays everything, not just our small panel

    var extraCleanup = [];
    function close() {
      var vid = box.querySelector('video');
      if (vid) vid.pause();
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      extraCleanup.forEach(function (fn) { fn(); });
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    box.querySelector('#sk-media-close').onclick = close;
    box._onClose = function (fn) { extraCleanup.push(fn); };
    return box; // caller appends the actual <video> or <img>; can register box._onClose(fn) for cleanup
  }

  function openVideoModal(p) {
    var box = buildMediaShell(p);
    var vid = document.createElement('video');
    vid.controls = true;
    vid.autoplay = true;
    vid.playsInline = true;
    vid.src = p.file_url;
    box.appendChild(vid);

    // Frame-accurate review is the whole point of sakuga — add frame stepping.
    // fps comes from the post data if this fork exposes it, else a common
    // anime-standard fallback; either way, browser seeking is only approximate
    // (it can't guarantee landing on an exact decoded frame), so treat this as
    // "close enough for review," not a frame-perfect scrubber.
    var fps = Number(p.frame_rate || p.framerate) || 24;
    var MED_STEP = 10;
    var bigStep = Math.max(1, Math.round(fps)); // ~1 second worth of frames

    var frameBar = document.createElement('div');
    frameBar.className = 'sk-frame-bar';
    frameBar.innerHTML =
      '<div class="sk-frame-row">' +
        '<button class="sk-frame-btn" id="sk-fb-bigback" title="back ~1s">«</button>' +
        '<button class="sk-frame-btn" id="sk-fb-medback" title="back ' + MED_STEP + ' frames">‹‹</button>' +
        '<button class="sk-frame-btn" id="sk-fb-back" title="previous frame ( , )">‹</button>' +
        '<span class="sk-frame-count" id="sk-frame-count">0 / 0</span>' +
        '<button class="sk-frame-btn" id="sk-fb-fwd" title="next frame ( . )">›</button>' +
        '<button class="sk-frame-btn" id="sk-fb-medfwd" title="forward ' + MED_STEP + ' frames">››</button>' +
        '<button class="sk-frame-btn" id="sk-fb-bigfwd" title="forward ~1s">»</button>' +
      '</div>' +
      '<div class="sk-frame-time" id="sk-frame-time">0:00.0 / 0:00.0</div>';
    box.appendChild(frameBar);

    var countEl = frameBar.querySelector('#sk-frame-count');
    var timeEl = frameBar.querySelector('#sk-frame-time');

    function formatTime(t) {
      var m = Math.floor(t / 60);
      var s = t - m * 60;
      var sStr = s.toFixed(1);
      if (s < 10) sStr = '0' + sStr;
      return m + ':' + sStr;
    }
    function updateDisplay() {
      var total = Math.round((vid.duration || 0) * fps);
      var cur = Math.round(vid.currentTime * fps);
      countEl.textContent = cur + ' / ' + total;
      timeEl.textContent = formatTime(vid.currentTime) + ' / ' + formatTime(vid.duration || 0);
    }
    function step(deltaFrames) {
      vid.pause();
      var next = vid.currentTime + deltaFrames / fps;
      vid.currentTime = Math.max(0, Math.min(vid.duration || next, next));
    }
    vid.addEventListener('loadedmetadata', updateDisplay);
    vid.addEventListener('timeupdate', updateDisplay);

    frameBar.querySelector('#sk-fb-back').onclick = function () { step(-1); };
    frameBar.querySelector('#sk-fb-fwd').onclick = function () { step(1); };
    frameBar.querySelector('#sk-fb-medback').onclick = function () { step(-MED_STEP); };
    frameBar.querySelector('#sk-fb-medfwd').onclick = function () { step(MED_STEP); };
    frameBar.querySelector('#sk-fb-bigback').onclick = function () { step(-bigStep); };
    frameBar.querySelector('#sk-fb-bigfwd').onclick = function () { step(bigStep); };

    function onFrameKey(e) {
      if (e.key === ',') step(-1);
      else if (e.key === '.') step(1);
    }
    document.addEventListener('keydown', onFrameKey);
    box._onClose(function () { document.removeEventListener('keydown', onFrameKey); });

    // ---- trim range + download/share ----
    // There's no server here, so trimming runs entirely client-side via
    // ffmpeg.wasm (loaded on first use, see below) — a real stream-copy cut,
    // fast and lossless since it's not re-encoding, just remuxing.
    var inTime = null, outTime = null;

    var trimCaption = document.createElement('div');
    trimCaption.className = 'sk-caption';
    trimCaption.style.padding = '8px 10px 0';
    trimCaption.textContent = 'optional: use the frame controls above to find a start/end point, mark them below, ' +
      'then Download/Share Trim will cut exactly that range.';
    box.appendChild(trimCaption);

    var trimRow = document.createElement('div');
    trimRow.className = 'sk-trim-row';
    trimRow.innerHTML =
      '<button class="sk-frame-btn" id="sk-mark-in" title="set the trim start to the current playhead position">Mark In</button>' +
      '<span class="sk-trim-label" id="sk-trim-in">in: —</span>' +
      '<button class="sk-frame-btn" id="sk-mark-out" title="set the trim end to the current playhead position">Mark Out</button>' +
      '<span class="sk-trim-label" id="sk-trim-out">out: —</span>' +
      '<button class="sk-frame-btn" id="sk-trim-clear" title="clear the marked range — buttons below go back to acting on the full clip">✕</button>';
    box.appendChild(trimRow);

    var actionRow = document.createElement('div');
    actionRow.className = 'sk-action-row';
    actionRow.innerHTML =
      '<button class="sk-frame-btn" id="sk-dl-full" title="downloads the original file, unmodified">⬇ Download Full</button>' +
      '<button class="sk-frame-btn" id="sk-dl-trim" disabled title="mark a range above first — trims to it and downloads the result (takes a moment)">⬇ Download Trim</button>';
    box.appendChild(actionRow);

    var statusEl = document.createElement('div');
    statusEl.className = 'sk-action-status';
    box.appendChild(statusEl);

    var inLabel = trimRow.querySelector('#sk-trim-in');
    var outLabel = trimRow.querySelector('#sk-trim-out');
    var dlTrimBtn = actionRow.querySelector('#sk-dl-trim');

    function updateTrimBtn() {
      var hasTrim = inTime !== null && outTime !== null && outTime > inTime;
      dlTrimBtn.disabled = !hasTrim;
      dlTrimBtn.title = hasTrim
        ? 'trims to your marked range and downloads the result (takes a moment)'
        : 'mark a range above first — trims to it and downloads the result (takes a moment)';
    }
    updateTrimBtn(); // set initial button state (no trim range yet)

    trimRow.querySelector('#sk-mark-in').onclick = function () {
      inTime = vid.currentTime;
      inLabel.textContent = 'in: ' + formatTime(inTime);
      updateTrimBtn();
    };
    trimRow.querySelector('#sk-mark-out').onclick = function () {
      outTime = vid.currentTime;
      outLabel.textContent = 'out: ' + formatTime(outTime);
      updateTrimBtn();
    };
    trimRow.querySelector('#sk-trim-clear').onclick = function () {
      inTime = null; outTime = null;
      inLabel.textContent = 'in: —';
      outLabel.textContent = 'out: —';
      updateTrimBtn();
    };

    box._onClose(function () {
      // ffmpeg.wasm 0.11.x has no clean mid-job cancel; if a trim is running when the
      // modal closes it'll just finish silently in the background rather than error out.
    });

    actionRow.querySelector('#sk-dl-full').onclick = function () {
      triggerDownload(p.file_url, 'sakuga_' + p.id + '.' + (p.file_ext || 'webm'));
    };

    dlTrimBtn.onclick = function () {
      if (dlTrimBtn.disabled) return;
      dlTrimBtn.disabled = true;
      performTrim(p, inTime, outTime, statusEl).then(function (res) {
        triggerBlobDownload(res.blob, 'sakuga_' + p.id + '_trim.' + res.ext);
        statusEl.textContent = 'trimmed clip downloaded';
        updateTrimBtn();
      }).catch(function (err) {
        if (err.message !== 'cancelled') statusEl.textContent = 'trim failed: ' + err.message;
        updateTrimBtn();
      });
    };

    addCommentsSection(box, p);
  }

  function openImageModal(p) {
    var box = buildMediaShell(p);
    var img = document.createElement('img');
    var src = p.sample_url || p.jpeg_url || p.file_url || p.preview_url;
    img.src = src;
    box.appendChild(img);

    var actionRow = document.createElement('div');
    actionRow.className = 'sk-action-row';
    actionRow.innerHTML =
      '<button class="sk-frame-btn" id="sk-img-dl">⬇ Download</button>';
    box.appendChild(actionRow);
    var statusEl = document.createElement('div');
    statusEl.className = 'sk-action-status';
    box.appendChild(statusEl);

    actionRow.querySelector('#sk-img-dl').onclick = function () {
      triggerDownload(p.file_url || src, 'sakuga_' + p.id + '.' + (p.file_ext || 'jpg'));
    };

    addCommentsSection(box, p);
  }

  function buildCard(p, dock) {
    var card = document.createElement('div');
    card.className = 'sk-card';
    var thumb = p.preview_url || p.jpeg_url || p.sample_url;
    var clipUrl = p.file_url;
    var playable = isVideoFile(clipUrl);
    card.innerHTML =
      (thumb ? '<img loading="lazy" src="' + thumb + '">' : '') +
      (playable ? '<video muted loop playsinline preload="none"></video><div class="vidmark">▶ clip</div>' : '') +
      '<div class="score">&#9650; ' + (p.score || 0) + '</div>';

    var hoverVid = null;
    if (playable) {
      hoverVid = card.querySelector('video');
      card.addEventListener('mouseenter', function () {
        hoverVid.src = clipUrl;
        hoverVid.play().catch(function () {});
      });
      card.addEventListener('mouseleave', function () {
        hoverVid.pause();
        hoverVid.removeAttribute('src');
        hoverVid.load();
      });
    }

    card.addEventListener('mouseenter', function () {
      clearTimeout(card._dockTimer);
      card._dockTimer = setTimeout(function () { renderInfoDock(dock, p); }, 180);
    });
    card.addEventListener('mouseleave', function () { clearTimeout(card._dockTimer); });
    card.title = (p.tags || '').slice(0, 200);
    card.onclick = function () {
      if (playable) {
        if (hoverVid) hoverVid.pause();
        openVideoModal(p);
      } else {
        openImageModal(p);
      }
    };
    return card;
  }

  function paintSearchResults(cache) {
    var results = body.querySelector('#sk-results');
    var dock = body.querySelector('#sk-info-dock');
    var facetHead = body.querySelector('#sk-facet-head');
    var facetGrid = body.querySelector('#sk-facet-grid');
    var toggle = body.querySelector('#sk-filter-toggle');
    var badge = body.querySelector('#sk-filter-badge');

    var visible = safeFilter(cache.posts, function (p) {
      var tags = (p.tags || '').split(/\s+/);
      for (var i = 0; i < tags.length; i++) {
        if (cache.excluded[tags[i]]) return false;
      }
      return true;
    });

    if (!visible.length) {
      results.innerHTML = '<div class="sk-empty">' +
        (cache.posts.length ? 'no clips left after filtering' : 'no posts matched those tags') + '</div>';
    } else {
      var grid = document.createElement('div');
      grid.className = 'sk-grid';
      if (cache.sampledOnly) {
        var note = document.createElement('div');
        note.className = 'sk-caption';
        note.style.gridColumn = '1/-1';
        note.textContent = 'showing ' + visible.length + ' sampled post(s) with non-standard source text — ' +
          'not a complete search, just what turned up while sampling this show.';
        grid.appendChild(note);
      }
      visible.forEach(function (p) { grid.appendChild(buildCard(p, dock)); });
      results.innerHTML = '';
      results.appendChild(grid);
    }

    var activeCount = safeFilter(Object.keys(cache.excluded), function (t) { return cache.excluded[t]; }).length;
    if (activeCount) { badge.style.display = 'inline'; badge.textContent = activeCount; }
    else { badge.style.display = 'none'; }

    toggle.onclick = function () {
      var open = facetGrid.style.display !== 'none';
      facetGrid.style.display = open ? 'none' : 'block';
      toggle.classList.toggle('open', !open);
    };

    if (cache.facetTags.length) {
      facetHead.style.display = 'flex';
      facetGrid.innerHTML = '<div class="sk-loading" style="padding:4px 0">loading tag info…</div>';
      ensureTagTypes().then(function (map) {
        var sorted = safeSort(cache.facetTags, function (a, b) {
          var aArtist = map[a] === 1 ? 0 : 1;
          var bArtist = map[b] === 1 ? 0 : 1;
          return aArtist - bArtist;
        });
        facetGrid.innerHTML = '<div class="sk-caption" style="grid-column:1/-1">' +
          'hides clips carrying an unchecked tag — most clips carry several, so unchecking ' +
          'just one still leaves the rest visible</div>';
        sorted.forEach(function (t) {
          var count = safeFilter(visible, function (p) { return (' ' + p.tags + ' ').indexOf(' ' + t + ' ') !== -1; }).length;
          var item = document.createElement('label');
          item.className = 'sk-facet-item' + (cache.excluded[t] ? ' off' : '') + (map[t] === 1 ? ' is-artist' : '');
          item.innerHTML =
            '<input type="checkbox" ' + (cache.excluded[t] ? '' : 'checked') + '> ' +
            '<span class="fname" title="' + esc(t) + '">' + (map[t] === 1 ? '🎬 ' : '') + esc(t) + '</span>' +
            '<span class="fcount">' + count + '</span>';
          item.querySelector('input').addEventListener('change', function (e) {
            cache.excluded[t] = !e.target.checked;
            paintSearchResults(cache);
          });
          facetGrid.appendChild(item);
        });
      });
      body.querySelector('#sk-facet-all').onclick = function (e) {
        e.preventDefault(); cache.excluded = {}; paintSearchResults(cache);
      };
    } else {
      facetHead.style.display = 'none';
      facetGrid.innerHTML = '';
    }
  }

  function runSearch() {
    var results = body.querySelector('#sk-results');
    results.innerHTML = '<div class="sk-loading">fetching…</div>';
    body.querySelector('#sk-facet-head').style.display = 'none';
    body.querySelector('#sk-facet-grid').innerHTML = '';
    body.querySelector('#sk-facet-grid').style.display = 'none';
    body.querySelector('#sk-filter-toggle').classList.remove('open');
    var tagsSnapshot = searchState.tags.slice();
    var orderSnapshot = searchState.order;
    var tagQuery = tagsSnapshot.join(' ') + ' order:' + orderSnapshot;

    getJSON('/post.json?limit=24&tags=' + encodeURIComponent(tagQuery.trim()))
      .then(function (posts) {
        var freq = {};
        posts.forEach(function (p) {
          (p.tags || '').split(/\s+/).forEach(function (t) {
            if (!t || tagsSnapshot.indexOf(t) !== -1) return;
            freq[t] = (freq[t] || 0) + 1;
          });
        });
        var facetTags = safeSort(Object.keys(freq), function (a, b) { return freq[b] - freq[a]; })
          .slice(0, 24);

        searchCache = { tags: tagsSnapshot, order: orderSnapshot, posts: posts, excluded: {}, facetTags: facetTags };
        paintSearchResults(searchCache);

        // Figure out if this query is "about" a specific animator, so Stats can sync to it.
        ensureTagTypes().then(function (map) {
          var found = safeFilter(tagsSnapshot, function (t) { return map[t] === 1; })[0] || null;
          sync.artistTag = found;
          var statsBtn = body.querySelector('#sk-mode-stats');
          if (statsBtn) statsBtn.textContent = sync.artistTag ? '📊 Stats: ' + sync.artistTag : '📊 Animator Stats';
        });
      })
      .catch(function (err) {
        results.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
      });
  }

  // ===================== STATS TAB =====================
  var MAX_PAGES = 5; // politeness cap: up to 500 posts per animator
  var PAGE_DELAY = 350; // ms between paginated requests

  function loadArtistStats(tagName) {
    var out = body.querySelector('#sk-stats-out');
    out.innerHTML = '<div class="sk-loading">pulling posts… (paced, may take a few seconds)</div>';

    var allPosts = [];
    function fetchPage(page) {
      return getJSON('/post.json?limit=100&page=' + page + '&tags=' + encodeURIComponent(tagName))
        .then(function (posts) {
          allPosts = allPosts.concat(posts);
          if (posts.length === 100 && page < MAX_PAGES) {
            return sleep(PAGE_DELAY).then(function () { return fetchPage(page + 1); });
          }
        });
    }

    fetchPage(1).then(function () {
      if (!allPosts.length) {
        out.innerHTML = '<div class="sk-empty">no posts found for tag "' + esc(tagName) + '" — check the exact tag spelling on the site\'s artist page</div>';
        return;
      }
      statsCache = { tagName: tagName, allPosts: allPosts };
      sync.artistTag = tagName;
      var statsBtn = body.querySelector('#sk-mode-stats');
      if (statsBtn) statsBtn.textContent = '📊 Stats: ' + tagName;
      renderArtistStats(out, tagName, allPosts);
    }).catch(function (err) {
      out.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
    });
  }

  function renderArtistStats(out, tagName, posts) {
    var total = posts.length;
    var scoreSum = 0;
    var tagFreq = {};
    var yearCounts = {};

    posts.forEach(function (p) {
      scoreSum += (p.score || 0);
      (p.tags || '').split(/\s+/).forEach(function (t) {
        if (!t || t === tagName) return;
        tagFreq[t] = (tagFreq[t] || 0) + 1;
      });
      if (p.created_at) {
        var y = new Date(p.created_at * 1000).getFullYear();
        yearCounts[y] = (yearCounts[y] || 0) + 1;
      }
    });

    var topTags = safeSort(Object.keys(tagFreq), function (a, b) { return tagFreq[b] - tagFreq[a]; })
      .slice(0, 10);
    var maxTagCount = topTags.length ? tagFreq[topTags[0]] : 1;

    var years = safeSort(Object.keys(yearCounts), function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
    var maxYearCount = years.reduce(function (m, y) { return Math.max(m, yearCounts[y]); }, 1);
    var avgScore = total ? (scoreSum / total).toFixed(1) : '0';
    var note = total >= MAX_PAGES * 100
      ? '<div class="sk-meta">capped at ' + (MAX_PAGES * 100) + ' most relevant posts to keep this quick &amp; light on the server</div>'
      : '';

    out.innerHTML =
      '<div class="sk-meta">tag: <b style="color:' + C.amber + '">' + esc(tagName) + '</b> · ' +
        '<a href="#" id="sk-goto-search" style="color:' + C.amber + '">← back to results</a></div>' +
      '<div class="sk-stat-block">' +
        '<div><div class="sk-stat-big">' + total + '</div><div class="sk-stat-label">cuts found</div></div>' +
        '<div><div class="sk-stat-big">' + avgScore + '</div><div class="sk-stat-label">avg score</div></div>' +
      '</div>' +
      '<div class="sk-meta">activity by year</div>' +
      '<div class="sk-filmstrip" id="sk-strip"></div>' +
      '<div style="height:18px"></div>' +
      '<div class="sk-meta">most frequent co-tags &mdash; use Search\'s filter grid to narrow by these</div>' +
      '<div class="sk-taglist" id="sk-taglist"></div>' +
      note;

    var strip = out.querySelector('#sk-strip');
    years.forEach(function (y) {
      var f = document.createElement('div');
      f.className = 'sk-frame';
      f.style.height = Math.max(4, (yearCounts[y] / maxYearCount) * 68) + 'px';
      f.innerHTML = '<span class="ct">' + yearCounts[y] + '</span><span class="yr">' + String(y).slice(2) + '</span>';
      strip.appendChild(f);
    });

    var tl = out.querySelector('#sk-taglist');
    topTags.forEach(function (t) {
      var row = document.createElement('div');
      row.className = 'sk-tagrow';
      row.innerHTML =
        '<div class="name" title="' + esc(t) + '">' + esc(t) + '</div>' +
        '<div class="bar"><i style="width:' + ((tagFreq[t] / maxTagCount) * 100) + '%"></i></div>' +
        '<div class="n">' + tagFreq[t] + '</div>';
      tl.appendChild(row);
    });

    out.querySelector('#sk-goto-search').onclick = function (e) {
      e.preventDefault();
      searchViewMode = 'results';
      renderSearchView();
    };
  }

  // ===================== SHOWS TAB =====================
  // Episode grouping is a best-effort parse of each post's free-text `source`
  // field (there's no structured season/episode data in the API) — accurate
  // wherever taggers followed the site's own "Title #12" convention, rougher
  // where they didn't. Show search reuses the same paginated tag dictionary
  // as the hover/filter features, since this fork's name_pattern parameter
  // and limit=0 are both confirmed no-ops — real pagination + client-side
  // filtering is the only approach that's actually been verified to work.
  //
  // Navigation is a simple back/forward history stack, like a browser:
  // each entry is either {type:'results', query, showsList} (a season/title
  // search) or {type:'episodes', showTag, entry, query} (an episode grid).
  var showsCache = {}; // showTag -> { related: [...], pages: { pageNum: pageData } }
  var SHOW_PAGE_SIZE = 100; // Sakugabooru's practical page size for /post.json
  var navStack = [];
  var navIndex = -1;

  function pushNav(snapshot) {
    navStack = navStack.slice(0, navIndex + 1);
    navStack.push(snapshot);
    navIndex = navStack.length - 1;
    renderNavCurrent();
  }
  function goBack() { if (navIndex > 0) { navIndex--; renderNavCurrent(); } }
  function goForward() { if (navIndex < navStack.length - 1) { navIndex++; renderNavCurrent(); } }

  function parseEpisodeKey(source) {
    var s = (source || '').trim();
    if (!s) return { key: 'unsorted', label: 'No source listed', sortNum: 1e9, token: null };
    var m = s.match(/#\s?(\d{1,4})/);
    if (m) return { key: 'ep:' + (+m[1]), label: 'Episode ' + (+m[1]), sortNum: +m[1], token: '#' + (+m[1]) };
    m = s.match(/\bep(?:isode)?\.?\s?(\d{1,4})\b/i);
    if (m) return { key: 'ep:' + (+m[1]), label: 'Episode ' + (+m[1]), sortNum: +m[1], token: '#' + (+m[1]) };
    if (/\bmovie\b/i.test(s)) return { key: 'movie', label: 'Movie', sortNum: 1e6 + 1, token: 'movie' };
    if (/\bova\b/i.test(s)) return { key: 'ova', label: 'OVA', sortNum: 1e6 + 2, token: 'OVA' };
    if (/\b(opening|op\d*)\b/i.test(s)) return { key: 'op', label: 'Opening', sortNum: 1e6 + 3, token: 'OP' };
    if (/\b(ending|ed\d*)\b/i.test(s)) return { key: 'ed', label: 'Ending', sortNum: 1e6 + 4, token: 'ED' };
    if (/\b(pv|trailer)\b/i.test(s)) return { key: 'pv', label: 'PV / Trailer', sortNum: 1e6 + 5, token: 'PV' };
    // Anything else (individual Twitter/X credit links, one-off free text, etc.) isn't a
    // real episode marker — group it all into one bucket instead of one card per unique URL.
    return { key: 'other', label: 'Other / uncategorized', sortNum: 1e6 + 6, token: null };
  }

  function normalizeRelated(resp, showTag) {
    try {
      var arr = Array.isArray(resp) ? resp : (resp && (resp[showTag] || resp.tags)) || [];
      var mapped = safeMap(arr, function (x) {
        if (Array.isArray(x)) return { name: x[0], count: x[1] || 0 };
        if (x && x.name) return { name: x.name, count: x.count || 0 };
        return null;
      });
      return safeFilter(mapped, function (x) { return x && x.name !== showTag; }).slice(0, 8);
    } catch (e) { return []; }
  }

  function buildShowPageData(posts) {
    var groups = {};

    posts.forEach(function (p) {
      var g = parseEpisodeKey(p.source);
      if (!groups[g.key]) {
        groups[g.key] = { label: g.label, sortNum: g.sortNum, token: g.token, count: 0, posts: [] };
      }
      groups[g.key].count++;
      groups[g.key].posts.push(p);
    });

    var episodes = safeSort(
      safeMap(Object.keys(groups), function (k) { return groups[k]; }),
      function (a, b) { return a.sortNum - b.sortNum; }
    );

    return {
      posts: posts,
      totalPosts: posts.length,
      episodes: episodes,
      hasNext: posts.length === SHOW_PAGE_SIZE
    };
  }

  function fetchShowPage(showTag, page, totalCount, orderMode) {
    var mode = orderMode === 'asc' ? 'asc' : 'desc';
    var totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / SHOW_PAGE_SIZE)) : null;
    var apiPage = page;

    // Sakugabooru's existing order:date endpoint is reliable and returns newest first.
    // For "oldest first", turn logical page 1 into the last API page, logical page 2
    // into the second-to-last API page, etc., then reverse the posts within that page.
    if (mode === 'asc' && totalPages) apiPage = totalPages - page + 1;

    return getJSON('/post.json?limit=' + SHOW_PAGE_SIZE + '&page=' + apiPage + '&tags=' + encodeURIComponent(showTag) + '+order:date')
      .then(function (posts) {
        if (mode === 'asc') posts = posts.slice().reverse();
        return buildShowPageData(posts);
      });
  }

  function loadShowPage(showTag, entry, page, orderMode) {
    var mode = orderMode === 'asc' ? 'asc' : 'desc';
    if (!entry.pages[mode]) entry.pages[mode] = {};
    if (entry.pages[mode][page]) return Promise.resolve(entry.pages[mode][page]);

    return fetchShowPage(showTag, page, entry.totalCount, mode).then(function (pageData) {
      entry.pages[mode][page] = pageData;
      return pageData;
    });
  }

  function renderShows() {
    body.innerHTML =
      '<div class="sk-row"><input class="sk-input" id="sk-show-input" placeholder="search a show or movie title"></div>' +
      '<div class="sk-show-nav" id="sk-show-nav" style="display:none">' +
        '<button class="sk-nav-btn" id="sk-nav-back" type="button">← Back</button>' +
        '<span class="sk-nav-crumb" id="sk-nav-crumb"></span>' +
        '<button class="sk-nav-btn" id="sk-nav-forward" type="button">Forward →</button>' +
      '</div>' +
      '<div id="sk-show-content"></div>';

    var input = body.querySelector('#sk-show-input');
    var debounceTimer = null;
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      var q = input.value.trim();
      if (!q) return;
      debounceTimer = setTimeout(function () { searchShowTags(q); }, 300);
    });

    body.querySelector('#sk-nav-back').onclick = goBack;
    body.querySelector('#sk-nav-forward').onclick = goForward;

    // Restore wherever we left off if this tab was visited before this session.
    if (navStack.length) renderNavCurrent();
  }

  function updateNavChrome() {
    var navBar = body.querySelector('#sk-show-nav');
    var backBtn = body.querySelector('#sk-nav-back');
    var fwdBtn = body.querySelector('#sk-nav-forward');
    var crumb = body.querySelector('#sk-nav-crumb');
    if (!navBar || !backBtn || !fwdBtn || !crumb) return;
    if (!navStack.length) { navBar.style.display = 'none'; return; }
    navBar.style.display = 'flex';
    backBtn.disabled = navIndex <= 0;
    fwdBtn.disabled = navIndex >= navStack.length - 1;
    var cur = navStack[navIndex];
    if (cur.type === 'episodes') {
      var page = cur.page || 1;
      var orderLabel = cur.order === 'asc' ? 'oldest first' : 'newest first';
      crumb.textContent = cur.showTag + ' · page ' + page + (cur.entry && cur.entry.totalCount ? ' of ' + Math.max(1, Math.ceil(cur.entry.totalCount / SHOW_PAGE_SIZE)) : '') + ' · ' + orderLabel;
    } else {
      crumb.textContent = '"' + cur.query + '"';
    }
  }

  function renderNavCurrent() {
    updateNavChrome();
    var content = body.querySelector('#sk-show-content');
    var cur = navStack[navIndex];
    var input = body.querySelector('#sk-show-input');
    if (!content || !input) return;
    if (!cur) { content.innerHTML = ''; return; }
    input.value = cur.type === 'episodes' ? cur.showTag : cur.query;
    if (cur.type === 'results') paintShowResults(content, cur.showsList);
    else paintShowDetail(content, cur.showTag, cur.entry, cur.page || 1, cur.order || 'desc');
  }

  function searchShowTags(q) {
    var content = body.querySelector('#sk-show-content');
    content.innerHTML = '<div class="sk-loading">loading tag dictionary…</div>';
    var norm = q.trim().toLowerCase().replace(/\s+/g, '_');

    ensureAllTags(function (n) {
      if (!allTagsList) content.innerHTML = '<div class="sk-loading">loading tag dictionary… (' + n + ' so far)</div>';
    }).then(function (list) {
      if (!list.length) {
        content.innerHTML = '<div class="sk-empty">couldn\'t load sakugabooru\'s tag list right now — try again in a moment</div>';
        return;
      }
      var direct = safeFilter(list, function (t) { return t.type === 3 && t.name.indexOf(norm) !== -1; });
      var showsList = direct;
      if (!showsList.length) {
        // Multi-word query rarely matches one contiguous tag name — try each word.
        var words = safeFilter(norm.split('_'), function (w) { return w.length >= 3; });
        var seen = {};
        showsList = [];
        words.forEach(function (w) {
          list.forEach(function (t) {
            if (t.type === 3 && t.name.indexOf(w) !== -1 && !seen[t.name]) {
              seen[t.name] = true;
              showsList.push(t);
            }
          });
        });
      }
      showsList = safeSort(showsList, function (a, b) { return b.count - a.count; }).slice(0, 15);

      if (!showsList.length) {
        content.innerHTML = '<div class="sk-empty">no tags contain "' + esc(q) +
          '" — sakugabooru search is substring-based, not fuzzy, so try the full ' +
          'romanized title rather than a nickname or abbreviation</div>';
        return;
      }
      pushNav({ type: 'results', query: q, showsList: showsList });
    }).catch(function (err) {
      content.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
    });
  }

  function paintShowResults(content, showsList) {
    content.innerHTML = '';
    showsList.forEach(function (t) {
      var item = document.createElement('div');
      item.className = 'sk-show-pick';
      item.innerHTML = '<span class="name">' + esc(t.name) + '</span><span class="cnt">' + t.count + ' posts</span>';
      item.onclick = function () {
        content.innerHTML = '<div class="sk-loading">loading ' + esc(t.name) + '…</div>';
        getShowEntry(t.name, t.count).then(function (entry) {
          pushNav({ type: 'episodes', showTag: t.name, entry: entry, page: 1, order: 'desc' });
        }).catch(function (err) {
          content.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
        });
      };
      content.appendChild(item);
    });
  }

  function getShowEntry(showTag, totalCount) {
    if (showsCache[showTag]) return Promise.resolve(showsCache[showTag]);

    var relatedPromise = getJSON('/tag/related.json?tags=' + encodeURIComponent(showTag) + '&type=copyright')
      .then(function (r) { return normalizeRelated(r, showTag); })
      .catch(function () { return []; });

    var entry = {
      related: [],
      totalCount: typeof totalCount === 'number' ? totalCount : null,
      pages: { desc: {}, asc: {} }
    };

    return Promise.all([relatedPromise, loadShowPage(showTag, entry, 1, 'desc')]).then(function (res) {
      entry.related = res[0];
      showsCache[showTag] = entry;
      return entry;
    });
  }


  function paintShowDetail(content, showTag, entry, page, orderMode) {
    var pageNum = page || 1;
    var mode = orderMode === 'asc' ? 'asc' : 'desc';
    if (!entry.pages[mode]) entry.pages[mode] = {};
    var pageData = entry.pages[mode][pageNum];

    if (!pageData) {
      content.innerHTML = '<div class="sk-loading">loading page ' + pageNum + '…</div>';
      loadShowPage(showTag, entry, pageNum, mode).then(function () {
        paintShowDetail(content, showTag, entry, pageNum, mode);
      }).catch(function (err) {
        content.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
      });
      return;
    }

    if (!pageData.totalPosts) {
      content.innerHTML = '<div class="sk-empty">no posts found on page ' + pageNum + ' for "' + esc(showTag) + '"</div>';
      return;
    }

    var firstPost = ((pageNum - 1) * SHOW_PAGE_SIZE) + 1;
    var lastPost = firstPost + pageData.totalPosts - 1;

    var totalPages = entry.totalCount ? Math.max(1, Math.ceil(entry.totalCount / SHOW_PAGE_SIZE)) : null;

    content.innerHTML =
      '<div class="sk-show-head"><span class="title">' + esc(showTag) + '</span></div>' +
      '<div class="sk-show-nav sk-show-page-nav" id="sk-show-page-nav">' +
        '<button class="sk-nav-btn" id="sk-show-page-prev" type="button"' +
          (pageNum <= 1 ? ' disabled' : '') + '>← Previous</button>' +
        '<span class="sk-nav-crumb">Page ' + pageNum + (totalPages ? ' of ' + totalPages : '') + ' · posts ' + firstPost + '–' + lastPost + '</span>' +
        '<button class="sk-nav-btn" id="sk-show-page-next" type="button"' +
          ((totalPages && pageNum >= totalPages) || (!totalPages && !pageData.hasNext) ? ' disabled' : '') + '>Next →</button>' +
      '</div>' +
      '<div class="sk-page-jump">' +
        '<span class="sk-page-total">Jump to page</span>' +
        '<input class="sk-page-input" id="sk-show-page-input" type="number" min="1"' +
          (totalPages ? ' max="' + totalPages + '"' : '') +
          ' value="' + pageNum + '">' +
        '<button class="sk-page-go" id="sk-show-page-go" type="button">Go</button>' +
        (totalPages ? '<span class="sk-page-total">/ ' + totalPages + '</span>' : '') +
      '</div>' +
      '<div class="sk-show-order-row">' +
        '<span class="sk-show-order-label">Order</span>' +
        '<select class="sk-show-order-select" id="sk-show-order-select">' +
          '<option value="desc"' + (mode === 'desc' ? ' selected' : '') + '>Newest → Oldest</option>' +
          '<option value="asc"' + (mode === 'asc' ? ' selected' : '') + '>Oldest → Newest</option>' +
        '</select>' +
      '</div>' +
      (entry.related.length
        ? '<div class="sk-related-row" id="sk-related-row"></div>'
        : '') +
      '<div class="sk-caption">Showing ' + pageData.totalPosts + ' posts from page ' + pageNum +
        ' (' + firstPost + '–' + lastPost + ') of ' + (entry.totalCount ? entry.totalCount : '?') + ' ' + esc(showTag) +
        ' results, ' + (mode === 'asc' ? 'oldest first' : 'newest first') + '. Episode grouping is parsed from each post\'s source text using the ' +
        '"Title #12" convention; unrecognized source text is grouped into "Other / uncategorized".</div>' +
      '<div class="sk-ep-grid" id="sk-ep-grid"></div>';

    var prevBtn = content.querySelector('#sk-show-page-prev');
    var nextBtn = content.querySelector('#sk-show-page-next');
    var pageInput = content.querySelector('#sk-show-page-input');
    var pageGo = content.querySelector('#sk-show-page-go');
    var orderSelect = content.querySelector('#sk-show-order-select');

    function goToPage(targetPage) {
      targetPage = parseInt(targetPage, 10);
      if (!isFinite(targetPage)) return;
      if (targetPage < 1) targetPage = 1;
      if (totalPages && targetPage > totalPages) targetPage = totalPages;
      if (targetPage === pageNum) return;
      if (pageInput) pageInput.value = targetPage;
      content.innerHTML = '<div class="sk-loading">loading page ' + targetPage + '…</div>';
      loadShowPage(showTag, entry, targetPage, mode).then(function () {
        var cur = navStack[navIndex];
        if (cur && cur.type === 'episodes') {
          cur.page = targetPage;
          cur.order = mode;
          renderNavCurrent();
        } else {
          paintShowDetail(content, showTag, entry, targetPage, mode);
        }
      }).catch(function (err) {
        content.innerHTML = '<div class="sk-empty">error loading page ' + targetPage + ': ' + esc(err.message) + '</div>';
      });
    }

    orderSelect.onchange = function () {
      var nextMode = orderSelect.value === 'asc' ? 'asc' : 'desc';
      var cur = navStack[navIndex];
      if (cur && cur.type === 'episodes') {
        cur.order = nextMode;
        cur.page = 1;
        renderNavCurrent();
      } else {
        paintShowDetail(content, showTag, entry, 1, nextMode);
      }
    };

    pageGo.onclick = function () { goToPage(pageInput.value); };
    pageInput.onkeydown = function (e) {
      if (e.key === 'Enter') goToPage(pageInput.value);
    };

    prevBtn.onclick = function () {
      if (pageNum <= 1) return;
      goToPage(pageNum - 1);
    };

    nextBtn.onclick = function () {
      if ((totalPages && pageNum >= totalPages) || (!totalPages && !pageData.hasNext)) return;
      nextBtn.disabled = true;
      nextBtn.textContent = 'Loading…';
      goToPage(pageNum + 1);
    };

    if (entry.related.length) {
      var row = content.querySelector('#sk-related-row');
      entry.related.forEach(function (r) {
        var chip = document.createElement('span');
        chip.className = 'sk-chip clickable';
        chip.textContent = r.name + ' (' + r.count + ')';
        chip.onclick = function () {
          content.innerHTML = '<div class="sk-loading">loading ' + esc(r.name) + '…</div>';
          getShowEntry(r.name, r.count).then(function (e2) {
            pushNav({ type: 'episodes', showTag: r.name, entry: e2, page: 1, order: 'desc' });
          }).catch(function (err) {
            content.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
          });
        };
        row.appendChild(chip);
      });
    }

    var grid = content.querySelector('#sk-ep-grid');
    pageData.episodes.forEach(function (ep) {
      var btn = document.createElement('div');
      btn.className = 'sk-ep-btn';
      btn.innerHTML = '<span class="num">' + esc(ep.label) + '</span><span class="cnt">' +
        (ep.token ? ep.count + ' sampled on this page' : ep.count + ' sampled · browse only') + '</span>';
      btn.onclick = function () {
        searchState.order = 'date';
        searchViewMode = 'results';
        sync.artistTag = null; // avoid Search's auto-sync overwriting this specific episode query
        if (ep.token) {
          // A real episode/OP/ED/movie marker — run an actual server search so we get
          // every matching post, not just whatever happened to be on the current page.
          searchState.tags = [showTag, 'source:' + ep.token];
          switchToTab('search');
          runSearch();
        } else {
          // No single query can isolate this bucket (e.g. individual social-media credit
          // links each with a different URL) — show exactly the posts from this page.
          var freq = {};
          ep.posts.forEach(function (p) {
            (p.tags || '').split(/\s+/).forEach(function (t) {
              if (!t || t === showTag) return;
              freq[t] = (freq[t] || 0) + 1;
            });
          });
          var facetTags = safeSort(Object.keys(freq), function (a, b) { return freq[b] - freq[a]; }).slice(0, 24);
          searchState.tags = [showTag];
          searchCache = { tags: [showTag], order: 'date', posts: ep.posts, excluded: {}, facetTags: facetTags, sampledOnly: true };
          switchToTab('search');
        }
      };
      grid.appendChild(btn);
    });
  }


  function renderTab(name) {
    if (name === 'shows') renderShows();
    else renderSearch();
  }

  renderTab('search');
  panel.style.display = 'flex';
})();
