(function initMesAtualOutflows(global) {
  'use strict';

  function getRowsForRecentList(month, deps = {}) {
    const rows = Array.isArray(month?.outflows) ? month.outflows.slice() : [];
    const parseData = typeof deps.parseData === 'function' ? deps.parseData : (() => 0);
    const isExpenseType = typeof deps.isExpenseType === 'function'
      ? deps.isExpenseType
      : item => item?.type === 'fixed' || item?.type === 'expense';
    return rows.sort((a, b) => {
      const aTail = isExpenseType(a) || a?.recurringSpend === true;
      const bTail = isExpenseType(b) || b?.recurringSpend === true;
      if (aTail !== bTail) return aTail ? 1 : -1;
      const createdDiff = new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
      if (createdDiff !== 0) return createdDiff;
      const dateDiff = parseData(b?.date || '') - parseData(a?.date || '');
      if (dateDiff !== 0) return dateDiff;
      return String(b?.id || '').localeCompare(String(a?.id || ''), 'pt-BR');
    });
  }

  global.MesAtualOutflows = {
    getRowsForRecentList
  };
})(window);
