  // ---------- full tag dictionary (name, type, count) ----------
  // Fetched once and reused everywhere: hover tooltips need type, the Shows
  // tab needs it for real substring search since the server's name_pattern
  // behavior turned out to be unreliable to guess at. Cached in localStorage
  // so it survives page reloads — only slow the first time or after expiry.
  var allTagsList = null;
  var allTagsLoading = null;
  var tagTypeMap = null;
  var TAG_CACHE_KEY = 'sk-enh-tagdict-v1';
  var TAG_CACHE_MAX_AGE = 6 * 60 * 60 * 1000; // 6 hours

  function loadTagCache() {
    try {
      var raw = localStorage.getItem(TAG_CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.tags || !obj.fetchedAt) return null;
      if (Date.now() - obj.fetchedAt > TAG_CACHE_MAX_AGE) return null;
      return obj.tags;
    } catch (e) { return null; }
  }
  function saveTagCache(tags) {
    try { localStorage.setItem(TAG_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), tags: tags })); }
    catch (e) { /* storage full/blocked — non-fatal, just skip caching */ }
  }

  function fetchAllTagsPaged(onProgress) {
    var all = [];
    var PAGE_SIZE = 1000;
    var CONCURRENCY = 5; // fetch several pages in parallel instead of one at a time
    var MAX_TAG_PAGES = 150; // politeness/sanity cap — generous since real per-page size is unconfirmed
    var nextPage = 1;

    function fetchOne(n) {
      return getJSON('/tag.json?limit=' + PAGE_SIZE + '&page=' + n + '&order=name')
        .then(function (batch) {
          if (!Array.isArray(batch)) throw new Error('unexpected /tag.json response shape');
          return batch;
        });
    }

    function runBatch() {
      var pages = [];
      for (var i = 0; i < CONCURRENCY && nextPage <= MAX_TAG_PAGES; i++) { pages.push(nextPage); nextPage++; }
      if (!pages.length) return Promise.resolve();
      return Promise.all(safeMap(pages, fetchOne)).then(function (batches) {
        var reachedEnd = false;
        for (var i = 0; i < batches.length; i++) {
          all = all.concat(batches[i]);
          if (batches[i].length === 0) reachedEnd = true;
        }
        if (onProgress) onProgress(all.length);
        if (!reachedEnd && nextPage <= MAX_TAG_PAGES) {
          return sleep(80).then(runBatch); // brief pause between batches, not between individual requests
        }
      });
    }

    return runBatch().then(function () { return all; });
  }

  function ensureAllTags(onProgress) {
    if (allTagsList) return Promise.resolve(allTagsList);
    if (allTagsLoading) return allTagsLoading;

    var cached = loadTagCache();
    if (cached && cached.length) {
      allTagsList = cached;
      window.__skDebugTags = cached;
      tagTypeMap = {};
      for (var i = 0; i < cached.length; i++) { tagTypeMap[cached[i].name] = cached[i].type; }
      return Promise.resolve(allTagsList);
    }

    // Confirmed by direct testing: this fork's name_pattern parameter is a no-op
    // (identical results regardless of pattern), and limit=0 silently returns a
    // small default set rather than "everything" despite what the docs claim.
    // So: real pagination with an explicit limit, no shortcuts.
    allTagsLoading = fetchAllTagsPaged(onProgress)
      .then(function (list) {
        allTagsList = list;
        window.__skDebugTags = list; // debug hook — check in console with:
        // window.__skDebugTags.filter(t => t.name.includes('sometag'))
        tagTypeMap = {};
        for (var i = 0; i < list.length; i++) { tagTypeMap[list[i].name] = list[i].type; }
        saveTagCache(list);
        return allTagsList;
      })
      .catch(function (err) {
        allTagsLoading = null; // allow retrying on the next call instead of sticking forever
        tagTypeMap = tagTypeMap || {};
        throw err;
      });
    return allTagsLoading;
  }
  function ensureTagTypes() { return ensureAllTags().then(function () { return tagTypeMap; }).catch(function () { return tagTypeMap || {}; }); }

  function isVideoFile(url) { return /\.(webm|mp4|mov)(\?|$)/i.test(url || ''); }

  // Shared between the hover-preview dock and the tag section inside an
  // opened clip — both need the same chip rendering (color-coded by type)
  // and the same click-to-search behavior, no reason to duplicate either.
  function buildTagChipsHtml(tags, map) {
    var artistTags = safeFilter(tags, function (t) { return map[t] === 1; });
    var otherTags = safeFilter(tags, function (t) { return map[t] !== 1; });
    function chip(t, extraClass) {
      return '<span class="sk-mini-chip clickable ' + extraClass + '" data-tag="' + esc(t) + '">' + esc(t) + '</span>';
    }
    return '<div class="sk-dock-section">' +
        '<div class="sk-tagblock-label">' + (artistTags.length ? 'Animator' : 'Animator — untagged') + '</div>' +
        '<div class="sk-chipwrap">' +
          (artistTags.length
            ? safeMap(artistTags, function (t) { return chip(t, 'artist'); }).join('')
            : '<span class="sk-mini-chip other">not credited on this post</span>') +
        '</div>' +
      '</div>' +
      '<div class="sk-dock-section">' +
        '<div class="sk-tagblock-label">Tags (' + otherTags.length + ')</div>' +
        '<div class="sk-chipwrap">' +
          safeMap(otherTags, function (t) { return chip(t, map[t] === 3 ? 'show' : 'other'); }).join('') +
        '</div>' +
      '</div>';
  }

  function wireTagChipClicks(container, onNavigate) {
    container.onclick = function (e) {
      var chipEl = e.target.closest && e.target.closest('.sk-mini-chip[data-tag]');
      if (!chipEl) return;
      var tag = chipEl.getAttribute('data-tag');
      searchState.tags = [tag];
      searchViewMode = 'results';
      // switchToTab (not just ensureResultsMarkup) so this also rebuilds the
      // chip pills from the tags array, and correctly switches away from
      // Shows if that's where the clip was opened from — ensureResultsMarkup
      // alone only rebuilds the results container, not the chips display.
      switchToTab('search');
      runSearch();
      if (onNavigate) onNavigate();
    };
  }

