(function initUniversalSearch(global) {
  'use strict';

  const FUSE_OPTIONS = {
    includeScore: true,
    includeMatches: true,
    threshold: 0.28,
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: [
      { name: 'description', weight: 0.5 },
      { name: 'category', weight: 0.22 },
      { name: 'amountStr', weight: 0.18 },
      { name: 'tag', weight: 0.06 },
      { name: 'monthLabel', weight: 0.04 },
      { name: 'methodLabel', weight: 0.04 }
    ]
  };

  const MONTH_INDEX = {
    janeiro: 1,
    fevereiro: 2,
    marco: 3,
    'mar\u00e7o': 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12
  };

  const state = {
    fuse: null,
    items: [],
    isOpen: false,
    filters: {
      types: new Set(),
      category: new Set(),
      card: new Set(),
      tag: new Set(),
      method: new Set(),
      dateFrom: '',
      dateTo: ''
    }
  };

  function escapeHtml(value) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(value) {
    if (typeof global.fmt === 'function') return global.fmt(Number(value || 0));
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function resolveCategory(item, fallback = 'OUTROS') {
    if (typeof global.getUnifiedOutflowCategoryName === 'function') {
      return String(global.getUnifiedOutflowCategoryName(item, fallback) || fallback);
    }
    const raw = item?.category || item?.categoria || fallback;
    return String(global.resolveCategoryName ? global.resolveCategoryName(raw) : raw).trim() || fallback;
  }

  function getEffectiveAmount(item) {
    if (typeof global.getUnifiedEffectiveOutflowAmount === 'function') {
      return Number(global.getUnifiedEffectiveOutflowAmount(item) || 0);
    }
    if (typeof global.OutflowAmounts?.getEffectiveOutflowAmount === 'function') {
      return Number(global.OutflowAmounts.getEffectiveOutflowAmount(item) || 0);
    }
    return Math.max(0, Number(item?.amount ?? item?.valor ?? 0) || 0);
  }

  function getCategoryIcon(category) {
    const safeCategory = String(category || 'OUTROS');
    if (typeof global.renderSmartIconBadge === 'function' && typeof global.inferCategoryVisual === 'function') {
      const visual = global.inferCategoryVisual(safeCategory);
      return global.renderSmartIconBadge(visual.icon, visual.tone);
    }
    if (typeof global.getCategoryEmoji === 'function') {
      const emoji = global.getCategoryEmoji(safeCategory);
      if (emoji) return escapeHtml(emoji);
    }
    return '<span aria-hidden="true">&bull;</span>';
  }

  function getMonths() {
    if (typeof global.getAllFinanceMonths === 'function') {
      const months = global.getAllFinanceMonths();
      if (Array.isArray(months) && months.length) return months;
    }
    return Array.isArray(global.data) ? global.data : [];
  }

  function monthYearMonth(month) {
    const id = String(month?.id || '').trim().toLowerCase();
    let match = id.match(/^(\d{4})[-_](\d{1,2})$/);
    if (match) return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`;
    match = id.match(/^([a-z\u00e0-\u00ff]+)[-_](\d{4})$/i);
    if (match && MONTH_INDEX[match[1]]) return `${match[2]}-${String(MONTH_INDEX[match[1]]).padStart(2, '0')}`;
    const nome = String(month?.nome || month?.mes || month?.name || '').trim().toLowerCase();
    match = nome.match(/^([a-z\u00e0-\u00ff]+)\s+(\d{4})$/i);
    if (match && MONTH_INDEX[match[1]]) return `${match[2]}-${String(MONTH_INDEX[match[1]]).padStart(2, '0')}`;
    return '';
  }

  function monthLabel(month) {
    return String(month?.nome || month?.mes || month?.name || month?.id || '').trim() || 'M\u00eas';
  }

  function dateToYearMonth(dateValue, fallbackYearMonth) {
    const raw = String(dateValue || '').trim();
    let match = raw.match(/^(\d{4})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}`;
    match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (match) {
      const year = Number(match[3]) > 99 ? Number(match[3]) : 2000 + Number(match[3]);
      return `${year}-${String(Number(match[2])).padStart(2, '0')}`;
    }
    return fallbackYearMonth || '';
  }

  function typeLabel(type) {
    const map = {
      spend: 'Gasto',
      expense: 'Despesa',
      income_fixed: 'Renda fixa',
      income_extra: 'Renda extra',
      project_income: 'Renda extra'
    };
    return map[type] || 'Lan\u00e7amento';
  }

  function getCardName(month, cardId) {
    const cards = Array.isArray(month?.outflowCards) ? month.outflowCards : [];
    const card = cards.find((entry) => String(entry?.id || '') === String(cardId || ''));
    return String(card?.name || card?.nome || '').trim();
  }

  function buildOutflowSearchItem(month, item) {
    const amount = getEffectiveAmount(item);
    if (!(amount > 0) && !String(item?.description || item?.descricao || '').trim()) return null;
    const rawType = String(item?.type || '').toLowerCase();
    const normalizedType = typeof global.normalizeUnifiedOutflowType === 'function'
      ? global.normalizeUnifiedOutflowType(rawType)
      : rawType;
    const type = normalizedType === 'expense' ? 'expense' : 'spend';
    const monthId = String(month?.id || '');
    const monthYM = monthYearMonth(month);
    const outputKind = String(item?.outputKind || '').toLowerCase();
    const outputMethod = String(item?.outputMethod || '').toLowerCase();
    const cardId = outputKind === 'card' ? String(item?.outputRef || '') : '';
    const category = resolveCategory(item, 'OUTROS');
    const date = String(item?.date || item?.data || '');
    return {
      id: String(item?.id || ''),
      source: 'outflow',
      monthId,
      monthLabel: monthLabel(month),
      yearMonth: dateToYearMonth(date, monthYM),
      date,
      description: String(item?.description || item?.descricao || 'Lan\u00e7amento').trim(),
      category,
      tag: String(item?.tag || '').trim(),
      type,
      typeLabel: typeLabel(type),
      amount,
      signedAmount: outputKind === 'card' ? 0 : -amount,
      countInTotals: outputKind !== 'card',
      visualSign: -1,
      amountStr: amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      method: outputKind === 'card' ? 'card' : outputMethod,
      methodLabel: outputKind === 'card' ? (getCardName(month, cardId) || 'Cart\u00e3o') : (outputMethod || 'Sa\u00edda'),
      cardId,
      paid: item?.paid === true || item?.status === 'done',
      recurring: item?.recurringSpend === true || item?.expenseRecurring === true,
      shared: item?.sharedExpense === true || item?.launchShared === true,
      raw: item
    };
  }

  function getCardBillAmount(month, bill) {
    if (typeof global.getUnifiedCardBillEffectiveAmount === 'function') {
      return Math.max(0, Number(global.getUnifiedCardBillEffectiveAmount(month, bill) || 0) || 0);
    }
    const amount = Math.max(0, Number(bill?.amount || 0) || 0);
    const forecast = Math.max(0, Number(bill?.forecastAmount || 0) || 0);
    return bill?.manualAmountSet === false ? forecast : amount;
  }

  function buildCardBillSearchItem(month, bill) {
    const amount = getCardBillAmount(month, bill);
    if (!(amount > 0)) return null;
    const monthId = String(month?.id || '');
    const monthYM = monthYearMonth(month);
    const cardId = String(bill?.cardId || '');
    const cardName = getCardName(month, cardId) || String(bill?.cardName || bill?.name || 'Cartao').trim();
    const date = String(bill?.dueDate || bill?.date || bill?.data || bill?.vencimento || '');
    return {
      id: String(bill?.id || `bill-${monthId}-${cardId}`),
      source: 'card_bill',
      monthId,
      monthLabel: monthLabel(month),
      yearMonth: dateToYearMonth(date, monthYM),
      date,
      description: `Fatura ${cardName}`,
      category: 'CARTAO DE CREDITO',
      tag: '',
      type: 'expense',
      typeLabel: typeLabel('expense'),
      amount,
      signedAmount: -amount,
      countInTotals: true,
      visualSign: -1,
      amountStr: amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      method: 'card',
      methodLabel: cardName,
      cardId,
      paid: bill?.paid === true,
      recurring: false,
      shared: false,
      raw: bill
    };
  }

  function buildIncomeSearchItem(month, item, source) {
    const amount = Math.max(0, Number(item?.valor ?? item?.amount ?? 0) || 0);
    const description = String(item?.fonte || item?.description || item?.descricao || item?.name || '').trim();
    if (!(amount > 0) && !description) return null;
    const monthId = String(month?.id || '');
    const monthYM = monthYearMonth(month);
    const type = source === 'project' || item?.recurringFixed === false ? 'income_extra' : 'income_fixed';
    const date = String(item?.date || item?.data || item?.dataRecebimento || item?.recebimento || '');
    return {
      id: String(item?.id || description || `${source}-${monthId}`),
      source,
      monthId,
      monthLabel: monthLabel(month),
      yearMonth: dateToYearMonth(date, monthYM),
      date,
      description: description || 'Receita',
      category: type === 'income_fixed' ? 'RENDA FIXA' : 'RENDA EXTRA',
      tag: '',
      type,
      typeLabel: typeLabel(type),
      amount,
      signedAmount: amount,
      countInTotals: true,
      visualSign: 1,
      amountStr: amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      method: '',
      methodLabel: 'Entrada',
      cardId: '',
      paid: item?.paid === true,
      recurring: type === 'income_fixed',
      shared: false,
      raw: item
    };
  }

  function buildIndex() {
    const items = [];
    getMonths().forEach((month) => {
      (Array.isArray(month?.outflows) ? month.outflows : []).forEach((item) => {
        const normalized = buildOutflowSearchItem(month, item);
        if (normalized) items.push(normalized);
      });
      (Array.isArray(month?.cardBills) ? month.cardBills : []).forEach((bill) => {
        const normalized = buildCardBillSearchItem(month, bill);
        if (normalized) items.push(normalized);
      });
      (Array.isArray(month?.renda) ? month.renda : []).forEach((item) => {
        const normalized = buildIncomeSearchItem(month, item, 'income');
        if (normalized) items.push(normalized);
      });
      (Array.isArray(month?.projetos) ? month.projetos : []).forEach((item) => {
        const normalized = buildIncomeSearchItem(month, item, 'project');
        if (normalized) items.push(normalized);
      });
    });

    state.items = items;
    state.fuse = typeof global.Fuse === 'function' ? new global.Fuse(items, FUSE_OPTIONS) : null;
    return items;
  }

  function passesFilters(item) {
    if (state.filters.types.size && !state.filters.types.has(item.type)) return false;
    if (state.filters.category.size && !state.filters.category.has(item.category)) return false;
    if (state.filters.card.size && !state.filters.card.has(item.cardId)) return false;
    if (state.filters.tag.size && !state.filters.tag.has(item.tag)) return false;
    if (state.filters.method.size && !state.filters.method.has(item.method)) return false;
    if (state.filters.dateFrom && String(item.yearMonth || '') < state.filters.dateFrom) return false;
    if (state.filters.dateTo && String(item.yearMonth || '') > state.filters.dateTo) return false;
    return true;
  }

  function localScore(item, query) {
    const haystack = normalizeText([
      item.description,
      item.category,
      item.amountStr,
      item.tag,
      item.monthLabel,
      item.methodLabel
    ].join(' '));
    const needle = normalizeText(query);
    if (!needle) return 0;
    if (haystack.includes(needle)) return 0.05;
    const parts = needle.split(/\s+/).filter(Boolean);
    if (parts.length && parts.every((part) => haystack.includes(part))) return 0.12;
    return Infinity;
  }

  function isRelevantMatch(item, query, score) {
    const needle = normalizeText(query);
    if (!needle) return true;
    const haystack = normalizeText([
      item.description,
      item.category,
      item.amountStr,
      item.tag,
      item.monthLabel,
      item.methodLabel
    ].join(' '));
    const terms = needle.split(/\s+/).filter(Boolean);
    if (terms.length && terms.every((term) => haystack.includes(term))) return true;
    if (terms.some((term) => /[a-z]/.test(term) && term.length >= 3)) return false;
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore)) return false;
    return numericScore <= (needle.length <= 3 ? 0.12 : 0.22);
  }

  function search(query) {
    if (!state.items.length || !state.fuse) buildIndex();
    const safeQuery = String(query || '').trim();
    if (!safeQuery) {
      return state.items
        .filter(passesFilters)
        .map((item) => ({ item, score: 0, matches: [] }))
        .sort(sortResults);
    }
    if (state.fuse) {
      return state.fuse.search(safeQuery)
        .filter((entry) => passesFilters(entry.item))
        .filter((entry) => isRelevantMatch(entry.item, safeQuery, entry.score))
        .sort((a, b) => Number(a.score || 0) - Number(b.score || 0));
    }
    return state.items
      .map((item) => ({ item, score: localScore(item, safeQuery), matches: [] }))
      .filter((entry) => entry.score !== Infinity && passesFilters(entry.item))
      .sort((a, b) => Number(a.score || 0) - Number(b.score || 0));
  }

  function sortResults(a, b) {
    const dateA = String(a.item.yearMonth || a.item.monthId || '');
    const dateB = String(b.item.yearMonth || b.item.monthId || '');
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return String(b.item.date || '').localeCompare(String(a.item.date || ''));
  }

  function highlight(value, query) {
    const safe = escapeHtml(value);
    const rawQuery = String(query || '').trim();
    if (!rawQuery || rawQuery.length < 2) return safe;
    const terms = rawQuery.split(/\s+/).filter((term) => term.length >= 2).map(escapeRegExp);
    if (!terms.length) return safe;
    return safe.replace(new RegExp(`(${terms.join('|')})`, 'ig'), '<mark class="us-highlight">$1</mark>');
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getActiveQuery() {
    return String(document.getElementById('usSearchInput')?.value || '').trim();
  }

  function render(results, query) {
    const list = document.getElementById('usResultsList');
    const empty = document.getElementById('usResultsEmpty');
    const footer = document.getElementById('usFooter');
    if (!list || !empty || !footer) return;

    if (!results.length) {
      list.innerHTML = '';
      empty.style.display = '';
      document.getElementById('usEmptyMsg').textContent = query ? 'Nenhum resultado encontrado' : 'Nenhum lan\u00e7amento encontrado';
      footer.style.display = 'none';
      return;
    }

    empty.style.display = 'none';
    const groups = new Map();
    results.forEach((entry) => {
      const label = entry.item.monthLabel || 'Sem m\u00eas';
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(entry);
    });

    list.innerHTML = Array.from(groups.entries()).map(([label, entries]) => `
      <section class="us-month-group">
        <div class="us-month-header">${escapeHtml(label)}</div>
        ${entries.map((entry) => renderResultRow(entry, query)).join('')}
      </section>
    `).join('');

    list.querySelectorAll('[data-us-open]').forEach((button) => {
      button.addEventListener('click', () => openResult(button.getAttribute('data-us-open'), button.getAttribute('data-us-month'), button.getAttribute('data-us-source')));
    });

    updateFooter(results, query);
  }

  function renderResultRow(entry, query) {
    const item = entry.item;
    const positive = Number(item.visualSign || item.signedAmount || 0) >= 0;

    return `
      <button type="button" class="us-result-row" data-us-open="${escapeHtml(item.id)}" data-us-month="${escapeHtml(item.monthId)}" data-us-source="${escapeHtml(item.source)}">
        <span class="us-result-icon">${getCategoryIcon(item.category)}</span>
        <span class="us-result-body">
          <span class="us-result-main">
            <span class="us-result-name">${highlight(item.description, query)}</span>
            <span class="us-result-amount ${positive ? 'positive' : 'negative'}">${positive ? '+' : '-'} ${formatMoney(item.amount)}</span>
          </span>
          <span class="us-result-meta">
            <span class="us-result-cat">${escapeHtml(item.category)}</span>
            <span class="us-result-date">${escapeHtml(item.date || item.yearMonth || item.monthLabel)}</span>
            <span class="us-result-date">${escapeHtml(item.methodLabel || item.typeLabel)}</span>
          </span>
        </span>
      </button>
    `;
  }

  function updateFooter(results, query = '') {
    const footer = document.getElementById('usFooter');
    const count = document.getElementById('usResultCount');
    const expenseWrap = document.getElementById('usTotalExpense');
    const incomeWrap = document.getElementById('usTotalIncome');
    const expenseVal = document.getElementById('usTotalExpenseVal');
    const incomeVal = document.getElementById('usTotalIncomeVal');
    const balanceVal = document.getElementById('usTotalBalanceVal');
    if (!footer || !count || !expenseWrap || !incomeWrap || !expenseVal || !incomeVal || !balanceVal) return;

    const isSearchMode = !!String(query || '').trim();
    const hasDetailFilter = state.filters.types.size > 0
      || state.filters.category.size > 0
      || state.filters.card.size > 0
      || state.filters.tag.size > 0
      || state.filters.method.size > 0;
    const shouldSumVisibleRows = isSearchMode || hasDetailFilter;
    const totals = results.reduce((acc, entry) => {
      if (!shouldSumVisibleRows && entry.item.countInTotals === false) return acc;
      const direction = shouldSumVisibleRows
        ? Number(entry.item.visualSign || entry.item.signedAmount || 0)
        : Number(entry.item.signedAmount || 0);
      if (direction >= 0) acc.income += Number(entry.item.amount || 0);
      else acc.expense += Number(entry.item.amount || 0);
      return acc;
    }, { income: 0, expense: 0 });
    const balance = totals.income - totals.expense;
    count.textContent = `${results.length} resultado${results.length === 1 ? '' : 's'}`;
    expenseWrap.style.display = totals.expense > 0 ? '' : 'none';
    incomeWrap.style.display = totals.income > 0 ? '' : 'none';
    expenseVal.textContent = formatMoney(totals.expense);
    incomeVal.textContent = formatMoney(totals.income);
    balanceVal.textContent = `${balance < 0 ? '-' : ''}${formatMoney(Math.abs(balance))}`;
    footer.style.display = '';
  }

  function run() {
    state.filters.dateFrom = String(document.getElementById('usDateFrom')?.value || '');
    state.filters.dateTo = String(document.getElementById('usDateTo')?.value || '');
    const query = getActiveQuery();
    render(search(query), query);
    updateClearButton();
  }

  function toggleChip(button) {
    if (!button) return;
    const filter = button.getAttribute('data-filter');
    const value = button.getAttribute('data-val') || '';
    if (filter === 'type') {
      if (value === 'all') {
        state.filters.types.clear();
      } else if (state.filters.types.has(value)) {
        state.filters.types.delete(value);
      } else {
        state.filters.types.add(value);
      }
      document.querySelectorAll('#usFilterType .us-chip').forEach((chip) => {
        const chipValue = chip.getAttribute('data-val') || '';
        chip.classList.toggle('active', chipValue === 'all' ? state.filters.types.size === 0 : state.filters.types.has(chipValue));
      });
      run();
      return;
    }
    const set = state.filters[filter];
    if (!(set instanceof Set)) return;
    if (set.has(value)) {
      set.delete(value);
      button.classList.remove('active');
    } else {
      set.add(value);
      button.classList.add('active');
    }
    run();
  }

  function clearFilters() {
    state.filters.types.clear();
    state.filters.category.clear();
    state.filters.card.clear();
    state.filters.tag.clear();
    state.filters.method.clear();
    state.filters.dateFrom = '';
    state.filters.dateTo = '';
    const from = document.getElementById('usDateFrom');
    const to = document.getElementById('usDateTo');
    if (from) from.value = '';
    if (to) to.value = '';
    document.querySelectorAll('.us-chip').forEach((chip) => {
      const isAll = chip.getAttribute('data-filter') === 'type' && chip.getAttribute('data-val') === 'all';
      chip.classList.toggle('active', isAll);
    });
    document.querySelectorAll('.us-check-input').forEach((input) => { input.checked = false; });
    updateDropdownSummary('category');
    updateDropdownSummary('tag');
    run();
  }

  function updateClearButton() {
    const btn = document.getElementById('usClearBtn');
    if (!btn) return;
    const hasFilters = state.filters.types.size > 0
      || state.filters.category.size > 0
      || state.filters.card.size > 0
      || state.filters.tag.size > 0
      || state.filters.method.size > 0
      || !!state.filters.dateFrom
      || !!state.filters.dateTo;
    btn.style.display = hasFilters ? '' : 'none';
  }

  function updateDropdownSummary(filter) {
    const id = filter === 'tag' ? 'usTagSummary' : 'usCategorySummary';
    const label = filter === 'tag' ? 'tags' : 'categorias';
    const summary = document.getElementById(id);
    const set = state.filters[filter];
    if (!summary || !(set instanceof Set)) return;
    summary.textContent = set.size ? `${set.size} ${label}` : `Escolher ${label}`;
  }

  function buildCheckList(containerId, values, filter, renderLabel) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = values.map((value) => {
      const checked = state.filters[filter]?.has(value) ? ' checked' : '';
      return `
        <label class="us-check-row">
          <input class="us-check-input" type="checkbox" data-filter="${escapeHtml(filter)}" value="${escapeHtml(value)}"${checked}>
          <span class="us-check-label">${renderLabel(value)}</span>
        </label>
      `;
    }).join('');
    container.querySelectorAll('.us-check-input').forEach((input) => {
      input.addEventListener('change', () => {
        const set = state.filters[filter];
        if (!(set instanceof Set)) return;
        if (input.checked) set.add(input.value);
        else set.delete(input.value);
        updateDropdownSummary(filter);
        run();
      });
    });
    updateDropdownSummary(filter);
  }

  function buildCategoryChips() {
    const container = document.getElementById('usFilterCategory');
    if (!container) return;
    const categories = new Set();
    state.items.forEach((item) => {
      if (!item.category || item.type.startsWith('income')) return;
      categories.add(item.category);
    });
    buildCheckList(
      'usFilterCategory',
      Array.from(categories).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      'category',
      (category) => `${getCategoryIcon(category)} <span>${escapeHtml(category)}</span>`
    );
  }

  function buildTagChips() {
    const group = document.getElementById('usFilterTagGroup');
    const container = document.getElementById('usFilterTag');
    if (!container) return;
    const tags = new Set();
    state.items.forEach((item) => {
      const tag = String(item.tag || '').trim();
      if (tag) tags.add(tag);
    });
    if (!tags.size) {
      if (group) group.style.display = 'none';
      container.innerHTML = '';
      return;
    }
    if (group) group.style.display = '';
    buildCheckList(
      'usFilterTag',
      Array.from(tags).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      'tag',
      (tag) => `<span>${escapeHtml(tag)}</span>`
    );
  }

  function buildCardChips() {
    const group = document.getElementById('usFilterCardGroup');
    const container = document.getElementById('usFilterCard');
    if (!container) return;
    const cards = new Map();
    state.items.forEach((item) => {
      if (item.cardId) cards.set(item.cardId, item.methodLabel || item.cardId);
    });
    if (!cards.size) {
      if (group) group.style.display = 'none';
      container.innerHTML = '';
      return;
    }
    if (group) group.style.display = '';
    container.innerHTML = Array.from(cards.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([id, name]) => `
      <button type="button" class="us-chip" data-filter="card" data-val="${escapeHtml(id)}">${escapeHtml(name)}</button>
    `).join('');
    container.querySelectorAll('.us-chip').forEach((chip) => chip.addEventListener('click', () => toggleChip(chip)));
  }

  function bindStaticEvents() {
    const input = document.getElementById('usSearchInput');
    if (input && !input.dataset.usBound) {
      input.dataset.usBound = '1';
      let timer = null;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(run, 160);
      });
    }
    document.querySelectorAll('#usFilterType .us-chip, #usFilterMethod .us-chip').forEach((chip) => {
      if (chip.dataset.usBound) return;
      chip.dataset.usBound = '1';
      chip.addEventListener('click', () => toggleChip(chip));
    });
    const modal = document.getElementById('modalUniversalSearch');
    if (modal && !modal.dataset.usBackdropBound) {
      modal.dataset.usBackdropBound = '1';
      modal.addEventListener('mousedown', (event) => {
        if (event.target === modal) close();
      });
    }
  }

  function openResult(id, monthId, source) {
    if (monthId && typeof global.selectMonth === 'function') {
      try { global.selectMonth(monthId); } catch (_) {}
    }
    if (source === 'outflow' && id && typeof global.openUnifiedOutflowModal === 'function') {
      close();
      setTimeout(() => global.openUnifiedOutflowModal(id), 80);
      return;
    }
    if (typeof global.nav === 'function') global.nav('mes');
    close();
  }

  function open() {
    const modal = document.getElementById('modalUniversalSearch');
    if (!modal) return;
    state.isOpen = true;
    buildIndex();
    bindStaticEvents();
    buildCategoryChips();
    buildTagChips();
    buildCardChips();
    modal.style.display = '';
    document.body.classList.add('us-open');
    requestAnimationFrame(() => {
      const input = document.getElementById('usSearchInput');
      input?.focus();
      input?.select();
      run();
    });
  }

  function close() {
    const modal = document.getElementById('modalUniversalSearch');
    if (!modal) return;
    state.isOpen = false;
    modal.style.display = 'none';
    document.body.classList.remove('us-open');
    state.fuse = null;
    state.items = [];
  }

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'k') {
      event.preventDefault();
      state.isOpen ? close() : open();
      return;
    }
    if (event.key === 'Escape' && state.isOpen) close();
  });

  document.addEventListener('DOMContentLoaded', bindStaticEvents);

  global.UniversalSearch = {
    open,
    close,
    run,
    toggleChip,
    clearFilters,
    buildIndex,
    buildCategoryChips,
    buildTagChips,
    buildCardChips
  };
})(window);
