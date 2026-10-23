const test = require('node:test');
const assert = require('node:assert/strict');
const financial = require('../public/app/modules/shared/financial-query');
const { browserSandbox, loadBrowser } = require('./helpers/refactor-fixtures');

// Independent characterization of the two existing coercion policies.
function expectedAmount(bill, nanAsZero) {
  if (!bill) return 0;
  const number = value => nanAsZero ? Number(value || 0) || 0 : Number(value || 0);
  const raw = Math.max(0, number(bill.amount));
  return bill.manualAmountSet === true || (String(bill.source || '').toLowerCase() !== 'forecast' && raw > 0)
    ? raw : Math.max(0, number(bill.forecastAmount));
}

test('bill consumers preserve fixed expected values and the complete coercion matrix', () => {
  const ctx = browserSandbox();
  // Fixed business expectations remain independent of the exhaustive reference formula.
  for (const [name, bill, amount] of [
    ['manual zero', { amount: 0, manualAmountSet: true, forecastAmount: 90 }, 0],
    ['manual nonzero', { amount: 25.35, manualAmountSet: true, source: 'forecast', forecastAmount: 90 }, 25.35],
    ['imported amount', { amount: 25.35, source: 'import', forecastAmount: 90 }, 25.35],
    ['forecast ignores old amount', { amount: 25, source: 'forecast', forecastAmount: 90 }, 90],
    ['missing forecast', { amount: 25, source: 'forecast' }, 0],
    ['negative forecast', { forecastAmount: -20, source: 'forecast' }, 0],
    ['negative manual', { amount: -20, manualAmountSet: true, forecastAmount: 90 }, 0],
    ['numeric string', { amount: '12.34', source: 'import' }, 12.34],
    ['empty bill', {}, 0]
  ]) {
    Object.freeze(bill);
    assert.equal(financial.billAmount(bill), amount, name);
    assert.equal(ctx.MesAtualCards.getUnifiedCardBillEffectiveAmount({}, bill), amount, name);
  }
  const values = [undefined, null, '', 0, -1, 12.345, '12.34', 'invalid', NaN, Infinity, -Infinity];
  let cases = 0;
  for (const amount of values) for (const forecastAmount of values) {
    for (const source of [undefined, 'manual', 'import', 'forecast', 'FORECAST', ' forecast ']) {
      for (const manualAmountSet of [undefined, false, true, 'true']) {
        const bill = Object.freeze({ amount, forecastAmount, source, manualAmountSet });
        assert.equal(financial.billAmount(bill), expectedAmount(bill, false));
        assert.equal(ctx.MesAtualCards.getUnifiedCardBillEffectiveAmount({}, bill), expectedAmount(bill, true));
        cases++;
      }
    }
  }
  assert.equal(cases, 2904);
  for (const bill of [null, undefined]) {
    assert.equal(financial.billAmount(bill), 0);
    assert.equal(ctx.MesAtualCards.getUnifiedCardBillEffectiveAmount({}, bill), 0);
  }
});

test('3A recurring forecast keeps owner share and ignores purchases outside the chosen card', () => {
  const ctx = browserSandbox();
  const month = { outflows: [
    { outputKind: 'card', outputRef: 'a', recurringSpend: true, amount: 100, sharedExpense: true,
      sharedParticipants: [{ isOwner: true, amount: 30 }] },
    { outputKind: 'card', outputRef: 'a', recurringSpend: false, amount: 500 },
    { outputKind: 'card', outputRef: 'b', recurringSpend: true, amount: 800 }
  ], outflowCards: [{ id: 'a' }], cardBills: [] };
  const before = JSON.stringify(month);
  assert.equal(ctx.MesAtualCards.getUnifiedCardRecurringForecastAmount(month, 'a'), 30);
  assert.equal(financial.query(month).expenseCents, 3000);
  assert.equal(JSON.stringify(month), before);
});

test('3A both browser facades delegate to the shared helper with explicit coercion policies', () => {
  const ctx = browserSandbox();
  const bill = { amount: 0, manualAmountSet: true };
  const calls = [];
  ctx.OutflowAmounts.getEffectiveCardBillAmount = (value, options) => {
    calls.push({ value, nanAsZero: options?.nanAsZero });
    return 17;
  };
  assert.equal(ctx.FinancialQuery.billAmount(bill), 17);
  assert.equal(ctx.MesAtualCards.getUnifiedCardBillEffectiveAmount({}, bill), 17);
  assert.equal(calls[0].value, bill);
  assert.equal(calls[0].nanAsZero, undefined);
  assert.equal(calls[1].value, bill);
  assert.equal(calls[1].nanAsZero, true);
});

test('3A currency formatting retains absolute, signed and mobile display contracts', () => {
  const ctx = browserSandbox();
  loadBrowser(ctx, ['modules/shared/formatters.js']);
  for (const [value, absolute, signed, mobile] of [
    [-12.34, 'R$ 12,34', '- R$ 12,34', '- R$ 12,34'],
    [12.34, 'R$ 12,34', '+ R$ 12,34', 'R$ 12,34'],
    [null, 'R$ 0,00', '+ R$ 0,00', 'R$ 0,00'],
    ['invalid', 'R$ 0,00', '+ R$ 0,00', 'R$ 0,00']
  ]) {
    assert.equal(ctx.fmt(value), absolute);
    assert.equal(ctx.fmtSigned(value), signed);
    assert.equal(ctx.MobileV2Data.formatMoney(value), mobile);
  }
});
