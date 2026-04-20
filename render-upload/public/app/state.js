
// storage.js

function normalizeExpenseName(name) {
  return (name || '').trim().toUpperCase();
}

function normalizeIncomeName(name) {
  return (name || '').trim().toUpperCase();
}

function resolveExpenseName(name) {
  let currentKey = normalizeExpenseName(name);
  let currentValue = (name || '').trim();
  const visited = new Set();
  while (expenseNameRenameMap[currentKey] && !visited.has(currentKey)) {
    visited.add(currentKey);
    currentValue = expenseNameRenameMap[currentKey];
    currentKey = normalizeExpenseName(currentValue);
  }
  return currentValue || (name || '').trim();
}

function resolveIncomeName(name) {
  let currentKey = normalizeIncomeName(name);
  let currentValue = (name || '').trim();
  const visited = new Set();
  while (incomeNameRenameMap[currentKey] && !visited.has(currentKey)) {
    visited.add(currentKey);
    currentValue = incomeNameRenameMap[currentKey];
    currentKey = normalizeIncomeName(currentValue);
  }
  return currentValue || (name || '').trim();
}

function resolveCategoryName(name) {
  let current = (name || 'OUTROS').trim().toUpperCase();
  const visited = new Set();
  while (categoryRenameMap[current] && !visited.has(current)) {
    visited.add(current);
    current = categoryRenameMap[current];
  }
  return current;
}

function applyCategoryRenameToMonth(m) {
  if (!m) return;
  (m.gastosVar || []).forEach(g => {
    g.categoria = resolveCategoryName(g.categoria || 'OUTROS');
  });
  (m.despesas || []).forEach(d => {
    d.categoria = resolveCategoryName(d.categoria || 'OUTROS');
  });
  if (m.categorias && typeof m.categorias === 'object') {
    const next = {};
    Object.entries(m.categorias).forEach(([cat, val]) => {
      const resolved = resolveCategoryName(cat);
      next[resolved] = (next[resolved] || 0) + val;
    });
    m.categorias = next;
  }
  if (m._catOrig && typeof m._catOrig === 'object') {
    const nextOrig = {};
    Object.entries(m._catOrig).forEach(([cat, val]) => {
      const resolved = resolveCategoryName(cat);
      nextOrig[resolved] = (nextOrig[resolved] || 0) + val;
    });
    m._catOrig = nextOrig;
  }
}

function applyExpenseCategoryRulesToMonth(m) {
  if (!m) return;
  (m.despesas || []).forEach(d => {
    const ruleCat = expenseCategoryRules[normalizeExpenseName(d.nome)];
    if (ruleCat) d.categoria = resolveCategoryName(ruleCat);
  });
}

function applyExpenseNameRulesToMonth(m) {
  if (!m) return;
  (m.despesas || []).forEach(d => {
    d.nome = resolveExpenseName(d.nome);
  });
}

function applyExpensePaymentDateRulesToMonth(m) {
  if (!m) return;
  (m.despesas || []).forEach(d => {
    const ruleDate = expensePaymentDateRules[normalizeExpenseName(d.nome)];
    if (ruleDate !== undefined) d.data = ruleDate;
  });
}

function getImportedCategoriesForMonth(monthId) {
  if (!canUseBundledFinanceData()) return [];
  return Object.keys(IMPORTED_BREAKDOWNS[monthId] || {}).map(resolveCategoryName);
}

function getImportedProjectsForMonth(monthId) {
  if (!canUseBundledFinanceData()) return [];
  return (IMPORTED_PROJECTS[monthId] || []).map(item => ({ ...item }));
}

function normalizeEsoStatus(status) {
  const txt = String(status || '').trim().toLowerCase();
  if (txt === 'fechado') return 'Fechado';
  if (txt === 'aguardando') return 'Aguardando';
  return 'Não fechado';
}

