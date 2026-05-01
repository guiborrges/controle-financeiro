(function initMesAtualTotals(global) {
  'use strict';

  function getUnifiedRecurringSpendPlannedTotal(month) {
    if (typeof global.ensureUnifiedOutflowPilotMonth === 'function') {
      global.ensureUnifiedOutflowPilotMonth(month);
    }
    const isRecurring = (item) => {
      if (typeof global.isUnifiedLaunchRecurring === 'function') {
        return global.isUnifiedLaunchRecurring(item);
      }
      return item?.recurringSpend === true || item?.expenseRecurring === true;
    };
    const isSpend = (item) => {
      if (typeof global.isUnifiedLaunchOfType === 'function') {
        return global.isUnifiedLaunchOfType(item, 'spend');
      }
      return String(item?.type || '').toLowerCase() === 'spend';
    };
    return (month?.outflows || []).reduce((acc, item) => {
      if (!isSpend(item)) return acc;
      if (!isRecurring(item)) return acc;
      if (item?.outputKind !== 'card') return acc;
      return acc + Number(item?.amount || 0);
    }, 0);
  }

  function calculateUnifiedPlannedExpenses(parts = {}) {
    return Number(parts.fixedPlannedTotal || 0)
      + Number(parts.totalGoals || 0)
      + Number(parts.dailyGoalTarget || 0);
  }

  global.MesAtualTotals = {
    getUnifiedRecurringSpendPlannedTotal,
    calculateUnifiedPlannedExpenses
  };
})(window);

