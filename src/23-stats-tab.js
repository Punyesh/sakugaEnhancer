  // ===================== STATS TAB =====================
  var MAX_PAGES = 5; // politeness cap: up to 500 posts per animator
  var PAGE_DELAY = 350; // ms between paginated requests

  function loadArtistStats(tagName) {
    var out = body.querySelector('#sk-stats-out');
    out.innerHTML = '<div class="sk-loading">pulling posts… (paced, may take a few seconds)</div>';

    var allPosts = [];
    function fetchPage(page) {
      return getJSON('/post.json?limit=100&page=' + page + '&tags=' + encodeURIComponent(tagName))
        .then(function (posts) {
          allPosts = allPosts.concat(posts);
          if (posts.length === 100 && page < MAX_PAGES) {
            return sleep(PAGE_DELAY).then(function () { return fetchPage(page + 1); });
          }
        });
    }

    fetchPage(1).then(function () {
      if (!allPosts.length) {
        out.innerHTML = '<div class="sk-empty">no posts found for tag "' + esc(tagName) + '" — check the exact tag spelling on the site\'s artist page</div>';
        return;
      }
      statsCache = { tagName: tagName, allPosts: allPosts };
      sync.artistTag = tagName;
      var statsBtn = body.querySelector('#sk-mode-stats');
      if (statsBtn) statsBtn.textContent = '▥ Stats: ' + tagName;
      renderArtistStats(out, tagName, allPosts);
    }).catch(function (err) {
      out.innerHTML = '<div class="sk-empty">error: ' + esc(err.message) + '</div>';
    });
  }

  function renderArtistStats(out, tagName, posts) {
    var total = posts.length;
    var scoreSum = 0;
    var tagFreq = {};
    var yearCounts = {};

    posts.forEach(function (p) {
      scoreSum += (p.score || 0);
      (p.tags || '').split(/\s+/).forEach(function (t) {
        if (!t || t === tagName) return;
        tagFreq[t] = (tagFreq[t] || 0) + 1;
      });
      if (p.created_at) {
        var y = new Date(p.created_at * 1000).getFullYear();
        yearCounts[y] = (yearCounts[y] || 0) + 1;
      }
    });

    var topTags = safeSort(Object.keys(tagFreq), function (a, b) { return tagFreq[b] - tagFreq[a]; })
      .slice(0, 10);
    var maxTagCount = topTags.length ? tagFreq[topTags[0]] : 1;

    var years = safeSort(Object.keys(yearCounts), function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
    var maxYearCount = years.reduce(function (m, y) { return Math.max(m, yearCounts[y]); }, 1);
    var avgScore = total ? (scoreSum / total).toFixed(1) : '0';
    var note = total >= MAX_PAGES * 100
      ? '<div class="sk-meta">capped at ' + (MAX_PAGES * 100) + ' most relevant posts to keep this quick &amp; light on the server</div>'
      : '';

    out.innerHTML =
      '<div class="sk-meta">tag: <b style="color:' + C.amber + '">' + esc(tagName) + '</b> · ' +
        '<a href="#" id="sk-goto-search" style="color:' + C.amber + '">← back to results</a></div>' +
      '<div class="sk-stat-block">' +
        '<div><div class="sk-stat-big">' + total + '</div><div class="sk-stat-label">cuts found</div></div>' +
        '<div><div class="sk-stat-big">' + avgScore + '</div><div class="sk-stat-label">avg score</div></div>' +
      '</div>' +
      '<div class="sk-meta">most frequent shows</div>' +
      '<div id="sk-artist-shows"><div class="sk-loading">loading…</div></div>' +
      '<div style="height:6px"></div>' +
      '<div class="sk-meta" title="Based on when each post was added/tagged on sakugabooru, not when the original episode aired — a 2005 cut uploaded in 2021 shows up as 2021 here.">upload year ⓘ</div>' +
      '<div class="sk-filmstrip" id="sk-strip"></div>' +
      '<div style="height:18px"></div>' +
      '<div class="sk-meta">most frequent co-tags &mdash; use Search\'s filter grid to narrow by these</div>' +
      '<div class="sk-taglist" id="sk-taglist"></div>' +
      note;

    // Same tally already gathered for co-tags above, just narrowed to
    // show/copyright-type tags specifically — no separate pass over the
    // posts needed. Async only because the tag-type dictionary might not
    // be loaded yet; everything else on this screen doesn't need it.
    var showsWrap = out.querySelector('#sk-artist-shows');
    ensureTagTypes().then(function (map) {
      var showNames = safeSort(
        safeFilter(Object.keys(tagFreq), function (t) { return map && map[t] === 3; }),
        function (a, b) { return tagFreq[b] - tagFreq[a]; }
      ).slice(0, 8);
      if (!showNames.length) { showsWrap.innerHTML = '<div class="sk-caption">no show tags found among these cuts.</div>'; return; }
      showsWrap.innerHTML = '<div class="sk-freq-list">' + buildFreqRows(showNames, tagFreq, 'show') + '</div>';
      var rowEls = showsWrap.querySelectorAll('.sk-freq-row');
      for (var i = 0; i < rowEls.length; i++) {
        rowEls[i].onclick = function (e) {
          var show = e.currentTarget.getAttribute('data-tag');
          // Combined with the animator tag, same convention as the
          // show-screen's own animator list — "how much do they show up
          // here" implies clicking means "show me their cuts in this show".
          searchState.tags = [show, tagName];
          searchViewMode = 'results';
          searchOrigin = null;
          // Same pitfall as the show screen's animator list: leaving the
          // Stats animator set here would make the Search tab's sync step
          // replace [show, animator] with just [animator].
          sync.artistTag = null;
          switchToTab('search');
          renderChips();
          runSearch();
        };
      }
    });

    var strip = out.querySelector('#sk-strip');
    years.forEach(function (y) {
      var f = document.createElement('div');
      f.className = 'sk-frame';
      f.style.height = Math.max(4, (yearCounts[y] / maxYearCount) * 68) + 'px';
      f.innerHTML = '<span class="ct">' + yearCounts[y] + '</span><span class="yr">' + String(y).slice(2) + '</span>';
      strip.appendChild(f);
    });

    var tl = out.querySelector('#sk-taglist');
    topTags.forEach(function (t) {
      var row = document.createElement('div');
      row.className = 'sk-tagrow';
      row.innerHTML =
        '<div class="name" title="' + esc(t) + '">' + esc(t) + '</div>' +
        '<div class="bar"><i style="width:' + ((tagFreq[t] / maxTagCount) * 100) + '%"></i></div>' +
        '<div class="n">' + tagFreq[t] + '</div>';
      tl.appendChild(row);
    });

    out.querySelector('#sk-goto-search').onclick = function (e) {
      e.preventDefault();
      searchViewMode = 'results';
      renderSearchView();
    };
  }

