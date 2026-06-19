const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'patrimonio-clean.js'),
  'utf8'
);

test('patrimonio module has no shadowed top-level function declarations', () => {
  const names = [];
  const declaration = /^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  let match;
  while ((match = declaration.exec(source))) names.push(match[1]);

  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test('obsolete patrimonio collapsible controller stays removed', () => {
  assert.doesNotMatch(source, /PatrimonioCollapsibleState|setupPatrimonioCollapsibles/);
});
