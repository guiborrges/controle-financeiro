const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../public/app');

test('mobile component styles use readable caption tokens and no negative tracking', () => {
  const directory = path.join(root, 'modules/mobile-v2/styles');
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.css'))) {
    const css = fs.readFileSync(path.join(directory, file), 'utf8');
    assert.doesNotMatch(css, /letter-spacing:\s*-/, file);
    assert.doesNotMatch(css, /font-size:\s*(?:[0-9]|10)(?:\.\d+)?px/, file);
  }
});

test('shared product skin no longer owns mobile-specific selectors', () => {
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'product-design.css'), 'utf8'), /html\.mobile-v2/);
});
