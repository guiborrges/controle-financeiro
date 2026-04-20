
// storage.js

function normalizeExpenseName(name) {
  return (name || '').trim().toUpperCase();
}

function normalizeIncomeName(name) {
  return (name || '').trim().toUpperCase();
}

function resolveExpenseName(name) {
  let currentKey = normalizeExpenseName(name);
  let currentValue = (name || '').trim();
  const visited = new Set();
  while (expenseNameRenameMap[currentKey] && !visited.has(currentKey)) {
    visited.add(currentKey);
    currentValue = expenseNameRenameMap[currentKey];
    currentKey = normalizeExpenseName(currentValue);
  }
  return currentValue || (name || '').trim();
}

function resolveIncomeName(name) {
  let currentKey = normalizeIncomeName(name);
  let currentValue = (name || '').trim();
  const visited = new Set();
  while (incomeNameRenameMap[currentKey] && !visited.has(currentKey)) {
    visited.add(currentKey);
    currentValue = incomeNameRenameMap[currentKey];
    currentKey = normalizeIncomeName(currentValue);
  }
  return currentValue || (name || '').trim();
}

function normalizeCategoryComparable(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCategoryAlphaComparable(value) {
  return normalizeCategoryComparable(value).replace(/[^A-Z0-9]/g, '');
}

function normalizeCategorySingularComparable(value) {
  const normalized = normalizeCategoryAlphaComparable(value);
  return normalized.endsWith('S') ? normalized.slice(0, -1) : normalized;
}

let categoryCandidatesCache = null;
let categoryCandidatesCacheVersion = 0;
let categoryResolutionCache = new Map();

function invalidateCategoryNormalizationCache() {
  categoryCandidatesCache = null;
  categoryCandidatesCacheVersion += 1;
  categoryResolutionCache = new Map();
}

const NON_REAL_CATEGORY_LABELS = new Set([
  'DINHEIRO',
  'PIX',
  'DEBITO',
  'DÉBITO',
  'BOLETO',
  'CARTAO',
  'CARTÃO',
  'CARTAO DE CREDITO',
  'CARTÃO DE CRÉDITO',
  'CARTAO MENSAL',
  'CARTÃO MENSAL',
  'CONTA',
  'CONTAS'
]);

function isNonRealCategoryLabel(name) {
  const normalized = normalizeCategoryComparable(name);
  return NON_REAL_CATEGORY_LABELS.has(normalized);
}

function getAllUserCategoryCandidates() {
  if (Array.isArray(categoryCandidatesCache)) return categoryCandidatesCache;
  const candidates = new Set();
  const push = value => {
    const txt = String(value || '').trim();
    if (!txt) return;
    const normalized = normalizeCategoryComparable(txt);
    if (!normalized || isNonRealCategoryLabel(normalized)) return;
    candidates.add(normalized);
  };
  Object.keys(categoryRenameMap || {}).forEach(push);
  Object.values(categoryRenameMap || {}).forEach(push);
  (data || []).forEach(month => {
    (month?.outflows || []).forEach(item => push(item?.category));
    (month?.gastosVar || []).forEach(item => push(item?.categoria));
    (month?.despesas || []).forEach(item => push(item?.categoria));
    (month?.dailyCategorySeeds || []).forEach(push);
    Object.keys(month?.dailyGoals || {}).forEach(push);
    Object.keys(month?.categorias || {}).forEach(push);
    Object.keys(month?._catOrig || {}).forEach(push);
  });
  categoryCandidatesCache = Array.from(candidates);
  return categoryCandidatesCache;
}

function getSystemDefaultCategoryPresets() {
  const presets = Array.isArray(window.SYSTEM_DEFAULT_CATEGORY_PRESETS)
    ? window.SYSTEM_DEFAULT_CATEGORY_PRESETS
    : [];
  if (presets.length) {
    return presets
      .map(item => ({
        name: normalizeCategoryComparable(item?.name || ''),
        emoji: String(item?.emoji || '').trim()
      }))
      .filter(item => item.name);
  }
  return [
    { name: 'MORADIA', emoji: '🏠' },
    { name: 'SERVIÇOS', emoji: '🛠️' },
    { name: 'ALIMENTAÇÃO', emoji: '🍽️' },
    { name: 'TRANSPORTE', emoji: '🚗' },
    { name: 'COMPRAS', emoji: '🛍️' },
    { name: 'SAÚDE', emoji: '💊' },
    { name: 'LAZER', emoji: '🎬' },
    { name: 'EDUCAÇÃO', emoji: '🎓' },
    { name: 'FINANCEIRO', emoji: '💳' },
    { name: 'ASSINATURAS', emoji: '📱' },
    { name: 'TRABALHO', emoji: '💼' },
    { name: 'OUTROS', emoji: '📦' }
  ];
}

function ensureDefaultCategoriesInMonth(month, candidatePool = null) {
  if (!month) return false;
  let changed = false;
  if (!month.categorias || typeof month.categorias !== 'object') {
    month.categorias = {};
    changed = true;
  }
  if (!Array.isArray(month.dailyCategorySeeds)) {
    month.dailyCategorySeeds = [];
    changed = true;
  }
  const resolveWithPool = value => resolveCategoryName(value, candidatePool ? { candidatePool } : null);
  const seeds = new Set(month.dailyCategorySeeds.map(value => resolveCategoryName(value || 'OUTROS')));
  getSystemDefaultCategoryPresets().forEach(preset => {
    const resolved = resolveWithPool(preset.name);
    if (!resolved || isNonRealCategoryLabel(resolved)) return;
    if (!seeds.has(resolved)) {
      month.dailyCategorySeeds.push(resolved);
      seeds.add(resolved);
      changed = true;
    }
    if (month.categorias[resolved] === undefined) {
      month.categorias[resolved] = 0;
      changed = true;
    }
  });
  return changed;
}

function ensureSystemDefaultCategoriesForAllMonths() {
  const candidatePool = getAllUserCategoryCandidates();
  let changed = false;
  (data || []).forEach(month => {
    if (ensureDefaultCategoriesInMonth(month, candidatePool)) changed = true;
  });
  if (changed) invalidateCategoryNormalizationCache();
  return changed;
}

function ensureDefaultCategoryEmojiOverrides() {
  let changed = false;
  const presets = getSystemDefaultCategoryPresets();
  const candidatePool = getAllUserCategoryCandidates();
  presets.forEach(preset => {
    const resolved = resolveCategoryName(preset.name, { candidatePool });
    if (!resolved || !preset.emoji) return;
    if (!categoryEmojiOverrides[resolved]) {
      categoryEmojiOverrides[resolved] = preset.emoji;
      changed = true;
    }
  });
  return changed;
}

function levenshteinDistance(a, b) {
  const aa = String(a || '');
  const bb = String(b || '');
  if (aa === bb) return 0;
  if (!aa.length) return bb.length;
  if (!bb.length) return aa.length;
  const prev = Array(bb.length + 1).fill(0).map((_, idx) => idx);
  const curr = Array(bb.length + 1).fill(0);
  for (let i = 1; i <= aa.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= bb.length; j += 1) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= bb.length; j += 1) prev[j] = curr[j];
  }
  return prev[bb.length];
}

