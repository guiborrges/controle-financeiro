function setPreferencesStatus(message, tone = 'normal') {
  const el = document.getElementById('preferencesStatus');
  if (!el) return;
  el.textContent = message || '';
  el.style.color = tone === 'error' ? 'var(--red)' : (tone === 'success' ? 'var(--green)' : 'var(--text2)');
}

function openPreferences() {
  setPreferencesStatus('');
  openModal('modalPreferences');
  loadWidgetTokenStatus().catch(() => {
    setPreferencesStatus('Não foi possível carregar o status do widget.', 'error');
  });
}

function resetDashboardLayout() {
  recordHistoryState();
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
  recordHistoryState();
  dashSeriesColorOverrides = {};
  categoryColorOverrides = {};
  saveDashSeriesColors();
  saveCategoryColors();
  saveUIState();
  setPreferencesStatus('Cores personalizadas resetadas.', 'success');
  if (activePage === 'dashboard') renderDashboard();
}

function resetDashboardSeries() {
  recordHistoryState();
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
  recordHistoryState();
  [
    STORAGE_KEYS.uiState,
    STORAGE_KEYS.dashMetricOrder,
    STORAGE_KEYS.dashboardWidgetOrder,
    STORAGE_KEYS.dashboardWidgetLayout,
    STORAGE_KEYS.monthMetricOrder,
    STORAGE_KEYS.monthSectionOrder,
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
  monthMetricOrder = sanitizeMonthMetricOrder(['resultado', 'gastos', 'renda', 'projetos', 'metas']);
  monthSectionOrder = sanitizeMonthSectionOrder(['renda', 'goals', 'despesas', 'daily', 'projetos', 'reembolsos', 'observacoes']);
  dashSeriesSelectionsByMode = { simples: [...DEFAULT_DASH_SERIES], fixo: [...DEFAULT_DASH_SERIES] };
  dashSeriesSelection = [...DEFAULT_DASH_SERIES];
  dashSeriesColorOverrides = {};
  categoryColorOverrides = {};
  resultMode = 'simples';
  saveDashMetricOrder();
  saveDashboardWidgetState();
  saveMonthMetricOrder();
  saveMonthSectionOrder();
  saveDashSeriesSelection();
  saveDashSeriesColors();
  saveCategoryColors();
  Storage.setText(STORAGE_KEYS.resultMode, resultMode);
  saveUIState();
  setPreferencesStatus('Preferências da interface resetadas.', 'success');
  renderAll();
}

function runIntegrityCheck(showFeedback = false) {
  const runDeep = showFeedback === true;
  const issues = [];
  if (!Array.isArray(data)) data = [];
  if (!data.length) {
    data = [buildBlankMonth()];
    issues.push('Base mensal estava vazia e foi recriada.');
  }
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
    if (!Array.isArray(month.financialGoals)) {
      month.financialGoals = [];
      issues.push(`Metas financeiras recriadas em ${month.id}.`);
    }
    if (!Array.isArray(month.outflowCards)) {
      month.outflowCards = [];
      issues.push(`Cartões recriados em ${month.id}.`);
    }
    if (!Array.isArray(month.outflows)) {
      month.outflows = [];
      issues.push(`Saídas unificadas recriadas em ${month.id}.`);
    }
    if (!Array.isArray(month.cardBills)) {
      month.cardBills = [];
      issues.push(`Faturas recriadas em ${month.id}.`);
    }

    month.renda.forEach(item => {
      if (item.includeInTotals !== true) item.includeInTotals = true;
    });
    month.projetos.forEach(item => {
      if (item.includeInTotals !== true) item.includeInTotals = true;
    });
    month.financialGoals.forEach(item => {
      if (item.includeInTotals !== true) item.includeInTotals = true;
    });

    if (typeof normalizeUnifiedCard === 'function') {
      month.outflowCards = month.outflowCards.map((card, idx) => normalizeUnifiedCard(card, idx));
    }
    if (typeof normalizeUnifiedOutflowItem === 'function') {
      month.outflows = month.outflows.map((item, idx) => normalizeUnifiedOutflowItem(item, idx));
      const outflowIds = new Set();
      month.outflows = month.outflows.filter(item => {
        const id = String(item?.id || '').trim();
        if (!id || outflowIds.has(id)) {
          issues.push(`Saída duplicada removida em ${month.id}.`);
          return false;
        }
        outflowIds.add(id);
        return true;
      });
    }
    if (typeof normalizeUnifiedCardBill === 'function') {
      month.cardBills = month.cardBills.map((bill, idx) => normalizeUnifiedCardBill(month, bill, idx));
    }
    if (typeof ensureUnifiedOutflowPilotMonth === 'function') {
      ensureUnifiedOutflowPilotMonth(month);
    }

    // Avoid old architecture residue where output methods are persisted as categories.
    (month.outflows || []).forEach(item => {
      const currentCategory = String(item?.category || 'OUTROS');
      if (typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(currentCategory)) {
        item.category = 'OUTROS';
        issues.push(`Categoria inválida ajustada em ${month.id}.`);
      }
    });

    // Daily goals should exist only for spend categories, not fixed-only categories.
    if (month.dailyGoals && typeof month.dailyGoals === 'object') {
      const spendCategories = new Set(
        (month.outflows || [])
          .filter(item => item?.type === 'spend')
          .map(item => String(item?.category || '').trim())
          .filter(Boolean)
      );
      Object.keys(month.dailyGoals).forEach(category => {
        if (!spendCategories.has(category)) {
          delete month.dailyGoals[category];
          issues.push(`Meta diária removida de categoria sem gastos variáveis em ${month.id}.`);
        }
      });
    }

    normalizeMonth(month);
    recalcTotals(month);
  });

  if (runDeep && typeof migrateAllMonthsToUnifiedStructure === 'function') {
    const migration = migrateAllMonthsToUnifiedStructure(data);
    if (migration?.changed) {
      issues.push('Recorrências e estrutura unificada foram sincronizadas automaticamente.');
    }
  }

  if (runDeep && typeof harmonizeRealCategoriesAcrossMonths === 'function' && harmonizeRealCategoriesAcrossMonths()) {
    issues.push('Categorias equivalentes foram padronizadas.');
  }

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

