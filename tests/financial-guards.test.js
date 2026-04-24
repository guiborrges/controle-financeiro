const test = require('node:test');
const assert = require('node:assert/strict');

const FinancialGuards = require('../public/app/modules/shared/financial-guards.js');

test('all-view total ignores card launches when bill exists in same view', () => {
  const rows = [
    { kind: 'bill', item: { amount: 500, cardId: 'card_x' } },
    { kind: 'outflow', item: { amount: 120, outputKind: 'card', outputRef: 'card_x' } },
    { kind: 'outflow', item: { amount: 80, outputKind: 'method' } }
  ];
  assert.equal(FinancialGuards.getAllViewTotalWithoutCardDuplication(rows), 580);
});

test('all-view total includes card launches when bill is not visible in filtered rows', () => {
  const rows = [
    { kind: 'outflow', item: { amount: 120, outputKind: 'card', outputRef: 'card_x' } },
    { kind: 'outflow', item: { amount: 45, outputKind: 'card', outputRef: 'card_x' } },
    { kind: 'outflow', item: { amount: 80, outputKind: 'method' } }
  ];
  assert.equal(FinancialGuards.getAllViewTotalWithoutCardDuplication(rows), 245);
});

test('all-view deduplication happens per card id and keeps other card launches', () => {
  const rows = [
    { kind: 'bill', item: { amount: 500, cardId: 'card_x' } },
    { kind: 'outflow', item: { amount: 120, outputKind: 'card', outputRef: 'card_x' } },
    { kind: 'outflow', item: { amount: 90, outputKind: 'card', outputRef: 'card_y' } },
    { kind: 'outflow', item: { amount: 80, outputKind: 'method' } }
  ];
  assert.equal(FinancialGuards.getAllViewTotalWithoutCardDuplication(rows), 670);
});

test('all-view total uses forecast amount without duplicating card launches', () => {
  const rows = [
    { kind: 'bill', item: { amount: 0, forecastAmount: 120, manualAmountSet: false, source: 'forecast', cardId: 'card_x' } },
    { kind: 'outflow', item: { amount: 120, outputKind: 'card', outputRef: 'card_x' } },
    { kind: 'outflow', item: { amount: 80, outputKind: 'method' } }
  ];
  assert.equal(FinancialGuards.getAllViewTotalWithoutCardDuplication(rows), 200);
});

test('all-view total keeps manual zero as authoritative', () => {
  const rows = [
    { kind: 'bill', item: { amount: 0, forecastAmount: 120, manualAmountSet: true, source: 'manual', cardId: 'card_x' } },
    { kind: 'outflow', item: { amount: 120, outputKind: 'card', outputRef: 'card_x' } },
    { kind: 'outflow', item: { amount: 80, outputKind: 'method' } }
  ];
  assert.equal(FinancialGuards.getAllViewTotalWithoutCardDuplication(rows), 80);
});

test('selected despesas respect include flag and checkbox selection', () => {
  const despesas = [
    { valor: 100, entraNaSomatoriaPrincipal: true },
    { valor: 80, entraNaSomatoriaPrincipal: false },
    { valor: 30 }
  ];
  const selection = [true, true, false];
  const selected = FinancialGuards.getSelectedDespesasRespectingIncludeFlag(despesas, selection);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].valor, 100);
});
