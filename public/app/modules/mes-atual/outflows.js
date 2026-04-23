(function initMesAtualOutflows(global) {
  'use strict';

  function getRowsForRecentList(month, deps = {}) {
    const rows = Array.isArray(month?.outflows) ? month.outflows.slice() : [];
    const parseData = typeof deps.parseData === 'function' ? deps.parseData : (() => 0);
    return rows.sort((a, b) => {
      const aTail = a?.type === 'fixed' || a?.recurringSpend === true;
      const bTail = b?.type === 'fixed' || b?.recurringSpend === true;
      if (aTail !== bTail) return aTail ? 1 : -1;
      const createdDiff = new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
      if (createdDiff !== 0) return createdDiff;
      const dateDiff = parseData(b?.date || '') - parseData(a?.date || '');
      if (dateDiff !== 0) return dateDiff;
      return String(b?.id || '').localeCompare(String(a?.id || ''), 'pt-BR');
    });
  }

  function buildDraftFromForm(month, deps = {}) {
    if (global.MesAtualModals?.buildUnifiedOutflowDraftFromForm) {
      return global.MesAtualModals.buildUnifiedOutflowDraftFromForm(month, deps);
    }
    return {};
  }

  function applyDraftToForm(month, draft, deps = {}) {
    if (global.MesAtualModals?.applyUnifiedOutflowDraftToForm) {
      return global.MesAtualModals.applyUnifiedOutflowDraftToForm(month, draft, deps);
    }
    return false;
  }

  global.MesAtualOutflows = {
    getRowsForRecentList,
    buildDraftFromForm,
    applyDraftToForm
  };
})(window);
