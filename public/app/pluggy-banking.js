(function initPluggyBanking(global) {
  'use strict';

  const PAGE_SIZE = 2000;
  const STORAGE_BASE_KEY = 'pluggy_banking_state_v2';

  const STATE = {
    currentView: 'credit',
    rawData: null,
    loading: false,
    error: '',
    loadedAt: '',
    mountId: 'internetBankingWorkspace',
    pendingByAccount: {},
    collapsedGroups: {},
    sortByGroup: {},
    aliasEditor: null,
    userState: {
      links: {},
      hiddenGroups: {},
      clearedAtByGroup: {},
      aliases: {},
      categoryMemory: {}
    }
  };

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

  function normalizeDescriptionKey(value) {
    return normalizeComparableText(value)
      .replace(/\b(ltda|sa|s a|com br|brasil|online|epp|me)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function money(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
      .format(Number.isFinite(amount) ? amount : 0);
  }

  function formatDateAndTime(isoDate) {
    const raw = String(isoDate || '');
    if (!raw) return { dateBr: '', timeBr: '' };
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return { dateBr: '', timeBr: '' };
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = String(d.getUTCFullYear()).slice(-2);
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    return { dateBr: `${day}/${month}/${year}`, timeBr: `${hours}:${minutes}` };
  }

  function dateToIsoDay(isoDate) {
    const raw = String(isoDate || '');
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  function getUserId() {
    const session = global.currentSession || {};
    const userObj = session.user || {};
    return String(
      session.userId
      || userObj.id
      || session.username
      || userObj.username
      || userObj.email
      || 'default-user'
    ).trim();
  }

  function storageKey() {
    return `${STORAGE_BASE_KEY}:${getUserId()}`;
  }

  function loadUserState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey()) || '{}');
      STATE.userState.links = parsed.links && typeof parsed.links === 'object' ? parsed.links : {};
      STATE.userState.hiddenGroups = parsed.hiddenGroups && typeof parsed.hiddenGroups === 'object' ? parsed.hiddenGroups : {};
      STATE.userState.clearedAtByGroup = parsed.clearedAtByGroup && typeof parsed.clearedAtByGroup === 'object' ? parsed.clearedAtByGroup : {};
      STATE.userState.aliases = parsed.aliases && typeof parsed.aliases === 'object' ? parsed.aliases : {};
      STATE.userState.categoryMemory = parsed.categoryMemory && typeof parsed.categoryMemory === 'object' ? parsed.categoryMemory : {};
    } catch (_err) {
      STATE.userState.links = {};
      STATE.userState.hiddenGroups = {};
      STATE.userState.clearedAtByGroup = {};
      STATE.userState.aliases = {};
      STATE.userState.categoryMemory = {};
    }
  }

  function persistUserState() {
    localStorage.setItem(storageKey(), JSON.stringify(STATE.userState));
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

  function getDataRef() {
    if (typeof data !== 'undefined' && Array.isArray(data)) return data;
    if (Array.isArray(global.data)) return global.data;
    return [];
  }

  function getPatrimonioAccountsRef() {
    if (typeof patrimonioAccounts !== 'undefined' && Array.isArray(patrimonioAccounts)) return patrimonioAccounts;
    if (Array.isArray(global.patrimonioAccounts)) return global.patrimonioAccounts;
    return [];
  }

  function getPatrimonioMovementsRef() {
    if (typeof patrimonioMovements !== 'undefined' && Array.isArray(patrimonioMovements)) return patrimonioMovements;
    if (Array.isArray(global.patrimonioMovements)) return global.patrimonioMovements;
    return [];
  }

  function setPatrimonioMovementsRef(nextMovements) {
    const safe = Array.isArray(nextMovements) ? nextMovements : [];
    if (typeof patrimonioMovements !== 'undefined') {
      patrimonioMovements = safe;
      return;
    }
    global.patrimonioMovements = safe;
  }

  function getAllCards() {
    if (global.BillImportUtils?.getAllCardsFromUserData) {
      return global.BillImportUtils.getAllCardsFromUserData(getDataRef()).list || [];
    }
    return [];
  }

  function getAllPatrimonioAccounts() {
    return getPatrimonioAccountsRef();
  }

  function getAllCategories() {
    if (global.BillImportUtils?.getAllCategoriesFromUserData) {
      return global.BillImportUtils.getAllCategoriesFromUserData(getDataRef()).list.map(item => item.name);
    }
    return [];
  }

  function getAllTags() {
    if (global.BillImportUtils?.getAllTagsFromUserData) {
      return global.BillImportUtils.getAllTagsFromUserData(getDataRef());
    }
    return [];
  }

  function inferCategory(pluggyCategory, allCategories) {
    const normalized = normalizeComparableText(pluggyCategory);
    if (!normalized) return '';

    const map = {
      'food and beverage': 'ALIMENTACAO',
      groceries: 'ALIMENTACAO',
      supermarket: 'ALIMENTACAO',
      restaurant: 'ALIMENTACAO',
      'online payment': 'COMPRAS',
      shopping: 'COMPRAS',
      transport: 'TRANSPORTE',
      transportation: 'TRANSPORTE',
      uber: 'TRANSPORTE',
      health: 'SAUDE',
      pharmacy: 'SAUDE',
      education: 'EDUCACAO',
      entertainment: 'LAZER',
      streaming: 'ASSINATURAS',
      subscription: 'ASSINATURAS',
      transfer: 'FINANCEIRO',
      home: 'MORADIA',
      housing: 'MORADIA',
      utilities: 'SERVICOS',
      services: 'SERVICOS'
    };

    const availableNorm = new Map((allCategories || []).map(name => [normalizeComparableText(name), name]));
    for (const [key, value] of Object.entries(map)) {
      if (!normalized.includes(key)) continue;
      const found = availableNorm.get(normalizeComparableText(value));
      if (found) return found;
    }
    const direct = (allCategories || []).find(cat => normalizeComparableText(cat) === normalized);
    return direct || '';
  }

  function isSaldoSyncDescription(description) {
    const normalized = normalizeComparableText(description);
    return normalized.includes('saldo sincronizado via pluggy')
      || normalized.includes('saldo sincronizado pluggy')
      || normalized === 'saldo sincronizado';
  }

  function isCreditBillPayment(tx) {
    const amount = Number(tx?.amount || 0);
    const description = normalizeComparableText(tx?.description || tx?.descriptionRaw || '');
    if (amount < 0) return true;
    return description.includes('pagamento')
      || description.includes('fatura')
      || description.includes('credito fatura')
      || description.includes('estorno')
      || description.includes('ressarcimento')
      || description.includes('reembolso')
      || description.includes('chargeback');
  }

  function inferBankMovementType(tx) {
    const direction = normalizeComparableText(tx?.direction || tx?.transactionDirection || tx?.flow || '');
    if (direction.includes('in')) return 'aporte';
    if (direction.includes('out')) return 'retirada';

    const operation = normalizeComparableText(tx?.operationType || tx?.operation || '');
    if (operation.includes('credit')) return 'aporte';
    if (operation.includes('debit')) return 'retirada';

    const type = normalizeComparableText(tx?.type || tx?.transactionType || '');
    if (type === 'credit') return 'aporte';
    if (type === 'debit') return 'retirada';

    const amount = Number(tx?.amount || 0);
    return amount >= 0 ? 'aporte' : 'retirada';
  }

  function getGroupKey(account) {
    return String(account?.accountId || '');
  }

  function getGroupAlias(account) {
    const key = getGroupKey(account);
    return normalizeText(STATE.userState.aliases[key] || account?.accountName || 'Conta');
  }

  function dedupeLabel(label) {
    const raw = normalizeText(label);
    if (!raw) return raw;
    const compact = raw.replace(/\s+/g, ' ').trim();
    const half = Math.floor(compact.length / 2);
    if (compact.length > 3 && compact.length % 2 === 0) {
      const a = compact.slice(0, half);
      const b = compact.slice(half);
      if (normalizeComparableText(a) === normalizeComparableText(b)) return a.trim();
    }
    const words = compact.split(' ');
    if (words.length > 1) {
      const seen = [];
      for (const word of words) {
        const norm = normalizeComparableText(word);
        if (!norm || seen.includes(norm)) continue;
        seen.push(norm);
      }
      if (seen.length) {
        const rebuilt = [];
        for (const norm of seen) {
          const first = words.find(item => normalizeComparableText(item) === norm);
          if (first) rebuilt.push(first);
        }
        return rebuilt.join(' ');
      }
    }
    return compact;
  }

  function getGroupClearedAt(account) {
    return Number(STATE.userState.clearedAtByGroup[getGroupKey(account)] || 0) || 0;
  }

  function isGroupCollapsed(accountId) {
    return STATE.collapsedGroups[String(accountId)] === true;
  }

  function setSortState(accountId, column) {
    const key = String(accountId);
    const current = STATE.sortByGroup[key] || { column: 'date', dir: 'desc' };
    const nextDir = current.column === column && current.dir === 'asc' ? 'desc' : 'asc';
    STATE.sortByGroup[key] = { column, dir: nextDir };
    renderWorkspace();
  }

  function getSortState(accountId, accountType) {
    const current = STATE.sortByGroup[String(accountId)];
    if (current?.column) return current;
    return { column: 'date', dir: 'desc', accountType };
  }

  function isTxVisibleByClearRule(account, tx) {
    const clearedAt = getGroupClearedAt(account);
    if (!clearedAt) return true;
    const txTime = Date.parse(String(tx?.date || ''));
    if (!Number.isFinite(txTime)) return !STATE.userState.hiddenGroups[`tx:${String(tx?.id || '')}`];
    return txTime > clearedAt;
  }

  function shouldSkipTx(account, tx) {
    const txId = String(tx?.id || '');
    if (!txId) return true;
    if (STATE.userState.hiddenGroups[`tx:${txId}`]) return true;
    if (isSaldoSyncDescription(tx?.description || tx?.descriptionRaw || '')) return true;
    if (String(account?.accountType || '').toUpperCase() === 'CREDIT' && isCreditBillPayment(tx)) return true;
    if (!isTxVisibleByClearRule(account, tx)) return true;
    return false;
  }

  function getAccountById(accountId) {
    const accounts = Array.isArray(STATE.rawData?.accounts) ? STATE.rawData.accounts : [];
    return accounts.find(item => String(item.accountId) === String(accountId)) || null;
  }

  function validLinkIdsForAccountType(accountType) {
    if (String(accountType || '').toUpperCase() === 'CREDIT') {
      return new Set(getAllCards().map(item => String(item.id || '')));
    }
    return new Set(getAllPatrimonioAccounts().map(item => String(item.id || '')));
  }

  function getAutoLinkForAccount(account) {
    const key = getGroupKey(account);
    const persisted = normalizeText(STATE.userState.links[key] || '');
    const validIds = validLinkIdsForAccountType(account.accountType);
    if (persisted && validIds.has(persisted)) return persisted;

    const normalizedName = normalizeComparableText(account?.accountName || '');
    const candidates = String(account?.accountType || '').toUpperCase() === 'CREDIT'
      ? getAllCards().map(item => ({ id: String(item.id || ''), name: String(item.name || '') }))
      : getAllPatrimonioAccounts().map(item => ({ id: String(item.id || ''), name: String(item.name || item.nome || '') }));
    const matched = candidates.find(item => {
      const candidateName = normalizeComparableText(item.name || '');
      return candidateName && (normalizedName.includes(candidateName) || candidateName.includes(normalizedName));
    });
    if (matched?.id) {
      STATE.userState.links[key] = matched.id;
      persistUserState();
      return matched.id;
    }
    return '';
  }

  function getCardMeta(card) {
    if (typeof global.getUnifiedCardInstitutionMeta === 'function') {
      return global.getUnifiedCardInstitutionMeta(card)?.meta || null;
    }
    return null;
  }

  function renderCardIcon(card) {
    const meta = getCardMeta(card);
    if (meta?.short && meta?.className) {
      return `<span class="smart-icon-badge smart-bank-badge ${escapeHtml(meta.className)}" aria-hidden="true">${escapeHtml(meta.short)}</span>`;
    }
    return '<span class="pluggy-link-fallback-icon" aria-hidden="true">ðŸ’³</span>';
  }

  function renderAccountIcon() {
    return '<span class="pluggy-link-fallback-icon" aria-hidden="true">ðŸ¦</span>';
  }

  function resolveLinkedDisplay(account, linkedId) {
    if (!linkedId) return '<span class="text-muted">Sem vinculo</span>';
    if (String(account.accountType || '').toUpperCase() === 'CREDIT') {
      const card = getAllCards().find(item => String(item.id) === String(linkedId));
      if (!card) return '<span class="text-muted">Cartao nao encontrado</span>';
      return `<span>${escapeHtml(dedupeLabel(card.name || 'Cartao'))}</span>`;
    }
    const acc = getAllPatrimonioAccounts().find(item => String(item.id) === String(linkedId));
    if (!acc) return '<span class="text-muted">Conta nao encontrada</span>';
    return `<span>${escapeHtml(dedupeLabel(String(acc.name || acc.nome || 'Conta')))}</span>`;
  }

  function applyCategoryMemory(tx, row) {
    const key = normalizeDescriptionKey(row._ui.description || tx.description || '');
    if (!key) return;
    const memorized = normalizeText(STATE.userState.categoryMemory[key] || '');
    if (!memorized) return;
    const allCategories = getAllCategories();
    if (allCategories.some(cat => normalizeComparableText(cat) === normalizeComparableText(memorized))) {
      row._ui.category = allCategories.find(cat => normalizeComparableText(cat) === normalizeComparableText(memorized)) || row._ui.category;
    }
  }

  function ensurePending(account) {
    const accountId = String(account?.accountId || '');
    if (!accountId) return [];
    if (Array.isArray(STATE.pendingByAccount[accountId])) return STATE.pendingByAccount[accountId];

    const categories = getAllCategories();
    const rows = (account.transactions || [])
      .filter(tx => !shouldSkipTx(account, tx))
      .map(tx => {
        const txType = String(tx?.type || '').toUpperCase();
        const line = {
          ...tx,
          _ui: {
            description: normalizeText(tx?.description || tx?.descriptionRaw || 'Transacao Pluggy'),
            category: inferCategory(tx?.category, categories),
            tag: '',
            movementType: txType === 'CREDIT' ? 'aporte' : (txType === 'DEBIT' ? 'retirada' : inferBankMovementType(tx))
          }
        };
        if (String(account.accountType || '').toUpperCase() === 'CREDIT') applyCategoryMemory(tx, line);
        return line;
      });
    STATE.pendingByAccount[accountId] = rows;
    return rows;
  }

  function updatePendingField(accountId, txId, field, value) {
    const rows = STATE.pendingByAccount[String(accountId)] || [];
    const target = rows.find(item => String(item.id) === String(txId));
    if (!target || !target._ui) return;
    target._ui[field] = value;
    if (field === 'description' && String(getAccountById(accountId)?.accountType || '').toUpperCase() === 'CREDIT') {
      applyCategoryMemory(target, target);
    }
  }

  function removePendingTx(accountId, txId) {
    const rows = STATE.pendingByAccount[String(accountId)] || [];
    STATE.pendingByAccount[String(accountId)] = rows.filter(item => String(item.id) !== String(txId));
    STATE.userState.hiddenGroups[`tx:${String(txId)}`] = true;
    persistUserState();
  }

  function ensureMonthFromDate(dateBr) {
    const value = normalizeText(dateBr);
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (!match) return null;
    const monthNum = Number(match[2]);
    const year = 2000 + Number(match[3]);
    const monthName = Object.keys(global.MONTH_INDEX || {}).find(key => Number(global.MONTH_INDEX[key]) === (monthNum - 1));
    if (!monthName || typeof global.ensureMonthExists !== 'function') return null;
    return global.ensureMonthExists(monthName, year);
  }

  function dedupeCredit(tx, month, cardId, dateBr, amount, description) {
    const targetDesc = normalizeDescriptionKey(description);
    const targetTxId = String(tx?.id || '');
    return (month?.outflows || []).some(item => {
      if (String(item?.outputKind || '') !== 'card') return false;
      if (String(item?.outputRef || '') !== String(cardId)) return false;
      if (String(item?.pluggyTransactionId || '') === targetTxId) return true;
      const sameDate = String(item?.date || '') === String(dateBr);
      const sameAmount = Math.abs(Number(item?.amount || 0) - Number(amount || 0)) < 0.01;
      const desc = normalizeDescriptionKey(item?.description || '');
      const sameDesc = desc && targetDesc ? (desc === targetDesc || desc.includes(targetDesc) || targetDesc.includes(desc)) : false;
      return sameDate && sameAmount && sameDesc;
    });
  }

  function dedupeBank(tx, accountId, value, description, dateIso) {
    const movements = getPatrimonioMovementsRef();
    const txId = String(tx?.id || '');
    const targetDesc = normalizeDescriptionKey(description);
    return movements.some(item => {
      if (String(item?.pluggyTransactionId || '') === txId) return true;
      if (String(item?.accountId || '') !== String(accountId)) return false;
      const sameDate = String(item?.date || '') === String(dateIso);
      const sameValue = Math.abs(Number(item?.value || 0) - Number(value || 0)) < 0.01;
      const desc = normalizeDescriptionKey(item?.description || '');
      const sameDesc = desc && targetDesc ? (desc === targetDesc || desc.includes(targetDesc) || targetDesc.includes(desc)) : false;
      return sameDate && sameValue && sameDesc;
    });
  }

  function rememberCategory(description, category) {
    const normCategory = normalizeText(category);
    if (!normCategory) return;
    const allCategories = getAllCategories();
    if (!allCategories.some(cat => normalizeComparableText(cat) === normalizeComparableText(normCategory))) return;
    const key = normalizeDescriptionKey(description);
    if (!key) return;
    STATE.userState.categoryMemory[key] = normCategory;
    persistUserState();
  }

  function commitCreditTransaction(accountId, txId) {
    const account = getAccountById(accountId);
    if (!account) throw new Error('Conta Pluggy nao encontrada.');
    const tx = ensurePending(account).find(item => String(item.id) === String(txId));
    if (!tx) return;

    const linkedCardId = normalizeText(STATE.userState.links[String(accountId)] || '');
    if (!linkedCardId || !validLinkIdsForAccountType('CREDIT').has(linkedCardId)) {
      throw new Error('Vincule essa conta a um cartao valido antes de adicionar.');
    }

    const { dateBr } = formatDateAndTime(tx.date);
    const monthId = global.BillImportSchema?.getMonthIdFromDate ? global.BillImportSchema.getMonthIdFromDate(dateBr) : '';
    let month = getDataRef().find(item => String(item.id) === String(monthId));
    if (!month) month = ensureMonthFromDate(dateBr);
    if (!month) throw new Error('Nao foi possivel identificar o mes da transacao.');

    const amount = Math.abs(Number(tx.amount || 0));
    const description = normalizeText(tx._ui?.description || tx.description || '');
    if (!dateBr || !description || !(amount > 0)) throw new Error('Dados invalidos na transacao.');

    if (dedupeCredit(tx, month, linkedCardId, dateBr, amount, description)) {
      removePendingTx(accountId, txId);
      showStatus('Transacao duplicada ignorada.', 'warning');
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
      tag: normalizeText(tx._ui?.tag || ''),
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

    rememberCategory(description, base.category);
    global.save(true);
    removePendingTx(accountId, txId);
  }

  function commitBankTransaction(accountId, txId) {
    const account = getAccountById(accountId);
    if (!account) throw new Error('Conta Pluggy nao encontrada.');
    const tx = ensurePending(account).find(item => String(item.id) === String(txId));
    if (!tx) return;

    const linkedAccountId = normalizeText(STATE.userState.links[String(accountId)] || '');
    if (!linkedAccountId || !validLinkIdsForAccountType('BANK').has(linkedAccountId)) {
      throw new Error('Vincule essa conta a uma conta patrimonial valida antes de adicionar.');
    }

    const value = Math.abs(Number(tx.amount || 0));
    const description = normalizeText(tx._ui?.description || tx.description || '');
    const dateIso = dateToIsoDay(tx.date);
    if (!dateIso || !description || !(value > 0)) throw new Error('Dados invalidos na transacao.');

    if (dedupeBank(tx, linkedAccountId, value, description, dateIso)) {
      removePendingTx(accountId, txId);
      showStatus('Movimentacao duplicada ignorada.', 'warning');
      return;
    }

    const movementBase = {
      id: `pluggy_pat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: normalizeText(tx._ui?.movementType || inferBankMovementType(tx)),
      accountId: linkedAccountId,
      value,
      description,
      date: dateIso,
      pluggyTransactionId: String(tx.id || '')
    };
    const movement = typeof global.normalizePatrimonioMovement === 'function'
      ? global.normalizePatrimonioMovement(movementBase, getPatrimonioMovementsRef().length)
      : movementBase;
    const updatedMovements = [movement].concat(getPatrimonioMovementsRef());
    setPatrimonioMovementsRef(updatedMovements);
    global.save(true);
    if (typeof global.renderPatrimonioMetrics === 'function') global.renderPatrimonioMetrics();
    if (typeof global.renderPatrimonioAccounts === 'function') global.renderPatrimonioAccounts();
    removePendingTx(accountId, txId);
  }

  function categoryOptions(selected) {
    return [''].concat(getAllCategories()).map(cat => {
      const value = normalizeText(cat);
      const label = value || 'Sem categoria';
      return `<option value="${escapeHtml(value)}" ${value === String(selected || '') ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
  }

  function tagOptions(selected) {
    return [''].concat(getAllTags()).map(tag => {
      const value = normalizeText(tag);
      const label = value || 'Sem tag';
      return `<option value="${escapeHtml(value)}" ${value === String(selected || '') ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
  }

  function linkOptions(account, selectedId) {
    const isCredit = String(account.accountType || '').toUpperCase() === 'CREDIT';
    const list = isCredit ? getAllCards() : getAllPatrimonioAccounts();
    const placeholder = isCredit ? '-- Selecione um cartao --' : '-- Selecione uma conta --';
    const options = [`<option value="">${placeholder}</option>`];
    list.forEach(item => {
      const id = String(item?.id || '');
      const name = dedupeLabel(String(item?.name || item?.nome || id || 'Sem nome'));
      const iconText = isCredit ? (getCardMeta(item)?.short || 'ðŸ’³') : 'ðŸ¦';
      options.push(`<option value="${escapeHtml(id)}" ${id === String(selectedId || '') ? 'selected' : ''}>${escapeHtml(name)}</option>`);
    });
    return options.join('');
  }

  function sortRowsForAccount(account, rows) {
    const isCredit = String(account.accountType || '').toUpperCase() === 'CREDIT';
    const state = getSortState(account.accountId, account.accountType);
    const dir = state.dir === 'asc' ? 1 : -1;
    const sorted = [...rows].sort((a, b) => {
      if (state.column === 'date') {
        const av = Date.parse(String(a.date || '')) || 0;
        const bv = Date.parse(String(b.date || '')) || 0;
        return (av - bv) * dir;
      }
      if (state.column === 'description') {
        const av = normalizeComparableText(a._ui?.description || a.description || '');
        const bv = normalizeComparableText(b._ui?.description || b.description || '');
        return av.localeCompare(bv) * dir;
      }
      if (state.column === 'category') {
        const av = normalizeComparableText(a._ui?.category || '');
        const bv = normalizeComparableText(b._ui?.category || '');
        return av.localeCompare(bv) * dir;
      }
      if (state.column === 'value') {
        const av = Math.abs(Number(a.amount || 0));
        const bv = Math.abs(Number(b.amount || 0));
        return (av - bv) * dir;
      }
      if (state.column === 'installment' && isCredit) {
        const ai = Number(a?.creditCardMetadata?.installmentNumber || 1);
        const bi = Number(b?.creditCardMetadata?.installmentNumber || 1);
        return (ai - bi) * dir;
      }
      return 0;
    });
    return sorted;
  }

  function getRowsForAccount(account) {
    return sortRowsForAccount(account, ensurePending(account));
  }

  function isCreditRowValid(tx) {
    return !!normalizeText(tx?._ui?.category || '');
  }

  function sortableHeader(accountId, key, label) {
    const state = getSortState(accountId);
    const isActive = state.column === key;
    const marker = isActive ? (state.dir === 'asc' ? ' â†‘' : ' â†“') : '';
    const cls = isActive ? 'pluggy-sort-active' : '';
    return `<button class="pluggy-sort-btn ${cls}" type="button" onclick="PluggyBanking.sortBy('${escapeHtml(String(accountId))}','${escapeHtml(key)}')">${escapeHtml(label)}${marker}</button>`;
  }

  function getAccountsByType(type) {
    const all = Array.isArray(STATE.rawData?.accounts) ? STATE.rawData.accounts : [];
    return all.filter(item => String(item.accountType || '').toUpperCase() === String(type || '').toUpperCase());
  }

  function renderTypeButtons() {
    return `
      <div class="pluggy-view-switch">
        <button class="btn ${STATE.currentView === 'bank' ? 'btn-primary' : 'btn-ghost'}" type="button" onclick="PluggyBanking.switchView('bank')">Transacoes de conta corrente</button>
        <button class="btn ${STATE.currentView === 'credit' ? 'btn-primary' : 'btn-ghost'}" type="button" onclick="PluggyBanking.switchView('credit')">Transacoes do cartao de credito</button>
        <button class="btn btn-ghost" type="button" onclick="PluggyBanking.openRestoreDialog()">Recarregar historico</button>
      </div>
    `;
  }

  function renderRestoreDialogContent() {
    const accounts = Array.isArray(STATE.rawData?.accounts) ? STATE.rawData.accounts : [];
    const changedAccounts = accounts.filter(account => {
      const key = getGroupKey(account);
      return STATE.userState.hiddenGroups[`group:${key}`] || STATE.userState.clearedAtByGroup[key];
    });
    if (!changedAccounts.length) return '<div class="text-muted" style="padding:8px 2px">Nenhum grupo foi limpo ou ocultado.</div>';

    return changedAccounts.map(account => {
      const key = getGroupKey(account);
      const alias = getGroupAlias(account);
      const isHidden = STATE.userState.hiddenGroups[`group:${key}`] === true;
      const isCleared = Number(STATE.userState.clearedAtByGroup[key] || 0) > 0;
      return `
        <label class="pluggy-restore-option">
          <input type="checkbox" value="${escapeHtml(key)}" checked>
          <span>
            <strong>${escapeHtml(alias)}</strong>
            <small>${escapeHtml(account.accountType === 'CREDIT' ? 'Cartao de credito' : 'Conta bancaria')} ${isHidden ? '- ocultado' : ''} ${isCleared ? '- lista limpa' : ''}</small>
          </span>
        </label>
      `;
    }).join('');
  }

  function ensureRestoreModal() {
    if (document.getElementById('pluggyRestoreModal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.id = 'pluggyRestoreModal';
    modal.innerHTML = `
      <div class="modal" style="max-width:560px" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>Recarregar historico</h3>
          <button class="btn-icon" type="button" onclick="PluggyBanking.closeRestoreDialog()">âœ•</button>
        </div>
        <p class="text-muted" style="margin:0 0 10px">Selecione os cartoes/contas que deseja restaurar para o estado original.</p>
        <div id="pluggyRestoreList" class="pluggy-restore-list"></div>
        <div class="form-actions" style="margin-top:14px">
          <button class="btn btn-ghost" type="button" onclick="PluggyBanking.closeRestoreDialog()">Cancelar</button>
          <button class="btn btn-primary" type="button" onclick="PluggyBanking.confirmRestoreDialog()">Confirmar</button>
        </div>
      </div>
    `;
    modal.addEventListener('click', (event) => {
      if (event.target && event.target.id === 'pluggyRestoreModal') closeRestoreDialog();
    });
    document.body.appendChild(modal);
  }

  function openRestoreDialog() {
    ensureRestoreModal();
    const list = document.getElementById('pluggyRestoreList');
    if (list) list.innerHTML = renderRestoreDialogContent();
    if (typeof global.openModal === 'function') global.openModal('pluggyRestoreModal');
  }

  function closeRestoreDialog() {
    if (typeof global.closeModal === 'function') global.closeModal('pluggyRestoreModal');
  }

  function confirmRestoreDialog() {
    const checks = Array.from(document.querySelectorAll('#pluggyRestoreList input[type="checkbox"]:checked'));
    if (!checks.length) {
      closeRestoreDialog();
      return;
    }
    checks.forEach(node => {
      const key = String(node.value || '');
      delete STATE.userState.hiddenGroups[`group:${key}`];
      delete STATE.userState.clearedAtByGroup[key];
      delete STATE.pendingByAccount[key];
    });
    persistUserState();
    closeRestoreDialog();
    renderWorkspace();
    showStatus('Historico restaurado para os grupos selecionados.', 'ok');
  }

  function clearGroupList(accountId) {
    const account = getAccountById(accountId);
    if (!account) return;
    STATE.userState.clearedAtByGroup[String(accountId)] = Date.now();
    delete STATE.pendingByAccount[String(accountId)];
    persistUserState();
    renderWorkspace();
    showStatus('Lista limpa. Somente novos lancamentos aparecerao neste grupo.', 'ok');
  }

  function hideGroup(accountId) {
    const account = getAccountById(accountId);
    if (!account) return;
    const alias = getGroupAlias(account);
    if (!confirm(`Ocultar o grupo "${alias}" desta revisao?`)) return;
    STATE.userState.hiddenGroups[`group:${String(accountId)}`] = true;
    persistUserState();
    renderWorkspace();
  }

  function changeGroupAlias(accountId, value) {
    const safe = normalizeText(value);
    if (!safe) return;
    STATE.userState.aliases[String(accountId)] = safe;
    STATE.aliasEditor = null;
    persistUserState();
    renderWorkspace();
  }

  function startAliasEdit(accountId) {
    STATE.aliasEditor = { groupId: String(accountId) };
    renderWorkspace();
  }

  function aliasEditorKeydown(event, accountId) {
    if (!event) return;
    if (event.key === 'Escape') {
      STATE.aliasEditor = null;
      renderWorkspace();
      return;
    }
    if (event.key === 'Enter') {
      const target = event.target;
      changeGroupAlias(accountId, target?.value || '');
    }
  }

  function finishAliasEdit(accountId, value) {
    const safe = normalizeText(value);
    if (safe) {
      changeGroupAlias(accountId, safe);
      return;
    }
    STATE.aliasEditor = null;
    renderWorkspace();
  }

  function toggleGroup(accountId) {
    const key = String(accountId);
    STATE.collapsedGroups[key] = !isGroupCollapsed(key);
    renderWorkspace();
  }

  function changeLink(accountId, value) {
    const account = getAccountById(accountId);
    if (!account) return;
    const validIds = validLinkIdsForAccountType(account.accountType);
    const selected = normalizeText(value);
    if (selected && !validIds.has(selected)) {
      showStatus('Vinculo invalido para este usuario.', 'error');
      return;
    }
    STATE.userState.links[String(accountId)] = selected;
    persistUserState();
    renderWorkspace();
  }

  function renderDateCell(tx) {
    const { dateBr, timeBr } = formatDateAndTime(tx.date);
    const dateLabel = dateBr || '--';
    return `${escapeHtml(dateLabel)}${timeBr ? `<div class="pluggy-row-time">${escapeHtml(timeBr)}</div>` : ''}`;
  }

  function renderRows(account) {
    const rows = getRowsForAccount(account);
    const isCredit = String(account.accountType || '').toUpperCase() === 'CREDIT';
    if (!rows.length) {
      const cols = isCredit ? 7 : 5;
      return `<tr><td colspan="${cols}" class="text-muted" style="padding:14px">Sem transacoes pendentes para revisao.</td></tr>`;
    }

    return rows.map(tx => {
      const amountAbs = Math.abs(Number(tx.amount || 0));
      const installmentTotal = Number(tx?.creditCardMetadata?.totalInstallments || 1) || 1;
      const installmentIndex = Number(tx?.creditCardMetadata?.installmentNumber || 1) || 1;
      const installmentLabel = installmentTotal > 1 ? `Parcela ${installmentIndex} de ${installmentTotal}` : '-';

      if (isCredit) {
        return `
          <tr>
            <td>${renderDateCell(tx)}</td>
            <td><input class="pluggy-input" value="${escapeHtml(tx._ui?.description || '')}" onchange="PluggyBanking.updateField('${escapeHtml(account.accountId)}','${escapeHtml(tx.id)}','description',this.value)"></td>
            <td>
              <select class="pluggy-input" onchange="PluggyBanking.updateField('${escapeHtml(account.accountId)}','${escapeHtml(tx.id)}','category',this.value)">
                ${categoryOptions(tx._ui?.category || '')}
              </select>
            </td>
            <td>
              <select class="pluggy-input" onchange="PluggyBanking.updateField('${escapeHtml(account.accountId)}','${escapeHtml(tx.id)}','tag',this.value)">
                ${tagOptions(tx._ui?.tag || '')}
              </select>
            </td>
            <td class="amount-neg">${escapeHtml(money(amountAbs))}</td>
            <td>${escapeHtml(installmentLabel)}</td>
            <td class="pluggy-actions-cell">
              <button class="btn btn-subtle btn-sm" type="button" ${isCreditRowValid(tx) ? '' : 'disabled'} onclick="PluggyBanking.addOne('${escapeHtml(account.accountId)}','${escapeHtml(tx.id)}')">Adicionar</button>
              <button class="btn btn-link-action btn-sm" type="button" onclick="PluggyBanking.dismiss('${escapeHtml(account.accountId)}','${escapeHtml(tx.id)}')" title="Ignorar">✕</button>
            </td>
          </tr>
        `;
      }

      return `
        <tr>
          <td>${renderDateCell(tx)}</td>
          <td>
            <select class="pluggy-input" onchange="PluggyBanking.updateField('${escapeHtml(account.accountId)}','${escapeHtml(tx.id)}','movementType',this.value)">
              <option value="aporte" ${tx._ui?.movementType === 'aporte' ? 'selected' : ''}>Aporte</option>
              <option value="retirada" ${tx._ui?.movementType === 'retirada' ? 'selected' : ''}>Retirada</option>
            </select>
          </td>
          <td><input class="pluggy-input" value="${escapeHtml(tx._ui?.description || '')}" onchange="PluggyBanking.updateField('${escapeHtml(account.accountId)}','${escapeHtml(tx.id)}','description',this.value)"></td>
          <td class="${tx._ui?.movementType === 'aporte' ? 'amount-pos' : 'amount-neg'}">${escapeHtml(money(amountAbs))}</td>
          <td class="pluggy-actions-cell">
            <button class="btn btn-subtle btn-sm" type="button" onclick="PluggyBanking.addOne('${escapeHtml(account.accountId)}','${escapeHtml(tx.id)}')">Adicionar</button>
            <button class="btn btn-link-action btn-sm" type="button" onclick="PluggyBanking.dismiss('${escapeHtml(account.accountId)}','${escapeHtml(tx.id)}')" title="Ignorar">✕</button>
          </td>
          </tr>
      `;
    }).join('');
  }
  function renderGroup(account) {
    const key = getGroupKey(account);
    if (STATE.userState.hiddenGroups[`group:${key}`]) return '';
    const isCredit = String(account.accountType || '').toUpperCase() === 'CREDIT';
    const selectedLink = normalizeText(STATE.userState.links[key] || getAutoLinkForAccount(account));
    if (selectedLink && !STATE.userState.links[key]) {
      STATE.userState.links[key] = selectedLink;
      persistUserState();
    }
    const alias = getGroupAlias(account);
    const rows = getRowsForAccount(account);
    const pendingCount = rows.length;
    const totalPending = rows.reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);
    const collapsed = isGroupCollapsed(key);

    return `
      <section class="pluggy-account-group">
        <div class="pluggy-account-header ${collapsed ? 'is-collapsed' : ''}">
          <div class="pluggy-account-head-left">
            <h3 class="pluggy-account-name" ondblclick="PluggyBanking.startAliasEdit('${escapeHtml(key)}')">
              ${STATE.aliasEditor?.groupId === key ? `<input class="pluggy-input pluggy-title-editor" value="${escapeHtml(alias)}" onkeydown="PluggyBanking.aliasEditorKeydown(event,'${escapeHtml(key)}')" onblur="PluggyBanking.finishAliasEdit('${escapeHtml(key)}', this.value)" autofocus>` : escapeHtml(alias)}
            </h3>
            <small class="pluggy-account-origin">Origem: ${escapeHtml(account.accountName || alias)}</small>
            <small class="pluggy-account-origin">${pendingCount} pendente(s) • ${escapeHtml(money(totalPending))}</small>
          </div>
          <div class="pluggy-account-head-right">
            <button class="btn btn-link-action btn-sm" type="button" onclick="PluggyBanking.toggleGroup('${escapeHtml(key)}')">${collapsed ? 'Abrir' : 'Fechar'}</button>
            <button class="btn btn-link-action btn-sm" type="button" onclick="PluggyBanking.clearGroup('${escapeHtml(key)}')">Limpar listas</button>
            <button class="btn btn-link-action btn-sm" type="button" onclick="PluggyBanking.hideGroup('${escapeHtml(key)}')" title="Ocultar grupo">✕</button>
          </div>
        </div>
        ${collapsed ? '' : `
          <div class="pluggy-account-tools">
            <label class="pluggy-inline-label">Vincular a:</label>
            <select class="pluggy-input" onchange="PluggyBanking.changeLink('${escapeHtml(key)}', this.value)">
              ${linkOptions(account, selectedLink)}
            </select>
            <div class="pluggy-linked-chip">${resolveLinkedDisplay(account, selectedLink)}</div>
            <button class="btn btn-subtle btn-sm" type="button" onclick="PluggyBanking.addAll('${escapeHtml(key)}')">Adicionar todos</button>
          </div>
          <div class="pluggy-table-wrap">
            <table class="fin-table pluggy-transactions-table">
              <thead>
                ${isCredit
                  ? `<tr><th>${sortableHeader(key, 'date', 'Data')}</th><th>${sortableHeader(key, 'description', 'Descricao')}</th><th>${sortableHeader(key, 'category', 'Categoria')}</th><th>Tag</th><th>${sortableHeader(key, 'value', 'Valor')}</th><th>${sortableHeader(key, 'installment', 'Parcelado')}</th><th></th></tr>`
                  : `<tr><th>${sortableHeader(key, 'date', 'Data')}</th><th>Tipo</th><th>${sortableHeader(key, 'description', 'Descricao')}</th><th>${sortableHeader(key, 'value', 'Valor')}</th><th></th></tr>`}
              </thead>
              <tbody>${renderRows(account)}</tbody>
            </table>
          </div>
        `}
      </section>
    `;
  }
  function renderTypeButtonsAndContent() {
    const type = STATE.currentView === 'bank' ? 'BANK' : 'CREDIT';
    const accounts = getAccountsByType(type);
    if (!accounts.length) {
      return `<div class="section"><div class="section-body text-muted" style="padding:16px">Nenhuma conta encontrada para este tipo.</div></div>`;
    }
    const groupsHtml = accounts.map(renderGroup).join('');
    return groupsHtml || '<div class="section"><div class="section-body text-muted" style="padding:16px">Todos os grupos desta visao foram ocultados.</div></div>';
  }

  function renderWorkspace() {
    const node = document.getElementById(String(STATE.mountId || 'internetBankingWorkspace'));
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

    node.innerHTML = `
      ${renderTypeButtons()}
      <div class="pluggy-last-sync">Ultima atualizacao: ${escapeHtml(loadedAtLabel)}</div>
      ${renderTypeButtonsAndContent()}
    `;
  }

  async function loadData() {
    STATE.loading = true;
    STATE.error = '';
    renderWorkspace();
    try {
      const response = await fetch(`/api/pluggy/transactions?limit=${PAGE_SIZE}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: getCsrfHeaders({ Accept: 'application/json' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Falha ao carregar dados do Pluggy.');
      STATE.rawData = payload || { accounts: [] };
      STATE.loadedAt = new Date().toISOString();
      STATE.pendingByAccount = {};
      loadUserState();
    } catch (error) {
      STATE.error = error?.message || 'Falha ao carregar dados do Pluggy.';
    } finally {
      STATE.loading = false;
      renderWorkspace();
    }
  }

  function addOne(accountId, txId) {
    try {
      const account = getAccountById(accountId);
      if (!account) return;
      const row = ensurePending(account).find(item => String(item.id) === String(txId));
      if (String(account.accountType || '').toUpperCase() === 'CREDIT' && !isCreditRowValid(row)) {
        throw new Error('Selecione uma categoria antes de adicionar esse lancamento de cartao.');
      }
      if (String(account.accountType || '').toUpperCase() === 'CREDIT') commitCreditTransaction(accountId, txId);
      else commitBankTransaction(accountId, txId);
      renderWorkspace();
      showStatus('Lancamento adicionado com sucesso.', 'ok');
    } catch (error) {
      showStatus(error?.message || 'Falha ao adicionar lancamento.', 'error');
    }
  }

  function addAll(accountId) {
    const account = getAccountById(accountId);
    if (!account) return;
    const rows = [...getRowsForAccount(account)];
    let ok = 0;
    let errors = 0;
    let blockedByCategory = 0;
    rows.forEach(tx => {
      try {
        if (String(account.accountType || '').toUpperCase() === 'CREDIT' && !isCreditRowValid(tx)) {
          blockedByCategory += 1;
          return;
        }
        if (String(account.accountType || '').toUpperCase() === 'CREDIT') commitCreditTransaction(accountId, tx.id);
        else commitBankTransaction(accountId, tx.id);
        ok += 1;
      } catch (_err) {
        errors += 1;
      }
    });
    renderWorkspace();
    const parts = [`${ok} lancamento(s) adicionado(s)`];
    if (blockedByCategory) parts.push(`${blockedByCategory} sem categoria`);
    if (errors) parts.push(`${errors} com erro`);
    showStatus(parts.join(', ') + '.', (errors || blockedByCategory) ? 'warning' : 'ok');
  }

  function dismiss(accountId, txId) {
    removePendingTx(accountId, txId);
    renderWorkspace();
  }

  function switchView(view) {
    STATE.currentView = view === 'bank' ? 'bank' : 'credit';
    renderWorkspace();
  }

  async function renderPage(forceReload = false, mountId = 'internetBankingWorkspace') {
    STATE.mountId = String(mountId || 'internetBankingWorkspace');
    loadUserState();
    if (forceReload || !STATE.rawData) await loadData();
    else renderWorkspace();
  }

  global.PluggyBanking = {
    switchView,
    updateField: updatePendingField,
    sortBy: setSortState,
    toggleGroup,
    startAliasEdit,
    aliasEditorKeydown,
    finishAliasEdit,
    addOne,
    addAll,
    dismiss,
    changeLink,
    clearGroup: clearGroupList,
    hideGroup,
    setAlias: changeGroupAlias,
    openRestoreDialog,
    closeRestoreDialog,
    confirmRestoreDialog
  };

  global.renderInternetBankingPage = renderPage;
  global.__pluggyBankingTest = { normalizeDescriptionKey, isSaldoSyncDescription, inferBankMovementType };
})(typeof window !== 'undefined' ? window : globalThis);






