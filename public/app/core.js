function handleInlineEditorKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitInlineEdit(event.target.value);
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelInlineEdit();
  }
}

function getInlineItem(table, row) {
  const m = getCurrentMonth();
  if (table === 'despesa') return m.despesas[row];
  if (table === 'renda') return m.renda[row];
  if (table === 'financialGoal') return m.financialGoals[row];
  if (table === 'projeto') return m.projetos[row];
  if (table === 'varItem') return m.gastosVar[row];
  if (table === 'unifiedOutflow') return (m.outflows || []).find(item => item.id === row) || null;
  if (table === 'unifiedCardBill') return (m.cardBills || []).find(item => item.id === row) || null;
  if (table === 'eso') return (esoData || []).find(item => item.id === row) || null;
  return null;
}

function getInlineDespesaCategoryOptions(currentCat) {
  const base = getMonthCategoryNames(getCurrentMonth(), window, { includeFallbackBase: false });
  const current = resolveCategoryName(currentCat || 'OUTROS');
  if (!base.includes(current)) base.unshift(current);
  return Array.from(new Set(base));
}

function getCategoryScalarText(value) {
  return window.MonthSelectionCatalog.getCategoryScalarText(value);
}

function stripLegacyCategoryIconPrefix(value) {
  return window.MonthSelectionCatalog.stripLegacyCategoryIconPrefix(value);
}

function getMonthSelectionCatalog() {
  return window.MonthSelectionCatalog.create({
    data: typeof data !== 'undefined' ? data : undefined,
    window,
    getCurrentMonth: typeof getCurrentMonth === 'function' ? getCurrentMonth : undefined,
    resolveCategoryName: typeof resolveCategoryName === 'function' ? resolveCategoryName : undefined,
    getMonthSortValue: typeof getMonthSortValue === 'function' ? getMonthSortValue : undefined,
    isNonRealCategoryLabel: typeof isNonRealCategoryLabel === 'function' ? isNonRealCategoryLabel : undefined,
    getCategoryEmoji: typeof getCategoryEmoji === 'function' ? getCategoryEmoji : undefined
  });
}

function getMonthSortValueSafe(month) {
  return getMonthSelectionCatalog().getMonthSortValueSafe(...arguments);
}

function getPreviousMonthForCategoryModel(currentMonth) {
  return getMonthSelectionCatalog().getPreviousMonthForCategoryModel(...arguments);
}

function getMonthSpentCategorySet(month) {
  return getMonthSelectionCatalog().getMonthSpentCategorySet(...arguments);
}

function getSelectableCategoryEntriesForMonth(month, { includeFallbackBase = true, ignoreVisibility = false } = {}) {
  return getMonthSelectionCatalog().getSelectableCategoryEntriesForMonth(...arguments);
}

function getSelectableCategoryNamesForMonth(month, options = {}) {
  return getMonthSelectionCatalog().getSelectableCategoryNamesForMonth(...arguments);
}

function resolveMonthForCategoryOptions(monthOrId, context = window) {
  return getMonthSelectionCatalog().resolveMonthForCategoryOptions(...arguments);
}

function getMonthCategoryOptions(monthOrId, context = window, options = {}) {
  return getMonthSelectionCatalog().getMonthCategoryOptions(...arguments);
}

function getMonthCategoryNames(monthOrId, context = window, options = {}) {
  return getMonthSelectionCatalog().getMonthCategoryNames(...arguments);
}

function getMonthTagOptions(monthOrId, context = window, options = {}) {
  return getMonthSelectionCatalog().getMonthTagOptions(...arguments);
}

function migrateMonthSelectionVisibility(month, source = data) {
  if (!month || month.selectionVisibility?.version >= 2) return false;
  const categories = {};
  const tags = {};
  const addCategory = value => {
    const category = resolveCategoryName(stripLegacyCategoryIconPrefix(value || ''));
    if (category && !(typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(category))) categories[category] = true;
  };
  (month.outflows || []).forEach(item => {
    addCategory(item?.category || item?.categoria || 'OUTROS');
    const tag = String(item?.tag || '').trim();
    if (tag) tags[tag.toLocaleLowerCase('pt-BR')] = true;
  });
  (month.gastosVar || []).forEach(item => addCategory(item?.categoria || 'OUTROS'));
  (month.despesas || []).forEach(item => addCategory(item?.categoria || 'OUTROS'));
  const automaticDefaults = new Set((Array.isArray(window.SYSTEM_DEFAULT_CATEGORY_PRESETS) ? window.SYSTEM_DEFAULT_CATEGORY_PRESETS : [])
    .map(item => resolveCategoryName(item?.name || '')));
  (month.dailyCategorySeeds || []).forEach(category => {
    if (!automaticDefaults.has(resolveCategoryName(category || ''))) addCategory(category);
  });
  Object.keys(month.dailyGoals || {}).forEach(addCategory);
  Object.entries(month.categorias || {}).forEach(([category, value]) => {
    if (Number(value) > 0) addCategory(category);
  });
  Object.entries(month._catOrig || {}).forEach(([category, value]) => {
    if (Number(value) > 0) addCategory(category);
  });
  month.selectionVisibility = { version: 2, categories, tags };
  return true;
}

function inheritMonthSelectionVisibility(month, previousMonth) {
  if (!previousMonth?.selectionVisibility) return false;
  month.selectionVisibility = JSON.parse(JSON.stringify(previousMonth.selectionVisibility));
  return true;
}

function getVariableCategoryOptions(m) {
  return getMonthCategoryNames(m || getCurrentMonth(), window, { includeFallbackBase: false });
}

function getInlineVarCategoryOptions(currentCat) {
  const m = getCurrentMonth();
  const current = resolveCategoryName(currentCat || 'OUTROS');
  const options = getVariableCategoryOptions(m);
  if (!options.includes(current)) options.unshift(current);
  return Array.from(new Set(options));
}

