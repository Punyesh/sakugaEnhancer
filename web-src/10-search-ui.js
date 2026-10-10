  // ===================== SEARCH TAB =====================
  var searchState = { tags: [], order: 'date', rating: '' };
  var searchViewMode = 'results'; // 'results' | 'stats'

  function tagsEqual(a, b) {
    return a.length === b.length && safeFilter(a, function (t, i) { return t === b[i]; }).length === a.length;
  }

  // ---- automatic searching ----
  var autoSearchTimer = null;

  // Run the search for the current tags/sort right now. `commit` first turns whatever is
  // typed in the box into a tag.
  function searchNow(commit) {
    clearTimeout(autoSearchTimer);
    if (commit) commitPendingTag();
    searchViewMode = 'results';
    ensureResultsMarkup();
    runSearch();
  }

  // Search after a change (sort, chip removed). `delay` lets several quick changes — taking
  // out a few chips in a row — collapse into one search. Does nothing before the first
  // search so that changing the sort on an empty page doesn't fire a request for "everything".
  function autoSearch(delay) {
    if (!searchCache && !searchState.tags.length) return;
    clearTimeout(autoSearchTimer);
    autoSearchTimer = setTimeout(function () {
      var tc = body.querySelector('#sk-tag-controls');
      if (tc && tc.style.display !== 'none') searchNow(false);
    }, delay);
  }

  // The re-roll button only makes sense for the random sort.
  function syncReroll() {
    var b = body.querySelector('#sk-reroll');
    if (b) b.style.display = searchState.order === 'random' ? 'flex' : 'none';
  }

  function renderSearch() {
    body.innerHTML =
      '<div id="sk-tag-controls">' +
        '<div class="sk-row">' +
          '<input class="sk-input" id="sk-tag-input" placeholder="add a tag, press enter">' +
          '<select class="sk-select" id="sk-order">' +
            '<option value="score">top score</option>' +
            '<option value="score_asc">lowest score</option>' +
            '<option value="date">newest</option>' +
            '<option value="id">oldest</option>' +
            '<option value="random">random</option>' +
          '</select>' +
          '<button class="sk-icon-btn" id="sk-reroll" type="button" title="new random set" style="display:none">&#8635;</button>' +
        '</div>' +
        '<div class="sk-chips" id="sk-chips"></div>' +
        '<div class="sk-suggest-list" id="sk-tag-suggestions" style="display:none"></div>' +
      '</div>' +
      '<div class="sk-mode-row">' +
        '<button class="sk-mode-btn active" id="sk-mode-results" type="button">▤ Results</button>' +
        '<button class="sk-mode-btn" id="sk-mode-stats" type="button">▥ Animator Stats</button>' +
      '</div>' +
      '<div id="sk-search-view"></div>';

    renderChips();

    body.querySelector('#sk-order').value = searchState.order;
    body.querySelector('#sk-order').onchange = function (e) {
      searchState.order = e.target.value;
      syncReroll();
      autoSearch(0);
    };
    body.querySelector('#sk-reroll').onclick = function () { searchNow(false); };

    // Searching is automatic: Enter adds what's typed as a tag and searches (on an empty
    // box it re-runs the current search, which re-rolls "random"); picking a suggestion,
    // changing the sort or removing a chip search too. There is no Search button.
    var input = body.querySelector('#sk-tag-input');
    var suggestWrap = body.querySelector('#sk-tag-suggestions');
    var suggestDebounce = null;
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      clearTimeout(suggestDebounce);
      suggestWrap.style.display = 'none';
      suggestWrap.innerHTML = '';
      searchNow(true);
    });

    // Live tag suggestions as you type — reuses the same cached full tag
    // dictionary the Shows tab already builds, just filtered across all tag
    // types instead of only type 3 (shows), no separate fetch mechanism
    // needed. Selecting a suggestion adds the tag and searches.
    input.addEventListener('input', function () {
      clearTimeout(suggestDebounce);
      var q = normalizeForTagMatch(input.value.trim().toLowerCase().replace(/\s+/g, '_'));
      if (!q) { suggestWrap.style.display = 'none'; suggestWrap.innerHTML = ''; return; }
      suggestDebounce = setTimeout(function () {
        ensureAllTags().then(function (list) {
          if (!input.value.trim()) return; // box was cleared (Enter / suggestion picked) while loading
          var matches = safeFilter(list, function (t) { return normalizeForTagMatch(t.name).indexOf(q) !== -1; });
          matches = safeSort(matches, function (a, b) { return b.count - a.count; }).slice(0, 8);
          if (!matches.length) { suggestWrap.style.display = 'none'; suggestWrap.innerHTML = ''; return; }
          suggestWrap.style.display = 'block';
          suggestWrap.innerHTML = safeMap(matches, function (t) {
            var typeClass = t.type === 1 ? ' is-artist' : (t.type === 3 ? ' is-copyright' : '');
            return '<div class="sk-suggest-row' + typeClass + '" data-name="' + esc(t.name) + '">' +
              '<span>' + esc(t.name) + '</span><span class="sk-suggest-count">' + t.count + '</span></div>';
          }).join('');
          var rows = suggestWrap.querySelectorAll('.sk-suggest-row');
          for (var i = 0; i < rows.length; i++) {
            rows[i].onclick = function (e) {
              var name = e.currentTarget.getAttribute('data-name');
              searchState.tags.push(name);
              input.value = '';
              suggestWrap.style.display = 'none';
              suggestWrap.innerHTML = '';
              renderChips();
              searchNow(false);
            };
          }
        }).catch(function () { /* a failed suggestion lookup just shows nothing, not worth an error banner */ });
      }, 150);
    });

    body.querySelector('#sk-mode-results').onclick = function () { searchViewMode = 'results'; renderSearchView(); };
    body.querySelector('#sk-mode-stats').onclick = function () { searchViewMode = 'stats'; renderSearchView(); };

    renderSearchView();
  }

  function renderSearchView() {
    var toggleResults = body.querySelector('#sk-mode-results');
    var toggleStats = body.querySelector('#sk-mode-stats');
    toggleResults.classList.toggle('active', searchViewMode === 'results');
    toggleStats.classList.toggle('active', searchViewMode === 'stats');
    toggleStats.textContent = sync.artistTag ? '▥ Stats: ' + sync.artistTag : '▥ Animator Stats';
    // Tag-search controls only matter in Results mode — showing them in Stats
    // mode too was exactly the "why two search fields" confusion.
    body.querySelector('#sk-tag-controls').style.display = searchViewMode === 'stats' ? 'none' : 'block';

    var view = body.querySelector('#sk-search-view');

    if (searchViewMode === 'stats') {
      view.innerHTML =
        '<div class="sk-row">' +
          '<input class="sk-input" id="sk-artist-input" placeholder="animator name, e.g. yutaka_nakamura">' +
          '<button class="sk-btn" id="sk-artist-go">Look up</button>' +
        '</div>' +
        '<div id="sk-stats-out"></div>';

      var input = view.querySelector('#sk-artist-input');
      var go = function () {
        var name = input.value.trim().replace(/\s+/g, '_').toLowerCase();
        if (name) loadArtistStats(name);
      };
      view.querySelector('#sk-artist-go').onclick = go;
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });

      // Reuse the cached lookup if it's already for the animator currently "in focus".
      if (statsCache && sync.artistTag && statsCache.tagName === sync.artistTag) {
        input.value = statsCache.tagName;
        renderArtistStats(view.querySelector('#sk-stats-out'), statsCache.tagName, statsCache.allPosts);
      } else if (sync.artistTag && (!statsCache || statsCache.tagName !== sync.artistTag)) {
        input.value = sync.artistTag;
        loadArtistStats(sync.artistTag);
      } else if (statsCache) {
        input.value = statsCache.tagName;
        renderArtistStats(view.querySelector('#sk-stats-out'), statsCache.tagName, statsCache.allPosts);
      }
      return;
    }

    ensureResultsMarkup();

    // Reuse an exact cached result if nothing's changed since we last saw this tab.
    if (searchCache && tagsEqual(searchCache.tags, searchState.tags) && searchCache.order === searchState.order) {
      paintSearchResults(searchCache);
    // Otherwise, if Stats just identified an animator we haven't searched yet, sync to it.
    } else if (sync.artistTag && !(searchCache && searchCache.tags.indexOf(sync.artistTag) !== -1)) {
      searchState.tags = [sync.artistTag];
      renderChips();
      runSearch();
    }
  }

  function ensureResultsMarkup() {
    var view = body.querySelector('#sk-search-view');
    view.innerHTML =
      '<div id="sk-back-to-shows" style="display:none"></div>' +
      // One tools row: the disclosure toggles (Filter, Most Frequently Tagged) on the left, the
      // result toggles (solo, hide uncredited) and reset on the right. Their panels open below it.
      '<div class="sk-toolbar" id="sk-toolbar" style="display:none">' +
        '<div class="sk-tb-l">' +
          '<span id="sk-facet-head" style="display:none">' +
            '<button class="sk-filter-toggle" id="sk-filter-toggle" type="button">' +
              'Filter <span class="sk-filter-badge" id="sk-filter-badge" style="display:none"></span>' +
              '<span class="chev">▾</span></button>' +
          '</span>' +
          '<span id="sk-show-animators-wrap"></span>' +
        '</div>' +
        '<div class="sk-tb-r">' +
          '<span id="sk-solo-row" style="display:none">' +
            '<button type="button" class="sk-icon-btn" id="sk-solo-toggle">&#9312;</button>' +
            '<button type="button" class="sk-icon-btn" id="sk-unknown-toggle">' +
              '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="display:block">' +
                '<path d="M5 5.2a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3"/><circle cx="7" cy="10.7" r=".4" fill="currentColor"/><path d="M2 12.5 12 1.5"/></svg>' +
            '</button>' +
          '</span>' +
          '<a href="#" id="sk-facet-all" class="sk-tb-reset" style="display:none">reset</a>' +
        '</div>' +
      '</div>' +
      '<div id="sk-show-animators-body"></div>' +
      '<div class="sk-facet-grid" id="sk-facet-grid" style="display:none"></div>' +
      '<div id="sk-results"></div>';
  }

  function commitPendingTag() {
    var input = body.querySelector('#sk-tag-input');
    if (!input) return;
    var val = input.value.trim().toLowerCase();
    if (val) {
      searchState.tags.push(val.replace(/\s+/g, '_'));
      input.value = '';
      renderChips();
    }
  }

  function renderChips() {
    var wrap = body.querySelector('#sk-chips');
    syncReroll();
    if (!wrap) return; // search tab isn't the active view right now — nothing to update
    wrap.innerHTML = '';
    searchState.tags.forEach(function (t, i) {
      var chip = document.createElement('div');
      var typeClass = tagTypeMap && tagTypeMap[t] === 1 ? ' is-artist' : (tagTypeMap && tagTypeMap[t] === 3 ? ' is-copyright' : '');
      chip.className = 'sk-chip' + typeClass;
      chip.innerHTML = esc(t) + ' <span data-i="' + i + '">&times;</span>';
      chip.querySelector('span').onclick = function () {
        searchState.tags.splice(i, 1);
        renderChips();
        autoSearch(400);
      };
      wrap.appendChild(chip);
    });
  }

