(function initMobileV2Home(global) {
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

  function toDateScore(raw) {
    const text = String(raw || '').trim();
    if (!text) return 0;
    const normalized = typeof global.normalizeVarDate === 'function' ? global.normalizeVarDate(text) : text;
    const parts = String(normalized || '').split('/');
    if (parts.length !== 3) return 0;
    const [dd, mm, yy] = parts.map(Number);
    const yyyy = yy > 99 ? yy : 2000 + (yy || 0);
    return new Date(yyyy, Math.max(0, (mm || 1) - 1), dd || 1).getTime() || 0;
  }

  function getCurrentMonthSafe() {
    if (typeof global.getCurrentMonth === 'function') return global.getCurrentMonth();
    return null;
  }

  function getMonthMetrics(month) {
    const outflows = Array.isArray(month?.outflows) ? month.outflows : [];
    const incomeRows = Array.isArray(month?.renda) ? month.renda : [];
    const projectRows = Array.isArray(month?.projetos) ? month.projetos : [];

    const monthlyIncome = incomeRows.reduce((acc, item) => {
      if (item?.includeInTotals === false) return acc;
      return acc + Number(item?.valor || 0);
    }, 0) + projectRows.reduce((acc, item) => {
      if (item?.includeInTotals === false) return acc;
      return acc + Number(item?.valor || 0);
    }, 0);

    let monthlyExpenses = 0;
    let plannedCommitments = 0;
    let variableExpenses = 0;

    outflows.forEach((item) => {
      if (item?.countsInPrimaryTotals === false) return;
      const value = Math.abs(Number(item?.amount || item?.valor || 0));
      if (!(value > 0)) return;
      const type = String(item?.type || '').toLowerCase();
      const kind = String(item?.outputKind || '').toLowerCase();

      if (kind === 'card' && type === 'spend') {
        return;
      }

      monthlyExpenses += value;
      if (type === 'expense') plannedCommitments += value;
      else variableExpenses += value;
    });

    const cardBills = Array.isArray(month?.cardBills) ? month.cardBills : [];
    cardBills.forEach((bill) => {
      const amount = Math.abs(Number(bill?.amount || 0));
      if (!(amount > 0)) return;
      monthlyExpenses += amount;
      plannedCommitments += amount;
    });

    return {
      monthlyIncome,
      monthlyExpenses,
      monthlyResult: monthlyIncome - monthlyExpenses,
      plannedCommitments,
      variableExpenses
    };
  }

  function resolveCategory(item) {
    const raw = item?.category || item?.categoria || 'OUTROS';
    return String(global.resolveCategoryName ? global.resolveCategoryName(raw) : raw).trim() || 'OUTROS';
  }

  function getCategoryTotals(month) {
    const totals = new Map();
    const outflows = Array.isArray(month?.outflows) ? month.outflows : [];
    outflows.forEach((item) => {
      if (item?.countsInPrimaryTotals === false) return;
      const amount = Math.abs(Number(item?.amount || 0));
      if (!(amount > 0)) return;
      const kind = String(item?.outputKind || '').toLowerCase();
      const type = String(item?.type || '').toLowerCase();
      if (kind === 'card' && type === 'spend') return;
      const category = resolveCategory(item);
      totals.set(category, (totals.get(category) || 0) + amount);
    });

    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({
        name,
        total,
        icon: typeof global.getCategoryEmoji === 'function' ? global.getCategoryEmoji(name) : '•'
      }));
  }

  function getGoalRows(month) {
    const goals = month?.dailyGoals && typeof month.dailyGoals === 'object' ? month.dailyGoals : {};
    const spentByCategory = month?.categorias && typeof month.categorias === 'object' ? month.categorias : {};

    return Object.entries(goals)
      .map(([category, goalValue]) => {
        const goal = Math.max(0, Number(goalValue || 0));
        if (!(goal > 0)) return null;
        const resolved = String(global.resolveCategoryName ? global.resolveCategoryName(category) : category).trim() || 'OUTROS';
        const spent = Math.max(0, Number(spentByCategory[resolved] || spentByCategory[category] || 0));
        const percent = Math.max(0, Math.round((spent / goal) * 100));
        return {
          category: resolved,
          icon: typeof global.getCategoryEmoji === 'function' ? global.getCategoryEmoji(resolved) : '•',
          spent,
          goal,
          percent
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 4);
  }

  function getRecentRows(month) {
    const outflows = Array.isArray(month?.outflows) ? month.outflows : [];
    return [...outflows]
      .sort((a, b) => toDateScore(b?.date) - toDateScore(a?.date))
      .slice(0, 5);
  }

  function openOutflow(itemId) {
    if (!itemId || typeof global.openUnifiedOutflowModal !== 'function') return;
    global.openUnifiedOutflowModal(itemId);
  }

  function render(target) {
    if (!target) return;
    const month = getCurrentMonthSafe();
    if (!month) {
      target.innerHTML = '<div class="m2-empty">Sem dados para exibir no dashboard.</div>';
      return;
    }

    const metrics = getMonthMetrics(month);
    const categoryTotals = getCategoryTotals(month);
    const goals = getGoalRows(month);
    const recents = getRecentRows(month);

    target.innerHTML = `
      <header class="m2-header">
        <div>
          <h2 class="m2-title">Dashboard</h2>
          <p class="m2-subtitle">${escapeHtml(String(month?.nome || 'Mês atual'))}</p>
        </div>
        <div class="m2-header-actions">
          <button class="m2-icon-btn" type="button" aria-label="Tags" onclick="MobileV2FiltersSheet.open()">${global.SystemIcons?.render ? global.SystemIcons.render('tag') : '???'}</button>
          <button class="m2-icon-btn" type="button" aria-label="Perfil" onclick="MobileV2PerfilSheet.open()">${global.SystemIcons?.render ? global.SystemIcons.render('user') : '??'}</button>
        </div>
      </header>

      <section class="hero-card ${metrics.monthlyResult < 0 ? 'is-negative' : ''}">
        <div class="hero-result-label">RESULTADO DO MÊS</div>
        <div class="hero-result">${formatMoney(metrics.monthlyResult)}</div>
        <div class="hero-sub">
          <span>Renda ${formatMoney(metrics.monthlyIncome)}</span>
          <span>Gastos ${formatMoney(metrics.monthlyExpenses)}</span>
        </div>
      </section>

      <section class="dash-pair">
        <article class="dash-mini-card">
          <div class="dash-mini-label">Compromissos</div>
          <div class="dash-mini-value">${formatMoney(metrics.plannedCommitments)}</div>
          <div class="dash-mini-note">Plano do mês</div>
        </article>
        <article class="dash-mini-card">
          <div class="dash-mini-label">Gastos var.</div>
          <div class="dash-mini-value">${formatMoney(metrics.variableExpenses)}</div>
          <div class="dash-mini-note">Variáveis</div>
        </article>
      </section>

      <section class="dash-section">
        <div class="dash-section-header">
          <span>Gastos por categoria</span>
          <button class="dash-section-link" type="button" onclick="window.MobileV2?.setTab('mes'); window.MobileV2MesAtual?.setSubtab('gastos-metas'); window.MobileV2?.refresh?.();">Ver todas</button>
        </div>
        ${categoryTotals.length ? categoryTotals.map((entry) => {
          const max = categoryTotals[0]?.total || 1;
          const width = Math.max(5, Math.round((entry.total / max) * 100));
          return `
            <div class="dash-row dash-row-progress">
              <span class="dash-row-icon">${escapeHtml(entry.icon)}</span>
              <span class="dash-row-name">${escapeHtml(entry.name)}</span>
              <span class="dash-row-bar"><span class="dash-row-bar-fill" style="width:${width}%"></span></span>
              <span class="dash-row-value expense">${formatMoney(entry.total)}</span>
            </div>
          `;
        }).join('') : '<div class="dash-row"><span class="dash-row-date">Sem categorias com gastos no mês.</span></div>'}
      </section>

      <section class="dash-section">
        <div class="dash-section-header">
          <span>Metas do mês</span>
          <button class="dash-section-link" type="button" onclick="window.MobileV2?.setTab('mes'); window.MobileV2MesAtual?.setSubtab('gastos-metas'); window.MobileV2?.refresh?.();">Ver todas</button>
        </div>
        ${goals.length ? goals.map((goal) => {
          const fillClass = goal.percent > 100 ? 'over' : '';
          const clamped = Math.min(goal.percent, 100);
          return `
            <div class="dash-row dash-row-goal">
              <span class="dash-row-icon">${escapeHtml(goal.icon)}</span>
              <div class="dash-row-info">
                <span class="dash-row-name">${escapeHtml(goal.category)}</span>
                <span class="dash-row-date">${formatMoney(goal.spent)} / ${formatMoney(goal.goal)} · ${goal.percent}%</span>
              </div>
              <span class="dash-row-bar"><span class="dash-row-bar-fill ${fillClass}" style="width:${clamped}%"></span></span>
            </div>
          `;
        }).join('') : '<div class="dash-row"><span class="dash-row-date">Nenhuma meta ativa no mês.</span></div>'}
      </section>

      <section class="dash-section">
        <div class="dash-section-header">
          <span>Lançamentos recentes</span>
          <button class="dash-section-link" type="button" onclick="window.MobileV2?.setTab('mes')">Ver todos</button>
        </div>
        ${recents.length ? recents.map((item) => {
          const amount = Math.abs(Number(item?.amount || 0));
          const isExpense = Number(item?.amount || 0) >= 0;
          const desc = String(item?.description || 'Lançamento');
          const date = String(item?.date || 'Sem data');
          const category = resolveCategory(item);
          const icon = typeof global.getCategoryEmoji === 'function' ? global.getCategoryEmoji(category) : '•';
          const safeId = String(item?.id || '').replace(/"/g, '&quot;').replace(/'/g, "\\'");
          return `
            <button class="dash-row dash-row-click" type="button" onclick="MobileV2HomeScreen.openOutflow('${safeId}')">
              <span class="dash-row-icon">${escapeHtml(icon)}</span>
              <span class="dash-row-info">
                <span class="dash-row-name">${escapeHtml(desc)}</span>
                <span class="dash-row-date">${escapeHtml(date)} · ${escapeHtml(category)}</span>
              </span>
              <span class="dash-row-value ${isExpense ? 'expense' : 'income'}">${formatMoney(amount)}</span>
            </button>
          `;
        }).join('') : '<div class="dash-row"><span class="dash-row-date">Sem lançamentos recentes.</span></div>'}
      </section>
    `;
  }

  global.MobileV2HomeScreen = {
    render,
    openOutflow
  };
})(window);