function getInlineEsoStatusOptions(currentStatus) {
  const base = ['Fechado', 'Não fechado', 'Aguardando'];
  const current = normalizeEsoStatus(currentStatus);
  if (!base.includes(current)) base.unshift(current);
  return Array.from(new Set(base));
}

function formatVarDateTyping(txt) {
  if (window.DateUtils?.formatDateInputProgressive) {
    return window.DateUtils.formatDateInputProgressive(txt);
  }
  const digits = String(txt || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function maskVarDateInput(input) {
  if (!input) return;
  input.value = formatVarDateTyping(input.value);
}

function getLastVarDate() {
  const m = getCurrentMonth();
  const last = (m.gastosVar || []).slice().reverse().find(g => normalizeVarDate(g.data));
  return last ? normalizeVarDate(last.data) : '';
}

function shiftVarDate(deltaDays) {
  const input = document.getElementById('varData');
  if (!input) return;
  const base = normalizeVarDate(input.value) || getLastVarDate();
  if (!base) return;
  const [day, month, year] = base.split('/').map(v => parseInt(v, 10));
  const date = new Date(2000 + year, month - 1, day);
  date.setDate(date.getDate() + deltaDays);
  input.value = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
}

function renderInlineCell({ table, row, field, kind, value, displayValue, className = '', style = '' }) {
  const attrs = `${className ? ` class="${className}"` : ''}${style ? ` style="${style}"` : ''}`;
  const rowArg = typeof row === 'number'
    ? String(row)
    : `'${String(row).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (isInlineEditing(table, row, field)) {
    const categoryOptionLabel = (name) => {
      return String(name || 'OUTROS');
    };
    if (kind === 'unified-output') {
      const m = getCurrentMonth();
      return `<td${attrs}><select id="inlineEditor" class="btn" style="padding:6px 8px;font-size:12px" onchange="handleInlineSelectChange(this.value)" onblur="cancelInlineEdit()">${typeof getUnifiedOutflowOutputOptions === 'function' ? getUnifiedOutflowOutputOptions(m, String(value || '')) : ''}</select></td>`;
    }
    if (kind === 'unified-category') {
      const m = getCurrentMonth();
      const current = resolveCategoryName(value || 'OUTROS');
      const options = getVariableCategoryOptions(m);
      if (!options.includes(current)) options.unshift(current);
      return `<td${attrs}><select id="inlineEditor" class="btn" style="padding:6px 8px;font-size:12px" onchange="handleInlineSelectChange(this.value)" onblur="cancelInlineEdit()">${options.map(opt => `<option value="${escapeHtml(opt)}" ${opt===current?'selected':''}>${escapeHtml(categoryOptionLabel(opt))}</option>`).join('')}<option value="nova">+ Nova categoria</option></select></td>`;
    }
    if (kind === 'expense-category') {
      const current = resolveCategoryName(value || 'OUTROS');
      const options = getInlineDespesaCategoryOptions(current);
      return `<td${attrs}><select id="inlineEditor" class="btn" style="padding:6px 8px;font-size:12px" onchange="handleInlineSelectChange(this.value)" onblur="cancelInlineEdit()">${options.map(opt => `<option value="${escapeHtml(opt)}" ${opt===current?'selected':''}>${escapeHtml(categoryOptionLabel(opt))}</option>`).join('')}<option value="nova">+ Nova categoria</option></select></td>`;
    }
    if (kind === 'var-category') {
      const current = resolveCategoryName(value || 'OUTROS');
      const options = getInlineVarCategoryOptions(current);
      return `<td${attrs}><select id="inlineEditor" class="btn" style="padding:6px 8px;font-size:12px" onchange="handleInlineSelectChange(this.value)" onblur="cancelInlineEdit()">${options.map(opt => `<option value="${escapeHtml(opt)}" ${opt===current?'selected':''}>${escapeHtml(categoryOptionLabel(opt))}</option>`).join('')}<option value="nova">+ Nova categoria</option></select></td>`;
    }
    if (kind === 'eso-status') {
      const current = normalizeEsoStatus(value || 'Não fechado');
      const options = getInlineEsoStatusOptions(current);
      return `<td${attrs}><select id="inlineEditor" class="btn" style="padding:6px 8px;font-size:12px" onchange="handleInlineSelectChange(this.value)" onblur="cancelInlineEdit()">${options.map(opt => `<option value="${escapeHtml(opt)}" ${opt===current?'selected':''}>${escapeHtml(opt)}</option>`).join('')}</select></td>`;
    }
    const type = kind === 'number' ? 'number' : 'text';
    const step = kind === 'number' ? ' step="0.01"' : '';
    const extraAttrs = kind === 'var-date' || kind === 'eso-date' ? ' inputmode="numeric" oninput="maskVarDateInput(this)"' : '';
    return `<td${attrs}><input id="inlineEditor" type="${type}"${step}${extraAttrs} value="${escapeHtml(value ?? '')}" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font:inherit" onblur="commitInlineEdit(this.value)" onkeydown="handleInlineEditorKeydown(event)"></td>`;
  }
  return `<td${attrs} ondblclick="startInlineEdit('${table}',${rowArg},'${field}','${kind}')" title="Clique duas vezes para editar">${displayValue}</td>`;
}

function handleInlineSelectChange(value) {
  if (!inlineEditState) return;
  if (value === 'nova') {
    const novoValor = prompt('Nova categoria:', '');
    if (novoValor === null) { cancelInlineEdit(); return; }
    commitInlineEdit(novoValor);
    return;
  }
  commitInlineEdit(value);
}

function applyVarCategoryRename(currentName, renamed) {
  const from = resolveCategoryName((currentName || '').trim());
  const to = resolveCategoryName((renamed || '').trim());
  if (!from || !to || from === to) return false;

  Object.keys(categoryRenameMap).forEach(key => {
    if (resolveCategoryName(categoryRenameMap[key]) === from) {
      categoryRenameMap[key] = to;
    }
  });
  categoryRenameMap[from] = to;
  saveCategoryRenameMap();

  data.forEach(m => {
    if (m.dailyGoals && m.dailyGoals[from] !== undefined) {
      m.dailyGoals[to] = m.dailyGoals[to] !== undefined ? m.dailyGoals[to] : m.dailyGoals[from];
      delete m.dailyGoals[from];
    }
    applyCategoryRenameToMonth(m);
    recalcTotals(m);
  });

  if (metas[from] !== undefined) {
    metas[to] = metas[to] !== undefined ? metas[to] : metas[from];
    delete metas[from];
    saveMetas();
  }

  save();
  return true;
}

function getCurrentMonth() {
  return data.find(m => m.id === currentMonthId) || data[data.length - 1];
}

function normalizeMonthNameToken(value) {
  if (value == null) return '';
  if (typeof value === 'object' || typeof value === 'function') return '';
  const raw = String(value || '').trim().toUpperCase();
  const normalized = raw
    .replace(/MARÃ‡O/g, 'MARÇO')
    .replace(/MARÃ§O/g, 'MARÇO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (normalized === 'MARCO') return 'MARÇO';
  const known = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  return known.includes(normalized) ? (normalized === 'MARCO' ? 'MARÇO' : normalized) : '';
}

function normalizeMonthIdentity(m) {
  if (!m || typeof m !== 'object') return;
  const rawNome = m.nome;
  const rawName = (rawNome == null || typeof rawNome === 'object' || typeof rawNome === 'function')
    ? ''
    : String(rawNome).trim();
  const rawId = (m.id == null || typeof m.id === 'object' || typeof m.id === 'function')
    ? ''
    : String(m.id).trim();
  const parts = rawName.split(/\s+/);
  let monthName = normalizeMonthNameToken(parts[0] || '');
  if (!monthName && rawId) {
    monthName = normalizeMonthNameToken(rawId.split(/[_\s-]+/)[0] || '');
  }
  const idYear = rawId.match(/(19|20)\d{2}$/)?.[0] || rawId.match(/(19|20)\d{2}/)?.[0] || '';
  const nameYear = rawName.match(/(19|20)\d{2}/)?.[0] || '';
  const year = nameYear || idYear;
  if (!monthName || !year) return;
  m.nome = `${monthName} ${year}`;
  m.id = getMonthIdFromParts(monthName, year);
}

function normalizeMonth(m) {
  if (!m || typeof m !== 'object') return null;
  normalizeMonthIdentity(m);
  if (!m.despesas) m.despesas = [];
  if (!m.renda) m.renda = [];
  if (!m.financialGoals) m.financialGoals = [];
  if (!m.projetos) m.projetos = [];
  if (!Array.isArray(m.calendarEvents)) m.calendarEvents = [];
  if (!Array.isArray(m.outflowCards)) m.outflowCards = [];
  if (!Array.isArray(m.outflows)) m.outflows = [];
  if (!Array.isArray(m.cardBills)) m.cardBills = [];
  if (!m.unifiedOutflowUi || typeof m.unifiedOutflowUi !== 'object') m.unifiedOutflowUi = {};
  if (canUseBundledFinanceData()) ensureProjetos(m);
  if (!m.categorias) m.categorias = {};
  if (!m._catOrig) m._catOrig = {...m.categorias};
  if (!m.gastosVar) m.gastosVar = [];
  if (!m.dailyCategorySeeds) m.dailyCategorySeeds = [];
  if (!m.dailyGoals) m.dailyGoals = {};
  if (m.dailyGoalTarget === undefined || m.dailyGoalTarget === null || Number.isNaN(Number(m.dailyGoalTarget))) m.dailyGoalTarget = null;
  if (!Array.isArray(m.dailyGoalManualCats)) m.dailyGoalManualCats = [];
  if (!m.obs) m.obs = '';
  if (typeof ensureDefaultCategoriesInMonth === 'function') ensureDefaultCategoriesInMonth(m);
  if (globalThis.FinanceCalendarEvents?.ensureMonthEvents) {
    globalThis.FinanceCalendarEvents.ensureMonthEvents(m);
  }
  m.despesas = m.despesas.map(d => ({ categoria: 'OUTROS', pago: false, ...d, pago: d?.pago === true }));
  m.renda = (m.renda || []).map(r => ({
    fonte: String(r?.fonte || '').trim(),
    valor: Number(r?.valor || 0) || 0,
    paid: r?.paid === true,
    includeInTotals: r?.includeInTotals !== false,
    patrimonioMovementId: String(r?.patrimonioMovementId || '').trim(),
    dataRecebimento: (r?.recurringFixed !== false)
      ? (normalizeVarDate(String(r?.dataRecebimento || '').trim()) || (typeof getRecurringIncomeReceiveDay === 'function'
        ? getRecurringIncomeReceiveDay(r?.dataRecebimento || '')
        : String(r?.dataRecebimento || '').trim()))
      : (normalizeVarDate(String(r?.dataRecebimento || '').trim()) || ''),
    recurringFixed: r?.recurringFixed !== false,
    recurringGroupId: String(r?.recurringGroupId || '').trim() || `rin_${normalizeIncomeName(r?.fonte || 'RENDA').replace(/[^A-Z0-9]+/g, '_')}`
  }));
  m.projetos = (m.projetos || []).map(p => ({
    ...p,
    nome: String(p?.nome || '').trim(),
    valor: Number(p?.valor || 0) || 0,
    paid: p?.paid === true,
    includeInTotals: p?.includeInTotals !== false,
    patrimonioMovementId: String(p?.patrimonioMovementId || '').trim(),
    dataRecebimento: String(p?.dataRecebimento || '').trim()
  }));
  m.financialGoals = m.financialGoals.map((goal, idx) => ({
    id: goal?.id || `goal_${m.id || 'month'}_${idx}`,
    nome: goal?.nome || goal?.descricao || '',
    valor: Number(goal?.valor || 0),
    includeInTotals: goal?.includeInTotals !== false,
    patrimonioAccountId: goal?.patrimonioAccountId || '',
    patrimonioTransferredAt: goal?.patrimonioTransferredAt || '',
    patrimonioMovementId: goal?.patrimonioMovementId || ''
  }));
  applyExpenseNameRulesToMonth(m);
  applyCategoryRenameToMonth(m);
  applyExpenseCategoryRulesToMonth(m);
  applyExpensePaymentDateRulesToMonth(m);
  // preserve original categories on subsequent loads
  if (!m._catOrig) m._catOrig = {};
  const importedCats = new Set(getImportedCategoriesForMonth(m.id));
  if (importedCats.size) {
    Object.keys(m._catOrig).forEach(cat => {
      if (importedCats.has(cat)) delete m._catOrig[cat];
    });
  }
  if (canUseBundledFinanceData()) ensureImportedBreakdown(m);
  return m;
}

function buildImportedBreakdownEntries(monthId) {
  if (!canUseBundledFinanceData()) return [];
  const source = IMPORTED_BREAKDOWNS[monthId];
  if (!source) return [];
  const entries = [];
  IMPORTED_CATEGORY_ORDER.forEach(cat => {
    (source[cat] || []).forEach((valor, idx) => {
      entries.push({
        titulo: `Cartão + pix ${String(idx + 1).padStart(2, '0')}`,
        valor,
        data: '',
        categoria: resolveCategoryName(cat),
        incluirNoTotal: false,
        importadoDaPlanilha: true
      });
    });
  });
  return entries;
}

function ensureImportedBreakdown(m) {
  if (!m || m._importBreakdownVersion === 1) return;
  const imported = buildImportedBreakdownEntries(m.id);
  if (imported.length) m.gastosVar = [...(m.gastosVar || []), ...imported];
  m._importBreakdownVersion = 1;
}

function getCountedVarTotal(m) {
  return (m.gastosVar || []).reduce((acc, gasto) => acc + (gasto.incluirNoTotal === false ? 0 : gasto.valor), 0);
}

// ============================================================
// NAVIGATION
// ============================================================
function nav(page) {
  if (page === 'eso' && !currentSession?.permissions?.canAccessESO) {
    page = 'dashboard';
  }
  if (typeof closeNotificationsPopover === 'function') closeNotificationsPopover();
  activePage = page;
  if (page === 'mes') {
    if (!currentMonthId || !data.some(month => month?.id === currentMonthId)) {
      currentMonthId = getDefaultMonthId();
    }
    buildMonthSelect();
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.dataset.page === page) n.classList.add('active');
  });
  const sidebarMonthControls = document.getElementById('sidebarMonthControls');
  if (sidebarMonthControls) sidebarMonthControls.style.display = page === 'mes' ? '' : 'none';
  if (page === 'dashboard') renderDashboard();
  else if (page === 'mes') renderMes();
  else if (page === 'patrimonio') renderPatrimonio();
  else if (page === 'historico') renderHistorico();
  else if (page === 'eso') renderEso();
  if (typeof renderNotificationBells === 'function') renderNotificationBells();
  saveUIState();
  restoreScrollPosition();
}