function findEquivalentCategoryCandidate(rawCategory, candidatePool = null) {
  const target = normalizeCategoryComparable(rawCategory);
  if (!target || isNonRealCategoryLabel(target)) return '';
  const targetAlpha = normalizeCategoryAlphaComparable(target);
  const targetSingular = normalizeCategorySingularComparable(target);
  if (!targetAlpha) return '';
  const pool = Array.isArray(candidatePool) ? candidatePool : getAllUserCategoryCandidates();
  if (!pool.length) return '';

  const exact = pool.find(candidate => normalizeCategoryComparable(candidate) === target);
  if (exact) return exact;

  const alphaExact = pool.find(candidate => normalizeCategoryAlphaComparable(candidate) === targetAlpha);
  if (alphaExact) return alphaExact;

  const singularExact = pool.find(candidate => normalizeCategorySingularComparable(candidate) === targetSingular);
  if (singularExact) return singularExact;

  let best = '';
  let bestDistance = Infinity;
  pool.forEach(candidate => {
    const candidateAlpha = normalizeCategoryAlphaComparable(candidate);
    if (!candidateAlpha) return;
    const lengthGap = Math.abs(candidateAlpha.length - targetAlpha.length);
    if (lengthGap > 2) return;
    const distance = levenshteinDistance(targetAlpha, candidateAlpha);
    const threshold = Math.max(1, Math.floor(Math.min(targetAlpha.length, candidateAlpha.length) * 0.16));
    if (distance <= threshold && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  });
  return best;
}

function resolveCategoryName(name, options = null) {
  let current = normalizeCategoryComparable(name || 'OUTROS') || 'OUTROS';
  const visited = new Set();
  while (categoryRenameMap[current] && !visited.has(current)) {
    visited.add(current);
    current = normalizeCategoryComparable(categoryRenameMap[current]) || current;
  }
  if (isNonRealCategoryLabel(current)) return 'OUTROS';
  const candidatePool = Array.isArray(options?.candidatePool) ? options.candidatePool : null;
  if (!candidatePool) {
    const cached = categoryResolutionCache.get(current);
    if (cached) return cached;
  }
  const equivalent = findEquivalentCategoryCandidate(current, candidatePool);
  const resolved = equivalent || current;
  if (!candidatePool) {
    if (categoryResolutionCache.size > 5000) categoryResolutionCache.clear();
    categoryResolutionCache.set(current, resolved);
  }
  return resolved;
}

function getCategorySuggestions(term = '', limit = 12) {
  const normalizedTerm = normalizeCategoryComparable(term);
  const normalizedAlphaTerm = normalizeCategoryAlphaComparable(term);
  const source = getAllUserCategoryCandidates();
  const ranked = source
    .map(category => {
      const comparable = normalizeCategoryComparable(category);
      const alpha = normalizeCategoryAlphaComparable(category);
      const starts = normalizedTerm ? comparable.startsWith(normalizedTerm) || alpha.startsWith(normalizedAlphaTerm) : true;
      const includes = normalizedTerm ? comparable.includes(normalizedTerm) || alpha.includes(normalizedAlphaTerm) : true;
      const score = starts ? 0 : (includes ? 1 : 2);
      return { category: resolveCategoryName(category), score };
    })
    .filter(item => item.score < 2)
    .sort((a, b) => (a.score - b.score) || a.category.localeCompare(b.category, 'pt-BR'));
  const unique = [];
  const seen = new Set();
  ranked.forEach(item => {
    if (seen.has(item.category)) return;
    seen.add(item.category);
    unique.push(item.category);
  });
  return unique.slice(0, Math.max(1, Number(limit || 12)));
}

function applyCategoryRenameToMonth(m) {
  if (!m) return;
  (m.gastosVar || []).forEach(g => {
    g.categoria = resolveCategoryName(g.categoria || 'OUTROS');
  });
  (m.despesas || []).forEach(d => {
    d.categoria = resolveCategoryName(d.categoria || 'OUTROS');
  });
  if (m.categorias && typeof m.categorias === 'object') {
    const next = {};
    Object.entries(m.categorias).forEach(([cat, val]) => {
      const resolved = resolveCategoryName(cat);
      next[resolved] = (next[resolved] || 0) + val;
    });
    m.categorias = next;
  }
  if (m._catOrig && typeof m._catOrig === 'object') {
    const nextOrig = {};
    Object.entries(m._catOrig).forEach(([cat, val]) => {
      const resolved = resolveCategoryName(cat);
      nextOrig[resolved] = (nextOrig[resolved] || 0) + val;
    });
    m._catOrig = nextOrig;
  }
}

function applyExpenseCategoryRulesToMonth(m) {
  if (!m) return;
  (m.despesas || []).forEach(d => {
    const ruleCat = expenseCategoryRules[normalizeExpenseName(d.nome)];
    if (ruleCat) d.categoria = resolveCategoryName(ruleCat);
  });
}

function applyExpenseNameRulesToMonth(m) {
  if (!m) return;
  (m.despesas || []).forEach(d => {
    d.nome = resolveExpenseName(d.nome);
  });
}

function applyExpensePaymentDateRulesToMonth(m) {
  if (!m) return;
  (m.despesas || []).forEach(d => {
    const ruleDate = expensePaymentDateRules[normalizeExpenseName(d.nome)];
    if (ruleDate !== undefined) d.data = ruleDate;
  });
}

function getImportedCategoriesForMonth(monthId) {
  if (!canUseBundledFinanceData()) return [];
  return Object.keys(IMPORTED_BREAKDOWNS[monthId] || {}).map(resolveCategoryName);
}

function harmonizeRealCategoriesAcrossMonths() {
  const candidatePool = getAllUserCategoryCandidates();
  const resolveWithPool = value => resolveCategoryName(value, { candidatePool });
  let changed = false;
  (data || []).forEach(month => {
    if (!month) return;
    (month.outflows || []).forEach(item => {
      const previous = String(item?.category || 'OUTROS');
      const next = resolveWithPool(previous);
      if (next !== previous) {
        item.category = next;
        changed = true;
      }
    });
    (month.gastosVar || []).forEach(item => {
      const previous = String(item?.categoria || 'OUTROS');
      const next = resolveWithPool(previous);
      if (next !== previous) {
        item.categoria = next;
        changed = true;
      }
    });
    (month.despesas || []).forEach(item => {
      const previous = String(item?.categoria || 'OUTROS');
      const next = resolveWithPool(previous);
      if (next !== previous) {
        item.categoria = next;
        changed = true;
      }
    });
    if (Array.isArray(month.dailyCategorySeeds)) {
      const nextSeeds = Array.from(new Set(month.dailyCategorySeeds.map(cat => resolveWithPool(cat || 'OUTROS'))));
      if (JSON.stringify(nextSeeds) !== JSON.stringify(month.dailyCategorySeeds)) {
        month.dailyCategorySeeds = nextSeeds;
        changed = true;
      }
    }
    if (month.dailyGoals && typeof month.dailyGoals === 'object') {
      const nextGoals = {};
      Object.entries(month.dailyGoals).forEach(([category, value]) => {
        const resolved = resolveWithPool(category || 'OUTROS');
        nextGoals[resolved] = Number(nextGoals[resolved] || 0) + Number(value || 0);
      });
      if (JSON.stringify(nextGoals) !== JSON.stringify(month.dailyGoals)) {
        month.dailyGoals = nextGoals;
        changed = true;
      }
    }
    ['categorias', '_catOrig'].forEach(key => {
      const source = month[key];
      if (!source || typeof source !== 'object') return;
      const next = {};
      Object.entries(source).forEach(([category, value]) => {
        const resolved = resolveWithPool(category || 'OUTROS');
        next[resolved] = Number(next[resolved] || 0) + Number(value || 0);
      });
      if (JSON.stringify(next) !== JSON.stringify(source)) {
        month[key] = next;
        changed = true;
      }
    });
  });
  return changed;
}

function getImportedProjectsForMonth(monthId) {
  if (!canUseBundledFinanceData()) return [];
  return (IMPORTED_PROJECTS[monthId] || []).map(item => ({ ...item }));
}

function normalizeEsoStatus(status) {
  const txt = String(status || '').trim().toLowerCase();
  if (txt === 'fechado') return 'Fechado';
  if (txt === 'aguardando') return 'Aguardando';
  return 'Não fechado';
}

function normalizeEsoEntry(entry, idx = 0) {
  return {
    id: entry.id || `eso_${idx}_${String(entry.cliente || 'item').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    data: normalizeVarDate(entry.data) || '',
    cliente: String(entry.cliente || '').trim() || '—',
    tipo: String(entry.tipo || '').trim() || '—',
    valor: Number(entry.valor || 0) || 0,
    entrada: String(entry.entrada || '').trim() || '—',
    status: normalizeEsoStatus(entry.status),
    manual: entry.manual === true
  };
}

function getDefaultEsoData() {
  return ESO_IMPORTED_CLOSINGS.map((entry, idx) => normalizeEsoEntry(entry, idx));
}

function saveEsoData() {
  Storage.setJSON(STORAGE_KEYS.esoData, esoData);
}

function sanitizeEsoFilter(filter) {
  const next = filter && typeof filter === 'object' ? filter : {};
  return {
    start: normalizeVarDate(next.start) || '',
    end: normalizeVarDate(next.end) || '',
    status: next.status || 'todas',
    tipo: String(next.tipo || 'todas'),
    entrada: String(next.entrada || 'todas'),
    search: String(next.search || '').trim()
  };
}

function getEsoUniqueValues(field) {
  return Array.from(new Set((esoData || []).map(item => String(item[field] || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function getFilteredEsoData() {
  const filter = sanitizeEsoFilter(esoFilter);
  const start = filter.start ? parseData(filter.start) : 0;
  const end = filter.end ? parseData(filter.end) : 0;
  return (esoData || []).filter(item => {
    const time = parseData(item.data);
    if (start && (!time || time < start)) return false;
    if (end && (!time || time > end)) return false;
    if (filter.status !== 'todas' && item.status !== filter.status) return false;
    if (filter.tipo !== 'todas' && item.tipo !== filter.tipo) return false;
    if (filter.entrada !== 'todas' && item.entrada !== filter.entrada) return false;
    if (filter.search) {
      const hay = `${item.cliente} ${item.tipo} ${item.entrada} ${item.status}`.toLowerCase();
      if (!hay.includes(filter.search.toLowerCase())) return false;
    }
    return true;
  });
}

function getSortedEsoData() {
  const rows = getFilteredEsoData().map(item => ({ item }));
  if (!esoSort.field) return rows;
  const factor = esoSort.direction === 'desc' ? -1 : 1;
  return rows.sort((a, b) => {
    if (esoSort.field === 'valor') return (a.item.valor - b.item.valor) * factor;
    if (esoSort.field === 'data') return (parseData(a.item.data) - parseData(b.item.data)) * factor;
    return String(a.item[esoSort.field] || '').localeCompare(String(b.item[esoSort.field] || ''), 'pt-BR') * factor;
  });
}

function getEsoMetrics(list = getFilteredEsoData()) {
  const totalValor = list.reduce((acc, item) => acc + (item.valor || 0), 0);
  const fechados = list.filter(item => item.status === 'Fechado');
  const aguardando = list.filter(item => item.status === 'Aguardando');
  return {
    totalProjetos: list.length,
    totalValor,
    totalFechados: fechados.length,
    valorFechado: fechados.reduce((acc, item) => acc + (item.valor || 0), 0),
    totalAbertos: list.length - fechados.length,
    aguardando: aguardando.length
  };
}

// ============================================================
// INIT
// ============================================================
function mergeMissingHistoricalMonths() {
  const existing = new Set((data || []).map(m => m.id));
  const additions = EXTRA_HIST_MONTHS
    .filter(month => !existing.has(month.id))
    .map(month => JSON.parse(JSON.stringify(month)));
  if (!additions.length) return false;
  data = [...data, ...additions];
  return true;
}

function isPrimaryUserEnvironment() {
  const boot = window.__APP_BOOTSTRAP__ || {};
  return !!(boot.isPrimaryUser || boot.session?.username === 'guilherme');
}

function canUseBundledFinanceData() {
  return isPrimaryUserEnvironment();
}

function hasImportedProjectFootprint(month) {
  if (!month || !Array.isArray(month.projetos) || !month.projetos.length) return false;
  const imported = IMPORTED_PROJECTS[month.id];
  return Array.isArray(imported) && areProjectListsEquivalent(month.projetos, imported);
}

function hasBundledContamination(months, esoEntries) {
  const extraMonthIds = new Set(EXTRA_HIST_MONTHS.map(month => month.id));
  return (months || []).some(month =>
    extraMonthIds.has(month.id) ||
    (month.gastosVar || []).some(item => item.importadoDaPlanilha === true) ||
    hasImportedProjectFootprint(month)
  ) || Array.isArray(esoEntries) && esoEntries.length > 0;
}

function hasUserOwnedFinancialData(months) {
  return (months || []).some(month => {
    if ((month.despesas || []).length) return true;
    if ((month.renda || []).length) return true;
    if ((month.financialGoals || []).length) return true;
    if (String(month.obs || '').trim()) return true;
    if ((month.gastosVar || []).some(item => item.importadoDaPlanilha !== true)) return true;
    if ((month.dailyCategorySeeds || []).length) return true;
    if (month.dailyGoals && Object.keys(month.dailyGoals).length) return true;
    if ((month.projetos || []).length && !hasImportedProjectFootprint(month)) return true;
    return false;
  });
}

function repairNonPrimaryContaminatedState() {
  if (canUseBundledFinanceData()) return false;
  if (!hasBundledContamination(data, esoData)) return false;
  if (hasUserOwnedFinancialData(data)) return false;

  data = [buildBlankMonth()];
  esoData = [];
  return true;
}

function getMonthIntegrityScore(month) {
  if (!month || typeof month !== 'object') return 0;
  const outflows = Array.isArray(month.outflows) ? month.outflows.length : 0;
  const bills = Array.isArray(month.cardBills) ? month.cardBills.length : 0;
  const despesas = Array.isArray(month.despesas) ? month.despesas.length : 0;
  const gastos = Array.isArray(month.gastosVar) ? month.gastosVar.length : 0;
  const renda = Array.isArray(month.renda) ? month.renda.length : 0;
  const projetos = Array.isArray(month.projetos) ? month.projetos.length : 0;
  const goals = Array.isArray(month.financialGoals) ? month.financialGoals.length : 0;
  const seeds = Array.isArray(month.dailyCategorySeeds) ? month.dailyCategorySeeds.length : 0;
  const dailyGoals = month.dailyGoals && typeof month.dailyGoals === 'object' ? Object.keys(month.dailyGoals).length : 0;
  const notes = String(month.obs || '').trim() ? 1 : 0;
  return (
    (outflows * 20) +
    (bills * 18) +
    (despesas * 16) +
    (gastos * 14) +
    (renda * 12) +
    (projetos * 10) +
    (goals * 10) +
    (seeds * 2) +
    dailyGoals +
    notes
  );
}

function dedupeMonthsByIdKeepingMostComplete() {
  if (!Array.isArray(data) || !data.length) return false;
  const byId = new Map();
  data.forEach((month, index) => {
    const id = String(month?.id || '').trim();
    if (!id) return;
    const score = getMonthIntegrityScore(month);
    if (!byId.has(id)) {
      byId.set(id, { month, index, score });
      return;
    }
    const current = byId.get(id);
    if (score > current.score) {
      byId.set(id, { month, index, score });
    }
  });
  const next = [];
  const seen = new Set();
  data.forEach(month => {
    const id = String(month?.id || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    next.push(byId.get(id)?.month || month);
  });
  if (next.length === data.length) return false;
  data = next;
  return true;
}

function init() {
  invalidateCategoryNormalizationCache();
  const boot = window.__APP_BOOTSTRAP__ || {};
  const allowBundledData = canUseBundledFinanceData();
  const saved = Storage.getJSON(STORAGE_KEYS.data, null);
  const savedMetas = Storage.getJSON(STORAGE_KEYS.metas, null);
  const savedCategoryRenameMap = Storage.getJSON(STORAGE_KEYS.categoryRenameMap, null);
  const savedExpenseCategoryRules = Storage.getJSON(STORAGE_KEYS.expenseCategoryRules, null);
  const savedExpenseNameRenameMap = Storage.getJSON(STORAGE_KEYS.expenseNameRenameMap, null);
  const savedExpensePaymentDateRules = Storage.getJSON(STORAGE_KEYS.expensePaymentDateRules, null);
  const savedIncomeNameRenameMap = Storage.getJSON(STORAGE_KEYS.incomeNameRenameMap, null);
  const savedEsoData = Storage.getJSON(STORAGE_KEYS.esoData, null);
  const savedPatrimonioAccounts = Storage.getJSON(STORAGE_KEYS.patrimonioAccounts, null);
  const savedPatrimonioMovements = Storage.getJSON(STORAGE_KEYS.patrimonioMovements, null);
  const savedMigrationVersion = parseInt(Storage.getText(STORAGE_KEYS.migrationVersion, '0') || '0', 10);
  if (savedCategoryRenameMap) categoryRenameMap = savedCategoryRenameMap;
  if (savedExpenseCategoryRules) expenseCategoryRules = savedExpenseCategoryRules;
  if (savedExpenseNameRenameMap) expenseNameRenameMap = savedExpenseNameRenameMap;
  if (savedExpensePaymentDateRules) expensePaymentDateRules = savedExpensePaymentDateRules;
  if (savedIncomeNameRenameMap) incomeNameRenameMap = savedIncomeNameRenameMap;
  if (saved) {
    data = saved;
  } else if (boot.shouldStartEmpty || !allowBundledData) {
    data = [buildBlankMonth()];
  } else {
    data = JSON.parse(JSON.stringify(HIST_DATA));
  }
  const mergedMissingMonths = allowBundledData && !boot.shouldStartEmpty ? mergeMissingHistoricalMonths() : false;
  sortDataChronologically();
  data.forEach(m => normalizeMonth(m));
  const dedupedMonths = dedupeMonthsByIdKeepingMostComplete();
  if (dedupedMonths) {
    sortDataChronologically();
    data.forEach(m => normalizeMonth(m));
  }
  // Always start each page load with summation checkboxes marked.
  // User changes during the session still work normally.
  const includeDefaultsTouched = (() => {
    let touched = false;
    data.forEach(month => {
      (month.renda || []).forEach(item => {
        if (item.includeInTotals !== true) {
          item.includeInTotals = true;
          touched = true;
        }
      });
      (month.projetos || []).forEach(item => {
        if (item.includeInTotals !== true) {
          item.includeInTotals = true;
          touched = true;
        }
      });
      (month.financialGoals || []).forEach(item => {
        if (item.includeInTotals !== true) {
          item.includeInTotals = true;
          touched = true;
        }
      });
    });
    return touched;
  })();
  const shouldRunHeavyStartupMigration = savedMigrationVersion < DATA_MIGRATION_VERSION;
  const unifiedOutflowMigration = (shouldRunHeavyStartupMigration && typeof migrateAllMonthsToUnifiedStructure === 'function')
    ? migrateAllMonthsToUnifiedStructure(data)
    : { changed: false };
  const categoryHarmonizationChanged = shouldRunHeavyStartupMigration
    ? harmonizeRealCategoriesAcrossMonths()
    : false;
  const defaultCategorySeedChanged = ensureSystemDefaultCategoriesForAllMonths();
  data.forEach(m => recalcTotals(m));
  esoData = savedEsoData
    ? savedEsoData.map((entry, idx) => normalizeEsoEntry(entry, idx))
    : (boot.permissions?.canAccessESO ? getDefaultEsoData() : []);
  patrimonioAccounts = Array.isArray(savedPatrimonioAccounts) ? savedPatrimonioAccounts : [];
  patrimonioMovements = Array.isArray(savedPatrimonioMovements) ? savedPatrimonioMovements : [];
  const repairedNonPrimaryState = repairNonPrimaryContaminatedState();
  if (!savedEsoData && boot.permissions?.canAccessESO) saveEsoData();
  if ((!saved && allowBundledData && !boot.shouldStartEmpty) || mergedMissingMonths || dedupedMonths || repairedNonPrimaryState || unifiedOutflowMigration.changed || categoryHarmonizationChanged || defaultCategorySeedChanged || includeDefaultsTouched || savedMigrationVersion < DATA_MIGRATION_VERSION) {
    save();
    Storage.setText(STORAGE_KEYS.migrationVersion, DATA_MIGRATION_VERSION);
    if (repairedNonPrimaryState) saveEsoData();
  }
  if (STORAGE_KEYS.schemaVersion) {
    Storage.setText(STORAGE_KEYS.schemaVersion, STATE_SCHEMA_VERSION);
  }
  metas = savedMetas || {};
  const savedTitles = Storage.getJSON(STORAGE_KEYS.titles, null);
  if (savedTitles) {
    sectionTitles = { ...sectionTitles, ...savedTitles };
    const currentResultTitle = String(sectionTitles.resultchart || '').trim().toLowerCase();
    if (currentResultTitle === 'resultado por mês' || currentResultTitle === 'resultado por mes') {
      sectionTitles.resultchart = 'Resultado por período selecionado';
      Storage.setJSON(STORAGE_KEYS.titles, sectionTitles);
    }
  }
  const savedResult = Storage.getText(STORAGE_KEYS.resultMode, '');
  if (savedResult) resultMode = savedResult;
  const savedDashMetricOrder = Storage.getJSON(STORAGE_KEYS.dashMetricOrder, null);
  if (savedDashMetricOrder) {
    dashMetricOrder = sanitizeDashMetricOrder(savedDashMetricOrder);
  } else {
    dashMetricOrder = sanitizeDashMetricOrder(dashMetricOrder);
    saveDashMetricOrder();
  }
  const savedDashboardWidgetOrder = Storage.getJSON(STORAGE_KEYS.dashboardWidgetOrder, null);
  if (savedDashboardWidgetOrder) {
    dashboardWidgetOrder = sanitizeDashboardWidgetOrder(savedDashboardWidgetOrder);
  } else {
    dashboardWidgetOrder = sanitizeDashboardWidgetOrder(dashboardWidgetOrder);
    saveDashboardWidgetState();
  }
  const savedDashboardWidgetLayout = Storage.getJSON(STORAGE_KEYS.dashboardWidgetLayout, null);
  const savedUiState = Storage.getJSON(STORAGE_KEYS.uiState, null);
  const savedDashboardLayoutVersion = parseInt(savedUiState?.dashboardLayoutVersion || '0', 10);
  if (savedDashboardWidgetLayout && savedDashboardLayoutVersion >= DASHBOARD_LAYOUT_VERSION) {
    dashboardWidgetLayout = sanitizeDashboardWidgetLayout(savedDashboardWidgetLayout);
  } else {
    dashboardWidgetOrder = sanitizeDashboardWidgetOrder(['gvsr', 'categories', 'result', 'quickhist']);
    dashboardWidgetLayout = sanitizeDashboardWidgetLayout(dashboardWidgetBaseLayout());
    saveDashboardWidgetState();
  }
  const savedMonthMetricOrder = Storage.getJSON(STORAGE_KEYS.monthMetricOrder, null);
  if (savedMonthMetricOrder) {
    monthMetricOrder = sanitizeMonthMetricOrder(savedMonthMetricOrder);
  } else {
    monthMetricOrder = sanitizeMonthMetricOrder(monthMetricOrder);
    saveMonthMetricOrder();
  }
  const savedMonthSectionOrder = Storage.getJSON(STORAGE_KEYS.monthSectionOrder, null);
  if (savedMonthSectionOrder) {
    monthSectionOrder = sanitizeMonthSectionOrder(savedMonthSectionOrder);
  } else {
    monthSectionOrder = sanitizeMonthSectionOrder(monthSectionOrder);
    saveMonthSectionOrder();
  }
  loadDashSeriesSelectionState();
  const savedDashSeriesColors = Storage.getJSON(STORAGE_KEYS.dashSeriesColors, null);
  if (savedDashSeriesColors) {
    dashSeriesColorOverrides = { ...savedDashSeriesColors };
  }
  const savedCategoryColors = Storage.getJSON(STORAGE_KEYS.categoryColors, null);
  if (savedCategoryColors) {
    categoryColorOverrides = { ...savedCategoryColors };
  }
  const savedCategoryEmojis = Storage.getJSON(STORAGE_KEYS.categoryEmojis, null);
  if (savedCategoryEmojis && typeof savedCategoryEmojis === 'object') {
    categoryEmojiOverrides = { ...savedCategoryEmojis };
  }
  if (ensureDefaultCategoryEmojiOverrides()) {
    saveCategoryEmojis();
  }
  const savedMonthSectionColors = Storage.getJSON(STORAGE_KEYS.monthSectionColors, null);
  if (savedMonthSectionColors) {
    monthSectionColorOverrides = { ...savedMonthSectionColors };
  }
  currentMonthId = getDefaultMonthId();
  periodFilter = sanitizePeriodFilter({
    type: 'all',
    month: currentMonthId,
    year: getYear(data[data.length - 1] || {}),
    start: currentMonthId,
    end: currentMonthId
  });
  restoreUIState();
  currentMonthId = getCurrentRealMonthId(true);
  loadDashSeriesSelectionState();
  saveDashSeriesSelection();
  if (typeof ensurePatrimonioData === 'function') ensurePatrimonioData();
  buildMonthSelect();
  renderTitles();
  nav(activePage);
}

function save(forceFlush = false) {
  invalidateCategoryNormalizationCache();
  Storage.setJSON(STORAGE_KEYS.data, data);
  Storage.setJSON(STORAGE_KEYS.patrimonioAccounts, patrimonioAccounts);
  Storage.setJSON(STORAGE_KEYS.patrimonioMovements, patrimonioMovements);
  if (forceFlush) flushServerStorage(true);
}

function saveMetas() {
  Storage.setJSON(STORAGE_KEYS.metas, metas);
}

function captureCompatibilityPreferences(options = {}) {
  const includeTransientState = options.includeTransientState !== false;
  const snapshot = {
    sectionTitles: JSON.parse(JSON.stringify(sectionTitles || {})),
    resultMode,
    dashMetricOrder: JSON.parse(JSON.stringify(dashMetricOrder || [])),
    dashboardWidgetOrder: JSON.parse(JSON.stringify(dashboardWidgetOrder || [])),
    dashboardWidgetLayout: JSON.parse(JSON.stringify(dashboardWidgetLayout || {})),
    dashSeriesSelectionsByMode: JSON.parse(JSON.stringify(dashSeriesSelectionsByMode || {})),
    dashSeriesColorOverrides: JSON.parse(JSON.stringify(dashSeriesColorOverrides || {})),
    categoryColorOverrides: JSON.parse(JSON.stringify(categoryColorOverrides || {})),
    monthSectionColorOverrides: JSON.parse(JSON.stringify(monthSectionColorOverrides || {})),
    monthMetricOrder: JSON.parse(JSON.stringify(monthMetricOrder || [])),
    monthSectionOrder: JSON.parse(JSON.stringify(monthSectionOrder || [])),
    monthSectionCollapsed: JSON.parse(JSON.stringify(
      (typeof getMonthSectionCollapseState === 'function'
        ? getMonthSectionCollapseState()
        : (Storage.getJSON(STORAGE_KEYS.monthSectionCollapsed, {}) || {}))
    ))
  };
  if (includeTransientState) {
    snapshot.activePage = activePage;
    snapshot.periodFilter = JSON.parse(JSON.stringify(periodFilter || {}));
    snapshot.esoFilter = JSON.parse(JSON.stringify(esoFilter || {}));
    snapshot.patrimonioFilters = JSON.parse(JSON.stringify(patrimonioFilters || {}));
    snapshot.histActiveTab = histActiveTab;
  }
  return snapshot;
}

function applyCompatibilityPreferences(preferences) {
  if (!preferences || typeof preferences !== 'object') return;
  if (preferences.sectionTitles && typeof preferences.sectionTitles === 'object') {
    sectionTitles = { ...sectionTitles, ...preferences.sectionTitles };
    Storage.setJSON(STORAGE_KEYS.titles, sectionTitles);
  }
  if (preferences.resultMode) {
    resultMode = preferences.resultMode;
    Storage.setText(STORAGE_KEYS.resultMode, resultMode);
  }
  if (preferences.dashMetricOrder) {
    dashMetricOrder = sanitizeDashMetricOrder(preferences.dashMetricOrder);
    saveDashMetricOrder();
  }
  if (preferences.dashboardWidgetOrder) {
    dashboardWidgetOrder = sanitizeDashboardWidgetOrder(preferences.dashboardWidgetOrder);
  }
  if (preferences.dashboardWidgetLayout) {
    dashboardWidgetLayout = sanitizeDashboardWidgetLayout(preferences.dashboardWidgetLayout);
  }
  if (preferences.dashboardWidgetOrder || preferences.dashboardWidgetLayout) {
    saveDashboardWidgetState();
  }
  if (preferences.dashSeriesSelectionsByMode && typeof preferences.dashSeriesSelectionsByMode === 'object') {
    dashSeriesSelectionsByMode = {
      simples: sanitizeDashSeriesSelection(preferences.dashSeriesSelectionsByMode.simples),
      fixo: sanitizeDashSeriesSelection(preferences.dashSeriesSelectionsByMode.fixo)
    };
    dashSeriesSelection = getDashSeriesSelectionForMode(resultMode);
    saveDashSeriesSelection();
  }
  if (preferences.dashSeriesColorOverrides && typeof preferences.dashSeriesColorOverrides === 'object') {
    dashSeriesColorOverrides = { ...preferences.dashSeriesColorOverrides };
    saveDashSeriesColors();
  }
  if (preferences.categoryColorOverrides && typeof preferences.categoryColorOverrides === 'object') {
    categoryColorOverrides = { ...preferences.categoryColorOverrides };
    saveCategoryColors();
  }
  if (preferences.monthSectionColorOverrides && typeof preferences.monthSectionColorOverrides === 'object') {
    monthSectionColorOverrides = { ...preferences.monthSectionColorOverrides };
    saveMonthSectionColors();
  }
  if (preferences.monthMetricOrder) {
    monthMetricOrder = sanitizeMonthMetricOrder(preferences.monthMetricOrder);
    saveMonthMetricOrder();
  }
  if (preferences.monthSectionOrder) {
    monthSectionOrder = sanitizeMonthSectionOrder(preferences.monthSectionOrder);
    saveMonthSectionOrder();
  }
  if (preferences.monthSectionCollapsed && typeof preferences.monthSectionCollapsed === 'object') {
    Storage.setJSON(STORAGE_KEYS.monthSectionCollapsed, preferences.monthSectionCollapsed);
  }
  if (preferences.activePage && ['dashboard', 'mes', 'historico', 'patrimonio', 'eso', 'perfil'].includes(preferences.activePage)) {
    activePage = preferences.activePage;
  }
  if (preferences.periodFilter) {
    periodFilter = sanitizePeriodFilter(preferences.periodFilter);
  }
  if (preferences.esoFilter) {
    esoFilter = sanitizeEsoFilter(preferences.esoFilter);
  }
  if (preferences.patrimonioFilters && typeof preferences.patrimonioFilters === 'object') {
    patrimonioFilters = { ...patrimonioFilters, ...preferences.patrimonioFilters };
  }
  if (preferences.histActiveTab && ['tabela', 'grafico'].includes(preferences.histActiveTab)) {
    histActiveTab = preferences.histActiveTab;
  }
  saveUIState();
}

function createHistorySnapshot() {
  return JSON.stringify({
    data,
    patrimonioAccounts,
    patrimonioMovements,
    metas,
    currentMonthId,
    patrimonioSelectedAccountId,
    categoryRenameMap,
    expenseCategoryRules,
    expenseNameRenameMap,
    expensePaymentDateRules,
    incomeNameRenameMap,
    esoData,
    compatibilityPreferences: captureCompatibilityPreferences()
  });
}

function restoreHistorySnapshot(snapshot) {
  const state = JSON.parse(snapshot);
  data = state.data || [];
  sortDataChronologically();
  patrimonioAccounts = Array.isArray(state.patrimonioAccounts) ? state.patrimonioAccounts : [];
  patrimonioMovements = Array.isArray(state.patrimonioMovements) ? state.patrimonioMovements : [];
  metas = state.metas || {};
  currentMonthId = state.currentMonthId || getDefaultMonthId();
  patrimonioSelectedAccountId = state.patrimonioSelectedAccountId || '';
  categoryRenameMap = state.categoryRenameMap || {};
  expenseCategoryRules = state.expenseCategoryRules || {};
  expenseNameRenameMap = state.expenseNameRenameMap || {};
  expensePaymentDateRules = state.expensePaymentDateRules || {};
  incomeNameRenameMap = state.incomeNameRenameMap || {};
  esoData = Array.isArray(state.esoData)
    ? state.esoData.map((entry, idx) => normalizeEsoEntry(entry, idx))
    : ((window.__APP_BOOTSTRAP__?.permissions?.canAccessESO || canUseBundledFinanceData()) ? getDefaultEsoData() : []);
  data.forEach(normalizeMonth);
  invalidateCategoryNormalizationCache();
  if (typeof ensurePatrimonioData === 'function') ensurePatrimonioData();
  applyCompatibilityPreferences(state.compatibilityPreferences);
  save();
  saveMetas();
  saveEsoData();
  saveCategoryRenameMap();
  saveExpenseCategoryRules();
  saveExpenseNameRenameMap();
  saveExpensePaymentDateRules();
  saveIncomeNameRenameMap();
  buildMonthSelect();
  renderAll();
}

function recordHistoryState() {
  undoStack.push(createHistorySnapshot());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}

function updateHistoryButtons() {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function undoLastChange() {
  if (undoStack.length === 0) return;
  redoStack.push(createHistorySnapshot());
  const snapshot = undoStack.pop();
  restoreHistorySnapshot(snapshot);
  updateHistoryButtons();
}

function redoLastChange() {
  if (redoStack.length === 0) return;
  undoStack.push(createHistorySnapshot());
  const snapshot = redoStack.pop();
  restoreHistorySnapshot(snapshot);
  updateHistoryButtons();
}

function isInlineEditing(table, row, field) {
  return inlineEditState && inlineEditState.table === table && inlineEditState.row === row && inlineEditState.field === field;
}

function startInlineEdit(table, row, field, kind) {
  inlineEditState = { table, row, field, kind };
  if (table === 'varItem') renderVarTable();
  else if (table === 'eso') renderEso();
  else renderMes();
  requestAnimationFrame(() => {
    const editor = document.getElementById('inlineEditor');
    if (editor) {
      editor.focus();
      if (editor.tagName === 'SELECT') {
        try { editor.click(); } catch (_) {}
      } else if (editor.select) {
        editor.select();
      }
    }
  });
}

function cancelInlineEdit() {
  if (!inlineEditState) return;
  const table = inlineEditState.table;
  inlineEditState = null;
  if (table === 'varItem') renderVarTable();
  else if (table === 'eso') renderEso();
  else renderMes();
}
