;(function initFinancialGuards(globalScope) {
  function getAllViewTotalWithoutCardDuplication(rows = []) {
    const billCardIds = new Set(
      (rows || [])
        .filter(row => row?.kind === 'bill')
        .map(row => String(row?.item?.cardId || '').trim())
        .filter(Boolean)
    );
    return (rows || []).reduce((acc, row) => {
      if (!row || typeof row !== 'object') return acc;
      if (row.kind === 'bill') return acc + Number(row.item?.amount || 0);
      if (row.kind === 'outflow' && row.item?.outputKind === 'card') {
        const outflowCardId = String(row.item?.outputRef || '').trim();
        if (outflowCardId && billCardIds.has(outflowCardId)) return acc;
      }
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
