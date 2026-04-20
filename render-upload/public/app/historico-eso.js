// HISTÓRICO
// ============================================================
function renderHistorico() {
  const dashWrap = document.getElementById('dashFilters'); if (dashWrap) dashWrap.innerHTML = '';
  buildPeriodControls('histFilters','resultModeSel'); // controls render aqui
  const list = getFilteredData();
  const first = list[0];
  const last = list[list.length-1];
  const sub = document.getElementById('histSub');
  if (sub) sub.textContent = `${list.length} meses · ${first?.nome || ''}${first&&last&&first!==last?' – '+last.nome:''}`;
  const pLabel = periodLabel();
  const resLabel = labelResult(list);
  const h1 = document.getElementById('histChart1Title'); if (h1) h1.textContent = `Gastos totais — ${pLabel}`;
  const h2 = document.getElementById('histChart2Title'); if (h2) h2.textContent = `${sectionTitles.resultchart} (${resLabel}) — ${pLabel}`;
  const tbody = document.getElementById('histBody');
  tbody.innerHTML = [...list].reverse().map(m => {
    const t = getTotals(m);
    const res = computeResult(m, resultMode);
    return `<tr>
      <td style="padding-left:22px;font-weight:500">${m.nome}</td>
      <td class="amount-neg">${fmt(t.totalGastos)}</td>
      <td class="amount-pos">${fmt(t.rendaTotal)}</td>
      <td style="color:var(--blue)">${fmt(t.totalProj)}</td>
      <td><span class="badge ${res>=0?'badge-pos':'badge-neg'}">${fmtSigned(res)}</span></td>
    </tr>`;
  }).join('');
  const tabela = document.getElementById('hist-tabela');
  const grafico = document.getElementById('hist-grafico');
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(b => b.classList.remove('active'));
  if (histActiveTab === 'grafico') {
    if (tabela) tabela.style.display = 'none';
    if (grafico) grafico.style.display = '';
    const btn = document.querySelector('.tab-btn[onclick*="grafico"]');
    if (btn) btn.classList.add('active');
    buildHistCharts();
  } else {
    if (tabela) tabela.style.display = '';
    if (grafico) grafico.style.display = 'none';
    const btn = document.querySelector('.tab-btn[onclick*="tabela"]');
    if (btn) btn.classList.add('active');
  }
}

function histTab(tab, btn) {
  histActiveTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('hist-tabela').style.display = tab === 'tabela' ? '' : 'none';
  document.getElementById('hist-grafico').style.display = tab === 'grafico' ? '' : 'none';
  if (tab === 'grafico') buildHistCharts();
  saveUIState();
}

function buildHistCharts() {
  destroyChart('histChart1');
  destroyChart('histChart2');
  const list = getFilteredData();
  const ctx1 = document.getElementById('histChart1').getContext('2d');
  charts['histChart1'] = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: list.map(m=>m.nome.split(' ').map((w,i)=>i===0?w.slice(0,3):w).join('/')),
      datasets: [
        { label:'Gastos', data: list.map(m=>getTotals(m).totalGastos), backgroundColor:'rgba(192,57,43,.7)' },
        { label:'Renda', data: list.map(m=>getTotals(m).rendaTotal), backgroundColor:'rgba(39,174,96,.7)' }
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:true}},
      scales:{ x:{ticks:{font:{size:10},maxRotation:45,autoSkip:true}}, y:{ticks:{callback:v=>'R$'+(v/1000).toFixed(0)+'k'},grid:{color:'rgba(0,0,0,.05)'}} } }
  });

  const ctx2 = document.getElementById('histChart2').getContext('2d');
  charts['histChart2'] = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: list.map(m=>m.nome.split(' ').map((w,i)=>i===0?w.slice(0,3):w).join('/')),
      datasets: [{ data: list.map(m=>computeResult(m,resultMode)), backgroundColor: list.map(m=>computeResult(m,resultMode)>=0?'rgba(39,174,96,.75)':'rgba(192,57,43,.7)') }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{ x:{ticks:{font:{size:10},maxRotation:45,autoSkip:true}}, y:{ticks:{callback:v=>(v<0?'-':'')+'R$'+(Math.abs(v)/1000).toFixed(0)+'k'},grid:{color:'rgba(0,0,0,.05)'}} } }
  });
}

