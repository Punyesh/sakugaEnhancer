/*!
 * Sakuga Enhancer — bookmarklet overlay for sakugabooru.com
 * Runs same-origin, hits the site's own Moebooru JSON API (/post.json, /artist.json).
 * No external dependencies, no CDN calls (site CSP may block them anyway).
 */
(function () {
  'use strict';
  console.log('%c[sakuga-enhancer] build SF43 (crf 15 for accurate trim) loaded', 'color:#ffb020;font-weight:bold');

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
    red: '#d9634a',
    link: '#6db3f2'
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
    '.sk-input[type=number]::-webkit-inner-spin-button,',
    '.sk-input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0;}',
    '.sk-input[type=number]{-moz-appearance:textfield;}',
    '.sk-select{background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';',
    'padding:7px 6px;border-radius:4px;font-size:12px;}',
    '.sk-btn{background:' + C.amberDim + ';border:1px solid ' + C.amber + ';color:' + C.amber + ';',
    'padding:7px 12px;border-radius:4px;font-size:12px;cursor:pointer;white-space:nowrap;}',
    '.sk-btn:hover{background:' + C.amber + ';color:#1a1509;}',
    '.sk-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;min-height:0;}',
    '.sk-suggest-list{background:' + C.panel + ';border:1px solid ' + C.line + ';border-radius:6px;',
    'margin-bottom:8px;overflow:hidden;}',
    '.sk-suggest-row{display:flex;justify-content:space-between;align-items:center;',
    'padding:8px 10px;border-top:1px solid ' + C.line + ';cursor:pointer;font-size:12px;}',
    '.sk-suggest-row:first-child{border-top:none;}',
    '.sk-suggest-row:hover{background:' + C.panel2 + ';}',
    '.sk-suggest-count{color:' + C.dim + ';font-size:11px;font-family:monospace;}',
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
    '.sk-mini-chip.show{color:' + C.link + ';}',
    '.sk-mini-chip.clickable{cursor:pointer;}',
    '.sk-mini-chip.clickable:hover{border-color:' + C.amber + ';}',
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
    '.sk-show-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;}',
    '.sk-mini-toggle{background:transparent;border:1px solid ' + C.line + ';color:' + C.dim + ';',
    'padding:3px 9px;border-radius:12px;font-size:10px;cursor:pointer;font-family:inherit;white-space:nowrap;}',
    '.sk-mini-toggle:hover{border-color:' + C.amber + ';color:' + C.amber + ';}',
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
    '.sk-media-box{max-width:760px;width:100%;max-height:90vh;background:' + C.panel + ';border:1px solid ' + C.line + ';',
    'border-radius:8px;overflow-y:auto;overflow-x:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6);}',
    '.sk-media-box video,.sk-media-box img{width:100%;max-height:72vh;display:block;background:#000;',
    'object-fit:contain;}',
    '.sk-media-top{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:8px;padding:8px 10px;background:' + C.panel2 + ';}',
    '.sk-media-viewpost{margin-left:auto;color:' + C.amber + ';font-size:12px;text-decoration:none;',
    'font-family:"Courier New",monospace;}',
    '.sk-media-viewpost:hover{text-decoration:underline;}',
    '.sk-media-close{cursor:pointer;color:' + C.dim + ';font-size:22px;line-height:1;padding:0 2px 2px;}',
    '.sk-login-box{width:100%;max-width:320px;background:' + C.panel + ';border:1px solid ' + C.line + ';',
    'border-radius:8px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.6);}',
    '.sk-login-title{font-size:15px;font-weight:bold;color:' + C.text + ';margin-bottom:12px;}',
    '.sk-login-box .sk-input{width:100%;margin-bottom:8px;}',
    '.sk-login-cancel{display:block;text-align:center;margin-top:10px;color:' + C.dim + ';font-size:12px;cursor:pointer;}',
    '.sk-comment-composer{background:' + C.panel2 + ';border:1px solid ' + C.line + ';border-radius:6px;',
    'padding:8px;margin-bottom:10px;}',
    '.sk-comment-loggedin{display:flex;justify-content:space-between;font-size:11px;color:' + C.dim + ';margin-bottom:6px;}',
    '.sk-comment-logout{color:' + C.red + ';cursor:pointer;}',
    '.sk-comment-textarea{width:100%;background:' + C.bg + ';border:1px solid ' + C.line + ';border-radius:6px;',
    'color:' + C.text + ';padding:6px;font-size:12px;min-height:50px;resize:vertical;margin-bottom:6px;',
    'font-family:inherit;}',
    '.sk-comment-loginlink{color:' + C.amber + ';font-size:12px;font-weight:600;cursor:pointer;margin-bottom:10px;display:inline-block;}',
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
    '.sk-load-more-wrap{text-align:center;margin-top:10px;}',
    '.sk-load-more-wrap .sk-frame-btn{display:inline-block;padding:8px 16px;}',
    '.sk-comments-row{padding:0 10px 8px;border-top:1px solid ' + C.line + ';padding-top:8px;}',
    '.sk-comments-panel{max-height:220px;overflow-y:auto;padding:0 10px 10px;}',
    '.sk-comment{padding:8px 0;border-top:1px solid ' + C.line + ';}',
    '.sk-comment:first-child{border-top:none;}',
    '.sk-comment-head{display:flex;justify-content:space-between;font-size:11px;color:' + C.amber + ';',
    'font-family:"Courier New",monospace;margin-bottom:3px;}',
    '.sk-comment-head span{color:' + C.dim + ';font-weight:normal;}',
    '.sk-comment-body{font-size:12px;color:' + C.text + ';line-height:1.5;white-space:pre-wrap;}',
    '.sk-comment-quote{border-left:3px solid ' + C.line + ';padding:4px 0 4px 8px;margin:4px 0;color:' + C.dim + ';}',
    '.sk-comment-ts{color:' + C.amber + ';cursor:pointer;font-weight:bold;}',
    '.sk-comment-ts:hover{text-decoration:underline;}',
    '.sk-comment-postlink{color:' + C.link + ';cursor:pointer;text-decoration:underline;}',
    '.sk-comment-link{color:' + C.link + ';text-decoration:underline;}',
    '.sk-close:hover{color:' + C.red + ';}',
    // Themed scrollbars for our own scrollable panels — scoped to these specific
    // classes only, since these styles are injected globally into the host page
    // and a broader selector would restyle sakugabooru's own scrollbars too.
    '.sk-body,.sk-comments-panel,.sk-facet-grid,.sk-chipwrap,.sk-media-box{',
    'scrollbar-width:thin;scrollbar-color:' + C.amberDim + ' ' + C.bg + ';}',
    '.sk-body::-webkit-scrollbar,.sk-comments-panel::-webkit-scrollbar,',
    '.sk-facet-grid::-webkit-scrollbar,.sk-chipwrap::-webkit-scrollbar,',
    '.sk-media-box::-webkit-scrollbar{width:8px;}',
    '.sk-body::-webkit-scrollbar-track,.sk-comments-panel::-webkit-scrollbar-track,',
    '.sk-facet-grid::-webkit-scrollbar-track,.sk-chipwrap::-webkit-scrollbar-track,',
    '.sk-media-box::-webkit-scrollbar-track{background:' + C.bg + ';}',
    '.sk-body::-webkit-scrollbar-thumb,.sk-comments-panel::-webkit-scrollbar-thumb,',
    '.sk-facet-grid::-webkit-scrollbar-thumb,.sk-chipwrap::-webkit-scrollbar-thumb,',
    '.sk-media-box::-webkit-scrollbar-thumb{background:' + C.amberDim + ';border-radius:4px;}',
    '.sk-body::-webkit-scrollbar-thumb:hover,.sk-comments-panel::-webkit-scrollbar-thumb:hover,',
    '.sk-facet-grid::-webkit-scrollbar-thumb:hover,.sk-chipwrap::-webkit-scrollbar-thumb:hover,',
    '.sk-media-box::-webkit-scrollbar-thumb:hover{background:' + C.amber + ';}'
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

  // ---------- auth & comment posting ----------
  // Confirmed directly from sakugabooru's own /help/api page: "Simply
  // hashing your plain password will NOT work since Danbooru salts its
  // passwords. The actual string that is hashed is
  // 'er@!$rjiajd0$!dkaopc350!Y%)--your-password--'." This is the classic
  // Danbooru-v1/Moebooru convention this fork inherited — not a modern
  // token-based auth scheme, just what the site itself actually uses.
  var PASSWORD_SALT_PREFIX = 'er@!$rjiajd0$!dkaopc350!Y%)--';
  var PASSWORD_SALT_SUFFIX = '--';
  var CREDENTIALS_KEY = 'sk-enh-credentials';

  function sha1Hex(str) {
    var enc = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-1', enc).then(function (buf) {
      var bytes = new Uint8Array(buf);
      var hex = '';
      for (var i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
      return hex;
    });
  }

  function hashSakugaPassword(password) {
    return sha1Hex(PASSWORD_SALT_PREFIX + password + PASSWORD_SALT_SUFFIX);
  }

  // The raw password is never stored — only the hash, and only in
  // localStorage, since browsers don't offer anything like a native OS
  // keychain. That's a real step down from the mobile app's secure storage,
  // worth knowing even though the principle (store the hash, not the
  // password) is the same.
  function saveCredentials(username, passwordHash) {
    try { localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ username: username, passwordHash: passwordHash })); }
    catch (e) { /* storage full/blocked — non-fatal, login just won't persist */ }
  }
  function getStoredCredentials() {
    try {
      var raw = localStorage.getItem(CREDENTIALS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function clearCredentials() {
    try { localStorage.removeItem(CREDENTIALS_KEY); } catch (e) { /* non-fatal */ }
  }

  function postCommentRaw(postId, bodyText, username, passwordHash) {
    var params = new URLSearchParams();
    params.set('login', username);
    params.set('password_hash', passwordHash);
    params.set('comment[post_id]', String(postId));
    params.set('comment[body]', bodyText);

    return fetch('/comment/create.json', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }).then(function (r) {
      return r.text().then(function (text) {
        var parsed = null;
        try { parsed = JSON.parse(text); } catch (e) { /* non-JSON response — fall through to generic HTTP result */ }
        if (r.ok && (!parsed || parsed.success !== false)) return { success: true };
        return { success: false, reason: (parsed && parsed.reason) || ('HTTP ' + r.status + ': ' + text.slice(0, 200)) };
      });
    });
  }

  function postComment(postId, bodyText, username, passwordHash) {
    return postCommentRaw(postId, bodyText, username, passwordHash).then(function (result) {
      if (!result.success) throw new Error(result.reason || 'failed to post comment');
    });
  }

  // Verifies credentials against the real server WITHOUT posting a visible
  // comment — attempts one on a deliberately out-of-range post id. A
  // confirmed real response shape from this exact endpoint (tested live in
  // the native app build of this same feature) is
  // {"success":false,"reason":"access denied"} for bad credentials — any
  // OTHER failure reason means auth itself succeeded and the failure is
  // just that this post obviously doesn't exist.
  function verifyLogin(username, passwordHash) {
    return postCommentRaw(999999999, '(login verification — safe to ignore if visible)', username, passwordHash)
      .then(function (result) {
        if (result.success) return true;
        var reason = (result.reason || '').toLowerCase();
        return reason.indexOf('denied') === -1;
      });
  }

  // Upvote-only, scoped conservatively — same reasoning as the native app:
  // confirmed the endpoint exists directly from sakugabooru's own
  // /help/api page ("The base URL is /post/vote.xml"), but the exact
  // parameter format isn't backed by the same documentation level as
  // comment-posting was, built against the general Danbooru-family
  // convention (post_vote(post_id, score)) as the best-reasoned guess.
  function voteUp(postId, username, passwordHash) {
    var params = new URLSearchParams();
    params.set('login', username);
    params.set('password_hash', passwordHash);
    params.set('id', String(postId));
    params.set('score', '1');
    return fetch('/post/vote.json', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }).then(function (r) {
      return r.text().then(function (text) {
        var parsed = null;
        try { parsed = JSON.parse(text); } catch (e) { /* non-JSON — fall through to generic HTTP check */ }
        if (r.ok && (!parsed || parsed.success !== false)) return;
        throw new Error((parsed && parsed.reason) || ('HTTP ' + r.status + ': ' + text.slice(0, 200)));
      });
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
  var searchOrigin = null; // e.g. {type:'shows'} — set right before a Shows-originated search, consumed by runSearch
  var statsCache = null;  // { tagName, allPosts }

  // ===================== SEARCH TAB =====================
  var searchState = { tags: [], order: 'score', rating: '' };
  var searchViewMode = 'results'; // 'results' | 'stats'

  function tagsEqual(a, b) {
    return a.length === b.length && safeFilter(a, function (t, i) { return t === b[i]; }).length === a.length;
  }

  function renderSearch() {
    body.innerHTML =
      '<div id="sk-tag-controls">' +
        '<div class="sk-row">' +
          '<input class="sk-input" id="sk-tag-input" placeholder="add tag, enter to confirm">' +
          '<select class="sk-select" id="sk-order">' +
            '<option value="score">top score</option>' +
            '<option value="score_asc">lowest score</option>' +
            '<option value="date">newest</option>' +
            '<option value="id_asc">oldest</option>' +
            '<option value="random">random</option>' +
          '</select>' +
        '</div>' +
        '<div class="sk-chips" id="sk-chips"></div>' +
        '<div class="sk-suggest-list" id="sk-tag-suggestions" style="display:none"></div>' +
        '<div class="sk-row">' +
          '<button class="sk-btn" id="sk-go" style="flex:1">Search</button>' +
        '</div>' +
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

    // Live tag suggestions as you type — reuses the same cached full tag
    // dictionary the Shows tab already builds, just filtered across all tag
    // types instead of only type 3 (shows), no separate fetch mechanism
    // needed. Selecting a suggestion runs the search immediately rather than
    // just adding the chip, since picking a suggestion is how someone
    // finishes specifying what they're looking for — no reason to also
    // require a separate Search tap after. Manually typing a full tag and
    // pressing Enter still just adds a chip without searching, since that
    // path is more often used to string several tags together first.
    var suggestWrap = body.querySelector('#sk-tag-suggestions');
    var suggestDebounce = null;
    input.addEventListener('input', function () {
      clearTimeout(suggestDebounce);
      var q = input.value.trim().toLowerCase().replace(/\s+/g, '_');
      if (!q) { suggestWrap.style.display = 'none'; suggestWrap.innerHTML = ''; return; }
      suggestDebounce = setTimeout(function () {
        ensureAllTags().then(function (list) {
          var matches = safeFilter(list, function (t) { return t.name.indexOf(q) !== -1; });
          matches = safeSort(matches, function (a, b) { return b.count - a.count; }).slice(0, 8);
          if (!matches.length) { suggestWrap.style.display = 'none'; suggestWrap.innerHTML = ''; return; }
          suggestWrap.style.display = 'block';
          suggestWrap.innerHTML = matches.map(function (t) {
            return '<div class="sk-suggest-row" data-name="' + esc(t.name) + '">' +
              '<span>' + esc(t.name) + '</span><span class="sk-suggest-count">' + t.count + '</span></div>';
          }).join('');
          var rows = suggestWrap.querySelectorAll('.sk-suggest-row');
          for (var i = 0; i < rows.length; i++) {
            rows[i].onclick = function (e) {
              var name = e.currentTarget.getAttribute('data-name');
              searchState.tags.push(name);
              input.value = '';
              suggestWrap.style.display = 'none';
              suggestWrap.innerHTML = '';
              renderChips();
              searchViewMode = 'results';
              ensureResultsMarkup();
              runSearch();
            };
          }
        }).catch(function () { /* a failed suggestion lookup just shows nothing, not worth an error banner */ });
      }, 150);
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
    // Tag-search controls only matter in Results mode — showing them in Stats
    // mode too was exactly the "why two search fields" confusion.
    body.querySelector('#sk-tag-controls').style.display = searchViewMode === 'stats' ? 'none' : 'block';

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
      '<div id="sk-back-to-shows" style="display:none"></div>' +
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

  // Shared between the hover-preview dock and the tag section inside an
  // opened clip — both need the same chip rendering (color-coded by type)
  // and the same click-to-search behavior, no reason to duplicate either.
  function buildTagChipsHtml(tags, map) {
    var artistTags = safeFilter(tags, function (t) { return map[t] === 1; });
    var otherTags = safeFilter(tags, function (t) { return map[t] !== 1; });
    function chip(t, extraClass) {
      return '<span class="sk-mini-chip clickable ' + extraClass + '" data-tag="' + esc(t) + '">' + esc(t) + '</span>';
    }
    return '<div class="sk-dock-section">' +
        '<div class="sk-tagblock-label">' + (artistTags.length ? 'Animator' : 'Animator — untagged') + '</div>' +
        '<div class="sk-chipwrap">' +
          (artistTags.length
            ? safeMap(artistTags, function (t) { return chip(t, 'artist'); }).join('')
            : '<span class="sk-mini-chip other">not credited on this post</span>') +
        '</div>' +
      '</div>' +
      '<div class="sk-dock-section">' +
        '<div class="sk-tagblock-label">Tags (' + otherTags.length + ')</div>' +
        '<div class="sk-chipwrap">' +
          safeMap(otherTags, function (t) { return chip(t, map[t] === 3 ? 'show' : 'other'); }).join('') +
        '</div>' +
      '</div>';
  }

  function wireTagChipClicks(container, onNavigate) {
    container.onclick = function (e) {
      var chipEl = e.target.closest && e.target.closest('.sk-mini-chip[data-tag]');
      if (!chipEl) return;
      var tag = chipEl.getAttribute('data-tag');
      searchState.tags = [tag];
      searchViewMode = 'results';
      ensureResultsMarkup();
      runSearch();
      if (onNavigate) onNavigate();
    };
  }

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
      var body = buildTagChipsHtml(tags, map);
      dock.innerHTML = head + '<div class="sk-dock-body">' + body + '</div>';
      wireTagChipClicks(dock);
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

  function performTrim(p, inTime, outTime, statusEl, accurate) {
    return getFfmpegConsent(statusEl)
      .then(function () { return ensureFfmpegLoaded(statusEl); })
      .then(function (ffmpeg) {
        statusEl.textContent = 'reading clip…';
        return fetch(p.file_url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
          var inputName = 'input.' + (p.file_ext || 'webm');
          var outputName = accurate ? 'output.mp4' : 'output.' + (p.file_ext || 'webm');
          var startedAt = Date.now();
          return ffmpeg.writeFile(inputName, new Uint8Array(buf)).then(function () {
            var args;
            if (accurate) {
              statusEl.textContent = 'trimming (re-encoding for frame accuracy — slower)…';
              // `-ss`/`-to` placed AFTER `-i`, with real encoders instead of `-c copy`:
              // stream-copy can only cut on keyframe boundaries since it never decodes
              // the video, so the actual start/end can drift from what was marked.
              // Re-encoding is the only way to land on the exact requested frame —
              // slower and a generation of quality loss, but genuinely frame-accurate.
              args = ['-i', inputName, '-ss', String(inTime), '-to', String(outTime),
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15', '-c:a', 'aac', outputName];
            } else {
              statusEl.textContent = 'trimming (fast mode)…';
              // Fast stream-copy: no decoding, just remuxing existing compressed data —
              // much quicker, but can only cut on the nearest keyframe, so the actual
              // start/end may land a little before/after what was marked.
              args = ['-ss', String(inTime), '-to', String(outTime), '-i', inputName, '-c', 'copy', outputName];
            }
            return ffmpeg.exec(args);
          }).then(function () {
            return ffmpeg.readFile(outputName);
          }).then(function (data) {
            var seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
            statusEl.textContent = 'done in ' + seconds + 's';
            var ext = accurate ? 'mp4' : (p.file_ext || 'webm');
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

  // Splits a raw comment body into alternating quote / non-quote text
  // segments on [quote]...[/quote] markers (case-insensitive, can span
  // multiple lines) — quote segments get their own distinct styling.
  function parseCommentSegments(raw) {
    var segments = [];
    var quoteRe = /\[quote\]([\s\S]*?)\[\/quote\]/gi;
    var lastIndex = 0;
    var m;
    while ((m = quoteRe.exec(raw))) {
      if (m.index > lastIndex) segments.push({ quote: false, text: raw.slice(lastIndex, m.index) });
      segments.push({ quote: true, text: m[1] });
      lastIndex = quoteRe.lastIndex;
    }
    if (lastIndex < raw.length) segments.push({ quote: false, text: raw.slice(lastIndex) });
    return segments;
  }

  // Escapes a text segment, then finds timestamps (M:SS / MM:SS / H:MM:SS),
  // sakugabooru post links, and other URLs, turning each into the
  // appropriate clickable markup. A single combined regex + one replace()
  // pass avoids the double-processing risk of running separate regexes in
  // sequence (a generic-URL pass re-wrapping a post-link span, for example).
  function linkifySegment(text) {
    var escaped = esc(text);
    var re = /(https?:\/\/[^\s]*\/post\/show\/(\d+)[^\s]*)|(\/post\/show\/(\d+)[^\s]*)|(https?:\/\/[^\s<]+)|(\b(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d+)?\b)/g;
    return escaped.replace(re, function (match, fullPostUrl, id1, relPostUrl, id2, plainUrl, timestamp) {
      if (timestamp) {
        return '<span class="sk-comment-ts" data-ts="' + match + '">' + match + '</span>';
      }
      // Strip common trailing punctuation (end-of-sentence periods, closing
      // parens, etc.) that's more likely sentence punctuation than part of
      // the actual URL, so a link doesn't swallow the punctuation after it.
      var stripped = match.replace(/[.,;:!?)\]}'"]+$/, '');
      var trailing = match.slice(stripped.length);
      if (fullPostUrl || relPostUrl) {
        var id = id1 || id2;
        return '<span class="sk-comment-postlink" data-post-id="' + id + '">' + stripped + '</span>' + trailing;
      }
      if (plainUrl) {
        return '<a href="' + stripped + '" target="_blank" rel="noopener" class="sk-comment-link">' + stripped + '</a>' + trailing;
      }
      return match;
    });
  }

  function renderCommentBody(raw) {
    var segments = parseCommentSegments(raw);
    var html = '';
    segments.forEach(function (seg) {
      var inner = linkifySegment(seg.text).replace(/\n/g, '<br>');
      html += seg.quote ? '<div class="sk-comment-quote">' + inner + '</div>' : inner;
    });
    return html;
  }

  // M:SS / MM:SS / H:MM:SS -> total seconds. Each ':'-separated part
  // multiplies the running total by 60 and adds the next part.
  function parseTimestampToSeconds(ts) {
    var parts = ts.split(':');
    var seconds = 0;
    for (var i = 0; i < parts.length; i++) seconds = seconds * 60 + parseFloat(parts[i]);
    return isNaN(seconds) ? null : seconds;
  }

  // Fetches a post by id and opens it in a new modal on top of whatever's
  // currently open — the in-app equivalent of a comment's post link, rather
  // than navigating the browser tab away to view it on the actual site.
  function openPostById(id) {
    getJSON('/post.json?tags=' + encodeURIComponent('id:' + id) + '&limit=1').then(function (posts) {
      var p = posts && posts[0];
      if (!p) { alert('post #' + id + ' not found'); return; }
      if (isVideoFile(p.file_url)) openVideoModal(p); else openImageModal(p);
    }).catch(function (err) {
      alert('failed to open post: ' + err.message);
    });
  }

  function renderComments(panel, comments, vid) {
    if (!comments || !comments.length) {
      panel.innerHTML = '<div class="sk-empty" style="padding:10px 0">no comments yet</div>';
      return;
    }
    var html = '';
    comments.forEach(function (c) {
      var name = esc(c.creator || (c.creator_id ? 'user #' + c.creator_id : 'anonymous'));
      var body = renderCommentBody(c.body || c.comment || '');
      var when = formatCommentDate(c.created_at);
      html += '<div class="sk-comment">' +
        '<div class="sk-comment-head"><b>' + name + '</b><span>' + when + '</span></div>' +
        '<div class="sk-comment-body">' + body + '</div>' +
      '</div>';
    });
    panel.innerHTML = html;

    // Event delegation rather than per-element listeners — the panel gets
    // fully replaced via innerHTML above, so individual listeners would
    // need re-wiring on every render anyway.
    panel.onclick = function (e) {
      var tsEl = e.target.closest && e.target.closest('.sk-comment-ts');
      if (tsEl) {
        var seconds = parseTimestampToSeconds(tsEl.getAttribute('data-ts'));
        if (seconds !== null && vid) {
          vid.currentTime = Math.min(seconds, vid.duration || seconds);
          vid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      var linkEl = e.target.closest && e.target.closest('.sk-comment-postlink');
      if (linkEl) {
        var id = linkEl.getAttribute('data-post-id');
        if (id) openPostById(Number(id));
      }
    };
  }


  function openLoginModal(onSuccess) {
    var backdrop = document.createElement('div');
    backdrop.className = 'sk-media-backdrop';
    var box = document.createElement('div');
    box.className = 'sk-login-box';
    box.innerHTML =
      '<div class="sk-login-title">Log In</div>' +
      '<input class="sk-input" id="sk-login-user" placeholder="username" autocomplete="username">' +
      '<input class="sk-input" id="sk-login-pass" type="password" placeholder="password" autocomplete="current-password">' +
      '<button class="sk-btn" id="sk-login-submit" style="width:100%">Log In</button>' +
      '<div class="sk-action-status" id="sk-login-status"></div>' +
      '<span class="sk-login-cancel" id="sk-login-cancel">cancel</span>';
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    function close() {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    box.querySelector('#sk-login-cancel').onclick = close;

    var userInput = box.querySelector('#sk-login-user');
    var passInput = box.querySelector('#sk-login-pass');
    var statusEl = box.querySelector('#sk-login-status');
    var submitBtn = box.querySelector('#sk-login-submit');

    function submit() {
      var username = userInput.value.trim();
      var password = passInput.value;
      if (!username || !password) return;
      submitBtn.disabled = true;
      statusEl.textContent = 'checking…';
      hashSakugaPassword(password).then(function (hash) {
        return verifyLogin(username, hash).then(function (ok) {
          if (!ok) {
            statusEl.textContent = 'username or password is incorrect';
            submitBtn.disabled = false;
            return;
          }
          saveCredentials(username, hash);
          close();
          onSuccess({ username: username, passwordHash: hash });
        });
      }).catch(function (err) {
        statusEl.textContent = 'login failed: ' + err.message;
        submitBtn.disabled = false;
      });
    }
    submitBtn.onclick = submit;
    passInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    userInput.focus();
  }

  function renderCommentComposer(container, p, onPosted) {
    var creds = getStoredCredentials();
    if (!creds) {
      container.innerHTML = '<span class="sk-comment-loginlink" id="sk-login-open">Log in to comment</span>';
      container.querySelector('#sk-login-open').onclick = function () {
        openLoginModal(function () { renderCommentComposer(container, p, onPosted); });
      };
      return;
    }
    container.innerHTML =
      '<div class="sk-comment-composer">' +
        '<div class="sk-comment-loggedin"><span>logged in as ' + esc(creds.username) + '</span>' +
        '<span class="sk-comment-logout" id="sk-comment-logout">log out</span></div>' +
        '<textarea class="sk-comment-textarea" id="sk-comment-text" placeholder="write a comment…"></textarea>' +
        '<button class="sk-btn" id="sk-comment-post" style="width:100%">Post Comment</button>' +
        '<div class="sk-action-status" id="sk-comment-status"></div>' +
      '</div>';
    container.querySelector('#sk-comment-logout').onclick = function () {
      clearCredentials();
      renderCommentComposer(container, p, onPosted);
    };
    var textArea = container.querySelector('#sk-comment-text');
    var postBtn = container.querySelector('#sk-comment-post');
    var statusEl = container.querySelector('#sk-comment-status');
    postBtn.onclick = function () {
      var body = textArea.value.trim();
      if (!body) return;
      postBtn.disabled = true;
      statusEl.textContent = 'posting…';
      postComment(p.id, body, creds.username, creds.passwordHash).then(function () {
        textArea.value = '';
        statusEl.textContent = '';
        postBtn.disabled = false;
        onPosted();
      }).catch(function (err) {
        statusEl.textContent = 'failed to post: ' + err.message;
        postBtn.disabled = false;
      });
    };
  }

  // Tags weren't visible anywhere inside an actually-opened clip before —
  // only via the separate hover-preview dock shown before opening. This
  // puts the same color-coded, clickable chip display directly in the
  // modal itself, reusing the exact same rendering/click logic.
  function addTagsSection(box, p) {
    var container = document.createElement('div');
    container.className = 'sk-dock-body';
    container.style.borderTop = '1px solid ' + C.line;
    container.innerHTML = '<div class="sk-loading" style="padding:8px 0">loading tag info…</div>';
    box.appendChild(container);

    var tags = safeFilter((p.tags || '').split(/\s+/), function (t) { return !!t; });
    ensureTagTypes().then(function (map) {
      container.innerHTML = buildTagChipsHtml(tags, map);
      // Unlike the hover dock (where nothing is covering the results, so
      // updating search state in the background is fine), this is inside an
      // open modal — leaving it open after the tag click meant the person
      // never actually saw the new results, and the modal's own now-stale
      // tag chips just sat there unchanged. Close it so the search that just
      // ran is immediately visible.
      wireTagChipClicks(container, function () { box._close(); });
    });
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

    var composerDiv = document.createElement('div');
    panel.appendChild(composerDiv);
    var listDiv = document.createElement('div');
    panel.appendChild(listDiv);

    var vid = box.querySelector('video'); // null for image posts — renderComments handles that gracefully
    function loadComments() {
      listDiv.innerHTML = '<div class="sk-loading" style="padding:10px 0">loading comments…</div>';
      getJSON('/comment.json?post_id=' + p.id).then(function (comments) {
        renderComments(listDiv, Array.isArray(comments) ? comments : null, vid);
      }).catch(function (err) {
        listDiv.innerHTML = '<div class="sk-empty" style="padding:10px 0">couldn\'t load comments — ' + esc(err.message) + '</div>';
      });
    }

    var loaded = false;
    row.querySelector('#sk-comments-toggle').onclick = function () {
      var showing = panel.style.display !== 'none';
      panel.style.display = showing ? 'none' : 'block';
      if (showing) return;
      renderCommentComposer(composerDiv, p, loadComments); // cheap to re-render each open; keeps login state current
      if (loaded) return;
      loaded = true;
      loadComments();
    };
  }

  function buildMediaShell(p) {
    var backdrop = document.createElement('div');
    backdrop.className = 'sk-media-backdrop';
    var box = document.createElement('div');
    box.className = 'sk-media-box';
    box.innerHTML =
      '<div class="sk-media-top">' +
        '<span class="sk-badge score" id="sk-vote-badge" style="cursor:pointer">▲ ' + (p.score || 0) + '</span>' +
        '<span class="sk-badge">' + esc(p.rating || '?') + '</span>' +
        '<a href="/post/show/' + p.id + '" target="_blank" rel="noopener" class="sk-media-viewpost">view post ↗</a>' +
        '<span class="sk-media-viewpost" id="sk-copy-link" style="cursor:pointer;margin-left:8px" title="copy a link to this post">🔗 copy link</span>' +
        '<span class="sk-media-close" id="sk-media-close" title="close">&times;</span>' +
      '</div>';
    backdrop.appendChild(box);
    document.body.appendChild(backdrop); // attach to the real page body so it overlays everything, not just our small panel

    var voted = false;
    var voteBadge = box.querySelector('#sk-vote-badge');
    voteBadge.onclick = function () {
      if (voted) return;
      var creds = getStoredCredentials();
      if (!creds) { openLoginModal(function () { voteBadge.onclick(); }); return; }
      voteBadge.textContent = '…';
      voteUp(p.id, creds.username, creds.passwordHash).then(function () {
        return getJSON('/post.json?tags=' + encodeURIComponent('id:' + p.id) + '&limit=1');
      }).then(function (posts) {
        var fresh = posts && posts[0];
        voted = true;
        voteBadge.textContent = '✓ ' + (fresh ? fresh.score : (p.score || 0) + 1);
        voteBadge.style.cursor = 'default';
      }).catch(function (err) {
        voteBadge.textContent = '▲ ' + (p.score || 0);
        alert('vote failed: ' + err.message);
      });
    };

    var copyLinkBtn = box.querySelector('#sk-copy-link');
    copyLinkBtn.onclick = function () {
      var url = location.origin + '/post/show/' + p.id;
      var originalText = copyLinkBtn.textContent;
      function showCopied() {
        copyLinkBtn.textContent = '✓ copied';
        setTimeout(function () { copyLinkBtn.textContent = originalText; }, 1500);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(showCopied).catch(function () { prompt('copy this link:', url); });
      } else {
        prompt('copy this link:', url);
      }
    };

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
    box._close = close; // lets content appended to the box (e.g. a clicked tag) trigger a real close
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
    // ffmpeg.wasm (loaded on first use, see below) — a real re-encode, not a
    // stream copy, since stream-copy can only cut on keyframe boundaries and
    // frame-accurate trimming needs an actual decode/re-encode of the range.
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

    var accuracyRow = document.createElement('div');
    accuracyRow.className = 'sk-trim-row';
    accuracyRow.innerHTML =
      '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:' + C.dim + ';cursor:pointer">' +
        '<input type="checkbox" id="sk-accurate-trim" style="accent-color:' + C.amber + '">' +
        'frame-accurate (re-encodes — slower, but exact; unchecked is a fast copy that may drift a few frames)' +
      '</label>';
    box.appendChild(accuracyRow);

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
    var accurateCheckbox = accuracyRow.querySelector('#sk-accurate-trim');

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
      performTrim(p, inTime, outTime, statusEl, accurateCheckbox.checked).then(function (res) {
        triggerBlobDownload(res.blob, 'sakuga_' + p.id + '_trim.' + res.ext);
        updateTrimBtn();
      }).catch(function (err) {
        if (err.message !== 'cancelled') statusEl.textContent = 'trim failed: ' + err.message;
        updateTrimBtn();
      });
    };

    addTagsSection(box, p);
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

    addTagsSection(box, p);
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
    var backWrap = body.querySelector('#sk-back-to-shows');

    if (cache.origin && cache.origin.type === 'shows') {
      backWrap.style.display = 'block';
      backWrap.innerHTML = '<a href="#" id="sk-back-to-shows-link" class="sk-mini-toggle" style="display:inline-block;margin-bottom:8px">← back to episode list</a>';
      backWrap.querySelector('#sk-back-to-shows-link').onclick = function (e) {
        e.preventDefault();
        switchToTab('shows');
      };
    } else {
      backWrap.style.display = 'none';
      backWrap.innerHTML = '';
    }

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

      if (cache.hasMore || cache.loadMoreError) {
        var moreWrap = document.createElement('div');
        moreWrap.className = 'sk-load-more-wrap';
        if (cache.loadMoreError) {
          moreWrap.innerHTML = '<div class="sk-empty">couldn\'t load more: ' + esc(cache.loadMoreError) + '</div>' +
            '<button class="sk-frame-btn" id="sk-load-more">retry</button>';
        } else {
          moreWrap.innerHTML = '<button class="sk-frame-btn" id="sk-load-more"' +
            (cache.loadingMore ? ' disabled' : '') + '>' +
            (cache.loadingMore ? 'loading…' : 'Load more (' + cache.posts.length + ' so far)') + '</button>';
        }
        moreWrap.querySelector('#sk-load-more').onclick = function () { loadMoreResults(cache); };
        results.appendChild(moreWrap);
      }
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
    var PAGE_SIZE = 24;

    return getJSON('/post.json?limit=' + PAGE_SIZE + '&tags=' + encodeURIComponent(tagQuery.trim()))
      .then(function (posts) {
        searchCache = {
          tags: tagsSnapshot, order: orderSnapshot, posts: posts, excluded: {},
          facetTags: computeFacetTags(posts, tagsSnapshot),
          page: 1, pageSize: PAGE_SIZE, hasMore: posts.length === PAGE_SIZE, loadingMore: false,
          origin: searchOrigin
        };
        searchOrigin = null; // consumed — only applies to the search that was pending when set
        paintSearchResults(searchCache);

        // Figure out if this query is "about" a specific animator, so Stats can sync to it.
        ensureTagTypes().then(function (map) {
          var found = safeFilter(tagsSnapshot, function (t) { return map[t] === 1; })[0] || null;
          sync.artistTag = found;
          var statsBtn = body.querySelector('#sk-mode-stats');
          if (statsBtn) statsBtn.textContent = sync.artistTag ? '📊 Stats: ' + sync.artistTag : '📊 Animator Stats';
        });
        return posts.length;
      })
      .catch(function (err) {
        results.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
      });
  }

  // Different shows' taggers use different, unpredictable source-text conventions
  // ("#357" vs "#0357" zero-padded vs "Episode 357" vs bare "357"), and even the
  // exact matching behavior of the site's own source: search isn't fully known
  // (a confirmed real case: "#0357" matched neither "#357" nor bare "357" — so
  // it isn't a simple raw substring match either). Rather than guess once, try
  // several realistic candidates in order and stop at the first that hits.
  function buildEpisodeCandidates(num, observedToken) {
    var plain = String(num);
    var pad3 = plain.length < 3 ? ('00' + plain).slice(-3) : plain;
    var pad4 = plain.length < 4 ? ('000' + plain).slice(-4) : plain;
    var seen = {};
    var out = [];
    function add(tok) { if (tok && !seen[tok]) { seen[tok] = true; out.push(tok); } }
    add(observedToken); // the exact raw text we actually saw, if we have it — try this first
    [plain, pad3, pad4].forEach(function (r) { add('#' + r); add(r); });
    return out;
  }

  function searchEpisodeWithFallback(showTag, candidates) {
    searchState.order = 'date';
    searchViewMode = 'results';
    sync.artistTag = null;
    var i = 0;
    function tryNext() {
      if (i >= candidates.length) return;
      searchState.tags = [showTag, 'source:' + candidates[i]];
      searchOrigin = { type: 'shows', showTag: showTag };
      if (i === 0) { switchToTab('search'); } else { renderChips(); }
      var attempt = i;
      runSearch().then(function (count) {
        if (count === 0 && attempt + 1 < candidates.length) {
          i = attempt + 1;
          tryNext();
        }
      });
    }
    tryNext();
  }

  function searchEpisodeNumber(showTag, num) {
    searchEpisodeWithFallback(showTag, buildEpisodeCandidates(num, null));
  }

  function computeFacetTags(posts, tagsSnapshot) {
    var freq = {};
    posts.forEach(function (p) {
      (p.tags || '').split(/\s+/).forEach(function (t) {
        if (!t || tagsSnapshot.indexOf(t) !== -1) return;
        freq[t] = (freq[t] || 0) + 1;
      });
    });
    return safeSort(Object.keys(freq), function (a, b) { return freq[b] - freq[a]; }).slice(0, 24);
  }

  function loadMoreResults(cache) {
    if (cache.loadingMore || !cache.hasMore) return;
    cache.loadingMore = true;
    paintSearchResults(cache); // repaint immediately so the button shows a loading state
    var nextPage = cache.page + 1;
    var tagQuery = cache.tags.join(' ') + ' order:' + cache.order;
    getJSON('/post.json?limit=' + cache.pageSize + '&page=' + nextPage + '&tags=' + encodeURIComponent(tagQuery.trim()))
      .then(function (posts) {
        cache.posts = cache.posts.concat(posts);
        cache.page = nextPage;
        cache.hasMore = posts.length === cache.pageSize;
        cache.loadingMore = false;
        cache.facetTags = computeFacetTags(cache.posts, cache.tags);
        paintSearchResults(cache);
      })
      .catch(function (err) {
        cache.loadingMore = false;
        cache.loadMoreError = err.message;
        paintSearchResults(cache);
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
      '<div class="sk-meta" title="Based on when each post was added/tagged on sakugabooru, not when the original episode aired — a 2005 cut uploaded in 2021 shows up as 2021 here.">upload year ⓘ</div>' +
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
  var showsCache = {}; // showTag -> { totalSampled, related: [...], episodes: [...] }
  var SHOW_SAMPLE_PAGES = 3; // politeness cap: sample up to 300 posts to build the episode index
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
    if (m) return { key: 'ep:' + (+m[1]), label: 'Episode ' + (+m[1]), sortNum: +m[1], token: '#' + m[1] };
    m = s.match(/\bep(?:isode)?\.?\s?(\d{1,4})\b/i);
    if (m) return { key: 'ep:' + (+m[1]), label: 'Episode ' + (+m[1]), sortNum: +m[1], token: '#' + m[1] };
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
    if (!navStack.length) { navBar.style.display = 'none'; return; }
    navBar.style.display = 'flex';
    backBtn.disabled = navIndex <= 0;
    fwdBtn.disabled = navIndex >= navStack.length - 1;
    var cur = navStack[navIndex];
    crumb.textContent = cur.type === 'episodes' ? cur.showTag : ('"' + cur.query + '"');
  }

  function renderNavCurrent() {
    updateNavChrome();
    var content = body.querySelector('#sk-show-content');
    var cur = navStack[navIndex];
    var input = body.querySelector('#sk-show-input');
    if (!cur) { content.innerHTML = ''; return; }
    input.value = cur.type === 'episodes' ? cur.showTag : cur.query;
    if (cur.type === 'results') paintShowResults(content, cur.showsList);
    else paintShowDetail(content, cur.showTag, cur.entry);
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
        getShowEntry(t.name).then(function (entry) {
          pushNav({ type: 'episodes', showTag: t.name, entry: entry });
        }).catch(function (err) {
          content.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
        });
      };
      content.appendChild(item);
    });
  }

  function getShowEntry(showTag, targetPages) {
    targetPages = targetPages || SHOW_SAMPLE_PAGES;
    var cached = showsCache[showTag];
    if (cached && (cached.pagesFetched >= targetPages || cached.exhausted)) return Promise.resolve(cached);

    var startPage = cached ? cached.pagesFetched + 1 : 1;
    var priorPosts = cached ? cached.posts : [];
    var relatedPromise = cached ? Promise.resolve(cached.related) :
      getJSON('/tag/related.json?tags=' + encodeURIComponent(showTag) + '&type=copyright')
        .then(function (r) { return normalizeRelated(r, showTag); })
        .catch(function () { return []; });

    var newPosts = [];
    var reachedEnd = false;
    function fetchPage(page) {
      return getJSON('/post.json?limit=100&page=' + page + '&tags=' + encodeURIComponent(showTag) + '+order:date')
        .then(function (batch) {
          newPosts = newPosts.concat(batch);
          if (batch.length < 100) { reachedEnd = true; return; } // genuinely out of posts, not just hit our cap
          if (page < targetPages) {
            return sleep(PAGE_DELAY).then(function () { return fetchPage(page + 1); });
          }
        });
    }

    return Promise.all([relatedPromise, fetchPage(startPage)]).then(function (res) {
      var related = res[0];
      var allPosts = priorPosts.concat(newPosts);
      if (!allPosts.length) return { totalSampled: 0, related: related, episodes: [], posts: [], pagesFetched: targetPages, exhausted: reachedEnd };
      var groups = {};
      allPosts.forEach(function (p) {
        var g = parseEpisodeKey(p.source);
        if (!groups[g.key]) groups[g.key] = { label: g.label, sortNum: g.sortNum, token: g.token, count: 0, posts: [] };
        groups[g.key].count++;
        groups[g.key].posts.push(p);
      });
      var episodes = safeSort(safeMap(Object.keys(groups), function (k) { return groups[k]; }),
        function (a, b) { return a.sortNum - b.sortNum; });
      var entry = {
        totalSampled: allPosts.length, related: related, episodes: episodes,
        posts: allPosts, pagesFetched: targetPages, exhausted: reachedEnd
      };
      showsCache[showTag] = entry;
      return entry;
    });
  }

  function paintShowDetail(content, showTag, entry) {
    window.__skDebugShowEntry = entry; // debug hook — inspect real source text in console, see README
    if (!entry.totalSampled) {
      content.innerHTML = '<div class="sk-empty">no posts sampled for "' + esc(showTag) + '"</div>';
      return;
    }
    content.innerHTML =
      '<div class="sk-show-head">' +
        '<span class="title">' + esc(showTag) + '</span>' +
        (entry.related.length ? '<button class="sk-mini-toggle" id="sk-related-toggle">related (' + entry.related.length + ') ▾</button>' : '') +
        '<button class="sk-mini-toggle" id="sk-info-toggle">ⓘ how this works</button>' +
      '</div>' +
      (entry.related.length ? '<div class="sk-related-row" id="sk-related-row" style="display:none"></div>' : '') +
      '<div class="sk-caption" id="sk-show-info" style="display:none">episode grouping below is parsed from each post\'s source text (the ' +
        '"Title #12" convention), sampled from the ' + entry.totalSampled + ' most <b>recently tagged</b> posts — ' +
        'not chronological by episode, so which numbers show up is down to tagging activity, not air order ' +
        '(that\'s why the list might skip straight from Episode 357 to 1056 instead of starting at 1). ' +
        'Anything that isn\'t a recognizable episode/OP/ED/movie marker (like individual social-media credit ' +
        'links) gets grouped into one "Other" bucket. For a specific known episode, use the jump box below — ' +
        'it searches directly rather than relying on this sample.</div>' +
      '<div class="sk-row">' +
        '<input class="sk-input" id="sk-ep-jump" type="number" min="1" placeholder="know the episode number? jump straight to it, e.g. 1000">' +
        '<button class="sk-btn" id="sk-ep-jump-go">Go</button>' +
      '</div>' +
      '<div class="sk-ep-grid" id="sk-ep-grid"></div>' +
      '<div class="sk-load-more-wrap" id="sk-scan-more-wrap"></div>';

    if (entry.related.length) {
      content.querySelector('#sk-related-toggle').onclick = function () {
        var row = content.querySelector('#sk-related-row');
        var open = row.style.display !== 'none';
        row.style.display = open ? 'none' : 'flex';
        this.textContent = 'related (' + entry.related.length + ') ' + (open ? '▾' : '▴');
      };
    }
    content.querySelector('#sk-info-toggle').onclick = function () {
      var info = content.querySelector('#sk-show-info');
      var open = info.style.display !== 'none';
      info.style.display = open ? 'none' : 'block';
    };

    content.querySelector('#sk-ep-jump-go').onclick = function () {
      var input = content.querySelector('#sk-ep-jump');
      var num = parseInt(input.value, 10);
      if (!num || num < 1) return;
      searchEpisodeNumber(showTag, num);
    };
    content.querySelector('#sk-ep-jump').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') content.querySelector('#sk-ep-jump-go').click();
    });

    if (entry.related.length) {
      var row = content.querySelector('#sk-related-row');
      entry.related.forEach(function (r) {
        var chip = document.createElement('span');
        chip.className = 'sk-chip clickable';
        chip.textContent = r.name + ' (' + r.count + ')';
        chip.onclick = function () {
          content.innerHTML = '<div class="sk-loading">loading ' + esc(r.name) + '…</div>';
          getShowEntry(r.name).then(function (e2) {
            pushNav({ type: 'episodes', showTag: r.name, entry: e2 });
          }).catch(function (err) {
            content.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
          });
        };
        row.appendChild(chip);
      });
    }

    var grid = content.querySelector('#sk-ep-grid');
    entry.episodes.forEach(function (ep) {
      var btn = document.createElement('div');
      btn.className = 'sk-ep-btn';
      btn.innerHTML = '<span class="num">' + esc(ep.label) + '</span><span class="cnt">' +
        (ep.token ? ep.count + ' sampled' : ep.count + ' sampled · browse only') + '</span>';
      btn.onclick = function () {
        searchState.order = 'date';
        searchViewMode = 'results';
        sync.artistTag = null; // avoid Search's auto-sync overwriting this specific episode query
        if (ep.token && ep.sortNum < 1e6) {
          // A numbered episode — try the exact text we actually observed first,
          // then fall back through likely alternate formats (see buildEpisodeCandidates).
          searchEpisodeWithFallback(showTag, buildEpisodeCandidates(ep.sortNum, ep.token));
        } else if (ep.token) {
          // OP/ED/Movie/OVA/PV — a fixed word, not a number, so no fallback needed.
          searchState.tags = [showTag, 'source:' + ep.token];
          searchOrigin = { type: 'shows', showTag: showTag };
          switchToTab('search');
          runSearch();
        } else {
          // No single query can isolate this bucket (e.g. individual social-media credit
          // links each with a different URL) — show exactly the posts we already sampled
          // instead of pretending we can search for them.
          var freq = {};
          ep.posts.forEach(function (p) {
            (p.tags || '').split(/\s+/).forEach(function (t) {
              if (!t || t === showTag) return;
              freq[t] = (freq[t] || 0) + 1;
            });
          });
          var facetTags = safeSort(Object.keys(freq), function (a, b) { return freq[b] - freq[a]; }).slice(0, 24);
          searchState.tags = [showTag];
          searchCache = {
            tags: [showTag], order: 'date', posts: ep.posts, excluded: {}, facetTags: facetTags,
            sampledOnly: true, origin: { type: 'shows', showTag: showTag }
          };
          switchToTab('search');
        }
      };
      grid.appendChild(btn);
    });

    var scanWrap = content.querySelector('#sk-scan-more-wrap');
    function renderScanButton() {
      if (entry.exhausted) {
        scanWrap.innerHTML = '<div class="sk-caption">sampled this show\'s entire post history — nothing more to scan</div>';
        return;
      }
      scanWrap.innerHTML = '<button class="sk-frame-btn" id="sk-scan-more">' +
        'scan further back (+300 more posts, currently ' + entry.totalSampled + ')</button>';
      scanWrap.querySelector('#sk-scan-more').onclick = function () {
        scanWrap.innerHTML = '<div class="sk-loading">scanning further back… (may take a few seconds)</div>';
        getShowEntry(showTag, (entry.pagesFetched || SHOW_SAMPLE_PAGES) + 3).then(function (deeperEntry) {
          if (navStack[navIndex] && navStack[navIndex].type === 'episodes' && navStack[navIndex].showTag === showTag) {
            navStack[navIndex].entry = deeperEntry;
          }
          paintShowDetail(content, showTag, deeperEntry);
        }).catch(function (err) {
          scanWrap.innerHTML = '<div class="sk-empty">couldn\'t scan further: ' + esc(err.message) + '</div>';
        });
      };
    }
    renderScanButton();
  }

  function renderTab(name) {
    if (name === 'shows') renderShows();
    else renderSearch();
  }

  renderTab('search');
  panel.style.display = 'flex';
})();
