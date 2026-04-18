const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadFilterFunctions() {
  const filePath = path.resolve(__dirname, '../public/app/modules/mes-atual/filters.js');
  const code = fs.readFileSync(filePath, 'utf8');
  const context = {
    parseData: () => 0
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: filePath });
  return context;
}

test('card filter returns only launches for selected card (no bill)', () => {
  const { getUnifiedFilterRows } = loadFilterFunctions();
  const month = {
    outflows: [
      { id: 'o1', outputKind: 'card', outputRef: 'c1', type: 'spend', outputMethod: '' },
      { id: 'o2', outputKind: 'card', outputRef: 'c2', type: 'spend', outputMethod: '' },
      { id: 'o3', outputKind: 'method', outputRef: '', outputMethod: 'pix', type: 'spend' }
    ],
    cardBills: [
      { id: 'b1', cardId: 'c1', amount: 100 },
      { id: 'b2', cardId: 'c2', amount: 80 }
    ]
  };
  const rows = getUnifiedFilterRows(month, 'card:c1', '');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'outflow');
  assert.equal(rows[0].item.id, 'o1');
});

test('fixed filter includes fixed rows, direct real methods and bills', () => {
  const { getUnifiedFilterRows } = loadFilterFunctions();
  const month = {
    outflows: [
      { id: 'fixed_a', type: 'fixed', outputKind: 'method', outputMethod: 'boleto' },
      { id: 'spend_pix', type: 'spend', outputKind: 'method', outputMethod: 'pix' },
      { id: 'spend_card', type: 'spend', outputKind: 'card', outputRef: 'c1' }
    ],
    cardBills: [{ id: 'bill_1', cardId: 'c1' }]
  };
  const rows = getUnifiedFilterRows(month, 'fixed', '');
  const ids = rows.map(row => row.item.id);
  assert.equal(ids.includes('fixed_a'), true);
  assert.equal(ids.includes('spend_pix'), true);
  assert.equal(ids.includes('spend_card'), false);
  assert.equal(ids.includes('bill_1'), true);
});

test('all filter keeps outflows plus bills and tag filter narrows outflows only', () => {
  const { getUnifiedFilterRows } = loadFilterFunctions();
  const month = {
    outflows: [
      { id: 'a', type: 'spend', outputKind: 'method', outputMethod: 'dinheiro', tag: 'viagem' },
      { id: 'b', type: 'fixed', outputKind: 'method', outputMethod: 'boleto', tag: 'casa' }
    ],
    cardBills: [{ id: 'bill' }]
  };
  const allRows = getUnifiedFilterRows(month, 'all', '');
  assert.equal(allRows.length, 3);
  const tagRows = getUnifiedFilterRows(month, 'all', 'viagem');
  assert.equal(tagRows.length, 1);
  assert.equal(tagRows[0].item.id, 'a');
});
