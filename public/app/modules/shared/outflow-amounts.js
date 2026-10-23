(function initOutflowAmounts(global) {
  'use strict';

  function clampCurrency(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    return Math.max(0, amount);
  }

  function getOwnerParticipantAmount(item) {
    const rows = Array.isArray(item?.sharedParticipants) ? item.sharedParticipants : [];
    const ownerRow = rows.find(row => row?.isOwner === true);
    if (!ownerRow) return null;
    return clampCurrency(ownerRow.amount);
  }

  function getSharedOwnerAmount(item) {
    if (!item || item.sharedExpense !== true) return null;

    const explicitOwnerAmount = clampCurrency(item?.sharedOwnerAmount);
    if (explicitOwnerAmount > 0) return explicitOwnerAmount;

    const ownerParticipantAmount = getOwnerParticipantAmount(item);
    if (ownerParticipantAmount !== null) return ownerParticipantAmount;

    const sharedOriginalAmount = clampCurrency(item?.sharedOriginalAmount ?? item?.amount ?? item?.valor);
    const sharedOthersAmount = clampCurrency(item?.sharedOthersAmount);
    if (sharedOriginalAmount > 0) {
      return Math.max(0, sharedOriginalAmount - sharedOthersAmount);
    }

    return 0;
  }

  function getEffectiveOutflowAmount(item) {
    const sharedOwnerAmount = getSharedOwnerAmount(item);
    if (sharedOwnerAmount !== null) return sharedOwnerAmount;
    return clampCurrency(item?.amount ?? item?.valor);
  }

  function getEffectiveCardBillAmount(bill, { nanAsZero = false } = {}) {
    const nonNegative = value => {
      const number = Number(value || 0);
      return Math.max(0, nanAsZero ? number || 0 : number);
    };
    const rawAmount = nonNegative(bill?.amount);
    const source = String(bill?.source || '').toLowerCase();
    if (bill?.manualAmountSet === true || (source !== 'forecast' && rawAmount > 0)) {
      return rawAmount;
    }
    return nonNegative(bill?.forecastAmount);
  }

  const api = {
    getEffectiveCardBillAmount,
    clampCurrency,
    getSharedOwnerAmount,
    getEffectiveOutflowAmount
  };

  global.OutflowAmounts = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

