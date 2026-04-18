// ============================================================
// MÊS ATUAL
// ============================================================
function renderMes() {
  const m = getCurrentMonth();
  const projetosTitle = sectionTitles.projetos || (isPrimaryUserEnvironment() ? 'Projetos / entradas extras' : 'Renda extra');
  normalizeMonth(m);
  ensureDespSelectionState(m);
  updateHistoryButtons();
  document.getElementById('mesTitle').textContent = m.nome;
  const mesResultSelect = document.getElementById('mesResultSelect');
  if (isPrimaryUserEnvironment()) {
    if (mesResultSelect) mesResultSelect.style.display = '';
    buildResultSelect('mesResultSelect', [m]);
  } else if (mesResultSelect) {
    mesResultSelect.style.display = 'none';
  }
  renderTitles();
  applyMonthSectionThemes();
  const obsEl = document.getElementById('obsField');
  if (obsEl) obsEl.value = m.obs || '';
  renderDaily();

  const totals = getEffectiveTotalsForMes(m);
  const totalFixas = totals.totalFixas;
  const totalRenda = totals.rendaFixa;
  const totalDesp = totals.totalGastos;
  const resultado = totals.resultadoMes;
  monthMetricOrder = sanitizeMonthMetricOrder(monthMetricOrder);
  saveMonthMetricOrder();

  const metricCards = {
    resultado: `
    <div class="metric-card ${resultado>=0?'month-result-pos':'month-result-neg'}" draggable="true" data-metric-key="resultado" ondragstart="onMonthMetricDragStart(event,'resultado')" ondragend="onMonthMetricDragEnd()" ondragover="onMonthMetricDragOver(event)" ondragleave="onMonthMetricDragLeave(event)" ondrop="onMonthMetricDrop(event,'resultado')">
      <div class="mc-label">${labelResult([m])}</div>
      <div class="mc-value">${fmtSigned(resultado)}</div>
    </div>`,
    gastos: `
    <div class="metric-card month-desp" draggable="true" data-metric-key="gastos" ondragstart="onMonthMetricDragStart(event,'gastos')" ondragend="onMonthMetricDragEnd()" ondragover="onMonthMetricDragOver(event)" ondragleave="onMonthMetricDragLeave(event)" ondrop="onMonthMetricDrop(event,'gastos')">
      <div class="mc-label">Total despesas</div>
      <div class="mc-value">${fmt(totalDesp)}</div>
    </div>`,
    renda: `
    <div class="metric-card month-renda" draggable="true" data-metric-key="renda" ondragstart="onMonthMetricDragStart(event,'renda')" ondragend="onMonthMetricDragEnd()" ondragover="onMonthMetricDragOver(event)" ondragleave="onMonthMetricDragLeave(event)" ondrop="onMonthMetricDrop(event,'renda')">
      <div class="mc-label">${escapeHtml(sectionTitles.renda || 'Renda fixa')}</div>
      <div class="mc-value">${fmt(totals.rendaFixa)}</div>
    </div>`,
    projetos: `
    <div class="metric-card month-proj" draggable="true" data-metric-key="projetos" ondragstart="onMonthMetricDragStart(event,'projetos')" ondragend="onMonthMetricDragEnd()" ondragover="onMonthMetricDragOver(event)" ondragleave="onMonthMetricDragLeave(event)" ondrop="onMonthMetricDrop(event,'projetos')">
      <div class="mc-label">${escapeHtml(projetosTitle)}</div>
      <div class="mc-value">${fmt(totals.totalProj)}</div>
    </div>`
  };
  document.getElementById('mesMetrics').innerHTML = monthMetricOrder.map(key => metricCards[key]).join('');
  buildDespCategoriaFiltro(m);

  // Despesas table
  updateDespTableHeaders();
  const despBody = document.getElementById('despBody');
  const despesasOrdenadas = getSortedDespesas(m);
  despBody.innerHTML = despesasOrdenadas.length === 0
    ? '<tr><td colspan="7" style="padding:20px 22px;color:var(--text3)">Nenhuma despesa registrada.</td></tr>'
    : despesasOrdenadas.map(({ item: d, idx: realIdx }) => `
      <tr>
        <td style="padding-left:22px"><input type="checkbox" ${isDespesaSelected(m.id, realIdx) ? 'checked' : ''} onchange="toggleDespesaSelection(${realIdx})"></td>
        ${renderInlineCell({ table:'despesa', row:realIdx, field:'nome', kind:'text', value:d.nome, displayValue:escapeHtml(d.nome) })}
        ${renderInlineCell({ table:'despesa', row:realIdx, field:'valor', kind:'number', value:d.valor, displayValue:fmt(d.valor), className:'amount amount-neg' })}
        ${renderInlineCell({ table:'despesa', row:realIdx, field:'data', kind:'text', value:d.data||'', displayValue:escapeHtml(d.data||'—'), className:'text-muted', style:'font-size:12px' })}
        ${renderInlineCell({ table:'despesa', row:realIdx, field:'categoria', kind:'expense-category', value:d.categoria||'OUTROS', displayValue:escapeHtml(d.categoria||'OUTROS'), className:'text-muted', style:'font-size:12px' })}
        <td class="expense-paid-cell ${d.pago ? 'is-paid' : ''}">
          <label style="display:inline-flex;align-items:center;cursor:pointer">
            <input class="expense-paid-toggle" type="checkbox" ${d.pago ? 'checked' : ''} onchange="toggleDespesaPaid(${realIdx})">
            <span>Pago</span>
          </label>
        </td>
        <td>
          <button class="btn-icon" onclick="deleteItem('despesa',${realIdx})">✕</button>
        </td>
      </tr>`).join('');
  document.getElementById('despTotal').textContent = fmt(getDespTotalExibido(m, despesasOrdenadas));
  updateDespPaidAllToggle(m);

  // Renda table
  updateRendaTableHeaders();
  const rendaBody = document.getElementById('rendaBody');
  const rendaOrdenada = getSortedRenda(m);
  rendaBody.innerHTML = rendaOrdenada.length === 0
    ? '<tr><td colspan="3" style="padding:20px 22px;color:var(--text3)">Nenhuma renda registrada.</td></tr>'
    : rendaOrdenada.map(({ item: r, idx: realIdx }) => `
      <tr>
        ${renderInlineCell({ table:'renda', row:realIdx, field:'fonte', kind:'text', value:r.fonte, displayValue:escapeHtml(r.fonte), style:'padding-left:22px' })}
        ${renderInlineCell({ table:'renda', row:realIdx, field:'valor', kind:'number', value:r.valor, displayValue:fmt(r.valor), className:'amount amount-pos' })}
        <td>
          <button class="btn-icon" onclick="deleteItem('renda',${realIdx})">✕</button>
        </td>
      </tr>`).join('');
  document.getElementById('rendaTotal').textContent = fmt(totalRenda);

  // Projetos table
  updateProjTableHeaders();
  const projBody = document.getElementById('projBody');
  const projList = Array.isArray(m.projetos) ? m.projetos : [];
  const projOrdenado = getSortedProjetos(projList);
  projBody.innerHTML = projOrdenado.length === 0
    ? '<tr><td colspan="3" style="padding:20px 22px;color:var(--text3)">Nenhum projeto registrado.</td></tr>'
    : projOrdenado.map(({ item: p, idx: realIdx }) => `
      <tr>
        ${renderInlineCell({ table:'projeto', row:realIdx, field:'nome', kind:'text', value:p.nome, displayValue:escapeHtml(p.nome), style:'padding-left:22px' })}
        ${renderInlineCell({ table:'projeto', row:realIdx, field:'valor', kind:'number', value:p.valor, displayValue:fmt(p.valor), className:'amount', style:'color:var(--blue)' })}
        <td>
          <button class="btn-icon" onclick="deleteItem('projeto',${realIdx})">✕</button>
        </td>
      </tr>`).join('');
  document.getElementById('projTotal').textContent = fmt(projList.reduce((a,p)=>a+p.valor,0));

  // Categorias
  renderCatGrid();
  applyMonthSectionCollapseStates();
}

