const fs = require('node:fs');
const vm = require('node:vm');
const { browserSandbox, financialMonth, loadBrowser } = require('./refactor-fixtures');

function dashboardFixture(count = 12) {
  const ctx = browserSandbox();
  ctx.data = Array.from({ length: count }, (_, index) => {
    const date = new Date(2023, index, 1);
    return financialMonth(date.getFullYear(), date.getMonth());
  });
  const elements = Object.fromEntries(['histFilters', 'dashFilters', 'dashSub', 'dashInsights', 'dashMetrics',
    'dashboardWidgets', 'lineChart', 'resultChart', 'catCards', 'quickHistory'].map(id => [id,
    { innerHTML: '', textContent: '', clientWidth: 1200, getContext: () => ({ id }) }]));
  ctx.document.getElementById = id => elements[id] || null;
  const noOp = () => {};
  Object.assign(ctx, {
    periodFilter: { type: 'all' }, resultMode: 'simples', dashboardCategoryBasis: 'commitments',
    charts: {}, sectionTitles: { gvsr: 'Gastos vs Renda', resultchart: 'Resultado' },
    dashMetricOrder: ['resultado', 'gastos', 'ganhos'], dashSeriesSelection: ['resultSimple', 'totalGastos', 'totalGanhos'],
    dashboardWidgetLayout: Object.fromEntries(['gvsr', 'categories', 'result', 'quickhist']
      .map(key => [key, { x: 0, y: 0, w: 400, h: 300 }])),
    getDashboardEligibleMonths: months => months, getCurrentMonth: () => ctx.data.at(-1),
    saveUIState: noOp, saveDashMetricOrder: noOp, saveDashboardWidgetState: noOp,
    getDashSeriesSelectionForMode: () => ['resultSimple', 'totalGastos', 'totalGanhos'],
    sanitizeDashMetricOrder: value => value, sanitizeDashboardWidgetLayout: value => value,
    fitDashboardWidgetLayoutToCanvas: value => value,
    periodLabel: () => 'Periodo', buildPeriodControls: noOp, buildResultSelect: noOp, renderTitles: noOp,
    buildDistinctPieColors: count => Array(count).fill('#123456'), handleDashLineChartDblClick: noOp,
    getCategoryColor: () => '#123456', getCategoryDisplayName: value => value
  });
  ctx.Chart = class { constructor(canvas, config) { this.data = config.data; } destroy() {} };
  const dataSource = fs.readFileSync(require.resolve('../../public/app/data.js'), 'utf8');
  vm.runInContext(dataSource.slice(dataSource.indexOf('const DASH_SERIES_OPTIONS ='), dataSource.indexOf('const DEFAULT_DASH_SERIES =')), ctx);
  loadBrowser(ctx, ['modules/shared/formatters.js', 'dashboard.js']);
  Object.assign(ctx, {
    getDashboardResultMode: () => 'simples', getDashboardMetricKeys: () => ['resultado', 'gastos', 'ganhos'],
    getDashboardSeriesKeys: () => ['resultSimple', 'totalGastos', 'totalGanhos'], isGenericDashboardUser: () => true,
    renderDashSeriesControls: noOp, renderDashSeriesColorPicker: noOp, renderCategoryColorPicker: noOp,
    updateDashboardCanvasHeight: noOp,
    getDashSeriesColor: () => '#123456', getDashSeriesBackground: () => '#ffffff'
  });
  let calls = 0;
  const original = ctx.getTotals;
  ctx.getTotals = month => { calls++; return original(month); };
  const snapshot = () => ({
    metrics: elements.dashMetrics.innerHTML, insights: elements.dashInsights.innerHTML,
    quick: elements.quickHistory.innerHTML, categories: elements.catCards.innerHTML,
    charts: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(ctx.charts).map(([id, chart]) => [id, chart.data]))))
  });
  return { ctx, elements, calls: () => calls, snapshot };
}

module.exports = { dashboardFixture };
