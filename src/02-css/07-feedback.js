  // ---------- styles: Spinner and progress bars ----------
  var cssFeedback = [
    '.sk-spinner{display:inline-block;width:12px;height:12px;border:2px solid ' + C.line + ';border-top-color:' + C.amber + ';',
    'border-radius:50%;vertical-align:middle;margin-right:6px;animation:sk-spin .7s linear infinite;}',
    '@keyframes sk-spin{',
      'to{transform:rotate(360deg);}',
    '}',
    '.sk-progress{height:4px;background:' + C.line + ';border-radius:2px;margin-top:6px;overflow:hidden;position:relative;}',
    '.sk-progress-fill{height:100%;width:0;background:' + C.amber + ';border-radius:2px;transition:width .25s linear;}',
    '.sk-progress.ind .sk-progress-fill{position:absolute;width:35%;transition:none;',
    'animation:sk-ind 1.2s ease-in-out infinite;}',
    '@keyframes sk-ind{',
      '0%{left:-35%;}',
      '100%{left:100%;}',
    '}',
    '.sk-st-pct{margin-left:6px;opacity:.75;}',
  ];
