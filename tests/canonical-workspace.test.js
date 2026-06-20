const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('repository keeps a single canonical application tree', () => {
  assert.equal(fs.existsSync(path.join(root, 'render-deploy')), false);
  assert.equal(fs.existsSync(path.join(root, 'render-upload')), false);
  assert.equal(fs.existsSync(path.join(root, 'public', 'app', 'index.html')), true);
  assert.equal(fs.existsSync(path.join(root, 'server.js')), true);
});
