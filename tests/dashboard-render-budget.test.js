const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { dashboardFixture } = require('./helpers/dashboard-render-fixture');
const { loadBrowser } = require('./helpers/refactor-fixtures');

for (const [months, expected] of [
  [1, '72e22bfb87ef92862bdfd3db1a9ae4bf4b1aa12eead0839428f01dd852184f82'],
  [12, '6132b7b702a3314d394a9226101fd97b5b0cfa8d3e89c2da37be7dbecfad1cde'],
  [36, '5736cf43bc9bb520e0cd122bb7654d45a164bbbad01d8294459ad64349fbd44a']
]) {
  test(`Dashboard preserves original cards, insights, categories and chart data for ${months} months`, () => {
    const f = dashboardFixture(months);
    const before = JSON.stringify(f.ctx.data);
    f.ctx.renderDashboard();
    assert.equal(crypto.createHash('sha256').update(JSON.stringify(f.snapshot())).digest('hex'), expected);
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
