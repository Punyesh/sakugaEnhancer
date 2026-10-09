  function renderTab(name) {
    if (name === 'shows') renderShows();
    else if (name === 'pools') renderPools();
    else renderSearch();
  }

  // ---------- start from whatever booru page the bookmarklet was opened on ----------
  // On a post page, that post's tags are loaded in as search chips; on a
  // search/listing page, the page's own search is carried over and run. Done
  // before first render so the Search tab opens already filled in, instead of
  // making the person retype what they were just looking at.
  var pageSearchTags = null;   // listing page: tags to search immediately
  var pagePostId = null;       // post page: post whose tags to load as chips
  (function readPageContext() {
    try {
      var path = location.pathname;
      var m = /^\/post\/show\/(\d+)/.exec(path);
      if (m) { pagePostId = m[1]; return; }
      if (path === '/post' || path === '/post/' || path.indexOf('/post/index') === 0) {
        var raw = new URLSearchParams(location.search).get('tags') || '';
        var tokens = safeFilter(raw.split(/\s+/), function (t) { return !!t; });
        var keep = [];
        tokens.forEach(function (t) {
          var om = /^order:(.+)$/.exec(t);
          if (om) {
            // Carry over the page's sort if the dropdown supports it; drop
            // any other order: token so it can't linger as a bogus tag chip.
            if (/^(score|score_asc|id|random)$/.test(om[1])) searchState.order = om[1];
            else if (om[1] === 'date') searchState.order = 'date';
            return;
          }
          keep.push(t);
        });
        if (keep.length) pageSearchTags = keep;
      }
    } catch (e) { /* page context is a convenience — never block startup on it */ }
  })();
  if (pageSearchTags) searchState.tags = pageSearchTags.slice();

  renderTab('search');
  panel.style.display = 'flex';
  if (pageSearchTags) runSearch();
  if (pagePostId) {
    // Not auto-searched: a query made of every one of a post's tags only
    // matches that same post. They're loaded as chips (artists, shows, then
    // characters first) so the useful ones are ready to keep and the rest can
    // be dropped with the x.
    Promise.all([
      getJSON('/post.json?limit=1&tags=' + encodeURIComponent('id:' + pagePostId)),
      ensureTagTypes()
    ]).then(function (res) {
      var post = res[0] && res[0][0];
      var types = res[1] || {};
      if (!post || !post.tags || searchState.tags.length) return; // nothing found, or the person already started typing
      var all = safeFilter(post.tags.split(/\s+/), function (t) { return !!t; });
      var buckets = [[], [], [], []];
      all.forEach(function (t) {
        var ty = types[t];
        buckets[ty === 1 ? 0 : ty === 3 ? 1 : ty === 4 ? 2 : 3].push(t);
      });
      searchState.tags = buckets[0].concat(buckets[1], buckets[2], buckets[3]);
      renderChips();
    }).catch(function () { /* convenience only — fail silently */ });
  }
  // Warms the tag-dictionary cache in the background so chip colors are
  // usually already available by the time someone actually adds a tag,
  // rather than only fetching reactively the first time it's needed.
  ensureTagTypes().then(function () { renderChips(); });
