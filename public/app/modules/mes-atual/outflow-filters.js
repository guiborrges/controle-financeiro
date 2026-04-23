(function initMesAtualOutflowFilters(global) {
  'use strict';

  function getRows(month, filterValue, tagFilterValue = '', searchValue = '') {
    if (typeof global.getUnifiedFilterRows === 'function') {
      return global.getUnifiedFilterRows(month, filterValue, tagFilterValue, searchValue);
    }
    return [];
  }

  function getSortedRows(month, rows, fallbackField = 'data', fallbackDirection = 'desc') {
    if (typeof global.getSortedUnifiedRows === 'function') {
      return global.getSortedUnifiedRows(month, rows, fallbackField, fallbackDirection);
    }
    return Array.isArray(rows) ? rows.slice() : [];
  }

  global.MesAtualOutflowFilters = {
    getRows,
    getSortedRows
  };
})(window);
