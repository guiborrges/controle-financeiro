const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const finance = require('../public/app/modules/shared/financial-query');
const explanation = require('../public/app/modules/shared/financial-explanation');

function fixture(id = 'outubro_2026') {
  return { id, nome: id, despesas: [{ id: 'fixed' }],
    outflows: [
      { id: 'fixed', type: 'expense', amount: 10.01, category: 'CASA', paid: true },
      { id: 'share', type: 'spend', amount: 100, sharedExpense: true, sharedOriginalAmount: 100, sharedOthersAmount: 70, category: 'LAZER' },
      { id: 'excluded', type: 'spend', amount: 9999, countsInPrimaryTotals: false, category: 'CASA' },
      { id: 'card', type: 'spend', amount: 35.99, outputKind: 'card', outputRef: 'c', category: 'MERCADO', countsInPrimaryTotals: false },
      { id: 'transfer', type: 'transfer', amount: 500 }
    ], cardBills: [{ id: 'bill', cardId: 'c', amount: 40 }],
    renda: [{ fonte: 'Salario', valor: 100, paid: true }],
    projetos: [{ nome: 'Extra', valor: 5.02 }],
    financialGoals: [{ nome: 'Reserva', valor: 20 }, { valor: 99, includeInTotals: false }] };
}

for (const basis of ['commitments', 'consumption', 'cash']) {
  for (const metric of ['expenses', 'income', 'fixedIncome', 'projects', 'goals', 'result']) {
    test(`${basis}/${metric}: evidence lines reconcile exactly with the M01 query`, () => {
      const months = [fixture(), fixture('novembro_2026')];
      const before = JSON.stringify(months);
      const query = finance.query(months[0], { basis });
      const expected = { expenses: query.expenseCents, income: query.incomeCents,
        fixedIncome: query.incomeRows.filter(row => row.kind === 'income').reduce((sum, row) => sum + row.cents, 0),
        projects: query.incomeRows.filter(row => row.kind === 'project').reduce((sum, row) => sum + row.cents, 0),
        goals: query.reserveCents, result: query.resultCents }[metric] * 2;
      const report = explanation.build(months, { basis, metric, expectedCents: expected });
      assert.equal(report.totalCents, expected);
      assert.equal(report.lines.reduce((sum, row) => sum + row.signedCents, 0), expected);
      assert.equal(report.lines.some(row => row.sourceId === 'transfer' || row.sourceId === 'excluded'), false);
      assert.equal(JSON.stringify(months), before);
    });
  }
}

test('grouped minor categories and renamed aliases use the same query and retain owner share', () => {
  const month = fixture();
  const queryMonth = (month, options) => finance.query(month, { ...options, resolveCategory: value => value === 'CASA' ? 'MORADIA' : value });
  const report = explanation.build([month], { metric: 'expenses', categories: ['MORADIA', 'LAZER'], queryMonth, expectedCents: 4001 });
  assert.deepEqual(report.lines.map(row => row.category), ['MORADIA', 'LAZER']);
  assert.equal(report.lines.find(row => row.sourceId === 'share').signedCents, 3000);
});

test('negative result shows expenses and goals as deductions, without duplicating card purchases', () => {
  const month = fixture();
  month.renda[0].valor = 10;
  const report = explanation.build([month], { metric: 'result' });
  assert.ok(report.totalCents < 0);
  assert.ok(report.lines.find(row => row.kind === 'goal').signedCents < 0);
  assert.equal(report.lines.some(row => row.kind === 'purchase'), false);
  assert.equal(report.lines.filter(row => row.kind === 'bill').length, 1);
});

test('queries are transient and isolated across accounts, months and selection changes', () => {
  const userA = fixture();
  const userB = fixture();
  userB.renda[0] = { fonte: 'Outra pessoa', valor: 1 };
  explanation.build([userA], { metric: 'income' });
  const reportB = explanation.build([userB], { metric: 'income' });
  assert.equal(reportB.lines.some(row => row.description === 'Salario'), false);
  const selected = explanation.build([userA], { queryMonth: (month, options) => finance.query(month, { ...options, isSelected: () => false }) });
  assert.equal(selected.lines.some(row => row.sourceId === 'fixed'), false);
  assert.equal(explanation.build([], {}).totalCents, 0);
  assert.deepEqual(explanation.build([fixture()], { categories: ['OCULTA'] }).lines, []);
});

test('stale indicators, unknown metrics and inconsistent query providers are refused', () => {
  assert.throws(() => explanation.build([fixture()], { expectedCents: 1 }), /dados mudaram/);
  assert.throws(() => explanation.build([], { metric: 'unknown' }));
  assert.throws(() => explanation.build([], { metric: 'income', categories: ['CASA'] }));
  assert.throws(() => explanation.build([fixture()], { queryMonth: () => ({ expenseRows: [], expenseCents: 1 }) }), /nao conferem/);
});

test('mobile history result deducts included financial goals before offering its drill-down', () => {
  const context = { MobileV2Data: { formatMoney: String, escapeHtml: String, getMonthMetrics: () => ({ renda: 100, lancamentos: 50, resultado: 30 }) } };
  context.window = context;
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../public/app/modules/mobile-v2/historico-mobile.js'), 'utf8');
  vm.runInContext(source.replace('global.MobileV2Historico = { render }', 'global.MobileV2Historico = { render, summarizeMonth }'), context);
  assert.equal(context.MobileV2Historico.summarizeMonth({ id: 'm' }).result, 30);
});