let _widgetTokenFull = null;

function getWidgetElements() {
  return {
    status: document.getElementById('widgetTokenStatus'),
    btnGenerate: document.getElementById('btnGenerateWidget'),
    btnCopy: document.getElementById('btnCopyWidget'),
    btnRevoke: document.getElementById('btnRevokeWidget'),
    instructions: document.getElementById('widgetInstructions')
  };
}

async function loadWidgetTokenStatus() {
  const elements = getWidgetElements();
  if (!elements.status) return;

  const response = await fetch('/api/widget/token-status', {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.message || 'Falha ao consultar status do token.'));
  }

  const hasToken = !!payload?.hasToken;
  const tokenPreview = String(payload?.tokenPreview || '');

  if (hasToken) {
    elements.status.textContent = `✓ Token ativo · ${tokenPreview}`;
    if (elements.btnGenerate) {
      elements.btnGenerate.style.display = '';
      elements.btnGenerate.textContent = 'Gerar novo token';
    }
    if (elements.btnCopy) elements.btnCopy.style.display = '';
    if (elements.btnRevoke) elements.btnRevoke.style.display = '';
    if (elements.instructions) elements.instructions.style.display = '';
  } else {
    elements.status.textContent = 'Nenhum token gerado ainda.';
    if (elements.btnGenerate) {
      elements.btnGenerate.style.display = '';
      elements.btnGenerate.textContent = 'Gerar widget';
    }
    if (elements.btnCopy) elements.btnCopy.style.display = 'none';
    if (elements.btnRevoke) elements.btnRevoke.style.display = 'none';
    if (elements.instructions) elements.instructions.style.display = 'none';
    _widgetTokenFull = null;
  }
}

async function generateWidgetToken() {
  try {
    const response = await fetch('/api/widget/generate-token', {
      method: 'POST',
      credentials: 'same-origin',
      headers: getCsrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify({})
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(payload?.message || 'Falha ao gerar token do widget.'));
    }
    _widgetTokenFull = String(payload?.token || '').trim() || null;
    await loadWidgetTokenStatus();
    setPreferencesStatus('Widget gerado com sucesso! Copie o código agora.', 'success');
  } catch (error) {
    setPreferencesStatus(String(error?.message || 'Falha ao gerar token do widget.'), 'error');
  }
}

