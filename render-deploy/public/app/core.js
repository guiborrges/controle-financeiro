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
  if (table === 'projeto') return m.projetos[row];
  if (table === 'varItem') return m.gastosVar[row];
  if (table === 'eso') return (esoData || []).find(item => item.id === row) || null;
  return null;
}

function getInlineDespesaCategoryOptions(currentCat) {
  const base = ['DESPESA FIXA', 'DESPESA VARIÁVEL'];
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
    if (kind === 'expense-category') {
      const current = resolveCategoryName(value || 'OUTROS');
      const options = getInlineDespesaCategoryOptions(current);
      return `<td${attrs}><select id="inlineEditor" class="btn" style="padding:6px 8px;font-size:12px" onchange="handleInlineSelectChange(this.value)" onblur="cancelInlineEdit()">${options.map(opt => `<option value="${escapeHtml(opt)}" ${opt===current?'selected':''}>${escapeHtml(opt)}</option>`).join('')}<option value="nova">+ Nova categoria</option></select></td>`;
    }
    if (kind === 'var-category') {
      const current = resolveCategoryName(value || 'OUTROS');
      const options = getInlineVarCategoryOptions(current);
      return `<td${attrs}><select id="inlineEditor" class="btn" style="padding:6px 8px;font-size:12px" onchange="handleInlineSelectChange(this.value)" onblur="cancelInlineEdit()">${options.map(opt => `<option value="${escapeHtml(opt)}" ${opt===current?'selected':''}>${escapeHtml(opt)}</option>`).join('')}<option value="nova">+ Nova categoria</option></select></td>`;
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

function normalizeMonth(m) {
  if (!m.despesas) m.despesas = [];
  if (!m.renda) m.renda = [];
  if (!m.projetos) m.projetos = [];
  if (canUseBundledFinanceData()) ensureProjetos(m);
  if (!m.categorias) m.categorias = {};
  if (!m._catOrig) m._catOrig = {...m.categorias};
  if (!m.gastosVar) m.gastosVar = [];
  if (!m.dailyCategorySeeds) m.dailyCategorySeeds = [];
  if (!m.dailyGoals) m.dailyGoals = {};
  if (!m.obs) m.obs = '';
  m.despesas = m.despesas.map(d => ({ categoria: 'OUTROS', pago: false, ...d, pago: d?.pago === true }));
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
  activePage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.textContent.trim().toLowerCase().includes(page === 'dashboard' ? 'dashboard' :
        page === 'mes' ? 'atual' : page === 'historico' ? 'hist' : 'eso')) n.classList.add('active');
  });
  const sidebarMonthControls = document.getElementById('sidebarMonthControls');
  if (sidebarMonthControls) sidebarMonthControls.style.display = page === 'mes' ? '' : 'none';
  if (page === 'dashboard') renderDashboard();
  else if (page === 'mes') renderMes();
  else if (page === 'historico') renderHistorico();
  else if (page === 'eso') renderEso();
  saveUIState();
  restoreScrollPosition();
}

