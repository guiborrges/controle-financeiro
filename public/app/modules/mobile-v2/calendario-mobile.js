(function initMobileV2Calendario(global) {
  'use strict';

  function escapeHtml(value) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(value) {
    if (typeof global.fmt === 'function') return global.fmt(Number(value || 0));
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function getCurrentMonth() {
    return typeof global.getCurrentMonth === 'function' ? global.getCurrentMonth() : null;
  }

  const PT_MONTH_INDEX = {
    janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5,
    julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
  };

  function resolveMonthDate(month) {
    const id = String(month?.id || '').toLowerCase();
    const parts = id.split('_');
    if (parts.length === 2 && PT_MONTH_INDEX[parts[0]] !== undefined) {
      const year = Number(parts[1]);
      if (year > 1900) return new Date(year, PT_MONTH_INDEX[parts[0]], 1);
    }
    const nome = String(month?.nome || '').toLowerCase();
    const nomeParts = nome.split(' ');
    if (nomeParts.length >= 2 && PT_MONTH_INDEX[nomeParts[0]] !== undefined) {
      const year = Number(nomeParts[nomeParts.length - 1]);
      if (year > 1900) return new Date(year, PT_MONTH_INDEX[nomeParts[0]], 1);
    }
    return new Date();
  }

  function getCategorySymbol(categoryName) {
    const safeCategory = String(categoryName || 'OUTROS');
    if (typeof global.renderSmartIconBadge === 'function' && typeof global.inferCategoryVisual === 'function') {
      const visual = global.inferCategoryVisual(safeCategory);
      return global.renderSmartIconBadge(visual.icon, visual.tone);
    }
    const emoji = typeof global.getCategoryEmoji === 'function' ? global.getCategoryEmoji(safeCategory) : '';
    return escapeHtml(String(emoji || '•'));
  }

  function collectDayLedgerMap(month) {
    const context = typeof global.FinanceCalendarUtils?.getMonthContext === 'function'
      ? global.FinanceCalendarUtils.getMonthContext(month)
      : null;
    const daysInMonth = Number(context?.daysInMonth || new Date().getDate());
    const map = new Map();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const ledger = typeof global.FinanceCalendarUtils?.getDayLedger === 'function'
        ? global.FinanceCalendarUtils.getDayLedger(month, day)
        : { outflows: 0, launches: [] };
      map.set(day, ledger || { outflows: 0, launches: [] });
    }
    return { map, context };
  }

  function buildMonthMatrix(date) {
    const firstWeekday = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function monthTitle(month) {
    const safe = String(month?.nome || '').trim();
    return safe || 'Calendário';
  }

  function getEventsForDay(month, day) {
    if (!month || !day) return [];
    const baseDate = resolveMonthDate(month);
    const yyyyMmDd = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return (Array.isArray(month?.calendarEvents) ? month.calendarEvents : []).filter((event) => {
      const start = String(event?.startDate || '');
      const end = String(event?.endDate || start);
      return start <= yyyyMmDd && yyyyMmDd <= end;
    });
  }

  function openDaySheet(day, items, title, month) {
    if (!global.MobileV2OutflowForm?.openInlineSheet) {
      return;
    }
    const events = getEventsForDay(month || getCurrentMonth(), day);
    const eventRows = events.map((event) => `
      <article class="m-item m-item-income">
        <div class="m-item-surface static" data-action="edit-event" data-id="${escapeHtml(String(event?.id || ''))}">
          <div class="m-item-cat-icon" style="background:${escapeHtml(String(event?.color || '#9b88f7'))};color:#fff">●</div>
          <div class="m-item-info">
            <span class="m-item-name">${escapeHtml(String(event?.name || 'Evento financeiro'))}</span>
            <span class="m-item-meta">Evento · ${escapeHtml(String(event?.startDate || ''))}${event?.endDate ? ` até ${escapeHtml(String(event.endDate))}` : ''}</span>
          </div>
          <span class="m-item-value">${Number(event?.budget || 0) > 0 ? formatMoney(event.budget) : 'Editar'}</span>
        </div>
      </article>
    `).join('');
    const rows = (items || []).map((item) => {
      const category = String(item?.category || item?.categoria || 'OUTROS');
      const icon = getCategorySymbol(category);
      const amount = typeof global.getUnifiedEffectiveOutflowAmount === 'function'
        ? global.getUnifiedEffectiveOutflowAmount(item)
        : Math.abs(Number(item?.amount || item?.valor || 0));
      return `
        <article class="m-item m-item-income">
          <div class="m-item-surface static" data-action="edit" data-id="${escapeHtml(String(item?.id || ''))}">
            <div class="m-item-info">
              <span class="m-item-name">${escapeHtml(String(item?.description || 'Lançamento'))}</span>
              <span class="m-item-meta">${escapeHtml(String(item?.date || ''))} · ${icon} ${escapeHtml(category)}</span>
            </div>
            <span class="m-item-value">${formatMoney(amount)}</span>
          </div>
        </article>
      `;
    }).join('');

    global.MobileV2OutflowForm.openInlineSheet({
      title: `${title} · dia ${day}`,
      subtitle: `${items.length} lançamento(s) · ${events.length} evento(s)`,
      body: eventRows + rows || '<div class="m2-empty">Sem lançamentos ou eventos neste dia.</div>'
    });

    setTimeout(() => {
      const sheet = document.getElementById('mobileV2OutflowSheet');
      sheet?.querySelectorAll('[data-action="edit"]').forEach((el) => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-id');
          const item = (getCurrentMonth()?.outflows || []).find((entry) => String(entry?.id || '') === String(id || ''));
          if (id && global.MobileV2OutflowForm?.openEdit && item) {
            global.MobileV2OutflowForm.openEdit(item);
          } else if (id && typeof global.openUnifiedOutflowModal === 'function') {
            global.MobileV2OutflowForm?.close?.();
            global.openUnifiedOutflowModal(id);
          }
        });
      });
      sheet?.querySelectorAll('[data-action="edit-event"]').forEach((el) => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-id');
          if (id && typeof global.openFinanceCalendarEditEventModal === 'function') {
            global.MobileV2OutflowForm?.closeInlineSheet?.();
            global.openFinanceCalendarEditEventModal(id);
          }
        });
      });
    }, 0);
  }

  function prevMonth() {
    const allMonths = typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : [];
    const current = getCurrentMonth();
    const idx = allMonths.findIndex((m) => m?.id === current?.id);
    if (idx <= 0 || typeof global.selectMonth !== 'function') return;
    global.selectMonth(allMonths[idx - 1].id);
    global.MobileV2?.refresh?.();
  }

  function nextMonth() {
    const allMonths = typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : [];
    const current = getCurrentMonth();
    const idx = allMonths.findIndex((m) => m?.id === current?.id);
    if (idx < 0 || idx >= allMonths.length - 1 || typeof global.selectMonth !== 'function') return;
    global.selectMonth(allMonths[idx + 1].id);
    global.MobileV2?.refresh?.();
  }

  function render(target) {
    if (!target) return;
    const month = getCurrentMonth();
    if (!month) {
      target.innerHTML = '<div class="m2-empty">Sem mês selecionado para calendário.</div>';
      return;
    }

    const date = resolveMonthDate(month);
    const dayLedgerContext = collectDayLedgerMap(month);
    const dayMap = dayLedgerContext.map;
    const dayContext = dayLedgerContext.context;
    const cells = buildMonthMatrix(new Date(date.getFullYear(), date.getMonth(), 1));
    const totalsByDay = {};
    dayMap.forEach((ledger, day) => {
      totalsByDay[day] = Number(ledger?.outflows || 0);
    });
    const intensities = typeof global.FinanceCalendarUtils?.computeIntensitiesFromTotals === 'function'
      ? global.FinanceCalendarUtils.computeIntensitiesFromTotals(totalsByDay, month)
      : {};

    target.innerHTML = `
      <header class="m2-header m2-page-header">
        <div>
          <h2 class="m2-title">Calendário</h2>
          <p class="m2-subtitle">Visão diária dos lançamentos</p>
        </div>
        <div class="m2-header-actions">
          <button class="m2-icon-btn" type="button" aria-label="Novo evento" onclick="window.openFinanceCalendarEventModal && window.openFinanceCalendarEventModal()">${global.SystemIcons?.render ? global.SystemIcons.render('plus') : '+'}</button>
          <button class="m2-icon-btn" type="button" aria-label="Perfil" onclick="MobileV2PerfilSheet.open()">${global.SystemIcons?.render ? global.SystemIcons.render('user') : ''}</button>
        </div>
      </header>

      <section class="m-list-card">
        <div class="cal-header">
          <button class="m2-icon-btn" type="button" aria-label="Mês anterior" onclick="MobileV2Calendario.prevMonth()">&lt;</button>
          <span class="cal-month-title">${escapeHtml(monthTitle(month))}</span>
          <button class="m2-icon-btn" type="button" aria-label="Próximo mês" onclick="MobileV2Calendario.nextMonth()">&gt;</button>
        </div>
        <div class="m2-calendar-actions">
          <button class="m2-chip-btn" type="button" onclick="window.openFinanceCalendarEventModal && window.openFinanceCalendarEventModal()">+ Evento</button>
          <button class="m2-chip-btn" type="button" onclick="window.openFinanceCalendarModal && window.openFinanceCalendarModal(); setTimeout(function(){ window.toggleFinanceCalendarChart && window.toggleFinanceCalendarChart(); }, 0)">Gráfico diário</button>
          <button class="m2-chip-btn" type="button" onclick="MobileV2Calendario.openSharedExpenses()">Despesas compartilhadas</button>
        </div>
        <div class="cal-grid">
          ${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => `<div class="cal-weekday">${d}</div>`).join('')}
          ${cells.map((day) => {
            if (!day) return '<div class="cal-day-empty"></div>';
            const ledger = dayMap.get(day) || { outflows: 0, launches: [] };
            const items = ledger?.launches || [];
            const total = Number(ledger?.outflows || 0);
            const intensity = Number(intensities?.[day] || 0);
            const tone = typeof global.FinanceCalendarUtils?.getDayIntensityColor === 'function'
              ? global.FinanceCalendarUtils.getDayIntensityColor(intensity)
              : null;
            return `
              <button type="button" class="cal-day ${items.length ? 'has-items' : ''}" data-cal-day="${day}" ${tone ? `style="background:${escapeHtml(tone)}"` : ''}>
                <span class="cal-day-num">${day}</span>
                ${items.length ? '<span class="cal-day-dot"></span>' : ''}
                ${total > 0 ? `<span class="cal-day-total">${escapeHtml(formatMoney(total))}</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </section>
    `;

    target.querySelectorAll('[data-cal-day]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const day = Number(btn.getAttribute('data-cal-day') || 0);
        if (!day) return;
        const launches = (dayMap.get(day) || { launches: [] }).launches || [];
        openDaySheet(day, launches, monthTitle(month), month);
      });
    });
  }

  global.MobileV2Calendario = {
    render,
    prevMonth,
    nextMonth,
    openSharedExpenses() {
      const month = getCurrentMonth();
      const events = Array.isArray(month?.calendarEvents) ? month.calendarEvents : [];
      const eventWithShared = events.find((event) => {
        try {
          const data = typeof global.FinanceCalendarEvents?.getEventSharedExpensesByPerson === 'function'
            ? global.FinanceCalendarEvents.getEventSharedExpensesByPerson(month, event)
            : null;
          return Number(data?.launchesCount || 0) > 0 || Number(data?.totalShared || 0) > 0;
        } catch {
          return false;
        }
      });
      if (eventWithShared?.id && typeof global.openFinanceCalendarSharedExpenses === 'function') {
        global.openFinanceCalendarSharedExpenses(eventWithShared.id);
        return;
      }
      if (typeof global.showToast === 'function') global.showToast('Nenhum evento com despesas compartilhadas neste mês.');
    }
  };
})(window);

