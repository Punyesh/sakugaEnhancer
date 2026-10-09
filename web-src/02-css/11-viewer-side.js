  // ---------- styles: Credits panel beside the clip viewer, narrow-screen layout ----------
  var cssViewerSide = [
    // clip viewer: credits (animator + tags) live in their own panel to the left of the viewer
    '.sk-media-backdrop.sk-clip-split{gap:12px;align-items:flex-start;}',
    '.sk-clip-split .sk-media-box{flex:1 1 760px;min-width:0;width:auto;max-width:760px;}',
    '.sk-clip-side{flex:0 0 auto;width:max-content;min-width:180px;max-width:min(320px,32vw);max-height:90vh;',
    'overflow-x:hidden;overflow-y:auto;box-sizing:border-box;padding:12px;background:' + C.panel + ';',
    'border:1px solid ' + C.line + ';border-radius:' + R_BOX + ';box-shadow:0 20px 60px rgba(0,0,0,.6);}',
    '.sk-clip-side .sk-dock-section + .sk-dock-section{margin-top:16px;}',
    '.sk-clip-side .sk-tagblock-label{font-size:11px;margin-bottom:8px;}',
    '.sk-clip-side .sk-chipwrap{max-height:none;overflow:visible;gap:6px;min-width:0;}',
    '.sk-clip-side .sk-mini-chip{font-family:inherit;font-size:13px;line-height:18px;padding:4px 10px;margin:0;',
    'max-width:100%;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;}',
    '.sk-clip-side .sk-mini-chip.artist{font-size:14px;padding:5px 12px;}',
    '.sk-media-top{flex-wrap:wrap;}',
    '.sk-media-top .sk-media-viewpost{white-space:nowrap;}',
    '@media (max-width:900px){',
      '.sk-media-backdrop.sk-clip-split{flex-direction:column;align-items:center;justify-content:flex-start;',
      'overflow-y:auto;}',
      '.sk-clip-side{flex:0 0 auto;width:100%;min-width:0;max-width:760px;max-height:none;}',
      '.sk-clip-split .sk-media-box{flex:0 0 auto;width:100%;max-height:none;}',
    '}',
  ];
