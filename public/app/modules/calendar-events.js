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

  function getEffectiveAmount(item) {
    const resolver = global.OutflowAmounts?.getEffectiveOutflowAmount;
    const raw = typeof resolver === 'function'
      ? resolver(item)
      : (item?.amount ?? item?.valor ?? 0);
    return Math.max(0, Number(raw || 0) || 0);
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
          amount: getEffectiveAmount(item)
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

  function getEventSharedExpensesByPerson(month, event) {
    if (!event) return { people: [], totalShared: 0, totalPending: 0, launchesCount: 0 };
    const start = global.FinanceCalendarUtils.parseDateInputToDate(event.startDate);
    const end = global.FinanceCalendarUtils.parseDateInputToDate(event.endDate);
    if (!start || !end) return { people: [], totalShared: 0, totalPending: 0, launchesCount: 0 };
    const startTime = start.getTime();
    const endTime = end.getTime();
    const eventTagComparable = normalizeTagComparable(event?.tagId || '');
    const monthsFromUtils = typeof global?.FinanceCalendarUtils?.getAllMonthsData === 'function'
      ? global.FinanceCalendarUtils.getAllMonthsData()
      : [];
    const sourceMonths = Array.isArray(monthsFromUtils) && monthsFromUtils.length
      ? monthsFromUtils
      : [month].filter(Boolean);
    const peopleMap = new Map();
    let totalShared = 0;
    let totalPending = 0;
    let launchesCount = 0;

    sourceMonths.forEach(monthRef => {
      const monthLabel = String(monthRef?.nome || '').trim() || 'Mês';
      (monthRef?.outflows || []).forEach(item => {
        if (!(item?.sharedExpense === true)) return;
        const date = parseOutflowDate(item, monthRef);
        if (!date) return;
        const time = date.getTime();
        if (time < startTime || time > endTime) return;
        if (eventTagComparable) {
          const itemTagComparable = normalizeTagComparable(item?.tag || '');
          if (itemTagComparable !== eventTagComparable) return;
        }
        if (!Array.isArray(item?.sharedParticipants) || !item.sharedParticipants.length) return;
        launchesCount += 1;
        totalShared += Math.max(0, Number(item?.sharedOthersAmount || 0) || 0);
        const dateLabel = global.normalizeVarDate?.(String(item?.date || item?.data || '').trim()) || date.toLocaleDateString('pt-BR');
        const description = String(item?.description || item?.descricao || 'Sem descrição').trim() || 'Sem descrição';
        const totalExpense = Math.max(0, Number(item?.sharedOriginalAmount || item?.amount || 0) || 0);
        item.sharedParticipants.forEach(participant => {
          if (participant?.isOwner === true) return;
          const personName = String(participant?.name || '').trim() || 'Pessoa sem nome';
          const personKey = personName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLocaleLowerCase('pt-BR');
          if (!personKey) return;
          const amount = Math.max(0, Number(participant?.amount || 0) || 0);
          const paid = participant?.paid === true;
          if (!peopleMap.has(personKey)) {
            peopleMap.set(personKey, {
              key: personKey,
              name: personName,
              total: 0,
              pending: 0,
              paid: 0,
              entries: []
            });
          }
          const bucket = peopleMap.get(personKey);
          bucket.total += amount;
          if (paid) bucket.paid += amount;
          else {
            bucket.pending += amount;
            totalPending += amount;
          }
          bucket.entries.push({
            monthLabel,
            dateLabel,
            description,
            personAmount: amount,
            totalExpense,
            paid
          });
        });
      });
    });

    const people = Array.from(peopleMap.values())
      .map(person => ({
        ...person,
        entries: person.entries.sort((a, b) => (global.parseData?.(b.dateLabel) || 0) - (global.parseData?.(a.dateLabel) || 0))
      }))
      .sort((a, b) => b.pending - a.pending || b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
    return {
      people,
      totalShared: Number(totalShared.toFixed(2)),
      totalPending: Number(totalPending.toFixed(2)),
      launchesCount
    };
  }

  global.FinanceCalendarEvents = {
    ensureMonthEvents,
    normalizeEvent,
    upsertEvent,
    getEventsForDay,
    getEventSpentValue,
    getEventTags,
    getEventLinkedLaunches,
    collectReusableParticipantNames,
    getEventSharedExpensesByPerson
  };
})(window);
