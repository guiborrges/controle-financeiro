function normalizeUnifiedSearchToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getUnifiedEffectiveOutflowAmountForFilters(item) {
  const resolver = window.OutflowAmounts?.getEffectiveOutflowAmount;
  const raw = typeof resolver === 'function'
    ? resolver(item)
    : (item?.amount ?? item?.valor ?? 0);
  return Math.max(0, Number(raw || 0) || 0);
}

function getUnifiedMonthDateForFilters(month) {
  if (typeof getMonthDateFromMonthObject === 'function') {
    return getMonthDateFromMonthObject(month);
  }
  const rawName = String(month?.nome || '').trim().toUpperCase();
  const yearMatch = rawName.match(/\b(20\d{2})\b/);
  const year = Number(yearMatch?.[1] || new Date().getFullYear());
  const monthToken = rawName
    .replace(/\b(20\d{2})\b/g, '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const monthMap = {
    JANEIRO: 0,
    FEVEREIRO: 1,
    MARCO: 2,
    ABRIL: 3,
    MAIO: 4,
    JUNHO: 5,
    JULHO: 6,
    AGOSTO: 7,
    SETEMBRO: 8,
    OUTUBRO: 9,
    NOVEMBRO: 10,
    DEZEMBRO: 11
  };
  const monthIndex = monthMap[monthToken] ?? 0;
  return new Date(year, monthIndex, 1);
}

function getUnifiedCardPaymentDateLabelForFilters(month, card) {
  const explicit = typeof normalizeVarDate === 'function'
    ? (normalizeVarDate(card?.paymentDate || '') || '')
    : '';
  if (explicit) return explicit;
  const monthDate = getUnifiedMonthDateForFilters(month);
  const day = Math.max(1, Math.min(31, Number(card?.paymentDay || 1) || 1));
  const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, day);
  return normalizeVarDate(`${String(dueDate.getDate()).padStart(2, '0')}/${String(dueDate.getMonth() + 1).padStart(2, '0')}/${dueDate.getFullYear()}`) || '';
}

function getUnifiedFilterRows(month, filterValue, tagFilterValue = '', searchValue = '') {
  const rows = (month.outflows || []).map(item => ({ kind: 'outflow', item, sortTime: parseData(item.date || '') || 0 }));
  const billRows = (month.cardBills || []).map(bill => ({ kind: 'bill', item: bill, sortTime: 0 }));
  const isType = (item, kind) => {
    if (typeof isUnifiedLaunchOfType === 'function') return isUnifiedLaunchOfType(item, kind);
    const raw = String(item?.type || '').toLowerCase();
    const isExpense = raw === 'expense' || raw === 'fixed' || item?.expenseRecurring === true || item?.showInMonthPlanning === true || item?.includeInMonthPlanning === true;
    if (kind === 'expense') return isExpense;
    if (kind === 'spend') return !isExpense;
    return false;
  };
  const normalizedTagFilter = String(tagFilterValue || '').trim().toLowerCase();
  const normalizedSearch = normalizeUnifiedSearchToken(searchValue);
  const matchesSearch = (row) => {
    if (!normalizedSearch) return true;
    const item = row.item || {};
    const card = (month.outflowCards || []).find(entry => entry.id === (row.kind === 'bill' ? item.cardId : item.outputRef));
    let text = `${item.description || ''} ${item.category || ''} ${item.tag || ''} ${item.outputMethod || ''} ${card?.name || ''}`;
    let date = item.date || '';
    let amount = getUnifiedEffectiveOutflowAmountForFilters(item);
    if (row.kind === 'bill') {
      text += ' cartao de credito';
      date = getUnifiedCardPaymentDateLabelForFilters(month, card);
      if (typeof getUnifiedCardBillEffectiveAmount === 'function') amount = getUnifiedCardBillEffectiveAmount(month, item);
    }
    const dateParts = String(date).split('/');
    const dateAliases = dateParts.length === 3
      ? `${dateParts[0]}/${dateParts[1]}/${dateParts[2].slice(-2)} ${dateParts[0]}/${dateParts[1]}/${dateParts[2].length === 2 ? '20' : ''}${dateParts[2]} ${dateParts[2].length === 2 ? '20' : ''}${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : '';
    const numeric = `${date} ${dateAliases} ${amount.toFixed(2)} ${amount.toFixed(2).replace('.', ',')} ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const normalizedText = normalizeUnifiedSearchToken(text);
    const tokens = normalizedSearch.replace(/r\$/g, '').trim().split(/\s+/).filter(Boolean);
    const words = normalizedText.split(/[^a-z0-9]+/).filter(Boolean);
    const fuzzy = typeof window.Fuse === 'function'
      ? new window.Fuse(words, { threshold: 0.28, ignoreLocation: true, minMatchCharLength: 3 }) : null;
    return tokens.every(token => /\d/.test(token)
      ? numeric.includes(token) || normalizedText.includes(token)
      : normalizedText.includes(token) || (token.length >= 4 && !!fuzzy?.search(token).length));
  };
  const applyTagFilter = (baseRows) => {
    baseRows = baseRows.filter(matchesSearch);
    if (!normalizedTagFilter) return baseRows;
    return (baseRows || []).filter(row => {
      if (row.kind !== 'outflow') return false;
      return String(row.item?.tag || '').trim().toLowerCase() === normalizedTagFilter;
    });
  };
  if (filterValue === 'fixed') filterValue = 'expense';
  if (filterValue === 'expense') {
    const selected = applyTagFilter([
      ...rows.filter(row => isType(row.item, 'expense')),
      ...rows.filter(row => isType(row.item, 'spend') && row.item.outputKind === 'method' && ['pix', 'dinheiro', 'debito'].includes(row.item.outputMethod)),
      ...billRows
    ]);
    // Planning renders card launches beneath their bill, so retain that heading.
    const matchedCards = new Set(selected.filter(row => row.kind === 'outflow' && row.item.outputKind === 'card').map(row => row.item.outputRef));
    return selected.concat(billRows.filter(row => matchedCards.has(row.item.cardId) && !selected.includes(row)));
  }
  if (filterValue === 'spend') return applyTagFilter(rows.filter(row => isType(row.item, 'spend')));
  if (filterValue.startsWith('card:')) {
    const cardId = filterValue.slice(5);
    return applyTagFilter(rows.filter(row => row.item.outputKind === 'card' && row.item.outputRef === cardId));
  }
  if (filterValue.startsWith('account:')) {
    const accountId = filterValue.slice(8);
    return applyTagFilter(rows.filter(row => row.item.outputKind === 'account' && row.item.outputRef === accountId));
  }
  if (filterValue.startsWith('method:')) {
    const method = filterValue.slice(7);
    return applyTagFilter(rows.filter(row => row.item.outputKind === 'method' && row.item.outputMethod === method));
  }
  const base = applyTagFilter([...rows, ...billRows]);
  return base;
}

