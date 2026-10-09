  // ---------- styles: Tabs, form controls, suggestions, tag chips ----------
  var cssForms = [
    '#sk-enh-tabs{display:flex;border-bottom:1px solid ' + C.line + ';}',
    '.sk-tab{flex:1;text-align:center;font-size:12px;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;',
    'color:' + C.dim + ';border-bottom:2px solid transparent;}',
    '.sk-tab.active{color:' + C.amber + ';border-bottom-color:' + C.amber + ';}',
    '.sk-body{overflow-y:auto;flex:1;min-height:0;}',
    '.sk-row{display:flex;}',
    '.sk-input{flex:1;background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';font-size:13px;outline:none;}',
    '.sk-input:focus{border-color:' + C.amber + ';}',
    '.sk-input[type=number]::-webkit-inner-spin-button,.sk-input[type=number]::-webkit-outer-spin-button{',
    '-webkit-appearance:none;margin:0;}',
    '.sk-input[type=number]{-moz-appearance:textfield;}',
    '.sk-select{background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';font-size:12px;}',
    '.sk-btn{background:' + C.amberDim + ';border:1px solid ' + C.amber + ';color:' + C.amber + ';font-size:12px;cursor:pointer;',
    'white-space:nowrap;}',
    '.sk-btn:hover{background:' + C.amber + ';color:#1a1509;}',
    '.sk-chips{display:flex;flex-wrap:wrap;min-height:0;}',
    '.sk-suggest-list{background:' + C.panel + ';border:1px solid ' + C.line + ';margin-bottom:8px;overflow:hidden;}',
    '.sk-suggest-row{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;',
    'border-top:1px solid ' + C.line + ';cursor:pointer;font-size:12px;}',
    '.sk-suggest-row:first-child{border-top:none;}',
    '.sk-suggest-row:hover{background:' + C.panel2 + ';}',
    // Type 1 = artist/animator, type 3 = copyright/show — the standard
    // Danbooru1/Moebooru tag-type numbering, relied on throughout this file for the
    // amber animator color; type 3 specifically wasn't re-verified against a live
    // response, it just follows the same well-established convention.
    '.sk-suggest-row.is-artist span:first-child{color:' + C.amber + ';}',
    '.sk-suggest-row.is-copyright span:first-child{color:' + C.link + ';}',
    '.sk-suggest-count{color:' + C.dim + ';font-size:11px;font-family:monospace;}',
    '.sk-chip{background:' + C.bg + ';border:1px solid ' + C.line + ';color:' + C.text + ';display:flex;align-items:center;gap:5px;',
    'font-family:"Courier New",monospace;}',
    '.sk-chip span{cursor:pointer;color:' + C.red + ';font-weight:bold;}',
    '.sk-chip.is-artist{border-color:' + C.amberDim + ';color:' + C.amber + ';}',
    '.sk-chip.is-copyright{border-color:' + C.link + ';color:' + C.link + ';}',
  ];
