// ============================================================
// DATA
// ============================================================
const EXTRA_HIST_MONTHS = [];
const HIST_DATA = [];
const IMPORTED_BREAKDOWNS = {};
const IMPORTED_PROJECTS = {};
const ESO_IMPORTED_CLOSINGS = [];

function applyLegacyFinanceSeed(seed) {
  EXTRA_HIST_MONTHS.splice(0, EXTRA_HIST_MONTHS.length, ...(seed?.extraHistMonths || []));
  HIST_DATA.splice(0, HIST_DATA.length, ...(seed?.histData || []));
  ESO_IMPORTED_CLOSINGS.splice(0, ESO_IMPORTED_CLOSINGS.length, ...(seed?.esoImportedClosings || []));
  for (const [target, value] of [[IMPORTED_BREAKDOWNS, seed?.importedBreakdowns], [IMPORTED_PROJECTS, seed?.importedProjects]]) {
    Object.keys(target).forEach(key => delete target[key]);
    Object.assign(target, value || {});
  }
}

const IMPORTED_CATEGORY_ORDER = ['TRANSPORTE', 'LAZER', 'IFOOD+BESTEIRAS', 'PRESENTES/SOCIAL', 'ALIMENTAÇÃO', 'COMPRAS', 'ASSINATURAS', 'OUTROS', 'ESO ARQUITETURA'];
const DATA_MIGRATION_VERSION = 7;

const CAT_COLORS = {
  'TRANSPORTE':'#3266ad','LAZER':'#8e44ad','IFOOD+BESTEIRAS':'#e67e22',
  'PRESENTES/SOCIAL':'#e74c3c','ALIMENTAÇÃO':'#27ae60','COMPRAS':'#2980b9',
  'ASSINATURAS':'#16a085','FARMÁCIA':'#c0392b','SAÚDE':'#d35400',
  'OUTROS':'#95a5a6','ESO ARQUITETURA':'#1a5276'
};
const SYSTEM_DEFAULT_CATEGORY_PRESETS = [
  { name: 'MORADIA', emoji: 'home' },
  { name: 'SERVIÇOS', emoji: 'work' },
  { name: 'ALIMENTAÇÃO', emoji: 'food' },
  { name: 'MERCADO', emoji: 'market' },
  { name: 'TRANSPORTE', emoji: 'car' },
  { name: 'COMPRAS', emoji: 'shopping' },
  { name: 'SAÚDE', emoji: 'health' },
  { name: 'LAZER', emoji: 'fun' },
  { name: 'EDUCAÇÃO', emoji: 'education' },
  { name: 'FINANCEIRO', emoji: 'card' },
  { name: 'ASSINATURAS', emoji: 'phone' },
  { name: 'TRABALHO', emoji: 'work' },
  { name: 'OUTROS', emoji: 'tag' }
];
if (typeof window !== 'undefined') {
  window.SYSTEM_DEFAULT_CATEGORY_PRESETS = SYSTEM_DEFAULT_CATEGORY_PRESETS;
}
const DEFAULT_CATS = SYSTEM_DEFAULT_CATEGORY_PRESETS.map(item => item.name);

