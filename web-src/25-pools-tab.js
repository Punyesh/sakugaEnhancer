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