function selectMonth(id) {
  currentMonthId = id;
  if (typeof resetUnifiedOutflowViewForMonth === 'function') {
    resetUnifiedOutflowViewForMonth(id);
  }
  saveUIState();
  const currentPage = document.querySelector('.page.active').id.replace('page-','');
  if (currentPage === 'mes') renderMes();
  else if (currentPage === 'dashboard') renderDashboard();
  else if (currentPage === 'historico') renderHistorico();
  buildMonthSelect();
}

function getMonthIdFromParts(monthName, year) {
  return `${String(monthName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}_${year}`;
}

function formatMonthPickerLabel(month) {
  if (!month) return 'mês';
  const idx = MONTH_INDEX[getMonthName(month)];
  const label = MONTH_LABELS_LONG[idx] || String(getMonthName(month) || '').toLowerCase();
  return `${label} ${getYear(month)}`.toUpperCase();
}

function getCurrentRealMonthId(createIfMissing = false) {
  const now = new Date();
  const monthName = Object.keys(MONTH_INDEX)[now.getMonth()];
  const year = now.getFullYear();
  const id = getMonthIdFromParts(monthName, year);
  const existing = data.find(m => m.id === id);
  if (existing) return existing.id;
  if (!createIfMissing) return getDefaultMonthId();
  return ensureMonthExists(monthName, year).id;
}

