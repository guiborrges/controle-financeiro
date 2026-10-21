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

  function repairExistingMonths(months, options = {}) {
    if (!Number.isFinite(options.startSort)) throw new Error('Mes inicial invalido para continuidade de renda.');
    const ordered = (months || []).slice().sort((a, b) => options.getMonthSortValue(a) - options.getMonthSortValue(b));
    let changed = false;
    ordered.forEach((month, index) => {
      if (month._incomeContinuityVersion >= 2) return;
      if (options.getMonthSortValue(month) >= options.startSort && index > 0) {
        const previous = ordered[index - 1];
        if (!Array.isArray(month.renda)) month.renda = [];
        (previous.renda || []).forEach(income => {
          if (!income || income.recurringFixed === false || !String(income.fonte || '').trim()) return;
          const groupId = options.getGroupId(income);
          if (getTargetIncome(month.renda, groupId, income.fonte, income.fonte, options)) return;
          const clone = cloneRecurringIncome(income, groupId);
          if (options.getReceiveDay) clone.dataRecebimento = options.getReceiveDay(income.dataRecebimento) || '';
          month.renda.push(clone);
        });
      }
      month._incomeContinuityVersion = 2;
      changed = true;
    });
    return changed;
  }

  global.MesAtualIncomeRecurrence = { getTargetIncome, cloneRecurringIncome, applyRecurringIncomeChanges, repairExistingMonths };
})(window);
