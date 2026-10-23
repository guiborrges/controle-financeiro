(function initMesAtualCards(global) {
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

  function getUnifiedCardBill(month, cardId) {
    return (month?.cardBills || []).find(bill => bill?.cardId === cardId) || null;
  }

  function getUnifiedCardRecurringForecastAmount(month, cardId) {
    return (month?.outflows || []).reduce((acc, item) => {
      if (item?.outputKind !== 'card' || item?.outputRef !== cardId) return acc;
      if (item?.recurringSpend !== true) return acc;
      return acc + getEffectiveOutflowAmount(item);
    }, 0);
  }

  function getUnifiedCardBillEffectiveAmount(month, bill) {
    return global.OutflowAmounts.getEffectiveCardBillAmount(bill, { nanAsZero: true });
  }

  function getUnifiedCardLaunchesAmount(month, cardId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (month?.outflows || []).reduce((acc, item) => {
      if (item?.outputKind !== 'card' || item?.outputRef !== cardId) return acc;
      const rawDate = String(item?.date || item?.data || '').trim();
      const parsed = rawDate
        ? (typeof global.parseData === 'function' ? global.parseData(rawDate) : Date.parse(rawDate))
        : 0;
      if (parsed) {
        const itemDate = new Date(parsed);
        itemDate.setHours(0, 0, 0, 0);
        if (itemDate > today) return acc;
      }
      return acc + getEffectiveOutflowAmount(item);
    }, 0);
  }

  const api = {
    getUnifiedCardBill,
    getUnifiedCardRecurringForecastAmount,
    getUnifiedCardBillEffectiveAmount,
    getUnifiedCardLaunchesAmount
  };
  global.MesAtualCards = api;
  global.MesAtualCardBill = api;
})(window);

