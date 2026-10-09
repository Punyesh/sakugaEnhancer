  function formatCommentDate(raw) {
    if (raw === null || raw === undefined || raw === '') return '';
    var d;
    if (typeof raw === 'number') {
      d = new Date(raw * 1000); // most likely: unix seconds, matching post.json's created_at
      if (isNaN(d.getTime())) d = new Date(raw); // fallback: maybe already milliseconds
    } else {
      d = new Date(raw); // fallback: maybe an ISO date string instead of a number
    }
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
  }

  // Splits a raw comment body into alternating quote / non-quote text
  // segments on [quote]...[/quote] markers (case-insensitive, can span
  // multiple lines) — quote segments get their own distinct styling.
  function parseCommentSegments(raw) {
    var segments = [];
    var quoteRe = /\[quote\]([\s\S]*?)\[\/quote\]/gi;
    var lastIndex = 0;
    var m;
    while ((m = quoteRe.exec(raw))) {
      if (m.index > lastIndex) segments.push({ quote: false, text: raw.slice(lastIndex, m.index) });
      segments.push({ quote: true, text: m[1] });
      lastIndex = quoteRe.lastIndex;
    }
    if (lastIndex < raw.length) segments.push({ quote: false, text: raw.slice(lastIndex) });
    return segments;
  }

  // Escapes a text segment, then finds timestamps (M:SS / MM:SS / H:MM:SS),
  // sakugabooru post links, and other URLs, turning each into the
  // appropriate clickable markup. A single combined regex + one replace()
  // pass avoids the double-processing risk of running separate regexes in
  // sequence (a generic-URL pass re-wrapping a post-link span, for example).
  function linkifySegment(text) {
    var escaped = esc(text);
    var re = /(https?:\/\/[^\s]*\/post\/show\/(\d+)[^\s]*)|(\/post\/show\/(\d+)[^\s]*)|(https?:\/\/[^\s<]+)|(\b(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d+)?\b)/g;
    return escaped.replace(re, function (match, fullPostUrl, id1, relPostUrl, id2, plainUrl, timestamp) {
      if (timestamp) {
        return '<span class="sk-comment-ts" data-ts="' + match + '">' + match + '</span>';
      }
      // Strip common trailing punctuation (end-of-sentence periods, closing
      // parens, etc.) that's more likely sentence punctuation than part of
      // the actual URL, so a link doesn't swallow the punctuation after it.
      var stripped = match.replace(/[.,;:!?)\]}'"]+$/, '');
      var trailing = match.slice(stripped.length);
      if (fullPostUrl || relPostUrl) {
        var id = id1 || id2;
        return '<span class="sk-comment-postlink" data-post-id="' + id + '">' + stripped + '</span>' + trailing;
      }
      if (plainUrl) {
        return '<a href="' + stripped + '" target="_blank" rel="noopener" class="sk-comment-link">' + stripped + '</a>' + trailing;
      }
      return match;
    });
  }

  function renderCommentBody(raw) {
    var segments = parseCommentSegments(raw);
    var html = '';
    segments.forEach(function (seg) {
      var inner = linkifySegment(seg.text).replace(/\n/g, '<br>');
      html += seg.quote ? '<div class="sk-comment-quote">' + inner + '</div>' : inner;
    });
    return html;
  }

  // M:SS / MM:SS / H:MM:SS -> total seconds. Each ':'-separated part
  // multiplies the running total by 60 and adds the next part.
  function parseTimestampToSeconds(ts) {
    var parts = ts.split(':');
    var seconds = 0;
    for (var i = 0; i < parts.length; i++) seconds = seconds * 60 + parseFloat(parts[i]);
    return isNaN(seconds) ? null : seconds;
  }

  // Fetches a post by id and opens it in a new modal on top of whatever's
  // currently open — the in-app equivalent of a comment's post link, rather
  // than navigating the browser tab away to view it on the actual site.
  function openPostById(id) {
    getJSON('/post.json?tags=' + encodeURIComponent('id:' + id) + '&limit=1').then(function (posts) {
      var p = posts && posts[0];
      if (!p) { alert('post #' + id + ' not found'); return; }
      if (isVideoFile(p.file_url)) openVideoModal(p); else openImageModal(p);
    }).catch(function (err) {
      alert('failed to open post: ' + err.message);
    });
  }

  function renderComments(panel, comments, vid) {
    if (!comments || !comments.length) {
      panel.innerHTML = '<div class="sk-empty" style="padding:10px 0">no comments yet</div>';
      return;
    }
    var html = '';
    comments.forEach(function (c) {
      var name = esc(c.creator || (c.creator_id ? 'user #' + c.creator_id : 'anonymous'));
      var body = renderCommentBody(c.body || c.comment || '');
      var when = formatCommentDate(c.created_at);
      html += '<div class="sk-comment">' +
        '<div class="sk-comment-head"><b>' + name + '</b><span>' + when + '</span></div>' +
        '<div class="sk-comment-body">' + body + '</div>' +
      '</div>';
    });
    panel.innerHTML = html;

    // Event delegation rather than per-element listeners — the panel gets
    // fully replaced via innerHTML above, so individual listeners would
    // need re-wiring on every render anyway.
    panel.onclick = function (e) {
      var tsEl = e.target.closest && e.target.closest('.sk-comment-ts');
      if (tsEl) {
        var seconds = parseTimestampToSeconds(tsEl.getAttribute('data-ts'));
        if (seconds !== null && vid) {
          vid.currentTime = Math.min(seconds, vid.duration || seconds);
          vid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      var linkEl = e.target.closest && e.target.closest('.sk-comment-postlink');
      if (linkEl) {
        var id = linkEl.getAttribute('data-post-id');
        if (id) openPostById(Number(id));
      }
    };
  }


  function openLoginModal(onSuccess) {
    var backdrop = document.createElement('div');
    backdrop.className = 'sk-media-backdrop';
    var box = document.createElement('div');
    box.className = 'sk-login-box';
    box.innerHTML =
      '<div class="sk-login-title">Log In</div>' +
      '<input class="sk-input" id="sk-login-user" placeholder="username" autocomplete="username">' +
      '<input class="sk-input" id="sk-login-pass" type="password" placeholder="password" autocomplete="current-password">' +
      '<button class="sk-btn" id="sk-login-submit" style="width:100%">Log In</button>' +
      '<div class="sk-action-status" id="sk-login-status"></div>' +
      '<span class="sk-login-cancel" id="sk-login-cancel">cancel</span>';
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    function close() {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    box.querySelector('#sk-login-cancel').onclick = close;

    var userInput = box.querySelector('#sk-login-user');
    var passInput = box.querySelector('#sk-login-pass');
    var statusEl = box.querySelector('#sk-login-status');
    var submitBtn = box.querySelector('#sk-login-submit');

    function submit() {
      var username = userInput.value.trim();
      var password = passInput.value;
      if (!username || !password) return;
      submitBtn.disabled = true;
      setBusyStatus(statusEl, 'checking…');
      hashSakugaPassword(password).then(function (hash) {
        return verifyLogin(username, hash).then(function (ok) {
          if (!ok) {
            statusEl.textContent = 'username or password is incorrect';
            submitBtn.disabled = false;
            return;
          }
          saveCredentials(username, hash);
          close();
          onSuccess({ username: username, passwordHash: hash });
        });
      }).catch(function (err) {
        statusEl.textContent = 'login failed: ' + err.message;
        submitBtn.disabled = false;
      });
    }
    submitBtn.onclick = submit;
    passInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    userInput.focus();
  }

  function renderCommentComposer(container, p, onPosted) {
    var creds = getStoredCredentials();
    if (!creds) {
      container.innerHTML = '<span class="sk-comment-loginlink" id="sk-login-open">Log in to comment</span>';
      container.querySelector('#sk-login-open').onclick = function () {
        openLoginModal(function () { renderCommentComposer(container, p, onPosted); });
      };
      return;
    }
    container.innerHTML =
      '<div class="sk-comment-composer">' +
        '<div class="sk-comment-loggedin"><span>logged in as ' + esc(creds.username) + '</span>' +
        '<span class="sk-comment-logout" id="sk-comment-logout">log out</span></div>' +
        '<textarea class="sk-comment-textarea" id="sk-comment-text" placeholder="write a comment…"></textarea>' +
        '<button class="sk-btn" id="sk-comment-post" style="width:100%">Post Comment</button>' +
        '<div class="sk-action-status" id="sk-comment-status"></div>' +
      '</div>';
    container.querySelector('#sk-comment-logout').onclick = function () {
      clearCredentials();
      renderCommentComposer(container, p, onPosted);
    };
    var textArea = container.querySelector('#sk-comment-text');
    var postBtn = container.querySelector('#sk-comment-post');
    var statusEl = container.querySelector('#sk-comment-status');
    postBtn.onclick = function () {
      var body = textArea.value.trim();
      if (!body) return;
      postBtn.disabled = true;
      setBusyStatus(statusEl, 'posting…');
      postComment(p.id, body, creds.username, creds.passwordHash).then(function () {
        textArea.value = '';
        statusEl.textContent = '';
        postBtn.disabled = false;
        onPosted();
      }).catch(function (err) {
        statusEl.textContent = 'failed to post: ' + err.message;
        postBtn.disabled = false;
      });
    };
  }

