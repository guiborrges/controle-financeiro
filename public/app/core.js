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
  const base = ['DESPESA', 'GASTO'];
  const current = resolveCategoryName(currentCat || 'OUTROS');
  if (!base.includes(current)) base.unshift(current);
  return Array.from(new Set(base));
}

function getVariableCategoryOptions(m) {
  const totals = getVariableCategoryTotals(m || {});
  const options = new Set(Object.keys(totals || {}).map(resolveCategoryName).filter(Boolean));
  (m?.gastosVar || []).forEach(g => options.add(resolveCategoryName(g.categoria || 'OUTROS')));
  (m?.dailyCategorySeeds || []).forEach(cat => options.add(resolveCategoryName(cat || 'OUTROS')));
  return Array.from(options).sort((a, b) => a.localeCompare(b, 'pt-BR'));
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
      const icon = typeof inferCategoryVisual === 'function'
        ? String(inferCategoryVisual(name)?.icon || '🏷️')
        : '🏷️';
      return `${icon} ${name}`;
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
  const rawName = String(m.nome || '').trim();
  const parts = rawName.split(/\s+/);
  const monthName = normalizeMonthNameToken(parts[0] || '');
  const idYear = String(m.id || '').match(/(19|20)\d{2}$/)?.[0] || '';
  const nameYear = rawName.match(/(19|20)\d{2}/)?.[0] || '';
  const year = nameYear || idYear;
  if (!monthName || !year) return;
  m.nome = `${monthName} ${year}`;
  m.id = getMonthIdFromParts(monthName, year);
}

