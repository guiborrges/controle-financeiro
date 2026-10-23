const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

test('continuous calendar does not expose manual month-copy controls', () => {
  const indexSource = read('../public/app/index.html');

  assert.doesNotMatch(indexSource, /modalNewMonth|monthCopyControls/);
});