async function revokeWidgetToken() {
  const ok = window.confirm('Tem certeza? O widget atual vai parar de funcionar.');
  if (!ok) return;
  try {
    const response = await fetch('/api/widget/revoke-token', {
      method: 'POST',
      credentials: 'same-origin',
      headers: getCsrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify({})
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(payload?.message || 'Falha ao revogar token do widget.'));
    }
    _widgetTokenFull = null;
    await loadWidgetTokenStatus();
    setPreferencesStatus('Token revogado.', 'success');
  } catch (error) {
    setPreferencesStatus(String(error?.message || 'Falha ao revogar token do widget.'), 'error');
  }
}

function formatScriptableBrl(value) {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(Number(value || 0)).toFixed(2);
  const [intPart, decimals] = abs.split('.');
  return `${sign}R$ ${intPart.replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.')},${decimals}`;
}

function buildScriptableCode(token) {
  const safeToken = String(token || '').trim();
  const baseUrl = window.location.origin;
  return `// ============================================================
// Widget Financeiro — Diretório Online
// Gerado automaticamente. Não compartilhe este código.
// ============================================================

const TOKEN = "${safeToken}";
const BASE_URL = "${baseUrl}";

function formatBRL(value) {
  try {
    const absValue = Math.abs(Number(value || 0));
    const formatted = absValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return (Number(value || 0) < 0 ? '-' : '') + 'R$ ' + formatted;
  } catch (_) {
    const sign = Number(value || 0) < 0 ? '-' : '';
    const abs = Math.abs(Number(value || 0)).toFixed(2);
    const parts = abs.split('.');
    const intPart = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
    return sign + 'R$ ' + intPart + ',' + parts[1];
  }
}

async function fetchData() {
  const url = BASE_URL + '/api/widget/finance-summary?token=' + TOKEN;
  const req = new Request(url);
  req.timeoutInterval = 10;
  try {
    return await req.loadJSON();
  } catch (_) {
    return null;
  }
}

function addLabel(stack, text, size = 11, color = '#8A847C', weight = 'regular') {
  const label = stack.addText(String(text || ''));
  label.font = weight === 'bold' ? Font.boldSystemFont(size) : Font.systemFont(size);
  label.textColor = new Color(color);
  return label;
}

function progressColor(percentage) {
  if (percentage > 100) return '#BB4F43';
  if (percentage > 70) return '#B98A2F';
  return '#245A4A';
}

function renderProgressBar(container, percentage) {
  const normalized = Math.max(0, Math.min(100, Number(percentage || 0)));
  const width = 78;
  const bar = container.addStack();
  bar.size = new Size(width, 4);
  bar.backgroundColor = new Color('#E8E4DE');
  bar.cornerRadius = 3;
  bar.layoutHorizontally();
  const fill = bar.addStack();
  fill.size = new Size(Math.max(2, Math.round((normalized / 100) * width)), 4);
  fill.backgroundColor = new Color(progressColor(percentage));
  fill.cornerRadius = 3;
}

function buildErrorState(widget, message) {
  widget.addSpacer();
  const icon = widget.addText('⚠️');
  icon.font = Font.boldSystemFont(24);
  icon.centerAlignText();
  const msg = widget.addText(String(message || 'Sem conexão'));
  msg.font = Font.boldSystemFont(12);
  msg.textColor = new Color('#191814');
  msg.centerAlignText();
  const sub = widget.addText('Toque para abrir o app');
  sub.font = Font.systemFont(11);
  sub.textColor = new Color('#8A847C');
  sub.centerAlignText();
  widget.addSpacer();
}

function buildHeader(widget, data) {
  const top = widget.addStack();
  top.layoutHorizontally();
  top.centerAlignContent();

  const left = top.addStack();
  left.layoutVertically();
  addLabel(left, 'DESPESAS DO MÊS', 9, '#8A847C', 'bold');
  addLabel(left, formatBRL(data.monthlyExpenses), 22, '#BB4F43', 'bold');

  top.addSpacer(12);
  const divider = top.addStack();
  divider.size = new Size(1, 38);
  divider.backgroundColor = new Color('#E8E4DE');
  top.addSpacer(12);

  const right = top.addStack();
  right.layoutVertically();
  addLabel(right, 'RESULTADO', 9, '#8A847C', 'bold');
  const resultColor = Number(data.result || 0) >= 0 ? '#245A4A' : '#BB4F43';
  addLabel(right, formatBRL(data.result), 22, resultColor, 'bold');

  widget.addSpacer(10);
  const hLine = widget.addStack();
  hLine.size = new Size(0, 1);
  hLine.backgroundColor = new Color('#EAE6E0');
  widget.addSpacer(10);
}

function buildGoals(widget, data, limit) {
  const goals = Array.isArray(data.goals) ? data.goals.slice(0, limit) : [];
  if (!goals.length) {
    const empty = widget.addText('Nenhuma meta definida');
    empty.font = Font.systemFont(12);
    empty.textColor = new Color('#8A847C');
    return;
  }

  goals.forEach((goal, index) => {
    const row = widget.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    row.spacing = 8;

    const icon = row.addText(String(goal.icon || '•'));
    icon.font = Font.systemFont(14);
    icon.textColor = new Color('#191814');

    const category = row.addText(String(goal.category || 'Categoria'));
    category.font = Font.boldSystemFont(12);
    category.textColor = new Color('#191814');
    category.lineLimit = 1;
    row.addSpacer();

    const meter = row.addStack();
    meter.layoutVertically();
    renderProgressBar(meter, Number(goal.percentage || 0));

    row.addSpacer(8);
    const values = row.addText(\`\${formatBRL(goal.spent)} / \${formatBRL(goal.goal)}\`);
    values.font = Font.systemFont(10);
    values.textColor = new Color('#8A847C');

    if (index < goals.length - 1) widget.addSpacer(6);
  });
}

function buildSmallWidget(widget, data) {
  const block = widget.addStack();
  block.layoutVertically();
  addLabel(block, 'Despesas', 11, '#8A847C', 'bold');
  addLabel(block, formatBRL(data.monthlyExpenses), 28, '#BB4F43', 'bold');
  widget.addSpacer(6);
  addLabel(block, 'Resultado', 11, '#8A847C', 'bold');
  const resultColor = Number(data.result || 0) >= 0 ? '#245A4A' : '#BB4F43';
  addLabel(block, formatBRL(data.result), 22, resultColor, 'bold');
}

function buildMediumWidget(widget, data) {
  buildHeader(widget, data);
  buildGoals(widget, data, 3);
}

function buildLargeWidget(widget, data) {
  buildHeader(widget, data);
  buildGoals(widget, data, 7);
}

async function run() {
  const data = await fetchData();
  const widget = new ListWidget();
  widget.backgroundColor = new Color('#FAFAF8');
  widget.setPadding(16, 16, 16, 16);
  widget.spacing = 0;
  widget.url = BASE_URL + '/app';

  const size = config.widgetFamily || 'medium';
  if (!data || data.error) {
    buildErrorState(widget, data && data.error ? data.error : 'Sem conexão');
  } else if (size === 'small') {
    buildSmallWidget(widget, data);
  } else if (size === 'large') {
    buildLargeWidget(widget, data);
  } else {
    buildMediumWidget(widget, data);
  }

  Script.setWidget(widget);
  if (!config.runsInWidget) {
    if (size === 'small') {
      await widget.presentSmall();
    } else if (size === 'large') {
      await widget.presentLarge();
    } else {
      await widget.presentMedium();
    }
  }
  Script.complete();
}

run();`.trim();
}

async function copyWidgetCode() {
  try {
    if (!_widgetTokenFull) {
      setPreferencesStatus('Para copiar um novo código, gere um novo token primeiro.', 'error');
      return;
    }
    const code = buildScriptableCode(_widgetTokenFull);
    await navigator.clipboard.writeText(code);
    setPreferencesStatus('Código copiado! Cole no Scriptable.', 'success');
  } catch (error) {
    setPreferencesStatus(String(error?.message || 'Falha ao copiar código do widget.'), 'error');
  }
}

