const test = require('node:test');
const assert = require('node:assert/strict');
const calendar = require('../public/app/modules/continuous-calendar');
const { getProjectedCalendarMonth } = require('../server/calendar-projection');
const { monthAt } = require('./helpers/refactor-fixtures');
const { browserProjectionAdapter } = require('./helpers/projection-adapters');

function project(collection, payload, source = monthAt(2026, 0), target = monthAt(2026, 1)) {
  const ctx = browserProjectionAdapter();
  const from = Number(source.id.split('_')[1]) * 12 + new Date(ctx.getMonthDateFromMonthObject(source)).getMonth();
  const offset = ctx.getMonthSortValue(target) - ctx.getMonthSortValue(source);
  const state = { finData: [], finCalendarModel: { version: calendar.VERSION, start: from,
    settings: [], rules: [{ id: `${collection}:series`, collection, key: 'series',
      versions: [{ from, sourceMonth: source.id, payload }] }] } };
  const before = JSON.stringify(state);
  const browser = ctx.getContinuousCalendarOptions().occurrence(collection, payload, target, source, offset);
  const server = getProjectedCalendarMonth(state, target.id)[collection][0];
  assert.equal(JSON.stringify(state), before);
  return { browser, server };
}

for (const [value, browserDate, serverDate] of [
  ['31', '31', '31'], ['31/01/26', '28/02/26', '31/01/26']
]) {
  test(`income adapters retain their existing date policy for ${value}`, () => {
    const { browser, server } = project('renda', { fonte: 'Renda ficticia', valor: 100,
      dataRecebimento: value, recurringGroupId: 'series', paid: true, includeInTotals: false,
      patrimonioMovementId: 'old' });
    assert.equal(browser.dataRecebimento, browserDate);
    assert.equal(server.dataRecebimento, serverDate);
    for (const result of [browser, server]) {
      assert.equal(result.paid, false);
      assert.equal(result.patrimonioMovementId, '');
      assert.equal(result.valor, 100);
      assert.equal(result.includeInTotals, false);
    }
  });
}

test('project adapters retain explicit date policy and advance the same installment', () => {
  const { browser, server } = project('projetos', { nome: 'Projeto ficticio', valor: 90,
    dataRecebimento: '31/01/26', recurringExtra: true, recurringGroupId: 'series',
    recurringInstallmentsTotal: 3, recurringInstallmentIndex: 1, paid: true });
  assert.equal(browser.dataRecebimento, '31/01/26');
  assert.equal(server.dataRecebimento, '28/02/26');
  for (const result of [browser, server]) {
    assert.equal(result.recurringInstallmentIndex, 2);
    assert.equal(result.paid, false);
    assert.equal(result.valor, 90);
  }
});

test('card installment adapters keep their closing-day versus original-date policies', () => {
  const source = monthAt(2026, 0);
  source.outflowCards = [{ id: 'c', closingDay: 20 }];
  const { browser, server } = project('outflows', { description: 'Parcela ficticia', amount: 30,
    outputKind: 'card', outputRef: 'c', date: '10/01/26', installmentsGroupId: 'series',
    installmentsTotal: 3, installmentIndex: 1 }, source);
  assert.equal(browser.date, '20/02/26');
  assert.equal(server.date, '10/02/26');
  assert.equal(browser.installmentIndex, 2);
  assert.equal(server.installmentIndex, 2);
});

for (const [sourceIndex, targetYear, targetIndex, date, expected] of [
  [9, 2026, 10, '10/11/26', '10/12/26'],
  [0, 2026, 2, '15/12/25', '15/02/26'],
  [11, 2028, 1, '29/02/28', '29/04/29']
]) {
  test(`dated expense adapters preserve source offset: ${date} -> ${expected}`, () => {
    const { browser, server } = project('outflows', { description: 'Conta ficticia', amount: 80,
      expenseRecurring: true, recurringGroupId: 'series', date, outputKind: 'method', outputMethod: 'boleto' },
    monthAt(2026, sourceIndex), monthAt(targetYear, targetIndex));
    assert.equal(browser.date, expected);
    assert.equal(server.date, expected);
  });
}

test('card date adapters share 216 valid offset and month-end projections without mutating settings', () => {
  const ctx = browserProjectionAdapter();
  let cases = 0;
  for (const year of [2026, 2028]) for (const index of [0, 1, 11]) {
    for (const lag of [-1, 0, 1]) for (const requestedDay of [1, 28, 31]) {
      for (const offset of [1, 2, 14, 25]) {
        const source = monthAt(year, index);
        const original = new Date(year, index + lag, 1);
        const day = Math.min(requestedDay, new Date(original.getFullYear(), original.getMonth() + 1, 0).getDate());
        const format = (d, y, m) => `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${String(y).slice(-2)}`;
        const value = format(day, original.getFullYear(), original.getMonth());
        const destination = new Date(year, index + offset, 1);
        const target = monthAt(destination.getFullYear(), destination.getMonth());
        const expectedMonth = new Date(year, index + offset + lag, 1);
        const expectedDay = Math.min(day, new Date(expectedMonth.getFullYear(), expectedMonth.getMonth() + 1, 0).getDate());
        const expected = format(expectedDay, expectedMonth.getFullYear(), expectedMonth.getMonth());
        const state = { finData: [], finCalendarModel: { version: calendar.VERSION,
          start: year * 12 + index, rules: [], settings: [{ from: year * 12 + index, cardsSourceMonth: source.id,
            payload: { outflowCards: [{ id: 'c', closingDate: value, paymentDate: value }] } }] } };
        const before = JSON.stringify(state);
        assert.equal(ctx.getUnifiedCardDateForMonth(value, source, target), expected);
        const card = getProjectedCalendarMonth(state, target.id).outflowCards[0];
        assert.equal(card.closingDate, expected);
        assert.equal(card.paymentDate, expected);
        assert.equal(JSON.stringify(state), before);
        cases++;
      }
    }
  }
  assert.equal(cases, 216);
});

test('raw single-outflow index and payment cleanup differences stay explicit adapter policies', () => {
  const { browser, server } = project('outflows', { description: 'Conta ficticia', amount: 80,
    expenseRecurring: true, recurringGroupId: 'series', installmentsTotal: 1, installmentIndex: 5,
    date: '10/01/26', paid: true, sharedExpense: true,
    sharedParticipants: [{ id: 'p', isOwner: true, amount: 80, paid: true }] });
  assert.equal(browser.installmentIndex, 1);
  assert.equal(server.installmentIndex, 5);
  assert.equal(browser.sharedParticipants[0].paid, false);
  assert.equal(server.sharedParticipants[0].paid, true);
  assert.equal(browser.paid, false);
  assert.equal(server.paid, false);
});
