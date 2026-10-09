  function buildCard(p) {
    var card = document.createElement('div');
    card.className = 'sk-card';
    card.setAttribute('data-post-id', String(p.id)); // lets a vote cast later find this exact card and refresh its score without a full re-render
    var thumb = p.preview_url || p.jpeg_url || p.sample_url;
    var clipUrl = p.file_url;
    var playable = isVideoFile(clipUrl);
    card.innerHTML =
      (thumb ? '<img loading="lazy" src="' + thumb + '">' : '') +
      (playable ? '<video muted loop playsinline preload="none"></video><div class="vidmark">▶ clip</div>' : '') +
      '<div class="score">&#9650; ' + (p.score || 0) + '</div>' +
      '<div class="info-badge" title="tags &amp; info">&#9432;</div>';

    var hoverVid = null;
    if (playable) {
      hoverVid = card.querySelector('video');
      card.addEventListener('mouseenter', function () {
        hoverVid.src = clipUrl;
        hoverVid.play().catch(function () {});
      });
      card.addEventListener('mouseleave', function () {
        hoverVid.pause();
        hoverVid.removeAttribute('src');
        hoverVid.load();
      });
    }

    // A floating popup anchored to this badge, rather than a dock inline in
    // the results flow — the old version lived at the bottom of the whole
    // grid and had to yank the scroll position to bring itself into view on
    // every hover, which fought with normal browsing. This one just appears
    // next to whatever you clicked and doesn't touch scroll position at all.
    var infoBadge = card.querySelector('.info-badge');
    infoBadge.addEventListener('click', function (e) {
      e.stopPropagation(); // don't also trigger the card's own click-to-open
      openInfoPopup(infoBadge, p);
    });

    card.title = (p.tags || '').slice(0, 200);
    card.onclick = function () {
      if (playable) {
        if (hoverVid) hoverVid.pause();
        openVideoModal(p);
      } else {
        openImageModal(p);
      }
    };
    return card;
  }

  var UNKNOWN_ARTIST_TAG = 'artist_unknown';
  // Animator-type tags on a post other than the artist_unknown catch-all.
  function countRealAnimators(tags) {
    var n = 0;
    for (var i = 0; i < tags.length; i++) {
      if (tags[i] !== UNKNOWN_ARTIST_TAG && tagTypeMap && tagTypeMap[tags[i]] === 1) n++;
    }
    return n;
  }

  // "← back to …" link above the results: previous search if there is one,
  // else the Shows episode list this search came from, else hidden.
  function paintSearchBackLink(cache) {
    var backWrap = body.querySelector('#sk-back-to-shows');
    if (searchHistory.length) {
      var prev = searchHistory[searchHistory.length - 1];
      var prevLabel = prev.tags.join(' ');
      if (prevLabel.length > 40) prevLabel = prevLabel.slice(0, 39) + '…';
      backWrap.style.display = 'block';
      backWrap.innerHTML = '<a href="#" id="sk-back-link" class="sk-mini-toggle" style="display:inline-block;margin-bottom:8px">← back to ' + esc(prevLabel || 'previous search') + '</a>';
      backWrap.querySelector('#sk-back-link').onclick = function (e) {
        e.preventDefault();
        var entry = searchHistory.pop();
        if (!entry) return;
        searchState.tags = entry.tags.slice();
        searchState.order = entry.order;
        searchOrigin = entry.origin;
        var orderSel = body.querySelector('#sk-order');
        if (orderSel) orderSel.value = entry.order;
        renderChips();
        runSearch({ noHistory: true });
      };
    } else if (cache.origin && cache.origin.type === 'shows') {
      backWrap.style.display = 'block';
      backWrap.innerHTML = '<a href="#" id="sk-back-to-shows-link" class="sk-mini-toggle" style="display:inline-block;margin-bottom:8px">← back to episode list</a>';
      backWrap.querySelector('#sk-back-to-shows-link').onclick = function (e) {
        e.preventDefault();
        switchToTab('shows');
      };
    } else {
      backWrap.style.display = 'none';
      backWrap.innerHTML = '';
    }
  }

  // The solo-cut and hide-uncredited toggles above the results.
  function paintSearchToggles(cache) {
    var soloRow = body.querySelector('#sk-solo-row');
    var soloBtn = body.querySelector('#sk-solo-toggle');
    var unknownBtn = body.querySelector('#sk-unknown-toggle');
    if (cache.posts.length) {
      soloRow.style.display = 'flex';
      // Contradicts a search that already requires 2+ animators to all be
      // credited together (every result would necessarily have 2+ animator
      // tags, so "exactly 1" could never match anything) — disable rather
      // than let someone hit a silently-empty result.
      var soloDisabled = safeFilter(cache.tags, function (t) { return tagTypeMap && tagTypeMap[t] === 1; }).length > 1;
      if (soloDisabled && cache.soloOnly) cache.soloOnly = false;
      soloBtn.disabled = soloDisabled;
      soloBtn.classList.toggle('active', !!cache.soloOnly);
      soloBtn.title = soloDisabled
        ? 'solo cuts only — disabled, this search already requires 2+ animators'
        : (cache.soloOnly ? 'showing solo cuts only (exactly one animator) — click to show all' : 'solo cuts only — exactly one animator credited');
      soloBtn.onclick = function () {
        if (soloBtn.disabled) return;
        cache.soloOnly = !cache.soloOnly;
        paintSearchResults(cache);
      };

      // Hides cuts with no real credit: tagged only artist_unknown (the
      // catch-all for "no confirmed animator") or with no animator tag at
      // all. A cut with artist_unknown AND a real animator is kept, since
      // there IS info about who did something. Pointless while searching
      // for artist_unknown itself, so it's disabled then.
      var unknownDisabled = cache.tags.indexOf(UNKNOWN_ARTIST_TAG) !== -1;
      if (unknownDisabled && cache.hideUnknown) cache.hideUnknown = false;
      unknownBtn.disabled = unknownDisabled;
      unknownBtn.classList.toggle('active', !!cache.hideUnknown);
      unknownBtn.title = unknownDisabled
        ? 'hide uncredited cuts — disabled, this search is for artist_unknown'
        : (cache.hideUnknown ? 'hiding cuts with no known animator — click to show all' : 'hide cuts with no known animator (only artist_unknown, or no animator tag)');
      unknownBtn.onclick = function () {
        if (unknownBtn.disabled) return;
        cache.hideUnknown = !cache.hideUnknown;
        paintSearchResults(cache);
      };
    } else {
      soloRow.style.display = 'none';
    }
  }

  // The posts that survive the exclude-tags facets, hide-uncredited and solo filters.
  function filterVisiblePosts(cache) {
    // Solo cut = exactly one animator-type tag on the post. Same client-side
    // approach as the exclude-tags filter below, since there's no server-side
    // tag syntax for "exactly one of type X" — reuses the same tagTypeMap
    // already populated after every search.
    return safeFilter(cache.posts, function (p) {
      var tags = (p.tags || '').split(/\s+/);
      for (var i = 0; i < tags.length; i++) {
        if (cache.excluded[tags[i]]) return false;
      }
      if (cache.hideUnknown && tagTypeMap && countRealAnimators(tags) === 0) return false;
      if (cache.soloOnly) {
        var animatorCount = 0;
        for (var j = 0; j < tags.length; j++) {
          if (tagTypeMap && tagTypeMap[tags[j]] === 1) animatorCount++;
        }
        if (animatorCount !== 1) return false;
      }
      return true;
    });
  }

  // The card grid, plus the load-more sentinel / retry button underneath.
  function paintResultGrid(cache, visible) {
    var results = body.querySelector('#sk-results');
    if (!visible.length) {
      results.innerHTML = '<div class="sk-empty">' +
        (cache.posts.length ? 'no clips left after filtering' : 'no posts matched those tags') + '</div>';
    } else {
      var grid = document.createElement('div');
      grid.className = 'sk-grid';
      if (cache.sampledOnly) {
        var note = document.createElement('div');
        note.className = 'sk-caption';
        note.style.gridColumn = '1/-1';
        note.textContent = 'showing ' + visible.length + ' sampled post(s) with non-standard source text — ' +
          'not a complete search, just what turned up while sampling this show.';
        grid.appendChild(note);
      }
      visible.forEach(function (p) { grid.appendChild(buildCard(p)); });
      results.innerHTML = '';
      results.appendChild(grid);

      if (cache.hasMore || cache.loadMoreError) {
        var moreWrap = document.createElement('div');
        moreWrap.className = 'sk-load-more-wrap';
        if (cache.loadMoreError) {
          // Not auto-retried on scroll — a failed request re-entering view
          // would just retry-loop while it's still visible, so this stays a
          // deliberate click.
          moreWrap.innerHTML = '<div class="sk-empty">couldn\'t load more: ' + esc(cache.loadMoreError) + '</div>' +
            '<button class="sk-frame-btn" id="sk-load-more">retry</button>';
          moreWrap.querySelector('#sk-load-more').onclick = function () { loadMoreResults(cache); };
        } else if (cache.loadingMore) {
          moreWrap.innerHTML = '<div class="sk-loading" style="padding:10px 0">loading more…</div>';
        } else {
          moreWrap.innerHTML = '<div id="sk-load-sentinel" style="height:1px"></div>';
        }
        results.appendChild(moreWrap);

        if (!cache.loadMoreError && !cache.loadingMore) {
          var sentinel = moreWrap.querySelector('#sk-load-sentinel');
          if (searchScrollObserver) searchScrollObserver.disconnect();
          // root: body (not the default viewport) since the actual scrolling
          // happens inside the panel's own body, not the host page — the
          // default root would never report an intersection at all here.
          // rootMargin starts the fetch a bit before the sentinel is
          // literally on-screen, closer to how FlatList's onEndReached feels.
          searchScrollObserver = new IntersectionObserver(function (entries) {
            if (entries[0].isIntersecting) {
              searchScrollObserver.disconnect();
              loadMoreResults(cache);
            }
          }, { root: body, rootMargin: '200px' });
          searchScrollObserver.observe(sentinel);
        }
      }
    }
  }

  // The collapsible "exclude tags" facet filter and its badge.
  function paintFacetFilter(cache, visible) {
    var facetHead = body.querySelector('#sk-facet-head');
    var facetGrid = body.querySelector('#sk-facet-grid');
    var toggle = body.querySelector('#sk-filter-toggle');
    var badge = body.querySelector('#sk-filter-badge');
    var activeCount = safeFilter(Object.keys(cache.excluded), function (t) { return cache.excluded[t]; }).length;
    if (activeCount) { badge.style.display = 'inline'; badge.textContent = activeCount; }
    else { badge.style.display = 'none'; }

    toggle.onclick = function () {
      var open = facetGrid.style.display !== 'none';
      facetGrid.style.display = open ? 'none' : 'block';
      toggle.classList.toggle('open', !open);
    };

    if (cache.facetTags.length) {
      facetHead.style.display = 'flex';
      facetGrid.innerHTML = '<div class="sk-loading" style="padding:4px 0">loading tag info…</div>';
      ensureTagTypes().then(function (map) {
        var sorted = safeSort(cache.facetTags, function (a, b) {
          var aArtist = map[a] === 1 ? 0 : 1;
          var bArtist = map[b] === 1 ? 0 : 1;
          return aArtist - bArtist;
        });
        facetGrid.innerHTML = '<div class="sk-caption" style="grid-column:1/-1">' +
          'hides clips carrying an unchecked tag — most clips carry several, so unchecking ' +
          'just one still leaves the rest visible</div>';
        sorted.forEach(function (t) {
          var count = safeFilter(visible, function (p) { return (' ' + p.tags + ' ').indexOf(' ' + t + ' ') !== -1; }).length;
          var item = document.createElement('label');
          item.className = 'sk-facet-item' + (cache.excluded[t] ? ' off' : '') + (map[t] === 1 ? ' is-artist' : '');
          item.innerHTML =
            '<input type="checkbox" ' + (cache.excluded[t] ? '' : 'checked') + '> ' +
            '<span class="fname" title="' + esc(t) + '">' + esc(t) + '</span>' +
            '<span class="fcount">' + count + '</span>';
          item.querySelector('input').addEventListener('change', function (e) {
            cache.excluded[t] = !e.target.checked;
            paintSearchResults(cache);
          });
          facetGrid.appendChild(item);
        });
      });
      body.querySelector('#sk-facet-all').onclick = function (e) {
        e.preventDefault(); cache.excluded = {}; paintSearchResults(cache);
      };
    } else {
      facetHead.style.display = 'none';
      facetGrid.innerHTML = '';
    }
  }

  function paintSearchResults(cache) {
    paintSearchBackLink(cache);
    maybeRenderShowAnimatorsInSearch(body.querySelector('#sk-show-animators-wrap'), cache);
    paintSearchToggles(cache);
    var visible = filterVisiblePosts(cache);
    paintResultGrid(cache, visible);
    paintFacetFilter(cache, visible);
  }

  function runSearch(opts) {
    opts = opts || {};
    // Remember where we were so "← back" can return to it. A search launched
    // from the Shows tab (searchOrigin set) starts a fresh trail instead —
    // its way back is the episode list. Going back itself passes noHistory.
    if (!opts.noHistory) {
      if (searchOrigin) {
        searchHistory = [];
      } else if (searchCache && !tagsEqual(searchCache.tags, searchState.tags)) {
        searchHistory.push({ tags: searchCache.tags.slice(), order: searchCache.order, origin: searchCache.origin || null });
        if (searchHistory.length > 20) searchHistory.shift();
      }
    }
    var results = body.querySelector('#sk-results');
    results.innerHTML = '<div class="sk-loading">fetching…</div>';
    body.querySelector('#sk-facet-head').style.display = 'none';
    body.querySelector('#sk-facet-grid').innerHTML = '';
    body.querySelector('#sk-facet-grid').style.display = 'none';
    body.querySelector('#sk-filter-toggle').classList.remove('open');
    var tagsSnapshot = searchState.tags.slice();
    var orderSnapshot = searchState.order;
    var tagQuery = tagsSnapshot.join(' ') + ' order:' + orderSnapshot;
    var PAGE_SIZE = 24;

    return getJSON('/post.json?limit=' + PAGE_SIZE + '&tags=' + encodeURIComponent(tagQuery.trim()))
      .then(function (posts) {
        searchCache = {
          tags: tagsSnapshot, order: orderSnapshot, posts: posts, excluded: {}, soloOnly: false,
          facetTags: computeFacetTags(posts, tagsSnapshot),
          page: 1, pageSize: PAGE_SIZE, hasMore: posts.length === PAGE_SIZE, loadingMore: false,
          origin: searchOrigin
        };
        searchOrigin = null; // consumed — only applies to the search that was pending when set
        paintSearchResults(searchCache);

        // Figure out if this query is "about" a specific animator, so Stats can sync to it.
        ensureTagTypes().then(function (map) {
          var found = safeFilter(tagsSnapshot, function (t) { return map[t] === 1; })[0] || null;
          sync.artistTag = found;
          var statsBtn = body.querySelector('#sk-mode-stats');
          if (statsBtn) statsBtn.textContent = sync.artistTag ? '▥ Stats: ' + sync.artistTag : '▥ Animator Stats';
        });
        return posts.length;
      })
      .catch(function (err) {
        results.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
      });
  }

  // Different shows' taggers use different, unpredictable source-text conventions
  // ("#357" vs "#0357" zero-padded vs "Episode 357" vs bare "357"), and even the
  // exact matching behavior of the site's own source: search isn't fully known
  // (a confirmed real case: "#0357" matched neither "#357" nor bare "357" — so
  // it isn't a simple raw substring match either). Rather than guess once, try
  // several realistic candidates in order and stop at the first that hits.
  function buildEpisodeCandidates(num, observedToken) {
    var plain = String(num);
    var pad3 = plain.length < 3 ? ('00' + plain).slice(-3) : plain;
    var pad4 = plain.length < 4 ? ('000' + plain).slice(-4) : plain;
    var seen = {};
    var out = [];
    function add(tok) { if (tok && !seen[tok]) { seen[tok] = true; out.push(tok); } }
    add(observedToken); // the exact raw text we actually saw, if we have it — try this first
    [plain, pad3, pad4].forEach(function (r) { add('#' + r); add(r); });
    return out;
  }

  function searchEpisodeWithFallback(showTag, candidates) {
    searchState.order = 'date';
    searchViewMode = 'results';
    sync.artistTag = null;
    var i = 0;
    function tryNext() {
      if (i >= candidates.length) return;
      searchState.tags = [showTag, 'source:' + candidates[i]];
      searchOrigin = { type: 'shows', showTag: showTag };
      if (i === 0) { switchToTab('search'); } else { renderChips(); }
      var attempt = i;
      runSearch().then(function (count) {
        if (count === 0 && attempt + 1 < candidates.length) {
          i = attempt + 1;
          tryNext();
        }
      });
    }
    tryNext();
  }

  function searchEpisodeNumber(showTag, num) {
    searchEpisodeWithFallback(showTag, buildEpisodeCandidates(num, null));
  }

  function computeFacetTags(posts, tagsSnapshot) {
    var freq = {};
    posts.forEach(function (p) {
      (p.tags || '').split(/\s+/).forEach(function (t) {
        if (!t || tagsSnapshot.indexOf(t) !== -1) return;
        freq[t] = (freq[t] || 0) + 1;
      });
    });
    return safeSort(Object.keys(freq), function (a, b) { return freq[b] - freq[a]; }).slice(0, 24);
  }

  function loadMoreResults(cache) {
    if (cache.loadingMore || !cache.hasMore) return;
    cache.loadingMore = true;
    paintSearchResults(cache); // repaint immediately so the button shows a loading state
    var nextPage = cache.page + 1;
    var tagQuery = cache.tags.join(' ') + ' order:' + cache.order;
    getJSON('/post.json?limit=' + cache.pageSize + '&page=' + nextPage + '&tags=' + encodeURIComponent(tagQuery.trim()))
      .then(function (posts) {
        cache.posts = cache.posts.concat(posts);
        cache.page = nextPage;
        cache.hasMore = posts.length === cache.pageSize;
        cache.loadingMore = false;
        cache.facetTags = computeFacetTags(cache.posts, cache.tags);
        paintSearchResults(cache);
      })
      .catch(function (err) {
        cache.loadingMore = false;
        cache.loadMoreError = err.message;
        paintSearchResults(cache);
      });
  }

