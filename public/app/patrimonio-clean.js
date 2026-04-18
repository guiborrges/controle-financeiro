function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatPatrimonioDate(value) {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  return value;
}

function parsePatrimonioDate(value) {
  if (!value) return 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).getTime();
  }
  if (/^\d{2}\/\d{2}\/\d{2,4}$/.test(value)) {
    const [day, month, year] = value.split('/');
    const fullYear = year.length === 2 ? `20${year}` : year;
    return new Date(`${fullYear}-${month}-${day}T00:00:00`).getTime();
  }
  return 0;
}

function patrimonioId(prefix = 'patr') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const PATRIMONIO_ACCOUNT_COLOR_OPTIONS = [
  { value: '#1b9ed8', label: 'Azul', style: '#1b9ed8' },
  { value: '#2f6fb6', label: 'Azul petróleo', style: '#2f6fb6' },
  { value: '#8c39d8', label: 'Roxo', style: '#8c39d8' },
  { value: '#5b6abf', label: 'Índigo', style: '#5b6abf' },
  { value: '#73a800', label: 'Verde', style: '#73a800' },
  { value: '#2f8f62', label: 'Verde floresta', style: '#2f8f62' },
  { value: '#f58a11', label: 'Laranja', style: '#f58a11' },
  { value: '#c17c3a', label: 'Caramelo', style: '#c17c3a' },
  { value: '#7b8794', label: 'Cinza', style: '#7b8794' },
  { value: '#596273', label: 'Grafite', style: '#596273' }
];
const PATRIMONIO_INSTITUTION_META = {
  santander: { label: 'Santander', short: 'S', className: 'bank-santander' },
  nubank: { label: 'Nubank', short: 'nu', className: 'bank-nubank' },
  bb: { label: 'Banco do Brasil', short: 'BB', className: 'bank-bb' },
  caixa: { label: 'Caixa', short: 'X', className: 'bank-caixa' },
  itau: { label: 'Itaú', short: 'itau', className: 'bank-itau' },
  bradesco: { label: 'Bradesco', short: 'B', className: 'bank-bradesco' },
  inter: { label: 'Banco Inter', short: 'inter', className: 'bank-inter' },
  c6: { label: 'C6 Bank', short: 'C6', className: 'bank-c6' },
  xp: { label: 'XP', short: 'XP', className: 'bank-xp' },
  outra: { label: 'Outra', short: '•', className: 'bank-outra' }
};

function normalizePatrimonioAccount(account, idx = 0) {
  const color = String(account?.color || account?.cor || '').trim();
  const institution = String(account?.institution || account?.instituicao || '').trim().toLowerCase();
  const kind = String(account?.kind || account?.modo || '').trim().toLowerCase();
  return {
    id: account?.id || patrimonioId(`account_${idx}`),
    nome: String(account?.nome || account?.name || '').trim() || `Conta ${idx + 1}`,
    tipo: String(account?.tipo || account?.categoria || '').trim(),
    observacao: String(account?.observacao || '').trim(),
    kind: ['institution', 'custom'].includes(kind)
      ? kind
      : (PATRIMONIO_INSTITUTION_META[institution] ? 'institution' : 'custom'),
    institution: PATRIMONIO_INSTITUTION_META[institution] ? institution : '',
    color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : '',
    createdAt: account?.createdAt || new Date().toISOString()
  };
}

function normalizePatrimonioMovement(movement, idx = 0) {
  const type = ['aporte', 'retirada', 'transferencia'].includes(movement?.type) ? movement.type : 'aporte';
  return {
    id: movement?.id || patrimonioId(`mov_${idx}`),
    type,
    accountId: movement?.accountId || '',
    fromAccountId: movement?.fromAccountId || '',
    toAccountId: movement?.toAccountId || '',
    value: Math.max(0, Number(movement?.value ?? movement?.valor ?? 0) || 0),
    description: String(movement?.description || movement?.descricao || '').trim(),
    date: String(movement?.date || movement?.data || todayIsoDate()).trim() || todayIsoDate(),
    createdAt: movement?.createdAt || new Date().toISOString(),
    sourceType: String(movement?.sourceType || '').trim(),
    sourceMonthId: String(movement?.sourceMonthId || '').trim(),
    sourceGoalId: String(movement?.sourceGoalId || '').trim()
  };
}

function ensurePatrimonioData() {
  patrimonioAccounts = (Array.isArray(patrimonioAccounts) ? patrimonioAccounts : []).map(normalizePatrimonioAccount);
  patrimonioMovements = (Array.isArray(patrimonioMovements) ? patrimonioMovements : []).map(normalizePatrimonioMovement);
  patrimonioFilters = {
    search: String(patrimonioFilters?.search || '').trim(),
    period: ['all', '30', '90', '365'].includes(patrimonioFilters?.period) ? patrimonioFilters.period : 'all',
    sort: ['saldo_desc', 'saldo_asc', 'nome_asc', 'nome_desc'].includes(patrimonioFilters?.sort) ? patrimonioFilters.sort : 'saldo_desc',
    movementType: ['all', 'aporte', 'retirada', 'transferencia'].includes(patrimonioFilters?.movementType) ? patrimonioFilters.movementType : 'all'
  };
  if (patrimonioSelectedAccountId && !patrimonioAccounts.some(account => account.id === patrimonioSelectedAccountId)) {
    patrimonioSelectedAccountId = '';
  }
  if (!patrimonioSelectedAccountId && patrimonioAccounts.length) {
    patrimonioSelectedAccountId = patrimonioAccounts[0].id;
  }
}

function savePatrimonioData(forceFlush = false) {
  ensurePatrimonioData();
  save(forceFlush);
}

function getPatrimonioAccountById(accountId) {
  ensurePatrimonioData();
  return patrimonioAccounts.find(account => account.id === accountId) || null;
}

function getPatrimonioAccountOptions(selectedId = '', includeBlank = true) {
  ensurePatrimonioData();
  const options = includeBlank ? ['<option value="">Sem conta vinculada</option>'] : [];
  patrimonioAccounts.forEach(account => {
    options.push(`<option value="${account.id}" ${account.id === selectedId ? 'selected' : ''}>${escapeHtml(account.nome)}</option>`);
  });
  return options.join('');
}

function getPatrimonioBalanceForAccount(accountId) {
  ensurePatrimonioData();
  return Number(patrimonioMovements.reduce((acc, movement) => {
    if (movement.type === 'aporte' && movement.accountId === accountId) return acc + movement.value;
    if (movement.type === 'retirada' && movement.accountId === accountId) return acc - movement.value;
    if (movement.type === 'transferencia') {
      if (movement.fromAccountId === accountId) acc -= movement.value;
      if (movement.toAccountId === accountId) acc += movement.value;
    }
    return acc;
  }, 0).toFixed(2));
}

function getPatrimonioFilteredAccounts() {
  ensurePatrimonioData();
  const search = patrimonioFilters.search.toLowerCase();
  const rows = patrimonioAccounts
    .map(account => ({ ...account, saldo: getPatrimonioBalanceForAccount(account.id) }))
    .filter(account => {
      if (!search) return true;
      return `${account.nome} ${account.tipo} ${account.observacao}`.toLowerCase().includes(search);
    });
  const collator = new Intl.Collator('pt-BR');
  const sorters = {
    saldo_desc: (a, b) => b.saldo - a.saldo,
    saldo_asc: (a, b) => a.saldo - b.saldo,
    nome_asc: (a, b) => collator.compare(a.nome, b.nome),
    nome_desc: (a, b) => collator.compare(b.nome, a.nome)
  };
  rows.sort(sorters[patrimonioFilters.sort] || sorters.saldo_desc);
  return rows;
}

