const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'modules', 'mobile-v2', 'outflow-form-mobile.js'),
  'utf8'
);

test('mobile outflow editor makes its sheet visible before opening', () => {
  const start = source.indexOf('function openEdit(item)');
  const end = source.indexOf('\n  function close()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const openEdit = source.slice(start, end);

  assert.match(openEdit, /sheet\.style\.display\s*=\s*''/);
  assert.match(openEdit, /sheet\.removeAttribute\('hidden'\)/);
  assert.match(openEdit, /sheet\.classList\.add\('open'\)/);
  assert.equal(openEdit.indexOf("removeAttribute('hidden')") < openEdit.indexOf("classList.add('open')"), true);
});

test('month mobile rows remain wired to the visible editor', () => {
  const monthSource = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'modules', 'mobile-v2', 'mes-atual-mobile.js'),
    'utf8'
  );
  assert.match(monthSource, /data-action="edit" data-id=/);
  assert.match(monthSource, /MobileV2OutflowForm\.openEdit\(item\)/);
});
