function setPreferencesStatus(message, tone = 'normal') {
  const el = document.getElementById('preferencesStatus');
  if (!el) return;
  el.textContent = message || '';
  el.style.color = tone === 'error' ? 'var(--red)' : (tone === 'success' ? 'var(--green)' : 'var(--text2)');
}

function openPreferences() {
  setPreferencesStatus('');
  openModal('modalPreferences');
}

function resetDashboardLayout() {
  dashboardWidgetLayout = sanitizeDashboardWidgetLayout(dashboardWidgetBaseLayout());
  dashboardWidgetOrder = sanitizeDashboardWidgetOrder(['gvsr', 'categories', 'result', 'quickhist']);
  dashMetricOrder = sanitizeDashMetricOrder(['resultado', 'gastos', 'ganhos', 'renda', 'projetos']);
  saveDashboardWidgetState();
  saveDashMetricOrder();
  saveUIState();
  setPreferencesStatus('Layout do dashboard resetado.', 'success');
  if (activePage === 'dashboard') renderDashboard();
}

function resetDashboardColors() {
  dashSeriesColorOverrides = {};
  categoryColorOverrides = {};
  saveDashSeriesColors();
  saveCategoryColors();
  saveUIState();
  setPreferencesStatus('Cores personalizadas resetadas.', 'success');
  if (activePage === 'dashboard') renderDashboard();
}

function resetDashboardSeries() {
  dashSeriesSelectionsByMode = {
    simples: [...DEFAULT_DASH_SERIES],
    fixo: [...DEFAULT_DASH_SERIES]
  };
  dashSeriesSelection = getDashSeriesSelectionForMode(resultMode);
  saveDashSeriesSelection();
  saveUIState();
  setPreferencesStatus('Séries do gráfico resetadas.', 'success');
  if (activePage === 'dashboard') renderDashboard();
}

function resetUIState() {
  [
    STORAGE_KEYS.uiState,
    STORAGE_KEYS.dashMetricOrder,
    STORAGE_KEYS.dashboardWidgetOrder,
    STORAGE_KEYS.dashboardWidgetLayout,
    STORAGE_KEYS.monthMetricOrder,
    STORAGE_KEYS.dashSeriesSelection,
    STORAGE_KEYS.dashSeriesSelectionSimple,
    STORAGE_KEYS.dashSeriesSelectionFixed,
    STORAGE_KEYS.dashSeriesSelectionVersion,
    STORAGE_KEYS.dashSeriesColors,
    STORAGE_KEYS.categoryColors,
    STORAGE_KEYS.resultMode
  ].forEach(Storage.remove);
  dashMetricOrder = sanitizeDashMetricOrder(['resultado', 'gastos', 'ganhos', 'renda', 'projetos']);
  dashboardWidgetOrder = sanitizeDashboardWidgetOrder(['gvsr', 'categories', 'result', 'quickhist']);
  dashboardWidgetLayout = sanitizeDashboardWidgetLayout(dashboardWidgetBaseLayout());
  monthMetricOrder = sanitizeMonthMetricOrder(['resultado', 'gastos', 'renda', 'projetos']);
  dashSeriesSelectionsByMode = { simples: [...DEFAULT_DASH_SERIES], fixo: [...DEFAULT_DASH_SERIES] };
  dashSeriesSelection = [...DEFAULT_DASH_SERIES];
  dashSeriesColorOverrides = {};
  categoryColorOverrides = {};
  resultMode = 'simples';
  saveDashMetricOrder();
  saveDashboardWidgetState();
  saveMonthMetricOrder();
  saveDashSeriesSelection();
  saveDashSeriesColors();
  saveCategoryColors();
  Storage.setText(STORAGE_KEYS.resultMode, resultMode);
  saveUIState();
  setPreferencesStatus('Preferências da interface resetadas.', 'success');
  renderAll();
}

function runIntegrityCheck(showFeedback = false) {
  const issues = [];
  const seenIds = new Set();
  data = (data || []).filter(month => {
    if (!month || !month.id) {
      issues.push('Encontrado mês inválido e removido.');
      return false;
    }
    if (seenIds.has(month.id)) {
      issues.push(`Mês duplicado removido: ${month.id}`);
      return false;
    }
    seenIds.add(month.id);
    return true;
  });
  data.forEach(month => {
    if (!Array.isArray(month.despesas)) {
      month.despesas = [];
      issues.push(`Despesas recriadas em ${month.id}.`);
    }
    if (!Array.isArray(month.renda)) {
      month.renda = [];
      issues.push(`Rendas recriadas em ${month.id}.`);
    }
    if (!Array.isArray(month.projetos)) {
      month.projetos = [];
      issues.push(`Projetos recriados em ${month.id}.`);
    }
    if (!month.categorias || typeof month.categorias !== 'object') {
      month.categorias = {};
      issues.push(`Categorias recriadas em ${month.id}.`);
    }
    normalizeMonth(month);
    recalcTotals(month);
  });
  sortDataChronologically();
  if (issues.length) {
    save();
    saveUIState();
  }
  if (showFeedback) {
    setPreferencesStatus(issues.length ? `Verificação concluída com ajustes: ${issues.length}` : 'Nenhuma inconsistência encontrada.', issues.length ? 'success' : 'normal');
  }
  console.info('[Integridade]', issues.length ? issues : ['Sem inconsistências relevantes.']);
  return issues;
}

