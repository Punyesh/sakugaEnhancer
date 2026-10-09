const fs = require('fs');
const path = require('path');

// The script is developed as ordered modules in web-src/ (all parts of ONE closure —
// they share scope, so order matters and is given by the numeric filename prefix).
// This stitches them into the single sakuga-enhancer.js that the install
// bookmarklet loads, then derives the self-contained bookmarklet from it.
const srcDir = path.join(__dirname, 'web-src');
// A directory (web-src/02-css/) stands for its own .js files, in order.
const parts = [];
fs.readdirSync(srcDir).filter(e => /^\d/.test(e)).sort().forEach(entry => {
  const full = path.join(srcDir, entry);
  if (fs.statSync(full).isDirectory()) {
    fs.readdirSync(full).filter(f => /\.js$/.test(f)).sort().forEach(f => parts.push(path.join(entry, f)));
  } else if (/\.js$/.test(entry)) {
    parts.push(entry);
  }
});
const src = parts.map(f => fs.readFileSync(path.join(srcDir, f), 'utf8')).join('');
fs.writeFileSync(path.join(__dirname, 'sakuga-enhancer.js'), src);
console.log('sakuga-enhancer.js built from', parts.length, 'modules,', src.split('\n').length, 'lines');

// Minimal, safe "minification": strip full-line comments and collapse blank lines.
// (Not a real minifier — good enough for bookmarklet size, keeps logic intact.)
const stripped = src
  .split('\n')
  .filter(line => !/^\s*\/\//.test(line))
  .join('\n');

const bookmarklet = 'javascript:' + encodeURIComponent(stripped).replace(/'/g, '%27');

fs.writeFileSync(path.join(__dirname, 'bookmarklet.txt'), bookmarklet);
console.log('bookmarklet length:', bookmarklet.length, 'chars');
