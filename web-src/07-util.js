  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // Sakugabooru loads Prototype.js, which globally overwrites Array.prototype's
  // filter/map/sort/every/some/find with its own Ruby-Enumerable-style aliases
  // (filter->findAll, map->collect, every->all, some->any, find->detect). These
  // don't reliably behave like the native versions, so anywhere the RESULT is
  // used for real logic, we use these hand-rolled versions instead — .push(),
  // .slice(), and .forEach() are left alone since they weren't found aliased.
  function safeFilter(arr, fn) {
    var out = [];
    for (var i = 0; i < arr.length; i++) { if (fn(arr[i], i)) out.push(arr[i]); }
    return out;
  }
  function safeMap(arr, fn) {
    var out = [];
    for (var i = 0; i < arr.length; i++) { out.push(fn(arr[i], i)); }
    return out;
  }
  function safeSort(arr, cmp) {
    var a = arr.slice();
    if (a.length <= 1) return a;
    var mid = Math.floor(a.length / 2);
    var left = safeSort(a.slice(0, mid), cmp);
    var right = safeSort(a.slice(mid), cmp);
    var result = [];
    var i = 0, j = 0;
    while (i < left.length && j < right.length) {
      if (cmp(left[i], right[j]) <= 0) { result.push(left[i]); i++; }
      else { result.push(right[j]); j++; }
    }
    while (i < left.length) { result.push(left[i]); i++; }
    while (j < right.length) { result.push(right[j]); j++; }
    return result;
  }

  function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
  }); }