function ensureMonthExists(monthName, year) {
  const id = getMonthIdFromParts(monthName, year);
  const existing = data.find(m => m.id === id);
  if (existing) return existing;
  if (typeof isContinuousCalendarEnabled === 'function' && isContinuousCalendarEnabled()) {
    const projected = continuousCalendarSession.virtual(buildBlankMonth(new Date(Number(year), MONTH_INDEX[monthName] ?? 0, 1)));
    data.push(projected);
    sortDataChronologically();
    return projected;
  }
  recordHistoryState();
  const created = typeof buildSmartMonthForSelection === 'function'
    ? buildSmartMonthForSelection(monthName, year)
    : buildBlankMonth(new Date(Number(year), MONTH_INDEX[monthName] ?? 0, 1));
  normalizeMonth(created);
  data.push(created);
  sortDataChronologically();
  save();
  return created;
}

function updateMonthCalendarLabel() {
  const current = getCurrentMonth();
  const fullLabel = formatMonthPickerLabel(current);
  const trigger = document.getElementById('monthPickerLabel');
  if (trigger) trigger.textContent = fullLabel;
  const modalLabel = document.getElementById('monthCalendarCurrentLabel');
  if (modalLabel) modalLabel.textContent = fullLabel.split(' ')[0] || fullLabel;
}

