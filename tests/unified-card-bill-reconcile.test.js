const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadMesAtualContext() {
  const filePath = path.resolve(__dirname, '../public/app/mes-atual.js');
  const code = fs.readFileSync(filePath, 'utf8');
  const context = {
    window: {},
    data: [],
    currentSession: null,
    getMonthSortValue: () => 1,
    getCurrentRealMonthId: () => 'abril_2026'
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: filePath });
  return context;
}

test('reconcileUnifiedCardBillsWithCards keeps legacy cardId values mapped by card name', () => {
  const ctx = loadMesAtualContext();
  const month = {
    id: 'janeiro_2025',
    outflowCards: [
      { id: 'card_xp', name: 'XP', closingDay: 8, paymentDay: 15 }
    ]
  };
  const bills = [
    { cardId: 'XP', amount: 145.67, manualAmountSet: true, paid: true }
  ];
  const reconciled = ctx.reconcileUnifiedCardBillsWithCards(month, bills);
  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0].cardId, 'card_xp');
  assert.equal(reconciled[0].amount, 145.67);
  assert.equal(reconciled[0].manualAmountSet, true);
  assert.equal(reconciled[0].paid, true);
});

test('reconcileUnifiedCardBillsWithCards preserves orphan historical bills and adds missing card bill rows', () => {
  const ctx = loadMesAtualContext();
  const month = {
    id: 'fevereiro_2025',
    outflowCards: [
      { id: 'card_inter', name: 'Inter', closingDay: 5, paymentDay: 12 }
    ]
  };
  const bills = [
    { cardId: 'cartao_legacy_antigo', amount: 90, manualAmountSet: true }
  ];
  const reconciled = ctx.reconcileUnifiedCardBillsWithCards(month, bills);
  const byCardId = new Map(reconciled.map(bill => [bill.cardId, bill]));
  assert.equal(byCardId.get('cartao_legacy_antigo')?.amount, 90);
  assert.equal(byCardId.get('cartao_legacy_antigo')?.manualAmountSet, true);
  assert.equal(byCardId.get('card_inter')?.amount, 0);
});
