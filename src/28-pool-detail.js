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

