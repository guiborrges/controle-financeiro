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

test('cards module computes recurring forecast and effective amount', () => {
  const win = runModule('../public/app/modules/mes-atual/cards.js');
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

test('cards module uses only owner share for shared card launches', () => {
  const win = runModule('../public/app/modules/mes-atual/cards.js', {
    window: {
      getUnifiedEffectiveOutflowAmount: item => item.ownerShare
    }
  });
  const month = {
    outflows: [
      {
        outputKind: 'card',
        outputRef: 'c1',
        recurringSpend: true,
        amount: 120,
        ownerShare: 40
      }
    ]
  };
  assert.equal(win.MesAtualCards.getUnifiedCardRecurringForecastAmount(month, 'c1'), 40);
  assert.equal(win.MesAtualCards.getUnifiedCardLaunchesAmount(month, 'c1'), 40);
});

test('totals module returns recurring card spend planned total', () => {
  const win = runModule('../public/app/modules/mes-atual/totals.js');
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

test('totals module uses owner share for shared recurring card spend', () => {
  const win = runModule('../public/app/modules/mes-atual/totals.js', {
    window: {
      getUnifiedEffectiveOutflowAmount: item => item.ownerShare
    }
  });
  const total = win.MesAtualTotals.getUnifiedRecurringSpendPlannedTotal({
    outflows: [
      {
        type: 'spend',
        recurringSpend: true,
        outputKind: 'card',
        amount: 150,
        ownerShare: 50
      }
    ]
  });
  assert.equal(total, 50);
});

test('planned expenses excludes card bills and includes goals/daily target', () => {
  const win = runModule('../public/app/modules/mes-atual/totals.js');
  const planned = win.MesAtualMonthTotals.calculateUnifiedPlannedExpenses({
    fixedPlannedTotal: 500,
    recurringSpendPlannedTotal: 300,
    totalGoals: 1000,
    dailyGoalTarget: 200,
    cardBillsTotal: 700
  });
  assert.equal(planned, 1700);
});

test('recurrence module blocks propagation to months before current month', () => {
  const win = runModule('../public/app/modules/mes-atual/recurrence.js', {
    window: {
      getCurrentRealMonthId: () => 'junho_2026',
      getAllFinanceMonths: () => [
        { id: 'maio_2026', order: 5 },
        { id: 'junho_2026', order: 6 },
        { id: 'julho_2026', order: 7 }
      ],
      getMonthSortValue: (month) => month.order
    }
  });
  assert.equal(win.MesAtualRecurrence.canPropagateRecurringFromMonth({ order: 5 }), false);
  assert.equal(win.MesAtualRecurrence.canPropagateRecurringFromMonth({ order: 6 }), true);
  assert.equal(win.MesAtualRecurrence.canPropagateRecurringFromMonth({ order: 7 }), true);
});

test('canonical month modules load before the month controller', () => {
  const indexSource = fs.readFileSync(path.join(__dirname, '../public/app/index.html'), 'utf8');
  const controllerPosition = indexSource.indexOf('/app-assets/mes-atual.js');
  assert.ok(controllerPosition >= 0, 'mes-atual.js must be loaded');

  [
    '/app-assets/modules/mes-atual/income-dates.js',
    '/app-assets/modules/mes-atual/modals.js',
    '/app-assets/modules/mes-atual/outflow-expense-date.js',
    '/app-assets/modules/mes-atual/outflows.js',
    '/app-assets/modules/mes-atual/recurrence.js',
    '/app-assets/modules/mes-atual/shared-expense.js'
  ].forEach(modulePath => {
    const modulePosition = indexSource.indexOf(modulePath);
    assert.ok(modulePosition >= 0, `${modulePath} must be loaded`);
    assert.ok(modulePosition < controllerPosition, `${modulePath} must load before mes-atual.js`);
  });
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

test('outflows module accepts canonical expense classifier for legacy rows', () => {
  const win = runModule('../public/app/modules/mes-atual/outflows.js');
  const sorted = win.MesAtualOutflows.getRowsForRecentList({
    outflows: [
      { id: 'legacy', expenseRecurring: true, createdAt: '2026-04-13T12:00:00.000Z' },
      { id: 'regular', createdAt: '2026-04-12T12:00:00.000Z' }
    ]
  }, {
    isExpenseType: item => item.expenseRecurring === true
  });
  assert.deepEqual(sorted.map(item => item.id), ['regular', 'legacy']);
});
