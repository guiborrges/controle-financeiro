(function initMesAtualIncomeRecurrence(global) {
  'use strict';

  function getTargetIncome(incomes, groupId, previousName, sourceName, options = {}) {
    const getGroupId = options.getGroupId || (() => '');
    const normalizeName = options.normalizeName || (value => String(value || '').trim().toUpperCase());
    const expectedGroup = String(groupId || '').trim();
    const previousKey = normalizeName(previousName);
    const sourceKey = normalizeName(sourceName);
    return (incomes || []).find((item) => {
      if (expectedGroup && getGroupId(item) === expectedGroup) return true;
      const itemKey = normalizeName(item?.fonte || '');
      return itemKey && (itemKey === previousKey || itemKey === sourceKey);
    }) || null;
  }

  function cloneRecurringIncome(sourceIncome, groupId) {
    return {
      fonte: String(sourceIncome?.fonte || '').trim(),
      valor: Number(sourceIncome?.valor || 0) || 0,
      paid: false,
      includeInTotals: sourceIncome?.includeInTotals !== false,
      patrimonioMovementId: '',
      dataRecebimento: String(sourceIncome?.dataRecebimento || ''),
      recurringFixed: sourceIncome?.recurringFixed !== false,
      recurringGroupId: String(groupId || '').trim()
    };
  }

  function applyRecurringIncomeChanges(target, sourceIncome, changedFields) {
    if (!target || target.paid === true) return false;
    const fields = Array.isArray(changedFields) ? changedFields : [];
    fields.forEach((field) => {
      if (field !== 'paid' && field !== 'patrimonioMovementId') target[field] = sourceIncome[field];
    });
    return fields.some(field => field !== 'paid' && field !== 'patrimonioMovementId');
  }

  global.MesAtualIncomeRecurrence = { getTargetIncome, cloneRecurringIncome, applyRecurringIncomeChanges };
})(window);
