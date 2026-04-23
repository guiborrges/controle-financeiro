(function initMesAtualOutflowExpenseDate(global) {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value || 0) || min));
  }

  function toMonthDate(monthRef) {
    if (typeof global.getMonthDateFromMonthObject === 'function') {
      const resolved = global.getMonthDateFromMonthObject(monthRef);
      if (resolved instanceof Date && !Number.isNaN(resolved.getTime())) return resolved;
    }
    return new Date();
  }

  function normalizeDate(raw) {
    if (typeof global.normalizeVarDate === 'function') {
      return global.normalizeVarDate(String(raw || '').trim()) || '';
    }
    return '';
  }

  function buildDateByDayForMonth(dayValue, year, monthIndex) {
    const maxDay = new Date(year, monthIndex + 1, 0).getDate();
    const safeDay = clamp(dayValue, 1, maxDay);
    const dd = String(safeDay).padStart(2, '0');
    const mm = String(monthIndex + 1).padStart(2, '0');
    const yy = String(year).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }

  function buildNextMonthDateFromDay(dayValue, monthRef) {
    const base = toMonthDate(monthRef);
    const year = base.getMonth() === 11 ? base.getFullYear() + 1 : base.getFullYear();
    const monthIndex = (base.getMonth() + 1) % 12;
    return buildDateByDayForMonth(dayValue, year, monthIndex);
  }

  function parseMonthLag(dateValue, sourceMonthRef) {
    const normalized = normalizeDate(dateValue);
    if (!normalized) return 0;
    const [dayRaw, monthRaw, yearRaw] = normalized.split('/');
    const targetYear = 2000 + clamp(yearRaw, 0, 99);
    const targetMonthIndex = clamp(monthRaw, 1, 12) - 1;
    const source = toMonthDate(sourceMonthRef);
    return ((targetYear - source.getFullYear()) * 12) + (targetMonthIndex - source.getMonth());
  }

  function getExpenseDateForTargetMonth(sourceDate, sourceMonthRef, targetMonthDate) {
    const normalized = normalizeDate(sourceDate);
    if (!normalized) return '';
    const [dayRaw] = normalized.split('/');
    const lag = parseMonthLag(normalized, sourceMonthRef);
    const target = targetMonthDate instanceof Date ? targetMonthDate : toMonthDate(sourceMonthRef);
    const shifted = new Date(target.getFullYear(), target.getMonth() + lag, 1);
    return buildDateByDayForMonth(dayRaw, shifted.getFullYear(), shifted.getMonth());
  }

  function formatExpenseDateInput(rawValue) {
    const raw = String(rawValue || '').replace(/[^\d/]/g, '');
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    if (!digits) return '';
    if (digits.length <= 2) {
      return String(clamp(digits, 1, 31));
    }
    const day = String(clamp(digits.slice(0, 2), 1, 31)).padStart(2, '0');
    if (digits.length <= 4) {
      return `${day}/${digits.slice(2, 4)}`;
    }
    const month = String(clamp(digits.slice(2, 4), 1, 12)).padStart(2, '0');
    return `${day}/${month}/${digits.slice(4, 6)}`;
  }

  function resolveExpenseDate(rawValue, monthRef) {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    if (/^\d{1,2}$/.test(raw)) {
      return buildNextMonthDateFromDay(raw, monthRef);
    }
    return normalizeDate(raw);
  }

  global.MesAtualOutflowExpenseDate = {
    buildNextMonthDateFromDay,
    parseMonthLag,
    getExpenseDateForTargetMonth,
    formatExpenseDateInput,
    resolveExpenseDate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.MesAtualOutflowExpenseDate;
  }
})(typeof window !== 'undefined' ? window : globalThis);
