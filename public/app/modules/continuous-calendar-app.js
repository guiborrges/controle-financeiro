let continuousCalendarModel = null;
let continuousCalendarSession = null;

function renameContinuousCalendarSelection(kind, source, target) {
  if (!isContinuousCalendarEnabled()) return;
  window.ContinuousCalendar.renameSelection(continuousCalendarModel, kind, source, target,
    kind === 'category' ? resolveCategoryName : undefined);
}


function isContinuousCalendarEnabled() {
  return continuousCalendarModel?.version === window.ContinuousCalendar?.VERSION && !!continuousCalendarSession;
}

function getContinuousCalendarOptions() {
  const monthNames = Object.keys(MONTH_INDEX);
  const fromId = id => {
    const [, year] = String(id || '').split('_');
    const index = monthNames.findIndex(value => getMonthIdFromParts(value, year) === id);
    return { id, nome: `${monthNames[Math.max(0, index)]} ${year}` };
  };
  return {
    start: getRealCurrentMonthSortValue(),
    sort: getMonthSortValue,
    month: fromId,
    monthAtOrdinal: ordinal => Number.isFinite(ordinal) ? fromId(getMonthIdFromParts(monthNames[ordinal % 12], Math.floor(ordinal / 12))) : null,
    blank: month => buildBlankMonth(getMonthDateFromMonthObject(month)),
    projectSettings: (payload, month, source) => {
      window.CalendarProjection.projectCardDates(payload, source, month, getUnifiedCardDateForMonth);
    },
    normalize: month => {
      normalizeMonth(month);
      ensureUnifiedOutflowPilotMonth(month);
      if (month.selectionVisibility?.version >= 2) {
        (month.outflows || []).forEach(item => {
          if (item.category) month.selectionVisibility.categories[item.category] = true;
          const tag = String(item.tag || '').trim().toLocaleLowerCase('pt-BR');
          if (tag) month.selectionVisibility.tags[tag] = true;
        });
      }
      recalcTotals(month);
    },
    occurrence: window.CalendarProjection.createOccurrenceProjector({
      income: (payload, month, source) => window.MesAtualIncomeRecurrence.cloneRecurringIncome({
          ...payload, dataRecebimento: /[\/-]/.test(String(payload.dataRecebimento || ''))
            ? getUnifiedCardDateForMonth(payload.dataRecebimento, source, month)
            : getRecurringIncomeReceiveDay(payload.dataRecebimento)
        }, payload.recurringGroupId || getIncomeRecurringGroupId(payload)),
      project: (payload, month, source, index) => cloneProjetoRecurringForMonth(payload, getMonthDateFromMonthObject(month), index),
      outflow: (payload, month, source) => cloneUnifiedOutflowForMonth(payload, getMonthDateFromMonthObject(month), source),
      singleOutflowIndex: () => 1,
      resetOutflowState: true
    })
  };
}

function restoreContinuousCalendar(model, months) {
  continuousCalendarModel = model?.version === window.ContinuousCalendar.VERSION ? model : null;
  continuousCalendarSession = null;
  if (!continuousCalendarModel) return months;
  continuousCalendarSession = window.ContinuousCalendar.createSession(continuousCalendarModel, getContinuousCalendarOptions());
  const hydrated = months.map(month => continuousCalendarSession.hydrate(month));
  return hydrated;
}

function ensureContinuousCalendarWindow() {
  if (!isContinuousCalendarEnabled()) return;
  const now = new Date();
  const year = now.getFullYear();
  for (let targetYear = year; targetYear <= year + 1; targetYear += 1) {
    Object.keys(MONTH_INDEX).forEach(monthName => {
      const id = getMonthIdFromParts(monthName, targetYear);
      if (data.some(month => month.id === id)) return;
      const month = buildBlankMonth(new Date(targetYear, MONTH_INDEX[monthName], 1));
      data.push(continuousCalendarSession.virtual(month));
    });
  }
  sortDataChronologically();
}

function serializeContinuousCalendarMonths() {
  return isContinuousCalendarEnabled() ? continuousCalendarSession.serialize(data) : data;
}

function updateContinuousCalendarRule(month, collection, item) {
  if (!isContinuousCalendarEnabled()) return false;
  continuousCalendarSession.upsert(data, month, collection, item);
  return true;
}

function stopContinuousCalendarRule(month, collection, key) {
  if (!isContinuousCalendarEnabled()) return false;
  continuousCalendarSession.stop(data, month, collection, key);
  return true;
}

function updateContinuousCalendarCards(month, cardId = '') {
  if (!isContinuousCalendarEnabled()) return false;
  window.ContinuousCalendar.updateCards(continuousCalendarModel, month, getContinuousCalendarOptions(), cardId);
  return true;
}

function changeContinuousCalendarCard(month, cardId, targetCardId = '') {
  if (!isContinuousCalendarEnabled()) return false;
  window.ContinuousCalendar.changeCard(continuousCalendarModel, month, cardId, targetCardId, getContinuousCalendarOptions());
  return true;
}

async function migrateToContinuousCalendar() {
  if (isContinuousCalendarEnabled() && continuousCalendarModel.recurrenceRevision >= window.ContinuousCalendar.RECURRENCE_REVISION && continuousCalendarModel.cardOutputRevision >= 1) return;
  try {
    const response = await fetch('/api/backups/manual', {
      method: 'POST', credentials: 'same-origin',
      headers: getCsrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify({ note: 'Antes da migracao ou reparo de recorrencias do calendario continuo' })
    });
    if (!response.ok) throw new Error(`Backup indisponivel (${response.status})`);
    data.forEach(month => { normalizeMonth(month); ensureUnifiedOutflowPilotMonth(month); });
    const existing = isContinuousCalendarEnabled();
    const storedMonths = existing ? serializeContinuousCalendarMonths() : data;
    const model = existing
      ? JSON.parse(JSON.stringify(continuousCalendarModel))
      : window.ContinuousCalendar.createModel(data, getContinuousCalendarOptions());
    if (existing) window.ContinuousCalendar.repairRecurringRules(model, data, getContinuousCalendarOptions());
    window.ContinuousCalendar.repairLegacyCardOutputs(JSON.parse(JSON.stringify(model)), storedMonths, getContinuousCalendarOptions());
    window.ContinuousCalendar.repairLegacyCardOutputs(model, data, getContinuousCalendarOptions());
    data = restoreContinuousCalendar(model, storedMonths);
    ensureContinuousCalendarWindow();
    save(true);
    buildMonthSelect();
    renderAll();
    if (window.MobileV2?.isEnabled?.()) window.MobileV2.refresh();
  } catch (error) {
    console.error('[calendar] Migracao pendente:', error?.message || error);
    if (typeof showAppStatus === 'function') showAppStatus('Nao foi possivel preparar o calendario. Recarregue para tentar novamente.', 'Calendario', 'error');
  }
}
