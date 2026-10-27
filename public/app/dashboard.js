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

let dashboardCategoryBasis = 'commitments';

function setDashboardCategoryBasis(value) {
  dashboardCategoryBasis = value === 'consumption' ? 'consumption' : 'commitments';
  renderDashboard();
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
    'DESPESA',
    'DESPESAS',
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
let dashboardLayoutObserver = null;
let dashboardLayoutFrame = 0;
let dashboardLayoutEditing = false;

function toggleDashboardLayoutEditing() {
  dashboardLayoutEditing = !dashboardLayoutEditing;
  applyDashboardResponsiveLayout();
}

function applyDashboardResponsiveLayout() {
  const grid = document.getElementById('dashboardWidgets');
  if (!grid || !grid.clientWidth) return;
  const width = grid.clientWidth;
  grid.classList.toggle('is-organizing', dashboardLayoutEditing);
  const baseLayout = typeof dashboardWidgetBaseLayout === 'function' ? dashboardWidgetBaseLayout() : null;
  const customLayout = !!baseLayout && Object.keys(baseLayout).some(key =>
    Object.keys(baseLayout[key]).some(field => dashboardWidgetLayout[key]?.[field] !== baseLayout[key][field]));
  grid.classList.toggle('is-custom-layout', customLayout);
  const customize = document.getElementById('dashCustomizeBtn');
  if (customize) {
    customize.setAttribute('aria-pressed', String(dashboardLayoutEditing));
    customize.textContent = dashboardLayoutEditing ? 'Concluir organização' : 'Organizar painel';
  }
  grid.classList.toggle('is-responsive', width < 1040);
  grid.classList.toggle('is-single-column', width < 720);
  const layout = fitDashboardWidgetLayoutToCanvas(dashboardWidgetLayout, width);
  grid.querySelectorAll('[data-widget-key]').forEach(widget => {
    const item = layout[widget.dataset.widgetKey];
    if (!item) return;
    for (const [name, value] of Object.entries(item)) widget.style.setProperty(`--widget-${name}`, `${value}px`);
  });
  if (width < 1040 || (!dashboardLayoutEditing && !customLayout)) grid.style.minHeight = '0px';
  else grid.style.minHeight = `${Math.max(760, ...Object.values(layout).map(item => item.y + item.h + 24))}px`;
}

function observeDashboardLayout() {
  applyDashboardResponsiveLayout();
  if (typeof ResizeObserver === 'undefined') return;
  if (!dashboardLayoutObserver) {
    dashboardLayoutObserver = new ResizeObserver(() => {
      if (dashboardLayoutFrame) return;
      dashboardLayoutFrame = requestAnimationFrame(() => {
        dashboardLayoutFrame = 0;
        applyDashboardResponsiveLayout();
      });
    });
    dashboardLayoutObserver.observe(document.getElementById('dashboardWidgets'));
  }
}

function renderDashboard() {
  const page = document.getElementById('page-dashboard');
  if (page?.classList && !page.classList.contains('active')) return;
  if (typeof window !== 'undefined' && window.MobileV2?.isEnabled?.()) return;
  const histWrap = document.getElementById('histFilters'); if (histWrap) histWrap.innerHTML = '';
  let filtered = getDashboardEligibleMonths(getFilteredData());
  if (!filtered.length) {
    const available = getDashboardEligibleMonths(data);
    if (available.length) {
      const latest = available.reduce((last, month) => getMonthSortValue(month) > getMonthSortValue(last) ? month : last);
      if (periodFilter.type === 'year') {
        const year = getYear(latest);
        periodFilter = { ...periodFilter, year };
        filtered = available.filter(month => getYear(month) === year);
      } else {
        periodFilter = { ...periodFilter, type: 'month', month: latest.id };
        filtered = [latest];
      }
      saveUIState();
    }
  }
  buildPeriodControls('dashFilters','resultModeSel');
  filtered.forEach(ensureProjetos);
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
  // This cache belongs only to this render, so edits and filter changes always read fresh data.
  const summaries = new Map();
  const totalsFor = month => {
    if (!summaries.has(month)) summaries.set(month, getTotals(month));
    return summaries.get(month);
  };
  const resultFor = month => computeResultWithTotals(totalsFor(month), dashboardResultMode);
  const allowedMetricKeys = getDashboardMetricKeys();
  const allowedSeriesKeys = getDashboardSeriesKeys();
  dashSeriesSelection = getDashSeriesSelectionForMode(dashboardResultMode).filter(key => allowedSeriesKeys.includes(key));
  if (!dashSeriesSelection.length) dashSeriesSelection = [...allowedSeriesKeys];
  dashMetricOrder = sanitizeDashMetricOrder(dashMetricOrder).filter(key => allowedMetricKeys.includes(key));
  if (!dashMetricOrder.length) dashMetricOrder = [...allowedMetricKeys];
  saveDashMetricOrder();
  const cur = filtered[filtered.length - 1] || getCurrentMonth();
  const prev = filtered[filtered.length - 2];
  const totalGastos = filtered.reduce((a,m)=>a+totalsFor(m).totalGastos,0);
  const mediaGastos = filtered.length ? totalGastos / filtered.length : 0;
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

  const prevTotalGastos = prev ? totalsFor(prev).totalGastos : 0;
  const mChange = prevTotalGastos > 0 ? ((totalsFor(cur).totalGastos - prevTotalGastos) / prevTotalGastos * 100) : 0;
  const resCur = resultFor(cur);
  const resTotal = filtered.reduce((a,m)=>a+resultFor(m),0);
  const totalRendaFixaSum = filtered.reduce((a,m)=>a+totalsFor(m).rendaFixa,0);
  const totalProjSum = filtered.reduce((a,m)=>a+totalsFor(m).totalProj,0);
  const totalGoals = filtered.reduce((acc, month) => acc + Number(totalsFor(month).totalFinancialGoals || 0), 0);
  const dashInsights = document.getElementById('dashInsights');
  if (dashInsights) {
    const resultValue = resTotal;
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
  const metricCards = {
    resultado: `
      <div class="metric-card ${resTotal >= 0 ? 'green' : 'red'}" draggable="true" data-metric-key="resultado" ondragstart="onDashMetricDragStart(event,'resultado')" ondragend="onDashMetricDragEnd(event)" ondragover="onDashMetricDragOver(event)" ondragleave="onDashMetricDragLeave(event)" ondrop="onDashMetricDrop(event,'resultado')">
        <div class="mc-label">Resultado previsto no período</div>
        <div class="mc-value">${fmtSigned(resTotal)}</div>
        <div class="mc-note">Após reservar ${fmt(totalGoals)} em metas · ${pLabel}</div>
      </div>
    `,
    gastos: `
      <div class="metric-card month-spent" draggable="true" data-metric-key="gastos" ondragstart="onDashMetricDragStart(event,'gastos')" ondragend="onDashMetricDragEnd(event)" ondragover="onDashMetricDragOver(event)" ondragleave="onDashMetricDragLeave(event)" ondrop="onDashMetricDrop(event,'gastos')">
        <div class="mc-label">Saídas comprometidas no período</div>
        <div class="mc-value">${fmt(totalGastos)}</div>
        <div class="mc-note">Compromissos pagos e pendentes.</div>
      </div>
    `,
    ganhos: `
      <div class="metric-card green" draggable="true" data-metric-key="ganhos" ondragstart="onDashMetricDragStart(event,'ganhos')" ondragend="onDashMetricDragEnd(event)" ondragover="onDashMetricDragOver(event)" ondragleave="onDashMetricDragLeave(event)" ondrop="onDashMetricDrop(event,'ganhos')">
        <div class="mc-label">Entradas previstas no período</div>
        <div class="mc-value">${fmt(filtered.reduce((a,m)=>a+totalsFor(m).rendaTotal,0))}</div>
        <div class="mc-note">Renda fixa e demais entradas do período.</div>
      </div>
    `,
    renda: `
      <div class="metric-card green" draggable="true" data-metric-key="renda" ondragstart="onDashMetricDragStart(event,'renda')" ondragend="onDashMetricDragEnd(event)" ondragover="onDashMetricDragOver(event)" ondragleave="onDashMetricDragLeave(event)" ondrop="onDashMetricDrop(event,'renda')">
        <div class="mc-label">Renda fixa no período</div>
        <div class="mc-value">${fmt(totalRendaFixaSum)}</div>
        <div class="mc-note">Parte previsível da entrada total.</div>
      </div>
    `,
    projetos: `
      <div class="metric-card" style="background:var(--blue-light);border-color:rgba(40,85,160,.2)" draggable="true" data-metric-key="projetos" ondragstart="onDashMetricDragStart(event,'projetos')" ondragend="onDashMetricDragEnd(event)" ondragover="onDashMetricDragOver(event)" ondragleave="onDashMetricDragLeave(event)" ondrop="onDashMetricDrop(event,'projetos')">
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
              <span class="dashboard-widget-grip" onmousedown="startDashboardWidgetDrag(event,'gvsr')">Mover</span>
            </div>
            <div id="dashSeriesControls" style="position:relative"></div>
          </div>
          <div class="section-body dashboard-widget-body-fill">
            <div class="chart-wrap" style="height:100%"><canvas id="lineChart"></canvas></div>
          </div>
        </div>
        <div class="dashboard-widget-resize" onmousedown="startDashboardWidgetResize(event,'gvsr')" title="Redimensionar"></div>
      </div>
    `,
    categories: `
      <div class="dashboard-widget" data-widget-key="categories" style="--widget-x:${dashboardWidgetLayout.categories.x}px;--widget-y:${dashboardWidgetLayout.categories.y}px;--widget-w:${dashboardWidgetLayout.categories.w}px;--widget-h:${dashboardWidgetLayout.categories.h}px">
        <div class="section">
          <div class="section-head">
            <div class="dashboard-widget-head">
              <h3 id="title-catdash">${dashboardCategoryBasis === 'consumption' ? 'Consumo por categoria' : 'Compromissos por categoria'}</h3>
              <select class="btn" aria-label="Base das categorias" onchange="setDashboardCategoryBasis(this.value)"><option value="commitments" ${dashboardCategoryBasis === 'commitments' ? 'selected' : ''}>Compromissos</option><option value="consumption" ${dashboardCategoryBasis === 'consumption' ? 'selected' : ''}>Consumo</option></select>
              <span class="dashboard-widget-grip" onmousedown="startDashboardWidgetDrag(event,'categories')">Mover</span>
            </div>
          </div>
          <div class="section-body" id="catCards" style="padding:18px 20px 22px"></div>
        </div>
        <div class="dashboard-widget-resize" onmousedown="startDashboardWidgetResize(event,'categories')" title="Redimensionar"></div>
      </div>
    `,
    result: `
      <div class="dashboard-widget" data-widget-key="result" style="--widget-x:${dashboardWidgetLayout.result.x}px;--widget-y:${dashboardWidgetLayout.result.y}px;--widget-w:${dashboardWidgetLayout.result.w}px;--widget-h:${dashboardWidgetLayout.result.h}px">
        <div class="section">
          <div class="section-head">
            <div class="dashboard-widget-head">
              <h3 id="chartTitleRes">Resultado por período selecionado</h3>
              <span class="dashboard-widget-grip" onmousedown="startDashboardWidgetDrag(event,'result')">Mover</span>
            </div>
          </div>
          <div class="section-body dashboard-widget-body-fill">
            <div class="chart-wrap" style="height:100%"><canvas id="resultChart"></canvas></div>
          </div>
        </div>
        <div class="dashboard-widget-resize" onmousedown="startDashboardWidgetResize(event,'result')" title="Redimensionar"></div>
      </div>
    `,
    quickhist: `
      <div class="dashboard-widget" data-widget-key="quickhist" style="--widget-x:${dashboardWidgetLayout.quickhist.x}px;--widget-y:${dashboardWidgetLayout.quickhist.y}px;--widget-w:${dashboardWidgetLayout.quickhist.w}px;--widget-h:${dashboardWidgetLayout.quickhist.h}px">
        <div class="section">
          <div class="section-head">
            <div class="dashboard-widget-head">
              <h3 id="title-quickhist">Historico rapido</h3>
              <span class="dashboard-widget-grip" onmousedown="startDashboardWidgetDrag(event,'quickhist')">Mover</span>
            </div>
          </div>
          <div class="section-body" style="padding:12px 22px" id="quickHistory"></div>
        </div>
        <div class="dashboard-widget-resize" onmousedown="startDashboardWidgetResize(event,'quickhist')" title="Redimensionar"></div>
      </div>
    `
  };
  document.getElementById('dashboardWidgets').innerHTML = ['gvsr', 'categories', 'result', 'quickhist'].map(key => dashboardWidgets[key]).join('');
  updateDashboardCanvasHeight();
  observeDashboardLayout();

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
        data: filtered.map(m => key === 'resultSimple' ? resultFor(m) : option.getData(m, totalsFor(m))),
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
      datasets: [{ data: filtered.map(m=>resultFor(m)), backgroundColor: filtered.map(m=>resultFor(m)>=0?'rgba(39,174,96,.75)':'rgba(192,57,43,.7)') }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{ x:{ticks:{font:{size:11}}}, y:{ticks:{callback:v=>(v<0?'-':'')+'R$'+(Math.abs(v)/1000).toFixed(0)+'k'},grid:{color:'rgba(0,0,0,.05)'}} } }
  });

  const catEl = document.getElementById('catCards');
  const catRaw = getCatTotalsPeriod(filtered, dashboardCategoryBasis, totalsFor);
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
      <div class="category-distribution">
        <details class="category-pie-details" ontoggle="if(this.open)charts.catPieChart?.resize()">
        <summary>Ver gráfico de distribuição</summary>
        <div style="padding:4px 0 0;display:flex;justify-content:center">
          <div class="chart-wrap" style="height:300px;width:min(100%, 360px)">
            <canvas id="catPieChart"></canvas>
          </div>
        </div>
        </details>
        <div class="cat-grid category-ranking" style="grid-template-columns:minmax(0, 1fr);align-content:start;min-width:0;gap:12px">
          ${catKeys.map(k => `
            <div class="cat-item" ondblclick="openCategoryColorPicker('${String(k).replace(/'/g, "\\'")}', event.clientX + 12, event.clientY + 12)" style="min-width:0;padding:12px 14px;align-items:center;background:rgba(255,255,255,.75);border:1px solid rgba(140,118,96,.12);border-radius:14px;cursor:pointer">
              <div class="cat-dot" style="background:${colorByCategory.get(k) || getCategoryColor(k)}"></div>
              <div class="cat-info" style="min-width:0">
                <div class="cat-name" style="white-space:normal;overflow-wrap:anywhere;line-height:1.35">${typeof escapeHtml === 'function' ? escapeHtml(k) : k}</div>
                <div class="cat-pct">${((cats[k]/total)*100).toFixed(0)}% do periodo</div>
                <div class="category-bar" aria-hidden="true"><span style="width:${((cats[k]/total)*100).toFixed(2)}%;background:${colorByCategory.get(k)}"></span></div>
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
                color: typeof ChartPresentation !== 'undefined' ? ChartPresentation.theme().text : '#505867',
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
  const maxAbs = Math.max(...recent.map(m=>Math.abs(resultFor(m))), 1);
  document.getElementById('quickHistory').innerHTML = recent.map(m => `
    <div class="month-result">
      <span class="mr-name">${m.nome.split(' ').map((w,i)=>i===0?w.slice(0,3):w).join('/')}</span>
      <div class="mr-bar-wrap"><div class="mr-bar ${resultFor(m)>=0?'pos':'neg'}" style="width:${(Math.abs(resultFor(m))/maxAbs*100).toFixed(0)}%"></div></div>
      <span class="mr-val ${resultFor(m)>=0?'amount-pos':'amount-neg'}">${fmtSigned(resultFor(m))}</span>
    </div>
  `).join('');
  renderDashboardChartTables();
  if (typeof renderNotificationBells === 'function') renderNotificationBells();
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function renderDashboardChartTables() {
  if (typeof ChartPresentation === 'undefined') return;
  for (const id of ['lineChart', 'resultChart', 'catPieChart']) {
    const canvas = document.getElementById(id);
    const chart = charts[id];
    if (!canvas || !chart) continue;
    const datasets = chart.data.datasets.filter(dataset => !dataset.hidden);
    const rows = chart.data.labels.map((label, index) => [label, ...datasets.map(dataset => fmt(dataset.data[index] || 0))]);
    const caption = id === 'lineChart' ? 'Evolução mensal' : id === 'resultChart' ? 'Resultado mensal' : 'Valores por categoria';
    const dataId = `${id}-data`;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', caption);
    canvas.setAttribute('aria-describedby', dataId);
    canvas.closest('.section-body').insertAdjacentHTML('beforeend', ChartPresentation.table(dataId, caption,
      [id === 'catPieChart' ? 'Categoria' : 'Mês', ...datasets.map(dataset => dataset.label || 'Valor')], rows));
  }
}


