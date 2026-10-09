  // ---------- styles: Themed scrollbars ----------
  var cssScrollbars = [
    // Themed scrollbars for our own scrollable panels — scoped to these specific
    // classes only, since these styles are injected globally into the host page and
    // a broader selector would restyle sakugabooru's own scrollbars too.
    '.sk-body,.sk-comments-panel,.sk-facet-grid,.sk-chipwrap,.sk-media-box{scrollbar-width:thin;',
    'scrollbar-color:' + C.amberDim + ' ' + C.bg + ';}',
    '.sk-body::-webkit-scrollbar,.sk-comments-panel::-webkit-scrollbar,.sk-facet-grid::-webkit-scrollbar,',
    '.sk-chipwrap::-webkit-scrollbar,.sk-media-box::-webkit-scrollbar{width:8px;}',
    '.sk-body::-webkit-scrollbar-track,.sk-comments-panel::-webkit-scrollbar-track,',
    '.sk-facet-grid::-webkit-scrollbar-track,.sk-chipwrap::-webkit-scrollbar-track,',
    '.sk-media-box::-webkit-scrollbar-track{background:' + C.bg + ';}',
    '.sk-body::-webkit-scrollbar-thumb,.sk-comments-panel::-webkit-scrollbar-thumb,',
    '.sk-facet-grid::-webkit-scrollbar-thumb,.sk-chipwrap::-webkit-scrollbar-thumb,',
    '.sk-media-box::-webkit-scrollbar-thumb{background:' + C.amberDim + ';border-radius:4px;}',
    '.sk-body::-webkit-scrollbar-thumb:hover,.sk-comments-panel::-webkit-scrollbar-thumb:hover,',
    '.sk-facet-grid::-webkit-scrollbar-thumb:hover,.sk-chipwrap::-webkit-scrollbar-thumb:hover,',
    '.sk-media-box::-webkit-scrollbar-thumb:hover{background:' + C.amber + ';}',
  ];
