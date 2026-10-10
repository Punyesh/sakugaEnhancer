  // ---------- styles: segmented view switch and the results tools row ----------
  var cssSearchToolbar = [
    // re-roll button beside the sort (random only)
    '#sk-reroll{width:' + H_CTL + ';height:' + H_CTL + ';align-self:center;font-size:14px;flex:0 0 auto;}',
    // Results / Animator Stats (and My Pools / Public Pools): one segmented pill instead of two loose buttons
    '.sk-mode-row{display:inline-flex;gap:0;padding:2px;margin-bottom:8px;max-width:100%;',
    'background:' + C.bg + ';border:1px solid ' + C.line + ';border-radius:' + R_CTL + ';}',
    '.sk-mode-row .sk-mode-btn{min-height:24px;padding:2px 12px;border:0;background:transparent;color:' + C.dim + ';',
    'border-radius:' + R_INNER + ';font-weight:normal;}',
    '.sk-mode-row .sk-mode-btn:hover{color:' + C.text + ';}',
    '.sk-mode-row .sk-mode-btn.active{background:' + C.amberDim + ';color:' + C.amber + ';font-weight:600;}',
    // tools row: disclosure toggles on the left, result toggles and reset on the right
    '.sk-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;}',
    '.sk-tb-l,.sk-tb-r{display:flex;align-items:center;gap:8px;min-width:0;}',
    '.sk-tb-l{flex-wrap:wrap;}',
    '#sk-solo-row{gap:8px;align-items:center;}',
    '.sk-toolbar .sk-filter-toggle,.sk-toolbar .sk-mini-toggle{font-family:inherit;font-size:11px;color:' + C.dim + ';}',
    '.sk-toolbar .sk-filter-toggle:hover,.sk-toolbar .sk-mini-toggle:hover{color:' + C.amber + ';}',
    '.sk-tb-reset{color:' + C.amber + ';font-size:11px;text-decoration:none;}',
    '.sk-tb-reset:hover{text-decoration:underline;}',
    '#sk-show-animators-body #sk-top-animators-body{margin:0 0 8px !important;}',
  ];
