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
    getCurrentRealMonthId: () => 'abril_2026',
    recalcTotals: () => {},
    UNIFIED_OUTFLOW_GLOBAL_MIGRATION_VERSION: 5
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

test('normalizeUnifiedCardBill preserves positive historical backup amounts even with manual flag false', () => {
  const ctx = loadMesAtualContext();
  const bill = ctx.normalizeUnifiedCardBill(
    { id: 'marco_2026' },
    { cardId: 'card_xp', amount: 3173.82, manualAmountSet: false },
    0
  );
  assert.equal(bill.amount, 3173.82);
  assert.equal(bill.manualAmountSet, true);
});

test('historical backup bill is not zeroed by automatic forecast sync after normalization', () => {
  const ctx = loadMesAtualContext();
  const month = {
    id: 'marco_2026',
    outflows: [],
    cardBills: [
      { cardId: 'card_xp', amount: 3173.82, manualAmountSet: false }
    ]
  };
  month.cardBills = month.cardBills.map((bill, idx) => ctx.normalizeUnifiedCardBill(month, bill, idx));
  const changed = ctx.syncUnifiedCardBillForecastAmounts(month);
  assert.equal(changed, false);
  assert.equal(month.cardBills[0].amount, 3173.82);
});

test('current-version imported backup month normalizes bills before forecast sync', () => {
  const ctx = loadMesAtualContext();
  const month = {
    id: 'fevereiro_2026',
    renda: [],
    despesas: [],
    gastosVar: [],
    outflowCards: [
      { id: 'card_xp', name: 'XP', closingDay: 1, paymentDay: 10 },
      { id: 'card_nubank', name: 'Nubank', closingDay: 1, paymentDay: 10 },
      { id: 'card_inter', name: 'Inter', closingDay: 1, paymentDay: 10 }
    ],
    outflows: [],
    cardBills: [
      { cardId: 'card_xp', amount: 3106.65, manualAmountSet: false, paid: true },
      { cardId: 'card_nubank', amount: 18.9, manualAmountSet: false, paid: true },
      { cardId: 'card_inter', amount: 197, manualAmountSet: false, paid: true }
    ],
    _unifiedOutflowMigratedVersion: 5
  };
  ctx.ensureUnifiedOutflowPilotMonth(month);
  const byCardId = new Map(month.cardBills.map(bill => [bill.cardId, bill]));
  assert.equal(byCardId.get('card_xp')?.amount, 3106.65);
  assert.equal(byCardId.get('card_nubank')?.amount, 18.9);
  assert.equal(byCardId.get('card_inter')?.amount, 197);
  assert.equal(byCardId.get('card_xp')?.manualAmountSet, true);
  assert.equal(byCardId.get('card_nubank')?.manualAmountSet, true);
  assert.equal(byCardId.get('card_inter')?.manualAmountSet, true);
});
