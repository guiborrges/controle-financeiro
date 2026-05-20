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

  function parseMonthDate(text) {
    const normalized = typeof global.normalizeVarDate === 'function' ? global.normalizeVarDate(String(text || '')) : String(text || '');
    const parts = normalized.split('/').map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
    const year = parts[2] > 99 ? parts[2] : 2000 + parts[2];
    const date = new Date(year, parts[1] - 1, parts[0]);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  function toDayNumber(text) {
    const date = parseMonthDate(text);
    return date ? date.getDate() : null;
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

  function collectDayMap(month) {
    const map = new Map();
    const outflows = Array.isArray(month?.outflows) ? month.outflows : [];
    outflows.forEach((item) => {
      if (String(item?.type || '').toLowerCase() === 'recurring') return;
      const day = toDayNumber(item?.date);
      if (!day) return;
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(item);
    });
    return map;
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

  function openDaySheet(day, items, title) {
    if (!global.MobileV2OutflowForm?.openInlineSheet) {
      return;
    }
    const rows = (items || []).map((item) => {
      const category = String(item?.category || item?.categoria || 'OUTROS');
      const icon = typeof global.getCategoryEmoji === 'function' ? global.getCategoryEmoji(category) : '•';
      const amount = Math.abs(Number(item?.amount || item?.valor || 0));
      return `
        <article class="m-item m-item-income">
          <div class="m-item-surface static" data-action="edit" data-id="${escapeHtml(String(item?.id || ''))}">
            <div class="m-item-info">
              <span class="m-item-name">${escapeHtml(String(item?.description || 'Lançamento'))}</span>
              <span class="m-item-meta">${escapeHtml(String(item?.date || ''))} · ${escapeHtml(icon)} ${escapeHtml(category)}</span>
            </div>
            <span class="m-item-value">${formatMoney(amount)}</span>
          </div>
        </article>
      `;
    }).join('');

    global.MobileV2OutflowForm.openInlineSheet({
      title: `${title} · dia ${day}`,
      subtitle: items.length ? `${items.length} lançamento(s)` : 'Sem lançamentos neste dia',
      body: rows || '<div class="m2-empty">Sem lançamentos neste dia.</div>'
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
    const dayMap = collectDayMap(month);
    const cells = buildMonthMatrix(new Date(date.getFullYear(), date.getMonth(), 1));

    target.innerHTML = `
      <header class="m2-header m2-page-header">
        <div>
          <h2 class="m2-title">Calendário</h2>
          <p class="m2-subtitle">Visão diária dos lançamentos</p>
        </div>
        <div class="m2-header-actions">
          <button class="m2-icon-btn" type="button" aria-label="Tags" onclick="MobileV2FiltersSheet.open()">${global.SystemIcons?.render ? global.SystemIcons.render('tag') : ''}</button>
          <button class="m2-icon-btn" type="button" aria-label="Perfil" onclick="MobileV2PerfilSheet.open()">${global.SystemIcons?.render ? global.SystemIcons.render('user') : ''}</button>
        </div>
      </header>

      <section class="m-list-card">
        <div class="cal-header">
          <button class="m2-icon-btn" type="button" aria-label="Mês anterior" onclick="MobileV2Calendario.prevMonth()">${global.SystemIcons?.render ? global.SystemIcons.render('chev-left') : '‹'}</button>
          <span class="cal-month-title">${escapeHtml(monthTitle(month))}</span>
          <button class="m2-icon-btn" type="button" aria-label="Próximo mês" onclick="MobileV2Calendario.nextMonth()">${global.SystemIcons?.render ? global.SystemIcons.render('chev-right') : '›'}</button>
        </div>
        <div class="cal-grid">
          ${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => `<div class="cal-weekday">${d}</div>`).join('')}
          ${cells.map((day) => {
            if (!day) return '<div class="cal-day-empty"></div>';
            const items = dayMap.get(day) || [];
            const total = items.reduce((sum, item) => sum + Math.abs(Number(item?.amount || item?.valor || 0)), 0);
            return `
              <button type="button" class="cal-day ${items.length ? 'has-items' : ''}" data-cal-day="${day}">
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
        openDaySheet(day, dayMap.get(day) || [], monthTitle(month));
      });
    });
  }

  global.MobileV2Calendario = {
    render,
    prevMonth,
    nextMonth
  };
})(window);

