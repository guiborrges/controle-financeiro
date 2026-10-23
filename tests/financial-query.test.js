const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const financial = require('../public/app/modules/shared/financial-query');
const { buildWidgetSnapshot } = require('../server/widget-snapshot');

function fixture() {
  return { id: 'outubro_2026', despesas: [],
    outflows: [
      { id: 'rent', type: 'expense', amount: 100, category: 'CASA', paid: true },
      { id: 'shared', type: 'spend', amount: 100, category: 'LAZER', sharedExpense: true, sharedOriginalAmount: 100, sharedOthersAmount: 60, paid: false },
      { id: 'card', type: 'spend', outputKind: 'card', outputRef: 'c', amount: 200, category: 'MERCADO', countsInPrimaryTotals: false },
      { id: 'excluded', type: 'spend', amount: 999, countsInPrimaryTotals: false },
      { id: 'transfer', type: 'transfer', amount: 300 }
    ], outflowCards: [{ id: 'c', name: 'Card' }], cardBills: [{ id: 'b', cardId: 'c', amount: 250, paid: false }],
    renda: [{ valor: 1000, paid: true }, { valor: 99, paid: true, includeInTotals: false }],
    projetos: [{ valor: 100, includeInTotals: true }], financialGoals: [{ valor: 50 }, { valor: 999, includeInTotals: false }] };
}

test('one financial contract reconciles rows, categories, goals and owner share without mutating data', () => {
  const month = fixture();
  const before = JSON.stringify(month);
  const result = financial.query(month);
  assert.equal(result.expenseCents, 39000);
  assert.equal(result.incomeCents, 110000);
  assert.equal(result.reserveCents, 5000);
  assert.equal(result.resultCents, 66000);
  assert.equal(result.categories.reduce((sum, row) => sum + row.amountCents, 0), result.expenseCents);
  assert.equal(result.expenseRows.reduce((sum, row) => sum + row.cents, 0), result.expenseCents);
  assert.equal(financial.query(month, { includeGoals: false }).resultCents, 71000);
  assert.equal(JSON.stringify(month), before);
});

test('cash, commitments and consumption use explicit different bases without counting card bills twice', () => {
  const month = fixture();
  assert.equal(financial.query(month, { basis: 'cash' }).expenseCents, 10000);
  const consumption = financial.query(month, { basis: 'consumption' });
  assert.equal(consumption.expenseCents, 34000);
  assert.equal(consumption.categories.some(row => row.category === 'MERCADO'), true);
  assert.equal(consumption.expenseRows.some(row => row.kind === 'bill'), false);
  assert.equal(financial.query(month).expenseRows.some(row => row.kind === 'purchase'), false);
});

test('selection excludes only its linked expense, including a manually excluded bill', () => {
  const month = fixture();
  month.despesas = [{ id: 'rent' }, { id: 'b', entraNaSomatoriaPrincipal: false }];
  const query = financial.query(month, { isSelected: index => index !== 0 });
  assert.equal(query.expenseCents, 4000);
});

test('manual zero bill is zero and missing projected bills use recurring forecasts only', () => {
  const month = fixture();
  month.cardBills[0] = { id: 'b', cardId: 'c', amount: 0, forecastAmount: 50, manualAmountSet: true };
  assert.equal(financial.query(month).expenseCents, 14000);
  month.cardBills = [];
  month.outflows.push({ type: 'spend', outputKind: 'card', outputRef: 'c', recurringSpend: true, amount: 25 });
  assert.equal(financial.query(month).expenseCents, 16500);
});

test('legacy backups and decimal cents use the same query contract', () => {
  const month = { despesas: [{ valor: 0.1, categoria: 'CASA' }, { valor: 999, entraNaSomatoriaPrincipal: false }],
    gastosVar: [{ valor: 0.2, categoria: 'CASA' }, { valor: 999, incluirNoTotal: false }] };
  assert.equal(financial.query(month).expenseCents, 30);
  assert.throws(() => financial.query(month, { basis: 'unknown' }));
  assert.throws(() => financial.cents(Infinity));
});

test('browser core, mobile contract and widget agree on expenses, income and reserved goals', () => {
  const month = fixture();
  const names = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  month.id = `${names[new Date().getMonth()]}_${new Date().getFullYear()}`;
  const sandbox = { console, data: [month], document: { addEventListener() {} }, addEventListener() {},
    resolveCategoryName: value => value, ensureProjetos() {}, despSelectionState: {} };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const name of ['modules/shared/outflow-amounts.js', 'modules/shared/financial-query.js', 'core.js', 'modules/mobile-v2/data-bridge.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app', name), 'utf8'), sandbox);
  }
  sandbox.calculateUnifiedPlanningTotal = month => sandbox.getFinancialMonthQuery(month).expenseCents / 100;
  const totals = sandbox.getTotals(month);
  const mobile = sandbox.MobileV2Data.getMonthMetrics(month);
  const widget = buildWidgetSnapshot('test', { finData: [month] });
  assert.equal(totals.totalGastos, widget.monthlyExpenses);
  assert.equal(totals.rendaTotal, widget.monthlyIncome);
  assert.equal(totals.resultadoMes, widget.result);
  assert.equal(mobile.resultado, widget.result);
  assert.equal(widget.reservedGoals, 50);
});