function normalizeEsoEntry(entry, idx = 0) {
  return {
    id: entry.id || `eso_${idx}_${String(entry.cliente || 'item').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    data: normalizeVarDate(entry.data) || '',
    cliente: String(entry.cliente || '').trim() || '—',
    tipo: String(entry.tipo || '').trim() || '—',
    valor: Number(entry.valor || 0) || 0,
    entrada: String(entry.entrada || '').trim() || '—',
    status: normalizeEsoStatus(entry.status),
    manual: entry.manual === true
  };
}

function getDefaultEsoData() {
  return ESO_IMPORTED_CLOSINGS.map((entry, idx) => normalizeEsoEntry(entry, idx));
}

function saveEsoData() {
  Storage.setJSON(STORAGE_KEYS.esoData, esoData);
}

function sanitizeEsoFilter(filter) {
  const next = filter && typeof filter === 'object' ? filter : {};
  return {
    start: normalizeVarDate(next.start) || '',
    end: normalizeVarDate(next.end) || '',
    status: next.status || 'todas',
    tipo: String(next.tipo || 'todas'),
    entrada: String(next.entrada || 'todas'),
    search: String(next.search || '').trim()
  };
}

function getEsoUniqueValues(field) {
  return Array.from(new Set((esoData || []).map(item => String(item[field] || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function getFilteredEsoData() {
  const filter = sanitizeEsoFilter(esoFilter);
  const start = filter.start ? parseData(filter.start) : 0;
  const end = filter.end ? parseData(filter.end) : 0;
  return (esoData || []).filter(item => {
    const time = parseData(item.data);
    if (start && (!time || time < start)) return false;
    if (end && (!time || time > end)) return false;
    if (filter.status !== 'todas' && item.status !== filter.status) return false;
    if (filter.tipo !== 'todas' && item.tipo !== filter.tipo) return false;
    if (filter.entrada !== 'todas' && item.entrada !== filter.entrada) return false;
    if (filter.search) {
      const hay = `${item.cliente} ${item.tipo} ${item.entrada} ${item.status}`.toLowerCase();
      if (!hay.includes(filter.search.toLowerCase())) return false;
    }
    return true;
  });
}

function getSortedEsoData() {
  const rows = getFilteredEsoData().map(item => ({ item }));
  if (!esoSort.field) return rows;
  const factor = esoSort.direction === 'desc' ? -1 : 1;
  return rows.sort((a, b) => {
    if (esoSort.field === 'valor') return (a.item.valor - b.item.valor) * factor;
    if (esoSort.field === 'data') return (parseData(a.item.data) - parseData(b.item.data)) * factor;
    return String(a.item[esoSort.field] || '').localeCompare(String(b.item[esoSort.field] || ''), 'pt-BR') * factor;
  });
}

function getEsoMetrics(list = getFilteredEsoData()) {
  const totalValor = list.reduce((acc, item) => acc + (item.valor || 0), 0);
  const fechados = list.filter(item => item.status === 'Fechado');
  const aguardando = list.filter(item => item.status === 'Aguardando');
  return {
    totalProjetos: list.length,
    totalValor,
    totalFechados: fechados.length,
    valorFechado: fechados.reduce((acc, item) => acc + (item.valor || 0), 0),
    totalAbertos: list.length - fechados.length,
    aguardando: aguardando.length
  };
}

// ============================================================
// INIT
// ============================================================
function mergeMissingHistoricalMonths() {
  const existing = new Set((data || []).map(m => m.id));
  const additions = EXTRA_HIST_MONTHS
    .filter(month => !existing.has(month.id))
    .map(month => JSON.parse(JSON.stringify(month)));
  if (!additions.length) return false;
  data = [...data, ...additions];
  return true;
}

function isPrimaryUserEnvironment() {
  const boot = window.__APP_BOOTSTRAP__ || {};
  return !!(boot.isPrimaryUser || boot.session?.username === 'guilherme');
}

function canUseBundledFinanceData() {
  return isPrimaryUserEnvironment();
}

function hasImportedProjectFootprint(month) {
  if (!month || !Array.isArray(month.projetos) || !month.projetos.length) return false;
  const imported = IMPORTED_PROJECTS[month.id];
  return Array.isArray(imported) && areProjectListsEquivalent(month.projetos, imported);
}

function hasBundledContamination(months, esoEntries) {
  const extraMonthIds = new Set(EXTRA_HIST_MONTHS.map(month => month.id));
  return (months || []).some(month =>
    extraMonthIds.has(month.id) ||
    (month.gastosVar || []).some(item => item.importadoDaPlanilha === true) ||
    hasImportedProjectFootprint(month)
  ) || Array.isArray(esoEntries) && esoEntries.length > 0;
}

function hasUserOwnedFinancialData(months) {
  return (months || []).some(month => {
    if ((month.despesas || []).length) return true;
    if ((month.renda || []).length) return true;
    if (String(month.obs || '').trim()) return true;
    if ((month.gastosVar || []).some(item => item.importadoDaPlanilha !== true)) return true;
    if ((month.dailyCategorySeeds || []).length) return true;
    if (month.dailyGoals && Object.keys(month.dailyGoals).length) return true;
    if ((month.projetos || []).length && !hasImportedProjectFootprint(month)) return true;
    return false;
  });
}

function repairNonPrimaryContaminatedState() {
  if (canUseBundledFinanceData()) return false;
  if (!hasBundledContamination(data, esoData)) return false;
  if (hasUserOwnedFinancialData(data)) return false;

  data = [buildBlankMonth()];
  esoData = [];
  return true;
}

function init() {
  const boot = window.__APP_BOOTSTRAP__ || {};
  const allowBundledData = canUseBundledFinanceData();
  const saved = Storage.getJSON(STORAGE_KEYS.data, null);
  const savedMetas = Storage.getJSON(STORAGE_KEYS.metas, null);
  const savedCategoryRenameMap = Storage.getJSON(STORAGE_KEYS.categoryRenameMap, null);
  const savedExpenseCategoryRules = Storage.getJSON(STORAGE_KEYS.expenseCategoryRules, null);
  const savedExpenseNameRenameMap = Storage.getJSON(STORAGE_KEYS.expenseNameRenameMap, null);
  const savedExpensePaymentDateRules = Storage.getJSON(STORAGE_KEYS.expensePaymentDateRules, null);
  const savedIncomeNameRenameMap = Storage.getJSON(STORAGE_KEYS.incomeNameRenameMap, null);
  const savedEsoData = Storage.getJSON(STORAGE_KEYS.esoData, null);
  const savedMigrationVersion = parseInt(Storage.getText(STORAGE_KEYS.migrationVersion, '0') || '0', 10);
  if (savedCategoryRenameMap) categoryRenameMap = savedCategoryRenameMap;
  if (savedExpenseCategoryRules) expenseCategoryRules = savedExpenseCategoryRules;
  if (savedExpenseNameRenameMap) expenseNameRenameMap = savedExpenseNameRenameMap;
  if (savedExpensePaymentDateRules) expensePaymentDateRules = savedExpensePaymentDateRules;
  if (savedIncomeNameRenameMap) incomeNameRenameMap = savedIncomeNameRenameMap;
  if (saved) {
    data = saved;
  } else if (boot.shouldStartEmpty || !allowBundledData) {
    data = [buildBlankMonth()];
  } else {
    data = JSON.parse(JSON.stringify(HIST_DATA));
  }
  const mergedMissingMonths = allowBundledData && !boot.shouldStartEmpty ? mergeMissingHistoricalMonths() : false;
  sortDataChronologically();
  data.forEach(m => { normalizeMonth(m); recalcTotals(m); });
  esoData = savedEsoData
    ? savedEsoData.map((entry, idx) => normalizeEsoEntry(entry, idx))
    : (boot.permissions?.canAccessESO ? getDefaultEsoData() : []);
  const repairedNonPrimaryState = repairNonPrimaryContaminatedState();
  if (!savedEsoData && boot.permissions?.canAccessESO) saveEsoData();
  if ((!saved && allowBundledData && !boot.shouldStartEmpty) || mergedMissingMonths || repairedNonPrimaryState || savedMigrationVersion < DATA_MIGRATION_VERSION) {
    save();
    Storage.setText(STORAGE_KEYS.migrationVersion, DATA_MIGRATION_VERSION);
    if (repairedNonPrimaryState) saveEsoData();
  }
  metas = savedMetas || {};
  const savedTitles = Storage.getJSON(STORAGE_KEYS.titles, null);
  if (savedTitles) sectionTitles = savedTitles;
  const savedResult = Storage.getText(STORAGE_KEYS.resultMode, '');
  if (savedResult) resultMode = savedResult;
  const savedDashMetricOrder = Storage.getJSON(STORAGE_KEYS.dashMetricOrder, null);
  if (savedDashMetricOrder) {
    dashMetricOrder = sanitizeDashMetricOrder(savedDashMetricOrder);
  } else {
    dashMetricOrder = sanitizeDashMetricOrder(dashMetricOrder);
    saveDashMetricOrder();
  }
  const savedDashboardWidgetOrder = Storage.getJSON(STORAGE_KEYS.dashboardWidgetOrder, null);
  if (savedDashboardWidgetOrder) {
    dashboardWidgetOrder = sanitizeDashboardWidgetOrder(savedDashboardWidgetOrder);
  } else {
    dashboardWidgetOrder = sanitizeDashboardWidgetOrder(dashboardWidgetOrder);
    saveDashboardWidgetState();
  }
  const savedDashboardWidgetLayout = Storage.getJSON(STORAGE_KEYS.dashboardWidgetLayout, null);
  if (savedDashboardWidgetLayout) {
    dashboardWidgetLayout = sanitizeDashboardWidgetLayout(savedDashboardWidgetLayout);
  } else {
    dashboardWidgetLayout = sanitizeDashboardWidgetLayout(dashboardWidgetLayout);
    saveDashboardWidgetState();
  }
  const savedMonthMetricOrder = Storage.getJSON(STORAGE_KEYS.monthMetricOrder, null);
  if (savedMonthMetricOrder) {
    monthMetricOrder = sanitizeMonthMetricOrder(savedMonthMetricOrder);
  } else {
    monthMetricOrder = sanitizeMonthMetricOrder(monthMetricOrder);
    saveMonthMetricOrder();
  }
  loadDashSeriesSelectionState();
  const savedDashSeriesColors = Storage.getJSON(STORAGE_KEYS.dashSeriesColors, null);
  if (savedDashSeriesColors) {
    dashSeriesColorOverrides = { ...savedDashSeriesColors };
  }
  const savedCategoryColors = Storage.getJSON(STORAGE_KEYS.categoryColors, null);
  if (savedCategoryColors) {
    categoryColorOverrides = { ...savedCategoryColors };
  }
  const savedMonthSectionColors = Storage.getJSON(STORAGE_KEYS.monthSectionColors, null);
  if (savedMonthSectionColors) {
    monthSectionColorOverrides = { ...savedMonthSectionColors };
  }
  currentMonthId = getDefaultMonthId();
  periodFilter = sanitizePeriodFilter({
    type: 'all',
    month: currentMonthId,
    year: getYear(data[data.length - 1] || {}),
    start: currentMonthId,
    end: currentMonthId
  });
  restoreUIState();
  loadDashSeriesSelectionState();
  saveDashSeriesSelection();
  runIntegrityCheck(false);
  buildMonthSelect();
  renderTitles();
  nav(activePage);
}

function save(forceFlush = false) {
  Storage.setJSON(STORAGE_KEYS.data, data);
  if (forceFlush) flushServerStorage(true);
}

function saveMetas() {
  Storage.setJSON(STORAGE_KEYS.metas, metas);
}

function createHistorySnapshot() {
  return JSON.stringify({
    data,
    metas,
    currentMonthId,
    categoryRenameMap,
    expenseCategoryRules,
    expenseNameRenameMap,
    expensePaymentDateRules,
    incomeNameRenameMap,
    esoData
  });
}

function restoreHistorySnapshot(snapshot) {
  const state = JSON.parse(snapshot);
  data = state.data || [];
  sortDataChronologically();
  metas = state.metas || {};
  currentMonthId = state.currentMonthId || getDefaultMonthId();
  categoryRenameMap = state.categoryRenameMap || {};
  expenseCategoryRules = state.expenseCategoryRules || {};
  expenseNameRenameMap = state.expenseNameRenameMap || {};
  expensePaymentDateRules = state.expensePaymentDateRules || {};
  incomeNameRenameMap = state.incomeNameRenameMap || {};
  esoData = Array.isArray(state.esoData)
    ? state.esoData.map((entry, idx) => normalizeEsoEntry(entry, idx))
    : ((window.__APP_BOOTSTRAP__?.permissions?.canAccessESO || canUseBundledFinanceData()) ? getDefaultEsoData() : []);
  data.forEach(normalizeMonth);
  save();
  saveMetas();
  saveEsoData();
  saveCategoryRenameMap();
  saveExpenseCategoryRules();
  saveExpenseNameRenameMap();
  saveExpensePaymentDateRules();
  saveIncomeNameRenameMap();
  buildMonthSelect();
  renderAll();
}

function recordHistoryState() {
  undoStack.push(createHistorySnapshot());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}

function updateHistoryButtons() {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function undoLastChange() {
  if (undoStack.length === 0) return;
  redoStack.push(createHistorySnapshot());
  const snapshot = undoStack.pop();
  restoreHistorySnapshot(snapshot);
  updateHistoryButtons();
}

function redoLastChange() {
  if (redoStack.length === 0) return;
  undoStack.push(createHistorySnapshot());
  const snapshot = redoStack.pop();
  restoreHistorySnapshot(snapshot);
  updateHistoryButtons();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isInlineEditing(table, row, field) {
  return inlineEditState && inlineEditState.table === table && inlineEditState.row === row && inlineEditState.field === field;
}

function startInlineEdit(table, row, field, kind) {
  inlineEditState = { table, row, field, kind };
  if (table === 'varItem') renderVarTable();
  else if (table === 'eso') renderEso();
  else renderMes();
  requestAnimationFrame(() => {
    const editor = document.getElementById('inlineEditor');
    if (editor) {
      editor.focus();
      if (editor.select) editor.select();
    }
  });
}

function cancelInlineEdit() {
  if (!inlineEditState) return;
  const table = inlineEditState.table;
  inlineEditState = null;
  if (table === 'varItem') renderVarTable();
  else if (table === 'eso') renderEso();
  else renderMes();
}
