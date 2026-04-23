(function initMesAtualCardBill(global) {
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

  function getUnifiedCardBillEffectiveAmount(month, bill) {
    const rawAmount = Math.max(0, Number(bill?.amount || 0) || 0);
    if (!bill) return rawAmount;
    if (bill?.manualAmountSet === true) return rawAmount;
    if (rawAmount > 0) return rawAmount;
    const forecast = getUnifiedCardRecurringForecastAmount(month, bill?.cardId);
    return Math.max(0, Number(forecast || 0) || 0);
  }

  function getUnifiedCardLaunchesAmount(month, cardId) {
    ensureMonth(month);
    return (month?.outflows || []).reduce((acc, item) => {
      if (item?.outputKind !== 'card' || item?.outputRef !== cardId) return acc;
      return acc + Number(item?.amount || 0);
    }, 0);
  }

  global.MesAtualCardBill = {
    getUnifiedCardBill,
    getUnifiedCardRecurringForecastAmount,
    getUnifiedCardBillEffectiveAmount,
    getUnifiedCardLaunchesAmount
  };
})(window);
