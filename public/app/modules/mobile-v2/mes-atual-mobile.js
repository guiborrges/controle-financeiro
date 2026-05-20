(function initMobileV2Mes(global) {
  'use strict';

  const SUBTABS = [
    { key: 'planejamento', label: 'Planejamento' },
    { key: 'gastos-metas', label: 'Gastos e Metas' },
    { key: 'todos', label: 'Todos' },
    { key: 'renda', label: 'Renda' }
  ];

  let activeSubtab = 'planejamento';
  const activeFilters = {
    search: ''
  };
  const monthCache = new Map();
  const virtualState = new WeakMap();
  let dataVersion = 0;
  const VIRTUAL_ITEM_HEIGHT = 62;
  const VIRTUAL_THRESHOLD = 80;
  const VIRTUAL_BUFFER = 10;

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

  function parseDateScore(raw) {
    const text = String(raw || '').trim();
    if (!text) return 0;
    const normalized = typeof global.normalizeVarDate === 'function' ? global.normalizeVarDate(text) : text;
    const parts = String(normalized || '').split('/');
    if (parts.length !== 3) return 0;
    const [dd, mm, yy] = parts.map(Number);
    const yyyy = yy > 99 ? yy : (2000 + (yy || 0));
    return new Date(yyyy, Math.max(0, (mm || 1) - 1), dd || 1).getTime() || 0;
  }

  function ensureUiState(month) {
    if (!month) return;
    month.mobileV2 = month.mobileV2 || {};
    if (!SUBTABS.some((tab) => tab.key === month.mobileV2.subtab)) month.mobileV2.subtab = activeSubtab;
    if (typeof month.mobileV2.allSearch !== 'string') month.mobileV2.allSearch = '';
    activeSubtab = month.mobileV2.subtab;
  }

  function getCurrentMonthSafe() {
    if (typeof global.getCurrentMonth === 'function') {
      const current = global.getCurrentMonth();
      if (current) return current;
    }
    const cached = global.MobileV2Enhancements?.getCachedFinanceMonths?.() || [];
    const cachedState = global.__MOBILE_V2_CACHED_STATE__;
    if (cached.length && cachedState?.currentMonthId) {
      return cached.find((month) => String(month?.id || '') === String(cachedState.currentMonthId)) || cached[cached.length - 1];
    }
    if (cached.length) return cached[cached.length - 1];
    return null;
  }

  function invalidateCache() {
    dataVersion += 1;
    monthCache.clear();
  }

  function getMonthCacheKey(month) {
    const outflows = Array.isArray(month?.outflows) ? month.outflows : [];
    const renda = Array.isArray(month?.renda) ? month.renda : [];
    const projetos = Array.isArray(month?.projetos) ? month.projetos : [];
    const bills = Array.isArray(month?.cardBills) ? month.cardBills : [];
    return [
      month?.id || '',
      outflows.length,
      renda.length,
      projetos.length,
      bills.length,
      JSON.stringify(month?.dailyGoals || {}),
      dataVersion
    ].join('|');
  }

  function getCachedMonthView(month) {
    const monthId = String(month?.id || 'current');
    const cacheKey = getMonthCacheKey(month);
    const cached = monthCache.get(monthId);
    if (cached?.cacheKey === cacheKey) return cached;
    const outflowRows = getOutflowRows(month);
    const metrics = getMonthMetrics(month);
    const categoryRows = buildCategoryRowsFromRows(outflowRows);
    const next = { cacheKey, outflowRows, metrics, categoryRows };
    monthCache.set(monthId, next);
    return next;
  }

  function resolveCategory(item) {
    const raw = item?.category || item?.categoria || 'OUTROS';
    return String(global.resolveCategoryName ? global.resolveCategoryName(raw) : raw).trim() || 'OUTROS';
  }

  function getOutflowRows(month) {
    return [...(Array.isArray(month?.outflows) ? month.outflows : [])]
      .filter((item) => Math.abs(Number(item?.amount || item?.valor || 0)) > 0)
      .sort((a, b) => parseDateScore(b?.date) - parseDateScore(a?.date));
  }

  function getMonthMetrics(month) {
    const outflows = Array.isArray(month?.outflows) ? month.outflows : [];
    const renda = (month?.renda || []).reduce((acc, item) => acc + Number(item?.valor || 0), 0)
      + (month?.projetos || []).reduce((acc, item) => acc + Number(item?.valor || 0), 0);

    let despesas = 0;
    outflows.forEach((item) => {
      if (item?.countsInPrimaryTotals === false) return;
      const value = Math.abs(Number(item?.amount || 0));
      if (!(value > 0)) return;
      const kind = String(item?.outputKind || '').toLowerCase();
      const type = String(item?.type || '').toLowerCase();
      if (kind === 'card' && type === 'spend') return;
      despesas += value;
    });

    (month?.cardBills || []).forEach((bill) => {
      despesas += Math.abs(Number(bill?.amount || 0));
    });

    return {
      renda,
      despesas,
      resultado: renda - despesas
    };
  }

  function renderPageHeader() {
    return `
      <header class="m2-header m2-page-header">
        <div>
          <h2 class="m2-title">Mês Atual</h2>
        </div>
        <div class="m2-header-actions">
          <button class="m2-icon-btn" type="button" aria-label="Tags" onclick="MobileV2FiltersSheet.open()">${global.SystemIcons?.render ? global.SystemIcons.render('tag') : '???'}</button>
          <button class="m2-icon-btn" type="button" aria-label="Perfil" onclick="MobileV2PerfilSheet.open()">${global.SystemIcons?.render ? global.SystemIcons.render('user') : '??'}</button>
        </div>
      </header>
    `;
  }

  function renderMonthNav(month) {
    const metrics = getCachedMonthView(month).metrics;
    return `
      <div class="m2-month-nav">
        <div class="m2-month-nav-row">
          <button class="m2-icon-btn" type="button" onclick="MobileV2MesAtual.prevMonth()" aria-label="Mês anterior">?</button>
          <div class="m2-month-title">${escapeHtml(String(month?.nome || 'Mês atual'))}</div>
          <button class="m2-icon-btn" type="button" onclick="MobileV2MesAtual.nextMonth()" aria-label="Próximo mês">?</button>
        </div>
        <div class="m2-month-metrics">
          <div class="m2-mini-metric"><div class="m2-mini-label">Renda</div><div class="m2-mini-value">${formatMoney(metrics.renda)}</div></div>
          <div class="m2-mini-metric"><div class="m2-mini-label">Despesas</div><div class="m2-mini-value">${formatMoney(metrics.despesas)}</div></div>
          <div class="m2-mini-metric"><div class="m2-mini-label">Resultado</div><div class="m2-mini-value ${metrics.resultado >= 0 ? 'positive' : 'negative'}">${formatMoney(metrics.resultado)}</div></div>
        </div>
      </div>
    `;
  }

  function renderSubtabs() {
    return `
      <div class="tab-scroll" role="tablist" aria-label="Visões do mês">
        ${SUBTABS.map((tab) => `
          <button type="button" class="tab-pill ${activeSubtab === tab.key ? 'active' : ''}" data-m2-subtab="${tab.key}">${escapeHtml(tab.label)}</button>
        `).join('')}
      </div>
    `;
  }

  function toItemView(item) {
    const category = resolveCategory(item);
    const amount = Math.abs(Number(item?.amount || item?.valor || 0));
    const safeId = String(item?.id || '').replace(/"/g, '&quot;').replace(/'/g, "\\'");
    return {
      id: safeId,
      description: String(item?.description || 'Lançamento'),
      date: String(item?.date || ''),
      category,
      icon: typeof global.getCategoryEmoji === 'function' ? global.getCategoryEmoji(category) : '•',
      amount,
      raw: item
    };
  }

  function emptyState(message, actionLabel = 'Adicionar primeiro lançamento') {
    return `
      <div class="m2-empty m2-empty-rich">
        <div class="m2-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M8 7h8M8 11h8M8 15h5"></path>
            <rect x="5" y="3" width="14" height="18" rx="3"></rect>
          </svg>
        </div>
        <strong>${escapeHtml(message || 'Nenhum lançamento neste mês')}</strong>
        <button class="m2-chip-btn positive" type="button" data-action="add-first">${escapeHtml(actionLabel)}</button>
      </div>
    `;
  }

  function renderListCard(title, rows, options = {}) {
    const isReadonly = options.readonly === true;
    return `
      <section class="m-list-card">
        ${title ? `<h3 class="m-list-title">${escapeHtml(title)}</h3>` : ''}
        ${rows.length ? rows.map((row) => `
          <article class="m-item" data-outflow-id="${row.id}">
            <div class="m-item-action"><button class="btn-delete-swipe" type="button" data-action="delete" data-id="${row.id}" aria-label="Excluir">Excluir</button></div>
            <div class="m-item-surface ${isReadonly ? 'static' : ''}" ${isReadonly ? '' : `data-action="edit" data-id="${row.id}"`}>
              <div class="m-item-cat-icon">${escapeHtml(row.icon || '•')}</div>
              <div class="m-item-info">
                <span class="m-item-name">${escapeHtml(row.description)}</span>
                <span class="m-item-meta">${escapeHtml(row.date)} · ${escapeHtml(row.category)}</span>
              </div>
              <span class="m-item-value">${formatMoney(row.amount)}</span>
            </div>
          </article>
        `).join('') : emptyState('Nenhum lançamento neste mês')}
      </section>
    `;
  }

  function renderPlanejamento(month) {
    const rows = getCachedMonthView(month).outflowRows.filter((item) => {
      const type = String(item?.type || '').toLowerCase();
      return type === 'expense' || item?.showInMonthPlanning === true;
    }).map(toItemView);
    const cardGroups = new Map();
    const normalRows = [];
    rows.forEach((row) => {
      const cardId = String(row?.raw?.outputRef || '');
      const outputKind = String(row?.raw?.outputKind || '').toLowerCase();
      if (outputKind === 'card' && cardId) {
        if (!cardGroups.has(cardId)) cardGroups.set(cardId, []);
        cardGroups.get(cardId).push(row);
      } else {
        normalRows.push(row);
      }
    });
    const monthCards = Array.isArray(month?.outflowCards) ? month.outflowCards : [];
    const cardSections = Array.from(cardGroups.entries()).map(([cardId, cardRows]) => {
      const card = monthCards.find((entry) => String(entry?.id || '') === cardId);
      const title = card?.name || `Cartão ${cardId.slice(0, 6)}`;
      const total = cardRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      return `
        <section class="m-list-card card-section">
          <h3 class="m-list-title">${escapeHtml(title)} · ${formatMoney(total)}</h3>
          <div class="card-items-note">Itens atrelados ao cartão — editar no cartão.</div>
          ${cardRows.map((row) => `
            <article class="m-item" data-outflow-id="${row.id}">
              <div class="m-item-surface static">
                <div class="m-item-cat-icon">${escapeHtml(row.icon || '•')}</div>
                <div class="m-item-info">
                  <span class="m-item-name">${escapeHtml(row.description)}</span>
                  <span class="m-item-meta">${escapeHtml(row.date)} · ${escapeHtml(row.category)}</span>
                </div>
                <span class="m-item-value">${formatMoney(row.amount)}</span>
              </div>
            </article>
          `).join('')}
        </section>
      `;
    }).join('');
    return `<div class="m2-tab-panel ${activeSubtab === 'planejamento' ? 'active' : ''}" data-tab-panel="planejamento">${renderListCard('Compromissos do mês', normalRows)}${cardSections}</div>`;
  }

  function buildCategoryRowsFromRows(rows) {
    const byCategory = new Map();
    rows.forEach((item) => {
      if (item?.countsInPrimaryTotals === false) return;
      const type = String(item?.type || '').toLowerCase();
      if (type !== 'spend' && type !== 'launch') return;
      const category = resolveCategory(item);
      if (!byCategory.has(category)) byCategory.set(category, 0);
      byCategory.set(category, byCategory.get(category) + Math.abs(Number(item?.amount || 0)));
    });

    return Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, total]) => ({
        name,
        total,
        icon: typeof global.getCategoryEmoji === 'function' ? global.getCategoryEmoji(name) : '•'
      }));
  }

  function buildCategoryRows(month) {
    return getCachedMonthView(month).categoryRows;
  }

  function renderGastosMetas(month) {
    const categoryRows = getCachedMonthView(month).categoryRows;
    const max = categoryRows[0]?.total || 1;
    const goals = month?.dailyGoals && typeof month.dailyGoals === 'object' ? month.dailyGoals : {};
    const spentByCategory = month?.categorias && typeof month.categorias === 'object' ? month.categorias : {};

    const categoryNames = new Set([
      ...categoryRows.map((row) => row.name),
      ...Object.keys(goals || {}),
      ...Object.keys(spentByCategory || {})
    ]);

    const goalRows = Array.from(categoryNames)
      .map((category) => {
        const goalValue = goals[category];
        const goal = Math.max(0, Number(goalValue || 0));
        const resolved = String(global.resolveCategoryName ? global.resolveCategoryName(category) : category).trim() || 'OUTROS';
        const spent = Math.max(0, Number(spentByCategory[resolved] || spentByCategory[category] || 0));
        const percent = goal > 0 ? Math.max(0, Math.round((spent / goal) * 100)) : 0;
        return { category: resolved, goal, spent, percent };
      })
      .filter(Boolean)
      .sort((a, b) => (b.goal > 0 ? 1 : 0) - (a.goal > 0 ? 1 : 0) || b.percent - a.percent || b.spent - a.spent);

    return `
      <div class="m2-tab-panel ${activeSubtab === 'gastos-metas' ? 'active' : ''}" data-tab-panel="gastos-metas">
        <section class="m-list-card">
          <h3 class="m-list-title">Gastos por categoria</h3>
          ${categoryRows.length ? categoryRows.map((row) => {
            const width = Math.max(5, Math.round((row.total / max) * 100));
            return `
              <div class="cat-bar-row">
                <span class="cat-bar-name">${escapeHtml(row.icon)} ${escapeHtml(row.name)}</span>
                <span class="cat-bar-track"><span class="cat-bar-fill" style="width:${width}%"></span></span>
                <span class="cat-bar-value">${formatMoney(row.total)}</span>
              </div>
            `;
          }).join('') : '<div class="m2-empty">Sem gastos categorizados no mês.</div>'}
        </section>

        <section class="m-list-card">
          <h3 class="m-list-title">Metas de gasto</h3>
          ${goalRows.length ? goalRows.map((row) => {
            const over = row.percent > 100;
            const clamped = Math.min(row.percent, 100);
            return `
              <div class="cat-bar-row goal-row">
                <span class="cat-bar-name">${escapeHtml(row.category)}</span>
                <span class="cat-bar-track"><span class="cat-bar-fill ${over ? 'over-budget' : ''}" style="width:${clamped}%"></span></span>
                <span class="cat-bar-value">${row.goal > 0 ? `${row.percent}%` : 'Sem meta'}</span>
                <button class="m2-icon-mini" type="button" data-action="edit-goal" data-category="${escapeHtml(row.category)}" aria-label="${row.goal > 0 ? 'Editar meta' : 'Definir meta de gasto'}">✎</button>
              </div>
            `;
          }).join('') : emptyState('Nenhuma categoria encontrada', 'Adicionar lançamento')}
        </section>
      </div>
    `;
  }

  function renderTodos(month) {
    const allRows = getCachedMonthView(month).outflowRows.map(toItemView);
    const searchValue = String(activeFilters.search || month?.mobileV2?.allSearch || '');
    const badgeCount = searchValue.trim() ? 1 : 0;

    return `
      <div class="m2-tab-panel ${activeSubtab === 'todos' ? 'active' : ''}" data-tab-panel="todos">
        ${badgeCount ? `<div class="m2-filter-badge">${badgeCount} filtro ativo</div>` : ''}
        <input id="mobileV2AllSearch" class="m2-search" type="search" placeholder="Buscar lançamentos..." value="${escapeHtml(searchValue)}">
        <section class="m-list-card ${allRows.length >= VIRTUAL_THRESHOLD ? 'm2-virtual-list-card' : ''}" id="mobileV2AllList" data-virtual-list="${allRows.length >= VIRTUAL_THRESHOLD ? '1' : '0'}">
          ${allRows.length ? allRows.map((row) => `
            <article class="m-item" data-outflow-id="${row.id}">
              <div class="m-item-action"><button class="btn-delete-swipe" type="button" data-action="delete" data-id="${row.id}" aria-label="Excluir">Excluir</button></div>
              <div class="m-item-surface" data-action="edit" data-id="${row.id}">
                <div class="m-item-info">
                  <span class="m-item-name">${escapeHtml(row.description)}</span>
                  <span class="m-item-meta">${escapeHtml(row.date)} · ${escapeHtml(row.category)}</span>
                </div>
                <span class="m-item-value">${formatMoney(row.amount)}</span>
              </div>
            </article>
          `).join('') : emptyState('Nenhum lançamento neste mês')}
        </section>
      </div>
    `;
  }

  function renderRenda(month) {
    const rendaFixa = month?.renda || [];
    const rendaExtra = month?.projetos || [];
    const total = [...rendaFixa, ...rendaExtra].reduce((sum, row) => sum + Number(row?.valor || 0), 0);

    return `
      <div class="m2-tab-panel ${activeSubtab === 'renda' ? 'active' : ''}" data-tab-panel="renda">
        <section class="m-list-card">
          <h3 class="m-list-title">Renda do mês</h3>
          ${rendaFixa.length ? rendaFixa.map((row) => `
            <article class="m-item m-item-income">
              <div class="m-item-surface static">
                <div class="m-item-cat-icon">${escapeHtml(typeof global.getCategoryEmoji === 'function' ? global.getCategoryEmoji('SALÁRIO') : '💼')}</div>
                <div class="m-item-info">
                  <span class="m-item-name">${escapeHtml(row?.fonte || 'Renda fixa')}</span>
                  <span class="m-item-meta">${escapeHtml(String(row?.dataRecebimento || 'Sem data'))} · ${row?.paid ? 'Recebido' : 'Pendente'}</span>
                </div>
                <span class="m-item-value income">${formatMoney(row?.valor || 0)}</span>
              </div>
            </article>
          `).join('') : emptyState('Nenhuma renda fixa cadastrada')}
          <h3 class="m-list-title" style="margin-top:10px">Renda extra</h3>
          ${rendaExtra.length ? rendaExtra.map((row) => `
            <article class="m-item m-item-income">
              <div class="m-item-surface static">
                <div class="m-item-cat-icon">${escapeHtml(typeof global.getCategoryEmoji === 'function' ? global.getCategoryEmoji('OUTROS') : '⚡')}</div>
                <div class="m-item-info">
                  <span class="m-item-name">${escapeHtml(row?.nome || 'Renda extra')}</span>
                  <span class="m-item-meta">${escapeHtml(String(row?.dataRecebimento || 'Sem data'))} · ${row?.paid ? 'Recebido' : 'Pendente'}</span>
                </div>
                <span class="m-item-value income">${formatMoney(row?.valor || 0)}</span>
              </div>
            </article>
          `).join('') : emptyState('Nenhuma renda extra cadastrada')}
          <div class="m2-list-total">Total esperado: ${formatMoney(total)}</div>
        </section>
      </div>
    `;
  }

  function closeOtherSwipes(target, current) {
    target.querySelectorAll('.m-item.swiped').forEach((row) => {
      if (row === current) return;
      row.classList.remove('swiped');
      const surface = row.querySelector('.m-item-surface');
      if (surface) surface.style.transform = '';
    });
  }

  function attachSwipe(target, rowEl) {
    const surface = rowEl.querySelector('.m-item-surface');
    if (!surface || surface.classList.contains('static')) return;

    let startX = 0;
    let currentX = 0;
    let dragging = false;

    rowEl.addEventListener('touchstart', (event) => {
      if (!event.touches?.length) return;
      dragging = true;
      startX = event.touches[0].clientX;
      currentX = 0;
      closeOtherSwipes(target, rowEl);
    }, { passive: true });

    rowEl.addEventListener('touchmove', (event) => {
      if (!dragging || !event.touches?.length) return;
      currentX = event.touches[0].clientX - startX;
      if (currentX >= 0) return;
      surface.style.transform = `translateX(${Math.max(currentX, -88)}px)`;
    }, { passive: true });

    rowEl.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      if (currentX < -46) {
        rowEl.classList.add('swiped');
        surface.style.transform = 'translateX(-88px)';
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
        activeSubtab = btn.getAttribute('data-m2-subtab') || 'planejamento';
        month.mobileV2.subtab = activeSubtab;
        render(target);
      });
    });

    const searchInput = target.querySelector('#mobileV2AllSearch');
    if (searchInput) {
      const list = target.querySelector('#mobileV2AllList');
      const apply = () => {
        const term = String(searchInput.value || '').trim().toLowerCase();
        month.mobileV2.allSearch = searchInput.value || '';
        activeFilters.search = searchInput.value || '';
        list?.querySelectorAll('.m-item[data-outflow-id]').forEach((row) => {
          row.style.display = !term || row.textContent.toLowerCase().includes(term) ? '' : 'none';
        });
      };
      apply();
      searchInput.addEventListener('input', apply);
    }

    target.querySelectorAll('.m-item').forEach((row) => attachSwipe(target, row));

    target.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        const id = btn.getAttribute('data-id') || '';
        if (!id) return;
        const parent = btn.closest('.m-item');
        if (parent?.classList.contains('swiped')) {
          parent.classList.remove('swiped');
          const surface = parent.querySelector('.m-item-surface');
          if (surface) surface.style.transform = '';
          return;
        }
        const item = (month?.outflows || []).find((entry) => String(entry?.id || '') === id);
        if (global.MobileV2OutflowForm?.openEdit && item) {
          event.preventDefault();
          global.MobileV2OutflowForm.openEdit(item);
        } else if (typeof global.openUnifiedOutflowModal === 'function') {
          event.preventDefault();
          global.openUnifiedOutflowModal(id);
        }
      });
    });

    target.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = btn.getAttribute('data-id') || '';
        if (!id || typeof global.deleteUnifiedOutflow !== 'function') return;
        const row = btn.closest('.m-item');
        row?.classList.add('pending-delete');
        let undone = false;
        const finish = () => {
          if (undone) return;
          global.deleteUnifiedOutflow(id);
          global.MobileV2Enhancements?.notifyDataChanged?.('outflow-delete');
          global.MobileV2Enhancements?.haptic?.('medium');
          global.MobileV2?.refresh?.();
        };
        const undo = () => {
          undone = true;
          row?.classList.remove('pending-delete', 'swiped');
          const surface = row?.querySelector('.m-item-surface');
          if (surface) surface.style.transform = '';
        };
        if (typeof global.showToast === 'function') {
          global.showToast('Lançamento excluído.', { actionLabel: 'Desfazer', onAction: undo, duration: 4000, onClose: finish });
        } else if (!global.confirm || global.confirm('Excluir este lançamento?')) {
          finish();
        } else {
          undo();
        }
      });
    });

    target.querySelectorAll('[data-action="add-first"]').forEach((btn) => {
      btn.addEventListener('click', () => global.MobileV2AddSheet?.open?.());
    });

    target.querySelectorAll('[data-action="edit-goal"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const category = btn.getAttribute('data-category') || '';
        if (!category) return;
        const current = Number(month?.dailyGoals?.[category] || 0) || '';
        const label = current ? 'Editar meta de gasto' : 'Definir meta de gasto';
        const raw = global.prompt?.(`${label} para ${category}`, current ? String(current) : '');
        if (raw === null || raw === undefined) return;
        const value = Number(String(raw).replace(',', '.'));
        if (!(value > 0)) return;
        month.dailyGoals = month.dailyGoals && typeof month.dailyGoals === 'object' ? month.dailyGoals : {};
        month.dailyGoals[category] = value;
        if (typeof global.save === 'function') global.save(true);
        invalidateCache();
        global.MobileV2Enhancements?.notifyDataChanged?.('goal-save');
        global.MobileV2?.refresh?.();
      });
    });

    setupVirtualLists(target);
  }

  function setupVirtualLists(target) {
    target.querySelectorAll('[data-virtual-list="1"]').forEach((list) => {
      const items = Array.from(list.querySelectorAll('.m-item[data-outflow-id]'));
      if (items.length < VIRTUAL_THRESHOLD || virtualState.has(list)) return;
      const spacer = document.createElement('div');
      spacer.className = 'm2-virtual-spacer';
      spacer.style.height = `${items.length * VIRTUAL_ITEM_HEIGHT}px`;
      items.forEach((item) => {
        item.classList.add('m2-virtual-item');
        item.style.height = `${VIRTUAL_ITEM_HEIGHT}px`;
      });
      list.appendChild(spacer);
      const virtual = { items, ticking: false };
      virtualState.set(list, virtual);
      const update = () => {
        virtual.ticking = false;
        const viewport = list.closest('.mobile-v2-screen') || list;
        const viewportRect = viewport.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        const scrollTop = Math.max(0, viewport.scrollTop - Math.max(0, listRect.top - viewportRect.top));
        const viewportHeight = viewport.clientHeight || 520;
        const start = Math.max(0, Math.floor(scrollTop / VIRTUAL_ITEM_HEIGHT) - VIRTUAL_BUFFER);
        const end = Math.min(items.length - 1, Math.ceil((scrollTop + viewportHeight) / VIRTUAL_ITEM_HEIGHT) + VIRTUAL_BUFFER);
        items.forEach((item, index) => {
          if (index < start || index > end) {
            item.style.display = 'none';
            return;
          }
          item.style.display = '';
          item.style.transform = `translateY(${index * VIRTUAL_ITEM_HEIGHT}px)`;
        });
      };
      const schedule = () => {
        if (virtual.ticking) return;
        virtual.ticking = true;
        requestAnimationFrame(update);
      };
      const viewport = list.closest('.mobile-v2-screen') || list;
      viewport.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule, { passive: true });
      update();
    });
  }

  function prevMonth() {
    const liveMonths = typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : (global.data || []);
    const allMonths = liveMonths.length ? liveMonths : (global.MobileV2Enhancements?.getCachedFinanceMonths?.() || []);
    const current = getCurrentMonthSafe();
    if (!allMonths.length || !current) return;
    const idx = allMonths.findIndex((entry) => entry?.id === current.id);
    if (idx <= 0 || typeof global.selectMonth !== 'function') return;
    global.selectMonth(allMonths[idx - 1].id);
    global.MobileV2Enhancements?.haptic?.('light');
    global.MobileV2?.refresh?.();
  }

  function nextMonth() {
    const liveMonths = typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : (global.data || []);
    const allMonths = liveMonths.length ? liveMonths : (global.MobileV2Enhancements?.getCachedFinanceMonths?.() || []);
    const current = getCurrentMonthSafe();
    if (!allMonths.length || !current) return;
    const idx = allMonths.findIndex((entry) => entry?.id === current.id);
    if (idx < 0 || idx >= allMonths.length - 1 || typeof global.selectMonth !== 'function') return;
    global.selectMonth(allMonths[idx + 1].id);
    global.MobileV2Enhancements?.haptic?.('light');
    global.MobileV2?.refresh?.();
  }

  function render(target) {
    if (!target) return;
    const month = getCurrentMonthSafe();
    if (!month) {
      target.innerHTML = '<div class="m2-empty">Sem mês selecionado.</div>';
      return;
    }

    ensureUiState(month);

    target.innerHTML = `
      ${renderPageHeader()}
      ${renderMonthNav(month)}
      ${renderSubtabs()}
      ${renderPlanejamento(month)}
      ${renderGastosMetas(month)}
      ${renderTodos(month)}
      ${renderRenda(month)}
    `;

    attachListeners(target, month);
  }

  global.MobileV2MesAtual = {
    render,
    prevMonth,
    nextMonth,
    setSubtab(tab) {
      if (SUBTABS.some((entry) => entry.key === tab)) activeSubtab = tab;
    },
    getActiveFilters: () => ({ ...activeFilters }),
    invalidateCache
  };
  document.addEventListener('mobileDataChanged', invalidateCache);
})(window);


