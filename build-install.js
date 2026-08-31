const fs = require('fs');
const path = require('path');

const bookmarklet = fs.readFileSync(path.join(__dirname, 'bookmarklet.txt'), 'utf8');
const escapedHref = bookmarklet.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// Hosted via GitHub Pages — the Firefox loader bookmarklet stays tiny by
// fetching the real script from here at click-time, instead of embedding
// the whole ~80KB script in the bookmark's own URL (which Firefox has
// historically choked on for saved bookmarks).
const HOSTED_JS_URL = 'https://punyesh.github.io/sakugaEnhancer/sakuga-enhancer.js';
const loaderSrc = "javascript:(function(){var s=document.createElement('script');" +
  "s.src='" + HOSTED_JS_URL + "?t='+Date.now();document.body.appendChild(s);})();";
const loaderHref = loaderSrc.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sakuga Enhancer — install</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #15130f;
    --panel: #1c1a15;
    --line: #3a3527;
    --text: #eae4d3;
    --dim: #9c9581;
    --amber: #ffb020;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: "Helvetica Neue", Arial, sans-serif;
    display: flex;
    justify-content: center;
    padding: 60px 20px;
  }
  main { max-width: 640px; width: 100%; }
  .eyebrow {
    font-family: "Courier New", monospace;
    color: var(--amber);
    letter-spacing: 2px;
    font-size: 12px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  h1 { font-size: 30px; margin: 0 0 8px; line-height: 1.15; }
  p.lede { color: var(--dim); font-size: 15px; line-height: 1.6; }
  .bm-wrap {
    margin: 34px 0 14px;
    padding: 24px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    text-align: center;
  }
  .bm-wrap.alt { margin-top: 0; }
  .bm-label {
    font-family: "Courier New", monospace;
    color: var(--amber);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 14px;
  }
  .bm-link {
    display: inline-block;
    font-family: "Courier New", monospace;
    font-weight: bold;
    font-size: 15px;
    color: #1a1509;
    background: var(--amber);
    padding: 12px 22px;
    border-radius: 6px;
    text-decoration: none;
    cursor: grab;
  }
  .bm-hint { color: var(--dim); font-size: 12px; margin-top: 12px; }
  ol { color: var(--text); font-size: 14px; line-height: 2; padding-left: 20px; }
  ol b { color: var(--amber); }
  .tag { font-family: "Courier New", monospace; background: var(--panel); border: 1px solid var(--line); padding: 1px 6px; border-radius: 4px; }
  footer { margin-top: 40px; color: var(--dim); font-size: 12px; border-top: 1px solid var(--line); padding-top: 16px; }
  footer p + p { margin-top: 10px; }
</style>
</head>
<body>
<main>
  <div class="eyebrow">FRAME BY FRAME</div>
  <h1>Sakuga Enhancer</h1>
  <p class="lede">
    A bookmarklet that adds better search and per-animator stats on top of
    <span class="tag">sakugabooru.com</span> — runs entirely in your browser,
    talks directly to the site's own API, no extension or server involved.
  </p>

  <div class="bm-wrap">
    <div class="bm-label">Chrome / Edge / Safari</div>
    <a class="bm-link" href="${escapedHref}" onclick="alert('Drag this to your bookmarks bar — clicking it here won\\'t do anything since you\\'re not on sakugabooru.com.'); return false;">
      🎞 Sakuga Enhancer
    </a>
    <div class="bm-hint">drag this button to your bookmarks bar</div>
  </div>

  <div class="bm-wrap alt">
    <div class="bm-label">Firefox (shorter link)</div>
    <a class="bm-link" href="${loaderHref}" onclick="alert('Drag this to your bookmarks bar — clicking it here won\\'t do anything since you\\'re not on sakugabooru.com.'); return false;">
      🦊 Sakuga Enhancer
    </a>
    <div class="bm-hint">drag this one instead — Firefox has trouble saving the very long link above</div>
  </div>

  <ol>
    <li>Make sure your browser's bookmarks bar is visible (<b>Ctrl/Cmd+Shift+B</b> in most browsers).</li>
    <li>Drag the button above matching your browser onto the bookmarks bar.</li>
    <li>Go to <span class="tag">sakugabooru.com</span>.</li>
    <li>Click the <b>Sakuga Enhancer</b> bookmark. A small panel appears bottom-right.</li>
    <li>Use <b>Search</b> to build a tag query — the built-in <b>📊 Animator Stats</b> toggle switches to cut counts, top co-tags, and a per-year activity chart for whichever animator is in focus. Use <b>Shows</b> to browse a title season-by-season down to individual episodes, with back/forward navigation.</li>
    <li>Click the bookmark again any time to show/hide the panel.</li>
  </ol>

  <footer>
    <p>
      Stats lookups page through up to 500 of an animator's posts, with a short pause between
      requests, to stay light on the site's infrastructure. Uses only sakugabooru's public
      <span class="tag">/post.json</span> and <span class="tag">/artist.json</span> endpoints.
    </p>
    <p>
      The Firefox bookmark works by fetching the actual script from
      <span class="tag">${HOSTED_JS_URL}</span> each time you click it, rather than storing the
      whole thing in the bookmark itself. If sakugabooru.com's security policy ever blocks loading
      scripts from other sites, this version may fail silently — if so, use the Chrome/Edge/Safari
      button above instead, which doesn't depend on any external file.
    </p>
  </footer>
</main>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'install.html'), html);
console.log('wrote install.html');
