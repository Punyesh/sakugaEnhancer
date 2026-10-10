  // ---------- styles: Shape and spacing system ----------
  var cssShape = [
    // One set of rules for every screen, so nothing is its own special case:
    //   shapes   controls (buttons, inputs, selects, icon buttons, chips, tags) share one
    //            corner radius; containers (panels, cards, popups, modals, lists) share a
    //            slightly larger one; overlay labels and thumbnails use a small one.
    //            Circles are only for things that are actually round (switch knob, round badges).
    //   sizes    regular controls are 28px tall, small ones (header icons, toggles, chips) 24px.
    //   spacing  a 4px grid: 4 inside tight groups, 8 between neighbours and rows, 12 between sections.
    // This block is the only place those radii, heights and paddings are defined for the shared
    // control classes; the component rules in the files before it deliberately leave them out.
    // Change R_CTL / R_BOX / R_INNER / H_CTL / H_SM in 01-tokens.js to retune everything at once.
    '.sk-input,.sk-select,.sk-btn,.sk-mode-btn,.sk-frame-btn,.sk-nav-btn,.sk-ep-btn,.sk-comment-textarea,.sk-seg,',
    '.sk-xc-seg,.sk-icon-btn,.sk-filter-toggle,.sk-mini-toggle,.sk-chip,.sk-mini-chip,.sk-xc-track,.sk-dock-head a,',
    '.sk-xc-pos button{border-radius:' + R_CTL + ';}',
    '#sk-enh-panel,.sk-media-box,.sk-login-box,.sk-info-popup,.sk-suggest-list,.sk-card,.sk-facet-grid,.sk-freq-list,',
    '.sk-dropzone,.sk-show-pick,.sk-xc-stage,.sk-xc-pos,.sk-comment-composer,#xc-music-line,',
    '.sk-xc-ghost.sk-xc-rowhead{border-radius:' + R_BOX + ';}',
    '.sk-badge,.sk-filter-badge,.sk-card .score,.sk-card .vidmark,.sk-xc-num,.sk-xc-frn,.sk-xc-fr,.sk-facet-item,',
    '.sk-freq-row,.sk-xc-grip,.sk-xc-box .sk-xc-rowhead img,.sk-media-box::-webkit-scrollbar-thumb{',
    'border-radius:' + R_INNER + ';}',
    // one typeface: windows and popups carry the panel's font, and controls inherit it instead of the browser's default control font (Arial)
    '.sk-media-backdrop,.sk-info-popup,.sk-suggest-list{font-family:' + FONT + ';}',
    '.sk-input,.sk-select,.sk-btn,.sk-mode-btn,.sk-frame-btn,.sk-nav-btn,.sk-comment-textarea{font-family:inherit;}',
    '.sk-input,.sk-select,.sk-btn,.sk-mode-btn,.sk-frame-btn,.sk-nav-btn{box-sizing:border-box;min-height:' + H_CTL + ';}',
    '.sk-btn,.sk-mode-btn,.sk-frame-btn,.sk-nav-btn{display:inline-flex;align-items:center;justify-content:center;}',
    '.sk-input{padding:4px 10px;}',
    '.sk-select{padding:4px 8px;}',
    '.sk-btn{padding:4px 14px;}',
    '.sk-nav-btn{padding:4px 12px;font-size:12px;}',
    '.sk-frame-btn{padding:4px 10px;}',
    '.sk-mode-btn{flex:0 0 auto;padding:4px 12px;font-size:12px;}',
    '.sk-icon-btn,.sk-filter-toggle,.sk-mini-toggle{box-sizing:border-box;height:' + H_SM + ';}',
    '.sk-filter-toggle,.sk-mini-toggle{display:inline-flex;align-items:center;padding:0 10px;font-size:11px;}',
    '.sk-chip{padding:3px 8px;font-size:11px;}',
    '.sk-mini-chip{padding:3px 8px;}',
    '.sk-row{gap:8px;margin-bottom:8px;}',
    '.sk-chips{gap:6px;margin-bottom:8px;}',
    '.sk-chips:empty,#sk-show-animators-wrap:empty{display:none;}',
    '.sk-mode-row{gap:8px;margin-bottom:8px;}',
    '.sk-meta{margin:0 0 8px;}',
    '.sk-facet-grid{margin:0 0 8px;}',
    '.sk-grid,.sk-ep-grid{gap:8px;}',
    '.sk-caption{margin-bottom:8px;}',
    '.sk-show-nav{gap:8px;margin-bottom:8px;}',
    '.sk-show-head{gap:8px;margin-bottom:8px;}',
    '.sk-related-row{gap:6px;margin-bottom:8px;}',
    '.sk-show-pick{padding:8px 10px;margin-bottom:6px;}',
    '.sk-load-more-wrap{margin-top:12px;}',
    '.sk-tab{padding:8px 0;}',
    '.sk-body{padding:12px;}',
  ];