function applyMonthSectionThemes() {
  [
    { id: 'section-despesas', key: 'despesas' },
    { id: 'section-daily', key: 'daily' },
    { id: 'section-renda', key: 'renda' },
    { id: 'section-projetos', key: 'projetos' },
    { id: 'section-observacoes', key: 'observacoes' }
  ].forEach(({ id, key }) => {
    const section = document.getElementById(id);
    if (!section) return;
    const color = getMonthSectionColor(key);
    section.classList.add('section-theme-custom');
    section.style.setProperty('--section-bg', `linear-gradient(180deg, ${hexToRgba(color, 0.06)} 0%, ${hexToRgba(color, 0.02)} 100%)`);
    section.style.setProperty('--section-border-color', hexToRgba(color, 0.22));
    section.style.setProperty('--section-head-bg', `linear-gradient(180deg, ${hexToRgba(color, 0.08)} 0%, ${hexToRgba(color, 0.03)} 100%)`);
    section.style.setProperty('--section-table-head-bg', `linear-gradient(180deg, ${hexToRgba(color, 0.08)} 0%, ${hexToRgba(color, 0.03)} 100%)`);
    section.style.setProperty('--section-table-row-bg', hexToRgba(color, 0.025));
    section.style.setProperty('--section-table-hover-bg', hexToRgba(color, 0.08));
    section.style.setProperty('--section-table-foot-bg', `linear-gradient(180deg, ${hexToRgba(color, 0.05)} 0%, ${hexToRgba(color, 0.02)} 100%)`);
    section.style.setProperty('--section-title-color', color);
  });
}

function getMonthSectionCollapseState() {
  return Storage.getJSON(STORAGE_KEYS.monthSectionCollapsed, {}) || {};
}

function isMonthSectionCollapsed(key) {
  const state = getMonthSectionCollapseState();
  return state[key] === true;
}

function toggleMonthSectionCollapse(key) {
  const state = getMonthSectionCollapseState();
  state[key] = !state[key];
  Storage.setJSON(STORAGE_KEYS.monthSectionCollapsed, state);
  flushServerStorage(true);
  renderMes();
}

function applyMonthSectionCollapseStates() {
  [
    { id: 'section-despesas', key: 'despesas' },
    { id: 'section-daily', key: 'daily' },
    { id: 'section-renda', key: 'renda' },
    { id: 'section-projetos', key: 'projetos' },
    { id: 'section-observacoes', key: 'observacoes' }
  ].forEach(({ id, key }) => {
    const section = document.getElementById(id);
    const toggle = document.getElementById(`toggle-section-${key}`);
    if (!section || !toggle) return;
    const collapsed = isMonthSectionCollapsed(key);
    section.classList.toggle('is-collapsed', collapsed);
    toggle.textContent = collapsed ? '+' : '−';
    toggle.title = collapsed ? 'Maximizar quadro' : 'Minimizar quadro';
  });
}

function buildDespCategoriaFiltro(m) {
  const select = document.getElementById('despCategoriaFiltro');
  if (!select) return;
  const categorias = Array.from(new Set((m.despesas || []).map(d => (d.categoria || 'OUTROS')))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (despCategoriaFiltro !== 'TODAS' && !categorias.includes(despCategoriaFiltro)) {
    despCategoriaFiltro = 'TODAS';
  }
  select.innerHTML = `<option value="TODAS">Todas</option>${categorias.map(cat => `<option value="${cat}" ${cat===despCategoriaFiltro?'selected':''}>${cat}</option>`).join('')}`;
}

function getDespTotalExibido(m, despesasOrdenadas = null) {
  ensureDespSelectionState(m);
  if (despCategoriaFiltro === 'TODAS') {
    return (m.despesas || []).reduce((acc, d, idx) => acc + (isDespesaSelected(m.id, idx) ? d.valor : 0), 0);
  }
  const rows = despesasOrdenadas || getSortedDespesas(m);
  return rows.reduce((acc, row) => acc + (isDespesaSelected(m.id, row.idx) ? row.item.valor : 0), 0);
}

function toggleDespesaSelection(idx) {
  const m = getCurrentMonth();
  const state = ensureDespSelectionState(m);
  state[idx] = state[idx] === false ? true : false;
  renderMes();
}

function toggleDespesaPaid(idx) {
  const m = getCurrentMonth();
  if (!m?.despesas?.[idx]) return;
  recordHistoryState();
  m.despesas[idx].pago = m.despesas[idx].pago === true ? false : true;
  save(true);
  renderMes();
}

function updateDespPaidAllToggle(m) {
  const toggle = document.getElementById('despPaidAllToggle');
  if (!toggle) return;
  const despesas = Array.isArray(m?.despesas) ? m.despesas : [];
  if (!despesas.length) {
    toggle.checked = false;
    toggle.indeterminate = false;
    toggle.disabled = true;
    return;
  }
  const paidCount = despesas.filter(d => d?.pago === true).length;
  toggle.disabled = false;
  toggle.checked = paidCount === despesas.length;
  toggle.indeterminate = paidCount > 0 && paidCount < despesas.length;
}

function toggleAllDespesasPaid(checked) {
  const m = getCurrentMonth();
  if (!Array.isArray(m?.despesas) || !m.despesas.length) return;
  const nextValue = checked === true;
  const hasChange = m.despesas.some(d => (d?.pago === true) !== nextValue);
  if (!hasChange) {
    renderMes();
    return;
  }
  recordHistoryState();
  m.despesas = m.despesas.map(d => ({ ...d, pago: nextValue }));
  save(true);
  renderMes();
}

function getSortedDespesas(m) {
  let rows = (m.despesas || []).map((item, idx) => ({ item, idx }));
  if (despCategoriaFiltro !== 'TODAS') {
    rows = rows.filter(({ item }) => (item.categoria || 'OUTROS') === despCategoriaFiltro);
  }
  if (!despSort.field) return rows;
  const factor = despSort.direction === 'desc' ? -1 : 1;
  return rows.sort((a, b) => {
    if (despSort.field === 'valor') {
      return (a.item.valor - b.item.valor) * factor;
    }
    if (despSort.field === 'data') {
      const diff = parseData(a.item.data || '') - parseData(b.item.data || '');
      if (diff !== 0) return diff * factor;
      return a.item.nome.localeCompare(b.item.nome, 'pt-BR') * factor;
    }
    if (despSort.field === 'categoria') {
      const catDiff = (a.item.categoria || 'OUTROS').localeCompare(b.item.categoria || 'OUTROS', 'pt-BR');
      if (catDiff !== 0) return catDiff * factor;
      return a.item.nome.localeCompare(b.item.nome, 'pt-BR') * factor;
    }
    return a.item.nome.localeCompare(b.item.nome, 'pt-BR') * factor;
  });
}

function updateDespTableHeaders() {
  const table = document.getElementById('despTable');
  if (!table) return;
  const labels = {
    nome: 'Descrição',
    valor: 'Valor',
    data: 'Data pag.',
    categoria: 'Categoria'
  };
  table.querySelectorAll('th.sortable').forEach(th => {
    const onclick = th.getAttribute('onclick') || '';
    const match = onclick.match(/setDespSort\('([^']+)'\)/);
    const field = match ? match[1] : '';
    const arrow = despSort.field === field ? (despSort.direction === 'asc' ? ' ▲' : ' ▼') : '';
    th.textContent = `${labels[field] || th.textContent.replace(/[ ▲▼]+$/,'')}${arrow}`;
  });
}

function getSortedRenda(m) {
  const rows = (m.renda || []).map((item, idx) => ({ item, idx }));
  if (!rendaSort.field) return rows;
  const factor = rendaSort.direction === 'desc' ? -1 : 1;
  return rows.sort((a, b) => {
    if (rendaSort.field === 'valor') return (a.item.valor - b.item.valor) * factor;
    return (a.item.fonte || '').localeCompare(b.item.fonte || '', 'pt-BR') * factor;
  });
}

function updateRendaTableHeaders() {
  const table = document.getElementById('rendaTable');
  if (!table) return;
  const labels = { fonte: 'Fonte', valor: 'Valor' };
  table.querySelectorAll('th.sortable').forEach(th => {
    const onclick = th.getAttribute('onclick') || '';
    const match = onclick.match(/setRendaSort\('([^']+)'\)/);
    const field = match ? match[1] : '';
    const arrow = rendaSort.field === field ? (rendaSort.direction === 'asc' ? ' ▲' : ' ▼') : '';
    th.textContent = `${labels[field] || th.textContent.replace(/[ ▲▼]+$/,'')}${arrow}`;
  });
}

function setRendaSort(field) {
  if (rendaSort.field === field) {
    rendaSort.direction = rendaSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    rendaSort = { field, direction: 'asc' };
  }
  renderMes();
}

function getSortedProjetos(projList) {
  const rows = (projList || []).map((item, idx) => ({ item, idx }));
  if (!projSort.field) return rows;
  const factor = projSort.direction === 'desc' ? -1 : 1;
  return rows.sort((a, b) => {
    if (projSort.field === 'valor') return (a.item.valor - b.item.valor) * factor;
    return (a.item.nome || '').localeCompare(b.item.nome || '', 'pt-BR') * factor;
  });
}

function updateProjTableHeaders() {
  const table = document.getElementById('projTable');
  if (!table) return;
  const labels = { nome: 'Descrição', valor: 'Valor' };
  table.querySelectorAll('th.sortable').forEach(th => {
    const onclick = th.getAttribute('onclick') || '';
    const match = onclick.match(/setProjSort\('([^']+)'\)/);
    const field = match ? match[1] : '';
    const arrow = projSort.field === field ? (projSort.direction === 'asc' ? ' ▲' : ' ▼') : '';
    th.textContent = `${labels[field] || th.textContent.replace(/[ ▲▼]+$/,'')}${arrow}`;
  });
}

function setProjSort(field) {
  if (projSort.field === field) {
    projSort.direction = projSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    projSort = { field, direction: 'asc' };
  }
  renderMes();
}

function setDespSort(field) {
  if (despSort.field === field) {
    despSort.direction = despSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    despSort = { field, direction: 'asc' };
  }
  renderMes();
}

function setDespCategoriaFiltro(cat) {
  despCategoriaFiltro = cat || 'TODAS';
  renderMes();
}

// Totais de categorias apenas das despesas fixas
function getFixedCategoryTotals(m) {
  const totals = {};
  (m.despesas || []).forEach(d => {
    const c = (d.categoria || 'OUTROS').toUpperCase();
    totals[c] = (totals[c] || 0) + d.valor;
  });
  return totals;
}

function renderCatGrid() {
  const m = getCurrentMonth();
  const cats = getVariableCategoryTotals(m);
  const keys = Object.keys(cats);
  const total = keys.reduce((a,k)=>a+(cats[k]||0),0);
  const grid = document.getElementById('catGrid');
  if (keys.length === 0) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><span>📊</span><p>Adicione categorias de gastos variáveis para rastrear onde seu dinheiro vai.</p></div>';
    return;
  }
  grid.innerHTML = keys.map(k => {
    const meta = metas[k];
    const pct = meta ? Math.min((cats[k]/meta)*100, 100) : null;
    const over = meta && cats[k] > meta;
    return `
      <div class="cat-item" style="flex-direction:column;align-items:flex-start;gap:6px">
        <div style="display:flex;align-items:center;gap:8px;width:100%">
          <div class="cat-dot" style="background:${CAT_COLORS[k]||'#95a5a6'}"></div>
          <span style="font-size:12px;font-weight:500;flex:1">${k}</span>
          <span style="font-size:13px;font-weight:600;color:${over?'var(--red)':'var(--text)'}">${fmt(cats[k])}</span>
          <button class="btn-icon" onclick="deleteCat('${k}')">✕</button>
        </div>
        ${meta ? `
          <div style="width:100%">
            <div class="progress-wrap">
              <div class="progress-bar" style="width:${pct}%;background:${over?'var(--red)':CAT_COLORS[k]||'#27ae60'}"></div>
            </div>
            <div style="font-size:11px;color:${over?'var(--red)':'var(--text3)'};margin-top:3px">
              ${over?'⚠ ':''}Meta: ${fmt(meta)} · ${pct.toFixed(0)}% usado
            </div>
          </div>
        ` : `<div style="font-size:11px;color:var(--text3)">${((cats[k]/total)*100).toFixed(1)}% do total variável</div>`}
      </div>`;
  }).join('');
}

