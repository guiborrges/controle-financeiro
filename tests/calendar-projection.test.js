const test = require('node:test');
const assert = require('node:assert/strict');
const calendar = require('../public/app/modules/continuous-calendar');
const { getProjectedCalendarMonth } = require('../server/calendar-projection');
const { buildWidgetSnapshot } = require('../server/widget-snapshot');

test('server and widget resolve income rules when the current month has no stored rows', () => {
  const now = new Date();
  const names = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const id = `${names[now.getMonth()]}_${now.getFullYear()}`;
  const ordinal = now.getFullYear() * 12 + now.getMonth();
  const state = {
    finData: [],
    finCalendarModel: {
      version: calendar.VERSION, start: ordinal, settings: [],
      rules: [{ id: 'renda:salary', collection: 'renda', key: 'salary', versions: [{ from: ordinal, sourceMonth: id, payload: { fonte: 'Salario', valor: 3200, recurringGroupId: 'salary' } }] }]
    }
  };
  const projected = getProjectedCalendarMonth(state, id);
  assert.equal(projected.renda[0].valor, 3200);
  assert.equal(projected.renda[0].paid, false);
  assert.equal(buildWidgetSnapshot('test-user', state).monthlyIncome, 3200);
  state.finData = [{ id, _calendarSparse: true, _calendarVirtual: true, renda: [], outflows: [], projetos: [], _calendarHidden: { renda: ['salary'] } }];
  assert.equal(buildWidgetSnapshot('test-user', state).monthlyIncome, 0);
});

test('projected card settings retain the source date offset in future months', () => {
  const state = { finData: [], finCalendarModel: {
    version: calendar.VERSION, start: 2026 * 12 + 9, rules: [],
    settings: [{ from: 2026 * 12 + 9, cardsSourceMonth: 'outubro_2026', payload: {
      outflowCards: [{ id: 'xp', closingDate: '31/10/26', paymentDate: '10/11/26' }]
    } }]
  } };
  const month = getProjectedCalendarMonth(state, 'fevereiro_2027');
  assert.equal(month.outflowCards[0].closingDate, '28/02/27');
  assert.equal(month.outflowCards[0].paymentDate, '10/03/27');
});
