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

  function getCategorySymbol(categoryName) {
    const safeCategory = String(categoryName || 'OUTROS');
    if (typeof global.renderSmartIconBadge === 'function' && typeof global.inferCategoryVisual === 'function') {
      const visual = global.inferCategoryVisual(safeCategory);
      return global.renderSmartIconBadge(visual.icon, visual.tone);
    }
    const emoji = typeof global.getCategoryEmoji === 'function' ? global.getCategoryEmoji(safeCategory) : '';
    return escapeHtml(String(emoji || '•'));
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
    if (typeof global.getUnifiedFilterRows === 'function') {
      const unifiedRows = global.getUnifiedFilterRows(month, 'all', '', '') || [];
      const outflowRows = unifiedRows
        .filter((row) => row?.kind === 'outflow' && Math.abs(Number(row?.item?.amount || 0)) > 0)
        .map((row) => row.item);
      if (typeof global.getSortedUnifiedRows === 'function') {
        return global.getSortedUnifiedRows(month, outflowRows.map((item) => ({ kind: 'outflow', item })), 'data', 'desc')
          .map((row) => row.item);
      }
      return outflowRows.sort((a, b) => parseDateScore(b?.date) - parseDateScore(a?.date));
    }
    return [...(Array.isArray(month?.outflows) ? month.outflows : [])]
      .filter((item) => Math.abs(Number(item?.amount || item?.valor || 0)) > 0)
      .sort((a, b) => parseDateScore(b?.date) - parseDateScore(a?.date));
  }

  function getMonthMetrics(month) {
    const totals = typeof global.getEffectiveTotalsForMes === 'function'
      ? global.getEffectiveTotalsForMes(month)
      : null;
    const renda = Number(totals?.rendaTotal || 0);
    const despesas = typeof global.calculateUnifiedPlanningTotal === 'function'
      ? Number(global.calculateUnifiedPlanningTotal(month) || 0)
      : Number(totals?.totalGastos || 0);
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
          <button class="m2-icon-btn" type="button" aria-label="Perfil" onclick="MobileV2PerfilSheet.open()">${global.SystemIcons?.render ? global.SystemIcons.render('user') : ''}</button>
        </div>
      </header>
    `;
  }

  function renderMonthNav(month) {
    const metrics = getCachedMonthView(month).metrics;
    return `
      <div class="m2-month-nav">
        <div class="m2-month-nav-row">
          <button class="m2-icon-btn" type="button" onclick="MobileV2MesAtual.prevMonth()" aria-label="Mês anterior">&lt;</button>
          <div class="m2-month-title">${escapeHtml(String(month?.nome || 'Mês atual'))}</div>
          <button class="m2-icon-btn" type="button" onclick="MobileV2MesAtual.nextMonth()" aria-label="Próximo mês">&gt;</button>
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
      icon: getCategorySymbol(category),
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
              <div class="m-item-cat-icon">${row.icon || '•'}</div>
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
      const bill = (month?.cardBills || []).find((entry) => String(entry?.cardId || '') === cardId);
      const total = typeof global.getUnifiedCardBillEffectiveAmount === 'function'
        ? Number(global.getUnifiedCardBillEffectiveAmount(month, bill) || 0)
        : cardRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      return `
        <section class="m-list-card card-section">
          <h3 class="m-list-title">${escapeHtml(title)} · ${formatMoney(total)} <button class="m2-icon-mini" type="button" data-action="edit-card-bill" data-card-id="${escapeHtml(cardId)}" aria-label="Editar fatura">✎</button></h3>
          <div class="card-items-note">Itens atrelados ao cartão — editar no cartão.</div>
          ${cardRows.map((row) => `
            <article class="m-item" data-outflow-id="${row.id}">
              <div class="m-item-surface static">
                <div class="m-item-cat-icon">${row.icon || '•'}</div>
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
        icon: getCategorySymbol(name)
      }));
  }

  function buildCategoryRows(month) {
    return getCachedMonthView(month).categoryRows;
  }

  function getEffectiveOutflowAmount(item) {
    const resolver = global.OutflowAmounts?.getEffectiveOutflowAmount || global.getUnifiedEffectiveOutflowAmount;
    const raw = typeof resolver === 'function'
      ? resolver(item)
      : (item?.amount ?? item?.valor ?? 0);
    return Math.max(0, Number(raw || 0) || 0);
  }

  function isSpendLaunch(item) {
    if (typeof global.isUnifiedLaunchOfType === 'function') {
      return global.isUnifiedLaunchOfType(item, 'spend') === true;
    }
    return String(item?.type || '').toLowerCase() === 'spend';
  }

  function isRecurringLaunch(item) {
    if (typeof global.isUnifiedLaunchRecurring === 'function') {
      return global.isUnifiedLaunchRecurring(item) === true;
    }
    return item?.recurringSpend === true || item?.expenseRecurring === true || item?.launchRecurring === true;
  }

  function getGoalCategories(month) {
    if (typeof global.getUnifiedOutflowCategories === 'function') {
      return global.getUnifiedOutflowCategories(month) || [];
    }
    const presets = Array.isArray(global.SYSTEM_DEFAULT_CATEGORY_PRESETS)
      ? global.SYSTEM_DEFAULT_CATEGORY_PRESETS.map((item) => item?.name || '')
      : ['MORADIA', 'SERVIÇOS', 'ALIMENTAÇÃO', 'TRANSPORTE', 'COMPRAS', 'SAÚDE', 'LAZER', 'EDUCAÇÃO', 'FINANCEIRO', 'ASSINATURAS', 'TRABALHO', 'OUTROS'];
    return presets
      .map((category) => String(global.resolveCategoryName ? global.resolveCategoryName(category) : category).trim())
      .filter(Boolean);
  }

  function getGoalSpendItems(month) {
    if (typeof global.getUnifiedFilterRows === 'function') {
      return (global.getUnifiedFilterRows(month, 'spend', '', '') || [])
        .filter((row) => row?.kind === 'outflow')
        .map((row) => row.item)
        .filter(Boolean);
    }
    return Array.isArray(month?.outflows) ? month.outflows : [];
  }

  function buildGoalRows(month) {
    const goals = month?.dailyGoals && typeof month.dailyGoals === 'object' ? month.dailyGoals : {};
    const categoryMap = new Map();
    const addCategory = (rawCategory) => {
      const category = String(global.resolveCategoryName ? global.resolveCategoryName(rawCategory || 'OUTROS') : (rawCategory || 'OUTROS')).trim() || 'OUTROS';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          icon: getCategorySymbol(category),
          spent: 0,
          goal: 0,
          pct: 0,
          items: []
        });
      }
      return categoryMap.get(category);
    };

    getGoalCategories(month).forEach(addCategory);
    Object.keys(goals || {}).forEach(addCategory);

    getGoalSpendItems(month).forEach((item) => {
      if (!item || item.countsInPrimaryTotals === false) return;
      if (!isSpendLaunch(item)) return;
      if (isRecurringLaunch(item)) return;
      const amount = getEffectiveOutflowAmount(item);
      if (!(amount > 0)) return;
      const row = addCategory(resolveCategory(item));
      row.spent += amount;
      row.items.push(item);
    });

    Object.entries(goals || {}).forEach(([rawCategory, rawGoal]) => {
      const row = addCategory(rawCategory);
      row.goal = Math.max(0, Number(rawGoal || 0) || 0);
    });

    return Array.from(categoryMap.values())
      .map((row) => ({
        ...row,
        spent: Number(row.spent.toFixed(2)),
        pct: row.goal > 0 ? Math.round((row.spent / row.goal) * 100) : 0
      }))
      .filter((row) => row.spent > 0 || row.goal > 0)
      .sort((a, b) => (b.spent - a.spent) || (b.goal - a.goal) || a.category.localeCompare(b.category, 'pt-BR'));
  }

  function renderGastosMetas(month) {
    const goalRows = buildGoalRows(month);
    const totalSpent = goalRows.reduce((sum, row) => sum + Number(row.spent || 0), 0);
    const totalGoal = goalRows.reduce((sum, row) => sum + Number(row.goal || 0), 0);
    const maxSpent = Math.max(1, ...goalRows.map((row) => Number(row.spent || 0)));

    return `
      <div class="m2-tab-panel ${activeSubtab === 'gastos-metas' ? 'active' : ''}" data-tab-panel="gastos-metas">
        <section class="m-list-card gm-summary-card">
          <div class="gm-summary">
            <canvas class="gm-pie-canvas" width="152" height="152" aria-label="Distribuição dos gastos por categoria"></canvas>
            <div class="gm-summary-copy">
              <span class="gm-summary-label">Gastos e metas</span>
              <strong>${formatMoney(totalSpent)}</strong>
              <span>${totalGoal > 0 ? `Meta total: ${formatMoney(totalGoal)}` : 'Sem metas definidas'}</span>
            </div>
          </div>
        </section>

        <section class="m-list-card gm-list-card">
          <h3 class="m-list-title">Categorias</h3>
          ${goalRows.length ? goalRows.map((row) => {
            const hasGoal = row.goal > 0;
            const over = hasGoal && row.pct > 100;
            const goalWidth = hasGoal ? Math.min(row.pct, 100) : Math.round((Number(row.spent || 0) / maxSpent) * 100);
            const width = Math.max(row.spent > 0 ? 4 : 0, goalWidth);
            const subtitle = hasGoal
              ? `Meta: ${formatMoney(row.goal)} · ${row.pct}%`
              : 'Sem meta definida';
            return `
              <div class="gm-row">
                <div class="gm-icon">${row.icon}</div>
                <div class="gm-info">
                  <div class="gm-head">
                    <span class="gm-name">${escapeHtml(row.category)}</span>
                    <span class="gm-spent ${over ? 'over' : ''}">${formatMoney(row.spent)}</span>
                  </div>
                  <div class="gm-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(hasGoal ? row.pct : width, 100)}">
                    <span class="gm-bar-fill ${over ? 'over' : ''} ${hasGoal ? 'with-goal' : 'without-goal'}" style="width:${Math.min(width, 100)}%"></span>
                  </div>
                  <span class="gm-sub">${escapeHtml(subtitle)}</span>
                </div>
                <button class="m2-icon-mini gm-edit" type="button" data-action="edit-goal" data-category="${escapeHtml(row.category)}" aria-label="${hasGoal ? 'Editar meta' : 'Definir meta de gasto'}">✎</button>
              </div>
            `;
          }).join('') : emptyState('Nenhuma categoria encontrada', 'Adicionar lançamento')}
        </section>
      </div>
    `;
  }

  function drawGmPieChart(target) {
    const canvas = target?.querySelector?.('.gm-pie-canvas');
    if (!canvas) return;
    const month = getCurrentMonthSafe();
    const rows = buildGoalRows(month).filter((row) => Number(row.spent || 0) > 0);
    const ctx = canvas.getContext('2d');
    const size = Math.min(canvas.width || 152, canvas.height || 152);
    const center = size / 2;
    const radius = Math.max(36, center - 10);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const total = rows.reduce((sum, row) => sum + Number(row.spent || 0), 0);
    const styles = getComputedStyle(document.documentElement);
    const surface = styles.getPropertyValue('--surface-strong').trim() || '#fff';
    const muted = styles.getPropertyValue('--border').trim() || '#e5e7eb';
    const colors = ['#2471A3', '#27AE60', '#F39C12', '#8E44AD', '#17A589', '#D35400', '#BB4F43', '#2C3E50'];

    if (!(total > 0)) {
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.strokeStyle = muted;
      ctx.lineWidth = 16;
      ctx.stroke();
      return;
    }

    let angle = -Math.PI / 2;
    rows.slice(0, 8).forEach((row, index) => {
      const slice = (Number(row.spent || 0) / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();
      angle += slice;
    });

    ctx.beginPath();
    ctx.arc(center, center, radius * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = surface;
    ctx.fill();
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
    const monthMetrics = getCachedMonthView(month).metrics;
    const total = Number(monthMetrics?.renda || 0);

    return `
      <div class="m2-tab-panel ${activeSubtab === 'renda' ? 'active' : ''}" data-tab-panel="renda">
        <section class="m-list-card">
          <h3 class="m-list-title">Renda do mês</h3>
          ${rendaFixa.length ? rendaFixa.map((row) => `
            <article class="m-item m-item-income">
              <div class="m-item-surface static">
                <div class="m-item-cat-icon">${getCategorySymbol('SALÁRIO')}</div>
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
                <div class="m-item-cat-icon">${getCategorySymbol('OUTROS')}</div>
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

    target.querySelectorAll('[data-action="edit-card-bill"]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const cardId = String(btn.getAttribute('data-card-id') || '');
        if (!cardId) return;
        const bill = (month?.cardBills || []).find((entry) => String(entry?.cardId || '') === cardId);
        if (!bill) return;
        const currentAmount = Number(
          typeof global.getUnifiedCardBillEffectiveAmount === 'function'
            ? global.getUnifiedCardBillEffectiveAmount(month, bill)
            : bill.amount
        ) || 0;
        const raw = global.prompt?.('Editar valor da fatura', String(currentAmount.toFixed(2)));
        if (raw === null || raw === undefined) return;
        const nextAmount = Number(String(raw).replace(',', '.'));
        if (!(nextAmount >= 0)) return;
        bill.amount = nextAmount;
        bill.manualAmountSet = true;
        if (typeof global.syncUnifiedOutflowLegacyData === 'function') global.syncUnifiedOutflowLegacyData(month);
        if (typeof global.save === 'function') global.save(true);
        invalidateCache();
        global.MobileV2Enhancements?.notifyDataChanged?.('card-bill-edit');
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
    if (activeSubtab === 'gastos-metas') {
      requestAnimationFrame(() => {
        const panel = target.querySelector('[data-tab-panel="gastos-metas"]');
        drawGmPieChart(panel);
      });
    }
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


