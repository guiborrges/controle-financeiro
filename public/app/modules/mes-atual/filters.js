function normalizeUnifiedSearchToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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
  const normalizedTagFilter = String(tagFilterValue || '').trim().toLowerCase();
  const normalizedSearch = normalizeUnifiedSearchToken(searchValue);
  const matchesSearch = (row) => {
    if (!normalizedSearch) return true;
    if (row.kind === 'bill') {
      const card = (month.outflowCards || []).find(entry => entry.id === row.item.cardId);
      const dateLabel = getUnifiedCardPaymentDateLabelForFilters(month, card);
      const billText = normalizeUnifiedSearchToken(`${card?.name || 'cartao'} ${dateLabel}`);
      return billText.includes(normalizedSearch);
    }
    const item = row.item || {};
    const haystack = normalizeUnifiedSearchToken(`${item.description || ''} ${item.date || ''}`);
    return haystack.includes(normalizedSearch);
  };
  const applyTagFilter = (baseRows) => {
    if (!normalizedTagFilter) return baseRows;
    return (baseRows || []).filter(row => {
      if (row.kind !== 'outflow') return false;
      return String(row.item?.tag || '').trim().toLowerCase() === normalizedTagFilter;
    });
  };
  if (filterValue === 'fixed') filterValue = 'expense';
  if (filterValue === 'expense') {
    return applyTagFilter([
      ...rows.filter(row => {
        const type = String(row.item?.type || '').toLowerCase();
        return type === 'expense' || type === 'fixed';
      }),
      ...rows.filter(row => row.item.type === 'spend' && row.item.outputKind === 'method' && ['pix', 'dinheiro', 'debito'].includes(row.item.outputMethod)),
      ...billRows
    ]);
  }
  if (filterValue === 'spend') return applyTagFilter(rows.filter(row => String(row.item?.type || '').toLowerCase() === 'spend'));
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
  if (filterValue !== 'all' || !normalizedSearch) return base;
  return base.filter(matchesSearch);
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
  if (field === 'valor') return ((Number(a.item.amount || 0) - Number(b.item.amount || 0)) * factor);
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
