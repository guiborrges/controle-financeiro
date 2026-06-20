(function initMobileV2Historico(global) {
  'use strict';

  const { formatMoney, escapeHtml } = global.MobileV2Data;

  function renderHeaderIcon(name, fallback) {
    return global.SystemIcons?.render ? (global.SystemIcons.render(name) || fallback) : fallback;
  }

  function summarizeMonth(month) {
    const metrics = global.MobileV2Data?.getMonthMetrics
      ? global.MobileV2Data.getMonthMetrics(month)
      : null;
    const totals = metrics ? null : (typeof global.getEffectiveTotalsForMes === 'function' ? global.getEffectiveTotalsForMes(month) : null);
    const income = metrics ? Number(metrics.renda || 0) : Number(totals?.rendaTotal || 0);
    const expenses = metrics
      ? Number(metrics.lancamentos || metrics.despesas || 0)
      : (typeof global.calculateUnifiedPlanningTotal === 'function'
        ? Number(global.calculateUnifiedPlanningTotal(month) || 0)
        : Number(totals?.totalGastos || 0));
    return {
      name: String(month?.nome || month?.id || 'Mês'),
      income,
      expenses,
      result: income - expenses
    };
  }

  function render(target) {
    if (!target) return;
    const months = global.MobileV2Data?.getMonths ? global.MobileV2Data.getMonths() : (typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : (global.data || []));
    const rows = [...months].map(summarizeMonth).reverse();
    target.innerHTML = `
      <div class="m2-header m2-page-header">
        <div>
          <h2 class="m2-title">Histórico</h2>
          <p class="m2-subtitle">Comparativo dos últimos meses</p>
        </div>
        <div class="m2-header-actions">
          <button class="m2-icon-btn" type="button" aria-label="Notificações" onclick="toggleNotificationsPopover(event)">${renderHeaderIcon('notification', '◌')}</button>
          <button class="m2-icon-btn" type="button" aria-label="Perfil" onclick="MobileV2PerfilSheet.open()">${renderHeaderIcon('user', '◯')}</button>
        </div>
      </div>

      <section class="m2-card">
        <h3 class="m2-card-title">Resumo mensal</h3>
        ${rows.length ? rows.map((row) => `
          <article class="m2-recent-item m2-history-row-plain">
            <span>
              <p class="m2-row-title">${escapeHtml(row.name)}</p>
              <span class="m2-row-meta">Lançamentos ${formatMoney(row.expenses)} · Renda ${formatMoney(row.income)}</span>
            </span>
            <span class="m2-row-amount ${row.result >= 0 ? 'positive' : 'negative'}">${formatMoney(row.result)}</span>
          </article>
        `).join('') : '<p style="color:var(--text3);font-size:12px">Sem histórico disponível.</p>'}
      </section>
    `;

  }

  global.MobileV2Historico = { render };
})(window);

