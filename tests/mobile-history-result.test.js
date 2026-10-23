const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('mobile history result deducts included financial goals', () => {
  const context = { MobileV2Data: { formatMoney: String, escapeHtml: String,
    getMonthMetrics: () => ({ renda: 100, lancamentos: 50, resultado: 30 }) } };
  context.window = context;
  vm.createContext(context);
  const source = fs.readFileSync(require.resolve('../public/app/modules/mobile-v2/historico-mobile.js'), 'utf8');
  vm.runInContext(source.replace('global.MobileV2Historico = { render }', 'global.MobileV2Historico = { render, summarizeMonth }'), context);
  assert.equal(context.MobileV2Historico.summarizeMonth({ id: 'm' }).result, 30);
});
