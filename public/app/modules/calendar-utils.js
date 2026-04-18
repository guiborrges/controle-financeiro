(function initFinanceCalendarUtils(global) {
  'use strict';

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getMonthContext(month) {
    const base = typeof global.getMonthDateFromMonthObject === 'function'
      ? global.getMonthDateFromMonthObject(month)
      : new Date();
    const year = base.getFullYear();
    const monthIndex = base.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    return { year, monthIndex, daysInMonth };
  }

  function getAllMonthsData() {
    if (typeof global.getAllFinanceMonths === 'function') {
      const list = global.getAllFinanceMonths();
      if (Array.isArray(list)) return list;
    }
    return [];
  }

  function getMonthByYearMonth(year, monthIndex) {
    const list = getAllMonthsData();
    return list.find(item => {
      if (!item) return false;
      const date = typeof global.getMonthDateFromMonthObject === 'function'
        ? global.getMonthDateFromMonthObject(item)
        : null;
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
      return date.getFullYear() === year && date.getMonth() === monthIndex;
    }) || null;
  }

  function getPreviousMonthFrom(month) {
    const context = getMonthContext(month);
    const prevMonthIndex = context.monthIndex === 0 ? 11 : context.monthIndex - 1;
    const prevYear = context.monthIndex === 0 ? context.year - 1 : context.year;
    return getMonthByYearMonth(prevYear, prevMonthIndex);
  }

  function parseDayFromVarDate(value) {
    const normalized = typeof global.normalizeVarDate === 'function'
      ? global.normalizeVarDate(String(value || '').trim())
      : '';
    if (!normalized) return 0;
    const day = Number(normalized.split('/')[0] || 0);
    return Number.isFinite(day) ? clamp(day, 1, 31) : 0;
  }

  function parseDateFromVarDate(value, month) {
    const normalized = typeof global.normalizeVarDate === 'function'
      ? global.normalizeVarDate(String(value || '').trim())
      : '';
    if (!normalized) return null;
    const parts = normalized.split('/');
    if (parts.length !== 3) return null;
    const day = Number(parts[0] || 0);
    const monthFromDate = Number(parts[1] || 0);
    const yearSuffix = Number(parts[2] || 0);
    if (!day || !monthFromDate) return null;
    const fullYear = yearSuffix < 100 ? 2000 + yearSuffix : yearSuffix;
    const date = new Date(fullYear, monthFromDate - 1, day);
    if (Number.isNaN(date.getTime())) return null;
    const target = getMonthContext(month);
    if (date.getFullYear() !== target.year || date.getMonth() !== target.monthIndex) return null;
    return date;
  }

  function getFixedOutflowDayIfDueInTargetMonth(item, targetMonth) {
    const rawDate = String(item?.date || '').trim();
    if (!rawDate) return 0;
    const normalized = typeof global.normalizeVarDate === 'function'
      ? global.normalizeVarDate(rawDate)
      : rawDate;
    if (!normalized) return 0;
    const parsed = parseDateFromVarDate(normalized, targetMonth);
    return parsed ? parsed.getDate() : 0;
  }

  function collectCrossMonthFixedPayments(targetMonth) {
    const rows = [];
    const list = getAllMonthsData();
    list.forEach(sourceMonth => {
      (sourceMonth?.outflows || []).forEach(item => {
        const isFixedPayment = item?.type === 'fixed' && item?.outputKind !== 'card';
        if (!isFixedPayment) return;
        const amount = Number(item?.amount || 0);
        if (!(amount > 0)) return;
        const day = getFixedOutflowDayIfDueInTargetMonth(item, targetMonth);
        if (!day) return;
        rows.push({ sourceMonth, item, day, amount });
      });
    });
    return rows;
  }

  function collectCrossMonthRecurringIncomes(targetMonth) {
    const rows = [];
    const list = getAllMonthsData();
    list.forEach(sourceMonth => {
      (sourceMonth?.renda || []).forEach(item => {
        if (item?.recurringFixed === false) return;
        const amount = Math.max(0, Number(item?.valor || 0));
        if (!(amount > 0)) return;
        const day = getMonthDayFromIncome(item, targetMonth, sourceMonth);
        if (!day) return;
        rows.push({ sourceMonth, item, day, amount });
      });
    });
    return rows;
  }

  function parseDateInputToDate(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year = Number(isoMatch[1] || 0);
      const month = Number(isoMatch[2] || 0);
      const day = Number(isoMatch[3] || 0);
      if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const localDate = new Date(year, month - 1, day);
        if (!Number.isNaN(localDate.getTime())) return localDate;
      }
    }
    const varDate = typeof global.normalizeVarDate === 'function' ? global.normalizeVarDate(text) : null;
    if (varDate) {
      const [day, month, year] = varDate.split('/').map(part => Number(part || 0));
      const fullYear = year < 100 ? 2000 + year : year;
      const date = new Date(fullYear, month - 1, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function toKey(year, monthIndex, day) {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function dateToKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return toKey(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function formatDateLong(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  function getDayIntensityColor(intensity) {
    const value = clamp(Number(intensity || 0), 0, 1);
    const from = { r: 255, g: 255, b: 255 };
    const to = { r: 203, g: 183, b: 245 };
    const r = Math.round(from.r + (to.r - from.r) * value);
    const g = Math.round(from.g + (to.g - from.g) * value);
    const b = Math.round(from.b + (to.b - from.b) * value);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function quantile(sortedValues, q) {
    if (!sortedValues.length) return 0;
    const pos = (sortedValues.length - 1) * clamp(q, 0, 1);
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sortedValues[base + 1] !== undefined) {
      return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base]);
    }
    return sortedValues[base];
  }

  function shouldUseIntensityForMonth(month) {
    const currentId = typeof global.getCurrentRealMonthId === 'function'
      ? global.getCurrentRealMonthId(false)
      : '';
    if (!month || !currentId || month.id !== currentId) return true;
    const now = new Date();
    return now.getDate() >= 7;
  }

  function computeIntensitiesFromTotals(dayTotals, month) {
    const map = {};
    const entries = Object.entries(dayTotals || {});
    if (!entries.length || !shouldUseIntensityForMonth(month)) {
      entries.forEach(([key]) => { map[key] = 0; });
      return map;
    }
    const positives = entries
      .map(([, total]) => Math.max(0, Number(total || 0)))
      .filter(value => value > 0)
      .sort((a, b) => a - b);
    if (!positives.length) {
      entries.forEach(([key]) => { map[key] = 0; });
      return map;
    }
    const mean = positives.reduce((sum, value) => sum + value, 0) / positives.length;
    const median = quantile(positives, 0.5);
    const q85 = quantile(positives, 0.85);
    const cap = Math.max(q85, mean * 1.35, median * 1.8, positives[positives.length - 1] * 0.28, 1);
    entries.forEach(([key, value]) => {
      const ratio = clamp((Number(value || 0) / cap), 0, 1);
      map[key] = Math.pow(ratio, 0.72);
    });
    return map;
  }

  function getIncomeReceiveDateForCalendarItem(item, sourceMonth) {
    if (!item || !sourceMonth) return null;
    const recurring = item.recurringFixed !== false;
    const rawValue = String(item.dataRecebimento || '').trim();
    if (recurring) {
      const hasExplicitMonthYear = /[\/-]/.test(rawValue);
      if (hasExplicitMonthYear) {
        return parseDateInputToDate(rawValue);
      }
      if (typeof global.getRecurringIncomeReceiveDay !== 'function') return null;
      const dayRaw = global.getRecurringIncomeReceiveDay(rawValue);
      const day = Number(dayRaw || 0);
      if (!Number.isFinite(day) || day < 1) return null;
      const sourceContext = getMonthContext(sourceMonth);
      return new Date(sourceContext.year, sourceContext.monthIndex + 1, Math.min(31, Math.max(1, day)));
    }
    return parseDateInputToDate(rawValue);
  }

  function getMonthDayFromIncome(item, month, sourceMonth = month) {
    if (!item) return 0;
    const receiveDate = getIncomeReceiveDateForCalendarItem(item, sourceMonth);
    if (!(receiveDate instanceof Date) || Number.isNaN(receiveDate.getTime())) return 0;
    const target = getMonthContext(month);
    if (receiveDate.getFullYear() !== target.year || receiveDate.getMonth() !== target.monthIndex) return 0;
    return receiveDate.getDate();
  }

  function getMonthDayFromOutflow(item, month) {
    if (!item) return 0;
    const rawDate = String(item.date || '').trim();
    const parsedDate = parseDateFromVarDate(rawDate, month);
    if (parsedDate) return parsedDate.getDate();
    const hasExplicitMonthYear = /[\/-]/.test(rawDate);
    if (item.type === 'fixed' && item.outputKind !== 'card') {
      // Despesas fixas com mês/ano explícitos devem aparecer apenas no mês real de cobrança.
      // Fallback de "somente dia" é permitido apenas para legado sem mês/ano no campo.
      if (hasExplicitMonthYear) return 0;
      return parseDayFromVarDate(rawDate);
    }
    if (!hasExplicitMonthYear) {
      // Compatibilidade com legados: para saídas sem mês/ano explícitos, usa o dia no mês em foco.
      return parseDayFromVarDate(rawDate);
    }
    return 0;
  }

  function isVariableOutflow(item) {
    if (!item || item.type !== 'spend') return false;
    if (item.recurringSpend === true) return false;
    if (item.type === 'fixed') return false;
    if (item.installmentsTotal > 1 && item.installmentIndex > 1 && item.outputKind === 'card') {
      return false;
    }
    return Number(item.amount || 0) > 0;
  }

  function getVariableOutflowsByDay(month) {
    const context = getMonthContext(month);
    const byDay = {};
    (month?.outflows || []).forEach(item => {
      if (!isVariableOutflow(item)) return;
      const day = getMonthDayFromOutflow(item, month);
      if (!day || day > context.daysInMonth) return;
      byDay[day] = (byDay[day] || 0) + Number(item.amount || 0);
    });
    return byDay;
  }

  function getDayLedger(month, day) {
    const context = getMonthContext(month);
    const safeDay = clamp(Number(day || 0), 1, context.daysInMonth);
    let outflows = 0;
    let incomes = 0;
    const launches = [];
    const paymentItems = [];
    const receivingItems = [];
    (month?.outflows || []).forEach(item => {
      const itemDay = getMonthDayFromOutflow(item, month);
      if (itemDay !== safeDay) return;
      const amount = Number(item.amount || 0);
      if (!(amount > 0)) return;
      outflows += amount;
      launches.push(item);
      const isPaymentRelevant = (item?.type === 'fixed' || item?.recurringSpend === true) && item?.outputKind !== 'card';
      if (!isPaymentRelevant) return;
      paymentItems.push({
        id: String(item?.id || ''),
        type: 'outflow',
        description: String(item?.description || item?.nome || 'Saída prevista').trim() || 'Saída prevista',
        amount
      });
    });
    const fixedDueRows = collectCrossMonthFixedPayments(month);
    fixedDueRows.forEach(({ sourceMonth, item, day: itemDay, amount }) => {
      if (itemDay !== safeDay) return;
      paymentItems.push({
        id: `${String(sourceMonth?.id || '')}::${String(item?.id || '')}`,
        type: 'outflow',
        description: String(item?.description || item?.nome || 'Saída prevista').trim() || 'Saída prevista',
        amount
      });
    });
    const previousMonth = getPreviousMonthFrom(month);
    (previousMonth?.cardBills || []).forEach(bill => {
      const card = (previousMonth?.outflowCards || []).find(entry => entry.id === bill?.cardId);
      const day = Math.max(1, Math.min(context.daysInMonth, Number(card?.paymentDay || 0)));
      if (!day || day !== safeDay) return;
      const amount = Math.max(0, Number(bill?.amount || 0));
      if (!(amount > 0)) return;
      paymentItems.push({
        id: String(bill?.id || bill?.cardId || ''),
        type: 'bill',
        description: String(card?.name || 'Fatura do cartão').trim() || 'Fatura do cartão',
        amount
      });
    });
    const recurringIncomeRows = collectCrossMonthRecurringIncomes(month);
    recurringIncomeRows.forEach(({ sourceMonth, item, day: itemDay, amount }) => {
      if (itemDay !== safeDay) return;
      if (item.paid !== false) incomes += amount;
      receivingItems.push({
        id: `${String(sourceMonth?.id || '')}::${String(item?.id || '')}`,
        type: 'income',
        description: String(item?.fonte || 'Receita fixa').trim() || 'Receita fixa',
        amount,
        paid: item?.paid !== false
      });
    });
    (month?.projetos || []).forEach(item => {
      const itemDay = parseDayFromVarDate(item.dataRecebimento || '');
      if (itemDay !== safeDay) return;
      const amount = Math.max(0, Number(item.valor || 0));
      if (!(amount > 0)) return;
      if (item.paid !== false) incomes += amount;
      receivingItems.push({
        id: String(item?.id || ''),
        type: 'project',
        description: String(item?.nome || 'Entrada extra').trim() || 'Entrada extra',
        amount,
        paid: item?.paid !== false
      });
    });
    return { outflows, incomes, launches, paymentItems, receivingItems };
  }

  function calculateDayImpact(month, dayOutflows) {
    const total = (month?.outflows || []).reduce((sum, item) => {
      const amount = Math.max(0, Number(item?.amount || 0));
      if (!amount) return sum;
      return sum + amount;
    }, 0);
    if (!(total > 0)) return 0;
    return clamp((Number(dayOutflows || 0) / total) * 100, 0, 100);
  }

  function getImportantMarkersByDay(month) {
    const context = getMonthContext(month);
    const markers = {};
    for (let day = 1; day <= context.daysInMonth; day += 1) {
      markers[day] = { payment: false, receiving: false };
    }
    (month?.outflows || []).forEach(item => {
      const isPaymentRelevant = (item?.type === 'fixed' || item?.recurringSpend === true) && item?.outputKind !== 'card';
      if (!isPaymentRelevant) return;
      if (!(Number(item?.amount || 0) > 0)) return;
      const day = getMonthDayFromOutflow(item, month);
      if (!day || day > context.daysInMonth) return;
      markers[day].payment = true;
    });
    const previousMonth = getPreviousMonthFrom(month);
    collectCrossMonthFixedPayments(month).forEach(({ day }) => {
      if (!day || day > context.daysInMonth) return;
      markers[day].payment = true;
    });
    (previousMonth?.cardBills || []).forEach(bill => {
      if (!(Number(bill?.amount || 0) > 0)) return;
      const card = (previousMonth?.outflowCards || []).find(entry => entry.id === bill?.cardId);
      const day = Math.max(1, Math.min(context.daysInMonth, Number(card?.paymentDay || 0)));
      if (!day) return;
      markers[day].payment = true;
    });
    collectCrossMonthRecurringIncomes(month).forEach(({ day }) => {
      if (!day || day > context.daysInMonth) return;
      markers[day].receiving = true;
    });
    (month?.projetos || []).forEach(item => {
      const day = parseDayFromVarDate(item?.dataRecebimento || '');
      if (!day || day > context.daysInMonth) return;
      markers[day].receiving = true;
    });
    return markers;
  }

  const api = {
    clamp,
    getMonthContext,
    getAllMonthsData,
    parseDateInputToDate,
    parseDateFromVarDate,
    parseDayFromVarDate,
    toKey,
    dateToKey,
    formatDateLong,
    getDayIntensityColor,
    computeIntensitiesFromTotals,
    getMonthDayFromIncome,
    getMonthDayFromOutflow,
    isVariableOutflow,
    getVariableOutflowsByDay,
    getDayLedger,
    calculateDayImpact,
    getImportantMarkersByDay
  };
  global.FinanceCalendarUtils = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
