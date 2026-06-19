const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

test('obsolete manual month-copy flow stays removed', () => {
  const indexSource = read('../public/app/index.html');
  const monthSource = read('../public/app/mes-atual.js');
  const storageSource = read('../public/app/storage.js');

  assert.doesNotMatch(indexSource, /modalNewMonth|monthCopyControls/);
  assert.doesNotMatch(monthSource, /openNewMonth|submitMonthModal|getMonthCopyPreferences/);
  assert.doesNotMatch(storageSource, /monthCopyPreferences/);
});
