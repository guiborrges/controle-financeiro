const test = require('node:test');
const assert = require('node:assert/strict');
const calendar = require('../public/app/modules/continuous-calendar');
const { getProjectedCalendarMonth } = require('../server/calendar-projection');
const { monthAt } = require('./helpers/refactor-fixtures');
const { browserProjectionAdapter: adapters } = require('./helpers/projection-adapters');

for (const [year, sourceIndex, targetYear, targetIndex, sourceDate, expected] of [
  [2026, 0, 2026, 1, '31/01/26', '28/02/26'],
  [2028, 0, 2028, 1, '31/01/28', '29/02/28'],
  [2026, 11, 2027, 0, '31/12/26', '31/01/27'],
  [2026, 0, 2026, 3, '31/01/26', '30/04/26']
]) {
  test(`2A dated outflow adapters clamp ${sourceDate} into ${targetYear}-${targetIndex + 1}`, () => {
    const ctx = adapters();
    const source = monthAt(year, sourceIndex);
    const target = monthAt(targetYear, targetIndex);
    const item = { id: 'seed', recurringGroupId: 'series', description: 'Conta ficticia',
      type: 'expense', category: 'CASA', amount: 80, outputKind: 'method', outputMethod: 'boleto',
      expenseRecurring: true, date: sourceDate, paid: true, patrimonioMovementId: 'old',
      sharedExpense: true, sharedParticipants: [{ id: 'owner', isOwner: true, amount: 80, paid: true }] };
    const before = JSON.stringify(item);
    const offset = (targetYear - year) * 12 + targetIndex - sourceIndex;
    const browser = ctx.getContinuousCalendarOptions().occurrence('outflows', item, target, source, offset);
    const from = year * 12 + sourceIndex;
    const state = { finData: [], finCalendarModel: { version: calendar.VERSION, start: from, settings: [],
      rules: [{ id: 'outflows:series', collection: 'outflows', key: 'series',
        versions: [{ from, sourceMonth: source.id, payload: { ...item, paid: false, patrimonioMovementId: '',
          sharedParticipants: item.sharedParticipants.map(person => ({ ...person, paid: false })) } }] }] } };
    const stateBefore = JSON.stringify(state);
    const server = getProjectedCalendarMonth(state, target.id).outflows[0];
    for (const projected of [browser, server]) {
      assert.equal(projected.date, expected);
      assert.equal(projected.paid, false);
      assert.equal(projected.sharedParticipants[0].paid, false);
      assert.equal(projected.amount, 80);
      assert.equal(projected.recurringGroupId, 'series');
    }
    assert.equal(browser.patrimonioMovementId, undefined);
    assert.equal(server.patrimonioMovementId, '');
    assert.equal(JSON.stringify(item), before);
    assert.equal(JSON.stringify(state), stateBefore);
  });
}

for (const [sourceYear, sourceIndex, targetYear, targetIndex, expectedClosing, expectedPayment] of [
  [2026, 0, 2026, 1, '28/02/26', '10/03/26'],
  [2028, 0, 2028, 1, '29/02/28', '10/03/28'],
  [2026, 11, 2027, 0, '31/01/27', '10/02/27']
]) {
  test(`2A server card settings preserve closing/payment offsets into ${targetYear}-${targetIndex + 1}`, () => {
    const source = monthAt(sourceYear, sourceIndex);
    const nextDate = new Date(sourceYear, sourceIndex + 1, 10);
    const state = { finData: [], finCalendarModel: { version: calendar.VERSION,
      start: sourceYear * 12 + sourceIndex, rules: [], settings: [{ from: sourceYear * 12 + sourceIndex,
        cardsSourceMonth: source.id, payload: { outflowCards: [{ id: 'c', closingDate: `31/${String(sourceIndex + 1).padStart(2, '0')}/${String(sourceYear).slice(-2)}`,
          paymentDate: `10/${String(nextDate.getMonth() + 1).padStart(2, '0')}/${String(nextDate.getFullYear()).slice(-2)}` }] } }] } };
    const before = JSON.stringify(state);
    const card = getProjectedCalendarMonth(state, monthAt(targetYear, targetIndex).id).outflowCards[0];
    assert.equal(card.closingDate, expectedClosing);
    assert.equal(card.paymentDate, expectedPayment);
    assert.equal(JSON.stringify(state), before);
  });
}

test('2A income clone resets receipts and links while preserving inclusion and day semantics', () => {
  const ctx = adapters();
  const source = monthAt(2026, 11);
  const target = monthAt(2027, 0);
  const input = { fonte: 'Renda ficticia', valor: 1234.56, dataRecebimento: '31',
    recurringFixed: true, recurringGroupId: 'income', paid: true, includeInTotals: false,
    patrimonioMovementId: 'old' };
  const output = ctx.getContinuousCalendarOptions().occurrence('renda', input, target, source, 1);
  assert.equal(output.valor, 1234.56);
  assert.equal(output.dataRecebimento, '31');
  assert.equal(output.paid, false);
  assert.equal(output.includeInTotals, false);
  assert.equal(output.patrimonioMovementId, '');
  assert.equal(input.paid, true);
});
