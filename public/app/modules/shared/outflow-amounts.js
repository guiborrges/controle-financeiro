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

  const api = {
    clampCurrency,
    getSharedOwnerAmount,
    getEffectiveOutflowAmount
  };

  global.OutflowAmounts = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

