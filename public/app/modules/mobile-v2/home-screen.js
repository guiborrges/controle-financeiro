(function initMobileV2Home(global) {
  'use strict';

  const PERIODS = [
    { label: '3M', value: 3 },
    { label: '6M', value: 6 },
    { label: '12M', value: 12 },
    { label: 'Ano', value: 'year' }
  ];

  let activePeriod = 6;

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

  function monthExpenses(month) {
    const outflows = Array.isArray(month?.outflows) ? month.outflows : [];
    let total = 0;
    outflows.forEach((item) => {
      if (item?.countsInPrimaryTotals === false) return;
      const amount = Math.abs(Number(item?.amount || item?.valor || 0));
      if (!(amount > 0)) return;
      const kind = String(item?.outputKind || '').toLowerCase();
      const type = String(item?.type || '').toLowerCase();
      if (kind === 'card' && type === 'spend') return;
      total += amount;
    });
    (month?.cardBills || []).forEach((bill) => {
      total += Math.abs(Number(bill?.amount || 0));
    });
    return total;
  }

  function monthIncome(month) {
    return (month?.renda || []).reduce((sum, item) => sum + Number(item?.valor || 0), 0)
      + (month?.projetos || []).reduce((sum, item) => sum + Number(item?.valor || 0), 0);
  }

  function toChartMonth(month) {
    const labelRaw = String(month?.nome || '');
    const shortLabel = labelRaw.split(' ')[0]?.slice(0, 3)?.toUpperCase?.() || '--';
    const income = monthIncome(month);
    const expenses = monthExpenses(month);
    return {
      id: month?.id,
      label: labelRaw,
      shortLabel,
      renda: income,
      gastos: expenses,
      resultado: income - expenses
    };
  }

  function getMonthsForPeriod(value) {
    const allMonths = typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : [];
    if (!allMonths.length) return [];
    if (value === 'year') {
      const curr = allMonths[allMonths.length - 1];
      const year = String(curr?.nome || '').split(' ').pop();
      return allMonths.filter((month) => String(month?.nome || '').endsWith(String(year || ''))).map(toChartMonth);
    }
    const size = Number(value || 6);
    return allMonths.slice(-size).map(toChartMonth);
  }

  function buildCategoryTotals(months) {
    const totals = new Map();
    months.forEach((month) => {
      const rawMonth = (typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : []).find((m) => m?.id === month.id);
      const outflows = Array.isArray(rawMonth?.outflows) ? rawMonth.outflows : [];
      outflows.forEach((item) => {
        if (item?.countsInPrimaryTotals === false) return;
        const amount = Math.abs(Number(item?.amount || 0));
        if (!(amount > 0)) return;
        const kind = String(item?.outputKind || '').toLowerCase();
        const type = String(item?.type || '').toLowerCase();
        if (kind === 'card' && type === 'spend') return;
        const catRaw = item?.category || item?.categoria || 'OUTROS';
        const cat = String(global.resolveCategoryName ? global.resolveCategoryName(catRaw) : catRaw).trim() || 'OUTROS';
        totals.set(cat, (totals.get(cat) || 0) + amount);
      });
    });
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  }

  function drawLineChart(canvas, months) {
    if (!canvas || !months.length) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth || 320;
    const H = canvas.height = 170;
    const PAD = { top: 12, right: 12, bottom: 30, left: 32 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    const rendas = months.map((m) => m.renda || 0);
    const gastos = months.map((m) => m.gastos || 0);
    const maxVal = Math.max(...rendas, ...gastos, 1) * 1.1;

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#d9dde5';
    ctx.lineWidth = 1;
    [0, 0.5, 1].forEach((t) => {
      const y = PAD.top + chartH * (1 - t);
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.stroke();
    });

    const xOf = (i) => PAD.left + ((months.length <= 1 ? 0 : i / (months.length - 1)) * chartW);
    const yOf = (v) => PAD.top + chartH * (1 - (v / maxVal));

    const draw = (points, color) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      points.forEach(([x, y], idx) => (idx ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    };

    draw(months.map((m, i) => [xOf(i), yOf(m.renda || 0)]), '#2471A3');
    draw(months.map((m, i) => [xOf(i), yOf(m.gastos || 0)]), '#E74C3C');

    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    months.forEach((m, i) => {
      ctx.fillText(String(m.shortLabel || '--'), xOf(i), H - 8);
    });
  }

  function drawPieChart(canvas, categories) {
    if (!canvas || !categories.length) return;
    const ctx = canvas.getContext('2d');
    const size = Math.min(canvas.offsetWidth || 140, 160);
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 6;
    const total = categories.reduce((sum, item) => sum + item.value, 0) || 1;
    const colors = ['#2471A3', '#E74C3C', '#27AE60', '#F39C12', '#8E44AD', '#17A589'];

    let start = -Math.PI / 2;
    categories.forEach((item, idx) => {
      const arc = (item.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, start + arc);
      ctx.closePath();
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fill();
      start += arc;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#fff';
    ctx.fill();
  }

  function bindPeriodButtons(target) {
    target.querySelectorAll('[data-m2-period]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const raw = btn.getAttribute('data-m2-period');
        activePeriod = raw === 'year' ? 'year' : Number(raw || 6);
        render(target);
      });
    });
  }

  function render(target) {
    if (!target) return;
    const months = getMonthsForPeriod(activePeriod);
    if (!months.length) {
      target.innerHTML = '<div class="m2-empty">Sem histórico para exibir no dashboard.</div>';
      return;
    }

    const totalIncome = months.reduce((sum, month) => sum + month.renda, 0);
    const totalExpenses = months.reduce((sum, month) => sum + month.gastos, 0);
    const totalResult = totalIncome - totalExpenses;
    const categories = buildCategoryTotals(months);

    target.innerHTML = `
      <header class="m2-header">
        <div>
          <h2 class="m2-title">Dashboard</h2>
          <p class="m2-subtitle">Visão de médio e longo prazo</p>
        </div>
        <div class="m2-header-actions">
          <button class="m2-icon-btn" type="button" aria-label="Tags" onclick="MobileV2FiltersSheet.open()">${global.SystemIcons?.render ? global.SystemIcons.render('tag') : ''}</button>
          <button class="m2-icon-btn" type="button" aria-label="Perfil" onclick="MobileV2PerfilSheet.open()">${global.SystemIcons?.render ? global.SystemIcons.render('user') : ''}</button>
        </div>
      </header>

      <div class="period-selector">
        ${PERIODS.map((period) => `
          <button type="button" class="period-btn ${period.value === activePeriod ? 'active' : ''}" data-m2-period="${period.value}">${period.label}</button>
        `).join('')}
      </div>

      <section class="hero-card ${totalResult < 0 ? 'is-negative' : ''}">
        <div class="hero-result-label">RESULTADO ACUMULADO</div>
        <div class="hero-result">${formatMoney(totalResult)}</div>
        <div class="hero-sub">
          <span>Renda ${formatMoney(totalIncome)}</span>
          <span>Gastos ${formatMoney(totalExpenses)}</span>
        </div>
      </section>

      <section class="dash-section">
        <div class="dash-section-header"><span>Evolução mensal</span></div>
        <canvas id="mobileV2LineChart" class="mobile-v2-chart-canvas"></canvas>
      </section>

      <section class="dash-section">
        <div class="dash-section-header"><span>Gastos por categoria</span></div>
        <div class="dash-pie-row">
          <canvas id="mobileV2PieChart" class="pie-canvas"></canvas>
          <div class="pie-legend">
            ${categories.map((category, idx) => {
              const total = categories.reduce((sum, item) => sum + item.value, 0) || 1;
              const pct = Math.round((category.value / total) * 100);
              const colors = ['#2471A3', '#E74C3C', '#27AE60', '#F39C12', '#8E44AD', '#17A589'];
              return `
                <div class="pie-legend-item">
                  <span class="pie-dot" style="background:${colors[idx % colors.length]}"></span>
                  <span class="pie-cat">${escapeHtml(category.name)}</span>
                  <span class="pie-pct">${pct}%</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </section>
    `;

    bindPeriodButtons(target);
    drawLineChart(target.querySelector('#mobileV2LineChart'), months);
    drawPieChart(target.querySelector('#mobileV2PieChart'), categories);
  }

  global.MobileV2HomeScreen = {
    render
  };
})(window);

