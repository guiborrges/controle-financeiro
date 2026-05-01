const test = require('node:test');
const assert = require('node:assert/strict');

const calendarUtils = require('../public/app/modules/calendar-utils.js');

function createMonth(id, nome, outflows = []) {
  return { id, nome, outflows, renda: [], projetos: [], cardBills: [], outflowCards: [] };
}

test('calendar uses global real dates across months for day totals', () => {
  const april = createMonth('m-apr', 'ABRIL 2026');
  const may = createMonth('m-may', 'MAIO 2026', [
    {
      id: 'of-1',
      type: 'spend',
      description: 'Compra no cartão lançada em maio com data real abril',
      date: '29/04/26',
      amount: 120,
      outputKind: 'card',
      outputRef: 'xp'
    }
  ]);

  global.getAllFinanceMonths = () => [april, may];
  global.getMonthDateFromMonthObject = (month) => {
    if (month?.id === 'm-apr') return new Date(2026, 3, 1);
    if (month?.id === 'm-may') return new Date(2026, 4, 1);
    return new Date(2026, 3, 1);
  };
  global.normalizeVarDate = (value) => String(value || '').trim();
  global.OutflowAmounts = { getEffectiveOutflowAmount: (item) => Number(item?.amount || 0) };

  const byDay = calendarUtils.getVariableOutflowsByDay(april);
  assert.equal(byDay[29], 120);
});

test('calendar day ledger includes cross-month launches by real date', () => {
  const april = createMonth('m-apr', 'ABRIL 2026');
  const may = createMonth('m-may', 'MAIO 2026', [
    {
      id: 'of-2',
      type: 'spend',
      description: 'Gasto abril gravado no mês seguinte',
      date: '30/04/26',
      amount: 45,
      outputKind: 'card',
      outputRef: 'xp'
    }
  ]);

  global.getAllFinanceMonths = () => [april, may];
  global.getMonthDateFromMonthObject = (month) => {
    if (month?.id === 'm-apr') return new Date(2026, 3, 1);
    if (month?.id === 'm-may') return new Date(2026, 4, 1);
    return new Date(2026, 3, 1);
  };
  global.normalizeVarDate = (value) => String(value || '').trim();
  global.OutflowAmounts = { getEffectiveOutflowAmount: (item) => Number(item?.amount || 0) };

  const ledger = calendarUtils.getDayLedger(april, 30);
  assert.equal(ledger.outflows, 45);
  assert.equal(ledger.launches.length, 1);
});
