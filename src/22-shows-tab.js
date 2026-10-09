  // ===================== SHOWS TAB =====================
  // Episode grouping is a best-effort parse of each post's free-text `source`
  // field (there's no structured season/episode data in the API) — accurate
  // wherever taggers followed the site's own "Title #12" convention, rougher
  // where they didn't. Show search reuses the same paginated tag dictionary
  // as the hover/filter features, since this fork's name_pattern parameter
  // and limit=0 are both confirmed no-ops — real pagination + client-side
  // filtering is the only approach that's actually been verified to work.
  //
  // Navigation is a simple back/forward history stack, like a browser:
  // each entry is either {type:'results', query, showsList} (a season/title
  // search) or {type:'episodes', showTag, entry, query} (an episode grid).
  var showsCache = {}; // showTag -> { totalSampled, related: [...], episodes: [...] }
  var SHOW_SAMPLE_PAGES = 3; // politeness cap: sample up to 300 posts to build the episode index
  var navStack = [];
  var navIndex = -1;

  function pushNav(snapshot) {
    navStack = navStack.slice(0, navIndex + 1);
    navStack.push(snapshot);
    navIndex = navStack.length - 1;
    renderNavCurrent();
  }
  function goBack() { if (navIndex > 0) { navIndex--; renderNavCurrent(); } }
  function goForward() { if (navIndex < navStack.length - 1) { navIndex++; renderNavCurrent(); } }

  function parseEpisodeKey(source) {
    var s = (source || '').trim();
    if (!s) return { key: 'unsorted', label: 'No source listed', sortNum: 1e9, token: null };
    var m = s.match(/#\s?(\d{1,4})/);
    if (m) return { key: 'ep:' + (+m[1]), label: 'Episode ' + (+m[1]), sortNum: +m[1], token: '#' + m[1] };
    m = s.match(/\bep(?:isode)?\.?\s?(\d{1,4})\b/i);
    if (m) return { key: 'ep:' + (+m[1]), label: 'Episode ' + (+m[1]), sortNum: +m[1], token: '#' + m[1] };
    if (/\bmovie\b/i.test(s)) return { key: 'movie', label: 'Movie', sortNum: 1e6 + 1, token: 'movie' };
    if (/\bova\b/i.test(s)) return { key: 'ova', label: 'OVA', sortNum: 1e6 + 2, token: 'OVA' };
    if (/\b(opening|op\d*)\b/i.test(s)) return { key: 'op', label: 'Opening', sortNum: 1e6 + 3, token: 'OP' };
    if (/\b(ending|ed\d*)\b/i.test(s)) return { key: 'ed', label: 'Ending', sortNum: 1e6 + 4, token: 'ED' };
    if (/\b(pv|trailer)\b/i.test(s)) return { key: 'pv', label: 'PV / Trailer', sortNum: 1e6 + 5, token: 'PV' };
    // Anything else (individual Twitter/X credit links, one-off free text, etc.) isn't a
    // real episode marker — group it all into one bucket instead of one card per unique URL.
    return { key: 'other', label: 'Other / uncategorized', sortNum: 1e6 + 6, token: null };
  }

  function normalizeRelated(resp, showTag) {
    try {
      var arr = Array.isArray(resp) ? resp : (resp && (resp[showTag] || resp.tags)) || [];
      var mapped = safeMap(arr, function (x) {
        if (Array.isArray(x)) return { name: x[0], count: x[1] || 0 };
        if (x && x.name) return { name: x.name, count: x.count || 0 };
        return null;
      });
      return safeFilter(mapped, function (x) { return x && x.name !== showTag; }).slice(0, 8);
    } catch (e) { return []; }
  }

  function renderShows() {
    body.innerHTML =
      '<div class="sk-row"><input class="sk-input" id="sk-show-input" placeholder="search a show or movie title"></div>' +
      '<div class="sk-show-nav" id="sk-show-nav" style="display:none">' +
        '<button class="sk-nav-btn" id="sk-nav-back" type="button">← Back</button>' +
        '<span class="sk-nav-crumb" id="sk-nav-crumb"></span>' +
        '<button class="sk-nav-btn" id="sk-nav-forward" type="button">Forward →</button>' +
      '</div>' +
      '<div id="sk-show-content"></div>';

    var input = body.querySelector('#sk-show-input');
    var debounceTimer = null;
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      var q = input.value.trim();
      if (!q) return;
      debounceTimer = setTimeout(function () { searchShowTags(q); }, 300);
    });

    body.querySelector('#sk-nav-back').onclick = goBack;
    body.querySelector('#sk-nav-forward').onclick = goForward;

    // Restore wherever we left off if this tab was visited before this session.
    if (navStack.length) renderNavCurrent();
  }

  function updateNavChrome() {
    var navBar = body.querySelector('#sk-show-nav');
    var backBtn = body.querySelector('#sk-nav-back');
    var fwdBtn = body.querySelector('#sk-nav-forward');
    var crumb = body.querySelector('#sk-nav-crumb');
    if (!navStack.length) { navBar.style.display = 'none'; return; }
    navBar.style.display = 'flex';
    backBtn.disabled = navIndex <= 0;
    fwdBtn.disabled = navIndex >= navStack.length - 1;
    var cur = navStack[navIndex];
    crumb.textContent = cur.type === 'episodes' ? cur.showTag : ('"' + cur.query + '"');
  }

  function renderNavCurrent() {
    updateNavChrome();
    var content = body.querySelector('#sk-show-content');
    var cur = navStack[navIndex];
    var input = body.querySelector('#sk-show-input');
    if (!cur) { content.innerHTML = ''; return; }
    input.value = cur.type === 'episodes' ? cur.showTag : cur.query;
    if (cur.type === 'results') paintShowResults(content, cur.showsList);
    else paintShowDetail(content, cur.showTag, cur.entry);
  }

  function searchShowTags(q) {
    var content = body.querySelector('#sk-show-content');
    content.innerHTML = '<div class="sk-loading">loading tag dictionary…</div>';
    var norm = normalizeForTagMatch(q.trim().toLowerCase().replace(/\s+/g, '_'));

    ensureAllTags(function (n) {
      if (!allTagsList) content.innerHTML = '<div class="sk-loading">loading tag dictionary… (' + n + ' so far)</div>';
    }).then(function (list) {
      if (!list.length) {
        content.innerHTML = '<div class="sk-empty">couldn\'t load sakugabooru\'s tag list right now — try again in a moment</div>';
        return;
      }
      var direct = safeFilter(list, function (t) { return t.type === 3 && normalizeForTagMatch(t.name).indexOf(norm) !== -1; });
      var showsList = direct;
      if (!showsList.length) {
        // Multi-word query rarely matches one contiguous tag name — try each word.
        var words = safeFilter(norm.split('_'), function (w) { return w.length >= 3; });
        var seen = {};
        showsList = [];
        words.forEach(function (w) {
          list.forEach(function (t) {
            if (t.type === 3 && normalizeForTagMatch(t.name).indexOf(w) !== -1 && !seen[t.name]) {
              seen[t.name] = true;
              showsList.push(t);
            }
          });
        });
      }
      showsList = safeSort(showsList, function (a, b) { return b.count - a.count; }).slice(0, 15);

      if (!showsList.length) {
        content.innerHTML = '<div class="sk-empty">no tags contain "' + esc(q) +
          '" — sakugabooru search is substring-based, not fuzzy, so try the full ' +
          'romanized title rather than a nickname or abbreviation</div>';
        return;
      }
      pushNav({ type: 'results', query: q, showsList: showsList });
    }).catch(function (err) {
      content.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
    });
  }

  function paintShowResults(content, showsList) {
    content.innerHTML = '';
    showsList.forEach(function (t) {
      var item = document.createElement('div');
      item.className = 'sk-show-pick';
      item.innerHTML = '<span class="name">' + esc(t.name) + '</span><span class="cnt">' + t.count + ' posts</span>';
      item.onclick = function () {
        content.innerHTML = '<div class="sk-loading">loading ' + esc(t.name) + '…</div>';
        getShowEntry(t.name).then(function (entry) {
          pushNav({ type: 'episodes', showTag: t.name, entry: entry });
        }).catch(function (err) {
          content.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
        });
      };
      content.appendChild(item);
    });
  }

  function getShowEntry(showTag, targetPages) {
    targetPages = targetPages || SHOW_SAMPLE_PAGES;
    var cached = showsCache[showTag];
    if (cached && (cached.pagesFetched >= targetPages || cached.exhausted)) return Promise.resolve(cached);

    var startPage = cached ? cached.pagesFetched + 1 : 1;
    var priorPosts = cached ? cached.posts : [];
    var relatedPromise = cached ? Promise.resolve(cached.related) :
      getJSON('/tag/related.json?tags=' + encodeURIComponent(showTag) + '&type=copyright')
        .then(function (r) { return normalizeRelated(r, showTag); })
        .catch(function () { return []; });

    var newPosts = [];
    var reachedEnd = false;
    function fetchPage(page) {
      return getJSON('/post.json?limit=100&page=' + page + '&tags=' + encodeURIComponent(showTag) + '+order:date')
        .then(function (batch) {
          newPosts = newPosts.concat(batch);
          if (batch.length < 100) { reachedEnd = true; return; } // genuinely out of posts, not just hit our cap
          if (page < targetPages) {
            return sleep(PAGE_DELAY).then(function () { return fetchPage(page + 1); });
          }
        });
    }

    return Promise.all([relatedPromise, fetchPage(startPage)]).then(function (res) {
      var related = res[0];
      var allPosts = priorPosts.concat(newPosts);
      if (!allPosts.length) return { totalSampled: 0, related: related, episodes: [], posts: [], pagesFetched: targetPages, exhausted: reachedEnd };
      var groups = {};
      allPosts.forEach(function (p) {
        var g = parseEpisodeKey(p.source);
        if (!groups[g.key]) groups[g.key] = { label: g.label, sortNum: g.sortNum, token: g.token, count: 0, posts: [] };
        groups[g.key].count++;
        groups[g.key].posts.push(p);
      });
      var episodes = safeSort(safeMap(Object.keys(groups), function (k) { return groups[k]; }),
        function (a, b) { return a.sortNum - b.sortNum; });
      var entry = {
        totalSampled: allPosts.length, related: related, episodes: episodes,
        posts: allPosts, pagesFetched: targetPages, exhausted: reachedEnd
      };
      showsCache[showTag] = entry;
      return entry;
    });
  }

  // Ranks animator-type tags by how often they appear across a show's
  // sampled posts — same tag-type map already used for color-coding
  // everywhere else, just tallied instead of just colored. Collapsed by
  // default wherever it's used: it's a nice-to-have alongside the main
  // content (episodes, or search results), not something that should push
  // that content down before anyone's asked to see it.
  function renderTopAnimatorsPanel(wrap, showTag, posts) {
    wrap.innerHTML = '<button class="sk-mini-toggle" id="sk-top-animators-toggle" type="button">Most Frequently Tagged ▾</button>' +
      '<div id="sk-top-animators-body" style="display:none;margin-top:8px"></div>';
    var toggleBtn = wrap.querySelector('#sk-top-animators-toggle');
    var bodyEl = wrap.querySelector('#sk-top-animators-body');
    var loaded = false;
    toggleBtn.onclick = function () {
      var open = bodyEl.style.display !== 'none';
      bodyEl.style.display = open ? 'none' : 'block';
      toggleBtn.textContent = 'Most Frequently Tagged ' + (open ? '▾' : '▴');
      if (!open && !loaded) {
        loaded = true;
        bodyEl.innerHTML = '<div class="sk-loading">loading…</div>';
        renderTopAnimatorsContent(bodyEl, showTag, posts);
      }
    };
  }

  // Shared by both directions of this feature (a show's most-tagged
  // animators, and an animator's most-frequent shows) — same visual
  // language either way, just a different accent color per variant so the
  // two stay visually distinct (amber for animators, blue for shows,
  // matching the tag-chip color-coding used everywhere else).
  function buildFreqRows(names, freq, variant) {
    var maxCount = freq[names[0]];
    return safeMap(names, function (name, i) {
      var pct = Math.max(6, Math.round((freq[name] / maxCount) * 100));
      return '<div class="sk-freq-row' + (variant === 'show' ? ' is-show' : '') + '" data-tag="' + esc(name) + '">' +
        '<span class="sk-freq-rank">' + (i + 1) + '</span>' +
        '<span class="sk-freq-name" title="' + esc(name) + '">' + esc(name) + '</span>' +
        '<span class="sk-freq-bar-wrap"><span class="sk-freq-bar" style="width:' + pct + '%"></span></span>' +
        '<span class="sk-freq-count">' + freq[name] + '</span>' +
      '</div>';
    }).join('');
  }

  function renderTopAnimatorsContent(bodyEl, showTag, posts) {
    ensureTagTypes().then(function (map) {
      var freq = {};
      posts.forEach(function (p) {
        var seen = {}; // count each animator once per post even if the tag string somehow repeats it
        safeFilter((p.tags || '').split(/\s+/), function (t) { return !!t; }).forEach(function (t) {
          if (t === showTag || seen[t]) return;
          if (map && map[t] === 1) {
            freq[t] = (freq[t] || 0) + 1;
            seen[t] = true;
          }
        });
      });
      var names = safeSort(Object.keys(freq), function (a, b) { return freq[b] - freq[a]; }).slice(0, 8);
      if (!names.length) { bodyEl.innerHTML = '<div class="sk-caption">no animator tags found in the sample.</div>'; return; }
      bodyEl.innerHTML = '<div class="sk-freq-list">' + buildFreqRows(names, freq, 'artist') + '</div>';
      var rowEls = bodyEl.querySelectorAll('.sk-freq-row');
      for (var i = 0; i < rowEls.length; i++) {
        rowEls[i].onclick = function (e) {
          var tag = e.currentTarget.getAttribute('data-tag');
          // Combined with the show tag rather than searching the animator
          // alone — this list means "who shows up a lot in this show", so
          // clicking one means "show me their cuts in this show", not
          // their entire catalog everywhere.
          // The show-only search is the step "back" returns to. From the Shows
          // tab it was never run in the Search tab, so it's recorded here
          // (with the episode-list origin); from the Search tab's own panel
          // it's simply the search currently on screen.
          var fromShowsTab = !!body.querySelector('#sk-show-content');
          searchHistory = [{
            tags: [showTag],
            order: searchState.order,
            origin: fromShowsTab ? { type: 'shows', showTag: showTag } : (searchCache && searchCache.origin) || null
          }];
          searchState.tags = [showTag, tag];
          searchViewMode = 'results';
          // Must be null here, NOT the clicked animator: switching to the
          // Search tab runs its "sync to the Stats animator" step, which
          // sees an animator that isn't in the previous results and
          // replaces the whole tag list with just that animator — silently
          // dropping the show tag. runSearch() sets this itself afterward
          // once it finds the animator among the query's tags.
          sync.artistTag = null;
          // No searchOrigin: this is a show+animator search, not an episode
          // lookup. The back link comes from searchHistory above instead.
          searchOrigin = null;
          switchToTab('search');
          renderChips();
          runSearch({ noHistory: true });
        };
      }
    });
  }

  // Only fires for a search that's just a single show/copyright-type tag
  // and nothing else — anything more specific (an episode, an animator
  // combo) isn't really "browsing a show" anymore, so the panel would be
  // answering a question nobody asked at that point.
  function maybeRenderShowAnimatorsInSearch(wrap, cache) {
    wrap.innerHTML = '';
    if (!cache.tags || cache.tags.length !== 1) return;
    var tag = cache.tags[0];
    ensureTagTypes().then(function (map) {
      if (!map || map[tag] !== 3) return;
      return getShowEntry(tag).then(function (entry) {
        if (!entry.totalSampled) return;
        renderTopAnimatorsPanel(wrap, tag, entry.posts);
      });
    }).catch(function () { /* nice-to-have alongside search — fail silently rather than surface an error for it */ });
  }

  function paintShowDetail(content, showTag, entry) {
    window.__skDebugShowEntry = entry; // debug hook — inspect real source text in console, see README
    if (!entry.totalSampled) {
      content.innerHTML = '<div class="sk-empty">no posts sampled for "' + esc(showTag) + '"</div>';
      return;
    }
    content.innerHTML =
      '<div class="sk-show-head">' +
        '<span class="title">' + esc(showTag) + '</span>' +
        (entry.related.length ? '<button class="sk-mini-toggle" id="sk-related-toggle">related (' + entry.related.length + ') ▾</button>' : '') +
        '<button class="sk-mini-toggle" id="sk-info-toggle">ⓘ how this works</button>' +
      '</div>' +
      (entry.related.length ? '<div class="sk-related-row" id="sk-related-row" style="display:none"></div>' : '') +
      '<div id="sk-top-animators-wrap" style="margin-bottom:8px"></div>' +
      '<div class="sk-caption" id="sk-show-info" style="display:none">episode grouping below is parsed from each post\'s source text (the ' +
        '"Title #12" convention), sampled from the ' + entry.totalSampled + ' most <b>recently tagged</b> posts — ' +
        'not chronological by episode, so which numbers show up is down to tagging activity, not air order ' +
        '(that\'s why the list might skip straight from Episode 357 to 1056 instead of starting at 1). ' +
        'Anything that isn\'t a recognizable episode/OP/ED/movie marker (like individual social-media credit ' +
        'links) gets grouped into one "Other" bucket. For a specific known episode, use the jump box below — ' +
        'it searches directly rather than relying on this sample.</div>' +
      '<div class="sk-row">' +
        '<input class="sk-input" id="sk-ep-jump" type="number" min="1" placeholder="know the episode number? jump straight to it, e.g. 1000">' +
        '<button class="sk-btn" id="sk-ep-jump-go">Go</button>' +
      '</div>' +
      '<div class="sk-ep-grid" id="sk-ep-grid"></div>' +
      '<div class="sk-load-more-wrap" id="sk-scan-more-wrap"></div>';

    if (entry.related.length) {
      content.querySelector('#sk-related-toggle').onclick = function () {
        var row = content.querySelector('#sk-related-row');
        var open = row.style.display !== 'none';
        row.style.display = open ? 'none' : 'flex';
        this.textContent = 'related (' + entry.related.length + ') ' + (open ? '▾' : '▴');
      };
    }
    renderTopAnimatorsPanel(content.querySelector('#sk-top-animators-wrap'), showTag, entry.posts);
    content.querySelector('#sk-info-toggle').onclick = function () {
      var info = content.querySelector('#sk-show-info');
      var open = info.style.display !== 'none';
      info.style.display = open ? 'none' : 'block';
    };

    content.querySelector('#sk-ep-jump-go').onclick = function () {
      var input = content.querySelector('#sk-ep-jump');
      var num = parseInt(input.value, 10);
      if (!num || num < 1) return;
      searchEpisodeNumber(showTag, num);
    };
    content.querySelector('#sk-ep-jump').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') content.querySelector('#sk-ep-jump-go').click();
    });

    if (entry.related.length) {
      var row = content.querySelector('#sk-related-row');
      entry.related.forEach(function (r) {
        var chip = document.createElement('span');
        chip.className = 'sk-chip clickable';
        chip.textContent = r.name + ' (' + r.count + ')';
        chip.onclick = function () {
          content.innerHTML = '<div class="sk-loading">loading ' + esc(r.name) + '…</div>';
          getShowEntry(r.name).then(function (e2) {
            pushNav({ type: 'episodes', showTag: r.name, entry: e2 });
          }).catch(function (err) {
            content.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
          });
        };
        row.appendChild(chip);
      });
    }

    var grid = content.querySelector('#sk-ep-grid');
    entry.episodes.forEach(function (ep) {
      var btn = document.createElement('div');
      btn.className = 'sk-ep-btn';
      btn.innerHTML = '<span class="num">' + esc(ep.label) + '</span><span class="cnt">' +
        (ep.token ? ep.count + ' sampled' : ep.count + ' sampled · browse only') + '</span>';
      btn.onclick = function () {
        searchState.order = 'date';
        searchViewMode = 'results';
        sync.artistTag = null; // avoid Search's auto-sync overwriting this specific episode query
        if (ep.token && ep.sortNum < 1e6) {
          // A numbered episode — try the exact text we actually observed first,
          // then fall back through likely alternate formats (see buildEpisodeCandidates).
          searchEpisodeWithFallback(showTag, buildEpisodeCandidates(ep.sortNum, ep.token));
        } else if (ep.token) {
          // OP/ED/Movie/OVA/PV — a fixed word, not a number, so no fallback needed.
          searchState.tags = [showTag, 'source:' + ep.token];
          searchOrigin = { type: 'shows', showTag: showTag };
          switchToTab('search');
          runSearch();
        } else {
          // No single query can isolate this bucket (e.g. individual social-media credit
          // links each with a different URL) — show exactly the posts we already sampled
          // instead of pretending we can search for them.
          var freq = {};
          ep.posts.forEach(function (p) {
            (p.tags || '').split(/\s+/).forEach(function (t) {
              if (!t || t === showTag) return;
              freq[t] = (freq[t] || 0) + 1;
            });
          });
          var facetTags = safeSort(Object.keys(freq), function (a, b) { return freq[b] - freq[a]; }).slice(0, 24);
          searchState.tags = [showTag];
          searchCache = {
            tags: [showTag], order: 'date', posts: ep.posts, excluded: {}, soloOnly: false, facetTags: facetTags,
            sampledOnly: true, origin: { type: 'shows', showTag: showTag }
          };
          switchToTab('search');
        }
      };
      grid.appendChild(btn);
    });

    var scanWrap = content.querySelector('#sk-scan-more-wrap');
    function renderScanButton() {
      if (entry.exhausted) {
        scanWrap.innerHTML = '<div class="sk-caption">sampled this show\'s entire post history — nothing more to scan</div>';
        return;
      }
      scanWrap.innerHTML = '<button class="sk-frame-btn" id="sk-scan-more">' +
        'scan further back (+300 more posts, currently ' + entry.totalSampled + ')</button>';
      scanWrap.querySelector('#sk-scan-more').onclick = function () {
        scanWrap.innerHTML = '<div class="sk-loading">scanning further back… (may take a few seconds)</div>';
        getShowEntry(showTag, (entry.pagesFetched || SHOW_SAMPLE_PAGES) + 3).then(function (deeperEntry) {
          if (navStack[navIndex] && navStack[navIndex].type === 'episodes' && navStack[navIndex].showTag === showTag) {
            navStack[navIndex].entry = deeperEntry;
          }
          paintShowDetail(content, showTag, deeperEntry);
        }).catch(function (err) {
          scanWrap.innerHTML = '<div class="sk-empty">couldn\'t scan further: ' + esc(err.message) + '</div>';
        });
      };
    }
    renderScanButton();
  }

