  // ===================== LOCK SIZE (fixed clip size vs. fixed column count) =====================
  // Default grid behavior is a fixed 3 columns that stretch/shrink with the
  // panel — resizing the panel resizes the clips. Locking flips that: clips
  // stay a fixed size and the grid reflows more/fewer per row instead,
  // via CSS Grid's auto-fill + minmax (the standard pattern for this).
  var LOCK_KEY = 'sk-enh-lock-size';
  function loadLockPref() {
    try { return localStorage.getItem(LOCK_KEY) === '1'; } catch (e) { return false; }
  }
  function saveLockPref(locked) {
    try { localStorage.setItem(LOCK_KEY, locked ? '1' : '0'); } catch (e) { /* non-fatal */ }
  }
  var lockBtn = root.querySelector('#sk-enh-lock-size');
  var lockSize = loadLockPref();
  function applyLockUI(locked) {
    lockBtn.classList.toggle('active', locked);
    panel.classList.toggle('sk-size-locked', locked);
  }
  applyLockUI(lockSize);
  lockBtn.addEventListener('click', function () {
    lockSize = !lockSize;
    applyLockUI(lockSize);
    saveLockPref(lockSize);
  });

  var tabs = root.querySelectorAll('.sk-tab');
  function switchToTab(name) {
    tabs.forEach(function (o) { o.classList.toggle('active', o.getAttribute('data-tab') === name); });
    renderTab(name);
  }
  tabs.forEach(function (t) {
    t.onclick = function () { switchToTab(t.getAttribute('data-tab')); };
  });

