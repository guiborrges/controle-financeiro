const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appDir = path.join(__dirname, '..', 'public', 'app');
const source = [
  fs.readFileSync(path.join(appDir, 'styles.css'), 'utf8'),
  fs.readFileSync(path.join(appDir, 'dark-mode.css'), 'utf8')
].join('\n');

test('obsolete month-management selectors stay removed', () => {
  assert.doesNotMatch(source, /btn-(?:delete|new)-month|btn-inline-edit-month|month-calendar-pill|page-guide-compact/);
});