function selectCalendarMonth(monthName, year = monthCalendarYear) {
  const month = ensureMonthExists(monthName, year);
  currentMonthId = month.id;
  saveUIState();
  closeModal('modalMonthCalendar');
  const currentPage = document.querySelector('.page.active')?.id.replace('page-','');
  if (currentPage === 'mes') renderMes();
  else if (currentPage === 'dashboard') renderDashboard();
  else if (currentPage === 'historico') renderHistorico();
  else if (currentPage === 'patrimonio') renderPatrimonio();
  buildMonthSelect();
}

function renderMonthCalendar() {
  const yearLabel = document.getElementById('monthCalendarYearLabel');
  const grid = document.getElementById('monthCalendarGrid');
  if (yearLabel) yearLabel.textContent = String(monthCalendarYear);
  const nowYear = new Date().getFullYear();
  const firstYear = Math.min(nowYear, ...data.map(month => Number(getYear(month))).filter(Number.isFinite));
  const previousYear = document.getElementById('monthCalendarPreviousYear');
  const nextYear = document.getElementById('monthCalendarNextYear');
  if (previousYear) previousYear.disabled = monthCalendarYear <= firstYear;
  if (nextYear) nextYear.disabled = monthCalendarYear >= nowYear + 1;
  if (!grid) return;
  const current = getCurrentMonth();
  const selectedMonthName = getMonthName(current);
  const selectedYear = Number.parseInt(getYear(current), 10);
  const now = new Date();
  grid.innerHTML = Object.keys(MONTH_INDEX).map((monthName, index) => {
    const id = getMonthIdFromParts(monthName, monthCalendarYear);
    const isSelected = selectedMonthName === monthName && selectedYear === monthCalendarYear;
    const isCurrentReal = now.getFullYear() === monthCalendarYear && now.getMonth() === index;
    return `
      <button
        type="button"
        class="month-calendar-cell ${isSelected ? 'is-selected' : ''} ${isCurrentReal ? 'is-current-real' : ''}"
        onclick="selectCalendarMonth('${monthName}', ${monthCalendarYear})"
      >${MONTH_LABELS_SHORT[index]}</button>
    `;
  }).join('');
}

function openMonthCalendar() {
  const current = getCurrentMonth();
  monthCalendarYear = Number.parseInt(getYear(current), 10) || new Date().getFullYear();
  updateMonthCalendarLabel();
  renderMonthCalendar();
  openModal('modalMonthCalendar');
  requestAnimationFrame(positionMonthCalendarNearTrigger);
}

function shiftMonthCalendarYear(delta) {
  const currentYear = new Date().getFullYear();
  const firstYear = Math.min(currentYear, ...data.map(month => Number(getYear(month))).filter(Number.isFinite));
  monthCalendarYear = Math.max(firstYear, Math.min(currentYear + 1, monthCalendarYear + (Number(delta) || 0)));
  renderMonthCalendar();
  requestAnimationFrame(positionMonthCalendarNearTrigger);
}

function selectCurrentRealMonth() {
  const now = new Date();
  monthCalendarYear = now.getFullYear();
  selectCalendarMonth(Object.keys(MONTH_INDEX)[now.getMonth()], monthCalendarYear);
}

function positionMonthCalendarNearTrigger() {
  const modalBg = document.getElementById('modalMonthCalendar');
  const calendar = modalBg?.querySelector('.month-calendar-modal');
  const trigger = document.getElementById('monthPickerTrigger');
  if (!modalBg || !calendar || !trigger) return;
  const triggerRect = trigger.getBoundingClientRect();
  const calendarRect = calendar.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const gap = 10;
  let left = triggerRect.left;
  let top = triggerRect.bottom + gap;
  if (top + calendarRect.height > viewportHeight - 12) {
    top = Math.max(12, triggerRect.top - calendarRect.height - gap);
  }
  if (left + calendarRect.width > viewportWidth - 12) {
    left = Math.max(12, viewportWidth - calendarRect.width - 12);
  }
  calendar.style.left = `${Math.max(12, left)}px`;
  calendar.style.top = `${Math.max(12, top)}px`;
}

function buildMonthSelect() {
  if (typeof ensureContinuousCalendarWindow === 'function') ensureContinuousCalendarWindow();
  const sel = document.getElementById('monthSelect');
  if (!sel) return;
  sel.innerHTML = '';
  [...data].reverse().forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.nome;
    if (m.id === currentMonthId) opt.selected = true;
    sel.appendChild(opt);
  });
  updateMonthCalendarLabel();
}

function getCategoryTotals(m) {
  const totals = {...(m._catOrig || {})};
  const importedCats = new Set(getImportedCategoriesForMonth(m.id));
  (m.despesas || []).forEach(d => {
    const c = d.categoria || 'OUTROS';
    totals[c] = (totals[c] || 0) + d.valor;
  });
  (m.gastosVar || []).forEach(g => {
    const c = g.categoria || 'OUTROS';
    totals[c] = (totals[c] || 0) + g.valor;
  });
  Object.keys(m.categorias || {}).forEach(c => {
    if (importedCats.has(c)) return;
    if (!(c in totals)) totals[c] = m.categorias[c];
  });
  m.categorias = totals;
  return totals;
}

function getVariableCategoryTotals(m) {
  const totals = {};
  (m.dailyCategorySeeds || []).forEach(cat => {
    const resolved = resolveCategoryName(cat || 'OUTROS');
    totals[resolved] = totals[resolved] || 0;
  });
  Object.keys(m.dailyGoals || {}).forEach(cat => {
    const resolved = resolveCategoryName(cat || 'OUTROS');
    totals[resolved] = totals[resolved] || 0;
  });
  (m.gastosVar || []).forEach(g => {
    const c = g.categoria || 'OUTROS';
    totals[c] = (totals[c] || 0) + g.valor;
  });
  return totals;
}

