  // Tags weren't visible anywhere inside an actually-opened clip before —
  // only via the separate hover-preview dock shown before opening. This
  // puts the same color-coded, clickable chip display directly in the
  // modal itself, reusing the exact same rendering/click logic.
  function addTagsSection(box, p) {
    var container = box._side;
    if (!container) return;
    container.innerHTML = '<div class="sk-loading" style="padding:8px 0">loading tag info…</div>';

    var tags = safeFilter((p.tags || '').split(/\s+/), function (t) { return !!t; });
    ensureTagTypes().then(function (map) {
      container.innerHTML = buildTagChipsHtml(tags, map);
      // Unlike the hover dock (where nothing is covering the results, so
      // updating search state in the background is fine), this is inside an
      // open modal — leaving it open after the tag click meant the person
      // never actually saw the new results, and the modal's own now-stale
      // tag chips just sat there unchanged. Close it so the search that just
      // ran is immediately visible.
      wireTagChipClicks(container, function () { box._close(); });
    });
  }

  function addCommentsSection(box, p) {
    var row = document.createElement('div');
    row.className = 'sk-comments-row';
    row.innerHTML = '<button class="sk-frame-btn" id="sk-comments-toggle">Comments</button>';
    box.appendChild(row);

    var panel = document.createElement('div');
    panel.className = 'sk-comments-panel';
    panel.style.display = 'none';
    box.appendChild(panel);

    var composerDiv = document.createElement('div');
    panel.appendChild(composerDiv);
    var listDiv = document.createElement('div');
    panel.appendChild(listDiv);

    var vid = box.querySelector('video'); // null for image posts — renderComments handles that gracefully
    function loadComments() {
      listDiv.innerHTML = '<div class="sk-loading" style="padding:10px 0">loading comments…</div>';
      getJSON('/comment.json?post_id=' + p.id).then(function (comments) {
        renderComments(listDiv, Array.isArray(comments) ? comments : null, vid);
      }).catch(function (err) {
        listDiv.innerHTML = '<div class="sk-empty" style="padding:10px 0">couldn\'t load comments — ' + esc(err.message) + '</div>';
      });
    }

    var loaded = false;
    row.querySelector('#sk-comments-toggle').onclick = function () {
      var showing = panel.style.display !== 'none';
      panel.style.display = showing ? 'none' : 'block';
      if (showing) return;
      renderCommentComposer(composerDiv, p, loadComments); // cheap to re-render each open; keeps login state current
      if (loaded) return;
      loaded = true;
      loadComments();
    };
  }

  function openAddToPoolModal(post) {
    var backdrop = document.createElement('div');
    backdrop.className = 'sk-media-backdrop';
    var box = document.createElement('div');
    box.className = 'sk-login-box';
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    function close() {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });

    function render() {
      var pools = getLocalPools();
      box.innerHTML =
        '<div class="sk-login-title">Add to Pool</div>' +
        (pools.length
          ? '<div id="sk-atp-list"></div>'
          : '<div class="sk-caption">no pools yet</div>') +
        '<div class="sk-row" style="margin-top:4px">' +
          '<input class="sk-input" id="sk-atp-new-name" placeholder="new pool name">' +
          '<button class="sk-btn" id="sk-atp-new-go">Create</button>' +
        '</div>' +
        '<span class="sk-login-cancel" id="sk-atp-cancel">close</span>';

      box.querySelector('#sk-atp-cancel').onclick = close;

      var listEl = box.querySelector('#sk-atp-list');
      if (listEl) {
        pools.forEach(function (pl) {
          var already = !!safeFilter(pl.posts, function (x) { return x.id === post.id; }).length;
          var item = document.createElement('div');
          item.className = 'sk-show-pick' + (already ? ' off' : '');
          item.innerHTML = '<span class="name">' + esc(pl.name) + '</span><span class="cnt">' + (already ? 'added' : pl.posts.length) + '</span>';
          if (!already) {
            item.onclick = function () {
              addPostToLocalPool(pl.id, post);
              render();
            };
          }
          listEl.appendChild(item);
        });
      }

      var nameInput = box.querySelector('#sk-atp-new-name');
      box.querySelector('#sk-atp-new-go').onclick = function () {
        var name = nameInput.value.trim();
        if (!name) return;
        var pool = createLocalPool(name, '');
        addPostToLocalPool(pool.id, post);
        render();
      };
      nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') box.querySelector('#sk-atp-new-go').onclick(); });
    }
    render();
  }

  function buildMediaShell(p) {
    var backdrop = document.createElement('div');
    backdrop.className = 'sk-media-backdrop';
    var box = document.createElement('div');
    box.className = 'sk-media-box';
    box.innerHTML =
      '<div class="sk-media-top">' +
        '<span class="sk-badge score" id="sk-vote-score">' + (p.score || 0) + '</span>' +
        '<span class="sk-stars" id="sk-stars" title="rate 1-3 stars — click again anytime to change your rating">' +
          '<span class="sk-star" data-n="1">&#9733;</span>' +
          '<span class="sk-star" data-n="2">&#9733;</span>' +
          '<span class="sk-star" data-n="3">&#9733;</span>' +
          '<span class="sk-star-clear" id="sk-star-clear" title="clear your rating">&times;</span>' +
        '</span>' +
        '<span class="sk-badge">' + esc(p.rating || '?') + '</span>' +
        '<a href="/post/show/' + p.id + '" target="_blank" rel="noopener" class="sk-media-viewpost">view post ↗</a>' +
        '<span class="sk-media-viewpost" id="sk-copy-link" style="cursor:pointer;margin-left:8px" title="copy a link to this post">Copy Link</span>' +
        '<span class="sk-media-viewpost" id="sk-add-pool" style="cursor:pointer;margin-left:8px" title="add this clip to a pool">Add to Pool</span>' +
        '<span class="sk-media-close" id="sk-media-close" title="close">&times;</span>' +
      '</div>';
    // Credits (animator + tags) get their own panel to the left of the viewer,
    // so they're visible without scrolling and not tucked under the controls.
    var side = document.createElement('div');
    side.className = 'sk-clip-side';
    backdrop.className += ' sk-clip-split';
    backdrop.appendChild(side);
    box._side = side;
    backdrop.appendChild(box);
    document.body.appendChild(backdrop); // attach to the real page body so it overlays everything, not just our small panel

    var scoreEl = box.querySelector('#sk-vote-score');
    var starsWrap = box.querySelector('#sk-stars');
    var starEls = starsWrap.querySelectorAll('.sk-star');
    var clearBtn = box.querySelector('#sk-star-clear');
    var currentRating = getVoteRating(p.id) || 0;
    var currentScoreValue = p.score || 0;
    var submitting = false;

    function paintStars(n) {
      for (var i = 0; i < starEls.length; i++) {
        starEls[i].classList.toggle('filled', (i + 1) <= n);
      }
      clearBtn.classList.toggle('active', n > 0);
    }
    paintStars(currentRating); // instant paint from the local guess, corrected below once real data loads

    // The local guess above is only this browser's own memory — it can be
    // wrong (voted from another device, or never voted despite a stale
    // local entry). Fetch the real per-account state and silently correct
    // the display if it disagrees, without blocking on it first.
    fetchServerVote(p.id).then(function (serverVote) {
      if (submitting) return; // don't clobber an in-flight vote the person just cast
      if (serverVote === undefined) return; // couldn't determine anything real — leave the local guess alone
      var real = serverVote || 0; // null (confirmed no vote) -> 0
      if (real !== currentRating) {
        currentRating = real;
        setVoteRating(p.id, real);
        paintStars(currentRating);
      }
    });

    // Shared by both the 1-3 star clicks and the clear ("×") control below —
    // clearing is just rating with n=0, inferred from the site's own vote
    // widget markup (a distinct "star-0" control alongside stars 1-3,
    // presumably clearing a vote) but not independently confirmed live the
    // way every other piece of this feature was, so worth a real test.
    function submitRating(n) {
      // Real vote behavior turns out to be mutable — re-clicking a
      // different star changes an existing rating rather than being
      // rejected, so this only guards against a second click landing
      // mid-request, not against re-rating in general.
      if (submitting) return;
      var creds = getStoredCredentials();
      if (!creds) { openLoginModal(function () { submitRating(n); }); return; }
      submitting = true;
      castVote(p.id, n, creds.username, creds.passwordHash).then(function (result) {
        var fresh = result && result.posts && result.posts[0];
        // The vote response itself carries the server's own record of your
        // current vote (result.votes[postId]) — trust that over the value
        // we just sent, in case the server ever normalizes/rejects it
        // differently than expected.
        var myVote = result && result.votes && result.votes[String(p.id)];
        var previousRating = currentRating;
        currentRating = myVote || n;
        setVoteRating(p.id, currentRating);
        // Re-voting is delta-based (the server replaces your old star value
        // rather than adding a new one) — confirmed directly (1★→2★ moved
        // score by exactly +1) — so if the response is ever missing the
        // fresh post for some reason, the fallback has to guess
        // score + (new - old), not score + new.
        currentScoreValue = fresh ? fresh.score : currentScoreValue + (n - previousRating);
        scoreEl.textContent = currentScoreValue;
        paintStars(currentRating);
        // The results grid (or a pool grid) this clip was opened from
        // already rendered its own card with the old score baked into
        // static HTML — mutating p.score alone wouldn't touch that DOM, and
        // there was no re-render to pick it up until a fresh search. Update
        // both: the underlying object (so anything rendered *after* this
        // point is correct) and any already-rendered card right now.
        p.score = currentScoreValue;
        var openCards = root.querySelectorAll('.sk-card[data-post-id="' + p.id + '"] .score');
        for (var oc = 0; oc < openCards.length; oc++) {
          openCards[oc].textContent = '\u25B2 ' + currentScoreValue;
        }
      }).catch(function (err) {
        paintStars(currentRating); // revert the hover-preview back to the real current rating
        alert('rating failed: ' + err.message);
      }).then(function () { submitting = false; });
    }

    for (var si = 0; si < starEls.length; si++) {
      (function (starEl) {
        var n = parseInt(starEl.getAttribute('data-n'), 10);
        starEl.addEventListener('mouseenter', function () {
          if (!submitting) paintStars(n);
        });
        starEl.addEventListener('click', function () { submitRating(n); });
      })(starEls[si]);
    }
    clearBtn.addEventListener('mouseenter', function () {
      if (!submitting) paintStars(0);
    });
    clearBtn.addEventListener('click', function () {
      if (currentRating === 0) return; // nothing to clear
      submitRating(0);
    });
    starsWrap.addEventListener('mouseleave', function () {
      if (!submitting) paintStars(currentRating);
    });

    var copyLinkBtn = box.querySelector('#sk-copy-link');
    copyLinkBtn.onclick = function () {
      var url = location.origin + '/post/show/' + p.id;
      var originalText = copyLinkBtn.textContent;
      function showCopied() {
        copyLinkBtn.textContent = '✓ copied';
        setTimeout(function () { copyLinkBtn.textContent = originalText; }, 1500);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(showCopied).catch(function () { prompt('copy this link:', url); });
      } else {
        prompt('copy this link:', url);
      }
    };

    box.querySelector('#sk-add-pool').onclick = function () {
      openAddToPoolModal(p);
    };

    var extraCleanup = [];
    function close() {
      var vid = box.querySelector('video');
      if (vid) vid.pause();
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      extraCleanup.forEach(function (fn) { fn(); });
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    box.querySelector('#sk-media-close').onclick = close;
    box._onClose = function (fn) { extraCleanup.push(fn); };
    box._close = close; // lets content appended to the box (e.g. a clicked tag) trigger a real close
    return box; // caller appends the actual <video> or <img>; can register box._onClose(fn) for cleanup
  }

  function openVideoModal(p, onGridPick) {
    var box = buildMediaShell(p);
    var vid = document.createElement('video');
    vid.controls = true;
    vid.autoplay = true;
    vid.playsInline = true;
    vid.src = p.file_url;
    box.appendChild(vid);

    // Frame-accurate review is the whole point of sakuga — add frame stepping.
    // fps comes from the post data if this fork exposes it, else a common
    // anime-standard fallback; either way, browser seeking is only approximate
    // (it can't guarantee landing on an exact decoded frame), so treat this as
    // "close enough for review," not a frame-perfect scrubber.
    var fps = Number(p.frame_rate || p.framerate) || 24;
    buildFrameSteppingBar(box, vid, fps);

    // ---- trim range + download/share ----
    // There's no server here, so trimming runs entirely client-side via
    // ffmpeg.wasm (loaded on first use, see below) — a real re-encode, not a
    // stream copy, since stream-copy can only cut on keyframe boundaries and
    // frame-accurate trimming needs an actual decode/re-encode of the range.
    var inTime = null, outTime = null;

    var trimCaption = document.createElement('div');
    trimCaption.className = 'sk-caption';
    trimCaption.style.padding = '8px 10px 0';
    trimCaption.textContent = onGridPick
      ? 'use the frame controls above to find a start/end point, mark them below, then Use This Range to send it back to the grid clip.'
      : 'optional: use the frame controls above to find a start/end point, mark them below, ' +
        'then Download/Share Trim will cut exactly that range.';
    box.appendChild(trimCaption);

    var trimRow = document.createElement('div');
    trimRow.className = 'sk-trim-row';
    trimRow.innerHTML =
      '<button class="sk-frame-btn" id="sk-mark-in" title="set the trim start to the current playhead position">Mark In</button>' +
      '<span class="sk-trim-label" id="sk-trim-in">in: —</span>' +
      '<button class="sk-frame-btn" id="sk-mark-out" title="set the trim end to the current playhead position">Mark Out</button>' +
      '<span class="sk-trim-label" id="sk-trim-out">out: —</span>' +
      '<button class="sk-frame-btn" id="sk-trim-clear" title="clear the marked range — buttons below go back to acting on the full clip">✕</button>';
    box.appendChild(trimRow);

    var accuracyRow = document.createElement('div');
    accuracyRow.className = 'sk-trim-row';
    accuracyRow.innerHTML =
      '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:' + C.dim + ';cursor:pointer">' +
        '<input type="checkbox" id="sk-accurate-trim" style="accent-color:' + C.amber + '">' +
        'frame-accurate (re-encodes — slower, but exact; unchecked is a fast copy that may drift a few frames)' +
      '</label>';
    box.appendChild(accuracyRow);

    var getExportOpts = buildExportOptions(box, vid, false); // booru clips never have audio, so no mute option

    var actionRow = document.createElement('div');
    actionRow.className = 'sk-action-row';
    actionRow.innerHTML =
      '<button class="sk-frame-btn" id="sk-dl-full" title="downloads the original file, unmodified">⬇ Download Full</button>' +
      '<button class="sk-frame-btn" id="sk-dl-trim" disabled title="mark a range above first — trims to it and downloads the result (takes a moment)">⬇ Download Trim</button>' +
      (onGridPick ? '<button class="sk-frame-btn" id="sk-use-range" disabled title="mark a range above first">Use This Range</button>' : '');
    box.appendChild(actionRow);

    var statusEl = document.createElement('div');
    statusEl.className = 'sk-action-status';
    box.appendChild(statusEl);

    var inLabel = trimRow.querySelector('#sk-trim-in');
    var outLabel = trimRow.querySelector('#sk-trim-out');
    var dlTrimBtn = actionRow.querySelector('#sk-dl-trim');
    var useRangeBtn = actionRow.querySelector('#sk-use-range');
    var accurateCheckbox = accuracyRow.querySelector('#sk-accurate-trim');

    function updateTrimBtn() {
      var hasTrim = inTime !== null && outTime !== null && outTime > inTime;
      dlTrimBtn.disabled = !hasTrim;
      dlTrimBtn.title = hasTrim
        ? 'trims to your marked range and downloads the result (takes a moment)'
        : 'mark a range above first — trims to it and downloads the result (takes a moment)';
      if (useRangeBtn) {
        useRangeBtn.disabled = !hasTrim;
        useRangeBtn.title = hasTrim ? 'use this marked range for the grid clip' : 'mark a range above first';
      }
    }
    updateTrimBtn(); // set initial button state (no trim range yet)

    if (useRangeBtn) {
      useRangeBtn.onclick = function () {
        if (inTime === null || outTime === null || outTime <= inTime) return;
        onGridPick(inTime, outTime);
        box._close();
      };
    }

    trimRow.querySelector('#sk-mark-in').onclick = function () {
      inTime = vid.currentTime;
      inLabel.textContent = 'in: ' + formatVideoTime(inTime);
      updateTrimBtn();
    };
    trimRow.querySelector('#sk-mark-out').onclick = function () {
      outTime = vid.currentTime;
      outLabel.textContent = 'out: ' + formatVideoTime(outTime);
      updateTrimBtn();
    };
    trimRow.querySelector('#sk-trim-clear').onclick = function () {
      inTime = null; outTime = null;
      inLabel.textContent = 'in: —';
      outLabel.textContent = 'out: —';
      updateTrimBtn();
    };

    box._onClose(function () {
      // ffmpeg.wasm 0.11.x has no clean mid-job cancel; if a trim is running when the
      // modal closes it'll just finish silently in the background rather than error out.
    });

    var dlFullBtn = actionRow.querySelector('#sk-dl-full');
    dlFullBtn.onclick = function () {
      var xo = getExportOpts();
      if (!xo) { triggerDownload(p.file_url, 'sakuga_' + p.id + '.' + (p.file_ext || 'webm')); return; }
      dlFullBtn.disabled = true;
      setBusyStatus(statusEl, 'reading clip…');
      fetch(p.file_url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
        return performExport(buf, p.file_ext, null, null, xo, statusEl);
      }).then(function (res) {
        triggerBlobDownload(res.blob, 'sakuga_' + p.id + '.' + res.ext);
        dlFullBtn.disabled = false;
      }).catch(function (err) {
        if (err.message !== 'cancelled') statusEl.textContent = 'export failed: ' + err.message;
        dlFullBtn.disabled = false;
      });
    };

    dlTrimBtn.onclick = function () {
      if (dlTrimBtn.disabled) return;
      dlTrimBtn.disabled = true;
      setBusyStatus(statusEl, 'reading clip…');
      var xo = getExportOpts();
      fetch(p.file_url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
        return xo ? performExport(buf, p.file_ext, inTime, outTime, xo, statusEl)
                  : performTrim(buf, p.file_ext, inTime, outTime, statusEl, accurateCheckbox.checked);
      }).then(function (res) {
        triggerBlobDownload(res.blob, 'sakuga_' + p.id + '_trim.' + res.ext);
        updateTrimBtn();
      }).catch(function (err) {
        if (err.message !== 'cancelled') statusEl.textContent = 'trim failed: ' + err.message;
        updateTrimBtn();
      });
    };

    addTagsSection(box, p);
    addCommentsSection(box, p);
  }

  function openImageModal(p) {
    var box = buildMediaShell(p);
    var img = document.createElement('img');
    var src = p.sample_url || p.jpeg_url || p.file_url || p.preview_url;
    img.src = src;
    box.appendChild(img);

    var actionRow = document.createElement('div');
    actionRow.className = 'sk-action-row';
    actionRow.innerHTML =
      '<button class="sk-frame-btn" id="sk-img-dl">⬇ Download</button>';
    box.appendChild(actionRow);
    var statusEl = document.createElement('div');
    statusEl.className = 'sk-action-status';
    box.appendChild(statusEl);

    actionRow.querySelector('#sk-img-dl').onclick = function () {
      triggerDownload(p.file_url || src, 'sakuga_' + p.id + '.' + (p.file_ext || 'jpg'));
    };

    addTagsSection(box, p);
    addCommentsSection(box, p);
  }

