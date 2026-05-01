(function initMesAtualTotals(global) {
  'use strict';

  function getUnifiedRecurringSpendPlannedTotal(month) {
    if (typeof global.ensureUnifiedOutflowPilotMonth === 'function') {
      global.ensureUnifiedOutflowPilotMonth(month);
    }
    return (month?.outflows || []).reduce((acc, item) => {
      if (item?.type !== 'spend') return acc;
      if (item?.recurringSpend !== true) return acc;
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

