function renderDashSeriesControls() {
  const wrap = document.getElementById('dashSeriesControls');
  if (!wrap) return;
  const selectedCount = dashSeriesSelection.length;
  const filtered = getFilteredData();
  const allowedKeys = getDashboardSeriesKeys();
  wrap.innerHTML = `
    <button class="btn btn-ghost" style="padding:6px 12px;font-size:12px" onclick="toggleDashSeriesPicker()">
      Series (${selectedCount})
    </button>
    <div id="dashSeriesPicker" style="display:${dashSeriesPickerOpen ? 'block' : 'none'};position:absolute;top:calc(100% + 8px);right:0;z-index:20;min-width:260px;padding:14px;background:#fffdf8;border:1px solid rgba(140,118,96,.18);border-radius:14px;box-shadow:0 18px 42px rgba(63,42,24,.12)">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:10px">Escolha o que aparece</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${allowedKeys.map(key => `
          <label style="display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--text);cursor:pointer">
            <input type="checkbox" ${dashSeriesSelection.includes(key) ? 'checked' : ''} onchange="setDashSeriesSelection('${key}', this.checked)" style="margin-top:2px">
            <span>${getDashboardSeriesLabel(key, filtered)}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `;
}

function isGenericDashboardUser() {
  return !isPrimaryUserEnvironment();
}

function getDashboardResultMode() {
  return 'simples';
}

function getDashboardMetricKeys() {
  return isGenericDashboardUser()
    ? ['resultado', 'gastos', 'ganhos']
    : ['resultado', 'gastos', 'ganhos', 'renda', 'projetos'];
}

function getDashboardSeriesKeys() {
  return isGenericDashboardUser()
    ? ['resultSimple', 'totalGastos', 'totalGanhos']
    : Object.keys(DASH_SERIES_OPTIONS);
}

function getDashboardSeriesLabel(key, filtered) {
  if (isGenericDashboardUser()) {
    if (key === 'resultSimple') return 'Resultado do mês';
    if (key === 'totalGastos') return 'Gastos total';
    if (key === 'totalGanhos') return 'Ganhos total';
  }
  const option = DASH_SERIES_OPTIONS[key];
  return typeof option?.getLabel === 'function' ? option.getLabel(filtered) : option?.label || key;
}

function getDashboardResultLabel(filtered) {
  return 'Resultado do mês';
}

function isTypeLikeCategoryLabel(name) {
  const normalized = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  const blocked = new Set([
    'DESPESA FIXA',
    'DESPESAS FIXAS',
    'DESPESA VARIAVEL',
    'DESPESAS VARIAVEIS',
    'GASTO',
    'GASTOS',
    'VARIAVEL',
    'VARIAVEIS',
    'DESPESA RECORRENTE',
    'DESPESAS RECORRENTES',
    'GASTO RECORRENTE',
    'GASTOS RECORRENTES',
    'CARTAO',
    'CARTAO DE CREDITO',
    'CARTAO MENSAL',
    'CARTAO DE CREDITO MENSAL'
  ]);
  return blocked.has(normalized);
}

function buildDistinctPieColors(length) {
  const base = ['#2f6fb6','#2f8f62','#c98d1e','#c6543f','#6a57b8','#1f9aa8','#7a9557','#c27a46','#4e78c7','#9a4f7e'];
  const colors = [];
  for (let i = 0; i < length; i += 1) {
    if (i < base.length) colors.push(base[i]);
    else colors.push(`hsl(${((i * 137.508) % 360).toFixed(0)} 55% 52%)`);
  }
  return colors;
}

function toggleDashSeriesPicker() {
  dashSeriesPickerOpen = !dashSeriesPickerOpen;
  renderDashSeriesControls();
}

function setDashSeriesSelection(key, checked) {
  if (!getDashboardSeriesKeys().includes(key)) return;
  const next = checked
    ? [...dashSeriesSelection, key]
    : dashSeriesSelection.filter(item => item !== key);
  if (JSON.stringify(sanitizeDashSeriesSelection(next).filter(item => getDashboardSeriesKeys().includes(item))) !== JSON.stringify(dashSeriesSelection)) {
    recordHistoryState();
  }
  dashSeriesSelection = sanitizeDashSeriesSelection(next).filter(item => getDashboardSeriesKeys().includes(item));
  if (!dashSeriesSelection.length) dashSeriesSelection = [...getDashboardSeriesKeys()];
  saveDashSeriesSelection();
  saveUIState();
  renderDashboard();
}

function onDashMetricDragStart(event, key) {
  if (typeof isMobileUiMode === 'function' && isMobileUiMode()) return;
  dragDashMetricKey = key;
  const card = event.currentTarget;
  if (card) card.classList.add('dragging');
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
  }
}

function onDashMetricDragEnd(event) {
  dragDashMetricKey = '';
  document.querySelectorAll('#dashMetrics .metric-card').forEach(card => {
    card.classList.remove('dragging', 'drag-target');
  });
}

function onDashMetricDragOver(event) {
  if (typeof isMobileUiMode === 'function' && isMobileUiMode()) return;
  event.preventDefault();
  const card = event.currentTarget;
  if (!card || !dragDashMetricKey || card.dataset.metricKey === dragDashMetricKey) return;
  card.classList.add('drag-target');
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
}

function onDashMetricDragLeave(event) {
  const card = event.currentTarget;
  if (card) card.classList.remove('drag-target');
}

function onDashMetricDrop(event, targetKey) {
  if (typeof isMobileUiMode === 'function' && isMobileUiMode()) return;
  event.preventDefault();
  const fromKey = dragDashMetricKey || (event.dataTransfer ? event.dataTransfer.getData('text/plain') : '');
  if (!fromKey || !targetKey || fromKey === targetKey) return;
  recordHistoryState();
  const next = dashMetricOrder.filter(key => key !== fromKey);
  const targetIndex = next.indexOf(targetKey);
  next.splice(targetIndex, 0, fromKey);
  dashMetricOrder = sanitizeDashMetricOrder(next);
  saveDashMetricOrder();
  saveUIState();
  renderDashboard();
}

function startDashboardWidgetDrag(event, key) {
  if (typeof isMobileUiMode === 'function' && isMobileUiMode()) return;
  event.preventDefault();
  const grid = document.getElementById('dashboardWidgets');
  const widget = event.currentTarget?.closest('.dashboard-widget');
  if (!grid || !widget) return;
  recordHistoryState();
  dashboardWidgetLayout = sanitizeDashboardWidgetLayout(dashboardWidgetLayout);
  dashboardWidgetDragState = {
    key,
    grid,
    widget,
    startMouseX: event.clientX,
    startMouseY: event.clientY,
    startLayout: JSON.parse(JSON.stringify(dashboardWidgetLayout))
  };
  widget.classList.add('dragging');
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'grabbing';
}

function moveDashboardWidgetDrag(event) {
  if (!dashboardWidgetDragState) return;
  const { widget, startMouseX, startMouseY } = dashboardWidgetDragState;
  const dx = event.clientX - startMouseX;
  const dy = event.clientY - startMouseY;
  if (widget) widget.style.transform = `translate(${dx}px, ${dy}px)`;
}

function stopDashboardWidgetDrag(event) {
  if (!dashboardWidgetDragState) return;
  const { key, grid, widget, startLayout, startMouseX, startMouseY } = dashboardWidgetDragState;
  const startItem = startLayout[key];
  const dx = (event?.clientX ?? startMouseX) - startMouseX;
  const dy = (event?.clientY ?? startMouseY) - startMouseY;
  const maxX = Math.max(0, (grid?.clientWidth || 1100) - startItem.w);
  const targetX = Math.max(0, Math.min(maxX, startItem.x + dx));
  const targetY = Math.max(0, startItem.y + dy);
  dashboardWidgetLayout = sanitizeDashboardWidgetLayout({
    ...startLayout,
    [key]: {
      ...startItem,
      x: Math.round(targetX),
      y: Math.round(targetY)
    }
  });
  if (widget) {
    widget.classList.remove('dragging');
    widget.style.transform = '';
  }
  saveDashboardWidgetState();
  saveUIState();
  renderDashboard();
  dashboardWidgetDragState = null;
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
}

function startDashboardWidgetResize(event, key) {
  if (typeof isMobileUiMode === 'function' && isMobileUiMode()) return;
  event.preventDefault();
  event.stopPropagation();
  const grid = document.getElementById('dashboardWidgets');
  const widget = event.currentTarget?.closest('.dashboard-widget');
  if (!grid || !widget) return;
  recordHistoryState();
  const layout = sanitizeDashboardWidgetLayout(dashboardWidgetLayout);
  dashboardWidgetResizeState = {
    key,
    grid,
    widget,
    startX: event.clientX,
    startY: event.clientY,
    startW: layout[key]?.w || 6,
    startH: layout[key]?.h || 8,
    startLayout: JSON.parse(JSON.stringify(layout))
  };
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'nwse-resize';
}

function moveDashboardWidgetResize(event) {
  if (!dashboardWidgetResizeState) return;
  const { key, grid, widget, startX, startY, startW, startH, startLayout } = dashboardWidgetResizeState;
  const deltaWidth = event.clientX - startX;
  const deltaHeight = event.clientY - startY;
  const limits = dashboardWidgetLimits()[key] || { minW: 280, maxW: 1400, minH: 220, maxH: 900 };
  const baseItem = startLayout[key] || dashboardWidgetLayout[key];
  const maxWidthByCanvas = Math.max(limits.minW, (grid?.clientWidth || 1100) - baseItem.x);
  const nextLayout = sanitizeDashboardWidgetLayout({
    ...startLayout,
    [key]: {
      ...baseItem,
      w: Math.max(limits.minW, Math.min(Math.min(limits.maxW, maxWidthByCanvas), startW + deltaWidth)),
      h: Math.max(limits.minH, Math.min(limits.maxH, startH + deltaHeight))
    }
  });
  dashboardWidgetLayout = nextLayout;
  if (widget) {
    widget.style.setProperty('--widget-w', `${nextLayout[key].w}px`);
    widget.style.setProperty('--widget-h', `${nextLayout[key].h}px`);
  }
  updateDashboardCanvasHeight();
  if (key === 'gvsr' && charts['lineChart']) charts['lineChart'].resize();
  if (key === 'result' && charts['resultChart']) charts['resultChart'].resize();
}

function stopDashboardWidgetResize() {
  if (!dashboardWidgetResizeState) return;
  dashboardWidgetLayout = sanitizeDashboardWidgetLayout(dashboardWidgetLayout);
  saveDashboardWidgetState();
  saveUIState();
  renderDashboard();
  dashboardWidgetResizeState = null;
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const histWrap = document.getElementById('histFilters'); if (histWrap) histWrap.innerHTML = '';
  const filtered = getDashboardEligibleMonths(getFilteredData()).map(m => { ensureProjetos(m); return m; });
  if (filtered.length === 0) {
    const sub = document.getElementById('dashSub');
    const insights = document.getElementById('dashInsights');
    const metrics = document.getElementById('dashMetrics');
    const widgets = document.getElementById('dashboardWidgets');
    if (sub) sub.textContent = 'Nenhum mês iniciado no período selecionado.';
    if (insights) insights.innerHTML = '';
    if (metrics) metrics.innerHTML = '';
    if (widgets) widgets.innerHTML = '<div class="empty"><p>Nenhum dado disponível para o dashboard antes do início real do mês.</p></div>';
    return;
  }
  const dashboardResultMode = getDashboardResultMode();
  const allowedMetricKeys = getDashboardMetricKeys();
  const allowedSeriesKeys = getDashboardSeriesKeys();
  dashSeriesSelection = getDashSeriesSelectionForMode(dashboardResultMode).filter(key => allowedSeriesKeys.includes(key));
  if (!dashSeriesSelection.length) dashSeriesSelection = [...allowedSeriesKeys];
  dashMetricOrder = sanitizeDashMetricOrder(dashMetricOrder).filter(key => allowedMetricKeys.includes(key));
  if (!dashMetricOrder.length) dashMetricOrder = [...allowedMetricKeys];
  saveDashMetricOrder();
  const dashboardCanvas = document.getElementById('dashboardWidgets');
  if (dashboardCanvas) {
    const nextDashboardLayout = fitDashboardWidgetLayoutToCanvas(dashboardWidgetLayout, dashboardCanvas.clientWidth || 0);
    if (JSON.stringify(nextDashboardLayout) !== JSON.stringify(dashboardWidgetLayout)) {
      dashboardWidgetLayout = nextDashboardLayout;
      saveDashboardWidgetState();
      saveUIState();
    }
  }
  const cur = filtered[filtered.length - 1] || getCurrentMonth();
  const prev = filtered[filtered.length - 2];
  const totalGastos = filtered.reduce((a,m)=>a+getTotals(m).totalGastos,0);
  const mediaGastos = filtered.length ? totalGastos / filtered.length : 0;
  buildPeriodControls('dashFilters','resultModeSel');
  buildResultSelect('mesResultSelect', filtered);
  renderTitles();
  renderDashSeriesControls();
  const pLabel = periodLabel();
  const resLabel = getDashboardResultLabel(filtered);

  const first = filtered[0];
  const last = filtered[filtered.length-1];
  document.getElementById('dashSub').textContent = `${filtered.length} meses no período · ${first?.nome || ''}${first && last && first !== last ? ' – ' + last.nome : ''}`;
  const dashGuide = document.getElementById('dashGuide');
  if (dashGuide) {
    dashGuide.innerHTML = `<strong>Como estou no geral?</strong> Use o topo para uma leitura rápida e os widgets abaixo para aprofundar tendências, categorias e resultado no ${pLabel.toLowerCase()}.`;
  }

  const prevTotalGastos = prev ? getTotals(prev).totalGastos : 0;
  const mChange = prevTotalGastos > 0 ? ((getTotals(cur).totalGastos - prevTotalGastos) / prevTotalGastos * 100) : 0;
  const resCur = computeResult(cur, dashboardResultMode);
  const resTotal = filtered.reduce((a,m)=>a+computeResult(m,dashboardResultMode),0);
  const totalRendaFixaSum = filtered.reduce((a,m)=>a+getTotals(m).rendaFixa,0);
  const totalProjSum = filtered.reduce((a,m)=>a+getTotals(m).totalProj,0);
  const totalGoals = filtered.reduce((acc, month) => acc + ((month.financialGoals || []).reduce((sum, goal) => sum + (goal.valor || 0), 0)), 0);
  const dashInsights = document.getElementById('dashInsights');
  if (dashInsights) {
    const resultValue = isGenericDashboardUser() ? resCur : resTotal;
    const goalsShare = totalRendaFixaSum > 0 ? (totalGoals / totalRendaFixaSum) * 100 : 0;
    dashInsights.innerHTML = `
      <div class="insight-card ${resultValue >= 0 ? 'is-positive' : 'is-negative'}">
        <strong>${resultValue >= 0 ? 'Período saudável' : 'Período pressionado'}</strong>
        ${resultValue >= 0 ? `O período está positivo em ${fmt(resultValue)}.` : `O período está negativo em ${fmt(Math.abs(resultValue))}.`}
      </div>
      <div class="insight-card is-structure">
        <strong>Ritmo de gastos</strong>
        Você gastou em média ${fmt(mediaGastos)} por mês no período selecionado.
      </div>
      <div class="insight-card is-planning">
        <strong>Peso das metas</strong>
        ${totalGoals > 0 ? `As metas financeiras representam ${goalsShare.toFixed(0)}% da renda fixa do período.` : 'Ainda não há metas financeiras pesando nesse período.'}
      </div>
    `;
  }
  dashMetricOrder = sanitizeDashMetricOrder(dashMetricOrder).filter(key => allowedMetricKeys.includes(key));
  dashboardWidgetLayout = sanitizeDashboardWidgetLayout(dashboardWidgetLayout);
  const mobileUi = typeof isMobileUiMode === 'function' && isMobileUiMode();
  const dashboardMetricDnDAttrs = mobileUi
    ? 'draggable="false"'
    : `draggable="true" ondragstart="onDashMetricDragStart(event,'__KEY__')" ondragend="onDashMetricDragEnd(event)" ondragover="onDashMetricDragOver(event)" ondragleave="onDashMetricDragLeave(event)" ondrop="onDashMetricDrop(event,'__KEY__')"`;
  const getMetricDnDAttrs = (key) => dashboardMetricDnDAttrs.split('__KEY__').join(key);
  const widgetMoveControl = (key) => mobileUi
    ? ''
    : `<span class="dashboard-widget-grip" onmousedown="startDashboardWidgetDrag(event,'${key}')">Mover</span>`;
  const widgetResizeControl = (key) => mobileUi
    ? ''
    : `<div class="dashboard-widget-resize" onmousedown="startDashboardWidgetResize(event,'${key}')" title="Redimensionar"></div>`;
  const metricCards = {
    resultado: `
      <div class="metric-card ${(isGenericDashboardUser() ? resCur : resTotal) >= 0 ? 'green' : 'red'}" ${getMetricDnDAttrs('resultado')} data-metric-key="resultado">
        <div class="mc-label">${isGenericDashboardUser() ? 'Resultado do mês' : 'Resultado no período'}</div>
        <div class="mc-value">${fmtSigned(isGenericDashboardUser() ? resCur : resTotal)}</div>
        <div class="mc-note">${pLabel}</div>
      </div>
    `,
    gastos: `
      <div class="metric-card month-spent" ${getMetricDnDAttrs('gastos')} data-metric-key="gastos">
        <div class="mc-label">${isGenericDashboardUser() ? 'Saiu no mês' : 'Saiu no período'}</div>
        <div class="mc-value">${fmt(totalGastos)}</div>
        <div class="mc-note">Tudo o que já saiu nesse recorte.</div>
      </div>
    `,
    ganhos: `
      <div class="metric-card green" ${getMetricDnDAttrs('ganhos')} data-metric-key="ganhos">
        <div class="mc-label">${isGenericDashboardUser() ? 'Entrou no mês' : 'Entrou no período'}</div>
        <div class="mc-value">${fmt(filtered.reduce((a,m)=>a+getTotals(m).rendaTotal,0))}</div>
        <div class="mc-note">Renda fixa e demais entradas do período.</div>
      </div>
    `,
    renda: `
      <div class="metric-card green" ${getMetricDnDAttrs('renda')} data-metric-key="renda">
        <div class="mc-label">Renda fixa no período</div>
        <div class="mc-value">${fmt(totalRendaFixaSum)}</div>
        <div class="mc-note">Parte previsível da entrada total.</div>
      </div>
    `,
    projetos: `
      <div class="metric-card" style="background:var(--blue-light);border-color:rgba(40,85,160,.2)" ${getMetricDnDAttrs('projetos')} data-metric-key="projetos">
        <div class="mc-label">Renda extra no período</div>
        <div class="mc-value" style="color:var(--blue)">${fmt(totalProjSum)}</div>
        <div class="mc-note">Entradas extras e projetos somados.</div>
      </div>
    `
  };
  document.getElementById('dashMetrics').innerHTML = dashMetricOrder.filter(key => metricCards[key]).map(key => metricCards[key]).join('');

  const dashboardWidgets = {
    gvsr: `
      <div class="dashboard-widget" data-widget-key="gvsr" style="--widget-x:${dashboardWidgetLayout.gvsr.x}px;--widget-y:${dashboardWidgetLayout.gvsr.y}px;--widget-w:${dashboardWidgetLayout.gvsr.w}px;--widget-h:${dashboardWidgetLayout.gvsr.h}px">
        <div class="section">
          <div class="section-head">
            <div class="dashboard-widget-head">
              <h3 id="chartTitleGVSR">Gastos vs Renda</h3>
              ${widgetMoveControl('gvsr')}
            </div>
            <div id="dashSeriesControls" style="position:relative"></div>
          </div>
          <div class="section-body dashboard-widget-body-fill">
            <div class="chart-wrap" style="height:100%"><canvas id="lineChart"></canvas></div>
          </div>
        </div>
        ${widgetResizeControl('gvsr')}
      </div>
    `,
    categories: `
      <div class="dashboard-widget" data-widget-key="categories" style="--widget-x:${dashboardWidgetLayout.categories.x}px;--widget-y:${dashboardWidgetLayout.categories.y}px;--widget-w:${dashboardWidgetLayout.categories.w}px;--widget-h:${dashboardWidgetLayout.categories.h}px">
        <div class="section">
          <div class="section-head">
            <div class="dashboard-widget-head">
              <h3 id="title-catdash">Categorias</h3>
              ${widgetMoveControl('categories')}
            </div>
          </div>
          <div class="section-body" id="catCards" style="padding:18px 20px 22px"></div>
        </div>
        ${widgetResizeControl('categories')}
      </div>
    `,
    result: `
      <div class="dashboard-widget" data-widget-key="result" style="--widget-x:${dashboardWidgetLayout.result.x}px;--widget-y:${dashboardWidgetLayout.result.y}px;--widget-w:${dashboardWidgetLayout.result.w}px;--widget-h:${dashboardWidgetLayout.result.h}px">
        <div class="section">
          <div class="section-head">
            <div class="dashboard-widget-head">
              <h3 id="chartTitleRes">Resultado por período selecionado</h3>
              ${widgetMoveControl('result')}
            </div>
          </div>
          <div class="section-body dashboard-widget-body-fill">
            <div class="chart-wrap" style="height:100%"><canvas id="resultChart"></canvas></div>
          </div>
        </div>
        ${widgetResizeControl('result')}
      </div>
    `,
    quickhist: `
      <div class="dashboard-widget" data-widget-key="quickhist" style="--widget-x:${dashboardWidgetLayout.quickhist.x}px;--widget-y:${dashboardWidgetLayout.quickhist.y}px;--widget-w:${dashboardWidgetLayout.quickhist.w}px;--widget-h:${dashboardWidgetLayout.quickhist.h}px">
        <div class="section">
          <div class="section-head">
            <div class="dashboard-widget-head">
              <h3 id="title-quickhist">Historico rapido</h3>
              ${widgetMoveControl('quickhist')}
            </div>
          </div>
          <div class="section-body" style="padding:12px 22px" id="quickHistory"></div>
        </div>
        ${widgetResizeControl('quickhist')}
      </div>
    `
  };
  document.getElementById('dashboardWidgets').innerHTML = ['gvsr', 'categories', 'result', 'quickhist'].map(key => dashboardWidgets[key]).join('');
  updateDashboardCanvasHeight();

  destroyChart('lineChart');
  const lc = document.getElementById('lineChart').getContext('2d');
  const gvsrTitle = document.getElementById('chartTitleGVSR'); if (gvsrTitle) gvsrTitle.textContent = `${sectionTitles.gvsr} - ${pLabel}`;
  charts['lineChart'] = new Chart(lc, {
    type: 'line',
    data: {
      labels: filtered.map(m => m.nome.split(' ').map((w,i)=>i===0?w.slice(0,3):w).join('/')),
      datasets: allowedSeriesKeys.map(key => ({ key, option: DASH_SERIES_OPTIONS[key] })).filter(item => item.option).map(({ key, option }) => ({
        seriesKey: key,
        label: getDashboardSeriesLabel(key, filtered),
        data: filtered.map(m => key === 'resultSimple' ? computeResult(m, dashboardResultMode) : option.getData(m)),
        borderColor: getDashSeriesColor(key),
        backgroundColor: getDashSeriesBackground(key),
        fill: false,
        tension: .28,
        pointRadius: 3,
        pointHoverRadius: 4,
        borderWidth: 2.5,
        hidden: !dashSeriesSelection.includes(key)
      }))
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:true, position:'bottom', labels:{boxWidth:12, boxHeight:12, padding:14, font:{size:11}},
      onClick: (event, legendItem, legend) => {
        const chart = legend.chart;
        const datasetIndex = legendItem.datasetIndex;
        const dataset = chart?.data?.datasets?.[datasetIndex];
        const key = dataset?.seriesKey;
        if (!key) return;
        const currentlyVisible = dashSeriesSelection.includes(key);
        dashSeriesSelection = currentlyVisible
          ? dashSeriesSelection.filter(item => item !== key)
          : [...dashSeriesSelection, key];
        dashSeriesSelection = sanitizeDashSeriesSelection(dashSeriesSelection).filter(item => allowedSeriesKeys.includes(item));
        if (!dashSeriesSelection.length) dashSeriesSelection = [...allowedSeriesKeys];
        saveDashSeriesSelection();
        saveUIState();
        renderDashboard();
      }}},
      scales:{ x:{ticks:{font:{size:11}}}, y:{min:0, beginAtZero:true, ticks:{callback:v=>'R$'+(v/1000).toFixed(0)+'k'},grid:{color:'rgba(0,0,0,.05)'}} } }
  });
  const lineCanvas = document.getElementById('lineChart');
  if (lineCanvas) lineCanvas.ondblclick = handleDashLineChartDblClick;
  renderDashSeriesColorPicker();

  destroyChart('resultChart');
  const rc = document.getElementById('resultChart').getContext('2d');
  const resTitle = document.getElementById('chartTitleRes'); if (resTitle) resTitle.textContent = isGenericDashboardUser() ? `${sectionTitles.resultchart} - ${pLabel}` : `${sectionTitles.resultchart} (${resLabel}) - ${pLabel}`;
  charts['resultChart'] = new Chart(rc, {
    type: 'bar',
    data: {
      labels: filtered.map(m => m.nome.split(' ').map((w,i)=>i===0?w.slice(0,3):w).join('/')),
      datasets: [{ data: filtered.map(m=>computeResult(m, dashboardResultMode)), backgroundColor: filtered.map(m=>computeResult(m, dashboardResultMode)>=0?'rgba(39,174,96,.75)':'rgba(192,57,43,.7)') }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{ x:{ticks:{font:{size:11}}}, y:{ticks:{callback:v=>(v<0?'-':'')+'R$'+(Math.abs(v)/1000).toFixed(0)+'k'},grid:{color:'rgba(0,0,0,.05)'}} } }
  });

  const catEl = document.getElementById('catCards');
  const catRaw = getCatTotalsPeriod(filtered);
  const catFilteredEntries = Object.entries(catRaw)
    .filter(([name, value]) => Number(value || 0) > 0 && !isTypeLikeCategoryLabel(name) && !(typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(name)));
  const totalRaw = catFilteredEntries.reduce((acc, [, value]) => acc + Number(value || 0), 0);
  const groupedEntries = [];
  let smallerTotal = 0;
  catFilteredEntries.forEach(([name, value]) => {
    const amount = Number(value || 0);
    const ratio = totalRaw > 0 ? (amount / totalRaw) : 0;
    if (ratio < 0.01) {
      smallerTotal += amount;
    } else {
      groupedEntries.push([name, amount]);
    }
  });
  if (smallerTotal > 0) groupedEntries.push(['Categorias menores', smallerTotal]);
  const cats = Object.fromEntries(groupedEntries);
  const catKeys = Object.keys(cats).sort((a, b) => (cats[b] || 0) - (cats[a] || 0));
  destroyChart('catPieChart');
  if (catKeys.length === 0) {
    catEl.innerHTML = '<div class="empty"><p>Sem categorias no periodo selecionado.</p></div>';
  } else {
    const total = catKeys.reduce((a,k)=>a+(cats[k]||0),0);
    const chartColors = buildDistinctPieColors(catKeys.length);
    const colorByCategory = new Map(catKeys.map((key, idx) => [key, chartColors[idx]]));
    catEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:20px">
        <div style="padding:4px 0 0;display:flex;justify-content:center">
          <div class="chart-wrap" style="height:300px;width:min(100%, 360px)">
            <canvas id="catPieChart"></canvas>
          </div>
        </div>
        <div class="cat-grid" style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));align-content:start;min-width:0;gap:12px">
          ${catKeys.map(k => `
            <div class="cat-item" ondblclick="openCategoryColorPicker('${String(k).replace(/'/g, "\\'")}', event.clientX + 12, event.clientY + 12)" style="min-width:0;padding:12px 14px;align-items:center;background:rgba(255,255,255,.75);border:1px solid rgba(140,118,96,.12);border-radius:14px;cursor:pointer">
              <div class="cat-dot" style="background:${colorByCategory.get(k) || getCategoryColor(k)}"></div>
              <div class="cat-info" style="min-width:0">
                <div class="cat-name" style="white-space:normal;overflow-wrap:anywhere;line-height:1.35">${k}</div>
                <div class="cat-pct">${((cats[k]/total)*100).toFixed(0)}% do periodo</div>
              </div>
              <div class="cat-val" style="flex-shrink:0;text-align:right;padding-left:12px">${fmt(cats[k])}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    const pieCanvas = document.getElementById('catPieChart');
    if (pieCanvas) {
      charts['catPieChart'] = new Chart(pieCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: catKeys,
          datasets: [{
            data: catKeys.map(k => cats[k] || 0),
            backgroundColor: chartColors,
            borderColor: '#fffaf4',
            borderWidth: 3,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '56%',
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                boxWidth: 12,
                boxHeight: 12,
                padding: 14,
                color: '#5b4a3f',
                font: { size: 11 }
              }
            },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const valor = Number(ctx.parsed || 0);
                  const pct = total > 0 ? ((valor / total) * 100).toFixed(1) : '0.0';
                  return `${ctx.label}: ${fmt(valor)} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }
  }
  renderCategoryColorPicker();

  const recent = filtered.slice(-8).reverse();
  const maxAbs = Math.max(...recent.map(m=>Math.abs(computeResult(m, dashboardResultMode))), 1);
  document.getElementById('quickHistory').innerHTML = recent.map(m => `
    <div class="month-result">
      <span class="mr-name">${m.nome.split(' ').map((w,i)=>i===0?w.slice(0,3):w).join('/')}</span>
      <div class="mr-bar-wrap"><div class="mr-bar ${computeResult(m,dashboardResultMode)>=0?'pos':'neg'}" style="width:${(Math.abs(computeResult(m,dashboardResultMode))/maxAbs*100).toFixed(0)}%"></div></div>
      <span class="mr-val ${computeResult(m,dashboardResultMode)>=0?'amount-pos':'amount-neg'}">${fmtSigned(computeResult(m,dashboardResultMode))}</span>
    </div>
  `).join('');
  if (typeof renderNotificationBells === 'function') renderNotificationBells();
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}


