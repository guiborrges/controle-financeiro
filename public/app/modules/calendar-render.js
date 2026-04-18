(function initFinanceCalendarRender(global) {
  'use strict';

  const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  function escapeHtml(value) {
    const text = String(value ?? '');
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderWeekHeaders() {
    return WEEK_DAYS.map(day => `<div class="finance-calendar-weekday">${day}</div>`).join('');
  }

  function parseDayFromDateKey(value, year, monthIndex) {
    const text = String(value || '').trim();
    if (!text) return 0;
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return 0;
    const y = Number(match[1] || 0);
    const m = Number(match[2] || 0) - 1;
    const d = Number(match[3] || 0);
    if (y !== year || m !== monthIndex) return 0;
    return d > 0 ? d : 0;
  }

  function renderDayMarkers(markers) {
    const payment = markers?.payment === true;
    const receiving = markers?.receiving === true;
    if (!payment && !receiving) return '';
    return `
      <div class="finance-calendar-day-markers">
        ${payment ? `<span class="finance-calendar-day-marker is-payment" title="Dia de pagamento">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 3a4 4 0 0 0-4 4v1.1c0 .8-.24 1.58-.7 2.23L5.6 12.9A2.2 2.2 0 0 0 7.38 16h9.24a2.2 2.2 0 0 0 1.78-3.1l-1.7-2.57A3.98 3.98 0 0 1 16 8.1V7a4 4 0 0 0-4-4Zm0 18a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 21Z"/>
          </svg>
        </span>` : ''}
        ${receiving ? `<span class="finance-calendar-day-marker is-receiving" title="Dia de recebimento">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 4a1 1 0 0 1 1 1v9.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 3.99a1 1 0 0 1-1.4 0l-4-3.99a1 1 0 1 1 1.4-1.42l2.3 2.3V5a1 1 0 0 1 1-1Z"/>
          </svg>
        </span>` : ''}
      </div>
    `;
  }

  function buildDayCell(day, options) {
    const {
      intensityByDay,
      variableTotalsByDay,
      selectedDay,
      importantMarkersByDay
    } = options;
    if (!day) return '<div class="finance-calendar-day is-empty"></div>';
    const intensity = Number(intensityByDay[day] || 0);
    const color = global.FinanceCalendarUtils.getDayIntensityColor(intensity);
    const classes = ['finance-calendar-day'];
    if (selectedDay === day) classes.push('is-selected');
    const dayTotal = Number(variableTotalsByDay[day] || 0);
    const markers = importantMarkersByDay?.[day] || null;
    return `
      <button
        type="button"
        class="${classes.join(' ')}"
        style="background:${escapeHtml(color)}"
        onmouseenter="FinanceCalendar.handleDayHover(event, ${day})"
        onmousemove="FinanceCalendar.handleDayHoverMove(event)"
        onmouseleave="FinanceCalendar.hideDayTooltip()"
        onclick="FinanceCalendar.selectDay(${day})"
      >
        <span class="finance-calendar-day-number">${day}</span>
        ${renderDayMarkers(markers)}
        ${dayTotal > 0 ? `<span class="finance-calendar-day-total">${escapeHtml(global.fmt(dayTotal))}</span>` : ''}
      </button>
    `;
  }

  function buildWeekEventSegments(week, weekIndex, options) {
    const { year, monthIndex, eventsList } = options;
    const daysInWeek = week.filter(day => day > 0);
    if (!daysInWeek.length || !Array.isArray(eventsList) || !eventsList.length) return [];
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    const weekMin = Math.min(...daysInWeek);
    const weekMax = Math.max(...daysInWeek);
    const segments = [];
    eventsList.forEach(event => {
      const startDate = global.FinanceCalendarUtils.parseDateInputToDate(event?.startDate);
      const endDate = global.FinanceCalendarUtils.parseDateInputToDate(event?.endDate);
      if (!startDate || !endDate) return;
      const eventStart = startDate <= endDate ? startDate : endDate;
      const eventEnd = startDate <= endDate ? endDate : startDate;
      if (eventEnd < monthStart || eventStart > monthEnd) return;
      const clampedStart = eventStart < monthStart ? monthStart : eventStart;
      const clampedEnd = eventEnd > monthEnd ? monthEnd : eventEnd;
      const startDay = clampedStart.getDate();
      const endDay = clampedEnd.getDate();
      if (endDay < weekMin || startDay > weekMax) return;
      const from = Math.max(startDay, weekMin);
      const to = Math.min(endDay, weekMax);
      const startCol = week.indexOf(from) + 1;
      const endCol = week.lastIndexOf(to) + 1;
      if (startCol <= 0 || endCol <= 0 || endCol < startCol) return;
      segments.push({
        id: String(event?.id || `${weekIndex}_${startCol}_${endCol}`),
        name: String(event?.name || 'Evento'),
        color: String(event?.color || '#9b88f7'),
        startCol,
        endCol,
        startsInWeek: startDay >= weekMin,
        endsInWeek: endDay <= weekMax
      });
    });
    if (!segments.length) return [];
    segments.sort((a, b) => (a.startCol - b.startCol) || (b.endCol - a.endCol));
    const lanesEnd = [-1, -1, -1];
    const placed = [];
    segments.forEach(segment => {
      let lane = -1;
      for (let idx = 0; idx < lanesEnd.length; idx += 1) {
        if (segment.startCol > lanesEnd[idx]) {
          lane = idx;
          break;
        }
      }
      if (lane < 0) return;
      lanesEnd[lane] = segment.endCol;
      placed.push({ ...segment, lane });
    });
    return placed;
  }

  function renderWeekRow(week, weekIndex, options) {
    const dayCells = week.map(day => buildDayCell(day, options)).join('');
    const segments = buildWeekEventSegments(week, weekIndex, options);
    const eventsLayer = `
        <div class="finance-calendar-week-events-layer ${segments.length ? '' : 'is-empty'}">
          ${segments.map(segment => `
            <div
              class="finance-calendar-week-event-segment lane-${segment.lane} ${segment.startsInWeek ? 'is-start' : 'is-continued-left'} ${segment.endsInWeek ? 'is-end' : 'is-continued-right'}"
              style="--event-start:${segment.startCol};--event-end:${segment.endCol};--event-color:${escapeHtml(segment.color)}"
              title="${escapeHtml(segment.name)}"
              onclick="FinanceCalendar.focusEvent('${escapeHtml(segment.id)}')"
            >
              ${escapeHtml(segment.name)}
            </div>
          `).join('')}
        </div>`;
    return `
      <div class="finance-calendar-week-row">
        <div class="finance-calendar-week-days">${dayCells}</div>
        ${eventsLayer}
      </div>
    `;
  }

  function renderGrid(month, model) {
    const firstWeekDay = new Date(model.year, model.monthIndex, 1).getDay();
    const slots = [];
    for (let i = 0; i < firstWeekDay; i += 1) slots.push(0);
    for (let day = 1; day <= model.daysInMonth; day += 1) slots.push(day);
    while (slots.length % 7 !== 0) slots.push(0);
    const weeks = [];
    for (let idx = 0; idx < slots.length; idx += 7) {
      weeks.push(slots.slice(idx, idx + 7));
    }
    return `
      <div class="finance-calendar-grid-head">${renderWeekHeaders()}</div>
      <div class="finance-calendar-grid-body">
        ${weeks.map((week, index) => renderWeekRow(week, index, model)).join('')}
      </div>
    `;
  }

  function renderLaunchRows(launches) {
    if (!launches.length) {
      return '<div class="finance-calendar-empty">Nenhum lancamento neste dia.</div>';
    }
    return launches.map(item => {
      const visual = typeof global.inferCategoryVisual === 'function'
        ? global.inferCategoryVisual(item?.category || 'OUTROS')
        : { icon: '🏷️', label: String(item?.category || 'OUTROS') };
      return `
        <div class="finance-calendar-launch-row">
          <div class="finance-calendar-launch-main">
            <span class="finance-calendar-launch-emoji">${escapeHtml(visual.icon || '🏷️')}</span>
            <div>
              <div class="finance-calendar-launch-title">${escapeHtml(item?.description || 'Sem descricao')}</div>
              <div class="finance-calendar-launch-sub">${escapeHtml(visual.label || item?.category || 'Categoria')}</div>
            </div>
          </div>
          <div class="finance-calendar-launch-value">${escapeHtml(global.fmt(item?.amount || 0))}</div>
        </div>
      `;
    }).join('');
  }

  function renderSidePanel(month, selectedDay, dayLedger, dayEvents, selectedEventId = '') {
    const panel = document.getElementById('financeCalendarSidePanel');
    if (!panel) return;
    if (!selectedDay) {
      panel.classList.remove('is-open');
      panel.innerHTML = '';
      return;
    }
    const context = global.FinanceCalendarUtils.getMonthContext(month);
    const date = new Date(context.year, context.monthIndex, selectedDay);
    const impact = global.FinanceCalendarUtils.calculateDayImpact(month, dayLedger.outflows);
    const focusedEvent = (dayEvents || []).find(event => String(event?.id || '') === String(selectedEventId || '')) || null;
    if (focusedEvent) {
      const spent = global.FinanceCalendarEvents.getEventSpentValue(month, focusedEvent);
      const budget = Math.max(0, Number(focusedEvent.budget || 0));
      const remaining = budget - spent;
      const eventTags = typeof global.FinanceCalendarEvents.getEventTags === 'function'
        ? global.FinanceCalendarEvents.getEventTags(month, focusedEvent)
        : [];
      const linkedLaunches = typeof global.FinanceCalendarEvents.getEventLinkedLaunches === 'function'
        ? global.FinanceCalendarEvents.getEventLinkedLaunches(month, focusedEvent)
        : [];
      const startDate = global.FinanceCalendarUtils.parseDateInputToDate(focusedEvent.startDate);
      const endDate = global.FinanceCalendarUtils.parseDateInputToDate(focusedEvent.endDate);
      const periodLabel = startDate && endDate
        ? `${startDate.toLocaleDateString('pt-BR')} até ${endDate.toLocaleDateString('pt-BR')}`
        : 'Período indefinido';
      panel.innerHTML = `
        <div class="finance-calendar-side-head">
          <h4>Evento selecionado</h4>
        </div>
        <div class="finance-calendar-side-panel-body">
        <div class="finance-calendar-event-focus-card">
          <div class="finance-calendar-event-focus-title-row">
            <div class="finance-calendar-event-budget-title">
              <span class="finance-calendar-event-budget-dot" style="background:${escapeHtml(focusedEvent.color)}"></span>
              ${escapeHtml(focusedEvent.name || 'Evento')}
            </div>
            <div class="finance-calendar-event-focus-actions">
              <button class="btn-edit" type="button" title="Editar evento" onclick="editFinanceCalendarEvent('${escapeHtml(focusedEvent.id || '')}')">✎</button>
              <button class="btn-icon" type="button" title="Excluir evento" onclick="deleteFinanceCalendarEvent('${escapeHtml(focusedEvent.id || '')}')">✕</button>
            </div>
          </div>
          <div class="finance-calendar-event-focus-sub">${escapeHtml(periodLabel)}</div>
          <div class="finance-calendar-side-metrics">
            <div><span>Orçamento</span><strong>${escapeHtml(global.fmt(budget))}</strong></div>
            <div><span>Gasto no evento</span><strong>${escapeHtml(global.fmt(spent))}</strong></div>
            <div><span>Saldo do evento</span><strong>${escapeHtml(global.fmtSigned(remaining))}</strong></div>
            <div><span>Tag</span><strong>${escapeHtml(focusedEvent.tagId || 'Sem tag')}</strong></div>
          </div>
          <div class="finance-calendar-side-block" style="margin-top:8px;margin-bottom:0">
            <h5>Tags dos gastos no período</h5>
            ${eventTags.length
              ? `<div class="finance-calendar-event-tags-wrap">${eventTags.map(tag => `<span class="finance-calendar-event-tag-chip">${escapeHtml(tag)}</span>`).join('')}</div>`
              : '<div class="finance-calendar-empty">Sem tags vinculadas aos gastos deste evento.</div>'}
          </div>
          <div class="finance-calendar-side-block" style="margin-top:10px;margin-bottom:0">
            <h5>Gastos vinculados</h5>
            ${linkedLaunches.length
              ? linkedLaunches.map(item => `
                <div class="finance-calendar-mini-row">
                  <span>${escapeHtml(item.description)} <small style="color:var(--text3)">• ${escapeHtml(item.dateLabel)}</small></span>
                  <strong>${escapeHtml(global.fmt(item.amount || 0))}</strong>
                </div>
              `).join('')
              : '<div class="finance-calendar-empty">Sem gastos vinculados para este evento.</div>'}
          </div>
        </div>
        </div>
      `;
      panel.classList.add('is-open');
      return;
    }
    const eventRows = dayEvents.length
      ? dayEvents.map(event => {
          const spent = global.FinanceCalendarEvents.getEventSpentValue(month, event);
          const isActive = String(selectedEventId || '') === String(event?.id || '');
          return `
            <div class="finance-calendar-event-budget-row ${isActive ? 'is-active' : ''}" onclick="FinanceCalendar.focusEvent('${escapeHtml(event?.id || '')}')">
              <div class="finance-calendar-event-budget-title">
                <span class="finance-calendar-event-budget-dot" style="background:${escapeHtml(event.color)}"></span>
                ${escapeHtml(event.name)}
              </div>
              <div class="finance-calendar-event-budget-values">
                <span>${escapeHtml(global.fmt(spent))}</span>
                <small>de ${escapeHtml(global.fmt(event.budget || 0))}</small>
              </div>
            </div>
          `;
        }).join('')
      : '<div class="finance-calendar-empty">Sem eventos neste dia.</div>';
    const paymentRows = (dayLedger?.paymentItems || []).length
      ? (dayLedger.paymentItems || []).map(item => `
        <div class="finance-calendar-mini-row">
          <span>${escapeHtml(item.description || 'Pagamento')}</span>
          <strong>${escapeHtml(global.fmt(item.amount || 0))}</strong>
        </div>`).join('')
      : '<div class="finance-calendar-empty">Sem pagamentos previstos neste dia.</div>';
    const receivingRows = (dayLedger?.receivingItems || []).length
      ? (dayLedger.receivingItems || []).map(item => `
        <div class="finance-calendar-mini-row">
          <span>${escapeHtml(item.description || 'Recebimento')}</span>
          <strong>${escapeHtml(global.fmt(item.amount || 0))}</strong>
        </div>`).join('')
      : '<div class="finance-calendar-empty">Sem recebimentos previstos neste dia.</div>';

    panel.innerHTML = `
      <div class="finance-calendar-side-head">
        <h4>${escapeHtml(global.FinanceCalendarUtils.formatDateLong(date))}</h4>
      </div>
      <div class="finance-calendar-side-panel-body">
        <div class="finance-calendar-side-metrics">
          <div><span>Saidas</span><strong>${escapeHtml(global.fmt(dayLedger.outflows))}</strong></div>
          <div><span>Entradas</span><strong>${escapeHtml(global.fmt(dayLedger.incomes))}</strong></div>
          <div><span>Resultado</span><strong>${escapeHtml(global.fmtSigned(dayLedger.incomes - dayLedger.outflows))}</strong></div>
          <div><span>Impacto no mes</span><strong>${impact.toFixed(1)}%</strong></div>
        </div>
        <div class="finance-calendar-side-block">
          <h5>Pagamentos do dia</h5>
          ${paymentRows}
        </div>
        <div class="finance-calendar-side-block">
          <h5>Recebimentos do dia</h5>
          ${receivingRows}
        </div>
        <div class="finance-calendar-side-block">
          <h5>Eventos</h5>
          ${eventRows}
        </div>
        <div class="finance-calendar-side-block">
          <h5>Lancamentos</h5>
          ${renderLaunchRows(dayLedger.launches)}
        </div>
      </div>
    `;
    panel.classList.add('is-open');
  }

  function renderDayTooltip(payload) {
    const tooltip = document.getElementById('financeCalendarTooltip');
    if (!tooltip) return;
    const eventsLabel = payload.events.length
      ? `${payload.events.length} evento(s)`
      : 'Sem eventos';
    tooltip.innerHTML = `
      <div class="finance-calendar-tooltip-title">${escapeHtml(payload.dateLabel)}</div>
      <div class="finance-calendar-tooltip-row"><span>Saidas</span><strong>${escapeHtml(global.fmt(payload.outflows))}</strong></div>
      <div class="finance-calendar-tooltip-row"><span>Entradas</span><strong>${escapeHtml(global.fmt(payload.incomes))}</strong></div>
      <div class="finance-calendar-tooltip-row"><span>Eventos</span><strong>${escapeHtml(eventsLabel)}</strong></div>
    `;
  }

  global.FinanceCalendarRender = {
    renderGrid,
    renderSidePanel,
    renderDayTooltip
  };
})(window);
