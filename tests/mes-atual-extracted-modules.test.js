const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function runModule(relativePath, context = {}) {
  const filePath = path.resolve(__dirname, relativePath);
  const code = fs.readFileSync(filePath, 'utf8');
  const runtime = { window: {}, ...context };
  if (!runtime.window) runtime.window = {};
  vm.createContext(runtime);
  vm.runInContext(code, runtime, { filename: filePath });
  return runtime.window;
}

test('shared-expense module computes owner/others shares', () => {
  const win = runModule('../public/app/modules/mes-atual/shared-expense.js');
  const result = win.MesAtualSharedExpense.getUnifiedSharedComputedValues(120, 3, 'equal', []);
  assert.equal(Number(result.ownerShare.toFixed(2)), 40);
  assert.equal(Number(result.othersShare.toFixed(2)), 80);
});

test('card-bill module computes recurring forecast and effective amount', () => {
  const win = runModule('../public/app/modules/mes-atual/card-bill.js');
  const month = {
    outflows: [
      { outputKind: 'card', outputRef: 'c1', recurringSpend: true, amount: 30 },
      { outputKind: 'card', outputRef: 'c1', recurringSpend: true, amount: 20 },
      { outputKind: 'card', outputRef: 'c1', recurringSpend: false, amount: 999 }
    ]
  };
  const forecast = win.MesAtualCardBill.getUnifiedCardRecurringForecastAmount(month, 'c1');
  assert.equal(forecast, 50);
  const effective = win.MesAtualCardBill.getUnifiedCardBillEffectiveAmount(month, {
    cardId: 'c1',
    amount: 0,
    manualAmountSet: false
  });
  assert.equal(effective, 50);
});

test('month-totals module returns recurring card spend planned total', () => {
  const win = runModule('../public/app/modules/mes-atual/month-totals.js');
  const month = {
    outflows: [
      { type: 'spend', recurringSpend: true, outputKind: 'card', amount: 10 },
      { type: 'spend', recurringSpend: true, outputKind: 'method', amount: 10 },
      { type: 'fixed', recurringSpend: true, outputKind: 'card', amount: 10 }
    ]
  };
  const total = win.MesAtualMonthTotals.getUnifiedRecurringSpendPlannedTotal(month);
  assert.equal(total, 10);
  assert.equal(win.MesAtualMonthTotals.calculateMonthResult(100, 20), 80);
});

test('outflow-filters module delegates to global filter functions', () => {
  const calls = [];
  const win = runModule('../public/app/modules/mes-atual/outflow-filters.js', {
    window: {
      getUnifiedFilterRows: (...args) => {
        calls.push(['rows', ...args]);
        return [{ kind: 'outflow', item: { id: 'x' } }];
      },
      getSortedUnifiedRows: (...args) => {
        calls.push(['sorted', ...args]);
        return [{ kind: 'outflow', item: { id: 'y' } }];
      }
    }
  });
  const rows = win.MesAtualOutflowFilters.getRows({ id: 'm' }, 'all', '', '');
  const sorted = win.MesAtualOutflowFilters.getSortedRows({ id: 'm' }, rows);
  assert.equal(rows.length, 1);
  assert.equal(sorted.length, 1);
  assert.equal(calls.length, 2);
});

test('outflows module delegates draft build/apply to modals module', () => {
  const win = runModule('../public/app/modules/mes-atual/outflows.js', {
    window: {
      MesAtualModals: {
        buildUnifiedOutflowDraftFromForm: () => ({ ok: true }),
        applyUnifiedOutflowDraftToForm: () => true
      }
    }
  });
  const draft = win.MesAtualOutflows.buildDraftFromForm({}, {});
  const applied = win.MesAtualOutflows.applyDraftToForm({}, {}, {});
  assert.equal(draft.ok, true);
  assert.equal(applied, true);
});

test('outflows module sorts recent rows with fixed/recurring items at tail', () => {
  const win = runModule('../public/app/modules/mes-atual/outflows.js');
  const month = {
    outflows: [
      { id: '3', type: 'fixed', recurringSpend: false, createdAt: '2026-04-10T12:00:00.000Z', date: '10/04/26' },
      { id: '1', type: 'spend', recurringSpend: false, createdAt: '2026-04-11T12:00:00.000Z', date: '11/04/26' },
      { id: '2', type: 'spend', recurringSpend: false, createdAt: '2026-04-12T12:00:00.000Z', date: '12/04/26' }
    ]
  };
  const sorted = win.MesAtualOutflows.getRowsForRecentList(month, {
    parseData(value) {
      const [day, monthPart, year] = String(value || '').split('/').map(Number);
      return new Date(2000 + year, monthPart - 1, day).getTime();
    }
  });
  assert.deepEqual(sorted.map(item => item.id), ['2', '1', '3']);
});
