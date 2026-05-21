(function initMobileV2Historico(global) {
  'use strict';

  function formatMoney(value) {
    if (typeof global.fmt === 'function') return global.fmt(Number(value || 0));
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function summarizeMonth(month) {
    const totals = typeof global.getEffectiveTotalsForMes === 'function' ? global.getEffectiveTotalsForMes(month) : null;
    const income = Number(totals?.rendaTotal || 0);
    const expenses = typeof global.calculateUnifiedPlanningTotal === 'function'
      ? Number(global.calculateUnifiedPlanningTotal(month) || 0)
      : Number(totals?.totalGastos || 0);
    return {
      name: String(month?.nome || month?.id || 'Mês'),
      income,
      expenses,
      result: income - expenses
    };
  }

  function render(target) {
    if (!target) return;
    const months = typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : (global.data || []);
    const rows = [...months].map(summarizeMonth).reverse();
    target.innerHTML = `
      <div class="m2-header">
        <div>
          <h2 class="m2-title">Histórico</h2>
          <p class="m2-subtitle">Comparativo dos últimos meses</p>
        </div>
        <div class="m2-header-actions">
          <button class="m2-icon-btn" type="button" onclick="toggleNotificationsPopover(event)">${global.SystemIcons?.render ? global.SystemIcons.render('notification') : '🔔'}</button>
          <button class="m2-icon-btn" type="button" onclick="MobileV2PerfilSheet.open()">${global.SystemIcons?.render ? global.SystemIcons.render('user') : '👤'}</button>
        </div>
      </div>

      <section class="m2-card">
        <h3 class="m2-card-title">Resumo mensal</h3>
        ${rows.length ? rows.map((row) => `
          <article class="m2-recent-item">
            <span class="m2-icon-pill">📊</span>
            <span>
              <p class="m2-row-title">${global.escapeHtml ? global.escapeHtml(row.name) : row.name}</p>
              <span class="m2-row-meta">Gastos ${formatMoney(row.expenses)} · Renda ${formatMoney(row.income)}</span>
            </span>
            <span class="m2-row-amount ${row.result >= 0 ? 'positive' : 'negative'}">${formatMoney(row.result)}</span>
          </article>
        `).join('') : '<p style="color:var(--text3);font-size:12px">Sem histórico disponível.</p>'}
      </section>
    `;

  }

  global.MobileV2Historico = { render };
})(window);

