(function initMobileV2Historico(global) {
  'use strict';

  function formatMoney(value) {
    if (typeof global.fmt === 'function') return global.fmt(Number(value || 0));
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function summarizeMonth(month) {
    const income = (month?.renda || []).reduce((sum, item) => sum + Number(item?.valor || 0), 0)
      + (month?.projetos || []).reduce((sum, item) => sum + Number(item?.valor || 0), 0);
    let expenses = 0;
    (month?.outflows || []).forEach((item) => {
      if (item?.countsInPrimaryTotals === false) return;
      const v = Math.abs(Number(item?.amount || 0));
      if (!v) return;
      const kind = String(item?.outputKind || '').toLowerCase();
      if (kind === 'card' && String(item?.type || '').toLowerCase() === 'spend') return;
      expenses += v;
    });
    (month?.cardBills || []).forEach((bill) => {
      expenses += Math.abs(Number(bill?.amount || 0));
    });
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
    const chartRows = rows.slice(0, 6).reverse();
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
        <h3 class="m2-card-title">Últimos 6 meses</h3>
        <canvas id="mobileV2HistoricoChart" height="160"></canvas>
      </section>

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

    const canvas = target.querySelector('#mobileV2HistoricoChart');
    if (canvas && chartRows.length) {
      drawChart(canvas, chartRows);
    }
  }

  function drawChart(canvas, chartRows) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.clientWidth || 320;
    const height = Number(canvas.getAttribute('height') || 160);
    canvas.width = width * (global.devicePixelRatio || 1);
    canvas.height = height * (global.devicePixelRatio || 1);
    ctx.scale((global.devicePixelRatio || 1), (global.devicePixelRatio || 1));
    ctx.clearRect(0, 0, width, height);

    const max = Math.max(...chartRows.map((row) => Math.max(row.income, row.expenses, 1)));
    const barGroup = width / Math.max(chartRows.length, 1);
    const baseline = height - 20;
    const maxBarH = height - 44;

    chartRows.forEach((row, index) => {
      const x = index * barGroup + (barGroup * 0.18);
      const incomeH = Math.max(4, (row.income / max) * maxBarH);
      const expenseH = Math.max(4, (row.expenses / max) * maxBarH);
      const barW = Math.max(8, barGroup * 0.28);

      ctx.fillStyle = '#2b7a5a';
      ctx.fillRect(x, baseline - incomeH, barW, incomeH);
      ctx.fillStyle = '#b34a4a';
      ctx.fillRect(x + barW + 4, baseline - expenseH, barW, expenseH);

      ctx.fillStyle = '#7a8497';
      ctx.font = '10px sans-serif';
      const label = String(row.name || '').slice(0, 3);
      ctx.fillText(label, x, height - 6);
    });
  }

  global.MobileV2Historico = { render };
})(window);