function normalizeMonth(m) {
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
      ? (typeof getRecurringIncomeReceiveDay === 'function'
        ? getRecurringIncomeReceiveDay(r?.dataRecebimento || '')
        : String(r?.dataRecebimento || '').trim())
      : (normalizeVarDate(String(r?.dataRecebimento || '').trim()) || ''),
    recurringFixed: r?.recurringFixed !== false,
    recurringGroupId: String(r?.recurringGroupId || '').trim() || `rin_${normalizeIncomeName(r?.fonte || 'RENDA').replace(/[^A-Z0-9]+/g, '_')}`
  }));
  m.projetos = (m.projetos || []).map(p => ({
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
    currentMonthId = getCurrentRealMonthId(true);
    buildMonthSelect();
    window.__rotateMonthMessage = true;
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
  if (!grid) return;
  const current = getCurrentMonth();
  const selectedMonthName = getMonthName(current);
  const selectedYear = Number.parseInt(getYear(current), 10);
  const now = new Date();
  grid.innerHTML = Object.keys(MONTH_INDEX).map((monthName, index) => {
    const id = getMonthIdFromParts(monthName, monthCalendarYear);
    const exists = data.some(m => m.id === id);
    const isSelected = selectedMonthName === monthName && selectedYear === monthCalendarYear;
    const isCurrentReal = now.getFullYear() === monthCalendarYear && now.getMonth() === index;
    return `
      <button
        type="button"
        class="month-calendar-cell ${exists ? 'is-existing' : ''} ${isSelected ? 'is-selected' : ''} ${isCurrentReal ? 'is-current-real' : ''}"
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
  monthCalendarYear += Number(delta) || 0;
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

function deleteCurrentMonth() {
  if (!currentMonthId) return;
  if (data.length <= 1) {
    alert('Você precisa manter pelo menos um mês cadastrado.');
    return;
  }
  const current = getCurrentMonth();
  if (!current) return;
  if (!confirm(`Excluir o mês ${current.nome}?`)) return;

  recordHistoryState();
  const currentIndex = data.findIndex(m => m.id === currentMonthId);
  data = data.filter(m => m.id !== currentMonthId);
  const nextMonth = data[currentIndex] || data[currentIndex - 1] || data[data.length - 1];
  currentMonthId = nextMonth?.id || getDefaultMonthId();
  save();
  buildMonthSelect();
  renderAll();
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
  const totalVar = getCountedVarTotal(m);
  const totalFixas = (m.despesas || []).reduce((a,d)=>a+d.valor,0);
  const totalGastos = totalFixas + totalVar;
  const rendaFixa = (m.renda || []).reduce((a,r)=>a+(isIncomeIncludedInTotals(r) ? r.valor : 0),0);
  const totalFinancialGoals = (m.financialGoals || []).reduce((a, goal) => a + (isFinancialGoalIncludedInTotals(goal) ? (goal.valor || 0) : 0), 0);
  const totalProj = (m.projetos || []).reduce((a,p)=>a+(isProjectIncludedInTotals(p) ? p.valor : 0),0);
  const rendaTotal = rendaFixa + totalProj;
  const catTotals = getCategoryTotals(m);
  const dinheiroVal = 0;
  return {
    totalVar,
    totalFixas,
    totalGastos,
    rendaFixa,
    totalFinancialGoals,
    totalProj,
    rendaTotal,
    availableForVariableSpending: rendaTotal - totalFixas - totalFinancialGoals,
    catTotals,
    dinheiroVal
  };
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
  const totals = getTotals(m);
  const totalFixas = getSelectedDespesaTotal(m);
  const totalVar = getCountedVarTotal(m);
  const totalGastos = totalFixas + totalVar;
  const dinheiroVal = 0;
  const activeMode = isPrimaryUserEnvironment() ? resultMode : 'simples';
  return {
    ...totals,
    totalFixas,
    totalVar,
    totalGastos,
    rendaTotal: totals.rendaFixa + totals.totalProj,
    availableForVariableSpending: (totals.rendaFixa + totals.totalProj) - totalFixas - totals.totalFinancialGoals,
    resultadoMes: computeResultWithTotals({ ...totals, totalFixas, totalGastos, rendaTotal: totals.rendaFixa + totals.totalProj, dinheiroVal }, activeMode)
  };
}

function computeResultWithTotals(totals, mode) {
  const hasDin = totals.dinheiroVal > 0;
  const effectiveMode = (mode === 'final' && !hasDin) ? 'fixo' : mode;
  const totalGoals = Number(totals.totalFinancialGoals || 0);
  if (effectiveMode === 'simples') return totals.rendaTotal - totals.totalGastos - totalGoals;
  if (effectiveMode === 'fixo') return totals.rendaFixa - totals.totalGastos - totalGoals;
  return totals.rendaFixa - (totals.totalGastos - totals.dinheiroVal) - totalGoals;
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

function getNextMonthInfo(baseMonth) {
  const monthName = getMonthName(baseMonth);
  const year = parseInt(getYear(baseMonth), 10);
  const monthIndex = MONTH_INDEX[monthName];
  if (monthIndex === undefined || Number.isNaN(year)) {
    const now = new Date();
    return { monthName: Object.keys(MONTH_INDEX)[now.getMonth()], year: now.getFullYear() };
  }
  const nextIndex = (monthIndex + 1) % 12;
  const nextYear = year + (monthIndex === 11 ? 1 : 0);
  const nextMonthName = Object.keys(MONTH_INDEX).find(name => MONTH_INDEX[name] === nextIndex) || 'JANEIRO';
  return { monthName: nextMonthName, year: nextYear };
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

function getCatTotalsPeriod(list) {
  const totals = {};
  list.forEach(m => {
    // Build category totals from current valid transactional state only.
    // This avoids stale/"ghost" categories that may remain in cached aggregates.
    const hasUnifiedOutflows = Array.isArray(m?.outflows) && m.outflows.length > 0;
    if (hasUnifiedOutflows) {
      (m.outflows || []).forEach(item => {
        const amount = Number(item?.amount || 0);
        if (!(amount > 0)) return;
        const category = resolveCategoryName(item?.category || 'OUTROS');
        if (typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(category)) return;
        if (!category) return;
        totals[category] = (totals[category] || 0) + amount;
      });
      return;
    }

    (m.despesas || []).forEach(item => {
      const amount = Number(item?.valor || 0);
      if (!(amount > 0)) return;
      const category = resolveCategoryName(item?.categoria || 'OUTROS');
      if (typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(category)) return;
      if (!category) return;
      totals[category] = (totals[category] || 0) + amount;
    });
    (m.gastosVar || []).forEach(item => {
      if (item?.incluirNoTotal === false) return;
      const amount = Number(item?.valor || 0);
      if (!(amount > 0)) return;
      const category = resolveCategoryName(item?.categoria || 'OUTROS');
      if (typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(category)) return;
      if (!category) return;
      totals[category] = (totals[category] || 0) + amount;
    });
  });
  return totals;
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
  togglePeriodInputs();
  saveUIState();
  renderAll();
}
function setPeriodMonth(v) { periodFilter.month = v; saveUIState(); renderAll(); }
function setPeriodMonthReal(v) { // yyyy-mm
  if (!v) return;
  const [y,m] = v.split('-');
  const match = data.find(d => d.nome.toLowerCase().includes(`${mesesPT(m)} ${y}`.toLowerCase()));
  if (match) periodFilter.month = match.id;
  saveUIState();
  renderAll();
}
function setPeriodYear(v) { periodFilter.year = v; saveUIState(); renderAll(); }
function setPeriodRange() {
  periodFilter.start = document.getElementById('periodStart').value;
  periodFilter.end = document.getElementById('periodEnd').value;
  saveUIState();
  renderAll();
}
function setPeriodRangeReal() {
  const s = document.getElementById('periodStartReal').value;
  const e = document.getElementById('periodEndReal').value;
  if (s) {
    const [ys,ms] = s.split('-');
    const matchS = data.find(d => d.nome.toLowerCase().includes(`${mesesPT(ms)} ${ys}`.toLowerCase()));
    if (matchS) periodFilter.start = matchS.id;
  }
  if (e) {
    const [ye,me] = e.split('-');
    const matchE = data.find(d => d.nome.toLowerCase().includes(`${mesesPT(me)} ${ye}`.toLowerCase()));
    if (matchE) periodFilter.end = matchE.id;
  }
  saveUIState();
  renderAll();
}

function mesesPT(mNumStr) {
  const idx = parseInt(mNumStr,10)-1;
  const arr = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return arr[idx] || '';
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

function openTitles() {
  const defaultProjetosTitle = isPrimaryUserEnvironment() ? 'Projetos / entradas extras' : 'Renda extra';
  document.getElementById('titleInpDesp').value = sectionTitles.despesas;
  document.getElementById('titleInpRenda').value = sectionTitles.renda;
  document.getElementById('titleInpGoals').value = sectionTitles.goals || 'Metas financeiras';
  document.getElementById('titleInpProj').value = sectionTitles.projetos || defaultProjetosTitle;
  document.getElementById('titleInpVar').value = sectionTitles.variaveis;
  document.getElementById('titleInpDaily').value = sectionTitles.daily;
  document.getElementById('titleInpGvsr').value = sectionTitles.gvsr;
  document.getElementById('titleInpRes').value = sectionTitles.resultchart;
  document.getElementById('titleInpCatDash').value = sectionTitles.catdash;
  document.getElementById('titleInpQuick').value = sectionTitles.quickhist;
  openModal('modalTitles');
}

function saveTitles() {
  const defaultProjetosTitle = isPrimaryUserEnvironment() ? 'Projetos / entradas extras' : 'Renda extra';
  const nextTitles = {
    despesas: document.getElementById('titleInpDesp').value || 'Despesas',
    renda: document.getElementById('titleInpRenda').value || 'Renda fixa',
    goals: document.getElementById('titleInpGoals').value || 'Metas financeiras',
    projetos: document.getElementById('titleInpProj').value || defaultProjetosTitle,
    variaveis: document.getElementById('titleInpVar').value || 'Gastos variáveis',
    daily: document.getElementById('titleInpDaily').value || 'Gastos diários',
    gvsr: document.getElementById('titleInpGvsr').value || 'Gastos vs Renda',
    resultchart: document.getElementById('titleInpRes').value || 'Resultado por período selecionado',
    catdash: document.getElementById('titleInpCatDash').value || 'Categorias',
    quickhist: document.getElementById('titleInpQuick').value || 'Histórico rápido'
  };
  if (JSON.stringify(sectionTitles || {}) !== JSON.stringify(nextTitles)) {
    recordHistoryState();
  }
  sectionTitles = nextTitles;
  Storage.setJSON(STORAGE_KEYS.titles, sectionTitles);
  saveUIState();
  renderTitles();
  closeModal('modalTitles');
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