// ============================================================
// ADD / EDIT / DELETE ITEMS
// ============================================================
function openAddItem(type) {
  editingItem = null;
  editingType = type;
  const titles = {despesa:'Adicionar despesa', renda:'Adicionar renda', projeto:'Adicionar projeto/entrada'};
  document.getElementById('modalItemTitle').textContent = titles[type];
  buildItemForm(type, null);
  openModal('modalItem');
}

function editItem(type, idx) {
  editingType = type;
  editingItem = idx;
  const m = getCurrentMonth();
  const arr = type === 'despesa' ? m.despesas : type === 'renda' ? m.renda : m.projetos;
  const item = arr[idx];
  const titles = {despesa:'Editar despesa', renda:'Editar renda', projeto:'Editar projeto/entrada'};
  document.getElementById('modalItemTitle').textContent = titles[type];
  buildItemForm(type, item);
  openModal('modalItem');
}

function buildItemForm(type, item) {
  const f = document.getElementById('modalItemForm');
  if (type === 'despesa') {
    const cats = ['DESPESA FIXA', 'DESPESA VARIÁVEL'];
    f.innerHTML = `
      <div class="form-row">
        <div class="field"><label>Descrição</label><input id="fi_nome" value="${item?item.nome:''}" placeholder="ex: NUBANK"></div>
        <div class="field"><label>Valor (R$)</label><input id="fi_valor" type="number" step="0.01" value="${item?item.valor:''}" placeholder="0,00"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Data pagamento (opcional)</label><input id="fi_data" value="${item&&item.data?item.data:''}" placeholder="ex: 10"></div>
        <div class="field"><label>Categoria</label>
          <select id="fi_cat" onchange="toggleDespNovaCat()">
            ${cats.map(c=>`<option ${item&&item.categoria===c?'selected':''}>${c}</option>`).join('') || '<option>OUTROS</option>'}
            <option value="nova">+ Nova categoria</option>
          </select>
        </div>
      </div>
      <div class="field" id="fi_cat_nova_wrap" style="display:none"><label>Nova categoria</label><input id="fi_cat_nova" placeholder="Nome da categoria"></div>`;
  } else if (type === 'renda') {
    f.innerHTML = `
      <div class="form-row">
        <div class="field"><label>Fonte</label><input id="fi_nome" value="${item?item.fonte:''}" placeholder="ex: SALÁRIO"></div>
        <div class="field"><label>Valor (R$)</label><input id="fi_valor" type="number" step="0.01" value="${item?item.valor:''}" placeholder="0,00"></div>
      </div>`;
  } else {
    f.innerHTML = `
      <div class="form-row">
        <div class="field"><label>Descrição</label><input id="fi_nome" value="${item?item.nome:''}" placeholder="ex: Cliente X"></div>
        <div class="field"><label>Valor (R$)</label><input id="fi_valor" type="number" step="0.01" value="${item?item.valor:''}" placeholder="0,00"></div>
      </div>`;
  }
}

function applyDespesaUpdate(m, obj, previousName = '', editingIndex = null) {
  const categoria = resolveCategoryName(obj.categoria || 'OUTROS');
  const data_val = obj.data || '';
  const normalizedNome = normalizeExpenseName(obj.nome);
  const normalizedPreviousName = normalizeExpenseName(previousName);
  const mCats = getAllCategories(m);
  if (!mCats.includes(categoria)) m.categorias[categoria] = 0;

  const nextObj = { nome: obj.nome, valor: obj.valor, categoria, data: data_val };
  if (editingIndex !== null) m.despesas[editingIndex] = nextObj;
  else {
    m.despesas.push(nextObj);
    const state = ensureDespSelectionState(m);
    state[m.despesas.length - 1] = true;
  }

  if (normalizedPreviousName && normalizedPreviousName !== normalizedNome) {
    Object.keys(expenseNameRenameMap).forEach(key => {
      if (normalizeExpenseName(expenseNameRenameMap[key]) === normalizedPreviousName) {
        expenseNameRenameMap[key] = obj.nome;
      }
    });
    expenseNameRenameMap[normalizedPreviousName] = obj.nome;
    if (expenseCategoryRules[normalizedPreviousName] !== undefined && expenseCategoryRules[normalizedNome] === undefined) {
      expenseCategoryRules[normalizedNome] = expenseCategoryRules[normalizedPreviousName];
    }
    if (expensePaymentDateRules[normalizedPreviousName] !== undefined && expensePaymentDateRules[normalizedNome] === undefined) {
      expensePaymentDateRules[normalizedNome] = expensePaymentDateRules[normalizedPreviousName];
    }
    delete expenseCategoryRules[normalizedPreviousName];
    delete expensePaymentDateRules[normalizedPreviousName];
    saveExpenseNameRenameMap();
  }

  expenseCategoryRules[normalizedNome] = categoria;
  expensePaymentDateRules[normalizedNome] = data_val;
  saveExpenseCategoryRules();
  saveExpensePaymentDateRules();

  data.forEach(month => {
    applyExpenseNameRulesToMonth(month);
    applyExpenseCategoryRulesToMonth(month);
    applyExpensePaymentDateRulesToMonth(month);
    recalcTotals(month);
  });
  save();
}