// ============================================================
// FECHAMENTOS ESO
// ============================================================
function buildEsoFilters() {
  const wrap = document.getElementById('esoFilters');
  if (!wrap) return;
  const tipos = getEsoUniqueValues('tipo');
  const entradas = getEsoUniqueValues('entrada');
  const statuses = ['todas', 'Fechado', 'Não fechado', 'Aguardando'];
  wrap.innerHTML = `
    <div class="field xsmall">
      <label>De</label>
      <input id="esoFilterStart" value="${escapeHtml(esoFilter.start || '')}" placeholder="dd/mm/aa" inputmode="numeric" oninput="maskVarDateInput(this)" onchange="setEsoFilterField('start', this.value)">
    </div>
    <div class="field xsmall">
      <label>Até</label>
      <input id="esoFilterEnd" value="${escapeHtml(esoFilter.end || '')}" placeholder="dd/mm/aa" inputmode="numeric" oninput="maskVarDateInput(this)" onchange="setEsoFilterField('end', this.value)">
    </div>
    <div class="field">
      <label>Status</label>
      <select id="esoFilterStatus" onchange="setEsoFilterField('status', this.value)">${statuses.map(status => `<option value="${escapeHtml(status)}" ${esoFilter.status===status?'selected':''}>${status === 'todas' ? 'Todos' : escapeHtml(status)}</option>`).join('')}</select>
    </div>
    <div class="field">
      <label>Tipo</label>
      <select id="esoFilterTipo" onchange="setEsoFilterField('tipo', this.value)"><option value="todas">Todos</option>${tipos.map(tipo => `<option value="${escapeHtml(tipo)}" ${esoFilter.tipo===tipo?'selected':''}>${escapeHtml(tipo)}</option>`).join('')}</select>
    </div>
    <div class="field">
      <label>Entrada</label>
      <select id="esoFilterEntrada" onchange="setEsoFilterField('entrada', this.value)"><option value="todas">Todas</option>${entradas.map(entrada => `<option value="${escapeHtml(entrada)}" ${esoFilter.entrada===entrada?'selected':''}>${escapeHtml(entrada)}</option>`).join('')}</select>
    </div>
    <div class="field">
      <label>Buscar</label>
      <input id="esoFilterSearch" value="${escapeHtml(esoFilter.search || '')}" placeholder="Cliente, tipo, entrada..." oninput="setEsoFilterField('search', this.value, false)" onblur="setEsoFilterField('search', this.value)">
    </div>`;
}

function setEsoFilterField(field, value, rerender = true) {
  const next = { ...esoFilter, [field]: value };
  esoFilter = sanitizeEsoFilter(next);
  saveUIState();
  if (rerender) renderEso();
}

function resetEsoFilters() {
  esoFilter = sanitizeEsoFilter({});
  saveUIState();
  renderEso();
}

function getEsoStatusBadge(status) {
  const current = normalizeEsoStatus(status);
  const colorMap = {
    'Fechado': { bg: 'rgba(39,174,96,.12)', color: '#1e8449' },
    'Aguardando': { bg: 'rgba(230,126,34,.12)', color: '#af601a' },
    'Não fechado': { bg: 'rgba(192,57,43,.12)', color: '#a93226' }
  };
  const colors = colorMap[current] || colorMap['Não fechado'];
  return `<span class="badge" style="background:${colors.bg};color:${colors.color}">${escapeHtml(current)}</span>`;
}

function updateEsoTableHeaders() {
  const table = document.getElementById('esoTable');
  if (!table) return;
  const labels = {
    data: 'Data',
    cliente: 'Cliente',
    tipo: 'Tipo de projeto',
    valor: 'Valor',
    entrada: 'Entrada',
    status: 'Status'
  };
  table.querySelectorAll('th.sortable').forEach(th => {
    const onclick = th.getAttribute('onclick') || '';
    const match = onclick.match(/setEsoSort\('([^']+)'\)/);
    const field = match ? match[1] : '';
    const arrow = esoSort.field === field ? (esoSort.direction === 'asc' ? ' ▲' : ' ▼') : '';
    th.textContent = `${labels[field] || th.textContent.replace(/[ ▲▼]+$/,'')}${arrow}`;
  });
}

function setEsoSort(field) {
  if (esoSort.field === field) esoSort.direction = esoSort.direction === 'asc' ? 'desc' : 'asc';
  else esoSort = { field, direction: field === 'data' ? 'desc' : 'asc' };
  renderEso();
}

function openEsoModal(id = null) {
  editingEsoId = id;
  const item = id ? esoData.find(entry => entry.id === id) : null;
  document.getElementById('modalEsoTitle').textContent = item ? 'Editar fechamento ESO' : 'Adicionar fechamento ESO';
  document.getElementById('esoDataInput').value = item?.data || '';
  document.getElementById('esoClienteInput').value = item?.cliente || '';
  document.getElementById('esoTipoInput').value = item?.tipo || '';
  document.getElementById('esoValorInput').value = item?.valor || '';
  document.getElementById('esoEntradaInput').value = item?.entrada || '';
  document.getElementById('esoStatusInput').value = item?.status || 'Não fechado';
  openModal('modalEso');
}

