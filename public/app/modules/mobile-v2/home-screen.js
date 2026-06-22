(function initMobileV2Home(global) {
  'use strict';

  const PERIODS = [
    { label: '1M', value: 1 },
    { label: '3M', value: 3 },
    { label: '6M', value: 6 },
    { label: '12M', value: 12 },
    { label: 'Período', value: 'custom' }
  ];

  let activePeriod = 6;
  let resizeObserver = null;
  let previousChartState = null;
  let chartAnimationFrame = 0;
  let customRange = null;

  const { escapeHtml, formatMoney, categoryIcon: getCategorySymbol } = global.MobileV2Data;

  function renderHeaderIcon(name, fallback) {
    return global.SystemIcons?.render ? (global.SystemIcons.render(name) || fallback) : fallback;
  }

  function monthExpenses(month) {
    if (global.MobileV2Data?.getPlanningTotal) return global.MobileV2Data.getPlanningTotal(month);
    if (typeof global.calculateUnifiedPlanningTotal === 'function') {
      return Number(global.calculateUnifiedPlanningTotal(month) || 0);
    }
    const totals = typeof global.getEffectiveTotalsForMes === 'function' ? global.getEffectiveTotalsForMes(month) : null;
    return Number(totals?.totalGastos || 0);
  }

  function monthIncome(month) {
    if (global.MobileV2Data?.getIncomeTotal) return global.MobileV2Data.getIncomeTotal(month);
    const totals = typeof global.getEffectiveTotalsForMes === 'function' ? global.getEffectiveTotalsForMes(month) : null;
    return Number(totals?.rendaTotal || 0);
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
    const liveMonths = global.MobileV2Data?.getMonths ? global.MobileV2Data.getMonths() : (typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : []);
    const allMonths = liveMonths.length ? liveMonths : (global.MobileV2Enhancements?.getCachedFinanceMonths?.() || []);
    if (!allMonths.length) return [];
    if (Number(value) === 1) {
      const currentMonth = global.MobileV2Data?.getCurrentMonth
        ? global.MobileV2Data.getCurrentMonth()
        : (typeof global.getCurrentMonth === 'function' ? global.getCurrentMonth() : null);
      const matched = currentMonth
        ? allMonths.find((month) => String(month?.id || '') === String(currentMonth?.id || '')) || currentMonth
        : allMonths[allMonths.length - 1];
      return matched ? [matched].map(toChartMonth) : [];
    }
    if (value === 'custom') {
      if (!customRange) return allMonths.slice(-6).map(toChartMonth);
      const startIdx = Math.max(0, Number(customRange.startIdx || 0));
      const endIdx = Math.min(allMonths.length - 1, Number(customRange.endIdx || (allMonths.length - 1)));
      return allMonths.slice(startIdx, endIdx + 1).map(toChartMonth);
    }
    const size = Number(value || 6);
    return allMonths.slice(-size).map(toChartMonth);
  }

  function buildCategoryTotals(months) {
    const totals = new Map();
    months.forEach((month) => {
      const rawMonth = (global.MobileV2Data?.getMonths ? global.MobileV2Data.getMonths() : (typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : [])).find((m) => m?.id === month.id);
      const summary = rawMonth && global.MobileV2Data?.getSpendCategorySummary
        ? global.MobileV2Data.getSpendCategorySummary(rawMonth)
        : (rawMonth && typeof global.getUnifiedSpendCategorySummary === 'function' ? global.getUnifiedSpendCategorySummary(rawMonth) : null);
      if (summary) {
        (summary?.rows || []).forEach((row) => {
          const safeCategory = String(row?.category || 'OUTROS').trim() || 'OUTROS';
          const value = Math.max(0, Number(row?.total || 0));
          if (value > 0) totals.set(safeCategory, Number(totals.get(safeCategory) || 0) + value);
        });
        return;
      }
      const monthCategoryTotals = typeof global.getVariableCategoryTotals === 'function'
        ? global.getVariableCategoryTotals(rawMonth || {}) || {}
        : {};
      Object.entries(monthCategoryTotals).forEach(([categoryName, value]) => {
        const safeCategory = String(global.resolveCategoryName ? global.resolveCategoryName(categoryName) : categoryName).trim() || 'OUTROS';
        totals.set(safeCategory, Number(totals.get(safeCategory) || 0) + Math.max(0, Number(value || 0)));
      });
    });
    const ordered = Array.from(totals.entries())
      .filter(([, value]) => Number(value || 0) > 0)
      .sort((a, b) => b[1] - a[1]);
    const visible = ordered.slice(0, 7).map(([name, value]) => ({ name, value }));
    const extra = ordered.slice(7).reduce((sum, [, value]) => sum + Number(value || 0), 0);
    if (extra > 0) visible.push({ name: 'Outras', value: Number(extra.toFixed(2)) });
    return visible;
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
    ctx.fillStyle = '#8a93a3';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    [0, 0.5, 1].forEach((t) => {
      const y = PAD.top + chartH * (1 - t);
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.stroke();
      const value = maxVal * t;
      ctx.fillText(formatChartAxisValue(value), PAD.left - 5, y + 3);
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

  function formatChartAxisValue(value) {
    const numeric = Number(value || 0);
    if (numeric >= 1000000) return `${(numeric / 1000000).toFixed(1).replace('.', ',')}M`;
    if (numeric >= 1000) return `${Math.round(numeric / 1000)}k`;
    return String(Math.round(numeric));
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
        if (raw === 'custom') {
          openCustomPeriodSheet(target);
          return;
        }
        activePeriod = Number(raw || 6);
        render(target);
      });
    });
  }

  function openCustomPeriodSheet(target) {
    const months = global.MobileV2Data?.getMonths ? global.MobileV2Data.getMonths() : (typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : []);
    const sheet = global.MobileV2OutflowForm?.openInlineSheet;
    if (!months.length || typeof sheet !== 'function') return;
    const startId = `dashPeriodStart_${Date.now()}`;
    const endId = `${startId}_end`;
    const saveId = `${startId}_save`;
    const options = months.map((month, index) => `<option value="${index}">${escapeHtml(month?.nome || month?.id || `Mês ${index + 1}`)}</option>`).join('');
    sheet({
      title: 'Escolher período',
      subtitle: 'O Dashboard usará os mesmos meses do sistema principal.',
      body: `
        <label class="m2-field-label" for="${startId}">Mês inicial</label>
        <select id="${startId}" class="m2-field-input">${options}</select>
        <label class="m2-field-label" for="${endId}">Mês final</label>
        <select id="${endId}" class="m2-field-input">${options}</select>
        <div class="m2-sheet-actions">
          <button class="m2-chip-btn" type="button" onclick="MobileV2OutflowForm.closeInlineSheet()">Cancelar</button>
          <button id="${saveId}" class="m2-chip-btn positive" type="button">Aplicar período</button>
        </div>
      `
    });
    requestAnimationFrame(() => {
      const start = document.getElementById(startId);
      const end = document.getElementById(endId);
      if (start) start.value = String(customRange?.startIdx ?? Math.max(0, months.length - 6));
      if (end) end.value = String(customRange?.endIdx ?? (months.length - 1));
      document.getElementById(saveId)?.addEventListener('click', () => {
        const startIdx = Math.max(0, Math.min(months.length - 1, Number(start?.value || 0)));
        const endIdx = Math.max(startIdx, Math.min(months.length - 1, Number(end?.value || months.length - 1)));
        customRange = { startIdx, endIdx };
        activePeriod = 'custom';
        global.MobileV2OutflowForm?.closeInlineSheet?.();
        render(target);
      });
    });
  }

  function openCategoryDetails(categoryName, months) {
    const allMonths = global.MobileV2Data?.getMonths ? global.MobileV2Data.getMonths() : (typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : []);
    const allowed = new Set((months || []).map((entry) => String(entry.id || '')));
    const rows = [];
    allMonths.forEach((month) => {
      if (!allowed.has(String(month?.id || ''))) return;
      const outflows = global.MobileV2Data?.getOutflowRows
        ? global.MobileV2Data.getOutflowRows(month)
        : (month?.outflows || []);
      outflows.forEach((item) => {
        const cat = global.MobileV2Data?.getCategoryName
          ? global.MobileV2Data.getCategoryName(item, 'OUTROS')
          : (typeof global.getUnifiedOutflowCategoryName === 'function'
            ? String(global.getUnifiedOutflowCategoryName(item, 'OUTROS') || 'OUTROS')
            : String(global.resolveCategoryName ? global.resolveCategoryName(item?.category || item?.categoria || 'OUTROS') : (item?.category || item?.categoria || 'OUTROS')));
        if (cat !== categoryName) return;
        const amount = global.MobileV2Data?.getOutflowAmount
          ? global.MobileV2Data.getOutflowAmount(item)
          : (typeof global.getUnifiedEffectiveOutflowAmount === 'function'
            ? global.getUnifiedEffectiveOutflowAmount(item)
            : Number(global.OutflowAmounts?.getEffectiveOutflowAmount?.(item) ?? item?.amount ?? 0));
        if (!(amount > 0)) return;
        rows.push({
          id: String(item?.id || ''),
          date: String(item?.date || ''),
          description: String(item?.description || 'Lançamento'),
          amount,
          output: String(item?.outputKind === 'card' ? 'Cartão' : (item?.outputMethod || 'Saída')),
          tag: String(item?.tag || '')
        });
      });
    });
    const body = rows.length ? rows.map((row) => `
      <article class="m2-recent-item" data-m2-edit-outflow="${escapeHtml(row.id)}">
        <span>
          <p class="m2-row-title">${escapeHtml(row.description)}</p>
          <span class="m2-row-meta">${escapeHtml(row.date)} · ${escapeHtml(row.output)}${row.tag ? ` · ${escapeHtml(row.tag)}` : ''}</span>
        </span>
        <span class="m2-row-amount negative">${formatMoney(Math.abs(row.amount || 0))}</span>
      </article>
    `).join('') : '<div class="m2-empty">Sem lançamentos nessa categoria no período.</div>';
    global.MobileV2OutflowForm?.openInlineSheet?.({
      title: `Categoria: ${categoryName}`,
      subtitle: `${rows.length} lançamento(s)`,
      body
    });
    requestAnimationFrame(() => {
      const sheet = document.getElementById('mobileV2OutflowSheet');
      sheet?.querySelectorAll('[data-m2-edit-outflow]').forEach((node) => {
        node.addEventListener('click', () => {
          const id = String(node.getAttribute('data-m2-edit-outflow') || '');
          if (!id) return;
          const item = allMonths.flatMap((month) => Array.isArray(month?.outflows) ? month.outflows : []).find((entry) => String(entry?.id || '') === id);
          if (item && global.MobileV2OutflowForm?.openEdit) {
            global.MobileV2OutflowForm.openEdit(item);
          } else if (typeof global.openUnifiedOutflowModal === 'function') {
            global.MobileV2OutflowForm?.closeInlineSheet?.();
            global.openUnifiedOutflowModal(id);
          }
        });
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
    ctx.fillText('Lançamentos', 72, 568);
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
      target.innerHTML = '<div class="m2-empty m2-empty-rich"><strong>Seu dashboard ficará mais completo conforme você utiliza o sistema.</strong></div>';
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
          <button class="m2-icon-btn" type="button" aria-label="Buscador universal" onclick="MobileV2.openUniversalSearch()">${renderHeaderIcon('search', '⌕')}</button>
          <button class="m2-icon-btn" type="button" aria-label="Compartilhar dashboard" data-m2-share-dashboard>${renderHeaderIcon('share', '↗')}</button>
          <button class="m2-icon-btn" type="button" aria-label="Perfil" onclick="MobileV2PerfilSheet.open()">${renderHeaderIcon('user', '☰')}</button>
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
          <span>Lançamentos ${formatMoney(totalExpenses)}</span>
        </div>
      </section>

      <section class="dash-section">
        <div class="dash-section-header"><span>Evolução mensal</span></div>
        <canvas id="mobileV2LineChart" class="mobile-v2-chart-canvas"></canvas>
        <div class="m2-line-legend" aria-label="Legenda do gráfico de evolução mensal">
          <span class="m2-line-legend-item">
            <span class="m2-line-legend-dot is-income"></span>
            <span>Renda</span>
          </span>
          <span class="m2-line-legend-item">
            <span class="m2-line-legend-dot is-expense"></span>
            <span>Lançamentos</span>
          </span>
        </div>
      </section>

      <section class="dash-section">
        <div class="dash-section-header"><span>Lançamentos por categoria</span></div>
        <div class="dash-pie-row">
          <canvas id="mobileV2PieChart" class="pie-canvas"></canvas>
          <div class="pie-legend">
            ${categories.map((category, idx) => {
              const total = categories.reduce((sum, item) => sum + item.value, 0) || 1;
              const pct = Math.round((category.value / total) * 100);
              const colors = ['#2471A3', '#E74C3C', '#27AE60', '#F39C12', '#8E44AD', '#17A589'];
              return `
                <button type="button" class="pie-legend-item" data-m2-cat="${escapeHtml(category.name)}">
                  <span class="pie-dot" style="background:${colors[idx % colors.length]}"></span>
                  <span class="pie-cat">${getCategorySymbol(category.name)} <span>${escapeHtml(category.name)}</span></span>
                  <span class="pie-pct">${pct}%</span>
                </button>
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
    target.querySelectorAll('[data-m2-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const category = String(btn.getAttribute('data-m2-cat') || '');
        if (!category) return;
        openCategoryDetails(category, months);
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

