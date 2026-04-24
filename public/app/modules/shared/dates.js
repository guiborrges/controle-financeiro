(function initSharedDates(global) {
  const MONTH_INDEX = {
    JANEIRO: 0,
    FEVEREIRO: 1,
    MARCO: 2,
    MARÇO: 2,
    'MARÃ‡O': 2,
    ABRIL: 3,
    MAIO: 4,
    JUNHO: 5,
    JULHO: 6,
    AGOSTO: 7,
    SETEMBRO: 8,
    OUTUBRO: 9,
    NOVEMBRO: 10,
    DEZEMBRO: 11
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value || 0) || min));
  }

  function normalizeVarDate(txt) {
    const clean = String(txt || '').trim();
    if (!clean) return '';
    const match = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);
    if (!match) return null;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const fullYear = parseInt(match[3], 10);
    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(fullYear)) return null;
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    const shortYear = String(fullYear).slice(-2).padStart(2, '0');
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${shortYear}`;
  }

  function normalizeMonthName(value) {
    const raw = String(value || '').trim().toUpperCase();
    const normalized = raw
      .replace(/MARÃ‡O/g, 'MARÇO')
      .replace(/MARÃ§O/g, 'MARÇO')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return normalized === 'MARCO' ? 'MARCO' : normalized;
  }

  function getMonthDateFromContext(monthRef) {
    if (typeof global.getMonthDateFromMonthObject === 'function') {
      const resolved = global.getMonthDateFromMonthObject(monthRef);
      if (resolved instanceof Date && !Number.isNaN(resolved.getTime())) return resolved;
    }
    const rawName = String(monthRef?.nome || monthRef?.name || '').trim();
    const year = Number(String(monthRef?.id || rawName).match(/(19|20)\d{2}/)?.[0] || new Date().getFullYear());
    const monthToken = normalizeMonthName(rawName.split(/\s+/)[0] || '');
    if (Object.prototype.hasOwnProperty.call(MONTH_INDEX, monthToken)) {
      return new Date(year, MONTH_INDEX[monthToken], 1);
    }
    return new Date();
  }

  function buildDateByDayForMonth(dayValue, year, monthIndex) {
    const maxDay = new Date(year, monthIndex + 1, 0).getDate();
    const safeDay = clamp(dayValue, 1, maxDay);
    const dd = String(safeDay).padStart(2, '0');
    const mm = String(monthIndex + 1).padStart(2, '0');
    const yy = String(year).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }

  function formatDateInputProgressive(rawValue) {
    const digits = String(rawValue || '').replace(/\D/g, '').slice(0, 8);
    if (!digits) return '';
    if (digits.length <= 2) return String(clamp(digits, 1, 31));
    const day = String(clamp(digits.slice(0, 2), 1, 31)).padStart(2, '0');
    if (digits.length <= 4) return `${day}/${digits.slice(2, 4)}`;
    const month = String(clamp(digits.slice(2, 4), 1, 12)).padStart(2, '0');
    return `${day}/${month}/${digits.slice(4)}`;
  }

  function resolveDateFromInput(rawValue, monthRef, options = {}) {
    const raw = String(rawValue || '').trim();
    if (!raw) {
      return {
        date: '',
        mode: 'empty',
        hasExplicitMonthYear: false,
        warning: ''
      };
    }
    if (/^\d{1,2}$/.test(raw)) {
      const base = getMonthDateFromContext(monthRef);
      const offset = Number.isFinite(Number(options.simpleDayMonthOffset))
        ? Math.trunc(Number(options.simpleDayMonthOffset))
        : 1;
      const target = new Date(base.getFullYear(), base.getMonth() + offset, 1);
      return {
        date: buildDateByDayForMonth(raw, target.getFullYear(), target.getMonth()),
        mode: 'simple-day',
        hasExplicitMonthYear: false,
        warning: ''
      };
    }
    const normalized = normalizeVarDate(raw);
    return {
      date: normalized || '',
      mode: normalized ? 'full-date' : 'invalid',
      hasExplicitMonthYear: Boolean(normalized),
      warning: normalized ? '' : 'invalid-date'
    };
  }

  function parseFlexibleDateInput(rawValue, monthRef, options = {}) {
    return resolveDateFromInput(rawValue, monthRef, options);
  }

  function normalizeDateInputForMonthContext(rawValue, monthRef, options = {}) {
    return resolveDateFromInput(rawValue, monthRef, options).date;
  }

  function parseData(txt) {
    if (!txt) return 0;
    const normalized = normalizeVarDate(txt);
    if (normalized) {
      const parts = normalized.split('/').map(p => parseInt(p, 10));
      if (parts.length === 3) {
        const year = 2000 + parts[2];
        return new Date(year, parts[1] - 1, parts[0]).getTime();
      }
    }
    return Date.parse(txt) || 0;
  }

  const api = {
    normalizeVarDate,
    parseData,
    getMonthDateFromContext,
    buildDateByDayForMonth,
    formatDateInputProgressive,
    resolveDateFromInput,
    parseFlexibleDateInput,
    normalizeDateInputForMonthContext
  };

  global.DateUtils = { ...(global.DateUtils || {}), ...api };
  global.normalizeVarDate = normalizeVarDate;
  global.parseData = parseData;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
