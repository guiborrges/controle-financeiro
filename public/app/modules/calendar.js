(function initFinanceCalendar(global) {
  'use strict';

  const state = {
    monthId: '',
    selectedDay: 0,
    selectedEventId: '',
    editingEventId: '',
    chartExpanded: false,
    dayIntensities: {},
    variableTotalsByDay: {},
    importantMarkersByDay: {},
    eventsByDay: {},
    tooltipDay: 0
  };
  let dailyChartInstance = null;

  function ensureMonthCalendarState(month) {
    if (!month) return;
    if (!Array.isArray(month.calendarEvents)) month.calendarEvents = [];
    month.calendarEvents = global.FinanceCalendarEvents.ensureMonthEvents(month);
  }

  function getCurrentMonthSafe() {
    if (typeof global.getCurrentMonth === 'function') return global.getCurrentMonth();
    return null;
  }

  function getTagOptions() {
    const tags = typeof global.getUnifiedOutflowTags === 'function'
      ? global.getUnifiedOutflowTags()
      : [];
    return Array.from(new Set((tags || []).map(tag => String(tag || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function fillEventTagOptions(selected = '') {
    const select = document.getElementById('calendarEventTag');
    if (!select) return;
    const tags = getTagOptions();
    const options = ['<option value="">Sem tag</option>']
      .concat(tags.map(tag => `<option value="${escapeHtml(tag)}" ${selected === tag ? 'selected' : ''}>${escapeHtml(tag)}</option>`))
      .concat('<option value="nova">+ Nova tag</option>');
    select.innerHTML = options.join('');
    if (selected && !tags.includes(selected)) {
      select.value = selected;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function recomputeCalendarState(month) {
    ensureMonthCalendarState(month);
    const context = global.FinanceCalendarUtils.getMonthContext(month);
    const variableTotalsByDay = global.FinanceCalendarUtils.getVariableOutflowsByDay(month);
    const eventsByDay = {};
    for (let day = 1; day <= context.daysInMonth; day += 1) {
      const date = new Date(context.year, context.monthIndex, day);
      eventsByDay[day] = global.FinanceCalendarEvents.getEventsForDay(month, date);
    }
    state.variableTotalsByDay = variableTotalsByDay;
    state.dayIntensities = global.FinanceCalendarUtils.computeIntensitiesFromTotals(variableTotalsByDay, month);
    state.importantMarkersByDay = global.FinanceCalendarUtils.getImportantMarkersByDay(month);
    state.eventsByDay = eventsByDay;
  }

  function destroyDailyChart() {
    if (dailyChartInstance && typeof dailyChartInstance.destroy === 'function') {
      dailyChartInstance.destroy();
    }
    dailyChartInstance = null;
  }

  function renderDailyChart(month) {
    const wrap = document.getElementById('financeCalendarChartWrap');
    const button = document.getElementById('financeCalendarChartToggleBtn');
    if (!wrap) return;
    const shouldShow = state.chartExpanded === true;
    wrap.classList.toggle('is-open', shouldShow);
    wrap.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    wrap.style.maxHeight = shouldShow ? '180px' : '0px';
    wrap.style.opacity = shouldShow ? '1' : '0';
    wrap.style.pointerEvents = shouldShow ? 'auto' : 'none';
    if (button) {
      button.classList.toggle('is-active', shouldShow);
      const label = shouldShow ? 'Ocultar gráfico diário' : 'Mostrar gráfico diário';
      button.title = label;
      button.setAttribute('aria-label', label);
    }
    if (!shouldShow) {
      destroyDailyChart();
      return;
    }
    const canvas = document.getElementById('financeCalendarDailyChart');
    if (!canvas || typeof global.Chart !== 'function') return;
    const context = global.FinanceCalendarUtils.getMonthContext(month);
    const labels = [];
    const values = [];
    for (let day = 1; day <= context.daysInMonth; day += 1) {
      labels.push(String(day).padStart(2, '0'));
      values.push(Number(state.variableTotalsByDay?.[day] || 0));
    }
    destroyDailyChart();
    dailyChartInstance = new global.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Gastos diários',
          data: values,
          borderColor: '#6f66d8',
          backgroundColor: 'rgba(111,102,216,.12)',
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 3,
          fill: true,
          tension: 0.28
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback(value) {
                return typeof global.fmt === 'function' ? global.fmt(Number(value || 0)) : String(value);
              }
            }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  function renderCalendarContent() {
    const month = getCurrentMonthSafe();
    if (!month) return;
    state.monthId = month.id;
    recomputeCalendarState(month);
    const context = global.FinanceCalendarUtils.getMonthContext(month);
    const root = document.getElementById('financeCalendarGridMount');
    if (!root) return;
    root.innerHTML = global.FinanceCalendarRender.renderGrid(month, {
      year: context.year,
      monthIndex: context.monthIndex,
      daysInMonth: context.daysInMonth,
      selectedDay: state.selectedDay,
      intensityByDay: state.dayIntensities,
      variableTotalsByDay: state.variableTotalsByDay,
      eventsByDay: state.eventsByDay,
      importantMarkersByDay: state.importantMarkersByDay,
      eventsList: Array.isArray(month?.calendarEvents) ? month.calendarEvents : []
    });
    const monthLabel = document.getElementById('financeCalendarMonthLabel');
    if (monthLabel) monthLabel.textContent = month.nome;
    renderSelectedDayPanel();
    renderDailyChart(month);
  }

  function renderSelectedDayPanel() {
    const month = getCurrentMonthSafe();
    const layout = document.querySelector('#modalFinanceCalendar .finance-calendar-layout');
    if (!month || !state.selectedDay || state.selectedDay < 1) {
      if (layout) layout.classList.remove('has-side-panel');
      global.FinanceCalendarRender.renderSidePanel(month, 0, { outflows: 0, incomes: 0, launches: [], paymentItems: [], receivingItems: [] }, [], '');
      return;
    }
    if (layout) layout.classList.add('has-side-panel');
    const dayLedger = global.FinanceCalendarUtils.getDayLedger(month, state.selectedDay);
    const events = state.eventsByDay[state.selectedDay] || [];
    if (state.selectedEventId && !events.some(event => String(event?.id || '') === String(state.selectedEventId))) {
      state.selectedEventId = '';
    }
    global.FinanceCalendarRender.renderSidePanel(month, state.selectedDay, dayLedger, events, state.selectedEventId);
  }

  function openCalendarModal() {
    const month = getCurrentMonthSafe();
    if (!month) return;
    ensureMonthCalendarState(month);
    state.selectedDay = 0;
    state.selectedEventId = '';
    if (typeof global.openModal === 'function') global.openModal('modalFinanceCalendar');
    renderCalendarContent();
  }

  function closeCalendarModal() {
    state.selectedDay = 0;
    state.selectedEventId = '';
    if (typeof global.closeModal === 'function') global.closeModal('modalFinanceCalendar');
    destroyDailyChart();
    hideDayTooltip();
  }

  function selectDay(day) {
    const nextDay = Number(day || 0);
    if (state.selectedDay === nextDay) {
      state.selectedDay = 0;
      state.selectedEventId = '';
      renderCalendarContent();
      return;
    }
    state.selectedDay = nextDay;
    state.selectedEventId = '';
    renderCalendarContent();
  }

  function focusEvent(eventId) {
    const month = getCurrentMonthSafe();
    if (!month) return;
    const targetId = String(eventId || '').trim();
    if (!targetId) return;
    const events = Array.isArray(month?.calendarEvents) ? month.calendarEvents : [];
    const targetEvent = events.find(event => String(event?.id || '') === targetId);
    if (!targetEvent) return;
    const startDate = global.FinanceCalendarUtils.parseDateInputToDate(targetEvent.startDate);
    const context = global.FinanceCalendarUtils.getMonthContext(month);
    if (startDate && startDate.getFullYear() === context.year && startDate.getMonth() === context.monthIndex) {
      state.selectedDay = startDate.getDate();
    } else {
      const dayWithEvent = Object.keys(state.eventsByDay || {}).find(day =>
        (state.eventsByDay[day] || []).some(event => String(event?.id || '') === targetId));
      if (dayWithEvent) state.selectedDay = Number(dayWithEvent || 0);
    }
    state.selectedEventId = targetId;
    renderCalendarContent();
  }

  function getTooltipPayload(day) {
    const month = getCurrentMonthSafe();
    if (!month) return null;
    const context = global.FinanceCalendarUtils.getMonthContext(month);
    const safeDay = global.FinanceCalendarUtils.clamp(Number(day || 0), 1, context.daysInMonth);
    const date = new Date(context.year, context.monthIndex, safeDay);
    const ledger = global.FinanceCalendarUtils.getDayLedger(month, safeDay);
    return {
      dateLabel: global.FinanceCalendarUtils.formatDateLong(date),
      outflows: ledger.outflows,
      incomes: ledger.incomes,
      events: state.eventsByDay[safeDay] || [],
      paymentItems: Array.isArray(ledger.paymentItems) ? ledger.paymentItems : [],
      paymentTotal: (Array.isArray(ledger.paymentItems) ? ledger.paymentItems : [])
        .reduce((sum, item) => sum + Number(item?.amount || 0), 0)
    };
  }

  function positionTooltip(event) {
    const tooltip = document.getElementById('financeCalendarTooltip');
    if (!tooltip || tooltip.style.display === 'none') return;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const width = tooltip.offsetWidth || 220;
    const height = tooltip.offsetHeight || 110;
    let left = Number(event.clientX || 0) + 14;
    let top = Number(event.clientY || 0) + 14;
    if (left + width > viewportWidth - 12) left = Math.max(12, viewportWidth - width - 12);
    if (top + height > viewportHeight - 12) top = Math.max(12, viewportHeight - height - 12);
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function handleDayHover(event, day) {
    state.tooltipDay = Number(day || 0);
    const payload = getTooltipPayload(day);
    if (!payload) return;
    const tooltip = document.getElementById('financeCalendarTooltip');
    if (!tooltip) return;
    global.FinanceCalendarRender.renderDayTooltip(payload);
    tooltip.style.display = 'block';
    positionTooltip(event);
  }

  function handleDayHoverMove(event) {
    positionTooltip(event);
  }

  function hideDayTooltip() {
    state.tooltipDay = 0;
    const tooltip = document.getElementById('financeCalendarTooltip');
    if (!tooltip) return;
    tooltip.style.display = 'none';
  }

  function openEventModal() {
    const month = getCurrentMonthSafe();
    if (!month) return;
    const context = global.FinanceCalendarUtils.getMonthContext(month);
    const defaultDate = new Date(context.year, context.monthIndex, Math.max(1, state.selectedDay || 1));
    const dateText = `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}-${String(defaultDate.getDate()).padStart(2, '0')}`;
    const nameField = document.getElementById('calendarEventName');
    const startField = document.getElementById('calendarEventStart');
    const endField = document.getElementById('calendarEventEnd');
    const budgetField = document.getElementById('calendarEventBudget');
    const colorField = document.getElementById('calendarEventColor');
    const title = document.getElementById('calendarEventModalTitle');
    const saveBtn = document.getElementById('calendarEventSaveBtn');
    const inlineWrap = document.getElementById('calendarEventTagInlineWrap');
    const inlineInput = document.getElementById('calendarEventTagInlineInput');
    state.editingEventId = '';
    if (nameField) nameField.value = '';
    if (startField) startField.value = dateText;
    if (endField) endField.value = dateText;
    if (budgetField) budgetField.value = '';
    if (colorField) colorField.value = '#9b88f7';
    if (title) title.textContent = 'Novo evento financeiro';
    if (saveBtn) saveBtn.textContent = 'Salvar evento';
    if (inlineInput) inlineInput.value = '';
    if (inlineWrap) inlineWrap.style.display = 'none';
    fillEventTagOptions('');
    if (typeof global.openModal === 'function') global.openModal('modalCalendarEvent');
  }

  function openEditEventModal(eventId) {
    const month = getCurrentMonthSafe();
    if (!month) return;
    ensureMonthCalendarState(month);
    const id = String(eventId || '').trim();
    if (!id) return;
    const event = (month.calendarEvents || []).find(item => String(item?.id || '') === id);
    if (!event) return;
    const nameField = document.getElementById('calendarEventName');
    const startField = document.getElementById('calendarEventStart');
    const endField = document.getElementById('calendarEventEnd');
    const budgetField = document.getElementById('calendarEventBudget');
    const colorField = document.getElementById('calendarEventColor');
    const title = document.getElementById('calendarEventModalTitle');
    const saveBtn = document.getElementById('calendarEventSaveBtn');
    const inlineWrap = document.getElementById('calendarEventTagInlineWrap');
    const inlineInput = document.getElementById('calendarEventTagInlineInput');
    state.editingEventId = id;
    if (nameField) nameField.value = String(event.name || '');
    if (startField) startField.value = String(event.startDate || '');
    if (endField) endField.value = String(event.endDate || '');
    if (budgetField) budgetField.value = Number(event.budget || 0) > 0 ? String(event.budget) : '';
    if (colorField) colorField.value = String(event.color || '#9b88f7');
    if (title) title.textContent = 'Editar evento financeiro';
    if (saveBtn) saveBtn.textContent = 'Salvar edição';
    if (inlineInput) inlineInput.value = '';
    if (inlineWrap) inlineWrap.style.display = 'none';
    fillEventTagOptions(String(event.tagId || ''));
    if (typeof global.openModal === 'function') global.openModal('modalCalendarEvent');
  }

  function removeEvent(eventId) {
    const month = getCurrentMonthSafe();
    if (!month) return;
    ensureMonthCalendarState(month);
    const id = String(eventId || '').trim();
    if (!id) return;
    const event = (month.calendarEvents || []).find(item => String(item?.id || '') === id);
    if (!event) return;
    const applyDelete = () => {
      if (typeof global.recordHistoryState === 'function') global.recordHistoryState();
      month.calendarEvents = (month.calendarEvents || []).filter(item => String(item?.id || '') !== id);
      if (state.selectedEventId === id) state.selectedEventId = '';
      if (typeof global.save === 'function') global.save(true);
      renderCalendarContent();
      if (typeof global.showAppStatus === 'function') global.showAppStatus('Evento removido.', 'Calendário', 'ok');
    };
    if (typeof global.openYesNoQuestion === 'function') {
      global.openYesNoQuestion(`Remover o evento "${event.name || 'Evento'}"?`, applyDelete, () => {});
      return;
    }
    if (window.confirm(`Remover o evento "${event.name || 'Evento'}"?`)) applyDelete();
  }

  function closeEventModal() {
    state.editingEventId = '';
    if (typeof global.closeModal === 'function') global.closeModal('modalCalendarEvent');
  }

  function toggleEventTagInlineInput(forceOpen = false) {
    const select = document.getElementById('calendarEventTag');
    const inlineWrap = document.getElementById('calendarEventTagInlineWrap');
    const inlineInput = document.getElementById('calendarEventTagInlineInput');
    if (!select || !inlineWrap || !inlineInput) return;
    const shouldOpen = forceOpen || select.value === 'nova';
    inlineWrap.style.display = shouldOpen ? 'flex' : 'none';
    if (shouldOpen) {
      requestAnimationFrame(() => inlineInput.focus());
    }
  }

  function confirmEventInlineTag() {
    const select = document.getElementById('calendarEventTag');
    const inlineInput = document.getElementById('calendarEventTagInlineInput');
    if (!select || !inlineInput) return;
    const value = String(inlineInput.value || '').trim();
    if (!value) return;
    fillEventTagOptions(value);
    select.value = value;
    toggleEventTagInlineInput(false);
  }

  function handleEventInlineTagKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      confirmEventInlineTag();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      toggleEventTagInlineInput(false);
    }
  }

  function saveEvent() {
    const month = getCurrentMonthSafe();
    if (!month) return;
    ensureMonthCalendarState(month);
    const name = String(document.getElementById('calendarEventName')?.value || '').trim();
    const startRaw = String(document.getElementById('calendarEventStart')?.value || '').trim();
    const endRaw = String(document.getElementById('calendarEventEnd')?.value || '').trim();
    const budget = Math.max(0, Number(document.getElementById('calendarEventBudget')?.value || 0));
    const color = String(document.getElementById('calendarEventColor')?.value || '#9b88f7').trim() || '#9b88f7';
    let tag = String(document.getElementById('calendarEventTag')?.value || '').trim();
    if (tag === 'nova') {
      tag = String(document.getElementById('calendarEventTagInlineInput')?.value || '').trim();
    }
    if (!name) {
      if (typeof global.showAppStatus === 'function') global.showAppStatus('Informe o nome do evento.', 'Evento', 'error');
      return;
    }
    if (!startRaw || !endRaw) {
      if (typeof global.showAppStatus === 'function') global.showAppStatus('Informe início e fim do evento.', 'Evento', 'error');
      return;
    }
    const payload = {
      id: state.editingEventId || '',
      name,
      startDate: startRaw,
      endDate: endRaw,
      budget,
      color,
      tagId: tag || ''
    };
    if (typeof global.recordHistoryState === 'function') global.recordHistoryState();
    const saved = global.FinanceCalendarEvents.upsertEvent(month, payload);
    if (!saved) {
      if (typeof global.showAppStatus === 'function') global.showAppStatus('Não foi possível salvar o evento.', 'Evento', 'error');
      return;
    }
    if (typeof global.save === 'function') global.save(true);
    state.editingEventId = '';
    closeEventModal();
    renderCalendarContent();
  }

  function refreshIfOpen(currentMonth) {
    const modal = document.getElementById('modalFinanceCalendar');
    if (!modal || !modal.classList.contains('open')) return;
    if (!currentMonth) return;
    if (state.monthId && state.monthId !== currentMonth.id) {
      state.selectedDay = 0;
    }
    renderCalendarContent();
  }

  function toggleChart() {
    state.chartExpanded = !state.chartExpanded;
    const month = getCurrentMonthSafe();
    if (!month) return;
    renderDailyChart(month);
  }

  function renderSharedExpensesModal(eventModel, sharedData) {
    const mount = document.getElementById('calendarSharedExpensesBody');
    if (!mount) return;
    const month = getCurrentMonthSafe();
    const title = document.getElementById('calendarSharedExpensesTitle');
    const subtitle = document.getElementById('calendarSharedExpensesSubtitle');
    if (title) title.textContent = eventModel?.name ? `Gastos compartilhados • ${eventModel.name}` : 'Gastos compartilhados';
    if (subtitle) {
      const start = global.FinanceCalendarUtils.parseDateInputToDate(eventModel?.startDate);
      const end = global.FinanceCalendarUtils.parseDateInputToDate(eventModel?.endDate);
      const periodLabel = start && end
        ? `${start.toLocaleDateString('pt-BR')} até ${end.toLocaleDateString('pt-BR')}`
        : 'Período do evento';
      subtitle.textContent = `${periodLabel} • ${sharedData?.launchesCount || 0} compra(s) compartilhada(s)`;
    }
    const people = Array.isArray(sharedData?.people) ? sharedData.people : [];
    if (!people.length) {
      mount.innerHTML = '<div class="finance-calendar-empty">Não há gastos compartilhados nessa tag/período.</div>';
      return;
    }
    mount.innerHTML = `
      <div class="finance-calendar-shared-sheet-summary">
        <div><span>Total compartilhado</span><strong>${global.fmt(sharedData.totalShared || 0)}</strong></div>
        <div><span>Pendente</span><strong>${global.fmt(sharedData.totalPending || 0)}</strong></div>
      </div>
      <div class="finance-calendar-shared-sheet-list">
        ${people.map(person => `
          <details class="finance-calendar-shared-person">
            <summary>
              <span class="finance-calendar-shared-person-title">
                <span class="finance-calendar-shared-person-caret" aria-hidden="true">▸</span>
                <span class="finance-calendar-shared-person-name">${escapeHtml(person.name)}</span>
              </span>
              <span class="finance-calendar-shared-person-total">${escapeHtml(global.fmt(person.pending || 0))}</span>
            </summary>
            <div class="finance-calendar-shared-person-rows">
              ${person.entries.map(entry => `
                <div class="finance-calendar-shared-entry">
                  <div class="finance-calendar-shared-entry-main">
                    <strong>${escapeHtml(entry.description)}</strong>
                    <small>${escapeHtml(entry.dateLabel)} • ${escapeHtml(entry.monthLabel)}</small>
                  </div>
                  <div class="finance-calendar-shared-entry-values">
                    <span>${escapeHtml(global.fmt(entry.personAmount || 0))}</span>
                    <small>Total ${escapeHtml(global.fmt(entry.totalExpense || 0))}${entry.paid ? ' • Pago' : ''}</small>
                  </div>
                </div>
              `).join('')}
            </div>
          </details>
        `).join('')}
      </div>
    `;
  }

  function openSharedExpensesPanel(eventId = '') {
    const month = getCurrentMonthSafe();
    if (!month) return;
    ensureMonthCalendarState(month);
    const targetId = String(eventId || state.selectedEventId || '').trim();
    const eventModel = (month.calendarEvents || []).find(item => String(item?.id || '') === targetId);
    if (!eventModel) {
      if (typeof global.showAppStatus === 'function') {
        global.showAppStatus('Evento não encontrado para abrir gastos compartilhados.', 'Calendário', 'warning');
      }
      return;
    }
    const sharedData = typeof global.FinanceCalendarEvents.getEventSharedExpensesByPerson === 'function'
      ? global.FinanceCalendarEvents.getEventSharedExpensesByPerson(month, eventModel)
      : { people: [], totalShared: 0, totalPending: 0, launchesCount: 0 };
    renderSharedExpensesModal(eventModel, sharedData);
    if (typeof global.openModal === 'function') global.openModal('modalCalendarSharedExpenses');
  }

  function closeSharedExpensesPanel() {
    if (typeof global.closeModal === 'function') global.closeModal('modalCalendarSharedExpenses');
  }

  global.openFinanceCalendarModal = openCalendarModal;
  global.closeFinanceCalendarModal = closeCalendarModal;
  global.toggleFinanceCalendarChart = toggleChart;
  global.openFinanceCalendarSharedExpenses = openSharedExpensesPanel;
  global.closeFinanceCalendarSharedExpenses = closeSharedExpensesPanel;
  global.openFinanceCalendarEventModal = openEventModal;
  global.closeFinanceCalendarEventModal = closeEventModal;
  global.saveFinanceCalendarEvent = saveEvent;
  global.editFinanceCalendarEvent = openEditEventModal;
  global.deleteFinanceCalendarEvent = removeEvent;
  global.toggleFinanceCalendarEventTagInline = toggleEventTagInlineInput;
  global.confirmFinanceCalendarEventInlineTag = confirmEventInlineTag;
  global.handleFinanceCalendarEventTagKeydown = handleEventInlineTagKeydown;

  global.FinanceCalendar = {
    selectDay,
    focusEvent,
    handleDayHover,
    handleDayHoverMove,
    hideDayTooltip,
    refreshIfOpen,
    render: renderCalendarContent
  };
})(window);
