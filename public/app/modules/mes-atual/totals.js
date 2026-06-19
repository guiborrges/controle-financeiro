(function initMesAtualTotals(global) {
  'use strict';

  function getEffectiveOutflowAmount(item) {
    if (typeof global.getUnifiedEffectiveOutflowAmount === 'function') {
      return Math.max(0, Number(global.getUnifiedEffectiveOutflowAmount(item) || 0) || 0);
    }
    if (typeof global.OutflowAmounts?.getEffectiveOutflowAmount === 'function') {
      return Math.max(0, Number(global.OutflowAmounts.getEffectiveOutflowAmount(item) || 0) || 0);
    }
    return Math.max(0, Number(item?.amount || 0) || 0);
  }

  function getUnifiedRecurringSpendPlannedTotal(month) {
    return (month?.outflows || []).reduce((acc, item) => {
      if (String(item?.type || '').toLowerCase() !== 'spend') return acc;
      if (item?.recurringSpend !== true) return acc;
      if (item?.outputKind !== 'card') return acc;
      return acc + getEffectiveOutflowAmount(item);
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

