const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadFilterFunctions() {
  const filePath = path.resolve(__dirname, '../public/app/modules/mes-atual/filters.js');
  const code = fs.readFileSync(filePath, 'utf8');
  const context = {
    window: {},
    normalizeVarDate: value => value,
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

test('expense filter includes expense rows, direct real methods and bills', () => {
  const { getUnifiedFilterRows } = loadFilterFunctions();
  const month = {
    outflows: [
      { id: 'expense_a', type: 'expense', outputKind: 'method', outputMethod: 'boleto' },
      { id: 'legacy_fixed', type: 'fixed', outputKind: 'method', outputMethod: 'boleto' },
      { id: 'spend_pix', type: 'spend', outputKind: 'method', outputMethod: 'pix' },
      { id: 'spend_card', type: 'spend', outputKind: 'card', outputRef: 'c1' }
    ],
    cardBills: [{ id: 'bill_1', cardId: 'c1' }]
  };
  const rows = getUnifiedFilterRows(month, 'expense', '');
  const ids = rows.map(row => row.item.id);
  assert.equal(ids.includes('expense_a'), true);
  assert.equal(ids.includes('legacy_fixed'), true);
  assert.equal(ids.includes('spend_pix'), true);
  assert.equal(ids.includes('spend_card'), false);
  assert.equal(ids.includes('bill_1'), true);
});

test('spend filter keeps only spend launches (excludes expense)', () => {
  const { getUnifiedFilterRows } = loadFilterFunctions();
  const month = {
    outflows: [
      { id: 'expense_a', type: 'expense', outputKind: 'method', outputMethod: 'boleto' },
      { id: 'spend_a', type: 'spend', outputKind: 'method', outputMethod: 'pix' }
    ],
    cardBills: []
  };
  const rows = getUnifiedFilterRows(month, 'spend', '');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].item.id, 'spend_a');
});

test('all filter keeps outflows plus bills and tag filter narrows outflows only', () => {
  const { getUnifiedFilterRows } = loadFilterFunctions();
  const month = {
    outflows: [
      { id: 'a', type: 'spend', outputKind: 'method', outputMethod: 'dinheiro', tag: 'viagem' },
      { id: 'b', type: 'expense', outputKind: 'method', outputMethod: 'boleto', tag: 'casa' }
    ],
    cardBills: [{ id: 'bill' }]
  };
  const allRows = getUnifiedFilterRows(month, 'all', '');
  assert.equal(allRows.length, 3);
  const tagRows = getUnifiedFilterRows(month, 'all', 'viagem');
  assert.equal(tagRows.length, 1);
  assert.equal(tagRows[0].item.id, 'a');
});

test('search stays within every selected method, month and tag', () => {
  const { getUnifiedFilterRows } = loadFilterFunctions();
  const month = { outflows: [
    { id: 'pix', description: 'Condomínio', amount: 1234.56, date: '10/11/26', category: 'MORADIA', tag: 'casa', outputKind: 'method', outputMethod: 'pix', type: 'spend' },
    { id: 'cash', description: 'Condominio', amount: 1234.57, outputKind: 'method', outputMethod: 'dinheiro', type: 'expense' }
  ], cardBills: [] };
  for (const query of ['CONDOMINIO', '1.234,56', '1234.56', 'R$ 1234,56', '10/11/2026', '2026-11-10', 'moradia casa']) {
    assert.deepEqual(Array.from(getUnifiedFilterRows(month, 'method:pix', 'casa', query), row => row.item.id), ['pix']);
  }
  assert.equal(getUnifiedFilterRows(month, 'method:pix', '', '1234,57').length, 0);
  assert.equal(getUnifiedFilterRows(month, 'method:boleto', '', 'condominio').length, 0);
  assert.equal(getUnifiedFilterRows(month, 'all', 'viagem', 'condominio').length, 0);
  assert.equal(getUnifiedFilterRows({ outflows: [] }, 'all', '', 'condominio').length, 0);
  for (const filter of ['expense', 'spend', 'all', 'method:dinheiro', 'method:pix']) {
    assert.equal(getUnifiedFilterRows(month, filter, '', 'inexistente').length, 0);
  }
});

test('planning search retains the heading of a matching recurring card launch', () => {
  const { getUnifiedFilterRows } = loadFilterFunctions();
  const month = { outflows: [{ id: 'subscription', description: 'Spotify', type: 'expense', outputKind: 'card', outputRef: 'c1' }], cardBills: [{ id: 'bill', cardId: 'c1' }], outflowCards: [{ id: 'c1', name: 'XP', paymentDay: 10 }] };
  const rows = getUnifiedFilterRows(month, 'expense', '', 'spotify');
  assert.deepEqual(Array.from(rows, row => row.item.id), ['subscription', 'bill']);
  assert.deepEqual(Array.from(getUnifiedFilterRows(month, 'card:c1', '', 'spotify'), row => row.item.id), ['subscription']);
});
