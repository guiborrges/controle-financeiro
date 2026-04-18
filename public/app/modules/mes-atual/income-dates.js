;(function initIncomeDateRules(globalScope) {
  function normalizeDateLike(value) {
    return String(value || '').trim();
  }

  function getRecurringIncomeReceiveDay(value) {
    const raw = normalizeDateLike(value);
    if (!raw) return '';
    if (/^\d{1,2}$/.test(raw)) {
      const day = Math.max(1, Math.min(31, Number(raw) || 1));
      return String(day).padStart(2, '0');
    }
    const normalizedDate = typeof globalScope.normalizeVarDate === 'function'
      ? globalScope.normalizeVarDate(raw)
      : '';
    if (!normalizedDate) return '';
    const [dayRaw] = normalizedDate.split('/');
    const day = Math.max(1, Math.min(31, Number(dayRaw || 1) || 1));
    return String(day).padStart(2, '0');
  }

  function getMonthDateByDayForMonth(day, month, monthOffset = 0) {
    if (typeof globalScope.getMonthDateFromMonthObject !== 'function') return '';
    const parsedDay = Math.max(1, Math.min(31, Number(day || 1) || 1));
    const baseDate = globalScope.getMonthDateFromMonthObject(month);
    const offset = Math.trunc(Number(monthOffset || 0));
    const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
    const yy = String(targetDate.getFullYear()).slice(-2);
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(parsedDay).padStart(2, '0');
    return `${dd}/${mm}/${yy}`;
  }

  function normalizeIncomeReceiveDate(rawValue, month, allowDayOnly = true) {
    const raw = normalizeDateLike(rawValue);
    if (!raw) return '';
    if (allowDayOnly && /^\d{1,2}$/.test(raw)) {
      const day = Math.max(1, Math.min(31, Number(raw) || 1));
      return String(day).padStart(2, '0');
    }
    return typeof globalScope.normalizeVarDate === 'function'
      ? (globalScope.normalizeVarDate(raw) || '')
      : raw;
  }

  function getIncomeReceiveDateLabel(item, month) {
    if (!item) return '-';
    const recurring = item?.recurringFixed !== false;
    if (recurring) {
      const raw = normalizeDateLike(item?.dataRecebimento || '');
      const hasExplicitMonth = /[\/-]/.test(raw);
      if (hasExplicitMonth) {
        const explicitDate = typeof globalScope.normalizeVarDate === 'function'
          ? (globalScope.normalizeVarDate(raw) || '')
          : raw;
        if (explicitDate) return explicitDate;
      }
      const day = getRecurringIncomeReceiveDay(item?.dataRecebimento || '');
      if (!day) return '-';
      // Default rule: fixed income is received in the next month.
      return getMonthDateByDayForMonth(day, month, 1) || '-';
    }
    if (typeof globalScope.normalizeVarDate !== 'function') return '-';
    return globalScope.normalizeVarDate(String(item?.dataRecebimento || '').trim()) || '-';
  }

  function getIncomeReceiveDateSortValue(item, month) {
    if (typeof globalScope.parseData !== 'function') return 0;
    return globalScope.parseData(getIncomeReceiveDateLabel(item, month)) || 0;
  }

  const api = {
    getRecurringIncomeReceiveDay,
    getMonthDateByDayForMonth,
    normalizeIncomeReceiveDate,
    getIncomeReceiveDateLabel,
    getIncomeReceiveDateSortValue
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  globalScope.IncomeDateRules = api;
})(typeof window !== 'undefined' ? window : globalThis);

