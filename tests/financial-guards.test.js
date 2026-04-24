const test = require('node:test');
const assert = require('node:assert/strict');

const FinancialGuards = require('../public/app/modules/shared/financial-guards.js');

test('all-view total ignores card bill and keeps card launches when bill exists in same view', () => {
  const rows = [
    { kind: 'bill', item: { amount: 500, cardId: 'card_x' } },
    { kind: 'outflow', item: { amount: 120, outputKind: 'card', outputRef: 'card_x' } },
    { kind: 'outflow', item: { amount: 80, outputKind: 'method' } }
  ];
  assert.equal(FinancialGuards.getAllViewTotalWithoutCardDuplication(rows), 200);
});

test('all-view total includes card launches when bill is not visible in filtered rows', () => {
  const rows = [
    { kind: 'outflow', item: { amount: 120, outputKind: 'card', outputRef: 'card_x' } },
    { kind: 'outflow', item: { amount: 45, outputKind: 'card', outputRef: 'card_x' } },
    { kind: 'outflow', item: { amount: 80, outputKind: 'method' } }
  ];
  assert.equal(FinancialGuards.getAllViewTotalWithoutCardDuplication(rows), 245);
});

test('all-view ignores every card bill and keeps launch rows as source of truth', () => {
  const rows = [
    { kind: 'bill', item: { amount: 500, cardId: 'card_x' } },
    { kind: 'outflow', item: { amount: 120, outputKind: 'card', outputRef: 'card_x' } },
    { kind: 'outflow', item: { amount: 90, outputKind: 'card', outputRef: 'card_y' } },
    { kind: 'outflow', item: { amount: 80, outputKind: 'method' } }
  ];
  assert.equal(FinancialGuards.getAllViewTotalWithoutCardDuplication(rows), 290);
});

test('all-view total ignores forecast bill amount to avoid duplicated card data', () => {
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
  assert.equal(FinancialGuards.getAllViewTotalWithoutCardDuplication(rows), 200);
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

test('selected despesas keeps card bill rows when they belong to month expenses', () => {
  const despesas = [
    { valor: 500, categoria: 'CARTAO', entraNaSomatoriaPrincipal: true },
    { valor: 120, categoria: 'MORADIA', entraNaSomatoriaPrincipal: true }
  ];
  const selected = FinancialGuards.getSelectedDespesasRespectingIncludeFlag(despesas, [true, true]);
  assert.equal(selected.length, 2);
  assert.equal(selected.reduce((acc, item) => acc + item.valor, 0), 620);
});