function saveItem() {
  const nome = document.getElementById('fi_nome').value.trim();
  const valor = parseFloat(document.getElementById('fi_valor').value);
  if (!nome || isNaN(valor) || valor <= 0) { alert('Preencha todos os campos corretamente.'); return; }
  recordHistoryState();
  const m = getCurrentMonth();
  if (editingType === 'despesa') {
    const previousName = editingItem !== null && m.despesas[editingItem] ? m.despesas[editingItem].nome : '';
    const data_val = document.getElementById('fi_data')?.value || '';
    let cat = document.getElementById('fi_cat')?.value || 'OUTROS';
    if (cat === 'nova') cat = document.getElementById('fi_cat_nova').value.trim() || 'OUTROS';
    applyDespesaUpdate(m, { nome, valor, categoria: cat, data: data_val }, previousName, editingItem);
  } else if (editingType === 'renda') {
    const previousFonte = editingItem !== null && m.renda[editingItem] ? m.renda[editingItem].fonte : '';
    const obj = {fonte: nome, valor};
    if (editingItem !== null) m.renda[editingItem] = obj;
    else m.renda.push(obj);
    const normalizedPreviousFonte = normalizeIncomeName(previousFonte);
    const normalizedFonte = normalizeIncomeName(nome);
    if (normalizedPreviousFonte && normalizedPreviousFonte !== normalizedFonte) {
      Object.keys(incomeNameRenameMap).forEach(key => {
        if (normalizeIncomeName(incomeNameRenameMap[key]) === normalizedPreviousFonte) {
          incomeNameRenameMap[key] = nome;
        }
      });
      incomeNameRenameMap[normalizedPreviousFonte] = nome;
      saveIncomeNameRenameMap();
    }
  } else {
    const obj = {nome, valor};
    if (editingItem !== null) m.projetos[editingItem] = obj;
    else m.projetos.push(obj);
    m._projectSource = 'manual';
  }
  recalcTotals(m);
  save();
  closeModal('modalItem');
  renderMes();
}

function commitInlineEdit(rawValue) {
  if (!inlineEditState) return;
  const { table, row, field } = inlineEditState;
  const m = getCurrentMonth();
  const item = getInlineItem(table, row);
  if (table !== 'daily' && !item) { inlineEditState = null; table === 'eso' ? renderEso() : renderMes(); return; }

  let changed = false;
  recordHistoryState();

  if (table === 'despesa') {
    const next = { ...item };
    if (field === 'nome') {
      const nome = String(rawValue || '').trim();
      if (!nome) { undoStack.pop(); cancelInlineEdit(); return; }
      next.nome = nome;
    } else if (field === 'valor') {
      const valor = parseFloat(rawValue);
      if (isNaN(valor) || valor <= 0) { undoStack.pop(); cancelInlineEdit(); return; }
      next.valor = valor;
    } else if (field === 'data') {
      next.data = String(rawValue || '').trim();
    } else if (field === 'categoria') {
      const categoria = String(rawValue || '').trim();
      if (!categoria) { undoStack.pop(); cancelInlineEdit(); return; }
      next.categoria = categoria;
    }
    changed = JSON.stringify(next) !== JSON.stringify(item);
    if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
    applyDespesaUpdate(m, next, item.nome, row);
  } else if (table === 'renda') {
    if (field === 'fonte') {
      const fonte = String(rawValue || '').trim();
      if (!fonte) { undoStack.pop(); cancelInlineEdit(); return; }
      changed = fonte !== item.fonte;
      if (changed) {
        const previousFonte = item.fonte;
        const normalizedPreviousFonte = normalizeIncomeName(previousFonte);
        const normalizedFonte = normalizeIncomeName(fonte);
        if (normalizedPreviousFonte && normalizedPreviousFonte !== normalizedFonte) {
          Object.keys(incomeNameRenameMap).forEach(key => {
            if (normalizeIncomeName(incomeNameRenameMap[key]) === normalizedPreviousFonte) {
              incomeNameRenameMap[key] = fonte;
            }
          });
          incomeNameRenameMap[normalizedPreviousFonte] = fonte;
          saveIncomeNameRenameMap();
        }
      }
      item.fonte = fonte;
    } else if (field === 'valor') {
      const valor = parseFloat(rawValue);
      if (isNaN(valor) || valor <= 0) { undoStack.pop(); cancelInlineEdit(); return; }
      changed = valor !== item.valor;
      item.valor = valor;
    }
    if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
    recalcTotals(m);
    save();
  } else if (table === 'projeto') {
    if (field === 'nome') {
      const nome = String(rawValue || '').trim();
      if (!nome) { undoStack.pop(); cancelInlineEdit(); return; }
      changed = nome !== item.nome;
      item.nome = nome;
    } else if (field === 'valor') {
      const valor = parseFloat(rawValue);
      if (isNaN(valor) || valor <= 0) { undoStack.pop(); cancelInlineEdit(); return; }
      changed = valor !== item.valor;
      item.valor = valor;
    }
    if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
    recalcTotals(m);
    save();
  } else if (table === 'daily') {
    if (field === 'categoria') {
      const categoria = String(rawValue || '').trim().toUpperCase();
      if (!categoria) { undoStack.pop(); cancelInlineEdit(); return; }
      changed = categoria !== String(row || '').trim().toUpperCase();
      if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
      if (!applyVarCategoryRename(String(row || ''), categoria)) {
        undoStack.pop();
        cancelInlineEdit();
        return;
      }
    } else if (field === 'meta') {
      if (!m.dailyGoals) m.dailyGoals = {};
      const categoriaAtual = String(row || '').trim();
      const texto = String(rawValue ?? '').trim();
      if (!texto) {
        changed = m.dailyGoals[categoriaAtual] !== undefined;
        if (changed) delete m.dailyGoals[categoriaAtual];
      } else {
        const meta = parseFloat(texto);
        if (isNaN(meta) || meta <= 0) { undoStack.pop(); cancelInlineEdit(); return; }
        changed = m.dailyGoals[categoriaAtual] !== meta;
        m.dailyGoals[categoriaAtual] = meta;
      }
      if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
      save();
    }
  } else if (table === 'varItem') {
    const next = { ...item };
    if (field === 'titulo') {
      const titulo = String(rawValue || '').trim();
      if (!titulo) { undoStack.pop(); cancelInlineEdit(); return; }
      next.titulo = titulo;
    } else if (field === 'valor') {
      const valor = parseFloat(rawValue);
      if (isNaN(valor) || valor <= 0) { undoStack.pop(); cancelInlineEdit(); return; }
      next.valor = valor;
    } else if (field === 'data') {
      const dataNormalizada = normalizeVarDate(rawValue);
      if (!dataNormalizada) {
        undoStack.pop();
        alert('Use a data no formato dd/mm/aa ou dd/mm/aaaa.');
        cancelInlineEdit();
        return;
      }
      next.data = dataNormalizada;
    } else if (field === 'categoria') {
      const categoria = resolveCategoryName(String(rawValue || '').trim());
      if (!categoria) { undoStack.pop(); cancelInlineEdit(); return; }
      next.categoria = categoria;
    }
    changed = JSON.stringify(next) !== JSON.stringify(item);
    if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
    Object.assign(item, next);
    if (!m.categorias) m.categorias = {};
    if (!(item.categoria in m.categorias)) m.categorias[item.categoria] = 0;
    if (!Array.isArray(m.dailyCategorySeeds)) m.dailyCategorySeeds = [];
    if (!m.dailyCategorySeeds.includes(item.categoria)) m.dailyCategorySeeds.push(item.categoria);
    recalcTotals(m);
    save();
  } else if (table === 'eso') {
    const next = { ...item };
    if (field === 'data') {
      const dataNormalizada = normalizeVarDate(rawValue);
      if (!dataNormalizada) { undoStack.pop(); cancelInlineEdit(); return; }
      next.data = dataNormalizada;
    } else if (field === 'cliente') {
      const cliente = String(rawValue || '').trim();
      if (!cliente) { undoStack.pop(); cancelInlineEdit(); return; }
      next.cliente = cliente;
    } else if (field === 'tipo') {
      const tipo = String(rawValue || '').trim();
      if (!tipo) { undoStack.pop(); cancelInlineEdit(); return; }
      next.tipo = tipo;
    } else if (field === 'valor') {
      const valor = parseFloat(rawValue);
      if (isNaN(valor) || valor <= 0) { undoStack.pop(); cancelInlineEdit(); return; }
      next.valor = valor;
    } else if (field === 'entrada') {
      const entrada = String(rawValue || '').trim();
      if (!entrada) { undoStack.pop(); cancelInlineEdit(); return; }
      next.entrada = entrada;
    } else if (field === 'status') {
      next.status = normalizeEsoStatus(rawValue);
    }
    changed = JSON.stringify(next) !== JSON.stringify(item);
    if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
    const idx = esoData.findIndex(entry => entry.id === item.id);
    if (idx === -1) { undoStack.pop(); cancelInlineEdit(); return; }
    esoData[idx] = normalizeEsoEntry(next, idx);
    saveEsoData();
  }

  inlineEditState = null;
  if (table === 'varItem') {
    buildVarSelects();
    renderMes();
    renderVarTable();
    return;
  }
  if (table === 'eso') {
    renderEso();
    return;
  }
  renderMes();
}

