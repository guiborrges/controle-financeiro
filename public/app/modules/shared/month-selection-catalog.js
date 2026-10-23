(function initMonthSelectionCatalog(global) {
  'use strict';

  function getCategoryScalarText(value) {
    if (value == null) return '';
    if (typeof value === 'object') {
      if (typeof value.name === 'string') return value.name.trim();
      if (typeof value.label === 'string') return value.label.trim();
      if (typeof value.title === 'string') return value.title.trim();
      if (typeof value.value === 'string') return value.value.trim();
      if (typeof value.id === 'string') return value.id.trim();
      return '';
    }
    const text = String(value).trim();
    return text === '[object Object]' ? '' : text;
  }

  function stripLegacyCategoryIconPrefix(rawName) {
    const txt = getCategoryScalarText(rawName);
    if (!txt) return '';
    const cleaned = txt.replace(/\s+/g, ' ').trim();
    const match = cleaned.match(/^([a-z][a-z0-9_-]{1,24})\s+(.+)$/i);
    if (!match) return cleaned;
    const iconToken = String(match[1] || '').toLowerCase();
    const tail = String(match[2] || '').trim();
    const knownTokens = new Set([
      'food', 'phone', 'market', 'shopping', 'education', 'card', 'home', 'health', 'fun', 'tag', 'work', 'car', 'bank'
    ]);
    if (!knownTokens.has(iconToken)) return cleaned;
    if (!tail) return cleaned;
    return tail;
  }

  function toVisualCategorySymbol(rawSymbol, categoryName = '', global = {}) {
    const symbol = getCategoryScalarText(rawSymbol);
    const iconEmojiMap = {
      food: '🍽️',
      phone: '📱',
      market: '🛒',
      shopping: '🛍️',
      education: '📘',
      card: '💳',
      home: '🏠',
      health: '🩺',
      fun: '🎉',
      tag: '🏷️',
      work: '💼',
      car: '🚗',
      bank: '🏦',
      invoice: '🧾',
      gift: '🎁'
    };
    if (symbol) {
      if (typeof global.normalizeCategoryIconId === 'function') {
        const iconId = global.normalizeCategoryIconId(symbol);
        if (iconEmojiMap[iconId]) return iconEmojiMap[iconId];
      } else {
        const normalizedRaw = symbol.toLowerCase();
        if (iconEmojiMap[normalizedRaw]) return iconEmojiMap[normalizedRaw];
      }
      if (getEmojiSymbol(symbol)) return symbol;
    }
    if (typeof global.inferCategoryVisual === 'function') {
      const visual = global.inferCategoryVisual(categoryName || '');
      const inferred = String(visual?.icon || '').trim();
      if (iconEmojiMap[inferred]) return iconEmojiMap[inferred];
    }
    return '';
  }

  function getEmojiSymbol(symbol) {
    return /[\u2190-\u2BFF\u{1F000}-\u{1FAFF}]/u.test(symbol) ? symbol : '';
  }

  // Each query receives current references, so edits and restores cannot leave a stale catalog.
  function create(context) {
    const { data, window, getCurrentMonth, resolveCategoryName, getMonthSortValue,
      isNonRealCategoryLabel, getCategoryEmoji } = context;
    function getMonthSortValueSafe(month) {
      if (!month) return Number.NaN;
      if (typeof getMonthSortValue === 'function') return getMonthSortValue(month);
      const nome = String(month?.nome || '').trim().toUpperCase();
      const parts = nome.split(/\s+/);
      const year = parseInt(parts[1], 10);
      const monthMap = {
        JANEIRO: 0, FEVEREIRO: 1, MARCO: 2, 'MARÇO': 2, ABRIL: 3, MAIO: 4, JUNHO: 5,
        JULHO: 6, AGOSTO: 7, SETEMBRO: 8, OUTUBRO: 9, NOVEMBRO: 10, DEZEMBRO: 11
      };
      const idx = monthMap[parts[0]];
      if (!Number.isFinite(year) || idx === undefined) return Number.NaN;
      return (year * 12) + idx;
    }

    function getPreviousMonthForCategoryModel(currentMonth) {
      if (!currentMonth || !Array.isArray(data)) return null;
      const currentSort = getMonthSortValueSafe(currentMonth);
      if (!Number.isFinite(currentSort)) return null;
      let best = null;
      let bestSort = -Infinity;
      data.forEach((month) => {
        if (!month || month === currentMonth) return;
        const sort = getMonthSortValueSafe(month);
        if (!Number.isFinite(sort) || sort >= currentSort || sort <= bestSort) return;
        best = month;
        bestSort = sort;
      });
      return best;
    }

    function getMonthSpentCategorySet(month) {
      const set = new Set();
      if (!month) return set;
      const push = (rawName) => {
        const base = stripLegacyCategoryIconPrefix(rawName);
        const name = resolveCategoryName(base || '');
        if (!name) return;
        if (typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(name)) return;
        set.add(name);
      };
      (month?.outflows || []).forEach((item) => {
        if (item?.countsInPrimaryTotals === false) return;
        const amount = Number(item?.amount || 0);
        if (!(amount > 0)) return;
        push(item?.category || item?.categoria || '');
      });
      (month?.gastosVar || []).forEach((item) => {
        if (item?.incluirNoTotal === false) return;
        const amount = Number(item?.valor || 0);
        if (!(amount > 0)) return;
        push(item?.categoria || '');
      });
      (month?.despesas || []).forEach((item) => {
        const amount = Number(item?.valor || 0);
        if (!(amount > 0)) return;
        push(item?.categoria || '');
      });
      return set;
    }

    function getSelectableCategoryEntriesForMonth(month, { includeFallbackBase = true, ignoreVisibility = false } = {}) {
      const m = month || getCurrentMonth?.() || {};
      const byNorm = new Map();
      const symbolByNorm = new Map();

      const cacheSymbol = (rawName, rawSymbol = '') => {
        const cleanName = stripLegacyCategoryIconPrefix(rawName);
        const name = resolveCategoryName(cleanName || '');
        if (!name) return;
        if (typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(name)) return;
        const key = String(name || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toUpperCase();
        if (!key) return;
        const symbol = getCategoryScalarText(rawSymbol);
        if (!symbol) return;
        if (!symbolByNorm.has(key)) symbolByNorm.set(key, symbol);
      };

      const addEntry = (rawName, rawSymbol = '') => {
        const cleanName = stripLegacyCategoryIconPrefix(rawName);
        const name = resolveCategoryName(cleanName || '');
        if (!name) return;
        if (typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(name)) return;
        const key = String(name || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toUpperCase();
        if (!key) return;
        const symbol = getCategoryScalarText(rawSymbol) || symbolByNorm.get(key) || '';
        if (!byNorm.has(key)) {
          byNorm.set(key, { name, symbol });
          return;
        }
        const existing = byNorm.get(key);
        if (!existing.symbol && symbol) existing.symbol = symbol;
      };

      if (window.BillImportUtils?.getAllCategoriesFromUserData) {
        const globalCategories = window.BillImportUtils.getAllCategoriesFromUserData(data || []).list || [];
        globalCategories.forEach((entry) => {
          cacheSymbol(entry?.name || entry, entry?.emoji || entry?.symbol || entry?.icon || '');
        });
      }

      Object.entries(m?.categorias || {}).forEach(([cat, meta]) => {
        const symbol = meta && typeof meta === 'object'
          ? (meta.symbol || meta.emoji || meta.icon || '')
          : '';
        cacheSymbol(cat, symbol);
      });
      Object.entries(m?._catOrig || {}).forEach(([cat, meta]) => {
        const symbol = meta && typeof meta === 'object'
          ? (meta.symbol || meta.emoji || meta.icon || '')
          : '';
        cacheSymbol(cat, symbol);
      });

      const defaultPresets = Array.isArray(window.SYSTEM_DEFAULT_CATEGORY_PRESETS)
        ? window.SYSTEM_DEFAULT_CATEGORY_PRESETS
        : [];
      defaultPresets.forEach((item) => addEntry(item?.name || '', item?.emoji || item?.icon || ''));

      const prevMonth = getPreviousMonthForCategoryModel(m);
      const prevSpentSet = getMonthSpentCategorySet(prevMonth);
      prevSpentSet.forEach((name) => addEntry(name, ''));

      (m?.outflows || []).forEach(item => addEntry(item?.category || item?.categoria || ''));
      (m?.gastosVar || []).forEach(item => addEntry(item?.categoria || ''));
      (m?.despesas || []).forEach(item => addEntry(item?.categoria || ''));
      (m?.dailyCategorySeeds || []).forEach(cat => addEntry(cat));
      Object.keys(m?.dailyGoals || {}).forEach(cat => addEntry(cat));
      Object.keys(m?.categorias || {}).forEach(cat => addEntry(cat));
      Object.keys(m?._catOrig || {}).forEach(cat => addEntry(cat));
      Object.entries(m?.selectionVisibility?.categories || {}).forEach(([cat, visible]) => {
        if (visible === true) addEntry(cat);
      });

      if (includeFallbackBase && byNorm.size === 0) {
        ['OUTROS', 'ALIMENTACAO', 'TRANSPORTE'].forEach(cat => addEntry(cat));
      }

      const entries = Array.from(byNorm.values());
      const visibility = !ignoreVisibility && m?.selectionVisibility?.categories;
      if (!visibility || typeof visibility !== 'object') return entries;
      return entries.filter(entry => m?.selectionVisibility?.version >= 2
        ? visibility[resolveCategoryName(entry.name)] === true
        : visibility[resolveCategoryName(entry.name)] !== false);
    }

    function getSelectableCategoryNamesForMonth(month, options = {}) {
      return getSelectableCategoryEntriesForMonth(month, options).map((entry) => entry.name);
    }

    function resolveMonthForCategoryOptions(monthOrId, context = window) {
      if (monthOrId && typeof monthOrId === 'object') return monthOrId;
      const monthId = String(monthOrId || '').trim();
      const source = Array.isArray(context?.data)
        ? context.data
        : (typeof data !== 'undefined' && Array.isArray(data) ? data : (Array.isArray(window?.data) ? window.data : []));
      if (monthId && Array.isArray(source)) {
        const found = source.find(month => String(month?.id || '') === monthId);
        if (found) return found;
      }
      if (typeof getCurrentMonth === 'function') return getCurrentMonth();
      return Array.isArray(source) && source.length ? source[source.length - 1] : {};
    }

    function getMonthCategoryOptions(monthOrId, context = window, options = {}) {
      const month = resolveMonthForCategoryOptions(monthOrId, context);
      const entries = getSelectableCategoryEntriesForMonth(month, {
        includeFallbackBase: options.includeFallbackBase !== false,
        ignoreVisibility: options.purpose === 'history'
      });
      return entries.map((entry) => {
        const name = resolveCategoryName(entry?.name || entry?.value || entry || '');
        if (!name) return null;
        const symbol = getCategoryScalarText(entry?.symbol || entry?.emoji || entry?.icon || '')
          || (typeof getCategoryEmoji === 'function' ? getCategoryEmoji(name) : '');
        return {
          id: name,
          value: name,
          name,
          label: name,
          icon: symbol,
          symbol
        };
      }).filter(Boolean);
    }

    function getMonthCategoryNames(monthOrId, context = window, options = {}) {
      return getMonthCategoryOptions(monthOrId, context, options).map(entry => entry.name);
    }

    function getMonthTagOptions(monthOrId, context = window, options = {}) {
      const month = resolveMonthForCategoryOptions(monthOrId, context);
      const source = Array.isArray(context?.data) ? context.data : (typeof data !== 'undefined' && Array.isArray(data) ? data : (Array.isArray(window?.data) ? window.data : []));
      const tags = new Map();
      source.forEach(entry => (entry?.outflows || []).forEach(item => {
        const tag = String(item?.tag || '').trim();
        if (tag) tags.set(tag.normalize('NFC').toLocaleLowerCase('pt-BR'), tag.normalize('NFC'));
      }));
      const visibility = month?.selectionVisibility?.tags;
      const normalizedVisibility = Object.fromEntries(Object.entries(visibility || {}).map(([tag, visible]) => [tag.normalize('NFC').trim().toLocaleLowerCase('pt-BR'), visible]));
      Object.entries(visibility || {}).forEach(([tag, visible]) => {
        const key = tag.normalize('NFC').trim().toLocaleLowerCase('pt-BR');
        if (visible === true && !tags.has(key)) tags.set(key, tag.normalize('NFC').trim());
      });
      return Array.from(tags.values())
        .filter(tag => options.purpose === 'history' || !visibility || (month?.selectionVisibility?.version >= 2
          ? normalizedVisibility[tag.normalize('NFC').toLocaleLowerCase('pt-BR')] === true
          : normalizedVisibility[tag.normalize('NFC').toLocaleLowerCase('pt-BR')] !== false))
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }
    return { getMonthSortValueSafe, getPreviousMonthForCategoryModel, getMonthSpentCategorySet, getSelectableCategoryEntriesForMonth, getSelectableCategoryNamesForMonth, resolveMonthForCategoryOptions, getMonthCategoryOptions, getMonthCategoryNames, getMonthTagOptions };
  }

  const api = { create, getCategoryScalarText, stripLegacyCategoryIconPrefix,
    toVisualCategorySymbol, getEmojiSymbol };
  global.MonthSelectionCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
