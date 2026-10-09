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
    '#sk-enh-toggle{position:relative;z-index:2;width:52px;height:52px;border-radius:50%;background:' + C.panel + ';',
    'border:1px solid ' + C.line + ';color:' + C.amber + ';font-size:20px;cursor:pointer;',
    'box-shadow:0 4px 18px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;',
    'font-family:"Courier New",monospace;letter-spacing:-1px;}',
    '#sk-enh-toggle:hover{border-color:' + C.amber + ';}',
    '#sk-enh-panel{position:fixed;z-index:1;background:' + C.panel + ';border:1px solid ' + C.line + ';border-radius:6px;',
    'box-shadow:0 12px 40px rgba(0,0,0,.6);display:flex;flex-direction:column;overflow:hidden;}',
    '#sk-enh-head{display:flex;align-items:center;justify-content:space-between;',
    'padding:10px 12px;border-bottom:1px solid ' + C.line + ';background:' + C.panel2 + ';',
    'cursor:move;user-select:none;touch-action:none;}',
    '#sk-enh-head .brand{font-family:"Courier New",monospace;font-size:12px;color:' + C.dim + ';letter-spacing:1px;}',
    '#sk-enh-head .brand b{color:' + C.amber + ';}',
    '.sk-icon-btn{width:24px;height:24px;border-radius:5px;border:1px solid ' + C.line + ';',
    'background:transparent;color:' + C.dim + ';display:flex;align-items:center;justify-content:center;',
    'cursor:pointer;font-size:13px;line-height:1;padding:0;font-family:inherit;}',
    '.sk-icon-btn:hover:not(:disabled){border-color:' + C.amber + ';color:' + C.amber + ';}',
    '.sk-icon-btn.active{background:' + C.amberDim + ';border-color:' + C.amber + ';color:' + C.amber + ';}',
    '.sk-icon-btn:disabled{opacity:.35;cursor:default;}',
    '.sk-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:5px 1px;}',
    '.sk-toggle-label{font-size:12px;color:' + C.text + ';}',
    '.sk-mad-tag{font-size:10px;color:' + C.dim + ';font-weight:normal;font-style:italic;margin-left:2px;}',
    '.sk-dropzone{border:1.5px dashed ' + C.line + ';border-radius:6px;padding:14px 10px;text-align:center;',
      'font-size:12px;color:' + C.dim + ';cursor:pointer;transition:border-color .15s,background .15s,color .15s;}',
    '.sk-dropzone:hover{border-color:' + C.amber + ';color:' + C.text + ';}',
    '.sk-dropzone.is-dragover{border-color:' + C.amber + ';background:' + C.panel2 + ';color:' + C.text + ';}',
    '.sk-section-label{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:' + C.dim + ';',
      'margin:14px 0 8px;padding-top:10px;border-top:1px solid ' + C.line + ';}',
    '.sk-section-label:first-child{margin-top:0;padding-top:0;border-top:none;}',
    '.sk-subpanel{border-left:2px solid ' + C.line + ';padding:8px 0 2px 10px;margin:2px 0 10px;}',
    '.sk-subdivider{border-top:1px solid ' + C.line + ';margin:10px 0;padding-top:10px;}',

    '.sk-toggle-switch{position:relative;width:32px;height:17px;border-radius:9px;flex-shrink:0;',
    'background:' + C.line + ';cursor:pointer;transition:background .15s ease;}',
    '.sk-toggle-switch.active{background:' + C.amberDim + ';}',
    '.sk-toggle-knob{position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;',
    'background:' + C.dim + ';transition:left .15s ease,background .15s ease;}',
    '.sk-toggle-switch.active .sk-toggle-knob{left:17px;background:' + C.amber + ';}',
    '.sk-resize-corner{position:absolute;width:14px;height:14px;z-index:5;touch-action:none;}',
    '.sk-resize-corner.nw{top:0;left:0;cursor:nwse-resize;}',
    '.sk-resize-corner.ne{top:0;right:0;cursor:nesw-resize;}',
    '.sk-resize-corner.sw{bottom:0;left:0;cursor:nesw-resize;}',
    '#sk-enh-resize-se{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;',
    'touch-action:none;z-index:5;background:linear-gradient(135deg,transparent 0 40%,' + C.dim + ' 40% 46%,',
    'transparent 46% 58%,' + C.dim + ' 58% 64%,transparent 64% 100%);opacity:.7;}',
    '#sk-enh-resize-se:hover{opacity:1;}',
    '.sk-resize-edge{position:absolute;z-index:4;touch-action:none;}',
    '.sk-resize-edge.n{top:0;left:14px;right:14px;height:6px;cursor:ns-resize;}',
    '.sk-resize-edge.s{bottom:0;left:14px;right:14px;height:6px;cursor:ns-resize;}',
    '.sk-resize-edge.w{left:0;top:14px;bottom:14px;width:6px;cursor:ew-resize;}',
    '.sk-resize-edge.e{right:0;top:14px;bottom:14px;width:6px;cursor:ew-resize;}',
    '#sk-enh-tabs{display:flex;border-bottom:1px solid ' + C.line + ';}',
    '.sk-tab{flex:1;padding:9px 0;text-align:center;font-size:12px;letter-spacing:.5px;',
    'text-transform:uppercase;cursor:pointer;color:' + C.dim + ';border-bottom:2px solid transparent;}',
    '.sk-tab.active{color:' + C.amber + ';border-bottom-color:' + C.amber + ';}',
    '.sk-body{padding:12px;overflow-y:auto;flex:1;min-height:0;}',
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
    '.sk-suggest-row.is-artist span:first-child{color:' + C.amber + ';}',
    '.sk-suggest-row.is-copyright span:first-child{color:' + C.link + ';}',
    '.sk-suggest-count{color:' + C.dim + ';font-size:11px;font-family:monospace;}',
    '.sk-chip{background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';',
    'font-size:11px;padding:3px 7px;border-radius:20px;display:flex;align-items:center;gap:5px;',
    'font-family:"Courier New",monospace;}',
    '.sk-chip span{cursor:pointer;color:' + C.red + ';font-weight:bold;}',
    // Type 1 = artist/animator, type 3 = copyright/show — the standard
    // Danbooru1/Moebooru tag-type numbering, already relied on elsewhere in
    // this file for the amber animator color; type 3 specifically wasn't
    // re-verified against a live response this time, just following that
    // same well-established convention.
    '.sk-chip.is-artist{border-color:' + C.amberDim + ';color:' + C.amber + ';}',
    '.sk-chip.is-copyright{border-color:' + C.link + ';color:' + C.link + ';}',
    '.sk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}',
    '#sk-enh-panel.sk-size-locked .sk-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));}',
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
    '.sk-card .info-badge{position:absolute;bottom:3px;right:4px;background:rgba(0,0,0,.7);',
    'color:' + C.text + ';font-size:11px;width:18px;height:18px;border-radius:50%;',
    'display:flex;align-items:center;justify-content:center;z-index:2;cursor:pointer;',
    'font-family:"Courier New",monospace;}',
    '.sk-card .info-badge:hover{background:rgba(0,0,0,.9);color:' + C.amber + ';}',
    '.sk-card .remove-badge{position:absolute;bottom:3px;left:4px;background:rgba(0,0,0,.7);',
    'color:' + C.text + ';font-size:13px;width:18px;height:18px;border-radius:50%;',
    'display:flex;align-items:center;justify-content:center;z-index:2;cursor:pointer;',
    'font-family:"Courier New",monospace;line-height:1;}',
    '.sk-card .remove-badge:hover{background:' + C.red + ';color:#fff;}',
    '.sk-info-popup{position:fixed;z-index:2147483300;width:280px;max-height:320px;',
    'overflow-y:auto;background:' + C.bg + ';border:1px solid ' + C.line + ';border-radius:6px;',
    'box-shadow:0 10px 30px rgba(0,0,0,.6);}',
    '.sk-info-popup .sk-dock-head{padding-right:26px;}',
    '.sk-info-popup .sk-close{position:absolute;top:6px;right:8px;}',
    '.sk-dock-head{display:flex;align-items:center;justify-content:space-between;',
    'padding:8px 10px;background:' + C.panel2 + ';border-bottom:1px solid ' + C.line + ';}',
    '.sk-dock-badges{display:flex;gap:6px;align-items:center;}',
    '.sk-badge{font-family:"Courier New",monospace;font-size:11px;padding:2px 7px;',
    'border-radius:10px;background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';}',
    '.sk-badge.score{color:' + C.amber + ';border-color:' + C.amberDim + ';}',
    '.sk-stars{display:inline-flex;gap:2px;align-items:center;}',
    '.sk-star{font-size:15px;color:' + C.dim + ';cursor:pointer;line-height:1;}',
    '.sk-star.filled{color:' + C.amber + ';}',
    '.sk-star-clear{font-size:12px;color:' + C.dim + ';cursor:pointer;margin-left:3px;opacity:.3;}',
    '.sk-star-clear.active{opacity:.8;}',
    '.sk-star-clear:hover{color:' + C.red + ';opacity:1;}',
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
    '.sk-show-pick.off{opacity:.5;cursor:default;}',
    '.sk-show-pick.off:hover{border-color:' + C.line + ';background:none;}',
    '.sk-show-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;}',
    '.sk-mini-toggle{background:transparent;border:1px solid ' + C.line + ';color:' + C.dim + ';',
    'padding:3px 9px;border-radius:12px;font-size:10px;cursor:pointer;font-family:inherit;white-space:nowrap;}',
    '.sk-mini-toggle:hover{border-color:' + C.amber + ';color:' + C.amber + ';}',
    '.sk-show-head .title{font-size:15px;color:' + C.amber + ';font-family:"Courier New",monospace;}',
    '.sk-show-head a{font-size:11px;color:' + C.dim + ';text-decoration:none;}',
    '.sk-show-head a:hover{color:' + C.amber + ';}',
    '.sk-show-nav{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:10px;}',
    '.sk-freq-list{border:1px solid ' + C.line + ';border-radius:8px;padding:10px 12px 6px;',
    'background:linear-gradient(180deg,' + C.panel2 + ',' + C.panel + ');}',
    '.sk-freq-row{display:flex;align-items:center;gap:8px;padding:4px 2px;border-radius:5px;cursor:pointer;',
    'transition:background .12s ease;}',
    '.sk-freq-row:hover{background:rgba(255,176,32,.08);}',
    '.sk-freq-row.is-show:hover{background:rgba(109,179,242,.08);}',
    '.sk-freq-rank{width:14px;flex-shrink:0;font-size:10px;color:' + C.dim + ';text-align:right;font-family:"Courier New",monospace;}',
    '.sk-freq-name{width:112px;flex-shrink:0;font-size:12px;color:' + C.amber + ';white-space:nowrap;',
    'overflow:hidden;text-overflow:ellipsis;}',
    '.sk-freq-row.is-show .sk-freq-name{color:' + C.link + ';}',
    '.sk-freq-bar-wrap{flex:1;height:6px;border-radius:3px;background:' + C.bg + ';overflow:hidden;}',
    '.sk-freq-bar{height:100%;border-radius:3px;background:linear-gradient(90deg,' + C.amberDim + ',' + C.amber + ');}',
    '.sk-freq-row.is-show .sk-freq-bar{background:linear-gradient(90deg,#2c5170,' + C.link + ');}',
    '.sk-freq-count{width:34px;flex-shrink:0;text-align:right;font-size:11px;color:' + C.dim + ';',
    'font-family:"Courier New",monospace;}',
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
    '.sk-xc-box{max-width:1120px;height:min(90vh,800px);max-height:none;display:flex;flex-direction:column;overflow:hidden;',
    'font-family:"Neue Haas Grotesk","Helvetica Neue",Arial,sans-serif;color:' + C.text + ';}',
    '.sk-xc-box button,.sk-xc-box input,.sk-xc-box select{font-family:inherit;}',
    '.sk-xc-title{font-size:13px;color:' + C.text + ';}',
    '.sk-xc-title span{color:' + C.dim + ';margin-left:6px;}',
    '.sk-xc-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr);}',
    '.sk-xc-left{overflow-y:auto;padding:14px 16px;border-right:1px solid ' + C.line + ';min-height:0;}',
    '.sk-xc-right{display:flex;flex-direction:column;min-height:0;}',
    '.sk-xc-stage{display:flex;align-items:center;justify-content:center;background:' + C.bg + ';border:1px solid ' + C.line + ';border-radius:6px;padding:10px;box-sizing:border-box;}',
    '.sk-xc-canvas{position:relative;background:#000;flex-shrink:0;overflow:hidden;}',
    '.sk-xc-cell{position:absolute;box-sizing:border-box;border:1px solid #000;overflow:hidden;cursor:grab;touch-action:none;background:#1a1a1a;',
    'transition:left .18s ease,top .18s ease,width .18s ease,height .18s ease;}',
    '.sk-xc-cell.ph{outline:2px dashed ' + C.amber + ';outline-offset:-2px;}',
    '.sk-xc-cell.ph img,.sk-xc-cell.ph .sk-xc-lblwrap{opacity:.3;}',
    '.sk-xc-box .sk-xc-cell img{max-height:none;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;background:transparent;}',
    '.sk-xc-cell.hl{outline:2px solid ' + C.amber + ';outline-offset:-2px;z-index:1;}',
    '.sk-xc-num{position:absolute;top:3px;right:4px;font:10px "Courier New",monospace;color:' + C.text + ';background:rgba(0,0,0,.6);padding:0 4px;border-radius:2px;}',
    '.sk-xc-lblwrap{position:absolute;pointer-events:none;}',
    '.sk-xc-chip{position:absolute;white-space:pre;color:#fff;font-family:Arial,Helvetica,sans-serif;pointer-events:auto;cursor:grab;touch-action:none;user-select:none;}',
    '.sk-xc-chip:hover{outline:1px dashed ' + C.amber + ';}',
    '.sk-xc-ghost{position:fixed !important;margin:0;z-index:2147483647;pointer-events:none;box-sizing:border-box;box-shadow:0 14px 32px rgba(0,0,0,.7);transform:scale(1.05);transition:none;}',
    '.sk-xc-ghost.settling{transition:left .18s ease,top .18s ease,width .18s ease,height .18s ease,transform .18s ease,box-shadow .18s ease;transform:none;box-shadow:none;}',
    '.sk-xc-ghost.sk-xc-rowhead{background:' + C.panel2 + ';border:1px solid ' + C.amber + ';border-radius:6px;}',
    '.xc-dragging,.xc-dragging *{cursor:grabbing !important;}',
    '.sk-xc-film{flex-wrap:wrap;gap:6px;margin-top:8px;}',
    '.sk-xc-fr{position:relative;width:72px;height:41px;box-sizing:border-box;border:1px solid ' + C.line + ';border-radius:3px;overflow:hidden;cursor:grab;touch-action:none;background:#000;}',
    '.sk-xc-film.port .sk-xc-fr{width:36px;height:64px;}',
    '.sk-xc-fr:hover{border-color:' + C.dim + ';}',
    '.sk-xc-fr.on{border-color:' + C.amber + ';box-shadow:0 0 0 1px ' + C.amber + ';}',
    '.sk-xc-fr.ph{opacity:.3;}',
    '.sk-xc-box .sk-xc-fr img{width:100%;height:100%;max-height:none;object-fit:cover;display:block;pointer-events:none;}',
    '.sk-xc-frn{position:absolute;left:2px;top:1px;font:9px "Courier New",monospace;color:' + C.text + ';background:rgba(0,0,0,.6);padding:0 3px;border-radius:2px;}',
    '.sk-xc-hint{min-height:16px;margin:6px 2px 0;font-size:11px;color:' + C.dim + ';}',
    '.sk-xc-pos{display:inline-grid;grid-template-columns:repeat(3,20px);gap:3px;padding:4px;border:1px solid ' + C.line + ';border-radius:5px;background:' + C.bg + ';}',
    '.sk-xc-pos button{width:20px;height:12px;padding:0;border:1px solid ' + C.line + ';border-radius:2px;background:transparent;cursor:pointer;}',
    '.sk-xc-pos button:hover{border-color:' + C.amber + ';}',
    '.sk-xc-pos button.on{background:' + C.amber + ';border-color:' + C.amber + ';}',
    '.sk-xc-poshint{font-size:11px;color:' + C.dim + ';}',
    '.sk-xc-chip::after{content:"";position:absolute;inset:-6px;}',
    '.sk-xc-hint a{color:' + C.amber + ';}',
    '.sk-xc-set{margin-top:12px;border-top:1px solid ' + C.line + ';padding-top:8px;}',
    '.sk-xc-line{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;padding:5px 0;}',
    '.sk-xc-line .k{width:108px;flex-shrink:0;font-size:12px;color:' + C.dim + ';}',
    '.sk-xc-seg{display:inline-flex;border:1px solid ' + C.line + ';border-radius:5px;overflow:hidden;}',
    '.sk-xc-seg button{background:transparent;border:0;color:' + C.dim + ';padding:4px 10px;font-size:12px;cursor:pointer;font-family:inherit;}',
    '.sk-xc-seg button+button{border-left:1px solid ' + C.line + ';}',
    '.sk-xc-seg button:hover{color:' + C.text + ';}',
    '.sk-xc-seg button.on{background:' + C.amberDim + ';color:' + C.amber + ';}',
    '.sk-xc-seg.dis{opacity:.4;pointer-events:none;}',
    '#xc-music-line{border:1px dashed transparent;border-radius:6px;}',
    '#xc-music-line.is-dragover{border-color:' + C.amber + ';background:' + C.panel2 + ';}',
    '.sk-xc-tracks{display:inline-flex;flex-wrap:wrap;gap:4px;}',
    '.sk-xc-track{display:inline-flex;align-items:center;gap:6px;max-width:170px;padding:2px 8px;border:1px solid ' + C.line + ';border-radius:10px;font-size:11px;color:' + C.text + ';}',
    '.sk-xc-track .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.sk-xc-cap{margin:0 0 0 116px;font-size:11px;color:' + C.dim + ';}',
    '.sk-xc-cap:empty{display:none;}',
    '.sk-xc-listhead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid ' + C.line + ';font-size:12px;color:' + C.text + ';}',
    '.sk-xc-listhead b{font-weight:normal;color:' + C.dim + ';}',
    '.sk-xc-list{flex:1;min-height:0;overflow-y:auto;position:relative;}',
    '.sk-xc-row.ph{background:' + C.panel2 + ';outline:1px dashed ' + C.amber + ';outline-offset:-3px;}',
    '.sk-xc-row.ph>*{opacity:.3;}',
    '.sk-xc-row{border-bottom:1px solid ' + C.line + ';}',
    '.sk-xc-row.open{background:' + C.panel2 + ';}',
    '.sk-xc-row.dragging{opacity:.55;background:' + C.panel2 + ';}',
    '.sk-xc-rowhead{display:flex;align-items:center;gap:8px;padding:7px 12px;min-height:46px;box-sizing:border-box;cursor:grab;user-select:nonetouch-action:pan-y;}',
    '.sk-xc-rowhead:hover .sk-xc-name{color:' + C.amber + ';}',
    '.sk-xc-grip{cursor:grab;color:' + C.dim + ';font-size:12px;letter-spacing:-2px;line-height:1;touch-action:none;user-select:none;padding:2px 2px;border-radius:3px;}',
    '.sk-xc-grip:hover,.sk-xc-grip:focus{color:' + C.amber + ';outline:none;}',
    '.sk-xc-n{width:14px;text-align:right;font:11px "Courier New",monospace;color:' + C.dim + ';flex-shrink:0;}',
    '.sk-xc-box .sk-xc-rowhead img{width:44px;height:25px;max-height:none;object-fit:cover;border-radius:2px;background:#000;flex-shrink:0;}',
    '.sk-xc-who{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}',
    '.sk-xc-name{font-size:12px;color:' + C.text + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.sk-xc-sub{font-size:10px;color:' + C.dim + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.sk-xc-sub .id{font-family:"Courier New",monospace;}',
    '.sk-xc-row.hl:not(.open){background:' + C.panel2 + ';}',
    '.sk-xc-badge{font-size:10px;color:' + C.amber + ';white-space:nowrap;}',
    '.sk-xc-badge:empty{display:none;}',
    '.sk-xc-chev{color:' + C.dim + ';font-size:10px;width:10px;text-align:center;}',
    '.sk-xc-edit{padding:2px 12px 10px 34px;}',
    '.sk-xc-field{display:flex;align-items:center;gap:6px;padding:3px 0;}',
    '.sk-xc-field .k{width:40px;flex-shrink:0;font-size:11px;color:' + C.dim + ';}',
    '.sk-xc-field .dash{color:' + C.dim + ';}',
    '.sk-xc-field .sk-input{min-width:0;font-size:12px;padding:4px 6px;}',
    '.sk-xc-field input[data-s],.sk-xc-field input[data-e]{flex:0 1 96px;}',
    '.sk-xc-actions{display:flex;gap:6px;justify-content:flex-end;padding-top:4px;}',
    '.sk-xc-foot{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid ' + C.line + ';background:' + C.panel2 + ';}',
    '.sk-xc-sum{flex:1;min-width:0;font-size:12px;color:' + C.dim + ';}',
    '@media (max-width:760px){.sk-xc-box{height:92vh;}.sk-xc-body{display:block;overflow-y:auto;}.sk-xc-left{overflow:visible;border-right:0;}.sk-xc-list{overflow:visible;}}',
    '.sk-spinner{display:inline-block;width:12px;height:12px;border:2px solid ' + C.line + ';',
    'border-top-color:' + C.amber + ';border-radius:50%;vertical-align:middle;margin-right:6px;',
    'animation:sk-spin .7s linear infinite;}',
    '@keyframes sk-spin{to{transform:rotate(360deg);}}',
    '.sk-progress{height:4px;background:' + C.line + ';border-radius:2px;margin-top:6px;overflow:hidden;position:relative;}',
    '.sk-progress-fill{height:100%;width:0;background:' + C.amber + ';border-radius:2px;transition:width .25s linear;}',
    '.sk-progress.ind .sk-progress-fill{position:absolute;width:35%;transition:none;animation:sk-ind 1.2s ease-in-out infinite;}',
    '@keyframes sk-ind{0%{left:-35%;}100%{left:100%;}}',
    '.sk-st-pct{margin-left:6px;opacity:.75;}',
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
    '.sk-media-box::-webkit-scrollbar-thumb:hover{background:' + C.amber + ';}',
    // Compact controls on the main screen: the Search button and the
    // Results / Animator Stats switch were full-width bars.
    '#sk-go{flex:0 0 auto !important;margin-left:auto;padding:5px 16px;}',
    '.sk-mode-row{gap:4px;margin-bottom:8px;}',
    '.sk-mode-btn{flex:0 0 auto;padding:5px 12px;}',
    '.sk-tab{padding:7px 0;}'
  ].join('');

  var styleTag = document.createElement('style');
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  var root = document.createElement('div');
  root.id = 'sk-enh-root';
  root.innerHTML =
    '<div id="sk-enh-panel" style="display:none">' +
      '<div id="sk-enh-head"><div class="brand">SAKUGA <b>ENHANCER</b></div>' +
        '<div id="sk-enh-head-actions" style="display:flex;align-items:center;gap:6px">' +
          '<button type="button" class="sk-icon-btn" id="sk-enh-lock-size" title="lock clip size — resizing the panel adds/removes clips per row instead of resizing them">&#9638;</button>' +
          '<button type="button" class="sk-icon-btn" id="sk-enh-reset" title="reset size and position">&#8634;</button>' +
          '<div class="sk-close" id="sk-enh-x">&times;</div>' +
        '</div></div>' +
      '<div id="sk-enh-tabs">' +
        '<div class="sk-tab active" data-tab="search">Search</div>' +
        '<div class="sk-tab" data-tab="shows">Shows</div>' +
        '<div class="sk-tab" data-tab="pools">Pools</div>' +
      '</div>' +
      '<div class="sk-body" id="sk-enh-body"></div>' +
      '<div class="sk-resize-corner nw" data-dir="nw" title="drag to resize"></div>' +
      '<div class="sk-resize-corner ne" data-dir="ne" title="drag to resize"></div>' +
      '<div class="sk-resize-corner sw" data-dir="sw" title="drag to resize"></div>' +
      '<div id="sk-enh-resize-se" data-dir="se" title="drag to resize"></div>' +
      '<div class="sk-resize-edge n" data-dir="n" title="drag to resize"></div>' +
      '<div class="sk-resize-edge s" data-dir="s" title="drag to resize"></div>' +
      '<div class="sk-resize-edge w" data-dir="w" title="drag to resize"></div>' +
      '<div class="sk-resize-edge e" data-dir="e" title="drag to resize"></div>' +
    '</div>' +
    '<div id="sk-enh-toggle" title="Sakuga Enhancer">##</div>';
  document.body.appendChild(root);

  var panel = root.querySelector('#sk-enh-panel');
  var body = root.querySelector('#sk-enh-body');
  var head = root.querySelector('#sk-enh-head');

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

  // ===================== LOCK SIZE (fixed clip size vs. fixed column count) =====================
  // Default grid behavior is a fixed 3 columns that stretch/shrink with the
  // panel — resizing the panel resizes the clips. Locking flips that: clips
  // stay a fixed size and the grid reflows more/fewer per row instead,
  // via CSS Grid's auto-fill + minmax (the standard pattern for this).
  var LOCK_KEY = 'sk-enh-lock-size';
  function loadLockPref() {
    try { return localStorage.getItem(LOCK_KEY) === '1'; } catch (e) { return false; }
  }
  function saveLockPref(locked) {
    try { localStorage.setItem(LOCK_KEY, locked ? '1' : '0'); } catch (e) { /* non-fatal */ }
  }
  var lockBtn = root.querySelector('#sk-enh-lock-size');
  var lockSize = loadLockPref();
  function applyLockUI(locked) {
    lockBtn.classList.toggle('active', locked);
    panel.classList.toggle('sk-size-locked', locked);
  }
  applyLockUI(lockSize);
  lockBtn.addEventListener('click', function () {
    lockSize = !lockSize;
    applyLockUI(lockSize);
    saveLockPref(lockSize);
  });

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

  // Confirmed to actually be a 1–3 star rating (not a flat upvote) directly
  // from the site's own post page — "Score: N ★★★ (vote up)", clickable
  // per-star. `score` as the param name was already a correct guess (this
  // worked when hardcoded to 1); this just stops assuming the value is
  // always 1. There's still no way to check a rating cold on page load — no
  // vote-check request fires then, and the site's own vote widget HTML is
  // byte-identical across every rating state (confirmed by direct comparison).
  // But the vote response ITSELF turns out to carry real, authoritative
  // state: watching the site's own vote.coffee via DevTools showed the POST
  // to /post/vote.json returns not just success/failure but the fresh post
  // (with the real updated score) plus a `votes` map keyed by post id with
  // *your account's own current vote value* on it, straight from the server
  // — not an echo of what was just sent. So this now returns the parsed
  // response instead of resolving void, letting the caller read that
  // real state directly instead of doing a separate refetch afterward.
  function castVote(postId, stars, username, passwordHash) {
    var params = new URLSearchParams();
    params.set('login', username);
    params.set('password_hash', passwordHash);
    params.set('id', String(postId));
    params.set('score', String(stars));
    return fetch('/post/vote.json', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }).then(function (r) {
      return r.text().then(function (text) {
        var parsed = null;
        try { parsed = JSON.parse(text); } catch (e) { /* non-JSON — fall through to generic HTTP check */ }
        if (r.ok && (!parsed || parsed.success !== false)) return parsed;
        throw new Error((parsed && parsed.reason) || ('HTTP ' + r.status + ': ' + text.slice(0, 200)));
      });
    });
  }

  // Real per-account vote state does exist and is fetchable after all — just
  // not through the JSON API, a dedicated endpoint, or the DOM (all three
  // came back empty/identical across every rating state when tested
  // directly). It's embedded in the post page's own raw HTML, inside an
  // inline `Post.register_resp({...})` script call, under a `votes` map
  // keyed by post id — confirmed by diffing the actual fetched HTML text
  // itself, not the rendered DOM (which never reflects it; the widget
  // renders the same "off" markup regardless, then a separate inline
  // `vote.updateWidget(...)` call paints the real state client-side from
  // that same embedded data). This costs one extra page fetch per opened
  // clip (not per thumbnail in a grid), which is the honest tradeoff for
  // real accuracy instead of a per-device guess.
  //
  // Return value is three-way on purpose — collapsing "couldn't tell" and
  // "confirmed no vote" into the same null caused a real bug in the app's
  // version of this: a genuine 3-star rating would reopen showing empty
  // stars, because a failed fetch and "you never voted" both came back as
  // null, and the caller treated both as "the real vote is 0", silently
  // overwriting a correct local rating with nothing.
  //   - a number (1-3): confirmed real vote, straight from the server
  //   - null: confirmed no vote — the votes map was read successfully and
  //     this post genuinely isn't in it
  //   - undefined: couldn't determine anything (network failure, page shape
  //     unexpected) — callers must leave the existing local guess alone
  //     rather than treating this as "no vote"
  // Finds the JSON object literal starting right after `marker` and returns
  // it as a substring, using real brace/string-aware scanning rather than a
  // regex — needed because a naive "match up to the next }" (or even a
  // targeted "votes":{...} pattern) can grab the WRONG object if the page
  // embeds more than one thing that happens to look similar (e.g. a related
  // post, sidebar widget, etc. also serialized somewhere earlier in the same
  // page). This walks the actual object matching braces properly, so it's
  // guaranteed to extract the exact argument passed to that specific call.
  function extractJsonAfter(html, marker) {
    var markerIdx = html.indexOf(marker);
    if (markerIdx === -1) return null;
    var start = html.indexOf('{', markerIdx);
    if (start === -1) return null;
    var depth = 0, inStr = false, strCh = '', escape = false;
    for (var i = start; i < html.length; i++) {
      var ch = html.charAt(i);
      if (inStr) {
        if (escape) { escape = false; }
        else if (ch === '\\') { escape = true; }
        else if (ch === strCh) { inStr = false; }
        continue;
      }
      if (ch === '"' || ch === '\'') { inStr = true; strCh = ch; continue; }
      if (ch === '{') { depth++; }
      else if (ch === '}') {
        depth--;
        if (depth === 0) return html.slice(start, i + 1);
      }
    }
    return null; // never closed — malformed/truncated, give up rather than guess
  }

  function fetchServerVote(postId) {
    return fetch('/post/show/' + postId, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) return undefined;
        return r.text().then(function (html) {
          var jsonStr = extractJsonAfter(html, 'Post.register_resp(');
          if (!jsonStr) return undefined;
          try {
            var data = JSON.parse(jsonStr);
            if (!data || typeof data.votes !== 'object' || data.votes === null) return undefined;
            var v = data.votes[String(postId)];
            return v === undefined ? null : v; // key present -> real value; key absent -> confirmed no vote
          } catch (e) { return undefined; }
        });
      })
      .catch(function () { return undefined; }); // network failure — unknown, not "no vote"
  }


  // Tracks which posts this browser has rated via the bookmarklet, and what
  // rating was given (1-3 stars) — the badge's own "voted" state used to be
  // a plain JS variable that reset on every page reload, showing the rating
  // option again as if nothing happened. There's no confirmed server-side
  // "what did I rate this" check to fall back on (no such request fires on
  // page load — see castVote above), so this is a client-side memory of
  // *this bookmarklet's own* successful ratings, not a true source of truth —
  // rating via the site directly, another browser, etc. won't be reflected
  // here until rated through the bookmarklet at least once.
  var VOTED_KEY = 'sk-voted-posts';
  function readVotedMap() {
    try {
      var raw = localStorage.getItem(VOTED_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      // migrate the old boolean-array-of-ids shape from before star ratings existed
      if (Array.isArray(parsed)) {
        var migrated = {};
        parsed.forEach(function (id) { migrated[id] = 1; });
        return migrated;
      }
      return parsed || {};
    } catch (e) { return {}; }
  }
  function getVoteRating(postId) {
    var map = readVotedMap();
    return map[postId] || null;
  }
  function setVoteRating(postId, stars) {
    try {
      var map = readVotedMap();
      map[postId] = stars;
      var keys = Object.keys(map);
      if (keys.length > 2000) {
        // keep this from growing forever — drop the oldest-inserted entries
        var toDrop = keys.length - 2000;
        for (var i = 0; i < toDrop; i++) delete map[keys[i]];
      }
      localStorage.setItem(VOTED_KEY, JSON.stringify(map));
    } catch (e) { /* non-fatal — worst case the reminder just doesn't persist */ }
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
  var searchScrollObserver = null; // watches the load-more sentinel; recreated each render since the sentinel itself is a fresh DOM node each time
  var searchHistory = []; // previous searches in the Search tab, newest last — drives the "← back" button
  var searchOrigin = null; // e.g. {type:'shows'} — set right before a Shows-originated search, consumed by runSearch
  var statsCache = null;  // { tagName, allPosts }

  // ===================== LOCAL POOLS (localStorage) =====================
  // Real server-side pool CREATION requires an account-permission tier most
  // accounts (including a freshly made test account) don't have — confirmed
  // both via the API ("access denied") and by trying to create a pool
  // directly on the site itself. So "My Pools" here is entirely on-device:
  // no login, no server round-trip, same tradeoff as the companion app's
  // AsyncStorage-based local pools, just backed by localStorage instead.
  // Posts are stored as full snapshots at add-time — score etc. won't stay
  // live-updated, matching the app's approach.
  var LOCAL_POOLS_KEY = 'sk-local-pools-v1';

  function readLocalPools() {
    try {
      var raw = localStorage.getItem(LOCAL_POOLS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function writeLocalPools(pools) {
    try { localStorage.setItem(LOCAL_POOLS_KEY, JSON.stringify(pools)); } catch (e) { /* non-fatal — worst case a save doesn't persist */ }
  }
  function getLocalPools() { return readLocalPools(); }
  function getLocalPool(id) {
    return safeFilter(readLocalPools(), function (p) { return p.id === id; })[0] || null;
  }
  function createLocalPool(name, description) {
    var pools = readLocalPools();
    var pool = { id: String(Date.now()), name: name, description: description || '', posts: [], createdAt: Date.now() };
    pools.unshift(pool);
    writeLocalPools(pools);
    return pool;
  }
  function deleteLocalPool(id) {
    writeLocalPools(safeFilter(readLocalPools(), function (p) { return p.id !== id; }));
  }
  function addPostToLocalPool(poolId, post) {
    var pools = readLocalPools();
    var pool = safeFilter(pools, function (p) { return p.id === poolId; })[0];
    if (pool && !safeFilter(pool.posts, function (p) { return p.id === post.id; }).length) {
      pool.posts.unshift(post);
      writeLocalPools(pools);
      return true;
    }
    return false;
  }
  function removePostFromLocalPool(poolId, postId) {
    var pools = readLocalPools();
    var pool = safeFilter(pools, function (p) { return p.id === poolId; })[0];
    if (pool) {
      pool.posts = safeFilter(pool.posts, function (p) { return p.id !== postId; });
      writeLocalPools(pools);
    }
  }

  // ===================== SEARCH TAB =====================
  var searchState = { tags: [], order: 'date', rating: '' };
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
            '<option value="id">oldest</option>' +
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
        '<button class="sk-mode-btn" id="sk-mode-stats" type="button">▥ Animator Stats</button>' +
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
      var q = normalizeForTagMatch(input.value.trim().toLowerCase().replace(/\s+/g, '_'));
      if (!q) { suggestWrap.style.display = 'none'; suggestWrap.innerHTML = ''; return; }
      suggestDebounce = setTimeout(function () {
        ensureAllTags().then(function (list) {
          var matches = safeFilter(list, function (t) { return normalizeForTagMatch(t.name).indexOf(q) !== -1; });
          matches = safeSort(matches, function (a, b) { return b.count - a.count; }).slice(0, 8);
          if (!matches.length) { suggestWrap.style.display = 'none'; suggestWrap.innerHTML = ''; return; }
          suggestWrap.style.display = 'block';
          suggestWrap.innerHTML = safeMap(matches, function (t) {
            var typeClass = t.type === 1 ? ' is-artist' : (t.type === 3 ? ' is-copyright' : '');
            return '<div class="sk-suggest-row' + typeClass + '" data-name="' + esc(t.name) + '">' +
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
    toggleStats.textContent = sync.artistTag ? '▥ Stats: ' + sync.artistTag : '▥ Animator Stats';
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
      '<div id="sk-show-animators-wrap" style="margin-bottom:8px"></div>' +
      '<div id="sk-solo-row" style="display:none;gap:6px;margin-bottom:8px">' +
        '<button type="button" class="sk-icon-btn" id="sk-solo-toggle">&#9312;</button>' +
        '<button type="button" class="sk-icon-btn" id="sk-unknown-toggle">' +
          '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="display:block">' +
            '<path d="M5 5.2a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3"/><circle cx="7" cy="10.7" r=".4" fill="currentColor"/><path d="M2 12.5 12 1.5"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="sk-meta" id="sk-facet-head" style="display:none;justify-content:space-between;align-items:center">' +
        '<button class="sk-filter-toggle" id="sk-filter-toggle" type="button">' +
          'Filter <span class="sk-filter-badge" id="sk-filter-badge" style="display:none"></span>' +
          '<span class="chev">▾</span></button>' +
        '<span><a href="#" id="sk-facet-all" style="color:' + C.amber + '">reset</a></span>' +
      '</div>' +
      '<div class="sk-facet-grid" id="sk-facet-grid" style="display:none"></div>' +
      '<div id="sk-results"></div>';
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
    if (!wrap) return; // search tab isn't the active view right now — nothing to update
    wrap.innerHTML = '';
    searchState.tags.forEach(function (t, i) {
      var chip = document.createElement('div');
      var typeClass = tagTypeMap && tagTypeMap[t] === 1 ? ' is-artist' : (tagTypeMap && tagTypeMap[t] === 3 ? ' is-copyright' : '');
      chip.className = 'sk-chip' + typeClass;
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
      // switchToTab (not just ensureResultsMarkup) so this also rebuilds the
      // chip pills from the tags array, and correctly switches away from
      // Shows if that's where the clip was opened from — ensureResultsMarkup
      // alone only rebuilds the results container, not the chips display.
      switchToTab('search');
      runSearch();
      if (onNavigate) onNavigate();
    };
  }

  var currentInfoPopupClose = null;
  var currentInfoPopupAnchor = null;
  function openInfoPopup(anchorEl, p) {
    if (currentInfoPopupAnchor === anchorEl) {
      // clicking the same badge that's already open toggles it closed
      if (currentInfoPopupClose) currentInfoPopupClose();
      return;
    }
    if (currentInfoPopupClose) currentInfoPopupClose();

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
        '</div>' + linkHtml +
        '<span class="sk-close" id="sk-info-popup-close">&times;</span>' +
      '</div>';

    function position() {
      var rect = anchorEl.getBoundingClientRect();
      var popRect = pop.getBoundingClientRect();
      var margin = 8;
      var left = Math.min(Math.max(rect.left, margin), Math.max(margin, window.innerWidth - popRect.width - margin));
      var top = rect.bottom + 6;
      if (top + popRect.height > window.innerHeight - margin) {
        top = rect.top - popRect.height - 6; // flip above the anchor if there's no room below
        if (top < margin) top = margin; // neither fits — just clamp to the top edge
      }
      pop.style.left = left + 'px';
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

  // Reused from ffmpeg.wasm's own official documentation example for
  // drawtext (freetype2, which drawtext needs, has been part of
  // @ffmpeg/core since v0.8.4 — well before the 0.12.x branch already in
  // use here) — a real TTF file known to already work with this exact
  // core build, rather than an untested font pulled from elsewhere.
  var LABEL_FONT_URL = 'https://raw.githubusercontent.com/ffmpegwasm/testdata/master/arial.ttf';
  var labelFontLoaded = false;
  function ensureLabelFont(ffmpeg) {
    if (labelFontLoaded) return Promise.resolve();
    return fetch(LABEL_FONT_URL).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      // Written to ffmpeg's own virtual FS for actual rendering, and
      // registered as a real browser FontFace from those exact same bytes
      // for measurement — confirmed directly that measuring against a
      // generic "Arial, sans-serif" instead is a real, structural problem,
      // not just a rounding error: different platforms substitute
      // different actual fonts for that generic name, none of which are
      // guaranteed to share metrics with the specific arial.ttf ffmpeg
      // always renders with regardless of platform. Using the same bytes
      // for both closes that gap instead of papering over it with a
      // bigger safety margin.
      //
      // Each consumer gets its OWN copy (.slice(0), a real byte copy, not
      // just another view over the same memory) rather than sharing one
      // ArrayBuffer between them — ffmpeg.wasm's writeFile runs across a
      // Web Worker boundary and very plausibly transfers (not copies) the
      // buffer via postMessage for performance, which would detach the
      // original and leave whichever consumer reads it second holding an
      // empty buffer. That failure mode matches a real "Invalid font data
      // in ArrayBuffer" error seen from this exact shared-buffer pattern,
      // so this isn't a hypothetical precaution.
      var ffmpegBytes = new Uint8Array(buf.slice(0));
      var fontFaceBuffer = buf.slice(0);
      return Promise.all([
        ffmpeg.writeFile('label_font.ttf', ffmpegBytes),
        (new FontFace('SkGridLabelFont', fontFaceBuffer)).load().then(function (loaded) {
          document.fonts.add(loaded);
        })
      ]);
    }).then(function () { labelFontLoaded = true; });
  }

  // Confirmed directly (against real ffmpeg, including a name with an
  // apostrophe) that this two-stage escape — the filtergraph parser and
  // drawtext's own string parser each need their own layer — renders
  // correctly rather than leaving stray backslashes visible. Animator tags
  // here are near-universally plain identifiers (letters/underscores), so
  // this mostly matters for the rare edge case rather than everyday names.
  function escapeDrawtext(s) {
    return String(s)
      .replace(/\\/g, '\\\\\\\\')
      .replace(/:/g, '\\\\:')
      .replace(/'/g, "'\\\\\\''");
  }

  // A separate canvas purely for text measurement, never appended to the
  // DOM — same technique browsers use internally for ctx.measureText.
  // Reused across calls rather than recreated each time.
  var labelMeasureCanvas = null;
  function measureLabelTextWidth(text, fontSize) {
    if (!labelMeasureCanvas) labelMeasureCanvas = document.createElement('canvas');
    var ctx = labelMeasureCanvas.getContext('2d');
    if (!ctx) return String(text).length * fontSize * 0.56; // no canvas support: rough estimate rather than failing
    // The exact same font file (and bytes) ffmpeg renders with — see
    // ensureLabelFont — not a generic system font name, which measuring
    // confirmed can silently under-report width by a wide margin.
    ctx.font = fontSize + 'px SkGridLabelFont, sans-serif';
    return ctx.measureText(text).width;
  }

  // Capitalizes each word of an auto-detected animator name (tag names are
  // plain lowercase with underscores, e.g. "yutaka_nakamura" — there's no
  // real capitalization in the source to preserve). Never applied to a
  // person's own custom label text, which is used verbatim — that's
  // hand-authored, and forcing a casing convention on someone's own typed
  // text would be presumptuous, unlike a raw tag name that never had any
  // intentional casing to begin with.
  function titleCase(s) {
    return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // General wrapping shared by both label sources: auto-detected animator
  // names (joined with ", ", each name kept atomic — never split mid-name)
  // and a person's own freeform custom text (joined with " ", wrapped at
  // its own natural word breaks like ordinary text). Same fitting logic
  // either way:
  //  - font size scales with the cell's own size (a small cell in a 9-clip
  //    grid and a large featured-clip box shouldn't use the same absolute
  //    size), clamped so it's never too small to read;
  //  - tokens are measured with the browser's real Canvas API (a ~8% safety
  //    margin covers the residual gap between canvas and freetype's own
  //    metrics once both use the identical font file) and wrapped onto
  //    additional lines rather than shrunk to fit on one;
  //  - only if that still needs more than 4 lines does the font shrink further.
  function buildClipLabel(tokens, joiner, cellW, cellH) {
    var maxLineWidth = cellW - 36; // room for margins (and the box's own padding, when that style is on)
    var maxLines = 4;
    // Divisor and clamp chosen against this tool's actual cell sizes (270
    // for a normal cell, up to 540 for a doubled 'stretch' featured box) —
    // confirmed these numbers actually produce a visibly different size
    // between them (18 vs 32) rather than both landing on the same clamped
    // ceiling, which an earlier, narrower range did without differentiating
    // anything in practice.
    var fontSize = Math.max(14, Math.min(32, Math.round(cellH / 15)));

    function wrapAt(size) {
      var lines = [];
      var current = '';
      for (var i = 0; i < tokens.length; i++) {
        var tok = tokens[i];
        var candidate = current ? current + joiner + tok : tok;
        if (!current || measureLabelTextWidth(candidate, size) * 1.08 <= maxLineWidth) {
          current = candidate;
        } else {
          lines.push(current);
          current = tok;
        }
      }
      if (current) lines.push(current);
      return lines;
    }

    var lines = wrapAt(fontSize);
    while (lines.length > maxLines && fontSize > 12) {
      fontSize -= 1;
      lines = wrapAt(fontSize);
    }
    return { text: lines.join(String.fromCharCode(10)), fontSize: fontSize };
  }

  // Only beyond 9 credited animators (rare) does the list itself get
  // truncated with a "+N more" — short lists never pay that cost, and it
  // only applies to the auto-detected name list, not a custom override
  // (which is one freeform block of text, not a list of discrete names).
  function buildAnimatorLabel(names, cellW, cellH) {
    var extra = 0;
    if (names.length > 9) {
      extra = names.length - 9;
      names = names.slice(0, 9);
    }
    var displayNames = names.slice();
    if (extra > 0) displayNames.push('+' + extra + ' more');
    return buildClipLabel(displayNames, ', ', cellW, cellH);
  }

  // Used for every in-progress status message across trimming and grid
  // export — both can genuinely take a while (grid export especially, since
  // it decodes/re-encodes multiple clips at once), so a spinner distinguishes
  // "still working" from "stalled" at a glance rather than relying on text
  // alone. Never used for a final "done"/error state — those stay plain text.
  // frac: omitted = spinner + text only (as before); a number 0..1 = determinate
  // progress bar; null = indeterminate (moving) bar for a step with no
  // measurable progress.
  function setBusyStatus(el, text, frac) {
    var bar = '';
    if (frac !== undefined) {
      bar = '<div class="sk-progress' + (frac === null ? ' ind' : '') + '"><div class="sk-progress-fill" style="width:' +
        (frac === null ? 0 : Math.round(frac * 100)) + '%"></div></div>';
    }
    el.innerHTML = '<span class="sk-spinner"></span>' + esc(text) +
      (frac === undefined || frac === null ? '' : '<span class="sk-st-pct">' + Math.round(frac * 100) + '%</span>') + bar;
  }

  // Updates an existing bar in place (no re-render, so no flicker).
  function setProgressFraction(el, frac) {
    var fill = el.querySelector('.sk-progress-fill');
    if (!fill) return;
    var pct = Math.round(Math.max(0, Math.min(1, frac)) * 100);
    fill.style.width = pct + '%';
    var label = el.querySelector('.sk-st-pct');
    if (label) label.textContent = pct + '%';
  }

  // Runs ffmpeg.exec while driving the status bar. Progress comes from
  // ffmpeg's own periodic "time=HH:MM:SS.xx" stats line (output time encoded
  // so far) divided by how long the output is expected to be — a plain-text
  // format, so it doesn't depend on ffmpeg.wasm's own progress-event units.
  // `base`/`span` map this one pass onto a slice of a larger multi-step bar.
  // Without an expected duration it falls back to the library's progress
  // event, which is a ratio against the first input's length.
  function execTracked(ffmpeg, args, statusEl, expectedSec, base, span) {
    base = base || 0;
    span = span === undefined ? 1 : span;
    var seenTime = false;
    function report(f) {
      setProgressFraction(statusEl, base + span * Math.max(0, Math.min(0.99, f)));
    }
    function onLog(e) {
      if (!(expectedSec > 0)) return;
      var m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec((e && e.message) || '');
      if (!m) return;
      seenTime = true;
      report((parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3])) / expectedSec);
    }
    function onProg(e) {
      if (expectedSec > 0 || seenTime) return;
      if (e && isFinite(e.progress) && e.progress >= 0) report(e.progress);
    }
    function detach() {
      try { ffmpeg.off('log', onLog); ffmpeg.off('progress', onProg); } catch (err) { /* non-fatal */ }
    }
    try { ffmpeg.on('log', onLog); ffmpeg.on('progress', onProg); } catch (err) { /* no event support — bar just stays put */ }
    return ffmpeg.exec(args).then(function (r) {
      detach();
      setProgressFraction(statusEl, base + span);
      return r;
    }, function (err) { detach(); throw err; });
  }

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
      setBusyStatus(statusEl, 'loading video tool… (first time only, your browser caches it after this)');
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
        'this needs a one-time ~25–30MB download (your browser caches it afterward, so this only happens once) — ' +
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

  // Takes an already-available source buffer rather than fetching p.file_url
  // itself, so the same trim logic works both for a remote post (fetch
  // first, then call this) and a local in-memory result like a freshly
  // generated grid export (already have the bytes, no fetch needed).
  function performTrim(sourceBuffer, sourceExt, inTime, outTime, statusEl, accurate) {
    return getFfmpegConsent(statusEl)
      .then(function () { return ensureFfmpegLoaded(statusEl); })
      .then(function (ffmpeg) {
        var inputName = 'input.' + (sourceExt || 'webm');
        var outputName = accurate ? 'output.mp4' : 'output.' + (sourceExt || 'webm');
        var startedAt = Date.now();
        return ffmpeg.writeFile(inputName, new Uint8Array(sourceBuffer)).then(function () {
          var args;
          if (accurate) {
            setBusyStatus(statusEl, 'trimming (re-encoding for frame accuracy — slower)…', 0);
            // `-ss`/`-to` placed AFTER `-i`, with real encoders instead of `-c copy`:
            // stream-copy can only cut on keyframe boundaries since it never decodes
            // the video, so the actual start/end can drift from what was marked.
            // Re-encoding is the only way to land on the exact requested frame —
            // slower and a generation of quality loss, but genuinely frame-accurate.
            args = ['-i', inputName, '-ss', String(inTime), '-to', String(outTime),
              '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15', '-c:a', 'aac', outputName];
          } else {
            setBusyStatus(statusEl, 'trimming (fast mode)…', 0);
            // Fast stream-copy: no decoding, just remuxing existing compressed data —
            // much quicker, but can only cut on the nearest keyframe, so the actual
            // start/end may land a little before/after what was marked.
            args = ['-ss', String(inTime), '-to', String(outTime), '-i', inputName, '-c', 'copy', outputName];
          }
          return execTracked(ffmpeg, args, statusEl, outTime - inTime);
        }).then(function () {
          return ffmpeg.readFile(outputName);
        }).then(function (data) {
          var seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
          statusEl.textContent = 'done in ' + seconds + 's';
          var ext = accurate ? 'mp4' : (sourceExt || 'webm');
          return { blob: new Blob([data.buffer], { type: 'video/' + ext }), ext: ext };
        });
      });
  }

  // ---------- Export options (format / quality) for the download windows ----------
  // Ported from Klippit's export logic: MP4 re-encodes with libx264 at a
  // chosen CRF, GIF uses a single palettegen+paletteuse graph, APNG is a
  // direct lossless pass with -plays 0 (loop forever). Resolution means the
  // SHORT side of the frame (so 480p is sensible for portrait grids too) and
  // never upscales. GIF/APNG have no audio, so audio is dropped for them.
  function performExport(sourceBuffer, sourceExt, inTime, outTime, opts, statusEl) {
    return getFfmpegConsent(statusEl)
      .then(function () { return ensureFfmpegLoaded(statusEl); })
      .then(function (ffmpeg) {
        var inputName = 'input.' + (sourceExt || 'mp4');
        var outExt = opts.format === 'gif' ? 'gif' : opts.format === 'apng' ? 'png' : 'mp4';
        var outputName = 'output.' + outExt;
        var paletteName = 'palette.png';
        var startedAt = Date.now();
        var hasRange = inTime !== null && outTime !== null;
        // How long the output will be — what the progress bar measures against.
        var expectedSec = hasRange ? (outTime - inTime) : (opts.duration || 0);

        var scale = '';
        if (opts.res && opts.srcW && opts.srcH && Math.min(opts.srcW, opts.srcH) > opts.res) {
          scale = opts.srcH <= opts.srcW ? ('scale=-2:' + opts.res) : ('scale=' + opts.res + ':-2');
        }
        // Range as INPUT options: seeks first, then decodes+re-encodes only
        // the wanted span, still frame-accurate since this always re-encodes.
        var inArgs = hasRange ? ['-ss', String(inTime), '-to', String(outTime), '-i', inputName] : ['-i', inputName];
        var shape = 'fps=' + opts.fps + (scale ? ',' + scale + ':flags=lanczos' : '');
        var label = opts.format.toUpperCase();

        function cleanup() {
          [inputName, outputName, paletteName].forEach(function (n) { ffmpeg.deleteFile(n).catch(function () {}); });
        }

        return ffmpeg.writeFile(inputName, new Uint8Array(sourceBuffer)).then(function () {
          if (opts.format === 'gif') {
            // Two passes (palette, then encode) rather than one split graph:
            // the palette pass can't report progress (it emits a single
            // frame at the very end), so it gets a moving bar of its own and
            // the encode pass gets the real percentage.
            setBusyStatus(statusEl, 'GIF 1 of 2: building palette…', null);
            return ffmpeg.exec(inArgs.concat(['-vf', shape + ',palettegen', paletteName])).then(function () {
              setBusyStatus(statusEl, 'GIF 2 of 2: encoding…', 0);
              return execTracked(ffmpeg, inArgs.concat([
                '-i', paletteName,
                '-filter_complex', shape + '[x];[x][1:v]paletteuse=dither=bayer',
                '-loop', '0', outputName]), statusEl, expectedSec);
            });
          }
          var args = inArgs.slice();
          if (opts.format === 'apng') {
            args.push('-an', '-vf', shape, '-plays', '0', '-f', 'apng', outputName);
          } else {
            args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(opts.crf));
            if (scale) args.push('-vf', scale);
            if (opts.mute) args.push('-an'); else args.push('-c:a', 'aac');
            args.push(outputName);
          }
          setBusyStatus(statusEl, 'exporting ' + label + '… (re-encoding — can take a while for long or large clips)', 0);
          return execTracked(ffmpeg, args, statusEl, expectedSec);
        }).then(function () {
          return ffmpeg.readFile(outputName);
        }).then(function (data) {
          cleanup();
          statusEl.textContent = 'done in ' + ((Date.now() - startedAt) / 1000).toFixed(1) + 's' +
            ' (' + (data.length / 1048576).toFixed(1) + ' MB)';
          var mime = outExt === 'mp4' ? 'video/mp4' : 'image/' + (outExt === 'gif' ? 'gif' : 'png');
          return { blob: new Blob([data.buffer], { type: mime }), ext: outExt };
        }, function (err) { cleanup(); throw err; });
      });
  }

  // Adds a quiet "more options" tickbox + a collapsible settings block above
  // the Download buttons. Returns getOpts(): null while unticked (so callers
  // keep their existing behavior untouched), else the chosen settings.
  function buildExportOptions(box, vid, hasAudio) {
    var wrap = document.createElement('div');
    wrap.className = 'sk-trim-row';
    wrap.innerHTML =
      '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:' + C.dim + ';cursor:pointer">' +
        '<input type="checkbox" id="sk-more-opts" style="accent-color:' + C.amber + '">' +
        'more options (format, quality)' +
      '</label>';
    box.appendChild(wrap);

    var panel = document.createElement('div');
    panel.className = 'sk-trim-row';
    panel.style.display = 'none';
    var selStyle = 'style="min-width:0"';
    panel.innerHTML =
      '<span class="sk-trim-label">format</span>' +
      '<select class="sk-select" id="sk-xo-fmt" ' + selStyle + '>' +
        '<option value="mp4">MP4</option><option value="gif">GIF</option><option value="apng">APNG</option></select>' +
      '<span class="sk-trim-label">size</span>' +
      '<select class="sk-select" id="sk-xo-res" ' + selStyle + '></select>' +
      '<span id="sk-xo-crf-wrap" style="display:flex;align-items:center;gap:6px">' +
        '<span class="sk-trim-label">crf <b id="sk-xo-crf-val">23</b></span>' +
        '<input type="range" id="sk-xo-crf" min="15" max="35" value="23" style="width:90px;accent-color:' + C.amber + '" ' +
        'title="lower = better quality, bigger file">' +
      '</span>' +
      '<span id="sk-xo-fps-wrap" style="display:none;align-items:center;gap:6px">' +
        '<span class="sk-trim-label">fps</span>' +
        '<select class="sk-select" id="sk-xo-fps" ' + selStyle + '>' +
          '<option value="24">24</option><option value="15" selected>15</option><option value="10">10</option></select>' +
      '</span>' +
      (hasAudio
        ? '<label id="sk-xo-mute-wrap" style="display:flex;align-items:center;gap:6px;font-size:11px;color:' + C.dim + ';cursor:pointer">' +
          '<input type="checkbox" id="sk-xo-mute" style="accent-color:' + C.amber + '">mute audio</label>'
        : '');
    box.appendChild(panel);

    var tick = wrap.querySelector('#sk-more-opts');
    var fmt = panel.querySelector('#sk-xo-fmt');
    var res = panel.querySelector('#sk-xo-res');
    var crf = panel.querySelector('#sk-xo-crf');
    var crfVal = panel.querySelector('#sk-xo-crf-val');
    var fps = panel.querySelector('#sk-xo-fps');
    var mute = panel.querySelector('#sk-xo-mute');
    var muteWrap = panel.querySelector('#sk-xo-mute-wrap');

    function syncFormat() {
      var isMp4 = fmt.value === 'mp4';
      panel.querySelector('#sk-xo-crf-wrap').style.display = isMp4 ? 'flex' : 'none';
      panel.querySelector('#sk-xo-fps-wrap').style.display = isMp4 ? 'none' : 'flex';
      if (muteWrap) muteWrap.style.display = isMp4 ? 'flex' : 'none';
    }
    // Booru clips are 480p, so bigger-than-source choices are pointless —
    // only offer sizes below the actual video's short side (a large grid
    // or serial export can still be scaled down). Rebuilt once the video's
    // real dimensions are known.
    function refreshResOptions() {
      var short = Math.min(vid.videoWidth || 0, vid.videoHeight || 0);
      var html = '<option value="0">Source</option>';
      [480, 360, 240].forEach(function (h) {
        if (!short || h < short) html += '<option value="' + h + '">' + h + 'p</option>';
      });
      var prev = res.value;
      res.innerHTML = html;
      res.value = prev;
      if (!res.value) res.value = '0';
    }
    function applyFormatDefaultRes() {
      // GIF/APNG get big fast, so start small when a smaller size exists.
      res.value = fmt.value === 'mp4' ? '0' : '480';
      if (!res.value) res.value = '0'; // 480p isn't offered when the video is already 480p or smaller
    }
    refreshResOptions();
    vid.addEventListener('loadedmetadata', refreshResOptions);
    fmt.onchange = function () {
      applyFormatDefaultRes();
      syncFormat();
    };
    crf.oninput = function () { crfVal.textContent = crf.value; };
    tick.onchange = function () { panel.style.display = tick.checked ? 'flex' : 'none'; };

    return function getOpts() {
      if (!tick.checked) return null;
      return {
        format: fmt.value,
        res: parseInt(res.value, 10) || 0,
        crf: parseInt(crf.value, 10) || 23,
        fps: parseInt(fps.value, 10) || 15,
        mute: !!(mute && mute.checked),
        srcW: vid.videoWidth || 0,
        srcH: vid.videoHeight || 0,
        duration: isFinite(vid.duration) ? vid.duration : 0
      };
    };
  }

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

  // Native <video> metadata loading is faster and simpler than shelling out
  // to ffmpeg just to read a duration — no need to touch the wasm side for this.
  // Accepts either plain seconds ("7.5") or MM:SS ("1:23") for the advanced
  // per-clip trim range and custom-duration inputs. Returns null for
  // anything blank or unparseable, rather than guessing.
  function parseTimeInput(str) {
    str = (str || '').trim();
    if (!str) return null;
    if (str.indexOf(':') !== -1) {
      var parts = str.split(':');
      var mins = parseInt(parts[0], 10);
      var secs = parseFloat(parts[1]);
      if (isNaN(mins) || isNaN(secs)) return null;
      return mins * 60 + secs;
    }
    var n = parseFloat(str);
    return isNaN(n) ? null : n;
  }
  function formatTimeInput(seconds) {
    if (seconds == null || isNaN(seconds)) return '';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // Fractional-second display for the frame bar/trim labels — distinct from
  // formatTimeInput above, which is whole-second and meant for editable text
  // fields, not a live-updating playhead display.
  function formatVideoTime(t) {
    var m = Math.floor(t / 60);
    var s = t - m * 60;
    var sStr = s.toFixed(1);
    if (s < 10) sStr = '0' + sStr;
    return m + ':' + sStr;
  }

  // Shared by the post viewer and the grid-result preview — frame-accurate
  // review is the whole point of sakuga, so both get the same stepping
  // controls rather than the grid result getting a stripped-down version.
  // fps is only ever a display/step-size approximation (browser seeking
  // can't guarantee landing on an exact decoded frame), not a claim of
  // true frame accuracy.
  function buildFrameSteppingBar(box, vid, fps) {
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

    function updateDisplay() {
      var total = Math.round((vid.duration || 0) * fps);
      var cur = Math.round(vid.currentTime * fps);
      countEl.textContent = cur + ' / ' + total;
      timeEl.textContent = formatVideoTime(vid.currentTime) + ' / ' + formatVideoTime(vid.duration || 0);
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
  }

  // Real tag names on this booru always write a colon-subtitle boundary as
  // ":_" (space becomes underscore just like everywhere else) — e.g.
  // "re:_zero_kara_hajimeru...", "hunter_x_hunter:_greed_island". The type
  // input's own space->underscore conversion means typing "re: zero" (a
  // literal space after the colon) happens to reconstruct that exact ":_"
  // sequence and matches fine, while "re:zero" (no space) doesn't — an
  // arbitrary, non-obvious requirement to type a space there. Collapsing
  // ":_" to ":" on both sides of the comparison makes the colon match
  // regardless of whether that incidental space was typed.
  function normalizeForTagMatch(s) {
    return (s || '').replace(/:_/g, ':');
  }

  function probeVideoDuration(url) {
    return new Promise(function (resolve) {
      var v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.src = url;
      var done = false;
      function finish(d) {
        if (done) return;
        done = true;
        v.src = '';
        resolve(d);
      }
      v.addEventListener('loadedmetadata', function () { finish(v.duration || 0); });
      v.addEventListener('error', function () { finish(0); }); // unreadable — treated as 0, excluded from the max-duration calc
      setTimeout(function () { finish(0); }, 15000); // don't let one bad clip hang the whole export
    });
  }

  // Advanced-only: extracts a clip's chosen sub-range to its own file before
  // looping it. Confirmed directly (against real ffmpeg) that looping and
  // trimming the SAME input together doesn't do what you'd expect — combining
  // -stream_loop with input-side -ss/-t on one -i either has no looping
  // effect at all, or (seeking after -i instead) loops the WHOLE original
  // clip and just starts playback at an offset — meaning a "trim to 5-15s"
  // selection would eventually drift into showing 15s+ content once the
  // target duration ran long enough, not repeat 5-15s indefinitely. The only
  // way that actually holds up: extract the sub-range to a real intermediate
  // file first, then loop that file like any other input. Costs a real,
  // separate encode pass per trimmed clip — worth knowing before turning on
  // trims for a lot of clips at once.
  function extractTrimSegment(ffmpeg, inputName, start, duration, outputName, statusEl, base, span) {
    return execTracked(ffmpeg, [
      '-ss', String(start), '-t', String(duration), '-i', inputName,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
      outputName
    ], statusEl, duration, base, span);
  }

  // Names credited on one clip: its artist-type tags, title-cased.
  function clipAnimatorNames(p) {
    return safeMap(
      safeFilter((p.tags || '').split(/\s+/), function (t) { return t && tagTypeMap && tagTypeMap[t] === 1; }),
      function (t) { return titleCase(t.replace(/_/g, ' ')); }
    );
  }

  // The text block drawn on one clip: the custom override if there is one
  // (wrapped at its own word breaks), else the animator names, else null.
  // Shared by the real export and the composer's live preview so the two
  // can never disagree about what a label says or how it wraps.
  function buildLabelFor(p, override, cellW, cellH) {
    if (override && override.trim()) {
      return buildClipLabel(safeFilter(override.trim().split(/\s+/), function (w) { return !!w; }), ' ', cellW, cellH);
    }
    var names = clipAnimatorNames(p);
    return names.length ? buildAnimatorLabel(names, cellW, cellH) : null;
  }

  function performGridExport(clips, statusEl, orientation, mode, trims, loopMode, labelMode, format, labelStyle, labelOverrides, musicFiles, musicLoop, labelPos) {
    if (clips.length < 2) return Promise.reject(new Error('need at least 2 video clips in this pool'));
    // Each entry in clips is a {post, instId} occurrence, not a bare post —
    // this is what lets the same clip appear twice in a sequence (see the
    // export panel's 'duplicate' button) with its own independent trim
    // range and label the second time. Flattening to the post's own fields
    // plus .id = instId here, once, means nothing below this point needs to
    // change at all: every existing p.id / p.file_url / p.tags / p.file_ext
    // reference already does the right thing, whether or not this
    // particular occurrence shares its underlying post with another one.
    clips = safeMap(clips, function (c) {
      var flat = {};
      for (var k in c.post) { if (Object.prototype.hasOwnProperty.call(c.post, k)) flat[k] = c.post[k]; }
      flat.id = c.instId;
      return flat;
    });
    trims = trims || {};
    loopMode = loopMode || 'replay';
    labelMode = labelMode || 'off';
    format = format || 'grid';
    labelStyle = labelStyle || 'outline';
    labelOverrides = labelOverrides || {};
    musicFiles = musicFiles || [];
    labelPos = labelPos || { fx: 0, fy: 1 };

    return getFfmpegConsent(statusEl)
      .then(function () { return ensureFfmpegLoaded(statusEl); })
      .then(function (ffmpeg) {
        var fontReady = labelMode !== 'off' ? ensureLabelFont(ffmpeg) : Promise.resolve();
        var tagsReady = labelMode !== 'off' ? ensureTagTypes() : Promise.resolve();
        return Promise.all([fontReady, tagsReady]).then(function () {
        setBusyStatus(statusEl, 'checking clip lengths…', null);
        return Promise.all(safeMap(clips, function (p) { return probeVideoDuration(p.file_url); })).then(function (naturalDurations) {
          // Effective duration is the trimmed range's length when a clip has
          // one, not the full clip's natural length. For grid mode this
          // feeds the target-duration/looping decision; for serial mode
          // there's no target to loop toward — each clip just plays once,
          // for however long its own (possibly trimmed) length is — but the
          // number is still needed there too, just for the trim-extraction
          // step below, not for any duration/looping decision.
          var effectiveDurations = safeMap(clips, function (p, i) {
            var trim = trims[p.id];
            if (!trim) return naturalDurations[i];
            var end = Math.min(trim.end, naturalDurations[i] > 0 ? naturalDurations[i] : trim.end);
            return Math.max(0.1, end - trim.start);
          });

          var targetDuration = 1; // guard against every probe failing; unused in serial mode
          for (var di = 0; di < effectiveDurations.length; di++) {
            if (effectiveDurations[di] > targetDuration) targetDuration = effectiveDurations[di];
          }

          // Serial mode has no grid to subdivide — every clip gets the same
          // single, larger frame (see SERIAL_LONG/SHORT) instead of a
          // computed cell position within a shared canvas.
          var positions, canvasW, canvasH;
          if (format === 'serial') {
            var serialW = orientation === 'portrait' ? SERIAL_SHORT : SERIAL_LONG;
            var serialH = orientation === 'portrait' ? SERIAL_LONG : SERIAL_SHORT;
            canvasW = serialW; canvasH = serialH;
            positions = safeMap(clips, function () { return { x: 0, y: 0, w: serialW, h: serialH }; });
          } else {
            positions = computeCellPositions(clips.length, orientation, mode);
            canvasW = 0; canvasH = 0;
            for (var pi0 = 0; pi0 < positions.length; pi0++) {
              if (positions[pi0].x + positions[pi0].w > canvasW) canvasW = positions[pi0].x + positions[pi0].w;
              if (positions[pi0].y + positions[pi0].h > canvasH) canvasH = positions[pi0].y + positions[pi0].h;
            }
          }

          // Fetch + write each input sequentially rather than all at once —
          // keeps peak memory lower given everything is decoded/held in the
          // same wasm heap during the actual encode step regardless.
          // Progress bar budget across the whole export: fetching clips,
          // extracting trims (if any), combining music (if more than one
          // track) and the main encode, which gets whatever's left.
          var trimCount = 0;
          clips.forEach(function (p) { if (trims[p.id]) trimCount++; });
          var fetchW = 0.1;
          var trimW = trimCount ? 0.2 : 0;
          var musicW = musicFiles.length > 1 ? 0.05 : 0;
          var compBase = fetchW + trimW + musicW;
          var compSpan = 1 - compBase;

          var writeChain = Promise.resolve();
          clips.forEach(function (p, i) {
            writeChain = writeChain.then(function () {
              setBusyStatus(statusEl, 'fetching clip ' + (i + 1) + ' of ' + clips.length + '…', fetchW * (i / clips.length));
              return fetch(p.file_url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
                return ffmpeg.writeFile('grid_in' + i + '.' + (p.file_ext || 'mp4'), new Uint8Array(buf));
              });
            });
          });

          // Extract each trimmed clip's sub-range to its own file — has to
          // happen after every clip is downloaded (each is its own ffmpeg
          // exec pass) but before the main compositing pass, which needs to
          // know the final filename for every input up front.
          var effectiveNames = new Array(clips.length);
          var trimDone = 0;
          clips.forEach(function (p, i) {
            effectiveNames[i] = 'grid_in' + i + '.' + (p.file_ext || 'mp4');
            var trim = trims[p.id];
            if (!trim) return;
            writeChain = writeChain.then(function () {
              var tBase = fetchW + trimW * (trimDone / trimCount);
              var tSpan = trimW / trimCount;
              trimDone++;
              setBusyStatus(statusEl, 'trimming clip ' + (i + 1) + ' of ' + clips.length + '…', tBase);
              var outputName = 'grid_trim' + i + '.mp4';
              return extractTrimSegment(ffmpeg, effectiveNames[i], trim.start, trim.end - trim.start, outputName, statusEl, tBase, tSpan).then(function () {
                effectiveNames[i] = outputName;
              });
            });
          });

          return writeChain.then(function () {
            var startedAt = Date.now();
            var args = [];
            var filterParts = [];

            // Explicit black background, then chained `overlay` filters
            // instead of `xstack` — confirmed directly (by reproducing this
            // exact filter graph locally, not just reasoned about) that
            // xstack leaves any canvas area no input covers as uninitialized
            // memory rather than actually black, which rendered as bright
            // green in exactly the gaps a "center leftover row" layout
            // produces. Only grid mode needs this at all — serial mode's
            // concat has no gaps to cover, every clip fills the one shared
            // frame completely in its own turn.
            if (format === 'grid') {
              filterParts.push('color=c=black:s=' + canvasW + 'x' + canvasH + ':r=24[bg]');
            }

            clips.forEach(function (p, i) {
              var needsLoop = format === 'grid' && effectiveDurations[i] > 0 && effectiveDurations[i] < targetDuration - 0.1;
              var willStopInstead = needsLoop && loopMode === 'stop';
              if (needsLoop && !willStopInstead) args.push('-stream_loop', '-1');
              args.push('-i', effectiveNames[i]);
              // Every box — including a 'stretch' mode featured clip's, or
              // serial mode's single shared frame — is sized to the
              // source's own natural aspect ratio, so the same
              // aspect-preserving scale+pad works uniformly everywhere; no
              // distortion needed anywhere.
              var pos = positions[i];
              var chain =
                '[' + i + ':v]scale=' + pos.w + ':' + pos.h +
                ':force_original_aspect_ratio=decrease,pad=' + pos.w + ':' + pos.h +
                ':(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=24';
              if (willStopInstead) {
                // Confirmed directly (against real ffmpeg, with a clip whose
                // content changes partway through so looping vs. freezing
                // would actually look different) that tpad's clone mode
                // holds the clip's own last frame rather than restarting it
                // — this is a genuine freeze, not a disguised loop. Without
                // this, simply omitting -stream_loop would let this input
                // hit EOF early and cut the whole composite short at that
                // point, since xstack/overlay's default policy is bounded
                // by the shortest input. (Serial mode never sets needsLoop
                // in the first place, so this never applies there — every
                // clip in a sequence is meant to just play through once.)
                chain += ',tpad=stop_mode=clone:stop_duration=' + (targetDuration - effectiveDurations[i]).toFixed(2);
              }
              if (labelMode !== 'off') {
                // A custom label replaces the auto-detected staff names
                // entirely for this clip; otherwise only this clip's own
                // animator tags are used (not the show or other tags).
                var built = buildLabelFor(p, labelOverrides[p.id], pos.w, pos.h);
                if (built) {
                  // Free room = frame size minus the text block; the label sits
                  // at that fraction of it (0 = left/top, 1 = right/bottom),
                  // then is clamped to keep a 10px margin from every edge.
                  // The escaped commas are required inside a filtergraph.
                  var fxNum = Math.max(0, Math.min(1, Number(labelPos.fx))) || 0;
                  var fyNum = Math.max(0, Math.min(1, Number(labelPos.fy)));
                  if (isNaN(fyNum)) fyNum = 1;
                  var xExpr = 'max(10\\,min(w-tw-10\\,(w-tw)*' + fxNum.toFixed(4) + '))';
                  var yExpr = 'max(10\\,min(h-th-10\\,(h-th)*' + fyNum.toFixed(4) + '))';
                  var styleExpr = labelStyle === 'box'
                    ? 'box=1:boxcolor=black@0.5:boxborderw=6'
                    : 'bordercolor=black:borderw=2';
                  chain += ',drawtext=fontfile=label_font.ttf:text=\'' + escapeDrawtext(built.text) + '\'' +
                    ':fontsize=' + built.fontSize + ':fontcolor=white:' + styleExpr + ':line_spacing=4' +
                    ':x=' + xExpr + ':y=' + yExpr;
                }
              }
              filterParts.push(chain + '[v' + i + ']');
            });

            if (format === 'serial') {
              // Confirmed directly (against real ffmpeg, including a
              // mid-sequence trimmed clip and per-clip labels together) that
              // concat plays each input fully, in order, for its own
              // natural/trimmed length — no explicit background or
              // positions needed, unlike the grid's overlay chain, since
              // nothing ever shares the frame with anything else.
              var concatInputs = safeMap(clips, function (p, i) { return '[v' + i + ']'; }).join('');
              filterParts.push(concatInputs + 'concat=n=' + clips.length + ':v=1:a=0[outv]');
            } else {
              var prevLabel = 'bg';
              clips.forEach(function (p, i) {
                var pos = positions[i];
                var outLabel = (i === clips.length - 1) ? 'outv' : 't' + i;
                filterParts.push('[' + prevLabel + '][v' + i + ']overlay=' + pos.x + ':' + pos.y + '[' + outLabel + ']');
                prevLabel = outLabel;
              });
            }

            var filterComplex = filterParts.join(';');

            // Serial mode's own total length is the SUM of every clip's
            // real length (nothing overlaps in time); grid mode's is
            // whatever the longest single clip's own length is (everything
            // else loops or freezes to fill that). Only actually needed as
            // an explicit cap when music is involved (see below) — grid
            // mode already computed and used targetDuration for its own -t
            // regardless of music.
            var outputDurationSec = targetDuration;
            if (format === 'serial') {
              outputDurationSec = 0;
              for (var sdi = 0; sdi < effectiveDurations.length; sdi++) outputDurationSec += effectiveDurations[sdi];
            }

            // Reading the uploaded music file is plain synchronous-feeling
            // browser I/O (no separate ffmpeg pass needed, unlike the
            // trim-extraction step), so this can happen right before the
            // main exec call rather than earlier in the pipeline.
            // Reading the uploaded music file(s) is plain synchronous-feeling
            // browser I/O (no separate ffmpeg pass needed for a single
            // track, unlike the trim-extraction step), so this can happen
            // right before the main exec call rather than earlier in the
            // pipeline.
            var musicReady = musicFiles.length === 0
              ? Promise.resolve(null)
              : Promise.all(safeMap(musicFiles, function (f, i) {
                  return f.arrayBuffer().then(function (buf) {
                    var ext = (f.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
                    var name = 'grid_music_in' + i + '.' + ext;
                    return ffmpeg.writeFile(name, new Uint8Array(buf)).then(function () { return name; });
                  });
                })).then(function (musicNames) {
                  if (musicNames.length === 1) return musicNames[0];
                  // More than one track: combine them into a single track
                  // first, in their own separate ffmpeg pass, before this
                  // gets treated as "the music" for everything below —
                  // confirmed directly (against real ffmpeg, using three
                  // tracks with deliberately different sample rates,
                  // channel layouts, and even container formats/codecs)
                  // that normalizing each to a common sample rate and
                  // channel layout via aformat before concatenating
                  // produces a correctly-ordered combined track regardless
                  // of how mismatched the originals were — verified by
                  // checking the dominant frequency of three distinct test
                  // tones landed in the right order at the right times in
                  // the combined result, not just that the total duration
                  // added up.
                  var inputArgs = [];
                  var filterParts = [];
                  musicNames.forEach(function (name, i) {
                    inputArgs.push('-i', name);
                    filterParts.push('[' + i + ':a]aformat=sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[ma' + i + ']');
                  });
                  var concatInputs = safeMap(musicNames, function (n, i) { return '[ma' + i + ']'; }).join('');
                  filterParts.push(concatInputs + 'concat=n=' + musicNames.length + ':v=0:a=1[outa]');
                  var combinedName = 'grid_music_combined.m4a';
                  var concatArgs = inputArgs.concat([
                    '-filter_complex', filterParts.join(';'), '-map', '[outa]',
                    '-c:a', 'aac', '-b:a', '192k', combinedName
                  ]);
                  setBusyStatus(statusEl, 'combining ' + musicNames.length + ' music tracks…', null);
                  return ffmpeg.exec(concatArgs).then(function () {
                    musicNames.forEach(function (name) { ffmpeg.deleteFile(name).catch(function () {}); });
                    return combinedName;
                  });
                });

            return musicReady.then(function (musicName) {
              if (musicName) {
                // Confirmed directly (against real ffmpeg) that mixing a
                // LONGER audio track in without an explicit -t is genuinely
                // broken, not just untidy: it silently extends the whole
                // output past where the video itself ends (the video
                // stream simply has no frames there, while the container
                // still claims the longer duration) rather than the video
                // freezing or looping. An explicit -t matching the video's
                // own real length avoids that regardless of format.
                //
                // For a SHORTER track, -stream_loop -1 (the same technique
                // already used to loop a shorter video clip elsewhere in
                // this file) repeats it to fill the remainder instead of
                // leaving silence, when that's what's asked for. Confirmed
                // directly this is a genuine loop, not just an extended
                // duration: comparing raw waveform samples at the same
                // offset in two different loop iterations showed identical
                // values (an AAC-encoded first attempt at this same
                // comparison showed mismatched samples, which turned out to
                // be a lossy-compression artifact from encoding the test
                // source itself, not an actual looping bug — re-verified
                // with uncompressed PCM audio throughout to be sure).
                var musicInputIndex = clips.length;
                if (musicLoop) args.push('-stream_loop', '-1');
                args.push('-i', musicName);
                args.push('-filter_complex', filterComplex, '-map', '[outv]', '-map', musicInputIndex + ':a');
                args.push('-t', String(outputDurationSec.toFixed(2)));
                args.push('-c:a', 'aac', '-b:a', '192k');
              } else {
                args.push('-filter_complex', filterComplex, '-map', '[outv]', '-an');
                // Only grid mode needs an explicit cap without music — its
                // duration is "however long until every looping/frozen clip
                // has filled the longest one", which needs the -t to
                // actually stop there. Serial mode's own total length
                // already falls out naturally from concatenating each
                // clip's real length once.
                if (format === 'grid') args.push('-t', String(targetDuration.toFixed(2)));
              }
              args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-r', '24', 'grid_out.mp4');

              setBusyStatus(statusEl, (format === 'serial' ? 'joining clips' : 'compositing grid') + ' (this can take a while)…', compBase);
              return execTracked(ffmpeg, args, statusEl, outputDurationSec, compBase, compSpan).then(function () {
                return ffmpeg.readFile('grid_out.mp4');
              }).then(function (data) {
              var seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
              statusEl.textContent = 'done in ' + seconds + 's';
              // Best-effort cleanup — frees the wasm heap for a subsequent
              // export in the same session; a failure here doesn't affect
              // the result already in hand.
              clips.forEach(function (p, i) {
                ffmpeg.deleteFile('grid_in' + i + '.' + (p.file_ext || 'mp4')).catch(function () {});
                if (trims[p.id]) ffmpeg.deleteFile('grid_trim' + i + '.mp4').catch(function () {});
              });
              ffmpeg.deleteFile('grid_out.mp4').catch(function () {});
              if (musicName) ffmpeg.deleteFile(musicName).catch(function () {});
              return { blob: new Blob([data.buffer], { type: 'video/mp4' }), width: canvasW, height: canvasH, count: clips.length, hasAudio: !!musicName };
            });
            });
          });
        });
        });
      });
  }

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
      setBusyStatus(statusEl, 'checking…');
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
      setBusyStatus(statusEl, 'posting…');
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
    row.innerHTML = '<button class="sk-frame-btn" id="sk-comments-toggle">Comments</button>';
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

  function openAddToPoolModal(post) {
    var backdrop = document.createElement('div');
    backdrop.className = 'sk-media-backdrop';
    var box = document.createElement('div');
    box.className = 'sk-login-box';
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    function close() {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });

    function render() {
      var pools = getLocalPools();
      box.innerHTML =
        '<div class="sk-login-title">Add to Pool</div>' +
        (pools.length
          ? '<div id="sk-atp-list"></div>'
          : '<div class="sk-caption">no pools yet</div>') +
        '<div class="sk-row" style="margin-top:4px">' +
          '<input class="sk-input" id="sk-atp-new-name" placeholder="new pool name">' +
          '<button class="sk-btn" id="sk-atp-new-go">Create</button>' +
        '</div>' +
        '<span class="sk-login-cancel" id="sk-atp-cancel">close</span>';

      box.querySelector('#sk-atp-cancel').onclick = close;

      var listEl = box.querySelector('#sk-atp-list');
      if (listEl) {
        pools.forEach(function (pl) {
          var already = !!safeFilter(pl.posts, function (x) { return x.id === post.id; }).length;
          var item = document.createElement('div');
          item.className = 'sk-show-pick' + (already ? ' off' : '');
          item.innerHTML = '<span class="name">' + esc(pl.name) + '</span><span class="cnt">' + (already ? 'added' : pl.posts.length) + '</span>';
          if (!already) {
            item.onclick = function () {
              addPostToLocalPool(pl.id, post);
              render();
            };
          }
          listEl.appendChild(item);
        });
      }

      var nameInput = box.querySelector('#sk-atp-new-name');
      box.querySelector('#sk-atp-new-go').onclick = function () {
        var name = nameInput.value.trim();
        if (!name) return;
        var pool = createLocalPool(name, '');
        addPostToLocalPool(pool.id, post);
        render();
      };
      nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') box.querySelector('#sk-atp-new-go').onclick(); });
    }
    render();
  }

  function buildMediaShell(p) {
    var backdrop = document.createElement('div');
    backdrop.className = 'sk-media-backdrop';
    var box = document.createElement('div');
    box.className = 'sk-media-box';
    box.innerHTML =
      '<div class="sk-media-top">' +
        '<span class="sk-badge score" id="sk-vote-score">' + (p.score || 0) + '</span>' +
        '<span class="sk-stars" id="sk-stars" title="rate 1-3 stars — click again anytime to change your rating">' +
          '<span class="sk-star" data-n="1">&#9733;</span>' +
          '<span class="sk-star" data-n="2">&#9733;</span>' +
          '<span class="sk-star" data-n="3">&#9733;</span>' +
          '<span class="sk-star-clear" id="sk-star-clear" title="clear your rating">&times;</span>' +
        '</span>' +
        '<span class="sk-badge">' + esc(p.rating || '?') + '</span>' +
        '<a href="/post/show/' + p.id + '" target="_blank" rel="noopener" class="sk-media-viewpost">view post ↗</a>' +
        '<span class="sk-media-viewpost" id="sk-copy-link" style="cursor:pointer;margin-left:8px" title="copy a link to this post">Copy Link</span>' +
        '<span class="sk-media-viewpost" id="sk-add-pool" style="cursor:pointer;margin-left:8px" title="add this clip to a pool">Add to Pool</span>' +
        '<span class="sk-media-close" id="sk-media-close" title="close">&times;</span>' +
      '</div>';
    backdrop.appendChild(box);
    document.body.appendChild(backdrop); // attach to the real page body so it overlays everything, not just our small panel

    var scoreEl = box.querySelector('#sk-vote-score');
    var starsWrap = box.querySelector('#sk-stars');
    var starEls = starsWrap.querySelectorAll('.sk-star');
    var clearBtn = box.querySelector('#sk-star-clear');
    var currentRating = getVoteRating(p.id) || 0;
    var currentScoreValue = p.score || 0;
    var submitting = false;

    function paintStars(n) {
      for (var i = 0; i < starEls.length; i++) {
        starEls[i].classList.toggle('filled', (i + 1) <= n);
      }
      clearBtn.classList.toggle('active', n > 0);
    }
    paintStars(currentRating); // instant paint from the local guess, corrected below once real data loads

    // The local guess above is only this browser's own memory — it can be
    // wrong (voted from another device, or never voted despite a stale
    // local entry). Fetch the real per-account state and silently correct
    // the display if it disagrees, without blocking on it first.
    fetchServerVote(p.id).then(function (serverVote) {
      if (submitting) return; // don't clobber an in-flight vote the person just cast
      if (serverVote === undefined) return; // couldn't determine anything real — leave the local guess alone
      var real = serverVote || 0; // null (confirmed no vote) -> 0
      if (real !== currentRating) {
        currentRating = real;
        setVoteRating(p.id, real);
        paintStars(currentRating);
      }
    });

    // Shared by both the 1-3 star clicks and the clear ("×") control below —
    // clearing is just rating with n=0, inferred from the site's own vote
    // widget markup (a distinct "star-0" control alongside stars 1-3,
    // presumably clearing a vote) but not independently confirmed live the
    // way every other piece of this feature was, so worth a real test.
    function submitRating(n) {
      // Real vote behavior turns out to be mutable — re-clicking a
      // different star changes an existing rating rather than being
      // rejected, so this only guards against a second click landing
      // mid-request, not against re-rating in general.
      if (submitting) return;
      var creds = getStoredCredentials();
      if (!creds) { openLoginModal(function () { submitRating(n); }); return; }
      submitting = true;
      castVote(p.id, n, creds.username, creds.passwordHash).then(function (result) {
        var fresh = result && result.posts && result.posts[0];
        // The vote response itself carries the server's own record of your
        // current vote (result.votes[postId]) — trust that over the value
        // we just sent, in case the server ever normalizes/rejects it
        // differently than expected.
        var myVote = result && result.votes && result.votes[String(p.id)];
        var previousRating = currentRating;
        currentRating = myVote || n;
        setVoteRating(p.id, currentRating);
        // Re-voting is delta-based (the server replaces your old star value
        // rather than adding a new one) — confirmed directly (1★→2★ moved
        // score by exactly +1) — so if the response is ever missing the
        // fresh post for some reason, the fallback has to guess
        // score + (new - old), not score + new.
        currentScoreValue = fresh ? fresh.score : currentScoreValue + (n - previousRating);
        scoreEl.textContent = currentScoreValue;
        paintStars(currentRating);
        // The results grid (or a pool grid) this clip was opened from
        // already rendered its own card with the old score baked into
        // static HTML — mutating p.score alone wouldn't touch that DOM, and
        // there was no re-render to pick it up until a fresh search. Update
        // both: the underlying object (so anything rendered *after* this
        // point is correct) and any already-rendered card right now.
        p.score = currentScoreValue;
        var openCards = root.querySelectorAll('.sk-card[data-post-id="' + p.id + '"] .score');
        for (var oc = 0; oc < openCards.length; oc++) {
          openCards[oc].textContent = '\u25B2 ' + currentScoreValue;
        }
      }).catch(function (err) {
        paintStars(currentRating); // revert the hover-preview back to the real current rating
        alert('rating failed: ' + err.message);
      }).then(function () { submitting = false; });
    }

    for (var si = 0; si < starEls.length; si++) {
      (function (starEl) {
        var n = parseInt(starEl.getAttribute('data-n'), 10);
        starEl.addEventListener('mouseenter', function () {
          if (!submitting) paintStars(n);
        });
        starEl.addEventListener('click', function () { submitRating(n); });
      })(starEls[si]);
    }
    clearBtn.addEventListener('mouseenter', function () {
      if (!submitting) paintStars(0);
    });
    clearBtn.addEventListener('click', function () {
      if (currentRating === 0) return; // nothing to clear
      submitRating(0);
    });
    starsWrap.addEventListener('mouseleave', function () {
      if (!submitting) paintStars(currentRating);
    });

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

    box.querySelector('#sk-add-pool').onclick = function () {
      openAddToPoolModal(p);
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

  function openVideoModal(p, onGridPick) {
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
    buildFrameSteppingBar(box, vid, fps);

    // ---- trim range + download/share ----
    // There's no server here, so trimming runs entirely client-side via
    // ffmpeg.wasm (loaded on first use, see below) — a real re-encode, not a
    // stream copy, since stream-copy can only cut on keyframe boundaries and
    // frame-accurate trimming needs an actual decode/re-encode of the range.
    var inTime = null, outTime = null;

    var trimCaption = document.createElement('div');
    trimCaption.className = 'sk-caption';
    trimCaption.style.padding = '8px 10px 0';
    trimCaption.textContent = onGridPick
      ? 'use the frame controls above to find a start/end point, mark them below, then Use This Range to send it back to the grid clip.'
      : 'optional: use the frame controls above to find a start/end point, mark them below, ' +
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

    var getExportOpts = buildExportOptions(box, vid, false); // booru clips never have audio, so no mute option

    var actionRow = document.createElement('div');
    actionRow.className = 'sk-action-row';
    actionRow.innerHTML =
      '<button class="sk-frame-btn" id="sk-dl-full" title="downloads the original file, unmodified">⬇ Download Full</button>' +
      '<button class="sk-frame-btn" id="sk-dl-trim" disabled title="mark a range above first — trims to it and downloads the result (takes a moment)">⬇ Download Trim</button>' +
      (onGridPick ? '<button class="sk-frame-btn" id="sk-use-range" disabled title="mark a range above first">Use This Range</button>' : '');
    box.appendChild(actionRow);

    var statusEl = document.createElement('div');
    statusEl.className = 'sk-action-status';
    box.appendChild(statusEl);

    var inLabel = trimRow.querySelector('#sk-trim-in');
    var outLabel = trimRow.querySelector('#sk-trim-out');
    var dlTrimBtn = actionRow.querySelector('#sk-dl-trim');
    var useRangeBtn = actionRow.querySelector('#sk-use-range');
    var accurateCheckbox = accuracyRow.querySelector('#sk-accurate-trim');

    function updateTrimBtn() {
      var hasTrim = inTime !== null && outTime !== null && outTime > inTime;
      dlTrimBtn.disabled = !hasTrim;
      dlTrimBtn.title = hasTrim
        ? 'trims to your marked range and downloads the result (takes a moment)'
        : 'mark a range above first — trims to it and downloads the result (takes a moment)';
      if (useRangeBtn) {
        useRangeBtn.disabled = !hasTrim;
        useRangeBtn.title = hasTrim ? 'use this marked range for the grid clip' : 'mark a range above first';
      }
    }
    updateTrimBtn(); // set initial button state (no trim range yet)

    if (useRangeBtn) {
      useRangeBtn.onclick = function () {
        if (inTime === null || outTime === null || outTime <= inTime) return;
        onGridPick(inTime, outTime);
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

    box._onClose(function () {
      // ffmpeg.wasm 0.11.x has no clean mid-job cancel; if a trim is running when the
      // modal closes it'll just finish silently in the background rather than error out.
    });

    var dlFullBtn = actionRow.querySelector('#sk-dl-full');
    dlFullBtn.onclick = function () {
      var xo = getExportOpts();
      if (!xo) { triggerDownload(p.file_url, 'sakuga_' + p.id + '.' + (p.file_ext || 'webm')); return; }
      dlFullBtn.disabled = true;
      setBusyStatus(statusEl, 'reading clip…');
      fetch(p.file_url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
        return performExport(buf, p.file_ext, null, null, xo, statusEl);
      }).then(function (res) {
        triggerBlobDownload(res.blob, 'sakuga_' + p.id + '.' + res.ext);
        dlFullBtn.disabled = false;
      }).catch(function (err) {
        if (err.message !== 'cancelled') statusEl.textContent = 'export failed: ' + err.message;
        dlFullBtn.disabled = false;
      });
    };

    dlTrimBtn.onclick = function () {
      if (dlTrimBtn.disabled) return;
      dlTrimBtn.disabled = true;
      setBusyStatus(statusEl, 'reading clip…');
      var xo = getExportOpts();
      fetch(p.file_url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
        return xo ? performExport(buf, p.file_ext, inTime, outTime, xo, statusEl)
                  : performTrim(buf, p.file_ext, inTime, outTime, statusEl, accurateCheckbox.checked);
      }).then(function (res) {
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

  function buildCard(p) {
    var card = document.createElement('div');
    card.className = 'sk-card';
    card.setAttribute('data-post-id', String(p.id)); // lets a vote cast later find this exact card and refresh its score without a full re-render
    var thumb = p.preview_url || p.jpeg_url || p.sample_url;
    var clipUrl = p.file_url;
    var playable = isVideoFile(clipUrl);
    card.innerHTML =
      (thumb ? '<img loading="lazy" src="' + thumb + '">' : '') +
      (playable ? '<video muted loop playsinline preload="none"></video><div class="vidmark">▶ clip</div>' : '') +
      '<div class="score">&#9650; ' + (p.score || 0) + '</div>' +
      '<div class="info-badge" title="tags &amp; info">&#9432;</div>';

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

    // A floating popup anchored to this badge, rather than a dock inline in
    // the results flow — the old version lived at the bottom of the whole
    // grid and had to yank the scroll position to bring itself into view on
    // every hover, which fought with normal browsing. This one just appears
    // next to whatever you clicked and doesn't touch scroll position at all.
    var infoBadge = card.querySelector('.info-badge');
    infoBadge.addEventListener('click', function (e) {
      e.stopPropagation(); // don't also trigger the card's own click-to-open
      openInfoPopup(infoBadge, p);
    });

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

  var UNKNOWN_ARTIST_TAG = 'artist_unknown';
  // Animator-type tags on a post other than the artist_unknown catch-all.
  function countRealAnimators(tags) {
    var n = 0;
    for (var i = 0; i < tags.length; i++) {
      if (tags[i] !== UNKNOWN_ARTIST_TAG && tagTypeMap && tagTypeMap[tags[i]] === 1) n++;
    }
    return n;
  }

  function paintSearchResults(cache) {
    var results = body.querySelector('#sk-results');
    var facetHead = body.querySelector('#sk-facet-head');
    var facetGrid = body.querySelector('#sk-facet-grid');
    var toggle = body.querySelector('#sk-filter-toggle');
    var badge = body.querySelector('#sk-filter-badge');
    var backWrap = body.querySelector('#sk-back-to-shows');

    if (searchHistory.length) {
      var prev = searchHistory[searchHistory.length - 1];
      var prevLabel = prev.tags.join(' ');
      if (prevLabel.length > 40) prevLabel = prevLabel.slice(0, 39) + '…';
      backWrap.style.display = 'block';
      backWrap.innerHTML = '<a href="#" id="sk-back-link" class="sk-mini-toggle" style="display:inline-block;margin-bottom:8px">← back to ' + esc(prevLabel || 'previous search') + '</a>';
      backWrap.querySelector('#sk-back-link').onclick = function (e) {
        e.preventDefault();
        var entry = searchHistory.pop();
        if (!entry) return;
        searchState.tags = entry.tags.slice();
        searchState.order = entry.order;
        searchOrigin = entry.origin;
        var orderSel = body.querySelector('#sk-order');
        if (orderSel) orderSel.value = entry.order;
        renderChips();
        runSearch({ noHistory: true });
      };
    } else if (cache.origin && cache.origin.type === 'shows') {
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

    maybeRenderShowAnimatorsInSearch(body.querySelector('#sk-show-animators-wrap'), cache);

    var soloRow = body.querySelector('#sk-solo-row');
    var soloBtn = body.querySelector('#sk-solo-toggle');
    var unknownBtn = body.querySelector('#sk-unknown-toggle');
    if (cache.posts.length) {
      soloRow.style.display = 'flex';
      // Contradicts a search that already requires 2+ animators to all be
      // credited together (every result would necessarily have 2+ animator
      // tags, so "exactly 1" could never match anything) — disable rather
      // than let someone hit a silently-empty result.
      var soloDisabled = safeFilter(cache.tags, function (t) { return tagTypeMap && tagTypeMap[t] === 1; }).length > 1;
      if (soloDisabled && cache.soloOnly) cache.soloOnly = false;
      soloBtn.disabled = soloDisabled;
      soloBtn.classList.toggle('active', !!cache.soloOnly);
      soloBtn.title = soloDisabled
        ? 'solo cuts only — disabled, this search already requires 2+ animators'
        : (cache.soloOnly ? 'showing solo cuts only (exactly one animator) — click to show all' : 'solo cuts only — exactly one animator credited');
      soloBtn.onclick = function () {
        if (soloBtn.disabled) return;
        cache.soloOnly = !cache.soloOnly;
        paintSearchResults(cache);
      };

      // Hides cuts with no real credit: tagged only artist_unknown (the
      // catch-all for "no confirmed animator") or with no animator tag at
      // all. A cut with artist_unknown AND a real animator is kept, since
      // there IS info about who did something. Pointless while searching
      // for artist_unknown itself, so it's disabled then.
      var unknownDisabled = cache.tags.indexOf(UNKNOWN_ARTIST_TAG) !== -1;
      if (unknownDisabled && cache.hideUnknown) cache.hideUnknown = false;
      unknownBtn.disabled = unknownDisabled;
      unknownBtn.classList.toggle('active', !!cache.hideUnknown);
      unknownBtn.title = unknownDisabled
        ? 'hide uncredited cuts — disabled, this search is for artist_unknown'
        : (cache.hideUnknown ? 'hiding cuts with no known animator — click to show all' : 'hide cuts with no known animator (only artist_unknown, or no animator tag)');
      unknownBtn.onclick = function () {
        if (unknownBtn.disabled) return;
        cache.hideUnknown = !cache.hideUnknown;
        paintSearchResults(cache);
      };
    } else {
      soloRow.style.display = 'none';
    }

    // Solo cut = exactly one animator-type tag on the post. Same client-side
    // approach as the exclude-tags filter below, since there's no server-side
    // tag syntax for "exactly one of type X" — reuses the same tagTypeMap
    // already populated after every search.
    var visible = safeFilter(cache.posts, function (p) {
      var tags = (p.tags || '').split(/\s+/);
      for (var i = 0; i < tags.length; i++) {
        if (cache.excluded[tags[i]]) return false;
      }
      if (cache.hideUnknown && tagTypeMap && countRealAnimators(tags) === 0) return false;
      if (cache.soloOnly) {
        var animatorCount = 0;
        for (var j = 0; j < tags.length; j++) {
          if (tagTypeMap && tagTypeMap[tags[j]] === 1) animatorCount++;
        }
        if (animatorCount !== 1) return false;
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
      visible.forEach(function (p) { grid.appendChild(buildCard(p)); });
      results.innerHTML = '';
      results.appendChild(grid);

      if (cache.hasMore || cache.loadMoreError) {
        var moreWrap = document.createElement('div');
        moreWrap.className = 'sk-load-more-wrap';
        if (cache.loadMoreError) {
          // Not auto-retried on scroll — a failed request re-entering view
          // would just retry-loop while it's still visible, so this stays a
          // deliberate click.
          moreWrap.innerHTML = '<div class="sk-empty">couldn\'t load more: ' + esc(cache.loadMoreError) + '</div>' +
            '<button class="sk-frame-btn" id="sk-load-more">retry</button>';
          moreWrap.querySelector('#sk-load-more').onclick = function () { loadMoreResults(cache); };
        } else if (cache.loadingMore) {
          moreWrap.innerHTML = '<div class="sk-loading" style="padding:10px 0">loading more…</div>';
        } else {
          moreWrap.innerHTML = '<div id="sk-load-sentinel" style="height:1px"></div>';
        }
        results.appendChild(moreWrap);

        if (!cache.loadMoreError && !cache.loadingMore) {
          var sentinel = moreWrap.querySelector('#sk-load-sentinel');
          if (searchScrollObserver) searchScrollObserver.disconnect();
          // root: body (not the default viewport) since the actual scrolling
          // happens inside the panel's own body, not the host page — the
          // default root would never report an intersection at all here.
          // rootMargin starts the fetch a bit before the sentinel is
          // literally on-screen, closer to how FlatList's onEndReached feels.
          searchScrollObserver = new IntersectionObserver(function (entries) {
            if (entries[0].isIntersecting) {
              searchScrollObserver.disconnect();
              loadMoreResults(cache);
            }
          }, { root: body, rootMargin: '200px' });
          searchScrollObserver.observe(sentinel);
        }
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
            '<span class="fname" title="' + esc(t) + '">' + esc(t) + '</span>' +
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

  function runSearch(opts) {
    opts = opts || {};
    // Remember where we were so "← back" can return to it. A search launched
    // from the Shows tab (searchOrigin set) starts a fresh trail instead —
    // its way back is the episode list. Going back itself passes noHistory.
    if (!opts.noHistory) {
      if (searchOrigin) {
        searchHistory = [];
      } else if (searchCache && !tagsEqual(searchCache.tags, searchState.tags)) {
        searchHistory.push({ tags: searchCache.tags.slice(), order: searchCache.order, origin: searchCache.origin || null });
        if (searchHistory.length > 20) searchHistory.shift();
      }
    }
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
          tags: tagsSnapshot, order: orderSnapshot, posts: posts, excluded: {}, soloOnly: false,
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
          if (statsBtn) statsBtn.textContent = sync.artistTag ? '▥ Stats: ' + sync.artistTag : '▥ Animator Stats';
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
      if (statsBtn) statsBtn.textContent = '▥ Stats: ' + tagName;
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
      '<div class="sk-meta">most frequent shows</div>' +
      '<div id="sk-artist-shows"><div class="sk-loading">loading…</div></div>' +
      '<div style="height:6px"></div>' +
      '<div class="sk-meta" title="Based on when each post was added/tagged on sakugabooru, not when the original episode aired — a 2005 cut uploaded in 2021 shows up as 2021 here.">upload year ⓘ</div>' +
      '<div class="sk-filmstrip" id="sk-strip"></div>' +
      '<div style="height:18px"></div>' +
      '<div class="sk-meta">most frequent co-tags &mdash; use Search\'s filter grid to narrow by these</div>' +
      '<div class="sk-taglist" id="sk-taglist"></div>' +
      note;

    // Same tally already gathered for co-tags above, just narrowed to
    // show/copyright-type tags specifically — no separate pass over the
    // posts needed. Async only because the tag-type dictionary might not
    // be loaded yet; everything else on this screen doesn't need it.
    var showsWrap = out.querySelector('#sk-artist-shows');
    ensureTagTypes().then(function (map) {
      var showNames = safeSort(
        safeFilter(Object.keys(tagFreq), function (t) { return map && map[t] === 3; }),
        function (a, b) { return tagFreq[b] - tagFreq[a]; }
      ).slice(0, 8);
      if (!showNames.length) { showsWrap.innerHTML = '<div class="sk-caption">no show tags found among these cuts.</div>'; return; }
      showsWrap.innerHTML = '<div class="sk-freq-list">' + buildFreqRows(showNames, tagFreq, 'show') + '</div>';
      var rowEls = showsWrap.querySelectorAll('.sk-freq-row');
      for (var i = 0; i < rowEls.length; i++) {
        rowEls[i].onclick = function (e) {
          var show = e.currentTarget.getAttribute('data-tag');
          // Combined with the animator tag, same convention as the
          // show-screen's own animator list — "how much do they show up
          // here" implies clicking means "show me their cuts in this show".
          searchState.tags = [show, tagName];
          searchViewMode = 'results';
          searchOrigin = null;
          // Same pitfall as the show screen's animator list: leaving the
          // Stats animator set here would make the Search tab's sync step
          // replace [show, animator] with just [animator].
          sync.artistTag = null;
          switchToTab('search');
          renderChips();
          runSearch();
        };
      }
    });

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
    var norm = normalizeForTagMatch(q.trim().toLowerCase().replace(/\s+/g, '_'));

    ensureAllTags(function (n) {
      if (!allTagsList) content.innerHTML = '<div class="sk-loading">loading tag dictionary… (' + n + ' so far)</div>';
    }).then(function (list) {
      if (!list.length) {
        content.innerHTML = '<div class="sk-empty">couldn\'t load sakugabooru\'s tag list right now — try again in a moment</div>';
        return;
      }
      var direct = safeFilter(list, function (t) { return t.type === 3 && normalizeForTagMatch(t.name).indexOf(norm) !== -1; });
      var showsList = direct;
      if (!showsList.length) {
        // Multi-word query rarely matches one contiguous tag name — try each word.
        var words = safeFilter(norm.split('_'), function (w) { return w.length >= 3; });
        var seen = {};
        showsList = [];
        words.forEach(function (w) {
          list.forEach(function (t) {
            if (t.type === 3 && normalizeForTagMatch(t.name).indexOf(w) !== -1 && !seen[t.name]) {
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

  // Ranks animator-type tags by how often they appear across a show's
  // sampled posts — same tag-type map already used for color-coding
  // everywhere else, just tallied instead of just colored. Collapsed by
  // default wherever it's used: it's a nice-to-have alongside the main
  // content (episodes, or search results), not something that should push
  // that content down before anyone's asked to see it.
  function renderTopAnimatorsPanel(wrap, showTag, posts) {
    wrap.innerHTML = '<button class="sk-mini-toggle" id="sk-top-animators-toggle" type="button">Most Frequently Tagged ▾</button>' +
      '<div id="sk-top-animators-body" style="display:none;margin-top:8px"></div>';
    var toggleBtn = wrap.querySelector('#sk-top-animators-toggle');
    var bodyEl = wrap.querySelector('#sk-top-animators-body');
    var loaded = false;
    toggleBtn.onclick = function () {
      var open = bodyEl.style.display !== 'none';
      bodyEl.style.display = open ? 'none' : 'block';
      toggleBtn.textContent = 'Most Frequently Tagged ' + (open ? '▾' : '▴');
      if (!open && !loaded) {
        loaded = true;
        bodyEl.innerHTML = '<div class="sk-loading">loading…</div>';
        renderTopAnimatorsContent(bodyEl, showTag, posts);
      }
    };
  }

  // Shared by both directions of this feature (a show's most-tagged
  // animators, and an animator's most-frequent shows) — same visual
  // language either way, just a different accent color per variant so the
  // two stay visually distinct (amber for animators, blue for shows,
  // matching the tag-chip color-coding used everywhere else).
  function buildFreqRows(names, freq, variant) {
    var maxCount = freq[names[0]];
    return safeMap(names, function (name, i) {
      var pct = Math.max(6, Math.round((freq[name] / maxCount) * 100));
      return '<div class="sk-freq-row' + (variant === 'show' ? ' is-show' : '') + '" data-tag="' + esc(name) + '">' +
        '<span class="sk-freq-rank">' + (i + 1) + '</span>' +
        '<span class="sk-freq-name" title="' + esc(name) + '">' + esc(name) + '</span>' +
        '<span class="sk-freq-bar-wrap"><span class="sk-freq-bar" style="width:' + pct + '%"></span></span>' +
        '<span class="sk-freq-count">' + freq[name] + '</span>' +
      '</div>';
    }).join('');
  }

  function renderTopAnimatorsContent(bodyEl, showTag, posts) {
    ensureTagTypes().then(function (map) {
      var freq = {};
      posts.forEach(function (p) {
        var seen = {}; // count each animator once per post even if the tag string somehow repeats it
        safeFilter((p.tags || '').split(/\s+/), function (t) { return !!t; }).forEach(function (t) {
          if (t === showTag || seen[t]) return;
          if (map && map[t] === 1) {
            freq[t] = (freq[t] || 0) + 1;
            seen[t] = true;
          }
        });
      });
      var names = safeSort(Object.keys(freq), function (a, b) { return freq[b] - freq[a]; }).slice(0, 8);
      if (!names.length) { bodyEl.innerHTML = '<div class="sk-caption">no animator tags found in the sample.</div>'; return; }
      bodyEl.innerHTML = '<div class="sk-freq-list">' + buildFreqRows(names, freq, 'artist') + '</div>';
      var rowEls = bodyEl.querySelectorAll('.sk-freq-row');
      for (var i = 0; i < rowEls.length; i++) {
        rowEls[i].onclick = function (e) {
          var tag = e.currentTarget.getAttribute('data-tag');
          // Combined with the show tag rather than searching the animator
          // alone — this list means "who shows up a lot in this show", so
          // clicking one means "show me their cuts in this show", not
          // their entire catalog everywhere.
          // The show-only search is the step "back" returns to. From the Shows
          // tab it was never run in the Search tab, so it's recorded here
          // (with the episode-list origin); from the Search tab's own panel
          // it's simply the search currently on screen.
          var fromShowsTab = !!body.querySelector('#sk-show-content');
          searchHistory = [{
            tags: [showTag],
            order: searchState.order,
            origin: fromShowsTab ? { type: 'shows', showTag: showTag } : (searchCache && searchCache.origin) || null
          }];
          searchState.tags = [showTag, tag];
          searchViewMode = 'results';
          // Must be null here, NOT the clicked animator: switching to the
          // Search tab runs its "sync to the Stats animator" step, which
          // sees an animator that isn't in the previous results and
          // replaces the whole tag list with just that animator — silently
          // dropping the show tag. runSearch() sets this itself afterward
          // once it finds the animator among the query's tags.
          sync.artistTag = null;
          // No searchOrigin: this is a show+animator search, not an episode
          // lookup. The back link comes from searchHistory above instead.
          searchOrigin = null;
          switchToTab('search');
          renderChips();
          runSearch({ noHistory: true });
        };
      }
    });
  }

  // Only fires for a search that's just a single show/copyright-type tag
  // and nothing else — anything more specific (an episode, an animator
  // combo) isn't really "browsing a show" anymore, so the panel would be
  // answering a question nobody asked at that point.
  function maybeRenderShowAnimatorsInSearch(wrap, cache) {
    wrap.innerHTML = '';
    if (!cache.tags || cache.tags.length !== 1) return;
    var tag = cache.tags[0];
    ensureTagTypes().then(function (map) {
      if (!map || map[tag] !== 3) return;
      return getShowEntry(tag).then(function (entry) {
        if (!entry.totalSampled) return;
        renderTopAnimatorsPanel(wrap, tag, entry.posts);
      });
    }).catch(function () { /* nice-to-have alongside search — fail silently rather than surface an error for it */ });
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
      '<div id="sk-top-animators-wrap" style="margin-bottom:8px"></div>' +
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
    renderTopAnimatorsPanel(content.querySelector('#sk-top-animators-wrap'), showTag, entry.posts);
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
            tags: [showTag], order: 'date', posts: ep.posts, excluded: {}, soloOnly: false, facetTags: facetTags,
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

  // ===================== POOLS TAB =====================
  // Two intentionally separate systems, same split as the companion app:
  // "My Pools" is entirely local (no login, no server interaction) since
  // real pool creation needs an account tier most accounts don't have.
  // "Browse Public Pools" is real — reads pools other users made public.
  var poolsViewMode = 'local'; // 'local' | 'public'

  function renderPools() {
    body.innerHTML =
      '<div class="sk-mode-row">' +
        '<button class="sk-mode-btn active" id="sk-pools-mode-local" type="button">My Pools</button>' +
        '<button class="sk-mode-btn" id="sk-pools-mode-public" type="button">Public Pools</button>' +
      '</div>' +
      '<div id="sk-pools-view"></div>';
    body.querySelector('#sk-pools-mode-local').onclick = function () { poolsViewMode = 'local'; renderPoolsView(); };
    body.querySelector('#sk-pools-mode-public').onclick = function () { poolsViewMode = 'public'; renderPoolsView(); };
    renderPoolsView();
  }

  function renderPoolsView() {
    body.querySelector('#sk-pools-mode-local').classList.toggle('active', poolsViewMode === 'local');
    body.querySelector('#sk-pools-mode-public').classList.toggle('active', poolsViewMode === 'public');
    var view = body.querySelector('#sk-pools-view');
    if (poolsViewMode === 'local') renderLocalPoolsList(view);
    else renderPublicPoolsBrowse(view);
  }

  function renderLocalPoolsList(view) {
    var pools = getLocalPools();
    view.innerHTML =
      '<div class="sk-row">' +
        '<input class="sk-input" id="sk-lp-new-name" placeholder="new pool name">' +
        '<button class="sk-btn" id="sk-lp-new-go">Create</button>' +
      '</div>' +
      '<div id="sk-lp-list"></div>';

    view.querySelector('#sk-lp-new-go').onclick = function () {
      var input = view.querySelector('#sk-lp-new-name');
      var name = input.value.trim();
      if (!name) return;
      createLocalPool(name, '');
      renderLocalPoolsList(view);
    };

    var listEl = view.querySelector('#sk-lp-list');
    if (!pools.length) {
      listEl.innerHTML = '<div class="sk-empty">no pools yet</div>';
      return;
    }
    listEl.innerHTML = '';
    pools.forEach(function (pl) {
      var item = document.createElement('div');
      item.className = 'sk-show-pick';
      item.innerHTML = '<span class="name">' + esc(pl.name) + '</span><span class="cnt">' + pl.posts.length + '</span>';
      item.onclick = function () { renderLocalPoolDetail(view, pl.id); };
      listEl.appendChild(item);
    });
  }

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

  function renderLocalPoolDetail(view, poolId) {
    var pool = getLocalPool(poolId);
    if (!pool) { renderLocalPoolsList(view); return; }
    view.innerHTML =
      '<div class="sk-row" style="align-items:center;justify-content:space-between">' +
        '<button class="sk-nav-btn" id="sk-lp-back">‹ back</button>' +
        '<span class="sk-caption" style="margin:0">' + esc(pool.name) + '</span>' +
        '<button class="sk-nav-btn" id="sk-lp-delete">Delete</button>' +
      '</div>' +
      '<div class="sk-row" style="margin-bottom:8px">' +
        '<button class="sk-btn" id="sk-lp-export" style="flex:1">Export Clips</button>' +
      '</div>' +
      '<div id="sk-lp-export-status" class="sk-caption" style="display:none"></div>' +
      '<div class="sk-grid" id="sk-lp-grid"></div>';

    view.querySelector('#sk-lp-back').onclick = function () { renderLocalPoolsList(view); };
    view.querySelector('#sk-lp-delete').onclick = function () {
      if (!confirm('delete "' + pool.name + '"?')) return;
      deleteLocalPool(pool.id);
      renderLocalPoolsList(view);
    };

    view.querySelector('#sk-lp-export').onclick = function () {
      var videoPosts = safeFilter(pool.posts, function (p) { return isVideoFile(p.file_url); });
      if (videoPosts.length < 2) { alert('need at least 2 video clips in this pool to export.'); return; }
      openExportComposer(pool, videoPosts, function (cfg) {
        var statusEl = view.querySelector('#sk-lp-export-status');
        statusEl.style.display = 'block';
        setBusyStatus(statusEl, 'starting…');
        var exportBtn = view.querySelector('#sk-lp-export');
        exportBtn.disabled = true;

        performGridExport(cfg.clips, statusEl, cfg.orientation, cfg.mode, cfg.trims, cfg.loopMode, cfg.labelMode, cfg.format, cfg.labelStyle, cfg.labelOverrides, cfg.musicFiles, cfg.musicLoop, cfg.labelPos).then(function (result) {
          statusEl.textContent = 'done — ' + result.width + '×' + result.height + 'px, ' + result.count + ' clips.';
          openGridResultModal(result.blob, pool.name, result.hasAudio);
        }).catch(function (err) {
          statusEl.textContent = err.message === 'cancelled' ? '' : 'export failed: ' + err.message;
          if (err.message === 'cancelled') statusEl.style.display = 'none';
        }).then(function () { exportBtn.disabled = false; });
      });
    };

    var grid = view.querySelector('#sk-lp-grid');
    if (!pool.posts.length) {
      grid.innerHTML = '<div class="sk-empty">no clips yet</div>';
      return;
    }
    pool.posts.forEach(function (p) {
      var card = buildCard(p);
      var removeBadge = document.createElement('div');
      removeBadge.className = 'remove-badge';
      removeBadge.title = 'remove from this pool';
      removeBadge.innerHTML = '&times;';
      removeBadge.onclick = function (e) {
        e.stopPropagation(); // don't also open the clip
        removePostFromLocalPool(pool.id, p.id);
        renderLocalPoolDetail(view, pool.id); // re-render so the grid and counts reflect the removal
      };
      card.appendChild(removeBadge);
      grid.appendChild(card);
    });
  }

  function renderPublicPoolsBrowse(view) {
    view.innerHTML =
      '<div class="sk-row">' +
        '<input class="sk-input" id="sk-pp-query" placeholder="search pools">' +
        '<button class="sk-btn" id="sk-pp-go">Search</button>' +
      '</div>' +
      '<div id="sk-pp-list"><div class="sk-loading">loading pools…</div></div>';

    function load(query) {
      var listEl = view.querySelector('#sk-pp-list');
      listEl.innerHTML = '<div class="sk-loading">loading pools…</div>';
      var path = query ? '/pool.json?query=' + encodeURIComponent(query) : '/pool.json';
      getJSON(path).then(function (pools) {
        if (!pools || !pools.length) {
          listEl.innerHTML = '<div class="sk-empty">no pools found</div>';
          return;
        }
        listEl.innerHTML = '';
        pools.forEach(function (pl) {
          var item = document.createElement('div');
          item.className = 'sk-show-pick';
          item.innerHTML = '<span class="name">' + esc(pl.name) + '</span><span class="cnt">' + (pl.post_count || 0) + ' posts</span>';
          item.onclick = function () { renderPublicPoolDetail(view, pl.id, pl.name); };
          listEl.appendChild(item);
        });
      }).catch(function (err) {
        listEl.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
      });
    }

    view.querySelector('#sk-pp-go').onclick = function () { load(view.querySelector('#sk-pp-query').value.trim()); };
    load('');
  }

  function renderPublicPoolDetail(view, poolId, poolName) {
    view.innerHTML =
      '<div class="sk-row" style="align-items:center;justify-content:space-between">' +
        '<button class="sk-nav-btn" id="sk-pp-back">‹ back</button>' +
        '<span class="sk-caption" style="margin:0">' + esc(poolName) + '</span>' +
        '<a href="/pool/show/' + poolId + '" target="_blank" rel="noopener" class="sk-media-viewpost">view on site ↗</a>' +
      '</div>' +
      '<div id="sk-pp-grid" class="sk-grid"></div>';
    view.querySelector('#sk-pp-back').onclick = function () { renderPoolsView(); };

    var grid = view.querySelector('#sk-pp-grid');
    grid.innerHTML = '<div class="sk-loading">loading posts…</div>';

    // pool:ID search on the standard post-search endpoint — reuses proven,
    // already-working infrastructure rather than a separate, untested one
    // (same approach the app takes via getPoolPosts). order:id keeps the
    // pool's own sequence rather than defaulting to newest-first.
    getJSON('/post.json?limit=100&tags=' + encodeURIComponent('pool:' + poolId + ' order:id'))
      .then(function (posts) {
        if (!posts || !posts.length) {
          grid.innerHTML = '<div class="sk-empty">no posts in this pool.</div>';
          return;
        }
        grid.innerHTML = '';
        posts.forEach(function (p) { grid.appendChild(buildCard(p)); });
      }).catch(function (err) {
        grid.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
      });
  }

  function renderTab(name) {
    if (name === 'shows') renderShows();
    else if (name === 'pools') renderPools();
    else renderSearch();
  }

  // ---------- start from whatever booru page the bookmarklet was opened on ----------
  // On a post page, that post's tags are loaded in as search chips; on a
  // search/listing page, the page's own search is carried over and run. Done
  // before first render so the Search tab opens already filled in, instead of
  // making the person retype what they were just looking at.
  var pageSearchTags = null;   // listing page: tags to search immediately
  var pagePostId = null;       // post page: post whose tags to load as chips
  (function readPageContext() {
    try {
      var path = location.pathname;
      var m = /^\/post\/show\/(\d+)/.exec(path);
      if (m) { pagePostId = m[1]; return; }
      if (path === '/post' || path === '/post/' || path.indexOf('/post/index') === 0) {
        var raw = new URLSearchParams(location.search).get('tags') || '';
        var tokens = safeFilter(raw.split(/\s+/), function (t) { return !!t; });
        var keep = [];
        tokens.forEach(function (t) {
          var om = /^order:(.+)$/.exec(t);
          if (om) {
            // Carry over the page's sort if the dropdown supports it; drop
            // any other order: token so it can't linger as a bogus tag chip.
            if (/^(score|score_asc|id|random)$/.test(om[1])) searchState.order = om[1];
            else if (om[1] === 'date') searchState.order = 'date';
            return;
          }
          keep.push(t);
        });
        if (keep.length) pageSearchTags = keep;
      }
    } catch (e) { /* page context is a convenience — never block startup on it */ }
  })();
  if (pageSearchTags) searchState.tags = pageSearchTags.slice();

  renderTab('search');
  panel.style.display = 'flex';
  if (pageSearchTags) runSearch();
  if (pagePostId) {
    // Not auto-searched: a query made of every one of a post's tags only
    // matches that same post. They're loaded as chips (artists, shows, then
    // characters first) so the useful ones are ready to keep and the rest can
    // be dropped with the x.
    Promise.all([
      getJSON('/post.json?limit=1&tags=' + encodeURIComponent('id:' + pagePostId)),
      ensureTagTypes()
    ]).then(function (res) {
      var post = res[0] && res[0][0];
      var types = res[1] || {};
      if (!post || !post.tags || searchState.tags.length) return; // nothing found, or the person already started typing
      var all = safeFilter(post.tags.split(/\s+/), function (t) { return !!t; });
      var buckets = [[], [], [], []];
      all.forEach(function (t) {
        var ty = types[t];
        buckets[ty === 1 ? 0 : ty === 3 ? 1 : ty === 4 ? 2 : 3].push(t);
      });
      searchState.tags = buckets[0].concat(buckets[1], buckets[2], buckets[3]);
      renderChips();
    }).catch(function () { /* convenience only — fail silently */ });
  }
  // Warms the tag-dictionary cache in the background so chip colors are
  // usually already available by the time someone actually adds a tag,
  // rather than only fetching reactively the first time it's needed.
  ensureTagTypes().then(function () { renderChips(); });
})();
