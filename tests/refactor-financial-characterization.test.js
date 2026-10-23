const test = require('node:test');
const assert = require('node:assert/strict');
const financial = require('../public/app/modules/shared/financial-query');
const { buildWidgetSnapshot } = require('../server/widget-snapshot');
const { financialMonth, browserSandbox } = require('./helpers/refactor-fixtures');

const expected = {
  commitments: { income: 325000, expenses: 153567, reserves: 10000, result: 161433, pending: 29000 },
  consumption: { income: 325000, expenses: 151567, reserves: 10000, result: 163433, pending: 27000 },
  cash: { income: 300000, expenses: 124567, reserves: 0, result: 175433, pending: 0 }
};

for (const [basis, values] of Object.entries(expected)) {
  test(`2A financial ledger: ${basis} has fixed independent expected totals and preserves JSON`, () => {
    const month = financialMonth();
    const before = JSON.stringify(month);
    const result = financial.query(month, { basis });
    assert.deepEqual([result.incomeCents, result.expenseCents, result.reserveCents, result.resultCents, result.pendingExpenseCents],
      [values.income, values.expenses, values.reserves, values.result, values.pending]);
    assert.equal(result.categories.reduce((sum, row) => sum + row.amountCents, 0), values.expenses);
    assert.equal(result.expenseRows.some(row => ['excluded', 'transfer', 'refund'].includes(row.sourceId)), false);
    assert.equal(result.expenseRows.some(row => row.kind === 'bill'), basis === 'commitments');
    assert.equal(result.expenseRows.some(row => row.kind === 'purchase'), basis === 'consumption');
    assert.equal(JSON.stringify(month), before);
    assert.equal(financial.query(JSON.parse(before), { basis }).resultCents, values.result);
  });
}


test('financial query keeps its NaN policy and rejects infinite bill amounts', () => {
  const ctx = browserSandbox();
  const bill = { amount: 'invalid', manualAmountSet: true };
  assert.equal(ctx.MesAtualCards.getUnifiedCardBillEffectiveAmount({}, bill), 0);
  assert.equal(Number.isNaN(financial.billAmount(bill)), true);
  const month = financialMonth();
  month.cardBills[0] = { ...bill, cardId: 'card-a' };
  assert.equal(financial.query(month).expenseRows.find(row => row.kind === 'bill').cents, 0);
  month.cardBills[0].amount = Infinity;
  assert.throws(() => financial.query(month), /invalido/);
});

for (const [name, fields, amount] of [
  ['explicit owner', { sharedOwnerAmount: 35 }, 35],
  ['owner participant', { sharedParticipants: [{ isOwner: true, amount: 22 }] }, 22],
  ['zero owner participant', { sharedParticipants: [{ isOwner: true, amount: 0 }] }, 0],
  ['original less others', { sharedOriginalAmount: 100, sharedOthersAmount: 60, sharedParticipants: [] }, 40],
  ['others above original', { sharedOthersAmount: 150, sharedParticipants: [] }, 0]
]) {
  test(`2A shared amounts: ${name} preserved in commitments and consumption`, () => {
    const month = financialMonth();
    const item = month.outflows.find(row => row.id === 'shared');
    Object.assign(item, fields);
    for (const basis of ['commitments', 'consumption']) {
      assert.equal(financial.query(month, { basis }).expenseRows.find(row => row.sourceId === 'shared').cents, amount * 100);
    }
  });
}

test('2A per-expense selections, hidden goals and aliases retain separate semantics', () => {
  const month = financialMonth();
  month.despesas = [{ id: 'rent' }, { id: 'bill-a', entraNaSomatoriaPrincipal: false }];
  const query = financial.query(month, { isSelected: index => index !== 0, resolveCategory: name => name === 'MERCADO' ? 'COMPRAS' : name });
  assert.equal(query.expenseCents, 8567);
  assert.equal(query.reserveCents, 10000);
  assert.equal(query.categories.find(row => row.category === 'COMPRAS').amountCents, 4567);
  assert.equal(financial.query(month, { includeGoals: false }).reserveCents, 0);
});

test('2A core, mobile and widget consume the same fictional ledger without double counting', () => {
  const now = new Date();
  const month = financialMonth(now.getFullYear(), now.getMonth());
  const before = JSON.stringify(month);
  const ctx = browserSandbox();
  ctx.calculateUnifiedPlanningTotal = value => ctx.getFinancialMonthQuery(value).expenseCents / 100;
  const core = ctx.getTotals(month);
  const mobile = ctx.MobileV2Data.getMonthMetrics(month);
  const widget = buildWidgetSnapshot('synthetic-a', { finData: [month] });
  assert.equal(core.totalGastos, 1535.67);
  assert.equal(core.resultadoMes, 1614.33);
  assert.equal(mobile.lancamentos, core.totalGastos);
  assert.equal(mobile.resultado, core.resultadoMes);
  assert.equal(widget.monthlyExpenses, core.totalGastos);
  assert.equal(widget.result, core.resultadoMes);
  assert.equal(widget.goals[0].spent, 245.67);
  assert.equal(JSON.stringify(month), before);
});

test('2A two fictional ledgers remain independent across alternating queries', () => {
  const a = financialMonth();
  const b = financialMonth();
  b.renda[0].valor = 5000;
  for (let index = 0; index < 4; index += 1) {
    assert.equal(financial.query(a).resultCents, 161433);
    assert.equal(financial.query(b).resultCents, 361433);
  }
});
