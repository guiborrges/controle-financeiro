;(function initDashboardRules(globalScope) {
  const MONTH_INDEX = {
    janeiro: 0,
    fevereiro: 1,
    marco: 2,
    abril: 3,
    maio: 4,
    junho: 5,
    julho: 6,
    agosto: 7,
    setembro: 8,
    outubro: 9,
    novembro: 10,
    dezembro: 11
  };

  function normalizeMonthToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function getMonthName(month) {
    const parts = String(month?.nome || '').trim().split(/\s+/);
    return parts[0] || '';
  }

  function getYear(month) {
    return String(month?.nome || '').trim().split(/\s+/)[1] || '';
  }

  function getMonthSortValueFromMonth(month) {
    const year = Number.parseInt(getYear(month), 10);
    const monthIndex = MONTH_INDEX[normalizeMonthToken(getMonthName(month))] ?? -1;
    return (year * 12) + monthIndex;
  }

  function getRealCurrentMonthSortValue(referenceDate = new Date()) {
    return (referenceDate.getFullYear() * 12) + referenceDate.getMonth();
  }

  function isMonthStartedForDashboard(month, referenceDate = new Date()) {
    if (!month) return false;
    return getMonthSortValueFromMonth(month) <= getRealCurrentMonthSortValue(referenceDate);
  }

  function getDashboardEligibleMonths(source = [], referenceDate = new Date()) {
    const result = [];
    const seen = new Set();
    (source || []).forEach(month => {
      if (!isMonthStartedForDashboard(month, referenceDate)) return;
      const fallback = `${normalizeMonthToken(getMonthName(month))}_${getYear(month)}`;
      const key = String(month?.id || fallback).trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      result.push(month);
    });
    return result;
  }

  const api = {
    getMonthSortValueFromMonth,
    getRealCurrentMonthSortValue,
    isMonthStartedForDashboard,
    getDashboardEligibleMonths
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  globalScope.DashboardRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
