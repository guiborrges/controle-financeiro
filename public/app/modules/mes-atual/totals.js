(function initMesAtualTotals(global) {
  'use strict';

  function getUnifiedRecurringSpendPlannedTotal(month) {
    if (typeof global.ensureUnifiedOutflowPilotMonth === 'function') global.ensureUnifiedOutflowPilotMonth(month);
    const isSpend = (item) => typeof global.isUnifiedLaunchOfType === 'function'
      ? global.isUnifiedLaunchOfType(item, 'spend')
      : String(item?.type || '').toLowerCase() === 'spend';
    const isRecurring = (item) => typeof global.isUnifiedLaunchRecurring === 'function'
      ? global.isUnifiedLaunchRecurring(item)
      : item?.recurringSpend === true || item?.expenseRecurring === true;
    return (month?.outflows || []).reduce((acc, item) => {
      if (!isSpend(item) || !isRecurring(item)) return acc;
      if (item?.outputKind !== 'card') return acc;
      return acc + Number(item?.amount || 0);
    }, 0);
  }

  function calculateMonthResult(totalIncome, monthExpense) {
    return Number(totalIncome || 0) - Number(monthExpense || 0);
  }

  function calculateUnifiedPlannedExpenses(parts = {}) {
    return Number(parts.fixedPlannedTotal || 0)
      + Number(parts.totalGoals || 0)
      + Number(parts.dailyGoalTarget || 0);
  }

  const api = {
    getUnifiedRecurringSpendPlannedTotal,
    calculateMonthResult,
    calculateUnifiedPlannedExpenses
  };
  global.MesAtualTotals = api;
  global.MesAtualMonthTotals = api;
})(window);