function getAllCategories(m) {
  const set = new Set(Object.keys(m.categorias || {}).concat(Object.keys(m._catOrig || {})));
  (m.gastosVar || []).forEach(g => set.add(g.categoria));
  (m.despesas || []).forEach(d => set.add(d.categoria || 'OUTROS'));
  return Array.from(set);
}

function hasDinheiro(m) {
  return Object.keys(getCategoryTotals(m)).some(k => k.toLowerCase() === 'dinheiro');
}

function isIncomeIncludedInTotals(item) {
  return item?.includeInTotals !== false;
}

function isFinancialGoalIncludedInTotals(item) {
  return item?.includeInTotals !== false;
}

function isProjectIncludedInTotals(item) {
  return item?.includeInTotals !== false;
}

function getTotals(m) {
  if (typeof isUnifiedMonthPilotEnabled === 'function' && isUnifiedMonthPilotEnabled() && typeof ensureUnifiedOutflowPilotMonth === 'function') {
    ensureUnifiedOutflowPilotMonth(m);
  }
  ensureProjetos(m);
  return window.FinancialQuery.totals(m, getFinancialQueryOptions(m));
}

function getFinancialQueryOptions(month, options = {}) {
  return { resolveCategory: resolveCategoryName, isSelected: index => isDespesaSelected(month.id, index), ...options };
}

function getFinancialMonthQuery(month, options = {}) {
  return window.FinancialQuery.query(month, getFinancialQueryOptions(month, options));
}

function ensureDespSelectionState(m) {
  if (!m || !m.id) return [];
  const count = (m.despesas || []).length;
  const current = Array.isArray(despSelectionState[m.id]) ? despSelectionState[m.id].slice(0, count) : [];
  while (current.length < count) current.push(true);
  despSelectionState[m.id] = current;
  return current;
}

function isDespesaSelected(monthId, idx) {
  const state = despSelectionState[monthId];
  return !state || state[idx] !== false;
}

function getSelectedDespesas(m) {
  ensureDespSelectionState(m);
  if (window.FinancialGuards?.getSelectedDespesasRespectingIncludeFlag) {
    return window.FinancialGuards.getSelectedDespesasRespectingIncludeFlag(
      m.despesas || [],
      despSelectionState[m.id] || []
    );
  }
  return (m.despesas || []).filter((despesa, idx) => isDespesaSelected(m.id, idx) && despesa?.entraNaSomatoriaPrincipal !== false);
}

function getSelectedDespesaTotal(m) {
  return getSelectedDespesas(m).reduce((acc, d) => acc + (d.valor || 0), 0);
}

function getEffectiveTotalsForMes(m) {
  return getTotals(m);
}

function computeResultWithTotals(totals, mode) {
  return (window.FinancialQuery.cents(totals.rendaTotal) - window.FinancialQuery.cents(totals.totalGastos)
    - window.FinancialQuery.cents(totals.totalFinancialGoals)) / 100;
}

function computeResult(m, mode) {
  return computeResultWithTotals(getTotals(m), mode);
}

function getYear(m) {
  const parts = String(m?.nome || '').trim().split(' ');
  return parts[parts.length-1];
}

const MONTH_INDEX = {
  'JANEIRO': 0,
  'FEVEREIRO': 1,
  'MARÇO': 2,
  'ABRIL': 3,
  'MAIO': 4,
  'JUNHO': 5,
  'JULHO': 6,
  'AGOSTO': 7,
  'SETEMBRO': 8,
  'OUTUBRO': 9,
  'NOVEMBRO': 10,
  'DEZEMBRO': 11
};
const MONTH_LABELS_SHORT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const MONTH_LABELS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
let monthCalendarYear = new Date().getFullYear();

function getMonthName(m) {
  const parts = (m?.nome || '').trim().split(' ');
  return parts[0] || '';
}

function getMonthSortValue(m) {
  if (window.DashboardRules?.getMonthSortValueFromMonth) {
    return window.DashboardRules.getMonthSortValueFromMonth(m);
  }
  const year = parseInt(getYear(m), 10);
  const monthIndex = MONTH_INDEX[getMonthName(m)] ?? -1;
  return (year * 12) + monthIndex;
}

function getRealCurrentMonthSortValue(referenceDate = new Date()) {
  if (window.DashboardRules?.getRealCurrentMonthSortValue) {
    return window.DashboardRules.getRealCurrentMonthSortValue(referenceDate);
  }
  return (referenceDate.getFullYear() * 12) + referenceDate.getMonth();
}

function isMonthStartedForDashboard(month, referenceDate = new Date()) {
  if (window.DashboardRules?.isMonthStartedForDashboard) {
    return window.DashboardRules.isMonthStartedForDashboard(month, referenceDate);
  }
  return !!month && getMonthSortValue(month) <= getRealCurrentMonthSortValue(referenceDate);
}

function getDashboardEligibleMonths(source = data, referenceDate = new Date()) {
  if (window.DashboardRules?.getDashboardEligibleMonths) {
    return window.DashboardRules.getDashboardEligibleMonths(source || data, referenceDate);
  }
  return (source || []).filter(month => isMonthStartedForDashboard(month, referenceDate));
}

function sortDataChronologically() {
  data.sort((a, b) => getMonthSortValue(a) - getMonthSortValue(b));
}

function labelResult(listOverride = null) {
  const labels = { simples:'Resultado', fixo:'Resultado', final:'Resultado' };
  const baseList = listOverride && listOverride.length ? listOverride : [getCurrentMonth()];
  const hasDin = baseList.some(hasDinheiro);
  if (!hasDin && resultMode === 'final') return labels.fixo;
  return labels[resultMode] || labels.simples;
}

function monthIdToOrder(id) {
  return data.findIndex(m => m.id === id);
}

