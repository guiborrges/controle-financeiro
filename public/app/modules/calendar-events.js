(function initFinanceCalendarEvents(global) {
  'use strict';

  function normalizeTagValue(value) {
    return String(value || '').trim();
  }

  function normalizeTagComparable(value) {
    return normalizeTagValue(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('pt-BR');
  }

  function ensureMonthEvents(month) {
    if (!month || typeof month !== 'object') return [];
    if (!Array.isArray(month.calendarEvents)) month.calendarEvents = [];
    month.calendarEvents = month.calendarEvents
      .map((event, idx) => normalizeEvent(event, idx))
      .filter(Boolean);
    return month.calendarEvents;
  }

  function normalizeEvent(event, index = 0) {
    if (!event || typeof event !== 'object') return null;
    const startDate = global.FinanceCalendarUtils.parseDateInputToDate(event.startDate);
    const endDate = global.FinanceCalendarUtils.parseDateInputToDate(event.endDate);
    const normalizedStart = startDate || endDate;
    const normalizedEnd = endDate || startDate;
    if (!normalizedStart || !normalizedEnd) return null;
    const from = normalizedStart <= normalizedEnd ? normalizedStart : normalizedEnd;
    const to = normalizedStart <= normalizedEnd ? normalizedEnd : normalizedStart;
    const color = String(event.color || '#9b88f7').trim() || '#9b88f7';
    return {
      id: String(event.id || `cal_evt_${Date.now()}_${index}`).trim(),
      name: String(event.name || 'Evento').trim() || 'Evento',
      startDate: global.FinanceCalendarUtils.dateToKey(from),
      endDate: global.FinanceCalendarUtils.dateToKey(to),
      budget: Math.max(0, Number(event.budget || 0)),
      color,
      tagId: normalizeTagValue(event.tagId)
    };
  }

  function upsertEvent(month, payload) {
    const events = ensureMonthEvents(month);
    const normalized = normalizeEvent(payload, events.length);
    if (!normalized) return null;
    const index = events.findIndex(event => event.id === normalized.id);
    if (index >= 0) {
      events[index] = normalized;
    } else {
      events.push(normalized);
    }
    return normalized;
  }

  function getEventsForDay(month, dayDate) {
    const events = ensureMonthEvents(month);
    const key = global.FinanceCalendarUtils.dateToKey(dayDate);
    return events.filter(event => event.startDate <= key && event.endDate >= key);
  }

  function getEventSpentValue(month, event) {
    if (!event) return 0;
    const start = global.FinanceCalendarUtils.parseDateInputToDate(event.startDate);
    const end = global.FinanceCalendarUtils.parseDateInputToDate(event.endDate);
    if (!start || !end) return 0;
    const startTime = start.getTime();
    const endTime = end.getTime();
    const linked = getEventLinkedEntries(month, event, startTime, endTime);
    return linked.reduce((sum, entry) => sum + Math.max(0, Number(entry?.amount || 0)), 0);
  }

  function getEventTags(month, event) {
    if (!event) return [];
    const start = global.FinanceCalendarUtils.parseDateInputToDate(event.startDate);
    const end = global.FinanceCalendarUtils.parseDateInputToDate(event.endDate);
    if (!start || !end) return [];
    const startTime = start.getTime();
    const endTime = end.getTime();
    const tags = new Set();
    getEventLinkedEntries(month, event, startTime, endTime).forEach(entry => {
      const rawTag = String(entry?.tag || '').trim();
      if (rawTag) tags.add(rawTag);
    });
    const eventTag = normalizeTagValue(event.tagId);
    if (eventTag) tags.add(eventTag);
    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function getEventLinkedLaunches(month, event) {
    if (!event) return [];
    const start = global.FinanceCalendarUtils.parseDateInputToDate(event.startDate);
    const end = global.FinanceCalendarUtils.parseDateInputToDate(event.endDate);
    if (!start || !end) return [];
    const startTime = start.getTime();
    const endTime = end.getTime();
    return getEventLinkedEntries(month, event, startTime, endTime)
      .map(entry => ({
        id: String(entry?.id || ''),
        description: String(entry?.description || 'Sem descrição'),
        dateLabel: String(entry?.dateLabel || '—'),
        amount: Math.max(0, Number(entry?.amount || 0)),
        tag: String(entry?.tag || '').trim()
      }))
      .sort((a, b) => (global.parseData?.(b.dateLabel) || 0) - (global.parseData?.(a.dateLabel) || 0));
  }

  function getEventLinkedEntries(month, event, startTime, endTime) {
    const allEntries = collectEventScopedEntries(month, startTime, endTime, false);
    const eventTagComparable = normalizeTagComparable(event?.tagId || '');
    if (!eventTagComparable) {
      return allEntries.filter(entry => entry.time >= startTime && entry.time <= endTime);
    }
    const tagMatched = allEntries.filter(entry =>
      normalizeTagComparable(entry?.tag) === eventTagComparable);
    if (tagMatched.length) return tagMatched;
    return allEntries.filter(entry => entry.time >= startTime && entry.time <= endTime);
  }

  function parseOutflowDate(item, month) {
    if (!item || typeof item !== 'object') return null;
    const rawPrimary = String(item?.date || '').trim();
    const rawSecondary = String(item?.data || '').trim();
    const candidateValues = [rawPrimary, rawSecondary].filter(Boolean);
    for (let idx = 0; idx < candidateValues.length; idx += 1) {
      const raw = candidateValues[idx];
      const strictMonthDate = global.FinanceCalendarUtils.parseDateFromVarDate(raw, month);
      if (strictMonthDate) return strictMonthDate;
      const flexibleDate = global.FinanceCalendarUtils.parseDateInputToDate(raw);
      if (flexibleDate) return flexibleDate;
    }
    return null;
  }

  function parseLegacySpendDate(item, month) {
    if (!item || typeof item !== 'object') return null;
    const raw = String(item?.data || item?.date || '').trim();
    if (!raw) return null;
    const strictMonthDate = global.FinanceCalendarUtils.parseDateFromVarDate(raw, month);
    if (strictMonthDate) return strictMonthDate;
    const flexibleDate = global.FinanceCalendarUtils.parseDateInputToDate(raw);
    if (flexibleDate) return flexibleDate;
    return null;
  }

  function collectEventScopedEntries(baseMonth, startTime, endTime, restrictToRange = false) {
    const monthsFromUtils = typeof global?.FinanceCalendarUtils?.getAllMonthsData === 'function'
      ? global.FinanceCalendarUtils.getAllMonthsData()
      : [];
    const sourceMonths = Array.isArray(monthsFromUtils) && monthsFromUtils.length
      ? monthsFromUtils
      : [baseMonth].filter(Boolean);
    const entries = [];
    sourceMonths.forEach(monthRef => {
      (monthRef?.outflows || []).forEach(item => {
        const date = parseOutflowDate(item, monthRef);
        if (!date) return;
        const time = date.getTime();
        if (restrictToRange && (time < startTime || time > endTime)) return;
        const dateLabel = global.normalizeVarDate?.(String(item?.date || item?.data || '').trim()) || date.toLocaleDateString('pt-BR');
        entries.push({
          id: String(item?.id || ''),
          time,
          description: String(item?.description || item?.descricao || '').trim() || 'Sem descrição',
          dateLabel,
          tag: String(item?.tag || item?.marca || '').trim(),
          amount: Math.max(0, Number(item?.amount || item?.valor || 0))
        });
      });
      (monthRef?.gastosVar || []).forEach(item => {
        const date = parseLegacySpendDate(item, monthRef);
        if (!date) return;
        const time = date.getTime();
        if (restrictToRange && (time < startTime || time > endTime)) return;
        const dateLabel = global.normalizeVarDate?.(String(item?.data || item?.date || '').trim()) || date.toLocaleDateString('pt-BR');
        entries.push({
          id: String(item?.id || ''),
          time,
          description: String(item?.titulo || item?.description || '').trim() || 'Sem descrição',
          dateLabel,
          tag: String(item?.tag || item?.marca || '').trim(),
          amount: Math.max(0, Number(item?.amount || item?.valor || 0))
        });
      });
    });
    return entries;
  }

  function collectReusableParticipantNames(sourceData) {
    const names = new Set();
    (sourceData || []).forEach(month => {
      (month?.outflows || []).forEach(item => {
        (item?.sharedParticipants || []).forEach(participant => {
          const name = String(participant?.name || '').trim();
          if (name) names.add(name);
        });
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  global.FinanceCalendarEvents = {
    ensureMonthEvents,
    normalizeEvent,
    upsertEvent,
    getEventsForDay,
    getEventSpentValue,
    getEventTags,
    getEventLinkedLaunches,
    collectReusableParticipantNames
  };
})(window);
