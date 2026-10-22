const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(files, extra = {}) {
  const ctx = { console, Date, setTimeout, clearTimeout, addEventListener() {}, resolveCategoryName: value => value, data: [], currentSession: null, document: { addEventListener() {} }, ...extra };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app', file), 'utf8'), ctx, { filename: file });
  return ctx;
}

test('strict dates reject impossible dates, accept leap years and clamp recurring days only', () => {
  const ctx = load(['modules/shared/dates.js']);
  for (const date of ['31/02/27', '29/02/26', '31/04/2026']) assert.equal(ctx.normalizeVarDate(date), null);
  assert.equal(ctx.normalizeVarDate('29/02/2028'), '29/02/28');
  assert.equal(ctx.DateUtils.resolveDateFromInput('31', { nome: 'JANEIRO 2027' }).date, '28/02/27');
  assert.equal(ctx.DateUtils.resolveDateFromInput('32', { nome: 'JANEIRO 2027' }).date, '');
});

test('normalizing a recurring salary preserves the explicit full date over repeated saves', () => {
  const ctx = load(['modules/shared/dates.js', 'modules/mes-atual/income-dates.js', 'core.js']);
  for (const fn of ['normalizeMonthIdentity', 'applyExpenseNameRulesToMonth', 'applyCategoryRenameToMonth', 'applyExpenseCategoryRulesToMonth', 'applyExpensePaymentDateRulesToMonth']) ctx[fn] = () => {};
  ctx.canUseBundledFinanceData = () => false;
  ctx.getImportedCategoriesForMonth = () => [];
  ctx.normalizeIncomeName = value => value;
  ctx.getRecurringIncomeReceiveDay = ctx.IncomeDateRules.getRecurringIncomeReceiveDay;
  const month = { renda: [{ fonte: 'SALARIO', valor: 6500, dataRecebimento: '07/10/26' }] };
  for (let i = 0; i < 3; i++) ctx.normalizeMonth(month);
  assert.equal(month.renda[0].dataRecebimento, '07/10/26');
  assert.equal(ctx.IncomeDateRules.getIncomeReceiveDateLabel(month.renda[0], month), '07/10/26');
});

test('month planning counts card bills once, never their installments again', () => {
  const ctx = load(['mes-atual.js']);
  const month = { id: 'outubro_2026', despesas: [] };
  ctx.ensureUnifiedOutflowPilotMonth = () => {};
  ctx.isUnifiedDirectMethodSummaryRow = () => false;
  ctx.getUnifiedEffectiveOutflowAmount = item => item.amount;
  ctx.getUnifiedCardBillEffectiveAmount = (m, bill) => bill.amount;
  ctx.getUnifiedFilterRows = () => [
    ...[1800, 150, 320.45].map(amount => ({ kind: 'outflow', item: { amount, outputKind: 'method' } })),
    { kind: 'outflow', item: { amount: 200, outputKind: 'card', installmentsTotal: 6 } },
    { kind: 'outflow', item: { amount: 49.9, outputKind: 'card', recurringSpend: true } },
    { kind: 'bill', item: { amount: 249.9 } }
  ];
  assert.equal(ctx.calculateUnifiedPlanningTotal(month), 2520.35);
});

test('core total and result use unified expenses and subtract only included goals', () => {
  const ctx = load(['core.js']);
  ctx.isUnifiedMonthPilotEnabled = () => true;
  ctx.ensureUnifiedOutflowPilotMonth = () => {};
  ctx.ensureProjetos = () => {};
  ctx.getCategoryTotals = () => ({});
  ctx.calculateUnifiedPlanningTotal = () => 2520.35;
  ctx.despSelectionState = {};
  ctx.isPrimaryUserEnvironment = () => false;
  const month = { id: 'm', despesas: [{ valor: 249.9 }], gastosVar: [{ valor: 2520.35 }], renda: [{ valor: 6500 }], projetos: [], financialGoals: [{ valor: 100 }, { valor: 500, includeInTotals: false }] };
  assert.equal(ctx.getTotals(month).totalGastos, 2520.35);
  assert.equal(ctx.getEffectiveTotalsForMes(month).resultadoMes, 3879.65);
});

test('debit, pix and cash pay automatically only on dates already reached', () => {
  const ctx = load(['modules/shared/dates.js', 'mes-atual.js']);
  for (const outputMethod of ['debito', 'pix', 'dinheiro']) {
    const item = { outputKind: 'method', outputMethod };
    assert.equal(ctx.shouldAutoPayUnifiedOutflow({ ...item, date: '01/01/20' }), true);
    assert.equal(ctx.shouldAutoPayUnifiedOutflow({ ...item, date: '01/01/99' }), false);
    assert.equal(ctx.normalizeUnifiedOutflowItem({ ...item, date: '01/01/99', paid: true }).paid, true, 'explicit confirmation survives');
    assert.equal(ctx.normalizeUnifiedOutflowItem({ ...item, date: '01/01/20', paid: false }).paid, false);
  }
  assert.equal(ctx.shouldAutoPayUnifiedOutflow({ outputKind: 'method', outputMethod: 'boleto', date: '01/01/20' }), false);
});

