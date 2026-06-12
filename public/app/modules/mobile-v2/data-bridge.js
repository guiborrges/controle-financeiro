(function initMobileV2DataBridge(global) {
  'use strict';

  function escapeHtml(value) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(value) {
    if (typeof global.fmt === 'function') return global.fmt(Number(value || 0));
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function getMonths() {
    if (typeof global.getAllFinanceMonths === 'function') return global.getAllFinanceMonths() || [];
    return Array.isArray(global.data) ? global.data : [];
  }

  function getCurrentMonth() {
    if (typeof global.getCurrentMonth === 'function') {
      const current = global.getCurrentMonth();
      if (current) return current;
    }
    const months = getMonths();
    return months.length ? months[months.length - 1] : null;
  }

  function getTotals(month) {
    return typeof global.getEffectiveTotalsForMes === 'function'
      ? (global.getEffectiveTotalsForMes(month) || {})
      : {};
  }

  function getIncomeTotal(month) {
    return Number(getTotals(month).rendaTotal || 0);
  }

  function getPlanningTotal(month) {
    if (typeof global.calculateUnifiedPlanningTotal === 'function') {
      return Number(global.calculateUnifiedPlanningTotal(month) || 0);
    }
    return Number(getTotals(month).totalGastos || 0);
  }

  function getMonthMetrics(month) {
    const renda = getIncomeTotal(month);
    const lancamentos = getPlanningTotal(month);
    return {
      renda,
      lancamentos,
      despesas: lancamentos,
      resultado: renda - lancamentos
    };
  }

  function categoryIcon(categoryName) {
    const safeCategory = String(categoryName || 'OUTROS');
    if (typeof global.renderSmartIconBadge === 'function' && typeof global.inferCategoryVisual === 'function') {
      const visual = global.inferCategoryVisual(safeCategory);
      return global.renderSmartIconBadge(visual.icon, visual.tone);
    }
    const emoji = typeof global.getCategoryEmoji === 'function' ? global.getCategoryEmoji(safeCategory) : '';
    return escapeHtml(String(emoji || '?'));
  }

  function getOutflowAmount(item) {
    const resolver = global.OutflowAmounts?.getEffectiveOutflowAmount || global.getUnifiedEffectiveOutflowAmount;
    const raw = typeof resolver === 'function'
      ? resolver(item)
      : (item?.amount ?? item?.valor ?? 0);
    return Math.max(0, Number(raw || 0) || 0);
  }

  function getCategoryName(item, fallback = 'OUTROS') {
    if (typeof global.getUnifiedOutflowCategoryName === 'function') {
      return String(global.getUnifiedOutflowCategoryName(item, fallback) || fallback).trim() || fallback;
    }
    const raw = item?.category || item?.categoria || fallback;
    return String(global.resolveCategoryName ? global.resolveCategoryName(raw) : raw).trim() || fallback;
  }

  function getFilterRows(month, filter = 'all') {
    if (typeof global.getUnifiedFilterRows === 'function') {
      return global.getUnifiedFilterRows(month, filter, '', '') || [];
    }
    return (Array.isArray(month?.outflows) ? month.outflows : []).map((item) => ({ kind: 'outflow', item }));
  }

  function getOutflowRows(month) {
    const rows = getFilterRows(month, 'all')
      .filter((row) => row?.kind === 'outflow' && getOutflowAmount(row.item) > 0)
      .map((row) => row.item);
    if (typeof global.getSortedUnifiedRows === 'function') {
      return global.getSortedUnifiedRows(month, rows.map((item) => ({ kind: 'outflow', item })), 'data', 'desc')
        .map((row) => row.item);
    }
    return rows;
  }

  function getSpendCategorySummary(month) {
    if (typeof global.getUnifiedSpendCategorySummary === 'function') {
      return global.getUnifiedSpendCategorySummary(month) || { rows: [] };
    }
    const byCategory = new Map();
    getOutflowRows(month).forEach((item) => {
      const category = getCategoryName(item);
      byCategory.set(category, Number(byCategory.get(category) || 0) + getOutflowAmount(item));
    });
    return {
      rows: Array.from(byCategory.entries())
        .map(([category, total]) => ({ category, total, meta: Number(month?.dailyGoals?.[category] || 0), categoryItems: [] }))
        .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
    };
  }

  function getPatrimonioData() {
    if (typeof global.getPatrimonioFilteredAccounts === 'function') {
      try {
        const accounts = global.getPatrimonioFilteredAccounts();
        const movements = typeof global.getPatrimonioFilteredMovements === 'function'
          ? global.getPatrimonioFilteredMovements()
          : (Array.isArray(global.patrimonioMovements) ? global.patrimonioMovements : []);
        const metrics = typeof global.getPatrimonioMetrics === 'function'
          ? global.getPatrimonioMetrics()
          : null;
        return {
          accounts: Array.isArray(accounts) ? accounts : [],
          movements: Array.isArray(movements) ? movements : [],
          metrics,
          error: ''
        };
      } catch (error) {
        return {
          accounts: [],
          movements: [],
          metrics: null,
          error: error?.message || 'Dados de patrim?nio indispon?veis no momento.'
        };
      }
    }
    if (typeof global.getPatrimonioData === 'function' && global.getPatrimonioData !== getPatrimonioData && global.getPatrimonioData.__mobileV2Fallback !== true) {
      const data = global.getPatrimonioData() || {};
      return {
        accounts: Array.isArray(data.accounts) ? data.accounts : [],
        movements: Array.isArray(data.movements) ? data.movements : [],
        metrics: data.metrics || null,
        error: String(data.error || '')
      };
    }
    return {
      accounts: Array.isArray(global.patrimonioAccounts) ? global.patrimonioAccounts : [],
      movements: Array.isArray(global.patrimonioMovements) ? global.patrimonioMovements : [],
      metrics: null,
      error: ''
    };
  }

  global.MobileV2Data = {
    escapeHtml,
    formatMoney,
    getMonths,
    getCurrentMonth,
    getTotals,
    getIncomeTotal,
    getPlanningTotal,
    getMonthMetrics,
    categoryIcon,
    getOutflowAmount,
    getCategoryName,
    getFilterRows,
    getOutflowRows,
    getSpendCategorySummary,
    getPatrimonioData
  };
})(window);
