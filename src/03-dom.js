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

