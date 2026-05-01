const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadCalendarEventsContext() {
  const amountsPath = path.resolve(__dirname, '../public/app/modules/shared/outflow-amounts.js');
  const eventsPath = path.resolve(__dirname, '../public/app/modules/calendar-events.js');
  const amountsCode = fs.readFileSync(amountsPath, 'utf8');
  const eventsCode = fs.readFileSync(eventsPath, 'utf8');

  const context = {
    window: {},
    normalizeVarDate: (v) => String(v || ''),
    parseData: () => 0
  };
  context.window = context;
  context.globalThis = context;
  context.FinanceCalendarUtils = {
    parseDateFromVarDate(value) {
      const parts = String(value || '').split('/');
      if (parts.length !== 3) return null;
      const d = Number(parts[0] || 0);
      const m = Number(parts[1] || 0);
      const y = Number(parts[2] || 0);
      if (!d || !m) return null;
      const fullYear = y < 100 ? 2000 + y : y;
      const date = new Date(fullYear, m - 1, d);
      return Number.isNaN(date.getTime()) ? null : date;
    },
    parseDateInputToDate(value) {
      const [y, m, d] = String(value || '').split('-').map(Number);
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d);
    },
    dateToKey(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },
    getAllMonthsData() {
      return context.__months || [];
    }
  };

  vm.createContext(context);
  vm.runInContext(amountsCode, context, { filename: amountsPath });
  vm.runInContext(eventsCode, context, { filename: eventsPath });
  return context;
}

test('calendar event spent value uses owner share for shared outflows', () => {
  const ctx = loadCalendarEventsContext();
  ctx.__months = [{
    nome: 'ABRIL 2026',
    outflows: [
      {
        id: 'a',
        date: '10/04/26',
        tag: 'viagem',
        sharedExpense: true,
        amount: 300,
        sharedParticipants: [
          { isOwner: true, amount: 120 },
          { isOwner: false, amount: 180 }
        ]
      },
      {
        id: 'b',
        date: '11/04/26',
        tag: 'viagem',
        amount: 80
      }
    ],
    gastosVar: []
  }];

  const month = ctx.__months[0];
  const event = {
    id: 'evt1',
    name: 'Viagem',
    startDate: '2026-04-10',
    endDate: '2026-04-12',
    tagId: 'viagem'
  };

  const total = ctx.FinanceCalendarEvents.getEventSpentValue(month, event);
  assert.equal(total, 200);
});