function compareUnifiedRows(a, b, field, direction, month) {
  const factor = direction === 'asc' ? 1 : -1;
  const aLabel = a.kind === 'bill'
    ? ((month.outflowCards || []).find(entry => entry.id === a.item.cardId)?.name || 'Cartão')
    : String(a.item.description || '');
  const bLabel = b.kind === 'bill'
    ? ((month.outflowCards || []).find(entry => entry.id === b.item.cardId)?.name || 'Cartão')
    : String(b.item.description || '');
  if (field === 'descricao') return aLabel.localeCompare(bLabel, 'pt-BR') * factor;
  if (field === 'categoria') {
    const aCategory = a.kind === 'bill' ? 'CARTÃO' : String(a.item.category || '');
    const bCategory = b.kind === 'bill' ? 'CARTÃO' : String(b.item.category || '');
    return aCategory.localeCompare(bCategory, 'pt-BR') * factor;
  }
  if (field === 'valor') return ((getUnifiedEffectiveOutflowAmountForFilters(a.item) - getUnifiedEffectiveOutflowAmountForFilters(b.item)) * factor);
  if (field === 'pago') {
    const aPaid = a.kind === 'bill' ? (a.item.paid ? 1 : 0) : ((a.item.paid || a.item.status === 'done') ? 1 : 0);
    const bPaid = b.kind === 'bill' ? (b.item.paid ? 1 : 0) : ((b.item.paid || b.item.status === 'done') ? 1 : 0);
    return (aPaid - bPaid) * factor;
  }
  if (field === 'saida') {
    const aPayment = getUnifiedOutflowPaymentLabel(a.item, month);
    const bPayment = getUnifiedOutflowPaymentLabel(b.item, month);
    return aPayment.localeCompare(bPayment, 'pt-BR') * factor;
  }
  if (field === 'tipo') {
    const aType = a.kind === 'bill' ? 'Cartão mensal' : getUnifiedOutflowTypeLabel(a.item);
    const bType = b.kind === 'bill' ? 'Cartão mensal' : getUnifiedOutflowTypeLabel(b.item);
    return aType.localeCompare(bType, 'pt-BR') * factor;
  }
  const getRowDate = row => {
    if (row.kind !== 'bill') return parseData(row.item.date || '') || 0;
    const card = (month.outflowCards || []).find(entry => entry.id === row.item.cardId);
    return parseData(getUnifiedCardPaymentDateLabelForFilters(month, card)) || 0;
  };
  const aDate = getRowDate(a);
  const bDate = getRowDate(b);
  return (aDate - bDate) * factor;
}

function getSortedUnifiedRows(month, rows, fallbackField = 'data', fallbackDirection = 'desc') {
  const sort = getUnifiedOutflowSort(month);
  const field = sort.field || fallbackField;
  const direction = sort.field ? sort.direction : fallbackDirection;
  return rows.slice().sort((a, b) => compareUnifiedRows(a, b, field, direction, month) || String(b.item.createdAt || '').localeCompare(String(a.item.createdAt || '')));
}
