(function initMesAtualCards(global) {
  'use strict';

  function ensureMonth(month) {
    if (typeof global.ensureUnifiedOutflowPilotMonth === 'function') {
      global.ensureUnifiedOutflowPilotMonth(month);
    }
  }

  function getUnifiedCardBill(month, cardId) {
    ensureMonth(month);
    return (month?.cardBills || []).find(bill => bill?.cardId === cardId) || null;
  }

  function getUnifiedCardRecurringForecastAmount(month, cardId) {
    ensureMonth(month);
    return (month?.outflows || []).reduce((acc, item) => {
      if (item?.outputKind !== 'card' || item?.outputRef !== cardId) return acc;
      if (item?.recurringSpend !== true) return acc;
      return acc + Number(item?.amount || 0);
    }, 0);
  }

  function getUnifiedCardLaunchesAmount(month, cardId) {
    ensureMonth(month);
    return (month?.outflows || []).reduce((acc, item) => {
      if (item?.outputKind !== 'card' || item?.outputRef !== cardId) return acc;
      return acc + Number(item?.amount || 0);
    }, 0);
  }

  global.MesAtualCards = {
    getUnifiedCardBill,
    getUnifiedCardRecurringForecastAmount,
    getUnifiedCardLaunchesAmount
  };
})(window);