function getFilteredData() {
  let list = [...data];
  if (periodFilter.type === 'month' && periodFilter.month) {
    const m = data.find(d => d.id === periodFilter.month);
    return m ? [m] : list.slice(-1);
  }
  if (periodFilter.type === 'year' && periodFilter.year) {
    list = list.filter(m => getYear(m) === periodFilter.year);
  } else if (periodFilter.type === 'range' && periodFilter.start && periodFilter.end) {
    const startIdx = monthIdToOrder(periodFilter.start);
    const endIdx = monthIdToOrder(periodFilter.end);
    if (startIdx !== -1 && endIdx !== -1) {
      const [a,b] = [Math.min(startIdx,endIdx), Math.max(startIdx,endIdx)];
      list = data.slice(a, b+1);
    }
  }
  return list;
}

function getCatTotalsPeriod(list, basis = 'commitments') {
  const totals = {};
  list.forEach(m => {
    getFinancialMonthQuery(m, { basis }).categories.forEach(row => {
      totals[row.category] = (totals[row.category] || 0) + row.amountCents;
    });
  });
  return Object.fromEntries(Object.entries(totals).map(([category, amount]) => [category, amount / 100]));
}

function changeResultMode(val) {
  if (resultMode !== val) {
    recordHistoryState();
  }
  resultMode = val;
  Storage.setText(STORAGE_KEYS.resultMode, resultMode);
  dashSeriesSelection = getDashSeriesSelectionForMode(resultMode);
  saveDashSeriesSelection();
  saveUIState();
  renderAll();
}

function buildResultSelect(id, listOverride = null) {
  const sel = document.getElementById(id);
  if (!sel) return;
  if (isPrimaryUserEnvironment()) {
    sel.style.display = 'none';
    sel.innerHTML = '';
    return;
  }
  const baseList = listOverride || getFilteredData();
  const hasDin = (baseList && baseList.length ? baseList : [getCurrentMonth()]).some(hasDinheiro);
  const effectiveMode = (!hasDin && resultMode === 'final') ? 'fixo' : resultMode;
  const options = [
    {v:'simples', t:'Resultado'},
    {v:'fixo', t:'Resultado'},
    ...(hasDin ? [{v:'final', t:'Resultado final'}] : [])
  ];
  sel.innerHTML = options.map(o => `<option value="${o.v}" ${effectiveMode===o.v?'selected':''}>${o.t}</option>`).join('');
}

function buildPeriodControls(containerId='dashFilters', resultId='resultModeSel') {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const showResultSelect = false;
  const monthSource = containerId === 'dashFilters' ? getDashboardEligibleMonths(data) : data;
  const fallbackSource = monthSource.length ? monthSource : data;
  const monthOpts = fallbackSource.slice().reverse().map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
  wrap.innerHTML = `
    <select id="periodType" class="btn" style="padding:8px 10px;font-size:12px" onchange="onPeriodTypeChange(this.value)">
      <option value="all">Todo o histórico</option>
      <option value="month">Por mês</option>
      <option value="year">Por ano</option>
      <option value="range">Intervalo</option>
    </select>
    <select id="periodMonth" class="btn" style="padding:8px 10px;font-size:12px;display:none" onchange="setPeriodMonth(this.value)">${monthOpts}</select>
    <select id="periodYear" class="btn" style="padding:8px 10px;font-size:12px;display:none" onchange="setPeriodYear(this.value)">
      ${Array.from(new Set(fallbackSource.map(getYear))).map(y=>`<option value="${y}">${y}</option>`).join('')}
    </select>
    <select id="periodStart" class="btn" style="padding:8px 10px;font-size:12px;display:none" onchange="setPeriodRange()">${monthOpts}</select>
    <select id="periodEnd" class="btn" style="padding:8px 10px;font-size:12px;display:none" onchange="setPeriodRange()">${monthOpts}</select>
    ${showResultSelect ? `<select id="${resultId}" class="btn" style="padding:8px 10px;font-size:12px" onchange="changeResultMode(this.value)"></select>` : ''}
  `;
  document.getElementById('periodType').value = periodFilter.type;
  document.getElementById('periodMonth').value = periodFilter.month;
  document.getElementById('periodYear').value = periodFilter.year;
  document.getElementById('periodStart').value = periodFilter.start || currentMonthId;
  document.getElementById('periodEnd').value = periodFilter.end || currentMonthId;
  if (showResultSelect) buildResultSelect(resultId);
  togglePeriodInputs();
}

function togglePeriodInputs() {
  const t = periodFilter.type;
  ['periodMonth','periodYear','periodStart','periodEnd'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display='none';
  });
  if (t === 'month') {
    document.getElementById('periodMonth').style.display='';
  }
  if (t === 'year') document.getElementById('periodYear').style.display='';
  if (t === 'range') {
    document.getElementById('periodStart').style.display='';
    document.getElementById('periodEnd').style.display='';
  }
}

function onPeriodTypeChange(val) {
  periodFilter.type = val;
  if (val === 'year') {
    const years = Array.from(document.getElementById('periodYear')?.options || [], option => option.value);
    if (!years.includes(String(periodFilter.year || ''))) {
      periodFilter.year = years[years.length - 1] || '';
    } else {
      periodFilter.year = String(periodFilter.year);
    }
  }
  togglePeriodInputs();
  saveUIState();
  renderAll();
}
function setPeriodMonth(v) { periodFilter.month = v; saveUIState(); renderAll(); }
function setPeriodYear(v) { periodFilter.year = v; saveUIState(); renderAll(); }
function setPeriodRange() {
  periodFilter.start = document.getElementById('periodStart').value;
  periodFilter.end = document.getElementById('periodEnd').value;
  saveUIState();
  renderAll();
}
function periodLabel() {
  if (periodFilter.type === 'all') return 'todo o histórico';
  if (periodFilter.type === 'month') {
    const m = data.find(d => d.id === periodFilter.month);
    return m ? m.nome : 'mês selecionado';
  }
  if (periodFilter.type === 'year') return `ano ${periodFilter.year}`;
  if (periodFilter.type === 'range') {
    const start = data.find(d => d.id === periodFilter.start)?.nome || 'início';
    const end = data.find(d => d.id === periodFilter.end)?.nome || 'fim';
    return `${start} – ${end}`;
  }
  return '';
}