function getPatrimonioFilteredMovements() {
  ensurePatrimonioData();
  const now = Date.now();
  const periodDays = Number(patrimonioFilters.period || 0);
  const minTime = periodDays > 0 ? now - (periodDays * 24 * 60 * 60 * 1000) : 0;
  return patrimonioMovements
    .filter(movement => {
      const time = parsePatrimonioDate(movement.date);
      if (minTime && time && time < minTime) return false;
      if (patrimonioFilters.movementType !== 'all' && movement.type !== patrimonioFilters.movementType) return false;
      return true;
    })
    .sort((a, b) => parsePatrimonioDate(b.date) - parsePatrimonioDate(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function getPatrimonioMetrics() {
  const accounts = getPatrimonioFilteredAccounts();
  const patrimonioTotal = accounts.reduce((acc, account) => acc + account.saldo, 0);
  const currentMonth = data[data.length - 1] || {};
  const currentMonthName = getMonthName(currentMonth);
  const currentYear = getYear(currentMonth);
  const currentMonthPrefix = currentMonthName && currentYear
    ? `${currentYear}-${String((MONTH_INDEX[currentMonthName] ?? 0) + 1).padStart(2, '0')}`
    : '';
  const currentMonthVariation = patrimonioMovements.reduce((acc, movement) => {
    if (!currentMonthPrefix || !String(movement.date || '').startsWith(currentMonthPrefix)) return acc;
    if (movement.type === 'aporte') return acc + movement.value;
    if (movement.type === 'retirada') return acc - movement.value;
    return acc;
  }, 0);
  return {
    patrimonioTotal: Number(patrimonioTotal.toFixed(2)),
    currentMonthVariation: Number(currentMonthVariation.toFixed(2))
  };
}

function getPatrimonioMovementImpact(movement) {
  if (movement.type === 'aporte') return movement.value;
  if (movement.type === 'retirada') return -movement.value;
  return 0;
}

function getPatrimonioEvolutionSeries() {
  const points = new Map();
  patrimonioMovements
    .slice()
    .sort((a, b) => parsePatrimonioDate(a.date) - parsePatrimonioDate(b.date) || a.createdAt.localeCompare(b.createdAt))
    .forEach(movement => {
      const key = movement.date || todayIsoDate();
      points.set(key, (points.get(key) || 0) + getPatrimonioMovementImpact(movement));
    });
  let running = 0;
  return Array.from(points.entries()).map(([date, delta]) => {
    running = Number((running + delta).toFixed(2));
    return { date, total: running };
  });
}

function getPatrimonioDistributionSeries() {
  return patrimonioAccounts
    .map(account => ({ name: account.nome, value: getPatrimonioBalanceForAccount(account.id) }))
    .filter(item => item.value > 0);
}

function getPatrimonioPlannedGoals() {
  const rows = [];
  data.forEach(month => {
    normalizeMonth(month);
    (month.financialGoals || []).forEach(goal => {
      if (!goal.patrimonioAccountId) return;
      rows.push({
        monthId: month.id,
        monthName: month.nome,
        goal,
        account: getPatrimonioAccountById(goal.patrimonioAccountId)
      });
    });
  });
  return rows.sort((a, b) =>
    getMonthSortValue(data.find(item => item.id === b.monthId) || { nome: b.monthName }) -
    getMonthSortValue(data.find(item => item.id === a.monthId) || { nome: a.monthName })
  );
}

function getPatrimonioSelectedAccount() {
  ensurePatrimonioData();
  return getPatrimonioAccountById(patrimonioSelectedAccountId);
}

function selectPatrimonioAccount(accountId) {
  patrimonioSelectedAccountId = accountId;
  saveUIState();
  renderPatrimonio();
}

function setPatrimonioSearch(value) {
  patrimonioFilters.search = String(value || '').trim();
  saveUIState();
  renderPatrimonio();
}

function setPatrimonioSort(value) {
  patrimonioFilters.sort = value;
  saveUIState();
  renderPatrimonio();
}

function setPatrimonioPeriod(value) {
  patrimonioFilters.period = value;
  saveUIState();
  renderPatrimonio();
}

function setPatrimonioMovementFilter(value) {
  patrimonioFilters.movementType = value;
  saveUIState();
  renderPatrimonio();
}

function renderPatrimonioMetrics() {
  const container = document.getElementById('patrimonioMetrics');
  if (!container) return;
  const metrics = getPatrimonioMetrics();
  const patrimonioSub = document.getElementById('patrimonioSub');
  if (patrimonioSub) {
    patrimonioSub.textContent = `${patrimonioAccounts.length} conta${patrimonioAccounts.length === 1 ? '' : 's'} com saldo acompanhado por movimentações manuais.`;
  }
  const patrimonioGuide = document.getElementById('patrimonioGuide');
  if (patrimonioGuide) {
    patrimonioGuide.innerHTML = '<strong>Onde está meu dinheiro guardado?</strong> Veja as contas à esquerda, escolha uma para acompanhar as movimentações e use os botões de entrada, saída ou transferência quando quiser atualizar o saldo.';
  }
  container.innerHTML = `
    <div class="metric-card metric-card-wealth">
      <span>Patrimônio total</span>
      <strong>${fmt(metrics.patrimonioTotal)}</strong>
    </div>
    <div class="metric-card metric-card-goals">
      <span>Variação do mês</span>
      <strong class="${metrics.currentMonthVariation >= 0 ? 'amount-pos' : 'amount-neg'}">${fmtSigned(metrics.currentMonthVariation)}</strong>
    </div>
  `;
}

function renderPatrimonioAccounts() {
  const grid = document.getElementById('patrimonioAccountsGrid');
  if (!grid) return;
  const rows = getPatrimonioFilteredAccounts();
  if (!rows.length) {
    grid.innerHTML = '<div class="patrimonio-empty">Nenhuma conta patrimonial cadastrada ainda.</div>';
    return;
  }
  grid.innerHTML = rows.map(account => {
    const visual = inferPatrimonioVisual(account.nome, account.tipo);
    const cardStyle = getPatrimonioAccountCardStyle(account);
    return `
      <article class="patrimonio-account-card ${account.id === patrimonioSelectedAccountId ? 'active' : ''}" ${cardStyle ? `style="${cardStyle}"` : ''}>
        <button class="patrimonio-account-main" type="button" onclick="selectPatrimonioAccount('${account.id}')">
          <div class="patrimonio-account-top">
            <div class="patrimonio-account-identity">
              ${renderPatrimonioAccountBadge(account, visual)}
              <strong>${escapeHtml(account.nome)}</strong>
            </div>
            <span class="patrimonio-balance">${fmt(account.saldo)}</span>
          </div>
        </button>
        <div class="patrimonio-account-actions">
          <button class="btn btn-ghost" type="button" onclick="openPatrimonioAccountModal('${account.id}')">Editar</button>
          <button class="btn btn-ghost" type="button" onclick="deletePatrimonioAccount('${account.id}')">Excluir</button>
        </div>
      </article>
    `;
  }).join('');
}

// Final clarity override for Patrimonio metrics and top summary.
function renderPatrimonioMetrics() {
  const container = document.getElementById('patrimonioMetrics');
  if (!container) return;

  const metrics = getPatrimonioMetrics();
  const accounts = getPatrimonioFilteredAccounts();
  const positiveAccounts = accounts.filter(account => account.saldo > 0);
  const topAccount = [...accounts].sort((a, b) => b.saldo - a.saldo)[0] || null;

  const patrimonioSub = document.getElementById('patrimonioSub');
  if (patrimonioSub) {
    patrimonioSub.textContent = `${patrimonioAccounts.length} conta${patrimonioAccounts.length === 1 ? '' : 's'} com saldo acompanhado por movimentacoes manuais.`;
  }

  const patrimonioGuide = document.getElementById('patrimonioGuide');
  if (patrimonioGuide) {
    patrimonioGuide.innerHTML = '<strong>Onde esta meu dinheiro guardado?</strong> Veja primeiro as contas e os saldos. Depois, abra as movimentacoes da conta escolhida para entender como esse patrimonio mudou.';
  }

  container.innerHTML = `
    <div class="metric-card metric-card-wealth">
      <span>Patrimonio total</span>
      <strong>${fmt(metrics.patrimonioTotal)}</strong>
    </div>
    <div class="metric-card metric-card-goals">
      <span>Variacao do mes</span>
      <strong class="${metrics.currentMonthVariation >= 0 ? 'amount-pos' : 'amount-neg'}">${fmtSigned(metrics.currentMonthVariation)}</strong>
    </div>
  `;

  const patrimonioInsights = document.getElementById('patrimonioInsights');
  if (patrimonioInsights) {
    patrimonioInsights.innerHTML = `
      <div class="insight-card is-structure">
        <strong>Leitura patrimonial</strong>
        ${accounts.length
          ? `${positiveAccounts.length} de ${accounts.length} conta${accounts.length === 1 ? '' : 's'} estao com saldo positivo.`
          : 'Crie a primeira conta patrimonial para acompanhar onde o dinheiro esta guardado.'}
      </div>
      <div class="insight-card ${topAccount && topAccount.saldo > 0 ? 'is-structure' : 'is-planning'}">
        <strong>Maior concentracao</strong>
        ${topAccount && topAccount.saldo > 0
          ? `${escapeHtml(topAccount.nome)} concentra ${fmt(topAccount.saldo)} do patrimonio atual.`
          : 'Ainda nao existe saldo suficiente para destacar uma conta principal.'}
      </div>
      <div class="insight-card ${metrics.currentMonthVariation >= 0 ? 'is-positive' : 'is-negative'}">
        <strong>Movimento do mes</strong>
        ${metrics.currentMonthVariation >= 0
          ? `As movimentacoes do mes aumentaram o patrimonio em ${fmt(metrics.currentMonthVariation)}.`
          : `As movimentacoes do mes reduziram o patrimonio em ${fmt(Math.abs(metrics.currentMonthVariation))}.`}
      </div>
    `;
  }
}

function renderPatrimonioMovementRow(account, movement) {
  const isTransferOut = movement.type === 'transferencia' && movement.fromAccountId === account.id;
  const rowType = movement.type === 'transferencia'
    ? 'transfer'
    : movement.type === 'retirada'
      ? 'expense'
      : 'income';
  const direction = movement.type === 'retirada' || isTransferOut ? -1 : 1;
  const symbol = movement.type === 'transferencia'
    ? '⇄'
    : movement.type === 'retirada'
      ? '−'
      : '+';
  const movementTitle = movement.type === 'transferencia'
    ? (isTransferOut ? 'Transferência enviada' : 'Transferência recebida')
    : movement.type === 'retirada'
      ? 'Retirada'
      : 'Aporte';
  const counterpart = movement.type === 'transferencia'
    ? (isTransferOut
      ? `Para ${getPatrimonioAccountById(movement.toAccountId)?.nome || 'Conta removida'}`
      : `De ${getPatrimonioAccountById(movement.fromAccountId)?.nome || 'Conta removida'}`)
    : (movement.description || '');
  return `
    <tr class="patrimonio-movement-row ${rowType}">
      <td class="patrimonio-date-cell" style="padding-left:22px">${formatPatrimonioDate(movement.date)}</td>
      <td>
        <div class="patrimonio-movement-copy">
          <strong><span class="patrimonio-movement-symbol ${rowType}">${symbol}</span>${movementTitle}</strong>
          ${counterpart ? `<small>${escapeHtml(counterpart)}</small>` : ''}
        </div>
      </td>
      <td class="amount ${direction >= 0 ? 'amount-pos' : 'amount-neg'}">${direction >= 0 ? fmt(movement.value) : `- ${fmt(movement.value)}`}</td>
      <td class="patrimonio-action-cell">
        ${movement.sourceType === 'financial-goal'
          ? '<span class="patrimonio-status-chip neutral">Meta</span>'
          : `<button class="btn-icon" type="button" onclick="openPatrimonioMovementModal({ movementId: '${movement.id}' })">✎</button>`}
        <button class="btn-icon" type="button" onclick="deletePatrimonioMovement('${movement.id}')">✕</button>
      </td>
    </tr>
  `;
}

function renderPatrimonioDetail() {
  const container = document.getElementById('patrimonioDetail');
  if (!container) return;
  const account = getPatrimonioSelectedAccount();
  if (!account) {
    container.innerHTML = '<div class="patrimonio-empty">Selecione uma conta para ver as movimentações.</div>';
    return;
  }
  const movements = getPatrimonioFilteredMovements().filter(movement =>
    movement.accountId === account.id ||
    movement.fromAccountId === account.id ||
    movement.toAccountId === account.id
  );
  const saldo = getPatrimonioBalanceForAccount(account.id);
  const visual = inferPatrimonioVisual(account.nome, account.tipo);
  container.innerHTML = `
    <div class="patrimonio-detail-head">
      <div>
        <h3 class="patrimonio-detail-title">${renderPatrimonioAccountBadge(account, visual)}<span>${escapeHtml(account.nome)}</span></h3>
        ${account.observacao ? `<p class="patrimonio-note">${escapeHtml(account.observacao)}</p>` : ''}
        <div class="patrimonio-detail-actions">
          <button class="btn btn-primary patrimonio-move-btn" type="button" title="Adicionar" onclick="openPatrimonioMovementModal({ accountId: '${account.id}', type: 'aporte' })">+</button>
          <button class="btn btn-ghost patrimonio-move-btn" type="button" title="Retirar" onclick="openPatrimonioMovementModal({ accountId: '${account.id}', type: 'retirada' })">−</button>
          <button class="btn btn-ghost patrimonio-move-btn" type="button" title="Transferir" onclick="openPatrimonioMovementModal({ accountId: '${account.id}', type: 'transferencia' })">⇄</button>
        </div>
      </div>
      <div class="patrimonio-detail-balance">${fmt(saldo)}</div>
    </div>
    <div class="patrimonio-detail-table-wrap">
      <table class="fin-table patrimonio-table patrimonio-compact-table">
        <thead>
          <tr>
            <th style="padding-left:22px">Data</th>
            <th></th>
            <th>Valor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${movements.length
            ? movements.map(movement => renderPatrimonioMovementRow(account, movement)).join('')
            : '<tr><td colspan="4" style="padding:18px 22px;color:var(--text3)">Nenhuma movimentação encontrada.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function getPatrimonioPeriodWindows() {
  const now = new Date();
  const endCurrent = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const periodDays = Number(patrimonioFilters?.period || 0);
  if (periodDays > 0) {
    const startCurrent = new Date(endCurrent);
    startCurrent.setDate(startCurrent.getDate() - (periodDays - 1));
    startCurrent.setHours(0, 0, 0, 0);
    const endPrevious = new Date(startCurrent.getTime() - 1);
    const startPrevious = new Date(endPrevious);
    startPrevious.setDate(startPrevious.getDate() - (periodDays - 1));
    startPrevious.setHours(0, 0, 0, 0);
    return { startCurrent, endCurrent, startPrevious, endPrevious };
  }

  const startCurrent = new Date(endCurrent.getFullYear(), endCurrent.getMonth(), 1, 0, 0, 0, 0);
  const endPrevious = new Date(startCurrent.getTime() - 1);
  const startPrevious = new Date(endPrevious.getFullYear(), endPrevious.getMonth(), 1, 0, 0, 0, 0);
  return { startCurrent, endCurrent, startPrevious, endPrevious };
}

function sumPatrimonioImpactsInRange(startDate, endDate) {
  const minTime = startDate.getTime();
  const maxTime = endDate.getTime();
  return Number(patrimonioMovements.reduce((acc, movement) => {
    const time = parsePatrimonioDate(movement.date);
    if (!time || time < minTime || time > maxTime) return acc;
    return acc + getPatrimonioMovementImpact(movement);
  }, 0).toFixed(2));
}

function getPatrimonioMetrics() {
  const accounts = getPatrimonioFilteredAccounts();
  const patrimonioTotal = Number(accounts.reduce((acc, account) => acc + account.saldo, 0).toFixed(2));
  const { startCurrent, endCurrent, startPrevious, endPrevious } = getPatrimonioPeriodWindows();
  const currentMonthVariation = sumPatrimonioImpactsInRange(startCurrent, endCurrent);
  const previousPeriodVariation = sumPatrimonioImpactsInRange(startPrevious, endPrevious);
  const comparisonVariation = Number((currentMonthVariation - previousPeriodVariation).toFixed(2));
  return {
    patrimonioTotal,
    currentMonthVariation,
    previousPeriodVariation,
    comparisonVariation
  };
}

function getPatrimonioCollapsibleState() {
  const raw = Storage.getJSON('finPatrimonioCollapsibleState', {});
  if (raw?.initialized !== true) {
    return { charts: true, forecasts: true, initialized: true };
  }
  return {
    charts: raw?.charts !== false,
    forecasts: raw?.forecasts !== false,
    initialized: true
  };
}

function savePatrimonioCollapsibleState(nextState) {
  Storage.setJSON('finPatrimonioCollapsibleState', {
    charts: nextState?.charts !== false,
    forecasts: nextState?.forecasts !== false,
    initialized: true
  });
}

function updatePatrimonioSummaryToggle(detailsEl) {
  if (!detailsEl) return;
  const textNode = detailsEl.querySelector('.patrimonio-summary-toggle');
  if (!textNode) return;
  textNode.textContent = detailsEl.open ? 'Ocultar' : 'Mostrar';
}

function setupPatrimonioCollapsibles() {
  const chartsDetails = document.querySelector('.patrimonio-charts-section');
  const forecastsDetails = document.querySelector('.patrimonio-forecast-section');
  if (!chartsDetails || !forecastsDetails) return;
  const state = getPatrimonioCollapsibleState();
  savePatrimonioCollapsibleState(state);
  chartsDetails.open = state.charts;
  forecastsDetails.open = state.forecasts;
  updatePatrimonioSummaryToggle(chartsDetails);
  updatePatrimonioSummaryToggle(forecastsDetails);

  if (!chartsDetails.dataset.boundToggle) {
    chartsDetails.addEventListener('toggle', () => {
      const current = getPatrimonioCollapsibleState();
      current.charts = chartsDetails.open;
      savePatrimonioCollapsibleState(current);
      updatePatrimonioSummaryToggle(chartsDetails);
    });
    chartsDetails.dataset.boundToggle = '1';
  }
  if (!forecastsDetails.dataset.boundToggle) {
    forecastsDetails.addEventListener('toggle', () => {
      const current = getPatrimonioCollapsibleState();
      current.forecasts = forecastsDetails.open;
      savePatrimonioCollapsibleState(current);
      updatePatrimonioSummaryToggle(forecastsDetails);
    });
    forecastsDetails.dataset.boundToggle = '1';
  }
}

function renderPatrimonioMetrics() {
  const container = document.getElementById('patrimonioMetrics');
  if (!container) return;
  const metrics = getPatrimonioMetrics();
  const patrimonioSub = document.getElementById('patrimonioSub');
  if (patrimonioSub) {
    patrimonioSub.textContent = `${patrimonioAccounts.length} conta${patrimonioAccounts.length === 1 ? '' : 's'} acompanhada${patrimonioAccounts.length === 1 ? '' : 's'} por movimentacoes manuais.`;
  }
  const patrimonioGuide = document.getElementById('patrimonioGuide');
  if (patrimonioGuide) {
    patrimonioGuide.innerHTML = '<strong>Onde esta meu dinheiro guardado?</strong> Veja primeiro as contas e os saldos. Depois, acompanhe as movimentacoes da conta escolhida sem misturar isso com a operacao mensal.';
  }
  container.innerHTML = `
    <div class="metric-card metric-card-wealth">
      <span>Patrimonio total</span>
      <strong>${fmt(metrics.patrimonioTotal)}</strong>
    </div>
    <div class="metric-card metric-card-goals">
      <span>Variacao do periodo</span>
      <strong class="${metrics.currentMonthVariation >= 0 ? 'amount-pos' : 'amount-neg'}">${fmtSigned(metrics.currentMonthVariation)}</strong>
      <small class="${metrics.comparisonVariation >= 0 ? 'amount-pos' : 'amount-neg'}">vs periodo anterior: ${fmtSigned(metrics.comparisonVariation)}</small>
    </div>
  `;
}

function renderPatrimonio() {
  ensurePatrimonioData();
  renderTitles();
  renderPatrimonioMetrics();
  renderPatrimonioAccounts();
  renderPatrimonioDetail();
  renderPatrimonioCharts();
  renderPatrimonioForecasts();
  setupPatrimonioCollapsibles();

  const searchNode = document.getElementById('patrimonioSearch');
  if (searchNode && searchNode.value !== patrimonioFilters.search) searchNode.value = patrimonioFilters.search;
  const sortNode = document.getElementById('patrimonioSort');
  if (sortNode) sortNode.value = patrimonioFilters.sort;
  const periodNode = document.getElementById('patrimonioPeriod');
  if (periodNode) periodNode.value = patrimonioFilters.period;
  if (typeof renderNotificationBells === 'function') renderNotificationBells();
}

function changeFinancialGoalPatrimonioAccount(index, accountId, triggerEl = null) {
  const month = getCurrentMonth();
  if (!month || !month.financialGoals?.[index]) return;
  const goal = month.financialGoals[index];
  const anchor = goal?.id ? `[data-goal-row="${goal.id}"]` : '#section-goals';
  if (triggerEl?.blur) triggerEl.blur();
  if (goal.patrimonioTransferredAt) {
    alert('Essa meta já foi enviada para o patrimônio. Exclua a movimentação correspondente se quiser mudar o destino.');
    preserveElementViewportPosition(anchor, () => renderMes());
    return;
  }
  recordHistoryState();
  goal.patrimonioAccountId = accountId;
  if (!accountId) {
    goal.patrimonioTransferredAt = '';
    goal.patrimonioMovementId = '';
  }
  save();
  preserveElementViewportPosition(anchor, () => {
    renderMes();
    if (activePage === 'patrimonio') renderPatrimonio();
  });
}

function transferFinancialGoalToPatrimonio(monthId, goalId, triggerEl = null) {
  ensurePatrimonioData();
  const month = data.find(item => item.id === monthId);
  const goal = month?.financialGoals?.find(item => item.id === goalId);
  if (!month || !goal) return;
  const anchor = goal?.id ? `[data-goal-row="${goal.id}"]` : '#section-goals';
  if (!goal.patrimonioAccountId) {
    alert('Escolha primeiro a conta patrimonial de destino.');
    return;
  }
  if (goal.patrimonioTransferredAt && goal.patrimonioMovementId) {
    alert('Essa meta já foi enviada para o patrimônio.');
    return;
  }
  const account = getPatrimonioAccountById(goal.patrimonioAccountId);
  if (!account) {
    alert('A conta patrimonial escolhida não existe mais.');
    return;
  }
  recordHistoryState();
  const movement = normalizePatrimonioMovement({
    id: patrimonioId('mov'),
    type: 'aporte',
    accountId: account.id,
    value: goal.valor,
    description: `Meta financeira · ${goal.nome}`,
    date: todayIsoDate(),
    createdAt: new Date().toISOString(),
    sourceType: 'financial-goal',
    sourceMonthId: month.id,
    sourceGoalId: goal.id
  });
  patrimonioMovements.unshift(movement);
  goal.patrimonioMovementId = movement.id;
  goal.patrimonioTransferredAt = new Date().toISOString();
  patrimonioSelectedAccountId = account.id;
  savePatrimonioData();
  preserveElementViewportPosition(anchor, () => {
    renderMes();
    if (activePage === 'patrimonio') renderPatrimonio();
  });
}

// Final overrides for financial goal interactions.
function changeFinancialGoalPatrimonioAccount(index, accountId, triggerEl = null) {
  const month = getCurrentMonth();
  if (!month || !month.financialGoals?.[index]) return;
  const goal = month.financialGoals[index];
  const anchor = goal?.id ? `[data-goal-row="${goal.id}"]` : '#section-goals';
  if (triggerEl?.blur) triggerEl.blur();
  if (goal.patrimonioTransferredAt) {
    alert('Essa meta já foi enviada para o patrimônio. Exclua a movimentação correspondente se quiser mudar o destino.');
    preserveElementViewportPosition(anchor, () => renderMes());
    return;
  }
  recordHistoryState();
  goal.patrimonioAccountId = accountId;
  if (!accountId) {
    goal.patrimonioTransferredAt = '';
    goal.patrimonioMovementId = '';
  }
  save();
  preserveElementViewportPosition(anchor, () => {
    renderMes();
    if (activePage === 'patrimonio') renderPatrimonio();
  });
}

function transferFinancialGoalToPatrimonio(monthId, goalId, triggerEl = null) {
  ensurePatrimonioData();
  const month = data.find(item => item.id === monthId);
  const goal = month?.financialGoals?.find(item => item.id === goalId);
  if (!month || !goal) return;
  const anchor = goal?.id ? `[data-goal-row="${goal.id}"]` : '#section-goals';
  if (!goal.patrimonioAccountId) {
    alert('Escolha primeiro a conta patrimonial de destino.');
    return;
  }
  if (goal.patrimonioTransferredAt && goal.patrimonioMovementId) {
    alert('Essa meta já foi enviada para o patrimônio.');
    return;
  }
  const account = getPatrimonioAccountById(goal.patrimonioAccountId);
  if (!account) {
    alert('A conta patrimonial escolhida não existe mais.');
    return;
  }
  recordHistoryState();
  const movement = normalizePatrimonioMovement({
    id: patrimonioId('mov'),
    type: 'aporte',
    accountId: account.id,
    value: goal.valor,
    description: `Meta financeira · ${goal.nome}`,
    date: todayIsoDate(),
    createdAt: new Date().toISOString(),
    sourceType: 'financial-goal',
    sourceMonthId: month.id,
    sourceGoalId: goal.id
  });
  patrimonioMovements.unshift(movement);
  goal.patrimonioMovementId = movement.id;
  goal.patrimonioTransferredAt = new Date().toISOString();
  patrimonioSelectedAccountId = account.id;
  savePatrimonioData();
  preserveElementViewportPosition(anchor, () => {
    renderMes();
    if (activePage === 'patrimonio') renderPatrimonio();
  });
}

function changeFinancialGoalPatrimonioAccount(index, accountId, triggerEl = null) {
  const month = getCurrentMonth();
  if (!month || !month.financialGoals?.[index]) return;
  const goal = month.financialGoals[index];
  const anchor = triggerEl?.closest?.('tr') || (goal?.id ? `[data-goal-row="${goal.id}"]` : '#section-goals');
  if (triggerEl?.blur) triggerEl.blur();
  if (month.financialGoals[index].patrimonioTransferredAt) {
    alert('Essa meta já foi enviada para o patrimônio. Exclua a movimentação correspondente se quiser mudar o destino.');
    preserveElementViewportPosition(anchor, () => renderMes());
    return;
  }
  recordHistoryState();
  month.financialGoals[index].patrimonioAccountId = accountId;
  if (!accountId) {
    month.financialGoals[index].patrimonioTransferredAt = '';
    month.financialGoals[index].patrimonioMovementId = '';
  }
  save();
  preserveElementViewportPosition(anchor, () => {
    renderMes();
    if (activePage === 'patrimonio') renderPatrimonio();
  });
}

function transferFinancialGoalToPatrimonio(monthId, goalId, triggerEl = null) {
  ensurePatrimonioData();
  const month = data.find(item => item.id === monthId);
  const goal = month?.financialGoals?.find(item => item.id === goalId);
  if (!month || !goal) return;
  const anchor = triggerEl?.closest?.('#section-goals') || '#section-goals';
  if (!goal.patrimonioAccountId) {
    alert('Escolha primeiro a conta patrimonial de destino.');
    return;
  }
  if (goal.patrimonioTransferredAt && goal.patrimonioMovementId) {
    alert('Essa meta já foi enviada para o patrimônio.');
    return;
  }
  const account = getPatrimonioAccountById(goal.patrimonioAccountId);
  if (!account) {
    alert('A conta patrimonial escolhida não existe mais.');
    return;
  }
  recordHistoryState();
  const movement = normalizePatrimonioMovement({
    id: patrimonioId('mov'),
    type: 'aporte',
    accountId: account.id,
    value: goal.valor,
    description: `Meta financeira · ${goal.nome}`,
    date: todayIsoDate(),
    createdAt: new Date().toISOString(),
    sourceType: 'financial-goal',
    sourceMonthId: month.id,
    sourceGoalId: goal.id
  });
  patrimonioMovements.unshift(movement);
  goal.patrimonioMovementId = movement.id;
  goal.patrimonioTransferredAt = new Date().toISOString();
  patrimonioSelectedAccountId = account.id;
  savePatrimonioData();
  preserveElementViewportPosition(anchor, () => {
    renderMes();
    if (activePage === 'patrimonio') renderPatrimonio();
  });
}

function renderPatrimonioCharts() {
  const evolutionCanvas = document.getElementById('patrimonioEvolutionChart');
  const distributionCanvas = document.getElementById('patrimonioDistributionChart');
  if (!evolutionCanvas || !distributionCanvas) return;

  const evolution = getPatrimonioEvolutionSeries();
  if (charts.patrimonioEvolution) charts.patrimonioEvolution.destroy();
  charts.patrimonioEvolution = new Chart(evolutionCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: evolution.map(point => formatPatrimonioDate(point.date)),
      datasets: [{
        label: 'Patrimônio total',
        data: evolution.map(point => point.total),
        borderColor: '#1f6f5f',
        backgroundColor: 'rgba(31,111,95,.12)',
        borderWidth: 3,
        pointRadius: 3,
        tension: 0.28,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: { callback: value => fmt(Number(value || 0)) }
        }
      }
    }
  });

  const distribution = getPatrimonioDistributionSeries();
  if (charts.patrimonioDistribution) charts.patrimonioDistribution.destroy();
  charts.patrimonioDistribution = new Chart(distributionCanvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: distribution.map(item => item.name),
      datasets: [{
        data: distribution.map(item => item.value),
        backgroundColor: ['#1f6f5f', '#2855a0', '#8e6a1f', '#a6402f', '#6b5ca5', '#4b7c59', '#c47d2d', '#3b6b99']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, color: '#53493c' }
        }
      }
    }
  });
}

// Daily-use overrides: cleaner copy, quicker empty states, and compact modals.
function openPatrimonioMovementModal(options = {}) {
  ensurePatrimonioData();
  const movement = options.movementId ? patrimonioMovements.find(item => item.id === options.movementId) : null;
  const presetType = options.type || movement?.type || 'aporte';
  const title = movement
    ? 'Editar movimentação'
    : presetType === 'retirada'
      ? 'Nova retirada'
      : presetType === 'transferencia'
        ? 'Nova transferência'
        : 'Novo aporte';
  document.getElementById('patrimonioMovementModalTitle').textContent = title;
  document.getElementById('patrimonioMovementId').value = movement?.id || '';
  document.getElementById('patrimonioMovementType').value = presetType;
  document.getElementById('patrimonioMovementAccount').innerHTML = getPatrimonioAccountOptions(options.accountId || movement?.accountId || patrimonioSelectedAccountId || '', false);
  document.getElementById('patrimonioMovementFrom').innerHTML = getPatrimonioAccountOptions(movement?.fromAccountId || options.accountId || patrimonioSelectedAccountId || '', false);
  document.getElementById('patrimonioMovementTo').innerHTML = getPatrimonioAccountOptions(movement?.toAccountId || '', false);
  document.getElementById('patrimonioMovementValue').value = movement?.value ?? options.value ?? '';
  document.getElementById('patrimonioMovementDescription').value = movement?.description ?? options.description ?? '';
  document.getElementById('patrimonioMovementDate').value = movement?.date || options.date || todayIsoDate();
  const extras = document.getElementById('patrimonioMovementExtras');
  if (extras) extras.open = Boolean(movement?.description);
  syncPatrimonioMovementModalVisibility();
  openModal('modalPatrimonioMovement');
}

function renderPatrimonioMetrics() {
  const container = document.getElementById('patrimonioMetrics');
  if (!container) return;
  const metrics = getPatrimonioMetrics();
  const patrimonioSub = document.getElementById('patrimonioSub');
  if (patrimonioSub) {
    patrimonioSub.textContent = `${patrimonioAccounts.length} conta${patrimonioAccounts.length === 1 ? '' : 's'} patrimonial${patrimonioAccounts.length === 1 ? '' : 'is'} cadastrada${patrimonioAccounts.length === 1 ? '' : 's'}.`;
  }
  const patrimonioGuide = document.getElementById('patrimonioGuide');
  if (patrimonioGuide) {
    patrimonioGuide.innerHTML = '<strong>Onde está meu dinheiro?</strong> Veja primeiro as contas e os saldos. As movimentações detalhadas e as análises ficam abaixo, sem tirar o foco do patrimônio atual.';
  }
  container.innerHTML = `
    <div class="metric-card metric-card-wealth">
      <span>Patrimônio total</span>
      <strong>${fmt(metrics.patrimonioTotal)}</strong>
    </div>
    <div class="metric-card metric-card-goals">
      <span>Variação do mês</span>
      <strong class="${metrics.currentMonthVariation >= 0 ? 'amount-pos' : 'amount-neg'}">${fmtSigned(metrics.currentMonthVariation)}</strong>
    </div>
  `;
}

function renderPatrimonioAccounts() {
  const grid = document.getElementById('patrimonioAccountsGrid');
  if (!grid) return;
  const rows = getPatrimonioFilteredAccounts();
  if (!rows.length) {
    grid.innerHTML = '<div class="patrimonio-empty">Nenhuma conta patrimonial cadastrada ainda. Crie a primeira conta para começar a acompanhar onde o dinheiro está guardado.</div>';
    return;
  }
  grid.innerHTML = rows.map(account => {
    const visual = inferPatrimonioVisual(account.nome, account.tipo);
    const cardStyle = getPatrimonioAccountCardStyle(account);
    return `
      <article class="patrimonio-account-card ${account.id === patrimonioSelectedAccountId ? 'active' : ''}" ${cardStyle ? `style="${cardStyle}"` : ''}>
        <button class="patrimonio-account-main" type="button" onclick="selectPatrimonioAccount('${account.id}')">
          <div class="patrimonio-account-top">
            <div class="patrimonio-account-identity">
              ${renderPatrimonioAccountBadge(account, visual)}
              <strong>${escapeHtml(account.nome)}</strong>
            </div>
            <span class="patrimonio-balance">${fmt(account.saldo)}</span>
          </div>
        </button>
        <div class="patrimonio-account-actions">
          <button class="btn btn-ghost" type="button" onclick="openPatrimonioAccountModal('${account.id}')">Editar</button>
          <button class="btn btn-ghost" type="button" onclick="deletePatrimonioAccount('${account.id}')">Excluir</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderPatrimonioMovementRow(account, movement) {
  const isTransferOut = movement.type === 'transferencia' && movement.fromAccountId === account.id;
  const rowType = movement.type === 'transferencia'
    ? 'transfer'
    : movement.type === 'retirada'
      ? 'expense'
      : 'income';
  const direction = movement.type === 'retirada' || isTransferOut ? -1 : 1;
  const symbol = movement.type === 'transferencia'
    ? '⇄'
    : movement.type === 'retirada'
      ? '−'
      : '+';
  const movementTitle = movement.type === 'transferencia'
    ? (isTransferOut ? 'Transferência enviada' : 'Transferência recebida')
    : movement.type === 'retirada'
      ? 'Retirada'
      : 'Aporte';
  const counterpart = movement.type === 'transferencia'
    ? (isTransferOut
      ? `Para ${getPatrimonioAccountById(movement.toAccountId)?.nome || 'Conta removida'}`
      : `De ${getPatrimonioAccountById(movement.fromAccountId)?.nome || 'Conta removida'}`)
    : (movement.description || '');

  return `
    <tr class="patrimonio-movement-row ${rowType}">
      <td class="patrimonio-date-cell" style="padding-left:22px">${formatPatrimonioDate(movement.date)}</td>
      <td>
        <div class="patrimonio-movement-copy">
          <strong><span class="patrimonio-movement-symbol ${rowType}">${symbol}</span>${movementTitle}</strong>
          ${counterpart ? `<small>${escapeHtml(counterpart)}</small>` : ''}
        </div>
      </td>
      <td class="amount ${direction >= 0 ? 'amount-pos' : 'amount-neg'}">${direction >= 0 ? fmt(movement.value) : `- ${fmt(movement.value)}`}</td>
      <td class="patrimonio-action-cell">
        ${movement.sourceType === 'financial-goal'
          ? '<span class="patrimonio-status-chip neutral">Meta</span>'
          : `<button class="btn-icon" type="button" onclick="openPatrimonioMovementModal({ movementId: '${movement.id}' })">✎</button>`}
        <button class="btn-icon" type="button" onclick="deletePatrimonioMovement('${movement.id}')">✕</button>
      </td>
    </tr>
  `;
}

function renderPatrimonioDetail() {
  const container = document.getElementById('patrimonioDetail');
  if (!container) return;
  const account = getPatrimonioSelectedAccount();
  if (!account) {
    container.innerHTML = '<div class="patrimonio-empty">Selecione uma conta à esquerda para ver as movimentações e registrar aporte, retirada ou transferência.</div>';
    return;
  }
  const movements = getPatrimonioFilteredMovements().filter(movement =>
    movement.accountId === account.id ||
    movement.fromAccountId === account.id ||
    movement.toAccountId === account.id
  );
  const saldo = getPatrimonioBalanceForAccount(account.id);
  const visual = inferPatrimonioVisual(account.nome, account.tipo);
  container.innerHTML = `
    <div class="patrimonio-detail-head">
      <div>
        <h3 class="patrimonio-detail-title">${renderPatrimonioAccountBadge(account, visual)}<span>${escapeHtml(account.nome)}</span></h3>
        ${account.observacao ? `<p class="patrimonio-note">${escapeHtml(account.observacao)}</p>` : ''}
        <div class="patrimonio-detail-actions">
          <button class="btn btn-primary patrimonio-move-btn" type="button" title="Adicionar" onclick="openPatrimonioMovementModal({ accountId: '${account.id}', type: 'aporte' })">+</button>
          <button class="btn btn-ghost patrimonio-move-btn" type="button" title="Retirar" onclick="openPatrimonioMovementModal({ accountId: '${account.id}', type: 'retirada' })">−</button>
          <button class="btn btn-ghost patrimonio-move-btn" type="button" title="Transferir" onclick="openPatrimonioMovementModal({ accountId: '${account.id}', type: 'transferencia' })">⇄</button>
        </div>
      </div>
      <div class="patrimonio-detail-balance">${fmt(saldo)}</div>
    </div>
    <div class="patrimonio-detail-table-wrap">
      <table class="fin-table patrimonio-table patrimonio-compact-table">
        <thead>
          <tr>
            <th style="padding-left:22px">Data</th>
            <th></th>
            <th>Valor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${movements.length
            ? movements.map(movement => renderPatrimonioMovementRow(account, movement)).join('')
            : '<tr><td colspan="4" style="padding:18px 22px;color:var(--text3)">Nenhuma movimentação encontrada para esta conta ainda. Use + para registrar o primeiro aporte.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function renderPatrimonioCharts() {
  const evolutionCanvas = document.getElementById('patrimonioEvolutionChart');
  const distributionCanvas = document.getElementById('patrimonioDistributionChart');
  if (!evolutionCanvas || !distributionCanvas) return;

  const evolution = getPatrimonioEvolutionSeries();
  if (charts.patrimonioEvolution) charts.patrimonioEvolution.destroy();
  charts.patrimonioEvolution = new Chart(evolutionCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: evolution.map(point => formatPatrimonioDate(point.date)),
      datasets: [{
        label: 'Patrimônio total',
        data: evolution.map(point => point.total),
        borderColor: '#1f6f5f',
        backgroundColor: 'rgba(31,111,95,.12)',
        borderWidth: 3,
        pointRadius: 3,
        tension: 0.28,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: { callback: value => fmt(Number(value || 0)) }
        }
      }
    }
  });

  const distribution = getPatrimonioDistributionSeries();
  if (charts.patrimonioDistribution) charts.patrimonioDistribution.destroy();
  charts.patrimonioDistribution = new Chart(distributionCanvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: distribution.map(item => item.name),
      datasets: [{
        data: distribution.map(item => item.value),
        backgroundColor: ['#1f6f5f', '#2855a0', '#8e6a1f', '#a6402f', '#6b5ca5', '#4b7c59', '#c47d2d', '#3b6b99']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, color: '#53493c' }
        }
      }
    }
  });
}

function renderPatrimonioForecasts() {
  const body = document.getElementById('patrimonioForecastsBody');
  if (!body) return;
  const plannedGoals = getPatrimonioPlannedGoals();
  if (!plannedGoals.length) {
    body.innerHTML = '<tr><td colspan="5" style="padding:20px 22px;color:var(--text3)">Nenhuma meta financeira vinculada ao patrimônio ainda.</td></tr>';
    return;
  }
  body.innerHTML = plannedGoals.map(({ monthId, monthName, goal, account }) => {
    const visual = account ? inferPatrimonioVisual(account.nome, account.tipo) : null;
    return `
      <tr>
        <td style="padding-left:22px">${escapeHtml(monthName)}</td>
        <td>${escapeHtml(goal.nome || '—')}</td>
        <td>${account
          ? `<span class="movement-type-inline">${renderPatrimonioAccountBadge(account, visual)}<span>${escapeHtml(account.nome)}</span></span>`
          : '<span style="color:var(--text3)">Conta removida</span>'}</td>
        <td class="amount" style="color:var(--gold, #8e6a1f)">${fmt(goal.valor || 0)}</td>
        <td>
          ${goal.patrimonioTransferredAt
            ? '<span class="patrimonio-status-chip ok">Transferida</span>'
            : account
              ? `<button class="btn btn-ghost" type="button" onclick="transferFinancialGoalToPatrimonio('${monthId}','${goal.id}')">Adicionar ao patrimônio</button>`
              : '<span class="patrimonio-status-chip warn">Sem conta</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

function renderPatrimonio() {
  ensurePatrimonioData();
  renderTitles();
  renderPatrimonioMetrics();
  renderPatrimonioAccounts();
  renderPatrimonioDetail();
  renderPatrimonioCharts();
  renderPatrimonioForecasts();

  const searchNode = document.getElementById('patrimonioSearch');
  if (searchNode && searchNode.value !== patrimonioFilters.search) searchNode.value = patrimonioFilters.search;
  const sortNode = document.getElementById('patrimonioSort');
  if (sortNode) sortNode.value = patrimonioFilters.sort;
  const periodNode = document.getElementById('patrimonioPeriod');
  if (periodNode) periodNode.value = patrimonioFilters.period;
  if (typeof renderNotificationBells === 'function') renderNotificationBells();
}

function getPatrimonioAccountCardStyle(account) {
  if (!account?.color) return '';
  const color = account.color;
  return [
    `--patrimonio-accent:${color}`,
    `--patrimonio-card-bg:linear-gradient(180deg, ${hexToRgba(color, 0.14)}, ${hexToRgba(color, 0.09)})`,
    `--patrimonio-card-border:${hexToRgba(color, 0.22)}`,
    `--patrimonio-card-shadow:${hexToRgba(color, 0.12)}`,
    `--patrimonio-card-title:var(--text)`
  ].join(';');
}

function renderPatrimonioAccountColorGrid(selectedColor = '') {
  const grid = document.getElementById('patrimonioAccountColorGrid');
  const hidden = document.getElementById('patrimonioAccountColor');
  if (!grid || !hidden) return;
  const fallbackColor = PATRIMONIO_ACCOUNT_COLOR_OPTIONS[0]?.value || '#1f6f5f';
  const current = PATRIMONIO_ACCOUNT_COLOR_OPTIONS.some(option => option.value === selectedColor)
    ? selectedColor
    : fallbackColor;
  hidden.value = current;
  grid.innerHTML = PATRIMONIO_ACCOUNT_COLOR_OPTIONS.map(option => `
    <button
      type="button"
      class="dash-color-btn patrimonio-color-btn ${current === option.value ? 'active' : ''}"
      style="background:${option.style}"
      title="${option.label}"
      aria-label="${option.label}"
      onclick="setPatrimonioAccountColor('${option.value}')"
    >${current === option.value ? '✓' : ''}</button>
  `).join('');
}

function setPatrimonioAccountColor(color) {
  const hidden = document.getElementById('patrimonioAccountColor');
  if (!hidden) return;
  hidden.value = color;
  renderPatrimonioAccountColorGrid(color);
}

function setPatrimonioAccountKind(kind) {
  const normalized = ['institution', 'custom'].includes(kind) ? kind : 'custom';
  const input = document.getElementById('patrimonioAccountKind');
  if (input) input.value = normalized;
  document.querySelectorAll('.patrimonio-kind-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.kind === normalized);
  });
  const institutionWrap = document.getElementById('patrimonioAccountInstitutionWrap');
  if (institutionWrap) institutionWrap.style.display = normalized === 'institution' ? '' : 'none';
  const nameInput = document.getElementById('patrimonioAccountName');
  if (nameInput && !nameInput.value.trim()) {
    nameInput.placeholder = normalized === 'institution'
      ? 'ex: Conta principal'
      
      : 'ex: Reserva de emergencia';
  }
}

function syncPatrimonioAccountInstitution() {
  const kind = document.getElementById('patrimonioAccountKind')?.value || 'custom';
  if (kind !== 'institution') return;
  const institution = document.getElementById('patrimonioAccountInstitution')?.value || '';
  const meta = PATRIMONIO_INSTITUTION_META[institution];
  const nameInput = document.getElementById('patrimonioAccountName');
  if (nameInput && meta && !nameInput.value.trim()) {
    nameInput.placeholder = `ex: ${meta.label}`;
  }
}

function parsePatrimonioAmountInput(value) {
  return Math.max(0, Number(String(value || '').replace(',', '.')) || 0);
}

function renderPatrimonioAccountBadge(account, fallbackVisual) {
  const institution = String(account?.institution || '').trim().toLowerCase();
  const meta = PATRIMONIO_INSTITUTION_META[institution];
  if (!meta) return renderSmartIconBadge(fallbackVisual.icon, fallbackVisual.tone);
  return `<span class="smart-icon-badge smart-bank-badge ${meta.className}" aria-label="${meta.label}" title="${meta.label}">${meta.short}</span>`;
}

function openPatrimonioAccountModal(accountId = '', options = {}) {
  ensurePatrimonioData();
  const account = accountId ? getPatrimonioAccountById(accountId) : null;
  const presetType = !account ? String(options?.presetType || '').trim() : '';
  const presetName = !account ? String(options?.presetName || '').trim() : '';
  const presetColor = !account ? String(options?.presetColor || '').trim() : '';
  const initialColor = account?.color || presetColor || PATRIMONIO_ACCOUNT_COLOR_OPTIONS[0]?.value || '#1f6f5f';
  const initialKind = account?.kind || (account?.institution ? 'institution' : 'custom');
  document.getElementById('patrimonioAccountModalTitle').textContent = account ? 'Editar conta patrimonial' : 'Nova conta patrimonial';
  document.getElementById('patrimonioAccountId').value = account?.id || '';
  document.getElementById('patrimonioAccountName').value = account?.nome || presetName;
  document.getElementById('patrimonioAccountType').value = account?.tipo || (presetType && ['Conta corrente','Dinheiro','Poupança','Investimentos','VR/VA','Outros'].includes(presetType) ? presetType : 'Conta corrente');
  document.getElementById('patrimonioAccountInstitution').value = account?.institution || '';
  document.getElementById('patrimonioAccountNote').value = account?.observacao || '';
  document.getElementById('patrimonioAccountInitialValue').value = '';
  document.getElementById('patrimonioAccountColor').value = initialColor;
  renderPatrimonioAccountColorGrid(initialColor);
  setPatrimonioAccountKind(initialKind);
  syncPatrimonioAccountInstitution();
  const initialValueWrap = document.getElementById('patrimonioAccountInitialValueWrap');
  if (initialValueWrap) initialValueWrap.style.display = account ? 'none' : '';
  const extras = document.getElementById('patrimonioAccountExtras');
  if (extras) extras.open = Boolean(account && (account?.observacao || account?.institution || account?.color));
  openModal('modalPatrimonioAccount');
}

function savePatrimonioAccount() {
  ensurePatrimonioData();
  const id = document.getElementById('patrimonioAccountId').value;
  const kind = document.getElementById('patrimonioAccountKind').value || 'custom';
  let nome = document.getElementById('patrimonioAccountName').value.trim();
  const tipo = document.getElementById('patrimonioAccountType').value.trim();
  const institution = document.getElementById('patrimonioAccountInstitution').value.trim().toLowerCase();
  const observacao = document.getElementById('patrimonioAccountNote').value.trim();
  const color = document.getElementById('patrimonioAccountColor').value.trim();
  const initialValue = parsePatrimonioAmountInput(document.getElementById('patrimonioAccountInitialValue').value);
  if (kind === 'institution' && !PATRIMONIO_INSTITUTION_META[institution]) {
    alert('Selecione a instituição da conta.');
    return;
  }
  if (!nome) {
    if (kind === 'institution' && PATRIMONIO_INSTITUTION_META[institution]) nome = PATRIMONIO_INSTITUTION_META[institution].label;
  }
  if (!nome) {
    alert('Informe o nome da conta/ativo.');
    return;
  }
  recordHistoryState();
  let targetId = id;
  if (id) {
    const account = getPatrimonioAccountById(id);
    if (!account) return;
    account.nome = nome;
    account.tipo = tipo;
    account.kind = kind;
    account.institution = PATRIMONIO_INSTITUTION_META[institution] ? institution : '';
    account.observacao = observacao;
    account.color = color;
  } else {
    const newId = patrimonioId('account');
    targetId = newId;
    patrimonioAccounts.unshift(normalizePatrimonioAccount({
      id: newId,
      nome,
      tipo,
      kind,
      institution,
      observacao,
      color,
      createdAt: new Date().toISOString()
    }));
    if (initialValue > 0) {
      patrimonioMovements.unshift(normalizePatrimonioMovement({
        id: patrimonioId('mov'),
        type: 'aporte',
        accountId: newId,
        value: initialValue,
        description: 'Saldo inicial',
        date: todayIsoDate(),
        createdAt: new Date().toISOString(),
        sourceType: 'initial-balance'
      }));
    }
  }
  ensurePatrimonioData();
  patrimonioSelectedAccountId = targetId || patrimonioSelectedAccountId;
  savePatrimonioData();
  closeModal('modalPatrimonioAccount');
  renderPatrimonio();
  renderMes();
}

function deletePatrimonioAccount(accountId) {
  ensurePatrimonioData();
  const relatedMovements = patrimonioMovements.filter(movement =>
    movement.accountId === accountId || movement.fromAccountId === accountId || movement.toAccountId === accountId
  );
  const linkedGoals = data.some(month => (month.financialGoals || []).some(goal => goal.patrimonioAccountId === accountId));
  if (relatedMovements.length || linkedGoals) {
    alert('Essa conta já tem movimentações ou metas vinculadas. Remova ou ajuste esses vínculos antes de excluir.');
    return;
  }
  if (!confirm('Excluir esta conta patrimonial?')) return;
  recordHistoryState();
  patrimonioAccounts = patrimonioAccounts.filter(account => account.id !== accountId);
  if (patrimonioSelectedAccountId === accountId) patrimonioSelectedAccountId = patrimonioAccounts[0]?.id || '';
  savePatrimonioData();
  renderPatrimonio();
  renderMes();
}

function syncPatrimonioMovementModalVisibility() {
  const type = document.getElementById('patrimonioMovementType').value;
  const transferWrap = document.getElementById('patrimonioTransferAccounts');
  const accountWrap = document.getElementById('patrimonioSingleAccountWrap');
  if (transferWrap) transferWrap.style.display = type === 'transferencia' ? '' : 'none';
  if (accountWrap) accountWrap.style.display = type === 'transferencia' ? 'none' : '';
}

function openPatrimonioMovementModal(options = {}) {
  ensurePatrimonioData();
  const movement = options.movementId ? patrimonioMovements.find(item => item.id === options.movementId) : null;
  const presetType = options.type || movement?.type || 'aporte';
  const title = movement
    ? 'Editar movimentação'
    : presetType === 'retirada'
      ? 'Nova retirada'
      : presetType === 'transferencia'
        ? 'Nova transferência'
        : 'Novo aporte';
  document.getElementById('patrimonioMovementModalTitle').textContent = title;
  document.getElementById('patrimonioMovementId').value = movement?.id || '';
  document.getElementById('patrimonioMovementType').value = presetType;
  document.getElementById('patrimonioMovementAccount').innerHTML = getPatrimonioAccountOptions(options.accountId || movement?.accountId || patrimonioSelectedAccountId || '', false);
  document.getElementById('patrimonioMovementFrom').innerHTML = getPatrimonioAccountOptions(movement?.fromAccountId || options.accountId || patrimonioSelectedAccountId || '', false);
  document.getElementById('patrimonioMovementTo').innerHTML = getPatrimonioAccountOptions(movement?.toAccountId || '', false);
  document.getElementById('patrimonioMovementValue').value = movement?.value || '';
  document.getElementById('patrimonioMovementDescription').value = movement?.description || '';
  document.getElementById('patrimonioMovementDate').value = movement?.date || todayIsoDate();
  const extras = document.getElementById('patrimonioMovementExtras');
  if (extras) extras.open = Boolean(movement?.description);
  syncPatrimonioMovementModalVisibility();
  openModal('modalPatrimonioMovement');
}

function savePatrimonioMovement() {
  ensurePatrimonioData();
  if (!patrimonioAccounts.length) {
    alert('Crie pelo menos uma conta patrimonial antes de lançar movimentações.');
    return;
  }
  const id = document.getElementById('patrimonioMovementId').value;
  const type = document.getElementById('patrimonioMovementType').value;
  const value = Number(document.getElementById('patrimonioMovementValue').value || 0);
  const description = document.getElementById('patrimonioMovementDescription').value.trim();
  const date = document.getElementById('patrimonioMovementDate').value || todayIsoDate();
  const accountId = document.getElementById('patrimonioMovementAccount').value;
  const fromAccountId = document.getElementById('patrimonioMovementFrom').value;
  const toAccountId = document.getElementById('patrimonioMovementTo').value;
  if (!Number.isFinite(value) || value <= 0) {
    alert('Informe um valor válido para a movimentação.');
    return;
  }
  if (type === 'transferencia') {
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
      alert('Escolha contas de origem e destino diferentes para a transferência.');
      return;
    }
  } else if (!accountId) {
    alert('Escolha a conta/ativo da movimentação.');
    return;
  }
  recordHistoryState();
  const payload = normalizePatrimonioMovement({
    id: id || patrimonioId('mov'),
    type,
    accountId: type === 'transferencia' ? '' : accountId,
    fromAccountId: type === 'transferencia' ? fromAccountId : '',
    toAccountId: type === 'transferencia' ? toAccountId : '',
    value,
    description,
    date,
    createdAt: id ? patrimonioMovements.find(item => item.id === id)?.createdAt : new Date().toISOString()
  });
  if (id) {
    const index = patrimonioMovements.findIndex(item => item.id === id);
    if (index >= 0) patrimonioMovements[index] = payload;
  } else {
    patrimonioMovements.unshift(payload);
  }
  patrimonioSelectedAccountId = type === 'transferencia' ? payload.toAccountId : payload.accountId;
  savePatrimonioData();
  closeModal('modalPatrimonioMovement');
  renderPatrimonio();
}

function deletePatrimonioMovement(movementId) {
  if (!confirm('Excluir esta movimentação?')) return;
  const movement = patrimonioMovements.find(item => item.id === movementId);
  if (!movement) return;
  if (movement.sourceType === 'financial-goal' && movement.sourceMonthId && movement.sourceGoalId) {
    const month = data.find(item => item.id === movement.sourceMonthId);
    const goal = month?.financialGoals?.find(item => item.id === movement.sourceGoalId);
    if (goal) {
      goal.patrimonioTransferredAt = '';
      goal.patrimonioMovementId = '';
    }
  }
  recordHistoryState();
  patrimonioMovements = patrimonioMovements.filter(item => item.id !== movementId);
  savePatrimonioData();
  renderPatrimonio();
  renderMes();
}

function changeFinancialGoalPatrimonioAccount(index, accountId) {
  const month = getCurrentMonth();
  if (!month || !month.financialGoals?.[index]) return;
  if (month.financialGoals[index].patrimonioTransferredAt) {
    alert('Essa meta já foi enviada para o patrimônio. Exclua a movimentação correspondente se quiser mudar o destino.');
    renderMes();
    return;
  }
  recordHistoryState();
  month.financialGoals[index].patrimonioAccountId = accountId;
  if (!accountId) {
    month.financialGoals[index].patrimonioTransferredAt = '';
    month.financialGoals[index].patrimonioMovementId = '';
  }
  save();
  renderMes();
  if (activePage === 'patrimonio') renderPatrimonio();
}

function transferFinancialGoalToPatrimonio(monthId, goalId) {
  ensurePatrimonioData();
  const month = data.find(item => item.id === monthId);
  const goal = month?.financialGoals?.find(item => item.id === goalId);
  if (!month || !goal) return;
  if (!goal.patrimonioAccountId) {
    alert('Escolha primeiro a conta patrimonial de destino.');
    return;
  }
  if (goal.patrimonioTransferredAt && goal.patrimonioMovementId) {
    alert('Essa meta já foi enviada para o patrimônio.');
    return;
  }
  const account = getPatrimonioAccountById(goal.patrimonioAccountId);
  if (!account) {
    alert('A conta patrimonial escolhida não existe mais.');
    return;
  }
  recordHistoryState();
  const movement = normalizePatrimonioMovement({
    id: patrimonioId('mov'),
    type: 'aporte',
    accountId: account.id,
    value: goal.valor,
    description: `Meta financeira · ${goal.nome}`,
    date: todayIsoDate(),
    createdAt: new Date().toISOString(),
    sourceType: 'financial-goal',
    sourceMonthId: month.id,
    sourceGoalId: goal.id
  });
  patrimonioMovements.unshift(movement);
  goal.patrimonioMovementId = movement.id;
  goal.patrimonioTransferredAt = new Date().toISOString();
  patrimonioSelectedAccountId = account.id;
  savePatrimonioData();
  renderMes();
  if (activePage === 'patrimonio') renderPatrimonio();
}

// Override visual copy for the current Patrimonio experience.
function renderPatrimonioMetrics() {
  const container = document.getElementById('patrimonioMetrics');
  if (!container) return;
  const metrics = getPatrimonioMetrics();
  const patrimonioSub = document.getElementById('patrimonioSub');
  if (patrimonioSub) {
    patrimonioSub.textContent = `${patrimonioAccounts.length} conta${patrimonioAccounts.length === 1 ? '' : 's'} acompanhada${patrimonioAccounts.length === 1 ? '' : 's'} por movimentacoes manuais.`;
  }
  const patrimonioGuide = document.getElementById('patrimonioGuide');
  if (patrimonioGuide) {
    patrimonioGuide.innerHTML = '<strong>Onde esta meu dinheiro guardado?</strong> Veja primeiro as contas e os saldos. Depois, acompanhe as movimentacoes da conta escolhida sem misturar isso com a operacao mensal.';
  }
  container.innerHTML = `
    <div class="metric-card metric-card-wealth">
      <span>Patrimonio total</span>
      <strong>${fmt(metrics.patrimonioTotal)}</strong>
    </div>
    <div class="metric-card metric-card-goals">
      <span>Variacao do mes</span>
      <strong class="${metrics.currentMonthVariation >= 0 ? 'amount-pos' : 'amount-neg'}">${fmtSigned(metrics.currentMonthVariation)}</strong>
    </div>
  `;
}

function renderPatrimonioAccounts() {
  const grid = document.getElementById('patrimonioAccountsGrid');
  if (!grid) return;
  const rows = getPatrimonioFilteredAccounts();
  if (!rows.length) {
    grid.innerHTML = '<div class="patrimonio-empty">Nenhuma conta patrimonial cadastrada ainda. Comece criando onde você guarda dinheiro.</div>';
    return;
  }
  grid.innerHTML = rows.map(account => {
    const visual = inferPatrimonioVisual(account.nome, account.tipo);
    const cardStyle = getPatrimonioAccountCardStyle(account);
    return `
      <article class="patrimonio-account-card ${account.id === patrimonioSelectedAccountId ? 'active' : ''}" ${cardStyle ? `style="${cardStyle}"` : ''}>
        <button class="patrimonio-account-main" type="button" onclick="selectPatrimonioAccount('${account.id}')">
          <div class="patrimonio-account-top">
            <div class="patrimonio-account-identity">
                ${renderPatrimonioAccountBadge(account, visual)}
              <strong>${escapeHtml(account.nome)}</strong>
            </div>
            <span class="patrimonio-balance">${fmt(account.saldo)}</span>
          </div>
        </button>
        <div class="patrimonio-account-actions">
          <button class="btn btn-ghost" type="button" onclick="openPatrimonioAccountModal('${account.id}')">Editar</button>
          <button class="btn btn-ghost" type="button" onclick="deletePatrimonioAccount('${account.id}')">Excluir</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderPatrimonioMovementRow(account, movement) {
  const isTransferOut = movement.type === 'transferencia' && movement.fromAccountId === account.id;
  const rowType = movement.type === 'transferencia'
    ? 'transfer'
    : movement.type === 'retirada'
      ? 'expense'
      : 'income';
  const direction = movement.type === 'retirada' || isTransferOut ? -1 : 1;
  const symbol = movement.type === 'transferencia'
    ? '⇄'
    : movement.type === 'retirada'
      ? '−'
      : '+';
  const movementTitle = movement.type === 'transferencia'
    ? (isTransferOut ? 'Transferência enviada' : 'Transferência recebida')
    : movement.type === 'retirada'
      ? 'Retirada'
      : 'Aporte';
  const counterpart = movement.type === 'transferencia'
    ? (isTransferOut
      ? `Para ${getPatrimonioAccountById(movement.toAccountId)?.nome || 'Conta removida'}`
      : `De ${getPatrimonioAccountById(movement.fromAccountId)?.nome || 'Conta removida'}`)
    : (movement.description || '');
  return `
    <tr class="patrimonio-movement-row ${rowType}">
      <td class="patrimonio-date-cell" style="padding-left:22px">${formatPatrimonioDate(movement.date)}</td>
      <td>
        <div class="patrimonio-movement-copy">
          <strong><span class="patrimonio-movement-symbol ${rowType}">${symbol}</span>${movementTitle}</strong>
          ${counterpart ? `<small>${escapeHtml(counterpart)}</small>` : ''}
        </div>
      </td>
      <td class="amount ${direction >= 0 ? 'amount-pos' : 'amount-neg'}">${direction >= 0 ? fmt(movement.value) : `- ${fmt(movement.value)}`}</td>
      <td class="patrimonio-action-cell">
        ${movement.sourceType === 'financial-goal'
          ? '<span class="patrimonio-status-chip neutral">Meta</span>'
          : `<button class="btn-icon" type="button" onclick="openPatrimonioMovementModal({ movementId: '${movement.id}' })">✎</button>`}
        <button class="btn-icon" type="button" onclick="deletePatrimonioMovement('${movement.id}')">✕</button>
      </td>
    </tr>
  `;
}

function renderPatrimonioDetail() {
  const container = document.getElementById('patrimonioDetail');
  if (!container) return;
  const account = getPatrimonioSelectedAccount();
  if (!account) {
    container.innerHTML = '<div class="patrimonio-empty">Selecione uma conta à esquerda para ver as movimentações e agir nela.</div>';
    return;
  }
  const movements = getPatrimonioFilteredMovements().filter(movement =>
    movement.accountId === account.id ||
    movement.fromAccountId === account.id ||
    movement.toAccountId === account.id
  );
  const saldo = getPatrimonioBalanceForAccount(account.id);
  const visual = inferPatrimonioVisual(account.nome, account.tipo);
  container.innerHTML = `
    <div class="patrimonio-detail-head">
      <div>
        <h3 class="patrimonio-detail-title">${renderPatrimonioAccountBadge(account, visual)}<span>${escapeHtml(account.nome)}</span></h3>
        ${account.observacao ? `<p class="patrimonio-note">${escapeHtml(account.observacao)}</p>` : ''}
        <div class="patrimonio-detail-actions">
          <button class="btn btn-primary patrimonio-move-btn" type="button" title="Adicionar" onclick="openPatrimonioMovementModal({ accountId: '${account.id}', type: 'aporte' })">+</button>
          <button class="btn btn-ghost patrimonio-move-btn" type="button" title="Retirar" onclick="openPatrimonioMovementModal({ accountId: '${account.id}', type: 'retirada' })">−</button>
          <button class="btn btn-ghost patrimonio-move-btn" type="button" title="Transferir" onclick="openPatrimonioMovementModal({ accountId: '${account.id}', type: 'transferencia' })">⇄</button>
        </div>
      </div>
      <div class="patrimonio-detail-balance">${fmt(saldo)}</div>
    </div>
    <div class="patrimonio-detail-table-wrap">
      <table class="fin-table patrimonio-table patrimonio-compact-table">
        <thead>
          <tr>
            <th style="padding-left:22px">Data</th>
            <th></th>
            <th>Valor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${movements.length
            ? movements.map(movement => renderPatrimonioMovementRow(account, movement)).join('')
            : '<tr><td colspan="4" style="padding:18px 22px;color:var(--text3)">Nenhuma movimentação encontrada para esta conta ainda.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}
