const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const rules = require('../public/app/modules/shared/dashboard-rules');

function run(selected, months, type = 'month') {
  const elements = Object.fromEntries(['histFilters', 'dashFilters', 'dashSub', 'dashInsights', 'dashMetrics', 'dashboardWidgets'].map(id => [id, {}]));
  const context = {
    document: { getElementById: id => elements[id] },
    data: months, periodFilter: { type, month: selected, year: selected },
    getYear: month => month.nome.split(' ')[1],
    getFilteredData: () => months.filter(month => type === 'year' ? month.nome.endsWith(context.periodFilter.year) : month.id === context.periodFilter.month),
    getDashboardEligibleMonths: source => rules.getDashboardEligibleMonths(source, new Date(2026, 9, 23)),
    getMonthSortValue: rules.getMonthSortValueFromMonth,
    ensureProjetos: () => {}, saveUIState: () => { context.saved = true; },
    buildPeriodControls: () => { context.controls = true; },
    getDashboardResultMode: () => { throw new Error('continued'); }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../public/app/dashboard.js'), 'utf8'), context);
  context.getDashboardResultMode = () => { throw new Error('continued'); };
  try { vm.runInContext('renderDashboard()', context); }
  catch (error) { if (error.message !== 'continued') throw error; context.continued = true; }
  return { ...context, elements };
}

const months = [
  { id: 'oct', nome: 'OUTUBRO 2026' },
  { id: 'sep', nome: 'SETEMBRO 2026' },
  { id: 'nov', nome: 'NOVEMBRO 2026' }
];

test('dashboard recovers a future saved month using latest started month, not array order', () => {
  const state = run('nov', months);
  assert.equal(state.periodFilter.month, 'oct');
  assert.equal(state.saved, true);
  assert.equal(state.controls, true);
  assert.equal(state.continued, true);
});

test('dashboard recovers a removed month selection', () => {
  assert.equal(run('removed', months).periodFilter.month, 'oct');
});

test('dashboard preserves a valid historical selection', () => {
  const state = run('sep', months);
  assert.equal(state.periodFilter.month, 'sep');
  assert.equal(state.saved, undefined);
  assert.equal(state.controls, true);
});

test('dashboard keeps period controls available even when all months are future', () => {
  const state = run('nov', months.slice(2));
  assert.equal(state.controls, true);
  assert.equal(state.continued, undefined);
  assert.match(state.elements.dashboardWidgets.innerHTML, /Nenhum dado/);
});

test('dashboard empty account keeps usable filters without writing financial data', () => {
  const state = run('', []);
  assert.equal(state.controls, true);
  assert.equal(state.saved, undefined);
});

test('dashboard retains annual mode when recovering a future saved year', () => {
  const state = run('2027', months, 'year');
  assert.equal(state.periodFilter.type, 'year');
  assert.equal(state.periodFilter.year, '2026');
  assert.equal(state.continued, true);
});

test('dashboard preserves a valid historical year', () => {
  const state = run('2025', [...months, { id: 'old', nome: 'JANEIRO 2025' }], 'year');
  assert.equal(state.periodFilter.year, '2025');
  assert.equal(state.saved, undefined);
});

test('switching to annual mode initializes invalid years and normalizes numeric years', () => {
  const source = fs.readFileSync(require.resolve('../public/app/core.js'), 'utf8');
  const handler = source.slice(source.indexOf('function onPeriodTypeChange('), source.indexOf('function setPeriodMonth('));
  for (const [input, expected] of [['2027', '2026'], ['', '2026'], [2025, '2025'], ['2025', '2025']]) {
    const context = { periodFilter: { type: 'month', year: input },
      document: { getElementById: () => ({ options: [{ value: '2025' }, { value: '2026' }] }) },
      togglePeriodInputs() {}, saveUIState() {}, renderAll() {} };
    vm.runInNewContext(`${handler}; onPeriodTypeChange('year');`, context);
    assert.equal(context.periodFilter.type, 'year');
    assert.equal(context.periodFilter.year, expected);
  }
});
