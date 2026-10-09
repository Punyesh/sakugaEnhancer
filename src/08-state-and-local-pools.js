  // ---------- cross-tab sync state ----------
  // Keeps the two tabs in lockstep so switching tabs never requires re-searching.
  var sync = { artistTag: null }; // canonical animator tag currently "in focus"
  var searchCache = null; // { tags, order, posts, excluded, facetTags }
  var searchScrollObserver = null; // watches the load-more sentinel; recreated each render since the sentinel itself is a fresh DOM node each time
  var searchHistory = []; // previous searches in the Search tab, newest last — drives the "← back" button
  var searchOrigin = null; // e.g. {type:'shows'} — set right before a Shows-originated search, consumed by runSearch
  var statsCache = null;  // { tagName, allPosts }

  // ===================== LOCAL POOLS (localStorage) =====================
  // Real server-side pool CREATION requires an account-permission tier most
  // accounts (including a freshly made test account) don't have — confirmed
  // both via the API ("access denied") and by trying to create a pool
  // directly on the site itself. So "My Pools" here is entirely on-device:
  // no login, no server round-trip, same tradeoff as the companion app's
  // AsyncStorage-based local pools, just backed by localStorage instead.
  // Posts are stored as full snapshots at add-time — score etc. won't stay
  // live-updated, matching the app's approach.
  var LOCAL_POOLS_KEY = 'sk-local-pools-v1';

  function readLocalPools() {
    try {
      var raw = localStorage.getItem(LOCAL_POOLS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function writeLocalPools(pools) {
    try { localStorage.setItem(LOCAL_POOLS_KEY, JSON.stringify(pools)); } catch (e) { /* non-fatal — worst case a save doesn't persist */ }
  }
  function getLocalPools() { return readLocalPools(); }
  function getLocalPool(id) {
    return safeFilter(readLocalPools(), function (p) { return p.id === id; })[0] || null;
  }
  function createLocalPool(name, description) {
    var pools = readLocalPools();
    var pool = { id: String(Date.now()), name: name, description: description || '', posts: [], createdAt: Date.now() };
    pools.unshift(pool);
    writeLocalPools(pools);
    return pool;
  }
  function deleteLocalPool(id) {
    writeLocalPools(safeFilter(readLocalPools(), function (p) { return p.id !== id; }));
  }
  function addPostToLocalPool(poolId, post) {
    var pools = readLocalPools();
    var pool = safeFilter(pools, function (p) { return p.id === poolId; })[0];
    if (pool && !safeFilter(pool.posts, function (p) { return p.id === post.id; }).length) {
      pool.posts.unshift(post);
      writeLocalPools(pools);
      return true;
    }
    return false;
  }
  function removePostFromLocalPool(poolId, postId) {
    var pools = readLocalPools();
    var pool = safeFilter(pools, function (p) { return p.id === poolId; })[0];
    if (pool) {
      pool.posts = safeFilter(pool.posts, function (p) { return p.id !== postId; });
      writeLocalPools(pools);
    }
  }