// ============================================================
// STATE
// ============================================================
let data = [];
let metas = {};
let currentMonthId = '';
function getAllFinanceMonths() {
  return Array.isArray(data) ? data : [];
}
let editingItem = null;
let editingType = null;
let charts = {};
let varSort = { field: 'valor', direction: 'desc' };
let resultMode = 'simples';
let activePage = 'dashboard';
let histActiveTab = 'tabela';
let pendingScrollY = null;
let patrimonioAccounts = [];
let patrimonioMovements = [];
let patrimonioSelectedAccountId = '';
let patrimonioFilters = {
  search: '',
  period: 'all',
  sort: 'saldo_desc',
  movementType: 'all'
};
let categoryRenameMap = {};
let expenseCategoryRules = {};
let expenseNameRenameMap = {};
let expensePaymentDateRules = {};
let incomeNameRenameMap = {};
let despSort = { field: '', direction: 'asc' };
let rendaSort = { field: '', direction: 'asc' };
let projSort = { field: '', direction: 'asc' };
let dailySort = { field: '', direction: 'asc' };
let despCategoriaFiltro = 'TODAS';
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;
let inlineEditState = null;
let titleEditKey = null;
let dashSeriesPickerOpen = false;
let dashMetricOrder = ['resultado', 'gastos', 'ganhos', 'renda', 'projetos'];
let dragDashMetricKey = '';
let dashboardWidgetOrder = ['gvsr', 'categories', 'result', 'quickhist'];
let dashboardWidgetDragState = null;
let dashboardWidgetResizeState = null;
let dashboardWidgetLayout = {
  gvsr: { x: 0, y: 0, w: 680, h: 340 },
  categories: { x: 700, y: 0, w: 340, h: 340 },
  result: { x: 0, y: 360, w: 680, h: 280 },
  quickhist: { x: 700, y: 360, w: 340, h: 280 }
};
let monthMetricOrder = ['resultado', 'gastos', 'renda', 'projetos', 'metas'];
let monthSectionOrder = ['renda', 'goals', 'despesas', 'daily', 'projetos', 'reembolsos', 'observacoes'];
let dragMonthMetricKey = '';
let dragMonthSectionKey = '';
let notificationsSeenDayKey = '';
let despSelectionState = {};
const AUTO_COPY_EXPENSES_ZEROED = ['NUBANK', 'XP', 'DINHEIRO'];
const AUTO_COPY_EXPENSES_WITH_LAST_VALUE = ['BANCO INTER (JÁ COM FINAL)', 'PARCELA APARTAMENTO', 'INTERNET', 'DAS', 'CONDOMÍNIO', 'ENERGIA'];
const AUTO_COPY_DAILY_CATEGORIES = ['ASSINATURAS'];
const AUTO_COPY_RENDA = ['UBER', 'SALÁRIO LARYSSA'];
const DASH_SERIES_OPTIONS = {
  resultSimple: {
    getLabel: list => `${labelResult(list)} · período`,
    color: '#8e44ad',
    background: 'rgba(142,68,173,.08)',
    getData: m => computeResult(m, resultMode)
  },
  totalGastos: {
    getLabel: () => 'Total acumulado gastos',
    color: '#c0392b',
    background: 'rgba(192,57,43,.08)',
    getData: m => getTotals(m).totalGastos
  },
  totalGanhos: {
    getLabel: () => 'Total acumulado ganhos',
    color: '#27ae60',
    background: 'rgba(39,174,96,.08)',
    getData: m => getTotals(m).rendaTotal
  },
  rendaFixa: {
    getLabel: () => 'Renda fixa acumulada',
    color: '#1f7a4d',
    background: 'rgba(31,122,77,.08)',
    getData: m => getTotals(m).rendaFixa
  },
  projetos: {
    getLabel: () => 'Projetos / entradas extras',
    color: '#2855a0',
    background: 'rgba(40,85,160,.08)',
    getData: m => getTotals(m).totalProj
  }
};
const DEFAULT_DASH_SERIES = Object.keys(DASH_SERIES_OPTIONS);
const DASH_SERIES_SELECTION_VERSION = 3;
const DASH_SERIES_COLOR_OPTIONS = ['#8e44ad','#c0392b','#27ae60','#1f7a4d','#2855a0','#e67e22','#16a085','#d35400','#2c3e50','#c2185b','#7f8c8d','#6c5ce7'];
let dashSeriesSelectionsByMode = {};
let dashSeriesSelection = [...DEFAULT_DASH_SERIES];
let uiDashSeriesSelectionsFallback = null;
let dashSeriesColorOverrides = {};
let dashSeriesColorPicker = { open: false, key: '', x: 0, y: 0 };
let categoryColorOverrides = {};
let categoryEmojiOverrides = {};
let categoryColorPicker = { open: false, key: '', x: 0, y: 0 };
let monthSectionColorOverrides = {};
let monthSectionColorPicker = { open: false, key: '', x: 0, y: 0 };
const MONTH_SECTION_DEFAULT_COLORS = {
  despesas: '#c0392b',
  daily: '#2855a0',
  renda: '#2d5a3d',
  goals: '#8e6a1f',
  projetos: '#2855a0',
  observacoes: '#7f8c8d'
};
const MONTH_SECTION_LABELS = {
  despesas: 'Despesas',
  daily: 'Gastos diários',
  renda: 'Renda',
  goals: 'Metas financeiras',
  projetos: 'Renda extra',
  observacoes: 'Observações'
};
let sectionTitles = {
  despesas: 'Despesas',
  renda: 'Renda fixa',
  goals: 'Metas financeiras',
  projetos: 'Projetos / entradas extras',
  patrimonioAccounts: 'Contas patrimoniais',
  patrimonioEvolution: 'Evolução do patrimônio',
  patrimonioDistribution: 'Distribuição atual',
  patrimonioForecasts: 'Previsões para transferir',
  patrimonioHistory: 'Movimentações',
  metricResultado: 'Resultado',
  metricGastos: 'Total despesas',
  metricRenda: 'Renda',
  metricProjetos: 'Projetos / entradas extras',
  metricMetas: 'Metas financeiras',
  variaveis: 'Gastos variáveis',
  daily: 'Gastos diários',
  gvsr: 'Gastos vs Renda',
  resultchart: 'Resultado por período selecionado',
  catdash: 'Categorias',
  quickhist: 'Histórico rápido'
};
let periodFilter = { type: 'all', month: '', year: '', start: '', end: '' };
let obsDraft = '';
let modalDragState = null;
let esoData = [];
let esoSort = { field: 'data', direction: 'desc' };
let esoFilter = { start: '', end: '', status: 'todas', tipo: 'todas', entrada: 'todas', search: '' };
let editingEsoId = null;

function buildBlankMonth(date = new Date()) {
  const monthNames = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const monthName = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const id = `${monthName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}_${year}`;
  return {
    id,
    nome: `${monthName} ${year}`,
    despesas: [],
    renda: [],
    projetos: [],
    financialGoals: [],
    patrimonioTransfers: [],
    calendarEvents: [],
    outflowCards: [],
    outflows: [],
    cardBills: [],
    unifiedOutflowUi: {},
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {},
    gastosVar: [],
    dailyCategorySeeds: [],
    dailyGoals: {},
    dailyGoalTarget: null,
    dailyGoalManualCats: [],
    obs: ''
  };
}


