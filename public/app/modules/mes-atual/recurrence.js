(function initMesAtualRecurrence(global) {
  'use strict';

  function canPropagateRecurringFromMonth(month) {
    const currentRealMonthId = typeof global.getCurrentRealMonthId === 'function'
      ? global.getCurrentRealMonthId(true)
      : '';
    const monthList = typeof global.getAllFinanceMonths === 'function'
      ? global.getAllFinanceMonths()
      : [];
    const currentRealMonth = (monthList || []).find(entry => entry?.id === currentRealMonthId);
    if (!currentRealMonth) return true;
    if (typeof global.getMonthSortValue !== 'function') return true;
    return global.getMonthSortValue(month) >= global.getMonthSortValue(currentRealMonth);
  }

  global.MesAtualRecurrence = {
    canPropagateRecurringFromMonth
  };
})(window);

