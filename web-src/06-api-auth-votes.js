  // ---------- tiny fetch helper ----------
  function getJSON(path) {
    return fetch(path, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  // ---------- auth & comment posting ----------
  // Confirmed directly from sakugabooru's own /help/api page: "Simply
  // hashing your plain password will NOT work since Danbooru salts its
  // passwords. The actual string that is hashed is
  // 'er@!$rjiajd0$!dkaopc350!Y%)--your-password--'." This is the classic
  // Danbooru-v1/Moebooru convention this fork inherited — not a modern
  // token-based auth scheme, just what the site itself actually uses.
  var PASSWORD_SALT_PREFIX = 'er@!$rjiajd0$!dkaopc350!Y%)--';
  var PASSWORD_SALT_SUFFIX = '--';
  var CREDENTIALS_KEY = 'sk-enh-credentials';

  function sha1Hex(str) {
    var enc = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-1', enc).then(function (buf) {
      var bytes = new Uint8Array(buf);
      var hex = '';
      for (var i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
      return hex;
    });
  }

  function hashSakugaPassword(password) {
    return sha1Hex(PASSWORD_SALT_PREFIX + password + PASSWORD_SALT_SUFFIX);
  }

  // The raw password is never stored — only the hash, and only in
  // localStorage, since browsers don't offer anything like a native OS
  // keychain. That's a real step down from the mobile app's secure storage,
  // worth knowing even though the principle (store the hash, not the
  // password) is the same.
  function saveCredentials(username, passwordHash) {
    try { localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ username: username, passwordHash: passwordHash })); }
    catch (e) { /* storage full/blocked — non-fatal, login just won't persist */ }
  }
  function getStoredCredentials() {
    try {
      var raw = localStorage.getItem(CREDENTIALS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function clearCredentials() {
    try { localStorage.removeItem(CREDENTIALS_KEY); } catch (e) { /* non-fatal */ }
  }

  function postCommentRaw(postId, bodyText, username, passwordHash) {
    var params = new URLSearchParams();
    params.set('login', username);
    params.set('password_hash', passwordHash);
    params.set('comment[post_id]', String(postId));
    params.set('comment[body]', bodyText);

    return fetch('/comment/create.json', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }).then(function (r) {
      return r.text().then(function (text) {
        var parsed = null;
        try { parsed = JSON.parse(text); } catch (e) { /* non-JSON response — fall through to generic HTTP result */ }
        if (r.ok && (!parsed || parsed.success !== false)) return { success: true };
        return { success: false, reason: (parsed && parsed.reason) || ('HTTP ' + r.status + ': ' + text.slice(0, 200)) };
      });
    });
  }

  function postComment(postId, bodyText, username, passwordHash) {
    return postCommentRaw(postId, bodyText, username, passwordHash).then(function (result) {
      if (!result.success) throw new Error(result.reason || 'failed to post comment');
    });
  }

  // Verifies credentials against the real server WITHOUT posting a visible
  // comment — attempts one on a deliberately out-of-range post id. A
  // confirmed real response shape from this exact endpoint (tested live in
  // the native app build of this same feature) is
  // {"success":false,"reason":"access denied"} for bad credentials — any
  // OTHER failure reason means auth itself succeeded and the failure is
  // just that this post obviously doesn't exist.
  function verifyLogin(username, passwordHash) {
    return postCommentRaw(999999999, '(login verification — safe to ignore if visible)', username, passwordHash)
      .then(function (result) {
        if (result.success) return true;
        var reason = (result.reason || '').toLowerCase();
        return reason.indexOf('denied') === -1;
      });
  }

  // Confirmed to actually be a 1–3 star rating (not a flat upvote) directly
  // from the site's own post page — "Score: N ★★★ (vote up)", clickable
  // per-star. `score` as the param name was already a correct guess (this
  // worked when hardcoded to 1); this just stops assuming the value is
  // always 1. There's still no way to check a rating cold on page load — no
  // vote-check request fires then, and the site's own vote widget HTML is
  // byte-identical across every rating state (confirmed by direct comparison).
  // But the vote response ITSELF turns out to carry real, authoritative
  // state: watching the site's own vote.coffee via DevTools showed the POST
  // to /post/vote.json returns not just success/failure but the fresh post
  // (with the real updated score) plus a `votes` map keyed by post id with
  // *your account's own current vote value* on it, straight from the server
  // — not an echo of what was just sent. So this now returns the parsed
  // response instead of resolving void, letting the caller read that
  // real state directly instead of doing a separate refetch afterward.
  function castVote(postId, stars, username, passwordHash) {
    var params = new URLSearchParams();
    params.set('login', username);
    params.set('password_hash', passwordHash);
    params.set('id', String(postId));
    params.set('score', String(stars));
    return fetch('/post/vote.json', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }).then(function (r) {
      return r.text().then(function (text) {
        var parsed = null;
        try { parsed = JSON.parse(text); } catch (e) { /* non-JSON — fall through to generic HTTP check */ }
        if (r.ok && (!parsed || parsed.success !== false)) return parsed;
        throw new Error((parsed && parsed.reason) || ('HTTP ' + r.status + ': ' + text.slice(0, 200)));
      });
    });
  }

  // Real per-account vote state does exist and is fetchable after all — just
  // not through the JSON API, a dedicated endpoint, or the DOM (all three
  // came back empty/identical across every rating state when tested
  // directly). It's embedded in the post page's own raw HTML, inside an
  // inline `Post.register_resp({...})` script call, under a `votes` map
  // keyed by post id — confirmed by diffing the actual fetched HTML text
  // itself, not the rendered DOM (which never reflects it; the widget
  // renders the same "off" markup regardless, then a separate inline
  // `vote.updateWidget(...)` call paints the real state client-side from
  // that same embedded data). This costs one extra page fetch per opened
  // clip (not per thumbnail in a grid), which is the honest tradeoff for
  // real accuracy instead of a per-device guess.
  //
  // Return value is three-way on purpose — collapsing "couldn't tell" and
  // "confirmed no vote" into the same null caused a real bug in the app's
  // version of this: a genuine 3-star rating would reopen showing empty
  // stars, because a failed fetch and "you never voted" both came back as
  // null, and the caller treated both as "the real vote is 0", silently
  // overwriting a correct local rating with nothing.
  //   - a number (1-3): confirmed real vote, straight from the server
  //   - null: confirmed no vote — the votes map was read successfully and
  //     this post genuinely isn't in it
  //   - undefined: couldn't determine anything (network failure, page shape
  //     unexpected) — callers must leave the existing local guess alone
  //     rather than treating this as "no vote"
  // Finds the JSON object literal starting right after `marker` and returns
  // it as a substring, using real brace/string-aware scanning rather than a
  // regex — needed because a naive "match up to the next }" (or even a
  // targeted "votes":{...} pattern) can grab the WRONG object if the page
  // embeds more than one thing that happens to look similar (e.g. a related
  // post, sidebar widget, etc. also serialized somewhere earlier in the same
  // page). This walks the actual object matching braces properly, so it's
  // guaranteed to extract the exact argument passed to that specific call.
  function extractJsonAfter(html, marker) {
    var markerIdx = html.indexOf(marker);
    if (markerIdx === -1) return null;
    var start = html.indexOf('{', markerIdx);
    if (start === -1) return null;
    var depth = 0, inStr = false, strCh = '', escape = false;
    for (var i = start; i < html.length; i++) {
      var ch = html.charAt(i);
      if (inStr) {
        if (escape) { escape = false; }
        else if (ch === '\\') { escape = true; }
        else if (ch === strCh) { inStr = false; }
        continue;
      }
      if (ch === '"' || ch === '\'') { inStr = true; strCh = ch; continue; }
      if (ch === '{') { depth++; }
      else if (ch === '}') {
        depth--;
        if (depth === 0) return html.slice(start, i + 1);
      }
    }
    return null; // never closed — malformed/truncated, give up rather than guess
  }

  function fetchServerVote(postId) {
    return fetch('/post/show/' + postId, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) return undefined;
        return r.text().then(function (html) {
          var jsonStr = extractJsonAfter(html, 'Post.register_resp(');
          if (!jsonStr) return undefined;
          try {
            var data = JSON.parse(jsonStr);
            if (!data || typeof data.votes !== 'object' || data.votes === null) return undefined;
            var v = data.votes[String(postId)];
            return v === undefined ? null : v; // key present -> real value; key absent -> confirmed no vote
          } catch (e) { return undefined; }
        });
      })
      .catch(function () { return undefined; }); // network failure — unknown, not "no vote"
  }


  // Tracks which posts this browser has rated via the bookmarklet, and what
  // rating was given (1-3 stars) — the badge's own "voted" state used to be
  // a plain JS variable that reset on every page reload, showing the rating
  // option again as if nothing happened. There's no confirmed server-side
  // "what did I rate this" check to fall back on (no such request fires on
  // page load — see castVote above), so this is a client-side memory of
  // *this bookmarklet's own* successful ratings, not a true source of truth —
  // rating via the site directly, another browser, etc. won't be reflected
  // here until rated through the bookmarklet at least once.
  var VOTED_KEY = 'sk-voted-posts';
  function readVotedMap() {
    try {
      var raw = localStorage.getItem(VOTED_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      // migrate the old boolean-array-of-ids shape from before star ratings existed
      if (Array.isArray(parsed)) {
        var migrated = {};
        parsed.forEach(function (id) { migrated[id] = 1; });
        return migrated;
      }
      return parsed || {};
    } catch (e) { return {}; }
  }
  function getVoteRating(postId) {
    var map = readVotedMap();
    return map[postId] || null;
  }
  function setVoteRating(postId, stars) {
    try {
      var map = readVotedMap();
      map[postId] = stars;
      var keys = Object.keys(map);
      if (keys.length > 2000) {
        // keep this from growing forever — drop the oldest-inserted entries
        var toDrop = keys.length - 2000;
        for (var i = 0; i < toDrop; i++) delete map[keys[i]];
      }
      localStorage.setItem(VOTED_KEY, JSON.stringify(map));
    } catch (e) { /* non-fatal — worst case the reminder just doesn't persist */ }
  }