function deleteItem(type, idx) {
  if (!confirm('Remover este item?')) return;
  recordHistoryState();
  const m = getCurrentMonth();
  if (type === 'despesa') {
    m.despesas.splice(idx, 1);
    const state = ensureDespSelectionState(m);
    state.splice(idx, 1);
  }
  else if (type === 'renda') m.renda.splice(idx, 1);
  else {
    m.projetos.splice(idx, 1);
    m._projectSource = 'manual';
  }
  recalcTotals(m);
  save();
  renderMes();
}

function recalcTotals(m) {
  const varTotal = getCountedVarTotal(m);
  m.total_gastos = parseFloat(m.despesas.reduce((a,d)=>a+d.valor,0).toFixed(2));
  m.total_renda = parseFloat(m.renda.reduce((a,r)=>a+r.valor,0).toFixed(2));
  const totalProj = parseFloat(m.projetos.reduce((a,p)=>a+p.valor,0).toFixed(2));
  m.resultado = parseFloat((m.total_renda + totalProj - m.total_gastos).toFixed(2));
  m.categorias = getCategoryTotals(m);
}

// ============================================================
// CATEGORIAS
// ============================================================
function openAddCat() {
  openModal('modalCat');
  document.getElementById('modalCatTitle').textContent = 'Adicionar categoria';
}

function saveCat() {
  const cat = document.getElementById('catNome').value;
  if (!cat) { alert('Informe o nome da categoria'); return; }
  recordHistoryState();
  const m = getCurrentMonth();
  if (!m.categorias) m.categorias = {};
  if (!(cat in m.categorias)) m.categorias[cat] = 0;
  save();
  closeModal('modalCat');
  renderCatGrid();
}

function deleteCat(cat) {
  if (!confirm(`Remover categoria ${cat}?`)) return;
  recordHistoryState();
  const m = getCurrentMonth();
  delete m.categorias[cat];
  save();
  renderCatGrid();
}

function openVarModal(mode) {
  varModalMode = mode || 'view';
  const m = getCurrentMonth();
  normalizeMonth(m);
  buildVarSelects();
  renderVarTable();
  const addWrap = document.getElementById('varAddWrap');
  if (addWrap) addWrap.style.display = varModalMode === 'add' ? 'block' : 'none';
  if (varModalMode !== 'add') {
    const form = document.getElementById('varFormWrap');
    if (form) form.style.display = 'none';
  }
  openModal('modalVar');
}

function buildVarSelects() {
  const m = getCurrentMonth();
  const cats = getVariableCategoryOptions(m);
  const filtro = document.getElementById('varFiltroCat');
  const catSel = document.getElementById('varCat');
  const prevFiltro = filtro.value;
  const prevCat = catSel.value;

  filtro.innerHTML = '<option value="todas">Todas</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  const catOptions = ['<option value="">Selecione</option>']
    .concat(cats.map(c => `<option value="${c}">${c}</option>`))
    .concat('<option value="nova">+ Nova categoria</option>');
  catSel.innerHTML = catOptions.join('');
  document.getElementById('varNovaCatWrap').style.display = 'none';

  filtro.value = cats.includes(prevFiltro) ? prevFiltro : 'todas';
  syncVarCategoryWithFilter(cats.includes(prevCat) ? prevCat : '');
}

function syncVarCategoryWithFilter(preferredCategory = '') {
  const filtro = document.getElementById('varFiltroCat');
  const catSel = document.getElementById('varCat');
  const novaWrap = document.getElementById('varNovaCatWrap');
  const novaInput = document.getElementById('varNovaCat');
  if (!filtro || !catSel) return;

  const filtroAtual = filtro.value || 'todas';
  if (filtroAtual !== 'todas') {
    catSel.value = filtroAtual;
    catSel.disabled = true;
    if (novaWrap) novaWrap.style.display = 'none';
    if (novaInput) novaInput.value = '';
    return;
  }

  catSel.disabled = false;
  const hasPreferred = preferredCategory && Array.from(catSel.options).some(opt => opt.value === preferredCategory);
  catSel.value = hasPreferred ? preferredCategory : '';
  toggleNovaCat();
}

function handleVarFilterChange() {
  syncVarCategoryWithFilter();
  renderVarTable();
}

function toggleNovaCat() {
  const sel = document.getElementById('varCat');
  const wrap = document.getElementById('varNovaCatWrap');
  wrap.style.display = sel.value === 'nova' ? 'block' : 'none';
}

function toggleVarForm() {
  const wrap = document.getElementById('varFormWrap');
  if (!wrap) return;
  const isOpen = wrap.style.display !== 'none';
  wrap.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) {
    document.getElementById('varTitulo').value = '';
    document.getElementById('varValor').value = '';
    document.getElementById('varData').value = getLastVarDate();
    document.getElementById('varNovaCat').value = '';
    document.getElementById('varCat').value = document.getElementById('varCat').options[0]?.value || '';
    toggleNovaCat();
  }
}

function handleVarFormKeydown(event) {
  if (event.key !== 'Enter') return;
  const target = event.target;
  if (target && target.tagName === 'TEXTAREA') return;
  event.preventDefault();
  addVarGasto();
}

function toggleDespNovaCat() {
  const sel = document.getElementById('fi_cat');
  const wrap = document.getElementById('fi_cat_nova_wrap');
  if (wrap) wrap.style.display = sel.value === 'nova' ? 'block' : 'none';
}

function addVarGasto() {
  const titulo = document.getElementById('varTitulo').value.trim();
  const valor = parseFloat(document.getElementById('varValor').value);
  const dataTxt = document.getElementById('varData').value.trim();
  const dataNormalizada = normalizeVarDate(dataTxt);
  let cat = document.getElementById('varCat').value;
  const selectedCatValue = cat;
  if (cat === 'nova') {
    cat = document.getElementById('varNovaCat').value.trim();
  }
  if (!titulo || isNaN(valor) || valor <= 0 || !cat) { alert('Preencha título, valor e categoria.'); return; }
  if (!dataNormalizada) { alert('Informe a data no formato dd/mm/aa ou dd/mm/aaaa.'); return; }

  recordHistoryState();
  const m = getCurrentMonth();
  normalizeMonth(m);
  if (!m.categorias) m.categorias = {};
  if (!(cat in m.categorias)) m.categorias[cat] = 0;
  m.gastosVar.push({ titulo, valor, data: dataNormalizada, categoria: cat });

  recalcTotals(m);
  save();
  renderCatGrid();
  renderMes();
  buildVarSelects();
  renderVarTable();

  document.getElementById('varTitulo').value = titulo;
  document.getElementById('varValor').value = '';
  document.getElementById('varData').value = dataNormalizada;
  document.getElementById('varCat').value = selectedCatValue === 'nova' ? 'nova' : cat;
  document.getElementById('varNovaCat').value = selectedCatValue === 'nova' ? cat : '';
  syncVarCategoryWithFilter(selectedCatValue === 'nova' ? 'nova' : cat);
  const valorInput = document.getElementById('varValor');
  if (valorInput) valorInput.focus();
}

