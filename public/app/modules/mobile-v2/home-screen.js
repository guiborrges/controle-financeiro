(function initMobileV2Home(global) {
  'use strict';

  function formatMoney(value) {
    if (typeof global.fmt === 'function') return global.fmt(Number(value || 0));
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function getMonthMetrics(month) {
    const outflows = Array.isArray(month?.outflows) ? month.outflows : [];
    const incomeRows = Array.isArray(month?.renda) ? month.renda : [];
    const projectRows = Array.isArray(month?.projetos) ? month.projetos : [];

    const income = incomeRows.reduce((acc, item) => {
      if (item?.includeInTotals === false) return acc;
      return acc + Number(item?.valor || 0);
    }, 0) + projectRows.reduce((acc, item) => {
      if (item?.includeInTotals === false) return acc;
      return acc + Number(item?.valor || 0);
    }, 0);

    let expenses = 0;
    outflows.forEach((item) => {
      if (item?.countsInPrimaryTotals === false) return;
      const value = Math.abs(Number(item?.amount || item?.valor || 0));
      if (!value) return;
      const kind = String(item?.outputKind || '').toLowerCase();
      if (kind === 'card' && String(item?.type || '').toLowerCase() === 'spend') return;
      expenses += value;
    });

    const bills = Array.isArray(month?.cardBills) ? month.cardBills : [];
    bills.forEach((bill) => {
      expenses += Math.abs(Number(bill?.amount || 0));
    });

    return {
      income,
      expenses,
      result: income - expenses
    };
  }

  function getCategoryTotals(month) {
    const totals = new Map();
    const outflows = Array.isArray(month?.outflows) ? month.outflows : [];
    outflows.forEach((item) => {
      if (item?.countsInPrimaryTotals === false) return;
      if (String(item?.type || '').toLowerCase() !== 'spend') return;
      const amount = Math.abs(Number(item?.amount || 0));
      if (!(amount > 0)) return;
      const category = String(global.resolveCategoryName ? global.resolveCategoryName(item?.category || item?.categoria || 'OUTROS') : (item?.category || 'OUTROS')).trim() || 'OUTROS';
      totals.set(category, (totals.get(category) || 0) + amount);
    });
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, total]) => ({ name, total }));
  }

  function getRecentRows(month) {
    const outflows = Array.isArray(month?.outflows) ? month.outflows : [];
    const sorted = [...outflows].sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')));
    return sorted.slice(0, 5);
  }

  function render(target) {
    if (!target) return;
    const month = typeof global.getCurrentMonth === 'function' ? global.getCurrentMonth() : null;
    if (!month) {
      target.innerHTML = '<div class="m2-card"><p>Sem dados para exibir.</p></div>';
      return;
    }

    const userName = document.getElementById('sessionUserName')?.textContent?.trim() || 'Usuário';
    const metrics = getMonthMetrics(month);
    const catTotals = getCategoryTotals(month);
    const recents = getRecentRows(month);

    target.innerHTML = `
      <div class="m2-header">
        <div>
          <h2 class="m2-title">Olá, ${userName.split(' ')[0]}</h2>
          <p class="m2-subtitle">${global.escapeHtml ? global.escapeHtml(String(month?.nome || 'Mês atual')) : String(month?.nome || 'Mês atual')}</p>
        </div>
        <button class="m2-icon-btn" type="button" aria-label="Notificações" onclick="toggleNotificationsPopover(event)">${global.SystemIcons?.render ? global.SystemIcons.render('notification') : '🔔'}</button>
      </div>

      <section class="hero-result-card">
        <div class="hero-result-label">Resultado do mês</div>
        <div class="hero-result-value">${formatMoney(metrics.result)}</div>
      </section>

      <div class="metric-pair">
        <article class="metric-small-card">
          <div class="metric-small-label">Renda</div>
          <div class="metric-small-value">${formatMoney(metrics.income)}</div>
        </article>
        <article class="metric-small-card">
          <div class="metric-small-label">Despesas</div>
          <div class="metric-small-value">${formatMoney(metrics.expenses)}</div>
        </article>
      </div>

      <section class="m2-card">
        <h3 class="m2-card-title">Gastos por categoria</h3>
        ${catTotals.length ? catTotals.map((entry) => {
          const max = catTotals[0]?.total || 1;
          const percent = Math.max(4, Math.round((entry.total / max) * 100));
          return `
            <div class="category-progress-row">
              <div style="width:96px;font-size:12px;color:var(--text2)">${global.escapeHtml ? global.escapeHtml(entry.name) : entry.name}</div>
              <div class="category-bar-fill"><div class="category-bar-fill-inner" style="width:${percent}%"></div></div>
              <div style="font-size:12px;font-weight:600">${formatMoney(entry.total)}</div>
            </div>
          `;
        }).join('') : '<p style="color:var(--text3);font-size:12px">Sem gastos categorizados no mês.</p>'}
      </section>

      <section class="m2-card">
        <h3 class="m2-card-title">Lançamentos recentes</h3>
        ${recents.length ? recents.map((item) => {
          const amount = Math.abs(Number(item?.amount || 0));
          const desc = String(item?.description || 'Lançamento');
          const date = String(item?.date || '');
          const icon = global.getCategoryEmoji ? global.getCategoryEmoji(item?.category || item?.categoria || 'OUTROS') : '•';
          return `
            <button class="m2-recent-item" type="button" onclick="openUnifiedOutflowModal('${String(item?.id || '').replace(/'/g, "\\'")}')">
              <span class="m2-icon-pill">${icon}</span>
              <span>
                <p class="m2-row-title">${global.escapeHtml ? global.escapeHtml(desc) : desc}</p>
                <span class="m2-row-meta">${global.escapeHtml ? global.escapeHtml(date) : date}</span>
              </span>
              <span class="m2-row-amount negative">${formatMoney(amount)}</span>
            </button>
          `;
        }).join('') : '<p style="color:var(--text3);font-size:12px">Sem lançamentos recentes.</p>'}
        <button class="m2-chip-btn" type="button" onclick="window.MobileV2?.setTab('mes')">Ver todos</button>
      </section>
    `;
  }

  global.MobileV2HomeScreen = { render };
})(window);