test('mobile preserves the minus sign and deducts financial goals from its result', () => {
  const ctx = load(['modules/shared/formatters.js', 'modules/mobile-v2/data-bridge.js']);
  ctx.getEffectiveTotalsForMes = () => ({ rendaTotal: 1000, totalFinancialGoals: 125 });
  ctx.calculateUnifiedPlanningTotal = () => 0;
  assert.match(ctx.MobileV2Data.formatMoney(-100), /^- R\$/);
  assert.equal(ctx.MobileV2Data.getMonthMetrics({}).resultado, 875);
});

test('cloning a paid direct purchase into the future resets its payment using the new date', () => {
  const ctx = load(['modules/shared/dates.js', 'mes-atual.js']);
  ctx.isUnifiedExpenseType = () => false;
  const clone = ctx.cloneUnifiedOutflowForMonth({ type: 'spend', outputKind: 'method', outputMethod: 'debito', date: '01/01/20', paid: true }, new Date(2099, 0, 1));
  assert.equal(clone.date, '01/01/99');
  assert.equal(clone.paid, false);
});

test('mobile dashboard rendered result includes the reserved financial goals', () => {
  const month = { id: 'm', nome: 'OUTUBRO 2026' };
  const ctx = load(['modules/mobile-v2/home-screen.js'], {
    performance: { now: () => 0 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    MobileV2Data: {
      escapeHtml: String, formatMoney: String, categoryIcon: () => '',
      getMonths: () => [month], getIncomeTotal: () => 1000,
      getPlanningTotal: () => 0, getTotals: () => ({ totalFinancialGoals: 125 })
    }
  });
  const target = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  ctx.MobileV2HomeScreen.render(target);
  assert.match(target.innerHTML, /class="hero-result">875</);
});

test('notifications include projected months even when window.data is absent', () => {
  const ctx = load(['modules/shared/dates.js', 'modules/mes-atual/notifications.js']);
  const now = new Date();
  const date = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  delete ctx.data;
  ctx.getAllFinanceMonths = () => [{ id: 'm', outflows: [{ id: 'due', type: 'expense', outputKind: 'method', date, amount: 1.24, paid: false }] }];
  ctx.localStorage = { getItem: () => null };
  assert.equal(ctx.MesAtualNotifications.getNotificationItemsForToday().length, 1);
  ctx.getAllFinanceMonths = () => [{ outflows: [{ type: 'expense', outputKind: 'method', date, amount: 1.24, paid: true }] }];
  assert.equal(ctx.MesAtualNotifications.getNotificationItemsForToday().length, 0);
});

test('filtered search counts card bills once but still totals purchases when the bill is absent', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/app/modules/universal-search.js'), 'utf8');
  const nodes = {};
  const ctx = { document: { getElementById: id => nodes[id] ||= { style: {} } }, formatMoney: String,
    state: { filters: Object.fromEntries(['types', 'category', 'card', 'tag', 'method'].map(key => [key, new Set()])) } };
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('  function updateFooter('), source.indexOf('  function run()')), ctx);
  const purchase = { source: 'outflow', method: 'card', cardId: 'c', monthId: 'm', amount: 200, countInTotals: false, visualSign: -1, signedAmount: 0 };
  const bill = { source: 'card_bill', cardId: 'c', monthId: 'm', amount: 249.9, signedAmount: -249.9 };
  ctx.updateFooter([{ item: purchase }, { item: bill }], 'cartao');
  assert.equal(nodes.usTotalExpenseVal.textContent, '249.9');
  ctx.updateFooter([{ item: purchase }], 'notebook');
  assert.equal(nodes.usTotalExpenseVal.textContent, '200');
});

test('mobile calendar displays payments without adding them to real outflow totals', () => {
  const ctx = load(['modules/mobile-v2/calendario-mobile.js'], {
    MobileV2Data: { escapeHtml: value => String(value), formatMoney: value => `R$ ${value}`, categoryIcon: () => '' },
    getCurrentMonth: () => ({ id: 'outubro_2026', nome: 'OUTUBRO 2026' }),
    FinanceCalendarUtils: { getMonthContext: () => ({ daysInMonth: 31 }), getDayLedger: () => ({ outflows: 0, launches: [], paymentItems: [{ description: 'CONTA TESTE', amount: 100 }] }) }
  });
  const target = { innerHTML: '', querySelectorAll: () => [] };
  ctx.MobileV2Calendario.render(target);
  assert.match(target.innerHTML, /Pagamentos do dia/);
  assert.match(target.innerHTML, /CONTA TESTE/);
  assert.doesNotMatch(target.innerHTML, /Sem lançamentos ou eventos neste dia/);
});
