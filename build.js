const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'sakuga-enhancer.js'), 'utf8');

// Minimal, safe "minification": strip full-line comments and collapse blank lines.
// (Not a real minifier — good enough for bookmarklet size, keeps logic intact.)
const stripped = src
  .split('\n')
  .filter(line => !/^\s*\/\//.test(line))
  .join('\n');

const bookmarklet = 'javascript:' + encodeURIComponent(stripped).replace(/'/g, '%27');

fs.writeFileSync(path.join(__dirname, 'bookmarklet.txt'), bookmarklet);
console.log('bookmarklet length:', bookmarklet.length, 'chars');