function renderVarTable() {
  const m = getCurrentMonth();
  normalizeMonth(m);
  const filtro = document.getElementById('varFiltroCat').value || 'todas';
  let rows = (m.gastosVar || []).map((g, idx) => ({...g, __idx: idx}));
  if (filtro !== 'todas') rows = rows.filter(g => g.categoria === filtro);

  const campo = varSort.field || 'valor';
  const direcao = varSort.direction || 'desc';
  rows.sort((a,b) => {
    if (campo === 'categoria') {
      const ca = (a.categoria || '').localeCompare(b.categoria || '', 'pt-BR');
      return direcao === 'asc' ? ca : -ca;
    }
    if (campo === 'valor') return (direcao === 'asc' ? a.valor - b.valor : b.valor - a.valor);
    if (campo === 'data') {
      const da = parseData(a.data);
      const db = parseData(b.data);
      return direcao === 'asc' ? da - db : db - da;
    }
    const ta = (a.titulo||'').toLowerCase();
    const tb = (b.titulo||'').toLowerCase();
    return direcao === 'asc' ? ta.localeCompare(tb) : tb.localeCompare(ta);
  });

  const tbody = document.getElementById('varTableBody');
  updateVarTableHeaders();
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:18px;color:var(--text3)">Nenhum gasto variável lançado.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((g, i) => `
    <tr>
      ${renderInlineCell({ table:'varItem', row:g.__idx, field:'data', kind:'var-date', value:g.data || '', displayValue:escapeHtml(g.data || '—'), style:'padding-left:16px' })}
      ${renderInlineCell({ table:'varItem', row:g.__idx, field:'categoria', kind:'var-category', value:g.categoria, displayValue:`<span class="badge" style="background:${(CAT_COLORS[g.categoria]||'#eef2fc')};color:var(--text)">${escapeHtml(g.categoria)}</span>` })}
      ${renderInlineCell({ table:'varItem', row:g.__idx, field:'titulo', kind:'text', value:g.titulo || '', displayValue:escapeHtml(g.titulo || '—') })}
      ${renderInlineCell({ table:'varItem', row:g.__idx, field:'valor', kind:'number', value:g.valor, displayValue:fmt(g.valor), className:'amount amount-neg' })}
      <td><button class="btn-icon" onclick="deleteVar(${g.__idx})">✕</button></td>
    </tr>
  `).join('');
}

function updateVarTableHeaders() {
  const table = document.getElementById('varTable');
  if (!table) return;
  const labels = { data: 'Data', categoria: 'Categoria', titulo: 'Título', valor: 'Valor' };
  table.querySelectorAll('th.sortable').forEach(th => {
    const onclick = th.getAttribute('onclick') || '';
    const match = onclick.match(/setVarSort\('([^']+)'\)/);
    const field = match ? match[1] : '';
    const arrow = varSort.field === field ? (varSort.direction === 'asc' ? ' ▲' : ' ▼') : '';
    th.textContent = `${labels[field] || th.textContent.replace(/[ ▲▼]+$/,'')}${arrow}`;
  });
}

function setVarSort(field) {
  if (varSort.field === field) {
    varSort.direction = varSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    varSort = { field, direction: field === 'valor' ? 'desc' : 'asc' };
  }
  renderVarTable();
}

// Daily categories table
function renderDaily() {
  const m = getCurrentMonth();
  const body = document.getElementById('dailyBody');
  if (!body) return;
  const catTotals = getVariableCategoryTotals(m);
  const total = Object.values(catTotals || {}).reduce((acc, val) => acc + val, 0);
  updateDailyTableHeaders();
  const rowsData = getSortedDailyRows(catTotals, total);
  const rows = rowsData.map(({ categoria, valor, percentual }) => {
      const meta = (m.dailyGoals && m.dailyGoals[categoria] !== undefined) ? m.dailyGoals[categoria] : null;
      const valorColor = meta === null ? 'var(--text)' : (valor > meta ? 'var(--red)' : 'var(--green)');
      return `
      <tr>
        ${renderInlineCell({ table:'daily', row:categoria, field:'categoria', kind:'text', value:categoria, displayValue:escapeHtml(categoria), style:'padding-left:22px' })}
        <td class="amount" style="color:${valorColor}">${fmt(valor)}</td>
        ${renderInlineCell({ table:'daily', row:categoria, field:'meta', kind:'number', value:meta ?? '', displayValue:meta === null ? '—' : fmt(meta), className:'text-muted' })}
        <td class="text-muted">${percentual.toFixed(1)}%</td>
      </tr>`;
    }).join('');
  body.innerHTML = rows || '<tr><td colspan="4" style="padding:12px;color:var(--text3)">Sem gastos variáveis.</td></tr>';
  const totalEl = document.getElementById('dailyTotal');
  if (totalEl) totalEl.textContent = fmt(total);
}

function getSortedDailyRows(catTotals, total) {
  const rows = Object.keys(catTotals || {}).map(categoria => ({
    categoria,
    valor: catTotals[categoria] || 0,
    percentual: total > 0 ? ((catTotals[categoria] || 0) / total) * 100 : 0
  }));
  if (!dailySort.field) {
    return rows.sort((a, b) => {
      const ai = IMPORTED_CATEGORY_ORDER.indexOf(a.categoria);
      const bi = IMPORTED_CATEGORY_ORDER.indexOf(b.categoria);
      if (ai === -1 && bi === -1) return a.categoria.localeCompare(b.categoria, 'pt-BR');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }
  const factor = dailySort.direction === 'desc' ? -1 : 1;
  return rows.sort((a, b) => {
    if (dailySort.field === 'valor') return (a.valor - b.valor) * factor;
    if (dailySort.field === 'percentual') return (a.percentual - b.percentual) * factor;
    return a.categoria.localeCompare(b.categoria, 'pt-BR') * factor;
  });
}

function updateDailyTableHeaders() {
  const table = document.getElementById('dailyTable');
  if (!table) return;
  const labels = { categoria: 'Categoria', valor: 'Valor', percentual: '% do total' };
  table.querySelectorAll('th.sortable').forEach(th => {
    const onclick = th.getAttribute('onclick') || '';
    const match = onclick.match(/setDailySort\('([^']+)'\)/);
    const field = match ? match[1] : '';
    const arrow = dailySort.field === field ? (dailySort.direction === 'asc' ? ' ▲' : ' ▼') : '';
    th.textContent = `${labels[field] || th.textContent.replace(/[ ▲▼]+$/,'')}${arrow}`;
  });
}

function setDailySort(field) {
  if (dailySort.field === field) {
    dailySort.direction = dailySort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    dailySort = { field, direction: 'asc' };
  }
  renderDaily();
}

function deleteVar(idx) {
  if (!confirm('Remover este gasto variável?')) return;
  recordHistoryState();
  const m = getCurrentMonth();
  m.gastosVar.splice(idx,1);
  if (m.gastosVar.length === 0) m.categorias = {};
  recalcTotals(m);
  save();
  renderCatGrid();
  renderMes();
  renderVarTable();
}

function parseData(txt) {
  if (!txt) return 0;
  const normalized = normalizeVarDate(txt);
  if (normalized) {
    const parts = normalized.split('/').map(p => parseInt(p, 10));
    if (parts.length === 3) {
      const year = 2000 + parts[2];
      return new Date(year, parts[1] - 1, parts[0]).getTime();
    }
  }
  return Date.parse(txt) || 0;
}

function normalizeVarDate(txt) {
  const clean = String(txt || '').trim();
  if (!clean) return '';
  const match = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const fullYear = parseInt(match[3], 10);
  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(fullYear)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const shortYear = String(fullYear).slice(-2).padStart(2, '0');
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${shortYear}`;
}

function areProjectListsEquivalent(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  return left.every((item, idx) =>
    (item?.nome || '') === (right[idx]?.nome || '') &&
    Number(item?.valor || 0) === Number(right[idx]?.valor || 0)
  );
}

function ensureProjetos(m) {
  if (!m) return;
  if (!canUseBundledFinanceData()) {
    if (!Array.isArray(m.projetos)) m.projetos = [];
    return;
  }
  if (IMPORTED_PROJECTS[m.id]) {
    const imported = getImportedProjectsForMonth(m.id);
    if (!Array.isArray(m.projetos)) {
      m.projetos = imported;
      m._projectSource = 'imported';
      return;
    }
    if (m._projectSource === 'imported' || m._projectSource === 'manual') {
      return;
    }
    const originalHistProjects = HIST_DATA.find(o => o.id === m.id)?.projetos || [];
    const shouldHydrateFromImport = m.projetos.length === 0 || areProjectListsEquivalent(m.projetos, originalHistProjects);
    if (shouldHydrateFromImport) {
      m.projetos = imported;
    }
    m._projectSource = 'imported';
    return;
  }
  if (!Array.isArray(m.projetos)) m.projetos = [];
  if (m.projetos.length === 0) {
    const orig = HIST_DATA.find(o => o.id === m.id);
    if (orig && Array.isArray(orig.projetos) && orig.projetos.length) {
      m.projetos = JSON.parse(JSON.stringify(orig.projetos));
    }
  }
}

function saveObs() {
  recordHistoryState();
  const m = getCurrentMonth();
  m.obs = document.getElementById('obsField').value;
  save();
  alert('Observação salva.');
}

// ============================================================
// NEW MONTH
// ============================================================
function getDefaultMonthCopyPreferences() {
  return {
    enabled: true,
    despesas: {},
    gastosCategorias: {},
    renda: {},
    projetos: {}
  };
}

function getMonthCopyPreferences() {
  const saved = Storage.getJSON(STORAGE_KEYS.monthCopyPreferences, null) || {};
  return {
    enabled: saved.enabled !== false,
    despesas: { ...(saved.despesas || {}) },
    gastosCategorias: { ...(saved.gastosCategorias || {}) },
    renda: { ...(saved.renda || {}) },
    projetos: { ...(saved.projetos || {}) }
  };
}

function saveMonthCopyPreferences(prefs) {
  Storage.setJSON(STORAGE_KEYS.monthCopyPreferences, {
    enabled: prefs.enabled !== false,
    despesas: { ...(prefs.despesas || {}) },
    gastosCategorias: { ...(prefs.gastosCategorias || {}) },
    renda: { ...(prefs.renda || {}) },
    projetos: { ...(prefs.projetos || {}) }
  });
}

