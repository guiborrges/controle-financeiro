;(function initFinancialGuards(globalScope) {
  function getAllViewTotalWithoutCardDuplication(rows = []) {
    return (rows || []).reduce((acc, row) => {
      if (!row || typeof row !== 'object') return acc;
      if (row.kind === 'bill') return acc;
      return acc + Number(row.item?.amount || 0);
    }, 0);
  }

  function getSelectedDespesasRespectingIncludeFlag(despesas = [], selectionState = []) {
    return (despesas || []).filter((item, idx) => {
      const selected = !selectionState || selectionState[idx] !== false;
      return selected && item?.entraNaSomatoriaPrincipal !== false;
    });
  }

  const api = {
    getAllViewTotalWithoutCardDuplication,
    getSelectedDespesasRespectingIncludeFlag
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  globalScope.FinancialGuards = api;
})(typeof window !== 'undefined' ? window : globalThis);
