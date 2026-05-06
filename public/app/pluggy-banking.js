(function initPluggyBanking(global) {
  'use strict';

  const STATE = {
    currentView: null,
    rawData: null,
    accountLinks: {},
    pendingTransactions: {},
    dismissedIds: new Set(),
    loading: false,
    error: '',
    loadedAt: ''
  };

  const STORAGE_KEY = 'pluggy_account_links';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeComparableText(value) {
    if (global.BillImportSchema?.normalizeComparableText) {
      return global.BillImportSchema.normalizeComparableText(value);
    }
    return normalizeText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function normalizeDescriptionComparable(value) {
    return normalizeComparableText(value).replace(/\s+/g, '');
  }

  function money(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(amount) ? amount : 0);
  }

  function dateToBrShort(isoDate) {
    const raw = String(isoDate || '');
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = String(d.getUTCFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }

  function dateToIsoDay(isoDate) {
    const raw = String(isoDate || '');
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  function showStatus(message, tone = 'ok') {
    if (typeof global.showAppStatus === 'function') {
      global.showAppStatus(message, 'Internet banking', tone);
      return;
    }
    if (tone === 'error') alert(message);
  }

  function getCsrfHeaders(extra = {}) {
    const token = global.__CSRF_TOKEN__ || '';
    return token ? { ...extra, 'X-CSRF-Token': token } : { ...extra };
  }

  function loadLinkMemory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function saveLinkMemory(pluggyAccountName, linkedId) {
    const key = normalizeComparableText(pluggyAccountName);
    if (!key || !linkedId) return;
    const memory = loadLinkMemory();
    memory[key] = String(linkedId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  }

  function getAllCards() {
    if (global.BillImportUtils?.getAllCardsFromUserData) {
      return global.BillImportUtils.getAllCardsFromUserData(global.data || []).list || [];
    }
    return [];
  }

  function getAllCategories() {
    if (global.BillImportUtils?.getAllCategoriesFromUserData) {
      return global.BillImportUtils.getAllCategoriesFromUserData(global.data || []).list.map(item => item.name);
    }
    return [];
  }

  function getAllPatrimonioAccounts() {
    return Array.isArray(global.patrimonioAccounts) ? global.patrimonioAccounts : [];
  }

  function inferCategory(pluggyCategory, allCategories) {
    const normalized = normalizeComparableText(pluggyCategory);
    if (!normalized) return '';

    const map = {
      'food and beverage': 'ALIMENTAÇÃO',
      groceries: 'ALIMENTAÇÃO',
      supermarket: 'ALIMENTAÇÃO',
      restaurant: 'ALIMENTAÇÃO',
      'online payment': 'COMPRAS',
      shopping: 'COMPRAS',
      transport: 'TRANSPORTE',
      transportation: 'TRANSPORTE',
      uber: 'TRANSPORTE',
      health: 'SAÚDE',
      pharmacy: 'SAÚDE',
      education: 'EDUCAÇÃO',
      entertainment: 'LAZER',
      streaming: 'ASSINATURAS',
      subscription: 'ASSINATURAS',
      transfer: 'FINANCEIRO',
      home: 'MORADIA',
      housing: 'MORADIA',
      utilities: 'SERVIÇOS',
      services: 'SERVIÇOS'
    };

    const categorySet = new Set(allCategories || []);
    for (const [key, value] of Object.entries(map)) {
      if (normalized.includes(key) && categorySet.has(value)) return value;
    }

    const direct = (allCategories || []).find(cat => normalizeComparableText(cat) === normalized);
    return direct || '';
  }

  function isCreditBillPayment(tx) {
    const amount = Number(tx?.amount || 0);
    if (amount < 0) return true;
    const description = normalizeComparableText(tx?.description || '');
    return description.includes('pagamento')
      || description.includes('fatura')
      || description.includes('credito fatura')
      || description.includes('estorno')
      || description.includes('ressarcimento')
      || description.includes('reembolso');
  }

  function filterTransactions(transactions, accountType) {
    return (transactions || []).filter(tx => {
      if (STATE.dismissedIds.has(String(tx?.id || ''))) return false;
      if (accountType === 'CREDIT' && isCreditBillPayment(tx)) return false;
      return true;
    });
  }

  function autoLinkAccount(pluggyAccountName, accountType) {
    const memory = loadLinkMemory();
    const memKey = normalizeComparableText(pluggyAccountName);
    if (memory[memKey]) return memory[memKey];

    const list = accountType === 'CREDIT' ? getAllCards() : getAllPatrimonioAccounts();
    const normalized = normalizeComparableText(pluggyAccountName);
    const match = list.find(item => {
      const candidate = normalizeComparableText(item?.name || '');
      return candidate && (normalized.includes(candidate) || candidate.includes(normalized));
    });
    return match?.id || '';
  }

  function ensurePending(account) {
    const accountId = String(account?.accountId || '');
    if (!accountId) return [];
    if (Array.isArray(STATE.pendingTransactions[accountId])) return STATE.pendingTransactions[accountId];
    const categories = getAllCategories();
    const rows = filterTransactions(account.transactions, account.accountType).map(tx => {
      const txType = String(tx?.type || '').toUpperCase();
      return {
        ...tx,
        _ui: {
          description: normalizeText(tx?.description || tx?.descriptionRaw || 'Transação Pluggy'),
          category: inferCategory(tx?.category, categories),
          movementType: txType === 'CREDIT' ? 'aporte' : 'retirada'
        }
      };
    });
    STATE.pendingTransactions[accountId] = rows;
    return rows;
  }

  function getAccountById(accountId) {
    const accounts = Array.isArray(STATE.rawData?.accounts) ? STATE.rawData.accounts : [];
    return accounts.find(item => String(item.accountId) === String(accountId)) || null;
  }

  function getPendingTx(accountId, txId) {
    const rows = ensurePending(getAccountById(accountId) || { accountId, transactions: [] });
    return rows.find(item => String(item.id) === String(txId)) || null;
  }

  function removePendingTx(accountId, txId) {
    const rows = ensurePending(getAccountById(accountId) || { accountId, transactions: [] });
    const next = rows.filter(item => String(item.id) !== String(txId));
    STATE.pendingTransactions[String(accountId)] = next;
    STATE.dismissedIds.add(String(txId));
  }

  function ensureMonthFromDate(dateBr) {
    const value = normalizeText(dateBr);
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (!match) return null;
    const monthNum = Number(match[2]);
    const year = 2000 + Number(match[3]);
    const monthName = Object.keys(global.MONTH_INDEX || {}).find(key => Number(global.MONTH_INDEX[key]) === (monthNum - 1));
    if (!monthName) return null;
    if (typeof global.ensureMonthExists !== 'function') return null;
    return global.ensureMonthExists(monthName, year);
  }

  function dedupeCredit(tx, month, cardId, dateBr, amount, description) {
    const targetDesc = normalizeDescriptionComparable(description);
    const targetTxId = String(tx?.id || '');
    return (month?.outflows || []).some(item => {
      if (String(item?.outputKind || '') !== 'card') return false;
      if (String(item?.outputRef || '') !== String(cardId)) return false;
      if (String(item?.pluggyTransactionId || '') === targetTxId) return true;
      const sameDate = String(item?.date || '') === String(dateBr);
      const sameAmount = Math.abs(Number(item?.amount || 0) - Number(amount || 0)) < 0.01;
      const desc = normalizeDescriptionComparable(item?.description || '');
      const sameDesc = desc && targetDesc ? (desc === targetDesc || desc.includes(targetDesc) || targetDesc.includes(desc)) : false;
      return sameDate && sameAmount && sameDesc;
    });
  }

  function dedupeBank(tx, accountId, value, description, dateIso) {
    const movements = Array.isArray(global.patrimonioMovements) ? global.patrimonioMovements : [];
    const txId = String(tx?.id || '');
    const targetDesc = normalizeDescriptionComparable(description);
    return movements.some(item => {
      if (String(item?.pluggyTransactionId || '') === txId) return true;
      if (String(item?.accountId || '') !== String(accountId)) return false;
      const sameDate = String(item?.date || '') === String(dateIso);
      const sameValue = Math.abs(Number(item?.value || 0) - Number(value || 0)) < 0.01;
      const desc = normalizeDescriptionComparable(item?.description || '');
      const sameDesc = desc && targetDesc ? (desc === targetDesc || desc.includes(targetDesc) || targetDesc.includes(desc)) : false;
      return sameDate && sameValue && sameDesc;
    });
  }

  function commitCreditTransaction(txId, accountId) {
    const tx = getPendingTx(accountId, txId);
    if (!tx) return;
    const linkedCardId = normalizeText(STATE.accountLinks[String(accountId)] || '');
    if (!linkedCardId) throw new Error('Vincule essa conta a um cartão antes de carregar.');

    const dateBr = dateToBrShort(tx.date);
    const monthId = global.BillImportSchema?.getMonthIdFromDate ? global.BillImportSchema.getMonthIdFromDate(dateBr) : '';
    let month = (global.data || []).find(item => String(item.id) === String(monthId));
    if (!month) month = ensureMonthFromDate(dateBr);
    if (!month) throw new Error('Não foi possível identificar/criar o mês da transação.');

    const amount = Math.abs(Number(tx.amount || 0));
    const description = normalizeText(tx._ui?.description || tx.description || '');
    if (!dateBr || !description || !(amount > 0)) throw new Error('Dados inválidos na transação.');

    if (dedupeCredit(tx, month, linkedCardId, dateBr, amount, description)) {
      removePendingTx(accountId, txId);
      showStatus('Transação já existia e foi ignorada como duplicada.', 'warning');
      return;
    }

    if (!Array.isArray(month.outflowCards)) month.outflowCards = [];
    const hasCard = month.outflowCards.some(item => String(item?.id) === String(linkedCardId));
    if (!hasCard) {
      const card = getAllCards().find(item => String(item?.id) === String(linkedCardId));
      if (card) month.outflowCards.push({ ...card });
    }

    if (!Array.isArray(month.outflows)) month.outflows = [];
    const base = {
      id: `pluggy_import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      description,
      type: 'spend',
      category: normalizeText(tx._ui?.category || ''),
      amount,
      outputKind: 'card',
      outputRef: linkedCardId,
      outputMethod: '',
      date: dateBr,
      tag: '',
      status: 'done',
      paid: false,
      countsInPrimaryTotals: false,
      recurringSpend: false,
      recurringGroupId: '',
      installmentsGroupId: '',
      installmentsTotal: Number(tx?.creditCardMetadata?.totalInstallments || 1) || 1,
      installmentIndex: Number(tx?.creditCardMetadata?.installmentNumber || 1) || 1,
      createdAt: new Date().toISOString(),
      pluggyTransactionId: String(tx?.id || '')
    };

    const normalized = typeof global.normalizeUnifiedOutflowItem === 'function'
      ? global.normalizeUnifiedOutflowItem(base, 0)
      : base;
    month.outflows.push(normalized);
    if (typeof global.ensureUnifiedOutflowPilotMonth === 'function') global.ensureUnifiedOutflowPilotMonth(month);
    if (typeof global.syncUnifiedOutflowLegacyData === 'function') global.syncUnifiedOutflowLegacyData(month);
    if (typeof global.recalcTotals === 'function') global.recalcTotals(month);

    global.save(true);
    removePendingTx(accountId, txId);
  }

  function commitBankTransaction(txId, accountId) {
    const tx = getPendingTx(accountId, txId);
    if (!tx) return;
    const linkedAccountId = normalizeText(STATE.accountLinks[String(accountId)] || '');
    if (!linkedAccountId) throw new Error('Vincule essa conta a uma conta de patrimônio antes de carregar.');

    const value = Math.abs(Number(tx.amount || 0));
    const description = normalizeText(tx._ui?.description || tx.description || '');
    const dateIso = dateToIsoDay(tx.date);
    if (!dateIso || !description || !(value > 0)) throw new Error('Dados inválidos na transação.');

    if (dedupeBank(tx, linkedAccountId, value, description, dateIso)) {
      removePendingTx(accountId, txId);
      showStatus('Movimentação já existia e foi ignorada como duplicada.', 'warning');
      return;
    }

    const fallbackType = String(tx.type || '').toUpperCase() === 'CREDIT' ? 'aporte' : 'retirada';
    const movementBase = {
      id: `pluggy_pat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: normalizeText(tx._ui?.movementType || fallbackType),
      accountId: linkedAccountId,
      value,
      description,
      date: dateIso,
      pluggyTransactionId: String(tx.id || '')
    };
    const movement = typeof global.normalizePatrimonioMovement === 'function'
      ? global.normalizePatrimonioMovement(movementBase, Array.isArray(global.patrimonioMovements) ? global.patrimonioMovements.length : 0)
      : movementBase;
    if (!Array.isArray(global.patrimonioMovements)) global.patrimonioMovements = [];
    global.patrimonioMovements.unshift(movement);
    global.save(true);
    if (typeof global.renderPatrimonioMetrics === 'function') global.renderPatrimonioMetrics();
    if (typeof global.renderPatrimonioAccounts === 'function') global.renderPatrimonioAccounts();
    removePendingTx(accountId, txId);
  }

  function loadSingleTransaction(txId, accountId) {
    try {
      const account = getAccountById(accountId);
      if (!account) return;
      if (account.accountType === 'CREDIT') commitCreditTransaction(txId, accountId);
      else commitBankTransaction(txId, accountId);
      renderInternetBankingPage(false);
      showStatus('Lançamento carregado com sucesso.', 'ok');
    } catch (error) {
      showStatus(error?.message || 'Falha ao carregar lançamento.', 'error');
    }
  }

  function loadAllFromAccount(accountId) {
    const account = getAccountById(accountId);
    if (!account) return;
    const rows = [...ensurePending(account)];
    let ok = 0;
    let errors = 0;
    rows.forEach(tx => {
      try {
        if (account.accountType === 'CREDIT') commitCreditTransaction(tx.id, accountId);
        else commitBankTransaction(tx.id, accountId);
        ok += 1;
      } catch (_) {
        errors += 1;
      }
    });
    renderInternetBankingPage(false);
    showStatus(`${ok} lançamento(s) carregado(s)${errors ? `, ${errors} com erro` : ''}.`, errors ? 'warning' : 'ok');
  }

  function dismissTransaction(txId, accountId) {
    removePendingTx(accountId, txId);
    renderInternetBankingPage(false);
  }

  function updateTransactionField(txId, accountId, field, value) {
    const tx = getPendingTx(accountId, txId);
    if (!tx || !tx._ui) return;
    tx._ui[field] = value;
  }

  function handleLinkChange(accountId, accountName, value, remember) {
    STATE.accountLinks[String(accountId)] = String(value || '');
    if (remember && value) saveLinkMemory(accountName, value);
  }

  function getAccountsByType(type) {
    const all = Array.isArray(STATE.rawData?.accounts) ? STATE.rawData.accounts : [];
    return all.filter(item => String(item.accountType || '').toUpperCase() === String(type || '').toUpperCase());
  }

  function renderTypeButtons() {
    const active = STATE.currentView;
    return `
      <div class="pluggy-view-switch">
        <button class="btn ${active === 'bank' ? 'btn-primary' : 'btn-ghost'}" type="button" onclick="PluggyBanking.switchView('bank')">Transações de conta corrente</button>
        <button class="btn ${active === 'credit' ? 'btn-primary' : 'btn-ghost'}" type="button" onclick="PluggyBanking.switchView('credit')">Transações do cartão de crédito</button>
      </div>
    `;
  }

  function categoryOptions(selected) {
    const options = [''].concat(getAllCategories());
    return options.map(cat => {
      const value = normalizeText(cat);
      const label = value || 'Sem categoria';
      return `<option value="${escapeHtml(value)}" ${value === String(selected || '') ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
  }

  function linkOptions(accountType, selectedId) {
    const list = accountType === 'CREDIT' ? getAllCards() : getAllPatrimonioAccounts();
    const placeholder = accountType === 'CREDIT' ? '-- Selecione um cartão --' : '-- Selecione uma conta --';
    const options = [`<option value="">${placeholder}</option>`];
    list.forEach(item => {
      const id = String(item?.id || '');
      const name = String(item?.name || item?.nome || id || 'Sem nome');
      options.push(`<option value="${escapeHtml(id)}" ${id === String(selectedId || '') ? 'selected' : ''}>${escapeHtml(name)}</option>`);
    });
    return options.join('');
  }

  function renderRows(account) {
    const rows = ensurePending(account);
    if (!rows.length) {
      return `<tr><td colspan="${account.accountType === 'CREDIT' ? 6 : 5}" class="text-muted" style="padding:14px">Sem transações pendentes para revisão.</td></tr>`;
    }
    return rows.map(tx => {
      const amount = Math.abs(Number(tx.amount || 0));
      const installmentTotal = Number(tx?.creditCardMetadata?.totalInstallments || 1) || 1;
      const installmentIndex = Number(tx?.creditCardMetadata?.installmentNumber || 1) || 1;
      const installmentLabel = installmentTotal > 1 ? `Parcela ${installmentIndex} de ${installmentTotal}` : '-';
      if (account.accountType === 'CREDIT') {
        return `
          <tr>
            <td>${escapeHtml(dateToBrShort(tx.date) || '--')}</td>
            <td><input class="pluggy-input" value="${escapeHtml(tx._ui?.description || '')}" onchange="PluggyBanking.updateField('${escapeHtml(tx.id)}','${escapeHtml(account.accountId)}','description',this.value)"></td>
            <td>
              <select class="pluggy-input" onchange="PluggyBanking.updateField('${escapeHtml(tx.id)}','${escapeHtml(account.accountId)}','category',this.value)">
                ${categoryOptions(tx._ui?.category || '')}
              </select>
            </td>
            <td class="amount-neg">${escapeHtml(money(amount))}</td>
            <td>${escapeHtml(installmentLabel)}</td>
            <td class="pluggy-actions-cell">
              <button class="btn btn-primary btn-sm" type="button" onclick="PluggyBanking.loadOne('${escapeHtml(tx.id)}','${escapeHtml(account.accountId)}')">Carregar</button>
              <button class="btn btn-ghost btn-sm" type="button" onclick="PluggyBanking.dismiss('${escapeHtml(tx.id)}','${escapeHtml(account.accountId)}')" title="Ignorar">✕</button>
            </td>
          </tr>
        `;
      }
      return `
        <tr>
          <td>${escapeHtml(dateToBrShort(tx.date) || '--')}</td>
          <td>
            <select class="pluggy-input" onchange="PluggyBanking.updateField('${escapeHtml(tx.id)}','${escapeHtml(account.accountId)}','movementType',this.value)">
              <option value="aporte" ${tx._ui?.movementType === 'aporte' ? 'selected' : ''}>Aporte</option>
              <option value="retirada" ${tx._ui?.movementType === 'retirada' ? 'selected' : ''}>Retirada</option>
            </select>
          </td>
          <td><input class="pluggy-input" value="${escapeHtml(tx._ui?.description || '')}" onchange="PluggyBanking.updateField('${escapeHtml(tx.id)}','${escapeHtml(account.accountId)}','description',this.value)"></td>
          <td class="${tx._ui?.movementType === 'aporte' ? 'amount-pos' : 'amount-neg'}">${escapeHtml(money(amount))}</td>
          <td class="pluggy-actions-cell">
            <button class="btn btn-primary btn-sm" type="button" onclick="PluggyBanking.loadOne('${escapeHtml(tx.id)}','${escapeHtml(account.accountId)}')">Carregar</button>
            <button class="btn btn-ghost btn-sm" type="button" onclick="PluggyBanking.dismiss('${escapeHtml(tx.id)}','${escapeHtml(account.accountId)}')" title="Ignorar">✕</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderAccountGroup(account) {
    const accountId = String(account.accountId || '');
    const linked = STATE.accountLinks[accountId] || autoLinkAccount(account.accountName, account.accountType);
    if (!STATE.accountLinks[accountId] && linked) STATE.accountLinks[accountId] = linked;
    const rememberLabel = `remember_${accountId}`;
    return `
      <section class="pluggy-account-group">
        <div class="pluggy-account-header">
          <h3 class="pluggy-account-name">${escapeHtml(account.accountName || 'Conta')}</h3>
          <div class="pluggy-account-bind">
            <label>Vincular a:</label>
            <select class="pluggy-input" onchange="PluggyBanking.changeLink('${escapeHtml(accountId)}','${escapeHtml(account.accountName || '')}',this.value,document.getElementById('${escapeHtml(rememberLabel)}')?.checked)">
              ${linkOptions(account.accountType, linked)}
            </select>
            <label class="pluggy-remember-link"><input id="${escapeHtml(rememberLabel)}" type="checkbox" checked> Lembrar vínculo</label>
            <button class="btn btn-primary btn-sm" type="button" onclick="PluggyBanking.loadAll('${escapeHtml(accountId)}')">Carregar todos</button>
          </div>
        </div>
        <table class="fin-table pluggy-transactions-table">
          <thead>
            ${account.accountType === 'CREDIT'
              ? '<tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Parcelado</th><th></th></tr>'
              : '<tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th></th></tr>'}
          </thead>
          <tbody>${renderRows(account)}</tbody>
        </table>
      </section>
    `;
  }

  function renderWorkspace() {
    const node = document.getElementById('internetBankingWorkspace');
    if (!node) return;
    const loadedAtLabel = STATE.loadedAt
      ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(STATE.loadedAt))
      : '--';

    if (STATE.loading) {
      node.innerHTML = `${renderTypeButtons()}<div class="section"><div class="section-body text-muted" style="padding:16px">Carregando dados do Pluggy...</div></div>`;
      return;
    }
    if (STATE.error) {
      node.innerHTML = `${renderTypeButtons()}<div class="section"><div class="section-body" style="padding:16px"><span class="amount-neg">${escapeHtml(STATE.error)}</span></div></div>`;
      return;
    }
    if (!STATE.currentView) {
      node.innerHTML = `${renderTypeButtons()}<div class="section"><div class="section-body text-muted" style="padding:16px">Escolha um tipo de transação para revisar.</div></div>`;
      return;
    }
    const type = STATE.currentView === 'credit' ? 'CREDIT' : 'BANK';
    const accounts = getAccountsByType(type);
    if (!accounts.length) {
      node.innerHTML = `${renderTypeButtons()}<div class="section"><div class="section-body text-muted" style="padding:16px">Nenhuma conta ${type === 'CREDIT' ? 'de cartão' : 'corrente'} encontrada.</div></div>`;
      return;
    }
    node.innerHTML = `
      ${renderTypeButtons()}
      <div class="pluggy-last-sync">Última atualização: ${escapeHtml(loadedAtLabel)}</div>
      ${accounts.map(renderAccountGroup).join('')}
    `;
  }

  async function loadData() {
    STATE.loading = true;
    STATE.error = '';
    renderWorkspace();
    try {
      const response = await fetch('/api/pluggy/transactions?limit=2000', {
        method: 'GET',
        credentials: 'same-origin',
        headers: getCsrfHeaders({ Accept: 'application/json' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Falha ao carregar dados do Pluggy.');
      STATE.rawData = payload || { accounts: [] };
      STATE.loadedAt = new Date().toISOString();
      STATE.pendingTransactions = {};
      STATE.dismissedIds = new Set();
      if (!STATE.currentView) STATE.currentView = 'bank';
    } catch (error) {
      STATE.error = error?.message || 'Falha ao carregar dados do Pluggy.';
    } finally {
      STATE.loading = false;
      renderWorkspace();
    }
  }

  async function renderPage(forceReload = false) {
    if (forceReload || !STATE.rawData) await loadData();
    else renderWorkspace();
  }

  function switchView(view) {
    STATE.currentView = view === 'credit' ? 'credit' : 'bank';
    renderWorkspace();
  }

  global.PluggyBanking = {
    switchView,
    loadAll: loadAllFromAccount,
    loadOne: loadSingleTransaction,
    dismiss: dismissTransaction,
    updateField: updateTransactionField,
    changeLink: handleLinkChange
  };
  global.renderInternetBankingPage = renderPage;
})(typeof window !== 'undefined' ? window : globalThis);