function saveEsoItem() {
  const dataTxt = normalizeVarDate(document.getElementById('esoDataInput').value);
  const cliente = document.getElementById('esoClienteInput').value.trim();
  const tipo = document.getElementById('esoTipoInput').value.trim();
  const valor = parseFloat(document.getElementById('esoValorInput').value);
  const entrada = document.getElementById('esoEntradaInput').value.trim();
  const status = normalizeEsoStatus(document.getElementById('esoStatusInput').value);
  if (!dataTxt || !cliente || !tipo || isNaN(valor) || valor <= 0 || !entrada) {
    alert('Preencha os campos corretamente para salvar o fechamento.');
    return;
  }
  const payload = normalizeEsoEntry({
    id: editingEsoId || `eso_manual_${Date.now()}`,
    data: dataTxt,
    cliente,
    tipo,
    valor,
    entrada,
    status,
    manual: true
  });
  if (editingEsoId) {
    const idx = esoData.findIndex(entry => entry.id === editingEsoId);
    if (idx >= 0) esoData[idx] = payload;
  } else {
    esoData.push(payload);
  }
  saveEsoData();
  closeModal('modalEso');
  renderEso();
}

function deleteEsoItem(id) {
  const item = esoData.find(entry => entry.id === id);
  if (!item) return;
  if (!confirm(`Remover ${item.cliente}?`)) return;
  esoData = esoData.filter(entry => entry.id !== id);
  saveEsoData();
  renderEso();
}

function renderEso() {
  buildEsoFilters();
  const list = getFilteredEsoData();
  const metrics = getEsoMetrics(list);
  const metricsEl = document.getElementById('esoMetrics');
  if (metricsEl) {
    metricsEl.innerHTML = `
      <div class="metric-card" style="background:linear-gradient(180deg,#eef7f2 0%, #ffffff 100%);border-color:rgba(39,174,96,.14)"><div class="metric-label">Projetos filtrados</div><div class="metric-value">${metrics.totalProjetos}</div></div>
      <div class="metric-card" style="background:linear-gradient(180deg,#eef4fb 0%, #ffffff 100%);border-color:rgba(41,128,185,.14)"><div class="metric-label">Valor filtrado</div><div class="metric-value">${fmt(metrics.totalValor)}</div></div>
      <div class="metric-card" style="background:linear-gradient(180deg,#eef7f2 0%, #ffffff 100%);border-color:rgba(39,174,96,.14)"><div class="metric-label">Fechados</div><div class="metric-value">${metrics.totalFechados}</div><div class="metric-sub">${fmt(metrics.valorFechado)}</div></div>
      <div class="metric-card" style="background:linear-gradient(180deg,#fbf3ef 0%, #ffffff 100%);border-color:rgba(192,57,43,.14)"><div class="metric-label">Em aberto</div><div class="metric-value">${metrics.totalAbertos}</div><div class="metric-sub">${metrics.aguardando} aguardando</div></div>`;
  }
  const body = document.getElementById('esoBody');
  if (!body) return;
  const rows = getSortedEsoData();
  body.innerHTML = rows.length ? rows.map(({ item }) => `
    <tr>
      ${renderInlineCell({ table:'eso', row:item.id, field:'data', kind:'eso-date', value:item.data, displayValue:escapeHtml(item.data || '—'), style:'padding-left:22px' })}
      ${renderInlineCell({ table:'eso', row:item.id, field:'cliente', kind:'text', value:item.cliente, displayValue:escapeHtml(item.cliente) })}
      ${renderInlineCell({ table:'eso', row:item.id, field:'tipo', kind:'text', value:item.tipo, displayValue:escapeHtml(item.tipo) })}
      ${renderInlineCell({ table:'eso', row:item.id, field:'valor', kind:'number', value:item.valor, displayValue:fmt(item.valor), className:'amount amount-pos' })}
      ${renderInlineCell({ table:'eso', row:item.id, field:'entrada', kind:'text', value:item.entrada, displayValue:escapeHtml(item.entrada) })}
      ${renderInlineCell({ table:'eso', row:item.id, field:'status', kind:'eso-status', value:item.status, displayValue:getEsoStatusBadge(item.status) })}
      <td><button class="btn-icon" onclick="deleteEsoItem('${escapeHtml(item.id)}')">✕</button></td>
    </tr>`).join('') : '<tr><td colspan="7" style="padding:24px 22px;color:var(--text2)">Nenhum fechamento encontrado para os filtros escolhidos.</td></tr>';
  document.getElementById('esoTotal').textContent = fmt(metrics.totalValor);
  const sub = document.getElementById('esoSub');
  if (sub) {
    const parts = [];
    if (esoFilter.start) parts.push(`de ${esoFilter.start}`);
    if (esoFilter.end) parts.push(`até ${esoFilter.end}`);
    if (esoFilter.status !== 'todas') parts.push(esoFilter.status.toLowerCase());
    sub.textContent = parts.length ? `Mostrando ${parts.join(' · ')}` : 'Acompanhamento independente dos fechamentos de projetos';
  }
  updateEsoTableHeaders();
  saveUIState();
}

// ============================================================
