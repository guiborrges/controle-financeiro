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

  global.MesAtualTotals = {
    getUnifiedRecurringSpendPlannedTotal
  };
})(window);

