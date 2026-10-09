/*!
 * Sakuga Enhancer — bookmarklet overlay for sakugabooru.com
 * Runs same-origin, hits the site's own Moebooru JSON API (/post.json, /artist.json).
 * No external dependencies, no CDN calls (site CSP may block them anyway).
 */
(function () {
  'use strict';
  console.log('%c[sakuga-enhancer] build SF43 (crf 15 for accurate trim) loaded', 'color:#ffb020;font-weight:bold');

  // Re-clicking the bookmarklet toggles the panel instead of double-injecting.
  var EXISTING = document.getElementById('sk-enh-root');
  if (EXISTING) {
    console.log('[sakuga-enhancer] found existing panel — toggling only, NOT re-initializing. ' +
      'If you need a fresh reload of the code, reload the page first (Ctrl/Cmd+Shift+R), then click the bookmark again.');
    EXISTING.style.display = EXISTING.style.display === 'none' ? 'block' : 'none';
    return;
  }

  if (!/sakugabooru\.com$/.test(location.hostname)) {
    alert('Sakuga Enhancer only works on sakugabooru.com — navigate there first.');
    return;
  }