function renderTitles() {
  const ids = {
    'title-despesas': 'despesas',
    'title-renda': 'renda',
    'title-goals': 'goals',
    'title-projetos': 'projetos',
    'title-patrimonio-accounts': 'patrimonioAccounts',
    'title-patrimonio-evolution': 'patrimonioEvolution',
    'title-patrimonio-distribution': 'patrimonioDistribution',
    'title-patrimonio-forecasts': 'patrimonioForecasts',
    'title-patrimonio-history': 'patrimonioHistory',
    'title-variaveis': 'variaveis',
    'title-daily': 'daily',
    'chartTitleGVSR': 'gvsr',
    'chartTitleRes': 'resultchart',
    'title-catdash': 'catdash',
    'title-quickhist': 'quickhist'
  };
  Object.entries(ids).forEach(([el, key]) => {
    const node = document.getElementById(el);
    if (!node) return;
    const text = sectionTitles[key] || '';
    if (titleEditKey === key) {
      node.innerHTML = `<input id="titleInlineEditor" value="${escapeHtml(text)}" style="width:min(280px, 55vw);padding:6px 8px;border:1px solid var(--border);border-radius:6px;font:inherit;text-transform:uppercase;letter-spacing:.08em" onblur="commitTitleEdit(this.value)" onkeydown="handleTitleEditorKeydown(event)">`;
      node.setAttribute('data-editable', 'true');
      requestAnimationFrame(() => {
        const editor = document.getElementById('titleInlineEditor');
        if (editor) { editor.focus(); editor.select(); }
      });
    } else {
      node.textContent = text;
      node.setAttribute('data-editable', 'true');
      node.ondblclick = () => startTitleEdit(key);
      node.title = 'Clique duas vezes para editar';
    }
  });
  const dashTitle = document.querySelector('#page-dashboard h2');
  if (dashTitle) dashTitle.textContent = 'Dashboard';
}

function startTitleEdit(key) {
  titleEditKey = key;
  renderTitles();
}

function commitTitleEdit(value) {
  if (!titleEditKey) return;
  const next = String(value || '').trim();
  if (!next) { cancelTitleEdit(); return; }
  if ((sectionTitles[titleEditKey] || '') !== next) {
    recordHistoryState();
  }
  sectionTitles[titleEditKey] = next;
  Storage.setJSON(STORAGE_KEYS.titles, sectionTitles);
  saveUIState();
  titleEditKey = null;
  renderTitles();
}

function cancelTitleEdit() {
  if (!titleEditKey) return;
  titleEditKey = null;
  renderTitles();
}

function handleTitleEditorKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitTitleEdit(event.target.value);
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelTitleEdit();
  }
}

let activeFormHelpTarget = null;

function getFormHelpTooltip() {
  return document.getElementById('formHelpTooltip');
}

function positionFormHelpTooltip(target) {
  const tooltip = getFormHelpTooltip();
  if (!tooltip || !target || tooltip.getAttribute('aria-hidden') === 'true') return;
  const rect = target.getBoundingClientRect();
  const margin = 10;
  const width = tooltip.offsetWidth || 280;
  const height = tooltip.offsetHeight || 0;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  let left = rect.left;
  if (left + width > viewportWidth - margin) left = viewportWidth - width - margin;
  if (left < margin) left = margin;

  let top = rect.bottom + 10;
  let below = false;
  if (top + height > viewportHeight - margin) {
    top = Math.max(margin, rect.top - height - 10);
    below = true;
  }

  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
  tooltip.classList.toggle('is-below', below);
}

function showFormHelpTooltip(target) {
  if (!target) return;
  const text = String(target.getAttribute('data-help') || '').trim();
  const tooltip = getFormHelpTooltip();
  if (!tooltip || !text) return;
  activeFormHelpTarget = target;
  tooltip.textContent = text;
  tooltip.setAttribute('aria-hidden', 'false');
  tooltip.classList.add('is-visible');
  requestAnimationFrame(() => positionFormHelpTooltip(target));
}

function hideFormHelpTooltip() {
  const tooltip = getFormHelpTooltip();
  activeFormHelpTarget = null;
  if (!tooltip) return;
  tooltip.classList.remove('is-visible', 'is-below');
  tooltip.setAttribute('aria-hidden', 'true');
}

function findFormHelpTarget(node) {
  if (!node || typeof node.closest !== 'function') return null;
  return node.closest('.form-help-label[data-help], .month-copy-toggle.form-help-label[data-help], .help-tooltip-target[data-help]');
}

document.addEventListener('mouseover', event => {
  const target = findFormHelpTarget(event.target);
  if (!target) return;
  if (target === activeFormHelpTarget) return;
  showFormHelpTooltip(target);
});

document.addEventListener('mouseout', event => {
  const target = findFormHelpTarget(event.target);
  if (!target || target !== activeFormHelpTarget) return;
  const related = findFormHelpTarget(event.relatedTarget);
  if (related === target) return;
  hideFormHelpTooltip();
});

document.addEventListener('focusin', event => {
  const target = findFormHelpTarget(event.target);
  if (target) showFormHelpTooltip(target);
});

document.addEventListener('focusout', event => {
  const target = findFormHelpTarget(event.target);
  if (target && target === activeFormHelpTarget) hideFormHelpTooltip();
});

window.addEventListener('scroll', () => {
  if (activeFormHelpTarget) positionFormHelpTooltip(activeFormHelpTarget);
}, true);

window.addEventListener('resize', () => {
  if (activeFormHelpTarget) positionFormHelpTooltip(activeFormHelpTarget);
});