function selectMonth(id) {
  currentMonthId = id;
  saveUIState();
  const currentPage = document.querySelector('.page.active').id.replace('page-','');
  if (currentPage === 'mes') renderMes();
  else if (currentPage === 'dashboard') renderDashboard();
  else if (currentPage === 'historico') renderHistorico();
  buildMonthSelect();
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

// ============================================================
// FORMAT
// ============================================================
function fmt(n) {
  return 'R$ ' + Math.abs(n).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtSigned(n) {
  return (n < 0 ? '- ' : '+ ') + fmt(n);
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

function getTotals(m) {
  ensureProjetos(m);
  const totalVar = getCountedVarTotal(m);
  const totalFixas = (m.despesas || []).reduce((a,d)=>a+d.valor,0);
  const totalGastos = totalFixas;
  const rendaFixa = (m.renda || []).reduce((a,r)=>a+r.valor,0);
  const totalProj = (m.projetos || []).reduce((a,p)=>a+p.valor,0);
  const rendaTotal = rendaFixa + totalProj;
  const catTotals = getCategoryTotals(m);
  const dinheiroVal = 0;
  return { totalVar, totalFixas, totalGastos, rendaFixa, totalProj, rendaTotal, catTotals, dinheiroVal };
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
  return (m.despesas || []).filter((_, idx) => isDespesaSelected(m.id, idx));
}

function getSelectedDespesaTotal(m) {
  return getSelectedDespesas(m).reduce((acc, d) => acc + (d.valor || 0), 0);
}

function getEffectiveTotalsForMes(m) {
  const totals = getTotals(m);
  const totalFixas = getSelectedDespesaTotal(m);
  const totalGastos = totalFixas;
  const dinheiroVal = 0;
  const activeMode = isPrimaryUserEnvironment() ? resultMode : 'simples';
  return {
    ...totals,
    totalFixas,
    totalGastos,
    rendaTotal: totals.rendaFixa + totals.totalProj,
    resultadoMes: computeResultWithTotals({ ...totals, totalFixas, totalGastos, rendaTotal: totals.rendaFixa + totals.totalProj, dinheiroVal }, activeMode)
  };
}

function computeResultWithTotals(totals, mode) {
  const hasDin = totals.dinheiroVal > 0;
  const effectiveMode = (mode === 'final' && !hasDin) ? 'fixo' : mode;
  if (effectiveMode === 'simples') return totals.rendaTotal - totals.totalGastos;
  if (effectiveMode === 'fixo') return totals.rendaFixa - totals.totalGastos;
  return totals.rendaFixa - (totals.totalGastos - totals.dinheiroVal);
}

function computeResult(m, mode) {
  return computeResultWithTotals(getTotals(m), mode);
}

function getYear(m) {
  const parts = m.nome.trim().split(' ');
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

function getMonthName(m) {
  const parts = (m?.nome || '').trim().split(' ');
  return parts[0] || '';
}

function getMonthSortValue(m) {
  const year = parseInt(getYear(m), 10);
  const monthIndex = MONTH_INDEX[getMonthName(m)] ?? -1;
  return (year * 12) + monthIndex;
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
  if (!isPrimaryUserEnvironment()) return 'Resultado';
  const labels = { simples:'Resultado com eso', fixo:'Resultado apenas azione', final:'Resultado final' };
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
    const cats = getVariableCategoryTotals(m);
    Object.entries(cats).forEach(([k,v]) => totals[k] = (totals[k] || 0) + v);
  });
  return totals;
}

function changeResultMode(val) {
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
  const baseList = listOverride || getFilteredData();
  const hasDin = (baseList && baseList.length ? baseList : [getCurrentMonth()]).some(hasDinheiro);
  const effectiveMode = (!hasDin && resultMode === 'final') ? 'fixo' : resultMode;
  const options = [
    {v:'simples', t:'Resultado com eso'},
    {v:'fixo', t:'Resultado apenas azione'},
    ...(hasDin ? [{v:'final', t:'Resultado final'}] : [])
  ];
  sel.innerHTML = options.map(o => `<option value="${o.v}" ${effectiveMode===o.v?'selected':''}>${o.t}</option>`).join('');
}

function buildPeriodControls(containerId='dashFilters', resultId='resultModeSel') {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const showResultSelect = isPrimaryUserEnvironment();
  const monthOpts = data.slice().reverse().map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
  wrap.innerHTML = `
    <select id="periodType" class="btn" style="padding:8px 10px;font-size:12px" onchange="onPeriodTypeChange(this.value)">
      <option value="all">Todo o histórico</option>
      <option value="month">Por mês</option>
      <option value="year">Por ano</option>
      <option value="range">Intervalo</option>
    </select>
    <input type="month" id="periodMonthReal" class="btn" style="padding:8px 10px;font-size:12px;display:none" onchange="setPeriodMonthReal(this.value)">
    <select id="periodMonth" class="btn" style="padding:8px 10px;font-size:12px;display:none" onchange="setPeriodMonth(this.value)">${monthOpts}</select>
    <select id="periodYear" class="btn" style="padding:8px 10px;font-size:12px;display:none" onchange="setPeriodYear(this.value)">
      ${Array.from(new Set(data.map(getYear))).map(y=>`<option value="${y}">${y}</option>`).join('')}
    </select>
    <select id="periodStart" class="btn" style="padding:8px 10px;font-size:12px;display:none" onchange="setPeriodRange()">${monthOpts}</select>
    <select id="periodEnd" class="btn" style="padding:8px 10px;font-size:12px;display:none" onchange="setPeriodRange()">${monthOpts}</select>
    <input type="month" id="periodStartReal" class="btn" style="padding:8px 10px;font-size:12px;display:none" onchange="setPeriodRangeReal()">
    <input type="month" id="periodEndReal" class="btn" style="padding:8px 10px;font-size:12px;display:none" onchange="setPeriodRangeReal()">
    ${showResultSelect ? `<select id="${resultId}" class="btn" style="padding:8px 10px;font-size:12px" onchange="changeResultMode(this.value)"></select>` : ''}
  `;
  document.getElementById('periodType').value = periodFilter.type;
  document.getElementById('periodMonth').value = periodFilter.month;
  document.getElementById('periodYear').value = periodFilter.year;
  document.getElementById('periodStart').value = periodFilter.start || currentMonthId;
  document.getElementById('periodEnd').value = periodFilter.end || currentMonthId;
  document.getElementById('periodMonthReal').value = '';
  document.getElementById('periodStartReal').value = '';
  document.getElementById('periodEndReal').value = '';
  if (showResultSelect) buildResultSelect(resultId);
  togglePeriodInputs();
}

function togglePeriodInputs() {
  const t = periodFilter.type;
  ['periodMonth','periodYear','periodStart','periodEnd','periodMonthReal','periodStartReal','periodEndReal'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display='none';
  });
  if (t === 'month') {
    document.getElementById('periodMonth').style.display='';
    const real = document.getElementById('periodMonthReal'); if (real) real.style.display='';
  }
  if (t === 'year') document.getElementById('periodYear').style.display='';
  if (t === 'range') {
    document.getElementById('periodStart').style.display='';
    document.getElementById('periodEnd').style.display='';
    document.getElementById('periodStartReal').style.display='';
    document.getElementById('periodEndReal').style.display='';
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
    'title-projetos': 'projetos',
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
  sectionTitles[titleEditKey] = next;
  Storage.setJSON(STORAGE_KEYS.titles, sectionTitles);
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
  sectionTitles = {
    despesas: document.getElementById('titleInpDesp').value || 'Despesas',
    renda: document.getElementById('titleInpRenda').value || 'Renda fixa',
    projetos: document.getElementById('titleInpProj').value || defaultProjetosTitle,
    variaveis: document.getElementById('titleInpVar').value || 'Gastos variáveis',
    daily: document.getElementById('titleInpDaily').value || 'Gastos diários',
    gvsr: document.getElementById('titleInpGvsr').value || 'Gastos vs Renda',
    resultchart: document.getElementById('titleInpRes').value || 'Resultado por mês',
    catdash: document.getElementById('titleInpCatDash').value || 'Categorias',
    quickhist: document.getElementById('titleInpQuick').value || 'Histórico rápido'
  };
  Storage.setJSON(STORAGE_KEYS.titles, sectionTitles);
  renderTitles();
  closeModal('modalTitles');
}
