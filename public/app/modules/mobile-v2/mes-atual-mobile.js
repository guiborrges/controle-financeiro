(function initMobileV2Mes(global) {
  'use strict';

  const SUBTABS = ['resumo', 'gastos', 'todos', 'renda', 'metas'];
  let activeSubtab = 'resumo';

  function haptic(type = 'light') {
    if (!navigator.vibrate) return;
    const patterns = { light: [10], medium: [20], heavy: [40], error: [30, 50, 30] };
    navigator.vibrate(patterns[type] || patterns.light);
  }

  function formatMoney(value) {
    if (typeof global.fmt === 'function') return global.fmt(Number(value || 0));
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function ensureMonthUI(month) {
    if (!month) return;
    month.mobileV2 = month.mobileV2 || {};
    if (!SUBTABS.includes(month.mobileV2.subtab)) month.mobileV2.subtab = activeSubtab;
    if (typeof month.mobileV2.allSearch !== 'string') month.mobileV2.allSearch = '';
    activeSubtab = month.mobileV2.subtab;
  }

  function parseDateScore(raw) {
    const text = String(raw || '').trim();
    if (!text) return 0;
    const normalized = typeof global.normalizeVarDate === 'function' ? global.normalizeVarDate(text) : text;
    const parts = String(normalized || '').split('/');
    if (parts.length !== 3) return 0;
    const [dd, mm, yy] = parts.map(Number);
    const yyyy = yy > 99 ? yy : (2000 + yy);
    return new Date(yyyy, (mm || 1) - 1, dd || 1).getTime() || 0;
  }

  function getMonthMetrics(month) {
    const renda = (month?.renda || []).reduce((acc, item) => acc + Number(item?.valor || 0), 0);
    const projetos = (month?.projetos || []).reduce((acc, item) => acc + Number(item?.valor || 0), 0);
    let despesas = 0;

    (month?.outflows || []).forEach((item) => {
      if (item?.countsInPrimaryTotals === false) return;
      const value = Math.abs(Number(item?.amount || 0));
      if (!value) return;
      const kind = String(item?.outputKind || '').toLowerCase();
      if (kind === 'card' && String(item?.type || '').toLowerCase() === 'spend') return;
      despesas += value;
    });

    (month?.cardBills || []).forEach((bill) => {
      despesas += Math.abs(Number(bill?.amount || 0));
    });

    return {
      renda: renda + projetos,
      despesas,
      resultado: (renda + projetos) - despesas
    };
  }

  function getOutflowRows(month) {
    return [...(month?.outflows || [])]
      .filter((item) => Number(item?.amount || 0) > 0)
      .sort((a, b) => parseDateScore(b?.date) - parseDateScore(a?.date));
  }

  function getOutflowCategory(item) {
    return String(global.resolveCategoryName
      ? global.resolveCategoryName(item?.category || item?.categoria || 'OUTROS')
      : (item?.category || 'OUTROS'));
  }

  function escapeId(value) {
    return String(value || '').replace(/"/g, '&quot;');
  }

  function renderMonthNav(month) {
    const metrics = getMonthMetrics(month);
    return `
      <div class="m2-month-nav">
        <div class="m2-month-nav-row">
          <button class="m2-icon-btn" type="button" onclick="MobileV2MesAtual.prevMonth()" aria-label="Mês anterior">←</button>
          <div class="m2-month-title">${global.escapeHtml ? global.escapeHtml(String(month?.nome || 'Mês')) : String(month?.nome || 'Mês')}</div>
          <button class="m2-icon-btn" type="button" onclick="MobileV2MesAtual.nextMonth()" aria-label="Próximo mês">→</button>
        </div>
        <div class="m2-month-metrics">
          <div class="m2-mini-metric"><div class="m2-mini-label">Renda</div><div class="m2-mini-value">${formatMoney(metrics.renda)}</div></div>
          <div class="m2-mini-metric"><div class="m2-mini-label">Despesas</div><div class="m2-mini-value">${formatMoney(metrics.despesas)}</div></div>
          <div class="m2-mini-metric"><div class="m2-mini-label">Resultado</div><div class="m2-mini-value">${formatMoney(metrics.resultado)}</div></div>
        </div>
      </div>
    `;
  }

  function renderSubtabs() {
    return `
      <div class="m2-subtabs" role="tablist" aria-label="Visões do mês">
        ${SUBTABS.map((tab) => `<button type="button" class="m2-subtab ${activeSubtab === tab ? 'active' : ''}" data-m2-subtab="${tab}">${tab.charAt(0).toUpperCase() + tab.slice(1)}</button>`).join('')}
      </div>
    `;
  }

  function renderSwipeableOutflow(item) {
    const id = String(item?.id || '');
    const desc = String(item?.description || 'Lançamento');
    const date = String(item?.date || '');
    const category = getOutflowCategory(item);
    const icon = global.getCategoryEmoji ? global.getCategoryEmoji(category) : '•';
    const amount = Math.abs(Number(item?.amount || 0));
    const paid = item?.paid === true;

    return `
      <article class="m2-outflow-item" data-outflow-id="${escapeId(id)}">
        <div class="m2-swipe-actions" aria-hidden="true">
          <button class="m2-swipe-btn" type="button" data-action="edit" data-id="${escapeId(id)}" aria-label="Editar">✎</button>
          <button class="m2-swipe-btn ${paid ? 'positive' : ''}" type="button" data-action="paid" data-id="${escapeId(id)}" data-paid="${paid ? '1' : '0'}" aria-label="Pago">${paid ? '✓' : '◻'}</button>
          <button class="m2-swipe-btn danger" type="button" data-action="delete" data-id="${escapeId(id)}" aria-label="Excluir">✕</button>
        </div>
        <div class="m2-outflow-surface" data-open-edit="${escapeId(id)}">
          <span class="m2-icon-pill">${icon}</span>
          <span>
            <p class="m2-row-title">${global.escapeHtml ? global.escapeHtml(desc) : desc}</p>
            <div class="m2-row-meta">${global.escapeHtml ? global.escapeHtml(date) : date} · ${global.escapeHtml ? global.escapeHtml(category) : category}${paid ? ' · Pago' : ''}</div>
          </span>
          <span class="m2-row-amount negative">${formatMoney(amount)}</span>
        </div>
      </article>
    `;
  }

  function renderResumo(month) {
    const all = getOutflowRows(month);
    const fixed = all.filter((item) => String(item?.type || '').toLowerCase() === 'expense');
    const spends = all.filter((item) => String(item?.type || '').toLowerCase() !== 'expense');
    return `
      <div class="m2-tab-panel ${activeSubtab === 'resumo' ? 'active' : ''}" data-tab-panel="resumo">
        <section class="m2-card">
          <h3 class="m2-card-title">Compromissos do mês</h3>
          ${fixed.length ? fixed.slice(0, 10).map(renderSwipeableOutflow).join('') : '<div class="m2-empty">Sem compromissos registrados.</div>'}
        </section>
        <section class="m2-card">
          <h3 class="m2-card-title">Gastos variáveis</h3>
          ${spends.length ? spends.slice(0, 10).map(renderSwipeableOutflow).join('') : '<div class="m2-empty">Sem gastos registrados.</div>'}
        </section>
      </div>
    `;
  }

  function renderGastos(month) {
    const grouped = new Map();
    getOutflowRows(month).forEach((item) => {
      const category = getOutflowCategory(item);
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push(item);
    });

    const entries = Array.from(grouped.entries()).sort((a, b) => b[1].reduce((sum, x) => sum + Math.abs(Number(x?.amount || 0)), 0) - a[1].reduce((sum, x) => sum + Math.abs(Number(x?.amount || 0)), 0));

    return `
      <div class="m2-tab-panel ${activeSubtab === 'gastos' ? 'active' : ''}" data-tab-panel="gastos">
        <section class="m2-card">
          <h3 class="m2-card-title">Gastos por categoria</h3>
          ${entries.length ? entries.map(([cat, items]) => {
            const total = items.reduce((sum, x) => sum + Math.abs(Number(x?.amount || 0)), 0);
            return `
              <details class="m2-category-accordion">
                <summary><span>${global.escapeHtml ? global.escapeHtml(cat) : cat}</span><span>${formatMoney(total)}</span></summary>
                <div class="m2-category-list">${items.slice(0, 8).map(renderSwipeableOutflow).join('')}</div>
              </details>
            `;
          }).join('') : '<div class="m2-empty">Sem categorias com gastos.</div>'}
        </section>
      </div>
    `;
  }

  function renderTodos(month) {
    const all = getOutflowRows(month);
    const searchValue = String(month?.mobileV2?.allSearch || '');
    return `
      <div class="m2-tab-panel ${activeSubtab === 'todos' ? 'active' : ''}" data-tab-panel="todos">
        <input id="mobileV2AllSearch" class="m2-search" type="search" placeholder="Buscar lançamentos..." value="${global.escapeHtml ? global.escapeHtml(searchValue) : searchValue}">
        <section class="m2-card" id="mobileV2AllList">
          ${all.length ? all.map(renderSwipeableOutflow).join('') : '<div class="m2-empty">Sem lançamentos no mês.</div>'}
        </section>
      </div>
    `;
  }

  function renderRenda(month) {
    const rendaRows = month?.renda || [];
    const projetoRows = month?.projetos || [];
    const rows = [
      ...rendaRows.map((item) => ({ fonte: item?.fonte || 'Renda', valor: Number(item?.valor || 0), paid: item?.paid === true, data: item?.dataRecebimento || '' })),
      ...projetoRows.map((item) => ({ fonte: item?.nome || 'Projeto', valor: Number(item?.valor || 0), paid: item?.paid === true, data: item?.dataRecebimento || '' }))
    ];
    const total = rows.reduce((sum, x) => sum + x.valor, 0);

    return `
      <div class="m2-tab-panel ${activeSubtab === 'renda' ? 'active' : ''}" data-tab-panel="renda">
        <section class="m2-card">
          <h3 class="m2-card-title">Renda do mês</h3>
          ${rows.length ? rows.map((row) => `
            <article class="m2-recent-item">
              <span class="m2-icon-pill">💼</span>
              <span>
                <p class="m2-row-title">${global.escapeHtml ? global.escapeHtml(row.fonte) : row.fonte}</p>
                <span class="m2-row-meta">${global.escapeHtml ? global.escapeHtml(row.data || 'Sem data') : (row.data || 'Sem data')} · ${row.paid ? 'Recebido' : 'Pendente'}</span>
              </span>
              <span class="m2-row-amount positive">${formatMoney(row.valor)}</span>
            </article>
          `).join('') : '<div class="m2-empty">Sem rendas cadastradas.</div>'}
          <div style="padding-top:8px;font-weight:700">Total esperado: ${formatMoney(total)}</div>
        </section>
      </div>
    `;
  }

  function renderMetas(month) {
    const goals = month?.dailyGoals || {};
    const categories = month?.categorias || {};
    const entries = Object.keys(goals)
      .map((cat) => ({ cat, goal: Number(goals[cat] || 0), spent: Number(categories?.[cat] || 0) }))
      .filter((x) => x.goal > 0);

    return `
      <div class="m2-tab-panel ${activeSubtab === 'metas' ? 'active' : ''}" data-tab-panel="metas">
        <section class="m2-card">
          <h3 class="m2-card-title">Metas financeiras</h3>
          ${entries.length ? entries.map((item) => {
            const pct = Math.max(0, Math.min(100, Math.round((item.spent / item.goal) * 100)));
            const remain = item.goal - item.spent;
            return `
              <article style="padding:10px 0;border-bottom:1px solid var(--border)">
                <p class="m2-row-title">${global.escapeHtml ? global.escapeHtml(item.cat) : item.cat}</p>
                <div class="m2-row-meta" style="margin:6px 0">${formatMoney(item.spent)} / ${formatMoney(item.goal)} · ${pct}%</div>
                <div class="category-bar-fill"><div class="category-bar-fill-inner" style="width:${pct}%"></div></div>
                <div class="m2-row-meta" style="margin-top:6px">${remain >= 0 ? 'Falta' : 'Passou'} ${formatMoney(Math.abs(remain))}</div>
              </article>
            `;
          }).join('') : '<div class="m2-empty">Nenhuma meta definida.</div>'}
        </section>
      </div>
    `;
  }

  function closeOtherSwipes(target) {
    target.querySelectorAll('.m2-outflow-item.swiped').forEach((item) => {
      item.classList.remove('swiped');
      const surface = item.querySelector('.m2-outflow-surface');
      if (surface) surface.style.transform = '';
    });
  }

  function attachSwipe(target, rowEl) {
    let startX = 0;
    let currentX = 0;
    let dragging = false;
    const surface = rowEl.querySelector('.m2-outflow-surface');
    if (!surface) return;

    rowEl.addEventListener('touchstart', (event) => {
      if (!event.touches?.length) return;
      dragging = true;
      startX = event.touches[0].clientX;
      currentX = 0;
      closeOtherSwipes(target);
    }, { passive: true });

    rowEl.addEventListener('touchmove', (event) => {
      if (!dragging || !event.touches?.length) return;
      currentX = event.touches[0].clientX - startX;
      if (currentX >= 0) return;
      const move = Math.max(currentX, -144);
      surface.style.transform = `translateX(${move}px)`;
    }, { passive: true });

    rowEl.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      if (currentX < -54) {
        rowEl.classList.add('swiped');
        surface.style.transform = 'translateX(-144px)';
      } else {
        rowEl.classList.remove('swiped');
        surface.style.transform = '';
      }
      currentX = 0;
    });
  }

  function attachListeners(target, month) {
    target.querySelectorAll('[data-m2-subtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSubtab = btn.getAttribute('data-m2-subtab') || 'resumo';
        month.mobileV2.subtab = activeSubtab;
        render(target);
      });
    });

    const searchInput = target.querySelector('#mobileV2AllSearch');
    const list = target.querySelector('#mobileV2AllList');
    if (searchInput && list) {
      const applySearch = () => {
        const term = String(searchInput.value || '').trim().toLowerCase();
        month.mobileV2.allSearch = searchInput.value || '';
        list.querySelectorAll('[data-outflow-id]').forEach((row) => {
          const text = row.textContent.toLowerCase();
          row.style.display = !term || text.includes(term) ? '' : 'none';
        });
      };
      applySearch();
      searchInput.addEventListener('input', () => {
        applySearch();
      });
    }

    target.querySelectorAll('.m2-outflow-item').forEach((row) => attachSwipe(target, row));

    target.querySelectorAll('[data-open-edit]').forEach((surface) => {
      surface.addEventListener('click', () => {
        const id = surface.getAttribute('data-open-edit') || '';
        if (!id) return;
        if (surface.parentElement?.classList.contains('swiped')) {
          surface.parentElement.classList.remove('swiped');
          surface.style.transform = '';
          return;
        }
        if (typeof global.openUnifiedOutflowModal === 'function') {
          global.openUnifiedOutflowModal(id);
        }
      });
    });

    target.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id') || '';
        if (!id) return;

        if (action === 'edit' && typeof global.openUnifiedOutflowModal === 'function') {
          haptic('light');
          global.openUnifiedOutflowModal(id);
          return;
        }

        if (action === 'paid' && typeof global.toggleUnifiedOutflowPaid === 'function') {
          const isPaid = btn.getAttribute('data-paid') === '1';
          haptic('medium');
          global.toggleUnifiedOutflowPaid(id, !isPaid);
          global.MobileV2?.refresh?.();
          return;
        }

        if (action === 'delete' && typeof global.deleteUnifiedOutflow === 'function') {
          haptic('error');
          global.deleteUnifiedOutflow(id);
          global.MobileV2?.refresh?.();
        }
      });
    });
  }

  function prevMonth() {
    const allMonths = typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : (global.data || []);
    const current = typeof global.getCurrentMonth === 'function' ? global.getCurrentMonth() : null;
    if (!allMonths.length || !current) return;
    const idx = allMonths.findIndex((m) => m?.id === current.id);
    if (idx > 0 && typeof global.selectMonth === 'function') {
      global.selectMonth(allMonths[idx - 1].id);
      global.MobileV2?.refresh?.();
    }
  }

  function nextMonth() {
    const allMonths = typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : (global.data || []);
    const current = typeof global.getCurrentMonth === 'function' ? global.getCurrentMonth() : null;
    if (!allMonths.length || !current) return;
    const idx = allMonths.findIndex((m) => m?.id === current.id);
    if (idx >= 0 && idx < allMonths.length - 1 && typeof global.selectMonth === 'function') {
      global.selectMonth(allMonths[idx + 1].id);
      global.MobileV2?.refresh?.();
    }
  }

  function render(target) {
    if (!target) return;
    const month = typeof global.getCurrentMonth === 'function' ? global.getCurrentMonth() : null;
    if (!month) {
      target.innerHTML = '<div class="m2-card"><p>Sem mês selecionado.</p></div>';
      return;
    }

    ensureMonthUI(month);

    target.innerHTML = `
      ${renderMonthNav(month)}
      ${renderSubtabs()}
      ${renderResumo(month)}
      ${renderGastos(month)}
      ${renderTodos(month)}
      ${renderRenda(month)}
      ${renderMetas(month)}
    `;

    attachListeners(target, month);
  }

  global.MobileV2MesAtual = {
    render,
    prevMonth,
    nextMonth,
    setSubtab(tab) {
      if (SUBTABS.includes(tab)) activeSubtab = tab;
    }
  };
})(window);
