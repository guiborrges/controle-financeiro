(function (global) {
  'use strict';

  const reviewState = {
    sourceFileName: '',
    context: null,
    rawPayload: null,
    formatErrors: [],
    items: [],
    sortField: 'date',
    sortDirection: 'asc'
  };

  function escapeHtml(value) {
    const html = global.HtmlUtils?.escapeHtml;
    if (typeof html === 'function') return html(value);
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeText(value) {
    return global.BillImportUtils?.normalizeText
      ? global.BillImportUtils.normalizeText(value)
      : String(value || '').trim();
  }

  function parseDateComparable(value) {
    const normalized = global.BillImportSchema?.normalizeImportDate
      ? global.BillImportSchema.normalizeImportDate(value)
      : '';
    if (!normalized) return 0;
    const [dayRaw, monthRaw, yearRaw] = normalized.split('/').map(part => Number(part || 0));
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return new Date(year, Math.max(0, monthRaw - 1), Math.max(1, dayRaw)).getTime() || 0;
  }

  function getMonthById(monthId) {
    return (global.data || []).find(month => month?.id === monthId) || null;
  }

  function getMonthLabel(monthId) {
    const month = getMonthById(monthId);
    if (month?.nome) return String(month.nome);
    if (!monthId) return 'Mês não identificado';
    const parts = String(monthId).split('_');
    if (parts.length >= 2) return `${String(parts[0]).toUpperCase()} ${parts[1]}`;
    return String(monthId);
  }

  function inferMonthIdFromDate(value) {
    if (!global.BillImportSchema?.getMonthIdFromDate) return '';
    return global.BillImportSchema.getMonthIdFromDate(value) || '';
  }

  function getContextCardsList() {
    const cardsNode = reviewState.context?.cards;
    if (!cardsNode && global.BillImportUtils?.getAllCardsFromUserData) {
      const runtime = global.BillImportUtils.getAllCardsFromUserData(global.data || []);
      return Array.isArray(runtime?.list)
        ? runtime.list.map(card => ({
            id: String(card?.id || '').trim(),
            name: String(card?.name || card?.institution || '').trim(),
            institution: String(card?.institution || '').trim()
          })).filter(card => card.id && card.name)
        : [];
    }
    if (Array.isArray(cardsNode)) {
      return cardsNode.map(card => ({
        id: String(card?.id || '').trim(),
        name: String(card?.name || card?.institution || '').trim(),
        institution: String(card?.institution || '').trim()
      })).filter(card => card.id && card.name);
    }
    if (Array.isArray(cardsNode?.list)) {
      return cardsNode.list.map(card => ({
        id: String(card?.id || '').trim(),
        name: String(card?.name || card?.institution || '').trim(),
        institution: String(card?.institution || '').trim()
      })).filter(card => card.id && card.name);
    }
    return [];
  }

  function getContextTagsList() {
    const tagsNode = reviewState.context?.tags;
    if (!tagsNode && global.BillImportUtils?.getAllTagsFromUserData) {
      return global.BillImportUtils.getAllTagsFromUserData(global.data || [])
        .map(tag => String(tag || '').trim())
        .filter(Boolean);
    }
    if (Array.isArray(tagsNode)) return tagsNode.map(tag => String(tag || '').trim()).filter(Boolean);
    if (Array.isArray(reviewState.context?.tags_reference_only)) {
      return reviewState.context.tags_reference_only.map(tag => String(tag || '').trim()).filter(Boolean);
    }
    return [];
  }

  function normalizeMonthIdCandidate(value, dateFallback = '') {
    const raw = normalizeText(value);
    const fromReference = global.BillImportSchema?.parseMonthReferenceToId
      ? global.BillImportSchema.parseMonthReferenceToId(raw)
      : '';
    const candidate = fromReference || raw;
    if (candidate && getMonthById(candidate)) return candidate;
    if (candidate && /_20\d{2}$/.test(candidate)) return candidate;
    const fromDate = inferMonthIdFromDate(dateFallback || '');
    if (fromDate) return fromDate;
    const currentMonthId = String(global.currentMonthId || '').trim();
    if (currentMonthId) return currentMonthId;
    return candidate || '';
  }

  function normalizeMonthComparable(value) {
    return normalizeText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }

  function findMonthByComparableId(rawId) {
    const comparable = normalizeMonthComparable(rawId);
    if (!comparable) return null;
    const list = Array.isArray(global.data) ? global.data : [];
    return list.find(month => normalizeMonthComparable(month?.id || '') === comparable) || null;
  }

  function resolveCardIdByName(cardName) {
    const cards = getContextCardsList();
    const comparableFn = global.BillImportSchema?.normalizeComparableText || ((value) => String(value || '').toLowerCase());
    const wanted = comparableFn(cardName || '');
    if (!wanted) return '';
    const found = cards.find(card => comparableFn(card?.name || '') === wanted
      || comparableFn(card?.institution || '') === wanted
      || comparableFn(card?.id || '') === wanted
      || comparableFn(String(card?.name || '').split(/\s+/)[0] || '') === wanted);
    if (found?.id) return found.id;
    const byContains = cards.find(card => {
      const normalizedName = comparableFn(card?.name || '');
      if (!normalizedName) return false;
      return wanted.includes(normalizedName) || normalizedName.includes(wanted);
    });
    if (byContains?.id) return byContains.id;
    return found?.id || '';
  }

  function getCardNameById(cardId) {
    if (!cardId) return '';
    const card = getContextCardsList().find(entry => entry.id === cardId);
    return card?.name || '';
  }

  function isSystemGeneratedReviewWarning(text) {
    const normalized = String(text || '').toLowerCase();
    if (!normalized) return false;
    return normalized.includes('categoria ausente')
      || normalized.includes('item parece total de fatura')
      || normalized.includes('ano não detectado')
      || normalized.includes('ano nao detectado')
      || normalized.includes('data interpretada no padrão americano')
      || normalized.includes('data interpretada no padrao americano')
      || normalized.includes('ano ajustado para')
      || normalized.includes('possível lançamento duplicado')
      || normalized.includes('possivel lancamento duplicado')
      || normalized.includes('tag enviada pela ia foi descartada')
      || normalized.includes('mês ainda não existe no sistema')
      || normalized.includes('mes ainda nao existe no sistema');
  }

  function recalculateReviewItemStatus(item) {
    const warnings = [];
    const errors = [];
    const normalizedDate = global.BillImportSchema?.normalizeImportDate(item.date) || '';
    item.monthId = normalizeMonthIdCandidate(item.monthId, normalizedDate || item.date || '');
    if (!item.cardId && item.cardName) {
      item.cardId = resolveCardIdByName(item.cardName);
    }
    if (item.cardId && !getCardNameById(item.cardId)) {
      const resolvedFromIdText = resolveCardIdByName(item.cardId);
      if (resolvedFromIdText) item.cardId = resolvedFromIdText;
    }
    const amount = Number(item.amount || 0);
    const description = normalizeText(item.description);
    const cardName = getCardNameById(item.cardId);
    const category = normalizeText(item.category);
    const comparableFn = global.BillImportSchema?.normalizeComparableText || ((value) => String(value || '').toLowerCase());
    const categoryAllowed = !!reviewState.context?.categoryIndex?.byNormalized?.get(comparableFn(category));

    if (!normalizedDate) errors.push('Data inválida.');
    if (!description) errors.push('Descrição ausente.');
    if (!Number.isFinite(amount) || amount <= 0) errors.push('Valor inválido.');
    if (!item.monthId) errors.push('Mês não identificado.');
    if (!item.cardId || !cardName) errors.push('Cartão inválido.');
    if (!category) {
      warnings.push('Categoria vazia.');
      item.needsReview = true;
    } else if (!categoryAllowed) {
      errors.push('Categoria fora da lista existente.');
    }
    if (item.tag) warnings.push('Tag definida manualmente na revisão.');

    item.date = normalizedDate || item.date;
    item.description = description;
    const aiWarnings = Array.isArray(item.aiWarnings)
      ? item.aiWarnings
      : (Array.isArray(item.warnings) ? item.warnings.filter(w => !isSystemGeneratedReviewWarning(w)) : []);
    item.warnings = Array.from(new Set([...(aiWarnings || []), ...warnings])).filter(Boolean);
    item.errors = errors;
    item.status = errors.length
      ? 'error'
      : (item.needsReview ? 'needs_review' : (item.warnings.length ? 'warning' : 'valid'));
  }

  function recalculateAllStatuses() {
    reviewState.items.forEach(item => recalculateReviewItemStatus(item));
  }

  function getReviewSummary() {
    return reviewState.items.reduce((acc, item) => {
      if (!item.include) return acc;
      acc.total += 1;
      acc[item.status] += 1;
      acc.amount += Number(item.amount || 0);
      return acc;
    }, { total: 0, valid: 0, warning: 0, needs_review: 0, error: 0, amount: 0 });
  }

  function sortItems(items) {
    const field = String(reviewState.sortField || 'date');
    const dir = reviewState.sortDirection === 'desc' ? -1 : 1;
    return (items || []).slice().sort((a, b) => {
      if (field === 'description') {
        return String(a?.description || '').localeCompare(String(b?.description || ''), 'pt-BR') * dir;
      }
      if (field === 'category') {
        return String(a?.category || '').localeCompare(String(b?.category || ''), 'pt-BR') * dir;
      }
      return (parseDateComparable(a?.date) - parseDateComparable(b?.date)) * dir;
    });
  }

  function getGroupedItems() {
    const map = new Map();
    reviewState.items.forEach(item => {
      const key = `${item.monthId || 'sem_mes'}`;
      if (!map.has(key)) {
        map.set(key, {
          monthId: item.monthId,
          items: []
        });
      }
      map.get(key).items.push(item);
    });
    return Array.from(map.values())
      .sort((a, b) => {
        return String(a.monthId || '').localeCompare(String(b.monthId || ''));
      })
      .map(group => ({ ...group, items: sortItems(group.items) }));
  }

  function buildCardOptions(selectedCardId) {
    const cards = getContextCardsList();
    return cards
      .map(card => `<option value="${escapeHtml(card.id)}" ${card.id === selectedCardId ? 'selected' : ''}>${escapeHtml(card.name)}</option>`)
      .join('');
  }

  function buildCategoryOptions(item) {
    const categories = reviewState.context?.categories?.list || [];
    const selected = normalizeText(item.category);
    const suggested = Array.isArray(item.suggestedCategories) ? item.suggestedCategories : [];
    const comparableFn = global.BillImportSchema?.normalizeComparableText || ((value) => String(value || '').toLowerCase());
    const selectedComparable = comparableFn(selected);
    const topSuggested = suggested.filter(Boolean).slice(0, 3);
    const base = ['<option value="">Selecionar categoria</option>'];
    topSuggested.forEach(category => {
      const comparable = comparableFn(category);
      base.push(`<option value="${escapeHtml(category)}" ${comparable === selectedComparable ? 'selected' : ''}>Sugestão • ${escapeHtml(category)}</option>`);
    });
    categories.forEach(category => {
      const comparable = comparableFn(category.name);
      base.push(`<option value="${escapeHtml(category.name)}" ${comparable === selectedComparable ? 'selected' : ''}>${escapeHtml(category.emoji ? `${category.emoji} ${category.name}` : category.name)}</option>`);
    });
    return base.join('');
  }

  function buildTagOptions(selectedTag = '') {
    const tags = getContextTagsList();
    const normalizedSelected = normalizeText(selectedTag);
    const options = ['<option value="">Sem tag</option>'];
    tags.forEach(tag => {
      const safeTag = String(tag || '').trim();
      if (!safeTag) return;
      options.push(`<option value="${escapeHtml(safeTag)}" ${safeTag === normalizedSelected ? 'selected' : ''}>${escapeHtml(safeTag)}</option>`);
    });
    if (normalizedSelected && !tags.includes(normalizedSelected)) {
      options.push(`<option value="${escapeHtml(normalizedSelected)}" selected>${escapeHtml(normalizedSelected)}</option>`);
    }
    return options.join('');
  }

  function getSortLabel(field, label) {
    if (reviewState.sortField !== field) return label;
    return `${label} ${reviewState.sortDirection === 'asc' ? '▲' : '▼'}`;
  }

  function renderReviewRows() {
    const grouped = getGroupedItems();
    if (!grouped.length) return '<div class="text-muted" style="padding:10px 0">Nenhum item para revisar.</div>';

    return grouped.map(group => {
      const rows = group.items.map(item => {
        const statusClass = `bill-import-status is-${item.status}`;
        const warnings = (item.warnings || []).map(value => `<div>• ${escapeHtml(value)}</div>`).join('');
        const errors = (item.errors || []).map(value => `<div>• ${escapeHtml(value)}</div>`).join('');
        const note = `${errors}${warnings}`;
        return `
          <tr class="${item.include ? '' : 'is-disabled'}">
            <td><input type="checkbox" ${item.include ? 'checked' : ''} onchange="BillImportReview.toggleInclude('${item.id}', this.checked)"></td>
            <td><input class="bill-import-input" value="${escapeHtml(item.date)}" oninput="BillImportReview.updateField('${item.id}','date', this.value)"></td>
            <td><input class="bill-import-input" value="${escapeHtml(item.description)}" oninput="BillImportReview.updateField('${item.id}','description', this.value)"></td>
            <td><input class="bill-import-input" type="number" min="0" step="0.01" value="${Number(item.amount || 0)}" oninput="BillImportReview.updateField('${item.id}','amount', this.value)"></td>
            <td>
              <select class="bill-import-input" onchange="BillImportReview.updateField('${item.id}','cardId', this.value)">
                <option value="">Selecionar cartão</option>
                ${buildCardOptions(item.cardId)}
              </select>
            </td>
            <td>
              <select class="bill-import-input" onchange="BillImportReview.updateField('${item.id}','category', this.value)">
                ${buildCategoryOptions(item)}
              </select>
            </td>
            <td>
              <select class="bill-import-input" onchange="BillImportReview.updateField('${item.id}','tag', this.value)">
                ${buildTagOptions(item.tag || '')}
              </select>
            </td>
            <td>
              <div class="${statusClass}">${item.status.replace('_', ' ')}</div>
              ${note ? `<div class="bill-import-note">${note}</div>` : ''}
            </td>
            <td><button class="btn-icon" onclick="BillImportReview.removeItem('${item.id}')">✕</button></td>
          </tr>
        `;
      }).join('');

      return `
        <div class="bill-import-group">
          <div class="bill-import-group-head">
            <div><strong>${escapeHtml(getMonthLabel(group.monthId))}</strong></div>
            <div class="text-muted">${group.items.length} lançamento(s)</div>
          </div>
          <div class="bill-import-table-wrap">
            <table class="fin-table bill-import-table">
              <thead>
                <tr>
                  <th>Importar</th>
                  <th class="sortable" onclick="BillImportReview.sortBy('date')">${escapeHtml(getSortLabel('date', 'Data'))}</th>
                  <th class="sortable" onclick="BillImportReview.sortBy('description')">${escapeHtml(getSortLabel('description', 'Descrição'))}</th>
                  <th>Valor</th>
                  <th>Cartão</th>
                  <th class="sortable" onclick="BillImportReview.sortBy('category')">${escapeHtml(getSortLabel('category', 'Categoria'))}</th>
                  <th>Tag</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderReviewSummary() {
    const summaryNode = document.getElementById('billImportReviewSummary');
    if (!summaryNode) return;
    const summary = getReviewSummary();
    const canImport = summary.total > 0 && summary.error === 0 && summary.needs_review === 0;
    summaryNode.innerHTML = `
      <div class="bill-import-summary-grid">
        <div>Valor total da fatura: <strong>${escapeHtml(global.fmt ? global.fmt(summary.amount) : String(summary.amount))}</strong></div>
      </div>
      ${summary.error > 0 || summary.needs_review > 0
        ? '<div class="text-muted" style="margin-top:8px">A importação só é liberada quando não houver itens com erro ou needs_review.</div>'
        : ''}
    `;
    const importButton = document.getElementById('billImportApplyBtn');
    if (importButton) importButton.disabled = !canImport;
  }

  function renderReviewErrors() {
    const node = document.getElementById('billImportReviewErrors');
    if (!node) return;
    if (!reviewState.formatErrors.length) {
      node.innerHTML = '';
      node.style.display = 'none';
      return;
    }
    node.style.display = '';
    node.innerHTML = `
      <div class="bill-import-error-box">
        <strong>Erros de formato</strong>
        ${reviewState.formatErrors.map(item => `<div>• ${escapeHtml(item)}</div>`).join('')}
      </div>
    `;
  }

  function renderReview() {
    const container = document.getElementById('billImportReviewList');
    if (!container) return;
    container.innerHTML = renderReviewRows();
    renderReviewSummary();
    renderReviewErrors();
  }

  function ensureCardInMonth(month, cardId, cardName = '') {
    const normalizedId = normalizeText(cardId);
    const normalizedName = normalizeText(cardName);
    const normalizedCardLabel = normalizedName || normalizedId;
    const existingCards = Array.isArray(month?.outflowCards) ? month.outflowCards : [];
    const existingById = normalizedId ? existingCards.find(card => normalizeText(card?.id) === normalizedId) : null;
    if (existingById?.id) return existingById.id;
    const existingByName = normalizedCardLabel
      ? existingCards.find(card => normalizeText(card?.name).toLowerCase() === normalizedCardLabel.toLowerCase())
      : null;
    if (existingByName?.id) return existingByName.id;
    const templateList = Array.isArray(reviewState.context?.cards?.list) ? reviewState.context.cards.list : [];
    const template = templateList.find(card => normalizeText(card?.id) === normalizedId)
      || (normalizedCardLabel ? templateList.find(card => normalizeText(card?.name).toLowerCase() === normalizedCardLabel.toLowerCase()) : null);
    if (!template && !normalizedCardLabel) return '';
    if (!template && normalizedCardLabel) {
      const fallbackCard = {
        id: normalizedId || `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: normalizedCardLabel,
        institution: normalizedCardLabel,
        visualId: '',
        closingDay: 1,
        paymentDay: 10,
        description: ''
      };
      month.outflowCards = existingCards;
      month.outflowCards.push(fallbackCard);
      return fallbackCard.id;
    }
    if (!template) return '';
    const existingByTemplateName = existingCards.find(card => normalizeText(card?.name).toLowerCase() === normalizeText(template?.name).toLowerCase());
    if (existingByTemplateName?.id) return existingByTemplateName.id;
    const newCard = {
      id: normalizedId || template.id || `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: normalizeText(template.name) || normalizedName,
      institution: template.institution || normalizedName || '',
      visualId: template.visualId || '',
      closingDay: Number(template.closingDay || 1),
      paymentDay: Number(template.paymentDay || 10),
      description: template.description || ''
    };
    month.outflowCards = existingCards;
    month.outflowCards.push(newCard);
    return newCard.id;
  }

  function resolveMonthForImport(item) {
    const monthSlugByNumber = {
      1: 'janeiro',
      2: 'fevereiro',
      3: 'marco',
      4: 'abril',
      5: 'maio',
      6: 'junho',
      7: 'julho',
      8: 'agosto',
      9: 'setembro',
      10: 'outubro',
      11: 'novembro',
      12: 'dezembro'
    };
    const monthNameByNumber = {
      1: 'JANEIRO',
      2: 'FEVEREIRO',
      3: 'MARÇO',
      4: 'ABRIL',
      5: 'MAIO',
      6: 'JUNHO',
      7: 'JULHO',
      8: 'AGOSTO',
      9: 'SETEMBRO',
      10: 'OUTUBRO',
      11: 'NOVEMBRO',
      12: 'DEZEMBRO'
    };
    const normalizeIdToken = (value) => normalizeText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]+/g, '')
      .trim();
    const findMonthByMonthYear = (monthNumber, year) => {
      if (!monthNumber || !year) return null;
      const wantedSlug = monthSlugByNumber[Number(monthNumber)] || '';
      if (!wantedSlug) return null;
      const list = Array.isArray(global.data) ? global.data : [];
      const found = list.find(month => {
        const id = normalizeIdToken(month?.id || '');
        if (!id) return false;
        const parts = id.split('_');
        if (parts.length < 2) return false;
        const slug = parts[0];
        const y = Number(parts[1] || 0);
        return slug === wantedSlug && y === Number(year);
      });
      return found || null;
    };
    const ensureMonthByMonthYear = (monthNumber, year) => {
      if (!monthNumber || !year || typeof global.ensureMonthExists !== 'function') return null;
      const monthName = monthNameByNumber[Number(monthNumber)] || '';
      if (!monthName) return null;
      try {
        return global.ensureMonthExists(monthName, Number(year));
      } catch {
        return null;
      }
    };
    const normalizedDate = global.BillImportSchema?.normalizeImportDate
      ? global.BillImportSchema.normalizeImportDate(item?.date)
      : normalizeText(item?.date);
    const dateParts = String(normalizedDate || '').split('/');
    if (dateParts.length === 3) {
      const monthNumber = Number(dateParts[1] || 0);
      const yearTwoDigits = Number(dateParts[2] || 0);
      const year = yearTwoDigits > 0 ? (yearTwoDigits < 100 ? (2000 + yearTwoDigits) : yearTwoDigits) : 0;
      const byDate = findMonthByMonthYear(monthNumber, year);
      if (byDate) return byDate;
      const ensuredByDate = ensureMonthByMonthYear(monthNumber, year);
      if (ensuredByDate) return ensuredByDate;
    }

    const candidates = [];
    const primary = normalizeMonthIdCandidate(item?.monthId || inferMonthIdFromDate(item?.date), item?.date || '');
    if (primary) candidates.push(primary);
    const fromDate = inferMonthIdFromDate(item?.date);
    if (fromDate) candidates.push(fromDate);
    const currentMonthId = normalizeText(global.currentMonthId || '');
    if (currentMonthId) candidates.push(currentMonthId);
    for (let i = 0; i < candidates.length; i += 1) {
      const rawCandidate = normalizeText(candidates[i]);
      if (!rawCandidate) continue;
      const direct = getMonthById(rawCandidate);
      if (direct) return direct;
      const comparableMatch = findMonthByComparableId(rawCandidate);
      if (comparableMatch) return comparableMatch;
      const normalizedCandidate = rawCandidate
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const parts = normalizedCandidate.split('_');
      const slug = normalizeText(parts[0]);
      const year = Number(parts[1] || 0);
      const monthName = Object.keys(global.MONTH_INDEX || {}).find(key => {
        const normalizedKey = String(key || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return normalizedKey === slug;
      }) || null;
      if (monthName && year && typeof global.ensureMonthExists === 'function') {
        const ensured = global.ensureMonthExists(monthName, year);
        if (ensured) return ensured;
      }
      const ensuredByIdParts = ensureMonthByMonthYear(
        Object.entries(monthSlugByNumber).find(([, slugValue]) => slugValue === slug)?.[0],
        year
      );
      if (ensuredByIdParts) return ensuredByIdParts;
    }
    if (typeof global.getCurrentMonth === 'function') {
      const fallbackMonth = global.getCurrentMonth();
      if (fallbackMonth && fallbackMonth.id) return fallbackMonth;
    }
    return null;
  }

  function createOutflowFromImport(item, cardId) {
    const base = {
      id: `bill_import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      description: item.description,
      type: 'spend',
      category: item.category,
      amount: Number(item.amount || 0),
      outputKind: 'card',
      outputRef: cardId,
      outputMethod: '',
      date: item.date,
      tag: normalizeText(item.tag || ''),
      status: 'done',
      paid: false,
      countsInPrimaryTotals: false,
      recurringSpend: false,
      recurringGroupId: '',
      installmentsGroupId: '',
      installmentsTotal: 1,
      installmentIndex: 1,
      createdAt: new Date().toISOString()
    };
    if (typeof global.normalizeUnifiedOutflowItem === 'function') {
      return global.normalizeUnifiedOutflowItem(base, 0);
    }
    return base;
  }

  function normalizeDateForKey(value) {
    return global.BillImportSchema?.normalizeImportDate
      ? global.BillImportSchema.normalizeImportDate(value)
      : normalizeText(value);
  }

  function normalizeDescriptionForKey(value) {
    return normalizeText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildImportDedupKey(cardId, date, amount, description) {
    const safeCard = normalizeText(cardId || '').toLowerCase();
    const safeDate = normalizeDateForKey(date);
    const safeAmount = Number(Number(amount || 0).toFixed(2));
    const safeDesc = normalizeDescriptionForKey(description);
    return [safeCard, safeDate, safeAmount, safeDesc].join('|');
  }

  function monthHasOutflowKey(month, dedupKey) {
    const list = Array.isArray(month?.outflows) ? month.outflows : [];
    return list.some(outflow => {
      if (normalizeText(outflow?.outputKind) !== 'card') return false;
      const key = buildImportDedupKey(
        outflow?.outputRef,
        outflow?.date,
        outflow?.amount,
        outflow?.description
      );
      return key === dedupKey;
    });
  }

  function applyImport() {
    recalculateAllStatuses();
    const selected = reviewState.items.filter(item => item.include);
    const blocking = selected.filter(item => item.status === 'error' || item.status === 'needs_review');
    if (blocking.length) {
      if (typeof global.showStatusMessage === 'function') {
        global.showStatusMessage('Corrija os itens com erro/revisão antes de importar.', 'error');
      } else {
        alert('Corrija os itens com erro/revisão antes de importar.');
      }
      return;
    }
    if (!selected.length) {
      if (typeof global.showStatusMessage === 'function') {
        global.showStatusMessage('Nenhum item selecionado para importar.', 'warn');
      }
      return;
    }
    if (typeof global.recordHistoryState === 'function') global.recordHistoryState();
    const touchedMonths = new Set();
    const importedByMonth = new Map();
    const seenImportKeys = new Set();
    let importedCount = 0;
    const droppedReason = { month: 0, card: 0, duplicate: 0 };

    selected.forEach(item => {
      const month = resolveMonthForImport(item);
      if (!month) {
        droppedReason.month += 1;
        return;
      }
      if (typeof global.ensureUnifiedOutflowPilotMonth === 'function') global.ensureUnifiedOutflowPilotMonth(month);
      const resolvedCardName = normalizeText(item.cardName || getCardNameById(item.cardId) || item.cardId);
      const cardId = ensureCardInMonth(month, item.cardId, resolvedCardName);
      if (!cardId) {
        droppedReason.card += 1;
        return;
      }
      const monthDedupKey = buildImportDedupKey(cardId, item.date, item.amount, item.description);
      const fullDedupKey = `${month.id}|${monthDedupKey}`;
      if (!monthDedupKey || seenImportKeys.has(fullDedupKey) || monthHasOutflowKey(month, monthDedupKey)) {
        droppedReason.duplicate += 1;
        return;
      }
      seenImportKeys.add(fullDedupKey);
      const outflow = createOutflowFromImport(item, cardId);
      month.outflows = Array.isArray(month.outflows) ? month.outflows : [];
      month.outflows.push(outflow);
      importedCount += 1;
      touchedMonths.add(month.id);
      importedByMonth.set(month.id, (importedByMonth.get(month.id) || 0) + 1);
    });

    if (importedCount <= 0) {
      const diagnostics = [];
      if (droppedReason.month) diagnostics.push(`${droppedReason.month} sem mes`);
      if (droppedReason.card) diagnostics.push(`${droppedReason.card} sem cartao`);
      if (droppedReason.duplicate) diagnostics.push(`${droppedReason.duplicate} duplicado(s)`);
      const suffix = diagnostics.length ? ` (${diagnostics.join(', ')})` : '';
      if (typeof global.showAppStatus === 'function') {
        global.showAppStatus('Nenhum gasto foi adicionado. Revise mês e cartão antes de importar.', 'Importação por fatura', 'error');
      } else if (typeof global.showStatusMessage === 'function') {
        global.showStatusMessage('Nenhum gasto foi adicionado. Revise mês e cartão antes de importar.', 'error');
      } else {
        alert('Nenhum gasto foi adicionado. Revise mês e cartão antes de importar.');
      }
      return;
    }

    touchedMonths.forEach(monthId => {
      const month = getMonthById(monthId);
      if (!month) return;
      if (typeof global.ensureUnifiedOutflowPilotMonth === 'function') global.ensureUnifiedOutflowPilotMonth(month);
      if (typeof global.syncUnifiedOutflowLegacyData === 'function') global.syncUnifiedOutflowLegacyData(month);
      if (!Array.isArray(month.billImportHistory)) month.billImportHistory = [];
      month.billImportHistory.push({
        id: `bill_import_log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        importedAt: new Date().toISOString(),
        fileName: reviewState.sourceFileName || 'finance_import_v1.json',
        count: importedByMonth.get(month.id) || 0
      });
      if (month.billImportHistory.length > 30) month.billImportHistory = month.billImportHistory.slice(-30);
    });

    if (typeof global.save === 'function') global.save(true);
    if (typeof global.renderMes === 'function') {
      global.preserveCurrentScroll ? global.preserveCurrentScroll(() => global.renderMes()) : global.renderMes();
    }
    if (typeof global.closeModal === 'function') global.closeModal('modalBillImportReview');
    if (typeof global.closeBillImportModal === 'function') global.closeBillImportModal();
    if (typeof global.showAppStatus === 'function') {
      global.showAppStatus('Gastos adicionados ao sistema.', 'Importação por fatura', 'ok');
      return;
    }
    if (typeof global.showStatusMessage === 'function') {
      global.showStatusMessage(`${selected.length} lançamento(s) importado(s) com sucesso.`, 'ok');
    }
  }

  const api = {
    setReviewData(payload) {
      reviewState.sourceFileName = payload?.sourceFileName || '';
      reviewState.context = payload?.context || null;
      reviewState.rawPayload = payload?.rawPayload || null;
      reviewState.formatErrors = Array.isArray(payload?.formatErrors) ? payload.formatErrors.slice() : [];
      reviewState.items = Array.isArray(payload?.items)
        ? payload.items.map(item => {
            const next = { ...item };
            next.monthId = normalizeMonthIdCandidate(next.monthId, next.date || '');
            if (!next.cardId && next.cardName) next.cardId = resolveCardIdByName(next.cardName);
            return next;
          })
        : [];
      reviewState.sortField = 'date';
      reviewState.sortDirection = 'asc';
      recalculateAllStatuses();
      renderReview();
      if (typeof global.openModal === 'function') global.openModal('modalBillImportReview');
    },
    updateField(itemId, field, value) {
      const item = reviewState.items.find(entry => entry.id === itemId);
      if (!item) return;
      if (field === 'amount') {
        const parsed = Number(value);
        item.amount = Number.isFinite(parsed) ? parsed : 0;
      } else if (field === 'cardId') {
        item.cardId = normalizeText(value);
        item.cardName = getCardNameById(item.cardId);
      } else if (field === 'category') {
        item.category = normalizeText(value);
        if (item.category) item.needsReview = false;
      } else if (field === 'date') {
        item.date = normalizeText(value);
        const inferredMonthId = inferMonthIdFromDate(item.date);
        item.monthId = normalizeMonthIdCandidate(inferredMonthId || item.monthId, item.date || '');
      } else if (field === 'description') {
        item.description = normalizeText(value);
      } else if (field === 'monthId') {
        item.monthId = normalizeMonthIdCandidate(value, item.date || '');
      } else if (field === 'tag') {
        item.tag = normalizeText(value);
      }
      recalculateReviewItemStatus(item);
      renderReview();
    },
    toggleInclude(itemId, checked) {
      const item = reviewState.items.find(entry => entry.id === itemId);
      if (!item) return;
      item.include = checked === true;
      renderReview();
    },
    removeItem(itemId) {
      reviewState.items = reviewState.items.filter(item => item.id !== itemId);
      renderReview();
    },
    sortBy(field) {
      const safe = ['date', 'description', 'category'].includes(String(field || '')) ? String(field) : 'date';
      if (reviewState.sortField === safe) {
        reviewState.sortDirection = reviewState.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        reviewState.sortField = safe;
        reviewState.sortDirection = 'asc';
      }
      renderReview();
    },
    applyImport,
    closeReview() {
      if (typeof global.closeModal === 'function') global.closeModal('modalBillImportReview');
    }
  };

  global.BillImportReview = api;
})(typeof window !== 'undefined' ? window : globalThis);