function normalizeProjectCopyName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function getMonthCopyOptions(prev) {
  const despesasMap = new Map();
  (prev?.despesas || []).forEach(item => {
    const key = normalizeExpenseName(item.nome);
    if (!key || despesasMap.has(key)) return;
    despesasMap.set(key, {
      key,
      label: item.nome || 'Despesa',
      meta: fmt(Number(item.valor || 0))
    });
  });

  const rendaMap = new Map();
  (prev?.renda || []).forEach(item => {
    const key = normalizeIncomeName(item.fonte);
    if (!key || rendaMap.has(key)) return;
    rendaMap.set(key, {
      key,
      label: item.fonte || 'Renda',
      meta: fmt(Number(item.valor || 0))
    });
  });

  const projetosMap = new Map();
  (prev?.projetos || []).forEach(item => {
    const key = normalizeProjectCopyName(item.nome);
    if (!key || projetosMap.has(key)) return;
    projetosMap.set(key, {
      key,
      label: item.nome || 'Renda extra',
      meta: fmt(Number(item.valor || 0))
    });
  });

  const gastosMap = new Map();
  const pushCategory = category => {
    const resolved = resolveCategoryName(category || 'OUTROS');
    if (!resolved || gastosMap.has(resolved)) return;
    const amount = Number(getVariableCategoryTotals(prev || {})[resolved] || 0);
    gastosMap.set(resolved, {
      key: resolved,
      label: resolved,
      meta: amount > 0 ? fmt(amount) : 'Sem lançamentos no mês anterior'
    });
  };
  (prev?.gastosVar || []).forEach(item => pushCategory(item.categoria));
  (prev?.dailyCategorySeeds || []).forEach(pushCategory);
  Object.keys(prev?.dailyGoals || {}).forEach(pushCategory);

  return {
    despesas: Array.from(despesasMap.values()),
    gastosCategorias: Array.from(gastosMap.values()),
    renda: Array.from(rendaMap.values()),
    projetos: Array.from(projetosMap.values())
  };
}

function ensureMonthCopyPreferencesForOptions(prefs, options) {
  ['despesas', 'gastosCategorias', 'renda', 'projetos'].forEach(group => {
    prefs[group] = prefs[group] || {};
    (options[group] || []).forEach(option => {
      if (prefs[group][option.key] === undefined) prefs[group][option.key] = true;
    });
  });
  return prefs;
}

function getMonthCopyGroupTitle(group) {
  if (group === 'despesas') return 'Despesas';
  if (group === 'gastosCategorias') return 'Gastos diários';
  if (group === 'renda') return 'Renda';
  return 'Renda extra';
}

function renderMonthCopyPicker() {
  const picker = document.getElementById('monthCopyPicker');
  const toggle = document.getElementById('copyPrevMonthToggle');
  const chooseBtn = document.getElementById('monthCopyChooseBtn');
  const summary = document.getElementById('monthCopySummary');
  if (!picker || !toggle || !chooseBtn || !summary) return;

  const prev = getMonthCopySourceMonth();
  if (!prev) {
    chooseBtn.disabled = true;
    picker.hidden = true;
    summary.textContent = 'Ainda não existe um mês anterior para copiar.';
    picker.innerHTML = '';
    return;
  }

  const prefs = ensureMonthCopyPreferencesForOptions(getMonthCopyPreferences(), getMonthCopyOptions(prev));
  saveMonthCopyPreferences(prefs);

  chooseBtn.disabled = !toggle.checked;
  summary.textContent = toggle.checked
    ? 'Selecione exatamente quais dados do mês anterior devem ser copiados para este e para os próximos meses.'
    : 'Desmarque para começar o novo mês vazio. Suas escolhas continuam salvas para os próximos meses.';

  const options = getMonthCopyOptions(prev);
  picker.innerHTML = ['despesas', 'gastosCategorias', 'renda', 'projetos'].map(group => {
    const items = options[group] || [];
    if (!items.length) {
      return `
      <div class="month-copy-group">
        <h4>${getMonthCopyGroupTitle(group)}</h4>
        <div class="month-copy-empty">Nada disponível para copiar no mês anterior.</div>
      </div>`;
    }
    const rows = items.map(item => `
      <label class="month-copy-item">
        <input type="checkbox" ${prefs[group]?.[item.key] !== false ? 'checked' : ''} onchange="toggleMonthCopyItem('${group}', '${encodeURIComponent(item.key)}', this.checked)">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.meta)}</span>
        </div>
      </label>`).join('');
    return `
      <div class="month-copy-group">
        <h4>${getMonthCopyGroupTitle(group)}</h4>
        <div class="month-copy-list">${rows}</div>
      </div>`;
  }).join('');
}

function updateMonthCopyVisibility(showPicker) {
  const controls = document.getElementById('monthCopyControls');
  const picker = document.getElementById('monthCopyPicker');
  const toggle = document.getElementById('copyPrevMonthToggle');
  const chooseBtn = document.getElementById('monthCopyChooseBtn');
  if (!controls || !picker || !toggle || !chooseBtn) return;
  if (controls.hidden) {
    picker.hidden = true;
    return;
  }
  const hasPrev = !!getMonthCopySourceMonth();
  chooseBtn.disabled = !hasPrev || !toggle.checked;
  if (!toggle.checked || !hasPrev) {
    picker.hidden = true;
    chooseBtn.textContent = 'Escolher dados';
    return;
  }
  picker.hidden = !showPicker;
  chooseBtn.textContent = picker.hidden ? 'Escolher dados' : 'Ocultar dados';
}

function setupMonthCopyControls() {
  const controls = document.getElementById('monthCopyControls');
  const toggle = document.getElementById('copyPrevMonthToggle');
  if (!controls || !toggle) return;
  if (isPrimaryUserEnvironment()) {
    controls.hidden = true;
    return;
  }
  controls.hidden = false;
  const prev = getMonthCopySourceMonth();
  const prefs = prev
    ? ensureMonthCopyPreferencesForOptions(getMonthCopyPreferences(), getMonthCopyOptions(prev))
    : getMonthCopyPreferences();
  saveMonthCopyPreferences(prefs);
  toggle.checked = prefs.enabled !== false;
  renderMonthCopyPicker();
  updateMonthCopyVisibility(false);
}

function refreshMonthCopyControls() {
  if (isPrimaryUserEnvironment()) return;
  const modal = document.getElementById('modalNewMonth');
  if (!modal || modal.dataset.mode !== 'create') return;
  setupMonthCopyControls();
}

function getMonthCopySourceMonth() {
  const targetName = `${document.getElementById('newMonthMes').value} ${document.getElementById('newMonthAno').value}`;
  const targetSortValue = getMonthSortValue({ nome: targetName });
  const previousMonths = data.filter(m => getMonthSortValue(m) < targetSortValue);
  return previousMonths[previousMonths.length - 1] || null;
}

function handleMonthCopyEnabledChange(checked) {
  if (isPrimaryUserEnvironment()) return;
  const prefs = getMonthCopyPreferences();
  prefs.enabled = !!checked;
  saveMonthCopyPreferences(prefs);
  renderMonthCopyPicker();
  updateMonthCopyVisibility(false);
}

function toggleMonthCopyPicker() {
  if (isPrimaryUserEnvironment()) return;
  const picker = document.getElementById('monthCopyPicker');
  if (!picker) return;
  renderMonthCopyPicker();
  updateMonthCopyVisibility(picker.hidden);
}

function toggleMonthCopyItem(group, encodedKey, checked) {
  const prefs = getMonthCopyPreferences();
  const key = decodeURIComponent(encodedKey || '');
  prefs[group] = prefs[group] || {};
  prefs[group][key] = !!checked;
  saveMonthCopyPreferences(prefs);
  renderMonthCopyPicker();
  updateMonthCopyVisibility(true);
}

function openNewMonth() {
  const baseMonth = getCurrentMonth() || data[data.length - 1];
  const next = getNextMonthInfo(baseMonth);
  document.getElementById('modalNewMonth').dataset.mode = 'create';
  document.getElementById('modalNewMonth').dataset.editingMonthId = '';
  document.getElementById('modalNewMonthTitle').textContent = 'Novo mês';
  document.getElementById('modalNewMonthSubmit').textContent = 'Criar mês';
  document.getElementById('modalNewMonthHelp').innerHTML = isPrimaryUserEnvironment()
    ? 'O novo mês copia automaticamente do mês anterior: despesas recorrentes selecionadas, a categoria <b>ASSINATURAS</b> em gastos diários e as rendas fixas recorrentes.'
    : 'Você pode começar do zero ou copiar apenas os dados que quiser do mês anterior. As escolhas ficam salvas para os próximos meses.';
  document.getElementById('newMonthMes').value = next.monthName;
  document.getElementById('newMonthAno').value = next.year;
  setupMonthCopyControls();
  openModal('modalNewMonth');
}

