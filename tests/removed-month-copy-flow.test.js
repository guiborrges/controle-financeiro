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

test('obsolete desktop handlers and title modal stay removed', () => {
  const indexSource = read('../public/app/index.html');
  const coreSource = read('../public/app/core.js');
  const interactionsSource = read('../public/app/interactions.js');
  const stateSource = read('../public/app/state.js');
  const stylesSource = read('../public/app/styles.css');

  assert.doesNotMatch(indexSource, /modalTitles|titleInpDesp/);
  assert.doesNotMatch(coreSource, /deleteCurrentMonth|setPeriodMonthReal|openTitles/);
  assert.doesNotMatch(interactionsSource, /openEditMonth/);
  assert.doesNotMatch(stateSource, /function resolveIncomeName/);
  assert.doesNotMatch(stylesSource, /month-copy-(?:controls|topline|summary|picker|group|list|item|empty)/);
});
