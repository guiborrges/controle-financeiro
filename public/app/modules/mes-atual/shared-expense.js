(function initMesAtualSharedExpense(global) {
  'use strict';

  function getUnifiedSharedComputedValues(totalAmount, peopleCount, mode, peopleRows = []) {
    const safeTotal = Math.max(0, Number(totalAmount || 0) || 0);
    const safeCount = Math.max(1, Math.min(20, Number(peopleCount || 1) || 1));
    const normalizedMode = String(mode || 'equal').toLowerCase() === 'manual' ? 'manual' : 'equal';
    const sanitizedRows = Array.isArray(peopleRows) ? peopleRows : [];

    if (safeCount <= 1) {
      const ownerRow = sanitizedRows.find(row => row?.isOwner === true) || null;
      const ownerShare = Math.max(0, Number(ownerRow?.amount || 0) || 0);
      return {
        ownerShare,
        othersShare: Math.max(0, safeTotal - ownerShare),
        participants: sanitizedRows
      };
    }
    if (normalizedMode === 'equal') {
      const each = safeTotal / safeCount;
      return {
        ownerShare: each,
        othersShare: Math.max(0, safeTotal - each),
        participants: []
      };
    }

    const ownerRow = sanitizedRows.find(row => row?.isOwner === true) || null;
    const ownerShare = Math.max(0, Number(ownerRow?.amount || 0) || 0);
    return {
      ownerShare,
      othersShare: Math.max(0, safeTotal - ownerShare),
      participants: sanitizedRows
    };
  }

  global.MesAtualSharedExpense = {
    getUnifiedSharedComputedValues
  };
})(window);
