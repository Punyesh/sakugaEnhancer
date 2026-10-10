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

  // A three-clip preview strip for a pool row; empty slots stay as outlined boxes so every row lines up.
  function poolThumbs(posts) {
    var out = '';
    for (var i = 0; i < 3; i++) {
      var post = posts[i];
      var src = post && (post.preview_url || post.jpeg_url || post.sample_url);
      out += src ? '<img loading="lazy" src="' + esc(src) + '">' : '<i></i>';
    }
    return '<span class="thumbs">' + out + '</span>';
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
      item.className = 'sk-show-pick sk-pool-row';
      item.innerHTML = poolThumbs(pl.posts) +
        '<span class="main"><span class="name">' + esc(pl.name) + '</span>' +
        '<span class="sub">' + pl.posts.length + (pl.posts.length === 1 ? ' clip' : ' clips') + '</span></span>' +
        '<span class="chev">&#8250;</span>';
      item.onclick = function () { renderLocalPoolDetail(view, pl.id); };
      listEl.appendChild(item);
    });
  }

