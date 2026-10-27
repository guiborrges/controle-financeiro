const test = require('node:test');
const assert = require('node:assert/strict');
const { dashboardFixture } = require('./helpers/dashboard-render-fixture');
const { loadBrowser } = require('./helpers/refactor-fixtures');

for (const months of [1, 12, 36]) {
  test(`Dashboard preserves financial series, goal reserves and render budget for ${months} months`, () => {
    const f = dashboardFixture(months);
    const before = JSON.stringify(f.ctx.data);
    f.ctx.renderDashboard();
    const snapshot = f.snapshot();
    const series = snapshot.charts.lineChart.datasets;
    assert.deepEqual(series.map(item => item.seriesKey), ['resultSimple', 'totalGastos', 'totalGanhos']);
    for (const [index, value] of [1614.33, 1535.67, 3250].entries()) {
      assert.deepEqual(series[index].data, Array(months).fill(value));
    }
    assert.deepEqual(snapshot.charts.resultChart.datasets[0].data, Array(months).fill(1614.33));
    assert.equal(snapshot.charts.lineChart.labels.length, months);
    assert.match(snapshot.metrics, new RegExp(`reservar ${f.ctx.fmt(months * 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} em metas`));
    assert.match(snapshot.categories, /category-ranking/);
    assert.match(snapshot.categories, /category-bar/);
    for (const amount of [1200, 250, 45.67, 40]) {
      assert.ok(snapshot.categories.includes(f.ctx.fmt(amount * months)));
    }
    assert.equal(JSON.stringify(f.ctx.data), before);
    assert.equal(f.calls(), months);
  });
}

test('Dashboard recalculates after edits and filter changes', () => {
  const f = dashboardFixture(12);
  f.ctx.renderDashboard();
  const before = f.snapshot();
  f.ctx.data[0].renda.push({ id: 'fresh', fonte: 'Fresh', valor: 123, include: true });
  f.ctx.renderDashboard();
  assert.equal(f.calls(), 24);
  assert.notDeepEqual(f.snapshot(), before);
  f.ctx.getFilteredData = () => [f.ctx.data[0]];
  f.ctx.renderDashboard();
  assert.equal(f.calls(), 25);
});

test('Dashboard does no financial work when hidden or Mobile is enabled', () => {
  const f = dashboardFixture(12);
  f.elements['page-dashboard'] = { classList: { contains: () => false } };
  f.ctx.renderDashboard();
  assert.equal(f.calls(), 0);
  f.elements['page-dashboard'].classList.contains = () => true;
  f.ctx.window.MobileV2 = { isEnabled: () => true };
  f.ctx.renderDashboard();
  assert.equal(f.calls(), 0);
  f.ctx.window.MobileV2.isEnabled = () => false;
  f.ctx.renderDashboard();
  assert.equal(f.calls(), 12);
});

test('Cached commitments and independent consumption preserve category totals', () => {
  const f = dashboardFixture(12);
  for (const basis of ['commitments', 'consumption']) {
    const expected = f.ctx.getCatTotalsPeriod(f.ctx.data, basis);
    const actual = f.ctx.getCatTotalsPeriod(f.ctx.data, basis, f.ctx.getTotals);
    assert.deepEqual(actual, expected);
  }
});

test('renderAll updates only the active page and retains UI persistence', () => {
  const f = dashboardFixture(1);
  loadBrowser(f.ctx, ['backup.js']);
  let active;
  const calls = [];
  f.ctx.document.querySelector = () => active ? { id: active } : null;
  for (const name of ['renderDashboard', 'renderMes', 'renderPatrimonio', 'renderHistorico', 'renderEso', 'saveUIState']) {
    f.ctx[name] = () => calls.push(name);
  }
  for (const [page, render] of [['dashboard', 'renderDashboard'], ['mes', 'renderMes'],
    ['patrimonio', 'renderPatrimonio'], ['historico', 'renderHistorico'], ['eso', 'renderEso']]) {
    active = `page-${page}`;
    calls.length = 0;
    f.ctx.renderAll();
    assert.deepEqual(calls, [render, 'saveUIState']);
  }
  active = null;
  calls.length = 0;
  f.ctx.renderAll();
  assert.deepEqual(calls, ['saveUIState']);
});