function openEditCurrentMonth() {
  const current = getCurrentMonth();
  if (!current) return;
  const monthName = getMonthName(current);
  const year = getYear(current);
  document.getElementById('modalNewMonth').dataset.mode = 'edit';
  document.getElementById('modalNewMonth').dataset.editingMonthId = current.id;
  document.getElementById('modalNewMonthTitle').textContent = 'Editar mês';
  document.getElementById('modalNewMonthSubmit').textContent = 'Salvar mês';
  document.getElementById('modalNewMonthHelp').textContent = 'Altere o mês e o ano para corrigir este registro sem perder os dados já lançados.';
  document.getElementById('newMonthMes').value = monthName;
  document.getElementById('newMonthAno').value = year;
  const controls = document.getElementById('monthCopyControls');
  if (controls) controls.hidden = true;
  openModal('modalNewMonth');
}

function replaceMonthIdReferences(oldId, newId, oldYear, newYear) {
  if (currentMonthId === oldId) currentMonthId = newId;
  if (periodFilter.month === oldId) periodFilter.month = newId;
  if (periodFilter.start === oldId) periodFilter.start = newId;
  if (periodFilter.end === oldId) periodFilter.end = newId;
  if (periodFilter.type === 'year' && String(periodFilter.year || '') === String(oldYear || '') && String(oldYear || '') !== String(newYear || '')) {
    periodFilter.year = String(newYear || oldYear || '');
  }
  if (despSelectionState[oldId]) {
    despSelectionState[newId] = despSelectionState[oldId];
    delete despSelectionState[oldId];
  }
}

function updateCurrentMonthIdentity() {
  const current = getCurrentMonth();
  if (!current) return;
  const mes = document.getElementById('newMonthMes').value;
  const ano = document.getElementById('newMonthAno').value;
  const nome = `${mes} ${ano}`;
  const id = nome.toLowerCase().replace(/ /g,'_');
  if (data.find(m => m.id === id && m.id !== current.id)) { alert('Este mês já existe!'); return; }

  recordHistoryState();
  const oldId = current.id;
  const oldYear = getYear(current);
  current.id = id;
  current.nome = nome;
  normalizeMonth(current);
  sortDataChronologically();
  replaceMonthIdReferences(oldId, id, oldYear, ano);
  save();
  buildMonthSelect();
  document.getElementById('monthSelect').value = id;
  closeModal('modalNewMonth');
  nav('mes');
}

function getRecurringPrevMonth(prev, newMonthName) {
  if (!isPrimaryUserEnvironment()) {
    const prefs = getMonthCopyPreferences();
    const expenseKeys = new Set(Object.entries(prefs.despesas || {}).filter(([, enabled]) => enabled !== false).map(([key]) => key));
    const incomeKeys = new Set(Object.entries(prefs.renda || {}).filter(([, enabled]) => enabled !== false).map(([key]) => key));
    const projectKeys = new Set(Object.entries(prefs.projetos || {}).filter(([, enabled]) => enabled !== false).map(([key]) => key));
    const categoryKeys = new Set(Object.entries(prefs.gastosCategorias || {}).filter(([, enabled]) => enabled !== false).map(([key]) => key));

    const despesas = (prev?.despesas || [])
      .filter(item => expenseKeys.has(normalizeExpenseName(item.nome)))
      .map(item => ({ ...item }));

    const renda = (prev?.renda || [])
      .filter(item => incomeKeys.has(normalizeIncomeName(item.fonte)))
      .map(item => ({ ...item }));

    const projetos = (prev?.projetos || [])
      .filter(item => projectKeys.has(normalizeProjectCopyName(item.nome)))
      .map(item => ({ ...item }));

    const gastosVar = (prev?.gastosVar || [])
      .filter(item => categoryKeys.has(resolveCategoryName(item.categoria || 'OUTROS')))
      .map(item => ({ ...item }));

    const dailyCategorySeeds = Array.from(new Set((prev?.dailyCategorySeeds || [])
      .filter(category => categoryKeys.has(resolveCategoryName(category)))
      .map(category => resolveCategoryName(category))));

    const dailyGoals = {};
    Object.entries(prev?.dailyGoals || {}).forEach(([category, value]) => {
      const resolved = resolveCategoryName(category);
      if (!categoryKeys.has(resolved)) return;
      dailyGoals[resolved] = value;
    });

    const month = {
      id: newMonthName.toLowerCase().replace(/ /g, '_'),
      nome: newMonthName,
      despesas,
      renda,
      projetos,
      gastosVar,
      dailyCategorySeeds,
      dailyGoals,
      total_gastos: 0,
      total_renda: 0,
      resultado: 0,
      categorias: {}
    };
    recalcTotals(month);
    return month;
  }

  const recurringExpenseNamesZeroed = new Set(AUTO_COPY_EXPENSES_ZEROED.map(name => normalizeExpenseName(resolveExpenseName(name))));
  const recurringExpenseNamesWithLastValue = new Set(AUTO_COPY_EXPENSES_WITH_LAST_VALUE.map(name => normalizeExpenseName(resolveExpenseName(name))));
  const recurringIncomeNames = new Set(AUTO_COPY_RENDA.map(name => normalizeIncomeName(resolveIncomeName(name))));
  const recurringDailyCategories = new Set(AUTO_COPY_DAILY_CATEGORIES.map(name => resolveCategoryName(name)));
  const prevVariableCategories = Object.keys(getVariableCategoryTotals(prev || {})).map(cat => resolveCategoryName(cat));

  const despesas = (prev?.despesas || [])
    .filter(d => {
      const normalized = normalizeExpenseName(d.nome);
      return recurringExpenseNamesZeroed.has(normalized) || recurringExpenseNamesWithLastValue.has(normalized);
    })
    .map(d => {
      const normalized = normalizeExpenseName(d.nome);
      return {
        ...d,
        valor: recurringExpenseNamesZeroed.has(normalized) ? 0 : d.valor
      };
    });

  const renda = (prev?.renda || [])
    .filter(r => recurringIncomeNames.has(normalizeIncomeName(r.fonte)))
    .map(r => ({ ...r }));

  const gastosVar = (prev?.gastosVar || [])
    .filter(g => recurringDailyCategories.has(resolveCategoryName(g.categoria || 'OUTROS')))
    .map(g => ({ ...g }));

  const dailyGoals = {};
  const dailyCategorySeeds = Array.from(new Set(prevVariableCategories));
  recurringDailyCategories.forEach(cat => {
    if (prev?.dailyGoals && prev.dailyGoals[cat] !== undefined) {
      dailyGoals[cat] = prev.dailyGoals[cat];
    }
  });

  const month = {
    id: newMonthName.toLowerCase().replace(/ /g, '_'),
    nome: newMonthName,
    despesas,
    renda,
    projetos: [],
    gastosVar,
    dailyCategorySeeds,
    dailyGoals,
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  };
  recalcTotals(month);
  return month;
}

function createNewMonth() {
  const mes = document.getElementById('newMonthMes').value;
  const ano = document.getElementById('newMonthAno').value;
  const nome = `${mes} ${ano}`;
  const id = nome.toLowerCase().replace(/ /g,'_');
  if (data.find(m => m.id === id)) { alert('Este mês já existe!'); return; }

  recordHistoryState();
  let newMonth = { id, nome, despesas:[], renda:[], projetos:[], gastosVar:[], dailyGoals:{}, total_gastos:0, total_renda:0, resultado:0, categorias:{} };
  const newSortValue = getMonthSortValue({ nome });
  const previousMonths = data.filter(m => getMonthSortValue(m) < newSortValue);
  const prev = previousMonths[previousMonths.length - 1] || null;
  const shouldCopyPrevious = isPrimaryUserEnvironment()
    ? !!prev
    : !!prev && getMonthCopyPreferences().enabled !== false;
  if (shouldCopyPrevious) {
    newMonth = getRecurringPrevMonth(prev, nome);
  }
  normalizeMonth(newMonth);

  data.push(newMonth);
  sortDataChronologically();
  currentMonthId = id;
  save();
  buildMonthSelect();
  document.getElementById('monthSelect').value = id;
  closeModal('modalNewMonth');
  nav('mes');
}

function submitMonthModal() {
  const mode = document.getElementById('modalNewMonth').dataset.mode || 'create';
  if (mode === 'edit') {
    updateCurrentMonthIdentity();
    return;
  }
  createNewMonth();
}
