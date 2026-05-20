(function initMobileV2Home(global) {
  'use strict';

  const PERIODS = [
    { label: '3M', value: 3 },
    { label: '6M', value: 6 },
    { label: '12M', value: 12 },
    { label: 'Ano', value: 'year' }
  ];

  let activePeriod = 6;
  let resizeObserver = null;
  let previousChartState = null;
  let chartAnimationFrame = 0;

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
    const liveMonths = typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : [];
    const allMonths = liveMonths.length ? liveMonths : (global.MobileV2Enhancements?.getCachedFinanceMonths?.() || []);
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

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function interpolateSeries(previous, next, progress) {
    return next.map((item, index) => {
      const prior = previous?.[index] || {};
      return {
        ...item,
        renda: Number(prior.renda || 0) + (Number(item.renda || 0) - Number(prior.renda || 0)) * progress,
        gastos: Number(prior.gastos || 0) + (Number(item.gastos || 0) - Number(prior.gastos || 0)) * progress
      };
    });
  }

  function interpolateCategories(previous, next, progress) {
    return next.map((item, index) => {
      const prior = previous?.find((entry) => entry.name === item.name) || previous?.[index] || {};
      return {
        ...item,
        value: Number(prior.value || 0) + (Number(item.value || 0) - Number(prior.value || 0)) * progress
      };
    });
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

  function animateCharts(target, months, categories) {
    const line = target.querySelector('#mobileV2LineChart');
    const pie = target.querySelector('#mobileV2PieChart');
    const start = performance.now();
    const fromMonths = previousChartState?.months || months.map((month) => ({ ...month, renda: 0, gastos: 0 }));
    const fromCategories = previousChartState?.categories || categories.map((category) => ({ ...category, value: 0 }));
    cancelAnimationFrame(chartAnimationFrame);
    const step = (now) => {
      const progress = easeInOutCubic(Math.min(1, (now - start) / 300));
      drawLineChart(line, interpolateSeries(fromMonths, months, progress));
      drawPieChart(pie, interpolateCategories(fromCategories, categories, progress));
      if (progress < 1) {
        chartAnimationFrame = requestAnimationFrame(step);
      } else {
        previousChartState = {
          months: months.map((month) => ({ ...month })),
          categories: categories.map((category) => ({ ...category }))
        };
      }
    };
    chartAnimationFrame = requestAnimationFrame(step);
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

  async function shareDashboardSnapshot() {
    const months = getMonthsForPeriod(activePeriod);
    if (!months.length) return;
    const totalIncome = months.reduce((sum, month) => sum + month.renda, 0);
    const totalExpenses = months.reduce((sum, month) => sum + month.gastos, 0);
    const totalResult = totalIncome - totalExpenses;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FAFAF8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2471A3';
    ctx.fillRect(0, 0, canvas.width, 330);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 62px Inter, Arial';
    ctx.fillText('Controle Financeiro', 72, 118);
    ctx.font = '500 32px Inter, Arial';
    ctx.fillText(`Resumo ${PERIODS.find((period) => period.value === activePeriod)?.label || ''}`, 72, 174);
    ctx.font = '700 76px Inter, Arial';
    ctx.fillText(formatMoney(totalResult), 72, 278);
    ctx.fillStyle = '#152033';
    ctx.font = '700 44px Inter, Arial';
    ctx.fillText('Renda', 72, 438);
    ctx.fillText('Gastos', 72, 568);
    ctx.fillText('Resultado', 72, 698);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#2471A3';
    ctx.fillText(formatMoney(totalIncome), 1008, 438);
    ctx.fillStyle = '#E74C3C';
    ctx.fillText(formatMoney(totalExpenses), 1008, 568);
    ctx.fillStyle = totalResult >= 0 ? '#27AE60' : '#E74C3C';
    ctx.fillText(formatMoney(totalResult), 1008, 698);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#667085';
    ctx.font = '400 28px Inter, Arial';
    ctx.fillText('Gerado pelo app Controle Financeiro', 72, 1240);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.92));
    if (!blob) return;
    const file = new File([blob], 'resumo-financeiro.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: 'Resumo financeiro' });
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'resumo-financeiro.png';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function observeCharts(target, months, categories) {
    resizeObserver?.disconnect?.();
    if (!target || typeof ResizeObserver !== 'function') return;
    const line = target.querySelector('#mobileV2LineChart');
    const pie = target.querySelector('#mobileV2PieChart');
    let frame = 0;
    resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        drawLineChart(line, months);
        drawPieChart(pie, categories);
      });
    });
    if (line?.parentElement) resizeObserver.observe(line.parentElement);
    if (pie?.parentElement) resizeObserver.observe(pie.parentElement);
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
          <button class="m2-icon-btn" type="button" aria-label="Compartilhar dashboard" data-m2-share-dashboard>${global.SystemIcons?.render ? global.SystemIcons.render('share') : '↗'}</button>
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
    target.querySelector('[data-m2-share-dashboard]')?.addEventListener('click', () => {
      shareDashboardSnapshot().catch(() => {
        if (typeof global.showToast === 'function') global.showToast('Não foi possível compartilhar agora.');
      });
    });
    animateCharts(target, months, categories);
    observeCharts(target, months, categories);
  }

  global.MobileV2HomeScreen = {
    render,
    shareDashboardSnapshot
  };
})(window);

