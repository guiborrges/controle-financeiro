// ============================================================
// MÊS ATUAL
// ============================================================
let currentMonthMessageCache = { monthId: '', text: '' };

function isUnifiedMonthPilotEnabled() {
  return true;
}

let unifiedOutflowExpandedCategories = {};
let unifiedReimbursementExpandedPeople = {};
let editingUnifiedOutflowId = '';
let editingUnifiedCardId = '';
let deletingUnifiedCardId = '';
let yesNoQuestionHandlers = { yes: null, no: null };
let recurringChangeScopeHandlers = { thisMonth: null, forward: null, cancel: null };
let unifiedRecurringSweepInProgress = false;
let unifiedRecurringSweepQueued = false;
let unifiedOutflowModalMinimized = false;
let unifiedOutflowToastTimer = null;
let unifiedOutflowDescriptionSuggestionTimer = null;
let unifiedOutflowSharedManualDraft = null;
let unifiedOutflowDraftSaveTimer = null;
let unifiedOutflowDraftListenersBound = false;
let unifiedOutflowDefaultFilterPending = true;
let unifiedLastRenderedMonthId = '';
let inheritedDailyGoalCategoriesSweepDone = false;
const INHERITED_DAILY_GOAL_SWEEP_VERSION = 2;
const RECURRING_INCOME_NEXT_MONTH_NORMALIZATION_VERSION = 1;
let recurringIncomeScheduleNormalizationSweepDone = false;

function normalizeUnifiedOutflowType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'spend' || raw === 'gasto') return 'spend';
  if (raw === 'fixed' || raw === 'expense' || raw === 'despesa') return 'expense';
  return 'expense';
}

function isUnifiedExpenseType(item) {
  return normalizeUnifiedOutflowType(item?.type) === 'expense';
}

function isUnifiedRecurringExpense(item) {
  return isUnifiedExpenseType(item) && item?.expenseRecurring === true;
}

function resolveUnifiedLaunchFlags(item, resolvedType, recurringSpend, expenseRecurring, installmentsTotal, sharedExpense) {
  const explicitPlanning = item?.showInMonthPlanning === true || item?.includeInMonthPlanning === true;
  const recurring = recurringSpend === true || expenseRecurring === true;
  const installment = Math.max(1, Number(installmentsTotal || 1) || 1) > 1;
  return {
    entryKind: 'launch',
    launchRecurring: recurring,
    launchInstallment: installment,
    launchShared: sharedExpense === true,
    showInMonthPlanning: explicitPlanning || recurring || resolvedType === 'expense'
  };
}

function getUnifiedEffectiveOutflowAmount(item) {
  const resolver = window.OutflowAmounts?.getEffectiveOutflowAmount;
  const raw = typeof resolver === 'function'
    ? resolver(item)
    : (item?.amount ?? item?.valor ?? 0);
  return Math.max(0, Number(raw || 0) || 0);
}

function resetUnifiedOutflowViewForMonth(monthOrId) {
  const month = typeof monthOrId === 'string'
    ? (data || []).find(entry => entry?.id === monthOrId)
    : monthOrId;
  if (!month) return;
  if (!month.unifiedOutflowUi || typeof month.unifiedOutflowUi !== 'object') {
    month.unifiedOutflowUi = {};
  }
  month.unifiedOutflowUi.filter = 'expense';
  month.unifiedOutflowUi.tagFilter = '';
  month.unifiedOutflowUi.allSearch = '';
  month.unifiedOutflowUi.sortField = 'categoria';
  month.unifiedOutflowUi.sortDirection = 'asc';
}

function getTodayDayKey() {
  return window.MesAtualNotifications?.getTodayDayKey?.() || '';
}

function toDayKeyFromDateLabel(value) {
  return window.MesAtualNotifications?.toDayKeyFromDateLabel?.(value) || '';
}

function getNotificationItemsForToday() {
  return window.MesAtualNotifications?.getNotificationItemsForToday?.() || [];
}

function closeNotificationsPopover() {
  window.MesAtualNotifications?.closeNotificationsPopover?.();
}

function positionNotificationsPopover(wrapper) {
  window.MesAtualNotifications?.positionNotificationsPopover?.(wrapper);
}

function repositionOpenNotificationsPopover() {
  window.MesAtualNotifications?.repositionOpenNotificationsPopover?.();
}

function renderNotificationBells() {
  window.MesAtualNotifications?.renderNotificationBells?.();
}

function toggleNotificationsPopover(event) {
  window.MesAtualNotifications?.toggleNotificationsPopover?.(event);
}

function getRecurringComparableSnapshot(item) {
  return {
    description: String(item?.description || ''),
    type: String(item?.type || ''),
    category: String(item?.category || ''),
    amount: Number(item?.amount || 0),
    outputKind: String(item?.outputKind || ''),
    outputMethod: String(item?.outputMethod || ''),
    outputRef: String(item?.outputRef || ''),
    date: String(item?.date || ''),
    tag: String(item?.tag || ''),
    belongsToCard: item?.belongsToCard === true,
    countsInPrimaryTotals: item?.countsInPrimaryTotals !== false,
    recurringSpend: item?.recurringSpend === true,
    expenseRecurring: item?.expenseRecurring === true,
    status: String(item?.status || '')
  };
}

function normalizeRecurringSignatureToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getRecurringSeriesIdentity(item) {
  if (!item) return '';
  const kind = isUnifiedRecurringExpense(item) ? 'expense-recurring' : (item.recurringSpend === true ? 'recurring-spend' : '');
  if (!kind) return '';
  const installmentsTotal = Math.max(1, Number(item.installmentsTotal || 1) || 1);
  if (installmentsTotal > 1) return '';
  const description = normalizeRecurringSignatureToken(item.description || '');
  if (!description) return '';
  const date = normalizeVarDate(String(item.date || '').trim()) || '';
  const day = date ? String(Number(date.split('/')[0] || 1)).padStart(2, '0') : '00';
  return `${kind}|${description}|${day}`;
}

function computeRecurringSeriesKeyFromIdentity(identity, occurrenceIndex = 1) {
  const raw = String(identity || '');
  if (!raw) return '';
  let hash = 0;
  for (let idx = 0; idx < raw.length; idx += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(idx);
    hash |= 0;
  }
  const suffix = Math.max(1, Number(occurrenceIndex || 1) || 1);
  return `rec_auto_${Math.abs(hash).toString(36)}_${suffix}`;
}

function isUnifiedRecurringSeriesCandidate(item) {
  if (!item) return false;
  const installmentsTotal = Math.max(1, Number(item.installmentsTotal || 1) || 1);
  if (installmentsTotal > 1) return false;
  return isUnifiedRecurringExpense(item) || item.recurringSpend === true;
}

function ensureUnifiedRecurringSeriesKeysAcrossMonths() {
  sortDataChronologically();
  let changed = false;
  const carryMap = new Map();
  (data || []).forEach(month => {
    ensureUnifiedOutflowPilotMonth(month);
    const monthSeen = new Map();
    (month.outflows || []).forEach(item => {
      if (!isUnifiedRecurringSeriesCandidate(item)) return;
      const identity = getRecurringSeriesIdentity(item);
      if (!identity) return;
      const occurrence = (monthSeen.get(identity) || 0) + 1;
      monthSeen.set(identity, occurrence);
      const scopedIdentity = `${identity}#${occurrence}`;
      const existingKey = String(item.recurringGroupId || '').trim();
      const fallbackKey = carryMap.get(scopedIdentity) || '';
      const resolvedKey = existingKey || fallbackKey || computeRecurringSeriesKeyFromIdentity(identity, occurrence);
      if (!existingKey && resolvedKey) {
        item.recurringGroupId = resolvedKey;
        changed = true;
      }
      if (resolvedKey) carryMap.set(scopedIdentity, resolvedKey);
    });
  });
  return changed;
}

function getRecurringChangedFields(previousItem, nextItem) {
  const before = getRecurringComparableSnapshot(previousItem);
  const after = getRecurringComparableSnapshot(nextItem);
  return Object.keys(after).filter(key => before[key] !== after[key]);
}

function getUnifiedBillingDayFromDateLabel(value) {
  const normalized = normalizeVarDate(String(value || '').trim());
  if (!normalized) return 1;
  const parts = normalized.split('/');
  const day = Number(parts[0] || 1);
  return Math.max(1, Math.min(31, day || 1));
}

function applyRecurringChangedFieldsToItem(targetItem, sourceItem, changedFields, monthRef, sourceMonthRef = null) {
  changedFields.forEach(field => {
    if (field === 'date' && (isUnifiedRecurringExpense(sourceItem) || sourceItem?.recurringSpend === true)) {
      if (window.MesAtualOutflowExpenseDate?.getExpenseDateForTargetMonth) {
        const targetMonthDate = getMonthDateFromMonthObject(monthRef);
        const resolved = window.MesAtualOutflowExpenseDate.getExpenseDateForTargetMonth(
          sourceItem?.date || '',
          sourceMonthRef || getCurrentMonth(),
          targetMonthDate
        );
        if (resolved) {
          targetItem.date = resolved;
          return;
        }
      }
      const day = getUnifiedBillingDayFromDateLabel(sourceItem?.date || '');
      targetItem.date = buildUnifiedFixedBillingDate(String(day), monthRef);
      return;
    }
    targetItem[field] = sourceItem[field];
  });
}

function resolveFlexibleDateInput(rawValue, month, options = {}) {
  if (window.DateUtils?.resolveDateFromInput) {
    return window.DateUtils.resolveDateFromInput(rawValue, month || getCurrentMonth(), options);
  }
  const raw = String(rawValue || '').trim();
  if (!raw) return { date: '', mode: 'empty', hasExplicitMonthYear: false, warning: '' };
  if (/^\d{1,2}$/.test(raw)) {
    const base = getMonthDateFromMonthObject(month || getCurrentMonth());
    const offset = Number.isFinite(Number(options.simpleDayMonthOffset)) ? Math.trunc(Number(options.simpleDayMonthOffset)) : 1;
    const target = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    const day = Math.min(Math.max(Number(raw) || 1, 1), maxDay);
    return {
      date: `${String(day).padStart(2, '0')}/${String(target.getMonth() + 1).padStart(2, '0')}/${String(target.getFullYear()).slice(-2)}`,
      mode: 'simple-day',
      hasExplicitMonthYear: false,
      warning: ''
    };
  }
  const normalized = normalizeVarDate(raw);
  return {
    date: normalized || '',
    mode: normalized ? 'full-date' : 'invalid',
    hasExplicitMonthYear: Boolean(normalized),
    warning: normalized ? '' : 'invalid-date'
  };
}

function normalizeFlexibleDateInput(rawValue, month, options = {}) {
  return resolveFlexibleDateInput(rawValue, month, options).date;
}

function applyRecurringForwardChanges(month, seriesKey, sourceItem, changedFields, matchItem = null) {
  if (!seriesKey || !Array.isArray(changedFields) || !changedFields.length) return;
  clearRecurringSeriesStopFromMonth(month, seriesKey);
  const currentSort = getMonthSortValue(month);
  const fallbackIdentity = getRecurringSeriesIdentity(matchItem || sourceItem);
  data.forEach(otherMonth => {
    if (otherMonth.id === month.id || getMonthSortValue(otherMonth) < currentSort) return;
    ensureUnifiedOutflowPilotMonth(otherMonth);
    const outflows = otherMonth.outflows || [];
    const explicitMatches = [];
    const fallbackMatches = [];
    outflows.forEach(otherItem => {
      const otherSeriesKey = otherItem.installmentsGroupId || otherItem.recurringGroupId;
      if (otherSeriesKey === seriesKey) {
        explicitMatches.push(otherItem);
        return;
      }
      if (otherSeriesKey || !fallbackIdentity) return;
      if (!isUnifiedRecurringSeriesCandidate(otherItem)) return;
      if (getRecurringSeriesIdentity(otherItem) !== fallbackIdentity) return;
      fallbackMatches.push(otherItem);
    });
    const targets = explicitMatches.length ? explicitMatches : (fallbackMatches.length === 1 ? fallbackMatches : []);
    targets.forEach(otherItem => {
      if (!String(otherItem.recurringGroupId || '').trim() && !String(otherItem.installmentsGroupId || '').trim()) {
        otherItem.recurringGroupId = seriesKey;
      }
      applyRecurringChangedFieldsToItem(otherItem, sourceItem, changedFields, otherMonth, month);
    });
    syncUnifiedCardBillForecastAmounts(otherMonth);
    syncUnifiedOutflowLegacyData(otherMonth);
  });
}

function isUnifiedRecurringTemplateItem(item) {
  if (!isUnifiedRecurringSeriesCandidate(item)) return false;
  const recurringKey = String(item.recurringGroupId || '').trim();
  return Boolean(recurringKey);
}

function getRecurringSeriesStops(month) {
  if (!month) return [];
  if (!Array.isArray(month.recurringSeriesStops)) month.recurringSeriesStops = [];
  month.recurringSeriesStops = month.recurringSeriesStops
    .map(value => String(value || '').trim())
    .filter(Boolean);
  return month.recurringSeriesStops;
}

function markRecurringSeriesStopFromMonth(month, seriesKey) {
  const key = String(seriesKey || '').trim();
  if (!month || !key) return;
  const stops = getRecurringSeriesStops(month);
  if (!stops.includes(key)) stops.push(key);
}

function clearRecurringSeriesStopFromMonth(month, seriesKey) {
  const key = String(seriesKey || '').trim();
  if (!month || !key) return;
  const currentSort = getMonthSortValue(month);
  data.forEach(otherMonth => {
    if (getMonthSortValue(otherMonth) < currentSort) return;
    const stops = getRecurringSeriesStops(otherMonth);
    const nextStops = stops.filter(stop => stop !== key);
    if (nextStops.length !== stops.length) otherMonth.recurringSeriesStops = nextStops;
  });
}

function ensureUnifiedRecurringFutureCoverage() {
  if (unifiedRecurringSweepInProgress) return;
  unifiedRecurringSweepInProgress = true;
  try {
    sortDataChronologically();
    const realCurrentMonthId = getCurrentRealMonthId(false);
    const realCurrentMonth = data.find(entry => entry.id === realCurrentMonthId);
    const realCurrentSortValue = realCurrentMonth ? getMonthSortValue(realCurrentMonth) : -Infinity;
    let changed = false;
    for (let idx = 0; idx < data.length; idx += 1) {
      const month = data[idx];
      migrateUnifiedOutflowMonth(month);
      month.outflows = (Array.isArray(month.outflows) ? month.outflows : []).map((item, itemIdx) => normalizeUnifiedOutflowItem(item, itemIdx));
      month.cardBills = (Array.isArray(month.cardBills) ? month.cardBills : []).map((bill, billIdx) => normalizeUnifiedCardBill(month, bill, billIdx));
      if (syncUnifiedCardBillForecastAmounts(month)) changed = true;
      getRecurringSeriesStops(month);
    }
    if (ensureUnifiedRecurringSeriesKeysAcrossMonths()) changed = true;

    for (let idx = 1; idx < data.length; idx += 1) {
      const prev = data[idx - 1];
      const current = data[idx];
      if (getMonthSortValue(prev) < realCurrentSortValue) continue;
      if (getMonthSortValue(current) < realCurrentSortValue) continue;
      const blocked = new Set(getRecurringSeriesStops(current));
      const templates = (prev.outflows || []).filter(isUnifiedRecurringTemplateItem);
      templates.forEach(template => {
        const key = String(template.recurringGroupId || '').trim();
        if (!key || blocked.has(key)) return;
        const alreadyExists = (current.outflows || []).some(entry => String(entry.recurringGroupId || '').trim() === key);
        if (alreadyExists) return;
        const currentDate = getMonthDateFromMonthObject(current);
        current.outflows.push(cloneUnifiedOutflowForMonth(template, currentDate, prev));
        changed = true;
      });
    }

    data.forEach(month => syncUnifiedOutflowLegacyData(month));
    if (changed) save(true);
  } finally {
    unifiedRecurringSweepInProgress = false;
  }
}

function scheduleUnifiedRecurringFutureCoverage(delayMs = 80) {
  if (unifiedRecurringSweepInProgress || unifiedRecurringSweepQueued) return;
  unifiedRecurringSweepQueued = true;
  window.setTimeout(() => {
    unifiedRecurringSweepQueued = false;
    try {
      ensureUnifiedRecurringFutureCoverage();
    } catch (error) {
      console.error('[recurring-sweep] Falha ao sincronizar recorrencias futuras:', error);
    }
  }, Math.max(0, Number(delayMs || 0)));
}

function openRecurringChangeScopeModal({
  message = 'Este lançamento se repete em outros meses. Como você deseja aplicar essa alteração?',
  onThisMonth = null,
  onForward = null,
  onCancel = null
} = {}) {
  const text = document.getElementById('recurringChangeScopeText');
  if (text) text.textContent = String(message || '');
  recurringChangeScopeHandlers = {
    thisMonth: typeof onThisMonth === 'function' ? onThisMonth : null,
    forward: typeof onForward === 'function' ? onForward : null,
    cancel: typeof onCancel === 'function' ? onCancel : null
  };
  openModal('modalRecurringChangeScope');
}

function resolveRecurringChangeScope(scope) {
  const handlers = recurringChangeScopeHandlers || { thisMonth: null, forward: null, cancel: null };
  recurringChangeScopeHandlers = { thisMonth: null, forward: null, cancel: null };
  closeModal('modalRecurringChangeScope');
  const action = scope === 'forward'
    ? handlers.forward
    : scope === 'this'
    ? handlers.thisMonth
    : handlers.cancel;
  if (typeof action === 'function') {
    try { action(); } catch (_) {}
  }
}

function openYesNoQuestion(question, onYes, onNo) {
  const text = document.getElementById('yesNoQuestionText');
  if (text) text.textContent = String(question || '');
  yesNoQuestionHandlers = {
    yes: typeof onYes === 'function' ? onYes : null,
    no: typeof onNo === 'function' ? onNo : null
  };
  openModal('modalYesNoQuestion');
}

function resolveYesNoQuestion(answer) {
  const handlers = yesNoQuestionHandlers || { yes: null, no: null };
  yesNoQuestionHandlers = { yes: null, no: null };
  closeModal('modalYesNoQuestion');
  const fn = answer ? handlers.yes : handlers.no;
  if (typeof fn === 'function') {
    try { fn(); } catch (_) {}
  }
}

function getUnifiedMigrationProfile() {
  const boot = window.__APP_BOOTSTRAP__ || {};
  const username = String(currentSession?.username || boot.session?.username || '').trim().toLowerCase();
  const displayName = String(currentSession?.displayName || boot.session?.displayName || '').trim().toLowerCase();
  const fullName = String(currentSession?.fullName || boot.session?.fullName || '').trim().toLowerCase();
  const isGuilherme = username === 'guilherme'
    || displayName === 'guilherme silva borges'
    || fullName === 'guilherme silva borges';
  return { username, displayName, fullName, isGuilherme };
}

function ensureUnifiedRequiredCards(month, profile = getUnifiedMigrationProfile()) {
  month.outflowCards = (Array.isArray(month?.outflowCards) ? month.outflowCards : []).map(normalizeUnifiedCard);
  if (!profile.isGuilherme) return new Map((month.outflowCards || []).map(card => [normalizeLegacyLookup(card.name), card]));
  const byLookup = new Map((month.outflowCards || []).map(card => [normalizeLegacyLookup(card.name), card]));
  GUILHERME_REQUIRED_CARDS.forEach(spec => {
    let card = byLookup.get(normalizeLegacyLookup(spec.name));
    if (!card) {
      card = normalizeUnifiedCard({
        id: `card_${spec.key}`,
        name: spec.name,
        institution: `institution:${spec.institution}`,
        closingDay: spec.closingDay,
        paymentDay: spec.paymentDay,
        description: ''
      });
      month.outflowCards.push(card);
    } else {
      card.name = spec.name;
      card.visualId = normalizeUnifiedCardVisualId(`institution:${spec.institution}`);
      card.closingDay = spec.closingDay;
      card.paymentDay = spec.paymentDay;
    }
    byLookup.set(normalizeLegacyLookup(spec.name), card);
  });
  return byLookup;
}

function buildUnifiedLegacySpend(month, item, idx, profile, cardsByName) {
  const rawCategory = resolveCategoryName(item?.categoria || 'OUTROS');
  const paymentMethod = String(item?.paymentMethod || '').trim().toLowerCase();
  const amount = Math.max(0, Number(item?.valor || 0) || 0);
  const assinaturaNoCartao = profile.isGuilherme && rawCategory === 'ASSINATURAS';
  const isCard = assinaturaNoCartao || paymentMethod === 'credito';
  const hasExplicitPaymentMethod = !!paymentMethod;
  const xpCard = cardsByName.get('XP');
  const interCard = cardsByName.get('INTER');
  const category = assinaturaNoCartao && Math.abs(amount - 156) <= 6
    ? 'SAÚDE'
    : rawCategory;
  const defaultCardId = assinaturaNoCartao ? interCard?.id : xpCard?.id;
  const shouldForceGuilhermeCard = profile.isGuilherme && !hasExplicitPaymentMethod;
  const outputKind = (isCard || shouldForceGuilhermeCard) ? 'card' : 'method';
  return normalizeUnifiedOutflowItem({
    id: item?.id || `legacy_spend_${month.id}_${idx}`,
    description: isLikelyBlankLegacyDescription(item?.titulo) ? '' : String(item?.titulo || '').trim(),
    type: 'spend',
    category,
    amount,
    outputKind,
    outputMethod: outputKind === 'method' && ['boleto', 'dinheiro', 'pix', 'debito'].includes(paymentMethod) ? paymentMethod : 'debito',
    outputRef: outputKind === 'card' ? String((item?.cartaoId || defaultCardId || '')).trim() : '',
    date: item?.data || '',
    status: 'done',
    recurringSpend: assinaturaNoCartao,
    recurringGroupId: assinaturaNoCartao ? `legacy_signature_${month.id}_${idx}` : '',
    countsInPrimaryTotals: outputKind !== 'card'
  }, idx);
}

function reconcileGuilhermeLegacySpendOutputs(month, profile, cardsByName) {
  if (!profile.isGuilherme || !Array.isArray(month?.outflows)) return false;
  const xpCard = cardsByName.get('XP');
  const interCard = cardsByName.get('INTER');
  let changed = false;
  month.outflows.forEach(item => {
    if (item.type !== 'spend') return;
    const itemId = String(item.id || '');
    const isLegacySpend = itemId.startsWith('legacy_spend_') || itemId.startsWith('legacy_card_fixed_') || String(item.recurringGroupId || '').startsWith('legacy_signature_');
    if (!isLegacySpend) return;
    const category = resolveCategoryName(item.category || 'OUTROS');
    const isSignatureFamily = category === 'ASSINATURAS' || String(item.recurringGroupId || '').startsWith('legacy_signature_');
    const targetCardId = isSignatureFamily ? interCard?.id : xpCard?.id;
    if (!targetCardId) return;
    if (item.outputKind !== 'card' || item.outputRef !== targetCardId || item.countsInPrimaryTotals !== false) {
      item.outputKind = 'card';
      item.outputMethod = '';
      item.outputRef = targetCardId;
      item.countsInPrimaryTotals = false;
      changed = true;
    }
  });
  return changed;
}

function buildUnifiedLegacyFixed(month, item, idx, profile, cardsByName) {
  const name = resolveExpenseName(item?.nome || item?.description || 'Despesa');
  const amount = Math.max(0, Number(item?.valor || 0) || 0);
  const paymentMethod = String(item?.paymentMethod || '').trim().toLowerCase();
  const explicitCardRef = String(item?.cartaoId || '').trim();
  const cardSpec = profile.isGuilherme ? getGuilhermeRequiredCardSpecFromName(name) : null;
  if (cardSpec) {
    const card = cardsByName.get(normalizeLegacyLookup(cardSpec.name));
    return {
      kind: 'bill',
      bill: normalizeUnifiedCardBill(month, {
        id: item?.id || `legacy_bill_${month.id}_${idx}`,
        cardId: card?.id || '',
        amount,
        paid: item?.pago === true,
        description: name
      }, idx)
    };
  }
  const belongsToCard = explicitCardRef || paymentMethod === 'credito' || item?.pertenceAoCartao === true;
  if (belongsToCard) {
    const linkedCardId = explicitCardRef || '';
    return {
      kind: 'outflow',
      outflow: normalizeUnifiedOutflowItem({
        id: item?.id || `legacy_card_fixed_${month.id}_${idx}`,
        description: String(name || '').trim(),
        type: 'spend',
        category: getLegacyExpenseSemanticCategory(name),
        amount,
        outputKind: 'card',
        outputRef: linkedCardId,
        date: item?.data || '',
        status: 'done',
        paid: item?.pago === true,
        recurringSpend: true,
        recurringGroupId: `legacy_card_fixed_${month.id}_${idx}`,
        countsInPrimaryTotals: false
      }, idx)
    };
  }
  return {
    kind: 'outflow',
    outflow: normalizeUnifiedOutflowItem({
      id: item?.id || `legacy_fixed_${month.id}_${idx}`,
      description: String(name || 'Despesa').trim(),
      type: 'expense',
      category: getLegacyExpenseSemanticCategory(name),
      amount,
      outputKind: 'method',
      outputMethod: 'boleto',
      date: item?.data || '',
      status: item?.pago ? 'done' : 'planned',
      paid: item?.pago === true,
      expenseRecurring: true,
      recurringGroupId: `legacy_fixed_${normalizeLegacyLookup(name) || idx}`
    }, idx)
  };
}

function migrateUnifiedOutflowMonth(month, profile = getUnifiedMigrationProfile()) {
  if (!month) return false;
  let changed = false;
  const cardsByName = ensureUnifiedRequiredCards(month, profile);
  month.cardBills = (Array.isArray(month.cardBills) ? month.cardBills : []).map((bill, idx) => normalizeUnifiedCardBill(month, bill, idx));
  month.outflows = (Array.isArray(month.outflows) ? month.outflows : []).map((item, idx) => normalizeUnifiedOutflowItem(item, idx));
  if (harmonizeUnifiedFixedBillingDates(month)) changed = true;
  if (Number(month._unifiedOutflowMigratedVersion || 0) >= UNIFIED_OUTFLOW_GLOBAL_MIGRATION_VERSION) {
    syncUnifiedOutflowLegacyData(month);
    return changed;
  }

  const legacyExpenses = Array.isArray(month.despesas) ? month.despesas : [];
  const legacySpends = Array.isArray(month.gastosVar) ? month.gastosVar : [];
  const hasStructuredOutflows = (month.outflows || []).length > 0 || (month.cardBills || []).some(bill => Number(bill?.amount || 0) > 0);

  if (!hasStructuredOutflows && (legacyExpenses.length || legacySpends.length)) {
    const nextOutflows = [];
    const billsByCardId = new Map((month.cardBills || []).map(bill => [bill.cardId, bill]));

    legacyExpenses.forEach((item, idx) => {
      const migrated = buildUnifiedLegacyFixed(month, item, idx, profile, cardsByName);
      if (migrated.kind === 'bill') {
        if (migrated.bill.cardId) {
          const existingBill = billsByCardId.get(migrated.bill.cardId);
          billsByCardId.set(
            migrated.bill.cardId,
            existingBill
              ? normalizeUnifiedCardBill(month, {
                  ...existingBill,
                  amount: Number(existingBill.amount || 0) + Number(migrated.bill.amount || 0),
                  paid: existingBill.paid === true || migrated.bill.paid === true,
                  description: existingBill.description || migrated.bill.description
                }, idx)
              : migrated.bill
          );
        }
      } else {
        nextOutflows.push(migrated.outflow);
      }
    });

    legacySpends.forEach((item, idx) => {
      nextOutflows.push(buildUnifiedLegacySpend(month, item, idx, profile, cardsByName));
    });

    month.outflows = nextOutflows.map((item, idx) => normalizeUnifiedOutflowItem(item, idx));
    month.cardBills = reconcileUnifiedCardBillsWithCards(month, Array.from(billsByCardId.values()));
    changed = true;
  }

  (month.outflows || []).forEach((item, idx) => {
    if (isUnifiedExpenseType(item) && item.outputKind === 'card') {
      item.type = 'spend';
      item.status = 'done';
      item.belongsToCard = false;
      item.countsInPrimaryTotals = false;
      item.recurringSpend = true;
      if (!item.recurringGroupId) item.recurringGroupId = `legacy_card_rec_${item.id || idx}`;
      changed = true;
    }
  });

  if (reconcileGuilhermeLegacySpendOutputs(month, profile, cardsByName)) {
    changed = true;
  }

  month._unifiedOutflowMigrated = true;
  month._unifiedOutflowMigratedVersion = UNIFIED_OUTFLOW_GLOBAL_MIGRATION_VERSION;
  syncUnifiedOutflowLegacyData(month);
  return changed;
}

function migrateAllMonthsToUnifiedStructure(months = data) {
  const profile = getUnifiedMigrationProfile();
  let changed = false;
  (months || []).forEach(month => {
    normalizeMonth(month);
    if (migrateUnifiedOutflowMonth(month, profile)) changed = true;
  });
  return { changed, version: UNIFIED_OUTFLOW_GLOBAL_MIGRATION_VERSION };
}

function getUnifiedOutflowPilotKey(month) {
  return month?.id || currentMonthId || 'month';
}

function normalizeUnifiedCardVisualId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('account:') || raw.startsWith('institution:')) return raw;
  return PATRIMONIO_INSTITUTION_META[raw] ? `institution:${raw}` : raw;
}

function normalizeUnifiedCardDateValue(value) {
  return typeof normalizeVarDate === 'function' ? (normalizeVarDate(value) || '') : '';
}

function normalizeUnifiedCard(card, idx = 0) {
  const closingDate = normalizeUnifiedCardDateValue(card?.closingDate || card?.dataFechamento || '');
  const paymentDate = normalizeUnifiedCardDateValue(card?.paymentDate || card?.dataPagamento || '');
  const closingDaySource = closingDate ? closingDate.split('/')[0] : (card?.closingDay || card?.fechamento || 1);
  const paymentDaySource = paymentDate ? paymentDate.split('/')[0] : (card?.paymentDay || card?.pagamento || 1);
  return {
    id: card?.id || `card_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
    name: String(card?.name || card?.nome || '').trim() || `Cartão ${idx + 1}`,
    closingDay: Math.min(31, Math.max(1, Number(closingDaySource) || 1)),
    paymentDay: Math.min(31, Math.max(1, Number(paymentDaySource) || 1)),
    closingDate,
    paymentDate,
    description: String(card?.description || card?.descricao || '').trim(),
    visualId: normalizeUnifiedCardVisualId(card?.visualId || card?.institution || card?.associatedVisualId || '')
  };
}

function normalizeUnifiedCardBill(month, bill, idx = 0) {
  const hasAmountValue = Object.prototype.hasOwnProperty.call(bill || {}, 'amount')
    || Object.prototype.hasOwnProperty.call(bill || {}, 'valor');
  const amount = Math.max(0, Number(bill?.amount ?? bill?.valor ?? 0) || 0);
  const forecastAmount = Math.max(0, Number(bill?.forecastAmount || 0) || 0);
  const currentRealSort = getMonthSortValue({ id: getCurrentRealMonthId(true) });
  const monthSort = getMonthSortValue(month || {});
  const explicitSource = String(bill?.source || '').trim().toLowerCase();
  const isAuthoritativeSource = ['manual', 'backup', 'historical', 'imported'].includes(explicitSource);
  const inferredManual = bill?.manualAmountSet === true
    || bill?.isManual === true
    || isAuthoritativeSource
    || (hasAmountValue && monthSort <= currentRealSort)
    || (hasAmountValue && amount > 0);
  return {
    id: bill?.id || `bill_${month?.id || 'month'}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
    cardId: String(bill?.cardId || '').trim(),
    amount: inferredManual ? amount : 0,
    forecastAmount: inferredManual ? forecastAmount : (forecastAmount || amount),
    manualAmountSet: inferredManual,
    source: inferredManual ? (explicitSource && explicitSource !== 'forecast' ? explicitSource : 'manual') : 'forecast',
    paid: bill?.paid === true,
    description: String(bill?.description || '').trim()
  };
}

function getUnifiedCardBillEffectiveAmount(month, bill) {
  if (!bill) return 0;
  const source = String(bill.source || '').toLowerCase();
  const amount = Math.max(0, Number(bill.amount || 0) || 0);
  if (bill.manualAmountSet === true || (source !== 'forecast' && amount > 0)) {
    return Math.max(0, Number(bill.amount || 0) || 0);
  }
  return Math.max(0, Number(bill.forecastAmount || 0) || 0);
}

function resolveUnifiedBillCardId(month, rawCardId) {
  const normalizeLookup = typeof normalizeLegacyLookup === 'function'
    ? normalizeLegacyLookup
    : (value => String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''));
  const cardId = String(rawCardId || '').trim();
  if (!cardId) return '';
  const cards = Array.isArray(month?.outflowCards) ? month.outflowCards : [];
  if (cards.some(card => String(card?.id || '').trim() === cardId)) return cardId;
  const normalizedCardId = normalizeLookup(cardId);
  if (!normalizedCardId) return cardId;
  const matchedByName = cards.find(card => normalizeLookup(card?.name || '') === normalizedCardId);
  return matchedByName ? String(matchedByName.id || '').trim() : cardId;
}

function reconcileUnifiedCardBillsWithCards(month, rawBills = []) {
  const normalizedBills = Array.isArray(rawBills) ? rawBills : [];
  const byCardId = new Map();

  normalizedBills.forEach((bill, idx) => {
    const resolvedCardId = resolveUnifiedBillCardId(month, bill?.cardId);
    const normalizedBill = normalizeUnifiedCardBill(month, {
      ...bill,
      cardId: resolvedCardId || String(bill?.cardId || '').trim()
    }, idx);
    const key = String(normalizedBill?.cardId || '').trim();
    if (!key) return;
    const existing = byCardId.get(key);
    if (!existing) {
      byCardId.set(key, normalizedBill);
      return;
    }
    byCardId.set(key, normalizeUnifiedCardBill(month, {
      ...existing,
      amount: Math.max(0, Number(existing.amount || 0), Number(normalizedBill.amount || 0)),
      manualAmountSet: existing.manualAmountSet === true || normalizedBill.manualAmountSet === true,
      paid: existing.paid === true || normalizedBill.paid === true,
      description: String(existing.description || normalizedBill.description || '').trim()
    }, idx));
  });

  (month?.outflowCards || []).forEach((card, idx) => {
    const cardId = String(card?.id || '').trim();
    if (!cardId || byCardId.has(cardId)) return;
    byCardId.set(cardId, normalizeUnifiedCardBill(month, { cardId }, normalizedBills.length + idx));
  });

  return Array.from(byCardId.values());
}

function harmonizeUnifiedFixedBillingDates(month) {
  if (!month || !Array.isArray(month.outflows)) return false;
  let changed = false;
  month.outflows.forEach(item => {
    if (!isUnifiedExpenseType(item) || item?.outputKind === 'card') return;
    const normalized = normalizeVarDate(item?.date || '');
    if (!normalized) return;
    const [day] = normalized.split('/');
    const expected = buildUnifiedFixedBillingDate(String(Number(day || 1)), month);
    if (item.date !== expected) {
      item.date = expected;
      changed = true;
    }
  });
  return changed;
}

function normalizeUnifiedOutflowItem(item, idx = 0) {
  const parsedDate = normalizeVarDate(item?.date || item?.data || '') || '';
  const outputKind = ['method', 'card', 'account'].includes(item?.outputKind) ? item.outputKind : 'method';
  const outputMethod = ['boleto', 'dinheiro', 'pix', 'debito'].includes(item?.outputMethod) ? item.outputMethod : 'boleto';
  const rawType = normalizeUnifiedOutflowType(item?.type);
  const recurringSpend = item?.recurringSpend === true || (rawType === 'spend' && !!String(item?.recurringGroupId || '').trim() && Number(item?.installmentsTotal || 1) <= 1);
  const expenseRecurring = item?.expenseRecurring === true || rawType === 'fixed';
  const type = outputKind === 'card' ? 'spend' : rawType;
  const category = resolveCategoryName(item?.category || item?.categoria || 'OUTROS');
  const belongsToCard = item?.belongsToCard === true || (type === 'expense' && outputKind === 'card');
  const countsInPrimaryTotals = item?.countsInPrimaryTotals === false ? false : !belongsToCard;
  const rawDescription = String(item?.description ?? item?.descricao ?? '').trim();
  const tag = String(item?.tag || item?.marca || '').trim();
  const sharedExpense = item?.sharedExpense === true;
  const sharedSplitMode = String(item?.sharedSplitMode || 'equal').toLowerCase() === 'manual' ? 'manual' : 'equal';
  const sharedOriginalAmount = Math.max(0, Number(item?.sharedOriginalAmount || item?.amount || item?.valor || 0) || 0);
  const sharedOwnerName = String(item?.sharedOwnerName || currentSession?.fullName || currentSession?.displayName || 'Proprietário').trim() || 'Proprietário';
  const sharedParticipants = Array.isArray(item?.sharedParticipants) ? item.sharedParticipants.map((participant, participantIdx) => ({
    id: String(participant?.id || `sp_${participantIdx}_${Math.random().toString(36).slice(2, 7)}`).trim(),
    name: String(participant?.name || '').trim(),
    amount: Math.max(0, Number(participant?.amount || 0) || 0),
    isOwner: participant?.isOwner === true,
    paid: participant?.paid === true
  })) : [];
  const sharedOthersAmount = Math.max(0, Number(item?.sharedOthersAmount || 0) || 0);
  const isDirectRealOutflow = outputKind === 'method' && ['pix', 'dinheiro', 'debito'].includes(outputMethod);
  const hasPaidFlag = Object.prototype.hasOwnProperty.call(item || {}, 'paid');
  const installmentsTotal = Math.max(1, Number(item?.installmentsTotal || 1) || 1);
  const launchFlags = resolveUnifiedLaunchFlags(
    item,
    type,
    recurringSpend,
    expenseRecurring,
    installmentsTotal,
    sharedExpense
  );
  return {
    id: item?.id || `out_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
    description: rawDescription || (type === 'expense' ? 'Despesa' : ''),
    type,
    category,
    amount: Math.max(0, Number(item?.amount || item?.valor || 0) || 0),
    outputKind,
    outputMethod,
    outputRef: String(item?.outputRef || '').trim(),
    date: parsedDate,
    tag,
    belongsToCard,
    countsInPrimaryTotals,
    recurringSpend,
    expenseRecurring,
    status: item?.status === 'done' ? 'done' : 'planned',
    paid: hasPaidFlag ? item?.paid === true : isDirectRealOutflow,
    recurringGroupId: String(item?.recurringGroupId || '').trim(),
    installmentsGroupId: String(item?.installmentsGroupId || '').trim(),
    installmentsTotal,
    installmentIndex: Math.max(1, Number(item?.installmentIndex || 1) || 1),
    createdAt: item?.createdAt || new Date().toISOString(),
    sharedExpense,
    sharedSplitMode,
    sharedOriginalAmount,
    sharedOwnerName,
    sharedOthersAmount,
    sharedParticipants,
    entryKind: launchFlags.entryKind,
    launchRecurring: launchFlags.launchRecurring,
    launchInstallment: launchFlags.launchInstallment,
    launchShared: launchFlags.launchShared,
    showInMonthPlanning: launchFlags.showInMonthPlanning
  };
}

function getMonthDateByDayForMonth(day, month) {
  if (window.IncomeDateRules?.getMonthDateByDayForMonth) {
    return window.IncomeDateRules.getMonthDateByDayForMonth(day, month, 1);
  }
  const parsedDay = Math.max(1, Math.min(31, Number(day || 1) || 1));
  const base = getMonthDateFromMonthObject(month || getCurrentMonth());
  const date = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(parsedDay).padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
}

function harmonizeRecurringIncomeReceiveDays(month) {
  if (!month) return false;
  if (Number(month._recurringIncomeNextMonthNormalizationVersion || 0) >= RECURRING_INCOME_NEXT_MONTH_NORMALIZATION_VERSION) {
    return false;
  }
  let changed = false;
  month.renda = Array.isArray(month.renda) ? month.renda : [];
  month.renda.forEach(item => {
    if (!item || item.recurringFixed === false) return;
    const current = String(item.dataRecebimento || '').trim();
    const fullDate = normalizeVarDate(current);
    if (fullDate) {
      if (current !== fullDate) {
        item.dataRecebimento = fullDate;
        changed = true;
      }
      return;
    }
    const day = getRecurringIncomeReceiveDay(current);
    if (!day) return;
    if (current !== day) {
      item.dataRecebimento = day;
      changed = true;
    }
    if (item.recurringFixed === undefined) {
      item.recurringFixed = true;
      changed = true;
    }
  });
  month._recurringIncomeNextMonthNormalizationVersion = RECURRING_INCOME_NEXT_MONTH_NORMALIZATION_VERSION;
  return changed;
}

function ensureRecurringIncomeNextMonthScheduleAcrossData() {
  if (recurringIncomeScheduleNormalizationSweepDone) return;
  recurringIncomeScheduleNormalizationSweepDone = true;
  let changed = false;
  (data || []).forEach(month => {
    if (harmonizeUnifiedFixedBillingDates(month)) changed = true;
    if (harmonizeRecurringIncomeReceiveDays(month)) changed = true;
  });
  if (changed) save(true);
}

function normalizeUnifiedOutflowSpendDateInput(rawValue, month) {
  return normalizeFlexibleDateInput(rawValue, month, { simpleDayMonthOffset: 1 });
}

function normalizeIncomeReceiveDate(rawValue, month, allowDayOnly = true) {
  if (window.IncomeDateRules?.normalizeIncomeReceiveDate) {
    return window.IncomeDateRules.normalizeIncomeReceiveDate(rawValue, month, allowDayOnly);
  }
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  if (allowDayOnly && /^\d{1,2}$/.test(raw)) {
    return normalizeFlexibleDateInput(raw, month, { simpleDayMonthOffset: 1 });
  }
  return normalizeVarDate(raw) || '';
}

function getRecurringIncomeReceiveDay(value) {
  if (window.IncomeDateRules?.getRecurringIncomeReceiveDay) {
    return window.IncomeDateRules.getRecurringIncomeReceiveDay(value);
  }
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{1,2}$/.test(raw)) {
    const day = Math.max(1, Math.min(31, Number(raw) || 1));
    return String(day).padStart(2, '0');
  }
  const normalizedDate = normalizeVarDate(raw);
  if (!normalizedDate) return '';
  const [dayRaw] = normalizedDate.split('/');
  const day = Math.max(1, Math.min(31, Number(dayRaw || 1) || 1));
  return String(day).padStart(2, '0');
}

function getIncomeReceiveDateLabel(item, month) {
  if (window.IncomeDateRules?.getIncomeReceiveDateLabel) {
    return window.IncomeDateRules.getIncomeReceiveDateLabel(item, month);
  }
  if (!item) return '—';
  const recurring = item?.recurringFixed !== false;
  if (recurring) {
    const raw = String(item?.dataRecebimento || '').trim();
    const fullDate = normalizeVarDate(raw);
    if (fullDate && fullDate.includes('/')) return fullDate;
    const day = getRecurringIncomeReceiveDay(item?.dataRecebimento || '');
    if (!day) return '—';
    return getMonthDateByDayForMonth(day, month);
  }
  return normalizeVarDate(String(item?.dataRecebimento || '').trim()) || '—';
}

function getIncomeReceiveDateSortValue(item, month) {
  if (window.IncomeDateRules?.getIncomeReceiveDateSortValue) {
    return window.IncomeDateRules.getIncomeReceiveDateSortValue(item, month);
  }
  return parseData(getIncomeReceiveDateLabel(item, month)) || 0;
}

function getOwnerDisplayName() {
  const fullName = String(currentSession?.fullName || '').trim();
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`;
    return parts[0];
  }
  return String(currentSession?.displayName || currentSession?.username || 'Proprietário').trim() || 'Proprietário';
}

function getSharedParticipantNameSuggestions() {
  const map = new Map();
  (data || []).forEach(month => {
    (month?.outflows || []).forEach(item => {
      (item?.sharedParticipants || []).forEach(participant => {
        if (participant?.isOwner === true) return;
        const name = String(participant?.name || '').trim();
        if (!name) return;
        const key = name.toLocaleLowerCase('pt-BR');
        if (!map.has(key)) map.set(key, name);
      });
    });
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function getUnifiedSharedComputedValues(totalAmount, peopleCount, mode, peopleRows = []) {
  const safeTotal = Math.max(0, Number(totalAmount || 0) || 0);
  const safeCount = Math.max(1, Math.min(20, Number(peopleCount || 1) || 1));
  const normalizedMode = String(mode || 'equal').toLowerCase() === 'manual' ? 'manual' : 'equal';
  if (safeCount <= 1) {
    const sanitizedRows = Array.isArray(peopleRows) ? peopleRows : [];
    const ownerRow = sanitizedRows.find(row => row?.isOwner === true) || null;
    const ownerShare = Math.max(0, Number(ownerRow?.amount || 0) || 0);
    return {
      ownerShare,
      othersShare: Math.max(0, safeTotal - ownerShare),
      participants: sanitizedRows
    };
  }
  if (normalizedMode === 'equal') {
    const each = safeTotal / safeCount;
    return {
      ownerShare: each,
      othersShare: Math.max(0, safeTotal - each),
      participants: []
    };
  }
  const sanitizedRows = Array.isArray(peopleRows) ? peopleRows : [];
  const ownerRow = sanitizedRows.find(row => row?.isOwner === true) || null;
  const ownerShare = Math.max(0, Number(ownerRow?.amount || 0) || 0);
  return {
    ownerShare,
    othersShare: Math.max(0, safeTotal - ownerShare),
    participants: sanitizedRows
  };
}

function getUnifiedOutflowTags() {
  const tags = new Set();
  (data || []).forEach(month => {
    (month?.outflows || []).forEach(item => {
      const tag = String(item?.tag || '').trim();
      if (tag) tags.add(tag);
    });
  });
  return Array.from(tags).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function populateUnifiedOutflowTagOptions(selected = '') {
  const select = document.getElementById('unifiedOutflowTag');
  if (!select) return;
  const selectedTag = String(selected || '').trim();
  const tags = getUnifiedOutflowTags();
  if (selectedTag && !tags.some(tag => String(tag || '').trim().toLowerCase() === selectedTag.toLowerCase())) {
    tags.push(selectedTag);
    tags.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }
  select.innerHTML = ['<option value="">Sem tag</option>']
    .concat(tags.map(tag => `<option value="${escapeHtml(tag)}" ${selectedTag === tag ? 'selected' : ''}>${escapeHtml(tag)}</option>`))
    .concat('<option value="nova">+ Nova tag</option>')
    .join('');
}

function toggleUnifiedOutflowNewTag() {
  const select = document.getElementById('unifiedOutflowTag');
  const inline = document.getElementById('unifiedOutflowTagInlineEditor');
  const inlineInput = document.getElementById('unifiedOutflowNewTagInline');
  if (!select || !inline) return;
  const isNew = select.value === 'nova';
  select.style.display = isNew ? 'none' : '';
  inline.style.display = isNew ? 'grid' : 'none';
  if (isNew) {
    if (inlineInput) {
      inlineInput.value = '';
      inlineInput.focus();
    }
  } else if (inlineInput) {
    inlineInput.value = '';
  }
}

function confirmUnifiedOutflowNewTagInline() {
  const select = document.getElementById('unifiedOutflowTag');
  const inlineInput = document.getElementById('unifiedOutflowNewTagInline');
  if (!select || !inlineInput) return;
  const tag = String(inlineInput.value || '').trim();
  if (!tag) return;
  populateUnifiedOutflowTagOptions(tag);
  select.value = tag;
  toggleUnifiedOutflowNewTag();
}

function handleUnifiedOutflowNewTagInlineKeydown(event) {
  if (!event) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    confirmUnifiedOutflowNewTagInline();
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    const select = document.getElementById('unifiedOutflowTag');
    if (select) select.value = '';
    toggleUnifiedOutflowNewTag();
  }
}

function getUnifiedOutflowPaymentLabel(item, month = getCurrentMonth()) {
  if (!item) return 'Saída';
  if (item.outputKind === 'card') {
    const card = (month?.outflowCards || []).find(entry => entry.id === item.outputRef);
    return card ? card.name : 'Cartão';
  }
  if (item.outputKind === 'account') {
    const account = getPatrimonioAccountById(item.outputRef);
    return account ? account.nome : 'Conta';
  }
  return UNIFIED_OUTFLOW_METHOD_META[item.outputMethod]?.label || 'Saída';
}

function getUnifiedCardInstitutionMeta(card) {
  const allMeta = PATRIMONIO_INSTITUTION_META || {};
  if (!card) return { key: 'outra', meta: allMeta.outra || { label: 'Outra', short: '•', className: 'bank-outra' } };
  const rawVisualId = String(card.visualId || '').trim();
  let key = '';
  if (rawVisualId.startsWith('institution:')) key = rawVisualId.slice(12);
  else if (Object.prototype.hasOwnProperty.call(allMeta, rawVisualId)) key = rawVisualId;
  if (!key) {
    const cardLookup = normalizeLegacyLookup(card.name || '');
    const found = Object.entries(allMeta).find(([metaKey, meta]) => (
      normalizeLegacyLookup(metaKey) === cardLookup
      || normalizeLegacyLookup(meta?.label || '') === cardLookup
    ));
    if (found) key = found[0];
  }
  const meta = allMeta[key] || allMeta.outra || { label: 'Outra', short: '•', className: 'bank-outra' };
  return { key: key || 'outra', meta };
}

function renderUnifiedCardLabel(card, fallbackName = 'Cartão') {
  const name = String(card?.name || fallbackName || 'Cartão').trim() || 'Cartão';
  const { meta } = getUnifiedCardInstitutionMeta(card);
  const short = String(meta?.short || '•').trim() || '•';
  const className = String(meta?.className || 'bank-outra').trim() || 'bank-outra';
  return `<span class="unified-card-inline-label"><span class="smart-icon-badge smart-bank-badge ${className}" aria-hidden="true">${escapeHtml(short)}</span><span>${escapeHtml(name)}</span></span>`;
}

function getUnifiedOutflowVisualLabel(visualId) {
  const raw = String(visualId || '').trim();
  if (!raw) return 'Sem visual';
  if (raw.startsWith('account:')) {
    const account = getPatrimonioAccountById(raw.slice(8));
    return account ? `Conta • ${account.nome}` : 'Conta do patrimônio';
  }
  if (raw.startsWith('institution:')) {
    const key = raw.slice(12);
    return PATRIMONIO_INSTITUTION_META[key]?.label || 'Instituição';
  }
  return PATRIMONIO_INSTITUTION_META[raw]?.label || 'Visual';
}

function getUnifiedSharedNoteHtml(item) {
  if (!(item?.sharedExpense === true)) return '';
  const othersAmount = Math.max(0, Number(item?.sharedOthersAmount || 0) || 0);
  return `<span class="unified-shared-inline-note">Compra dividida: ${fmt(othersAmount)}</span>`;
}

function getUnifiedOutflowCategories(month) {
  const categories = new Set();
  const defaultCategories = Array.isArray(window.SYSTEM_DEFAULT_CATEGORY_PRESETS)
    ? window.SYSTEM_DEFAULT_CATEGORY_PRESETS.map(item => resolveCategoryName(item?.name || 'OUTROS'))
    : ['MORADIA', 'SERVIÇOS', 'ALIMENTAÇÃO', 'TRANSPORTE', 'COMPRAS', 'SAÚDE', 'LAZER', 'EDUCAÇÃO', 'FINANCEIRO', 'ASSINATURAS', 'TRABALHO', 'OUTROS'].map(resolveCategoryName);
  defaultCategories.forEach(cat => categories.add(cat));
  getAllCategories(month).forEach(cat => categories.add(resolveCategoryName(cat)));
  (month?.outflows || []).forEach(item => categories.add(resolveCategoryName(item.category || 'OUTROS')));
  (month?.gastosVar || []).forEach(item => categories.add(resolveCategoryName(item?.categoria || 'OUTROS')));
  (month?.despesas || []).forEach(item => categories.add(resolveCategoryName(item?.categoria || 'OUTROS')));
  (month?.dailyCategorySeeds || []).forEach(cat => categories.add(resolveCategoryName(cat || 'OUTROS')));
  Object.keys(month?.dailyGoals || {}).forEach(cat => categories.add(resolveCategoryName(cat || 'OUTROS')));
  return Array.from(categories)
    .filter(cat => !['DESPESA FIXA', 'DESPESA VARIÁVEL', 'DESPESA'].includes(cat))
    .filter(cat => !(typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(cat)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function getUsedDailyGoalCategoriesFromMonth(month) {
  const categories = new Set();
  (month?.outflows || []).forEach(item => {
    if (item?.type !== 'spend') return;
    if (item?.outputKind === 'card') return;
    const normalizedCategory = resolveCategoryName(item?.category || 'OUTROS');
    if (normalizedCategory === 'PIX' || normalizedCategory === 'DÉBITO' || normalizedCategory === 'DEBITO' || normalizedCategory === 'DINHEIRO') return;
    if (!(getUnifiedEffectiveOutflowAmount(item) > 0)) return;
    categories.add(normalizedCategory);
  });
  return Array.from(categories).filter(Boolean);
}

function ensureInheritedDailyGoalCategories(month) {
  if (!month?.id) return false;
  const prev = getPreviousMonthFor(month);
  if (!prev) return false;
  const inherited = getUsedDailyGoalCategoriesFromMonth(prev);
  const currentSpendCategories = getUsedDailyGoalCategoriesFromMonth(month);
  const expectedSeeds = Array.from(new Set([
    ...inherited,
    ...currentSpendCategories
  ]));
  if (!Array.isArray(month.dailyCategorySeeds)) month.dailyCategorySeeds = [];
  const currentNormalized = Array.from(new Set(month.dailyCategorySeeds.map(cat => resolveCategoryName(cat || 'OUTROS')).filter(Boolean)));
  const expectedNormalized = expectedSeeds.map(cat => resolveCategoryName(cat || 'OUTROS')).filter(Boolean);
  const hasSameLength = currentNormalized.length === expectedNormalized.length;
  const hasSameValues = hasSameLength && currentNormalized.every((cat, idx) => cat === expectedNormalized[idx]);
  if (hasSameValues) return false;
  month.dailyCategorySeeds = expectedNormalized;
  return true;
}

function ensureInheritedDailyGoalCategoriesAcrossData() {
  if (inheritedDailyGoalCategoriesSweepDone) return false;
  if (!Array.isArray(data) || data.length < 2) {
    inheritedDailyGoalCategoriesSweepDone = true;
    return false;
  }
  const orderedMonths = data
    .filter(Boolean)
    .slice()
    .sort((a, b) => getMonthSortValue(a) - getMonthSortValue(b));
  let changed = false;
  for (let idx = 1; idx < orderedMonths.length; idx += 1) {
    const month = orderedMonths[idx];
    if (!month) continue;
    const alreadyOnCurrentVersion = Number(month?.dailyCategorySeedSweepVersion || 0) >= INHERITED_DAILY_GOAL_SWEEP_VERSION;
    if (alreadyOnCurrentVersion) continue;
    if (ensureInheritedDailyGoalCategories(month)) {
      changed = true;
      if (isUnifiedMonthPilotEnabled()) {
        syncUnifiedOutflowLegacyData(month);
      }
    }
    month.dailyCategorySeedSweepVersion = INHERITED_DAILY_GOAL_SWEEP_VERSION;
    changed = true;
  }
  inheritedDailyGoalCategoriesSweepDone = true;
  if (changed) save();
  return changed;
}

function renderUnifiedOutflowCategorySuggestionList(term = '') {
  const list = document.getElementById('unifiedOutflowCategorySuggestions');
  if (!list) return;
  const month = getCurrentMonth();
  const monthCategories = getUnifiedOutflowCategories(month);
  const typedSuggestions = typeof getCategorySuggestions === 'function'
    ? getCategorySuggestions(term, 20)
    : [];
  const suggestions = String(term || '').trim()
    ? Array.from(new Set([].concat(typedSuggestions, monthCategories)))
    : monthCategories;
  list.innerHTML = suggestions
    .filter(category => !(typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(category)))
    .map(category => `<option value="${escapeHtml(category)}"></option>`)
    .join('');
}

function getUnifiedOutflowOutputOptions(month, selectedValue = '') {
  const options = [
    { value: 'method:boleto', label: 'Boleto' },
    { value: 'method:dinheiro', label: 'Dinheiro' },
    { value: 'method:pix', label: 'Pix' },
    { value: 'method:debito', label: 'Débito' }
  ];
  (month?.outflowCards || []).forEach(card => {
    options.push({ value: `card:${card.id}`, label: `Cartão • ${card.name}` });
  });
  return options.map(option => `<option value="${option.value}" ${selectedValue === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
}

function parseUnifiedOutflowOutputValue(value) {
  const raw = String(value || '').trim();
  if (raw.startsWith('card:')) return { outputKind: 'card', outputMethod: '', outputRef: raw.slice(5) };
  if (raw.startsWith('account:')) return { outputKind: 'account', outputMethod: '', outputRef: raw.slice(8) };
  const method = raw.startsWith('method:') ? raw.slice(7) : 'boleto';
  return { outputKind: 'method', outputMethod: method, outputRef: '' };
}

function isComparableDailyGoalSpend(item) {
  return item?.type === 'spend' && item?.recurringSpend !== true;
}

function pruneDailyGoalsWithoutSpendValue(month) {
  if (!month || !month.dailyGoals || typeof month.dailyGoals !== 'object') return false;
  const totalsByCategory = new Map();
  (month.outflows || []).forEach(item => {
    if (!isComparableDailyGoalSpend(item)) return;
    const category = resolveCategoryName(item?.category || 'OUTROS');
    totalsByCategory.set(category, Number(totalsByCategory.get(category) || 0) + getUnifiedEffectiveOutflowAmount(item));
  });
  let changed = false;
  Object.keys(month.dailyGoals).forEach(categoryKey => {
    const normalizedCategory = resolveCategoryName(categoryKey || 'OUTROS');
    const spent = Number(totalsByCategory.get(normalizedCategory) || 0);
    if (!(spent > 0)) {
      delete month.dailyGoals[categoryKey];
      changed = true;
      return;
    }
    const goal = Number(month.dailyGoals[categoryKey] || 0);
    if (!(goal > 0)) {
      delete month.dailyGoals[categoryKey];
      changed = true;
    }
  });
  return changed;
}

function syncUnifiedOutflowLegacyData(month) {
  if (!month) return;
  const fixedItems = (month.outflows || []).filter(item => isUnifiedExpenseType(item));
  const spendItems = (month.outflows || []).filter(item => item.type === 'spend');
  month.despesas = [
    ...fixedItems.map(item => ({
      id: item.id,
      nome: item.description,
      valor: Number(item.amount || 0),
      categoria: resolveCategoryName(item.category || 'OUTROS'),
      data: item.date || '',
      pago: item.paid === true,
      paymentMethod: item.outputKind === 'method' ? item.outputMethod : (item.outputKind === 'card' ? 'credito' : item.outputKind),
      pertenceAoCartao: item.belongsToCard === true,
      cartaoId: item.outputKind === 'card' ? item.outputRef : '',
      entraNaSomatoriaPrincipal: item.countsInPrimaryTotals !== false
    })),
    ...((month.cardBills || []).map(bill => {
      const card = (month.outflowCards || []).find(entry => entry.id === bill.cardId);
      return {
        id: bill.id,
        nome: card ? card.name : 'Cartão',
        valor: getUnifiedCardBillEffectiveAmount(month, bill),
        categoria: 'CARTÃO',
        data: '',
        pago: bill.paid === true,
        paymentMethod: 'credito',
        entraNaSomatoriaPrincipal: true
      };
    }))
  ];
  month.gastosVar = spendItems.map(item => ({
    id: item.id,
    titulo: item.description,
    valor: Number(item.amount || 0),
    data: item.date || '',
    categoria: resolveCategoryName(item.category || 'OUTROS'),
    incluirNoTotal: !(item.outputKind === 'card') && item.countsInPrimaryTotals !== false,
    paymentMethod: item.outputKind === 'method' ? item.outputMethod : (item.outputKind === 'card' ? 'credito' : item.outputKind)
  }));
  month.categorias = month.categorias && typeof month.categorias === 'object' ? month.categorias : {};
  month.dailyCategorySeeds = Array.from(new Set([
    ...(Array.isArray(month.dailyCategorySeeds) ? month.dailyCategorySeeds : []),
    ...spendItems.map(item => resolveCategoryName(item.category || 'OUTROS'))
  ]));
  pruneDailyGoalsWithoutSpendValue(month);
  recalcTotals(month);
}

function ensureUnifiedOutflowPilotMonth(month) {
  if (!month) return;
  let defaultsChanged = false;
  if (harmonizeRecurringIncomeReceiveDays(month)) defaultsChanged = true;
  month.unifiedOutflowUi = month.unifiedOutflowUi && typeof month.unifiedOutflowUi === 'object' ? month.unifiedOutflowUi : {};
  if (month._unifiedOutflowMigratedVersion !== UNIFIED_OUTFLOW_GLOBAL_MIGRATION_VERSION) {
    migrateUnifiedOutflowMonth(month);
    month.cardBills = reconcileUnifiedCardBillsWithCards(month, month.cardBills || []);
    syncUnifiedOutflowLegacyData(month);
  } else {
    month.outflowCards = (Array.isArray(month.outflowCards) ? month.outflowCards : []).map(normalizeUnifiedCard);
    month.outflows = (Array.isArray(month.outflows) ? month.outflows : []).map((item, idx) => normalizeUnifiedOutflowItem(item, idx));
    month.cardBills = reconcileUnifiedCardBillsWithCards(month, month.cardBills || []);
  }
  (month.outflows || []).forEach(item => {
    const isDirectMethod = item?.outputKind === 'method' && ['pix', 'dinheiro', 'debito'].includes(item?.outputMethod);
    const hasExplicitPaidFlag = item && Object.prototype.hasOwnProperty.call(item, 'paid') && typeof item.paid === 'boolean';
    if (isDirectMethod && !hasExplicitPaidFlag) {
      item.paid = true;
      defaultsChanged = true;
    }
  });
  if (syncUnifiedCardBillForecastAmounts(month)) {
    defaultsChanged = true;
  }
  if (defaultsChanged) {
    syncUnifiedOutflowLegacyData(month);
  }
}

function getUnifiedCardBill(month, cardId) {
  if (window.MesAtualCards?.getUnifiedCardBill) {
    return window.MesAtualCards.getUnifiedCardBill(month, cardId);
  }
  ensureUnifiedOutflowPilotMonth(month);
  return (month.cardBills || []).find(bill => bill.cardId === cardId) || null;
}

function getUnifiedCardRecurringForecastAmount(month, cardId) {
  if (!month) return 0;
  return (month.outflows || []).reduce((acc, item) => {
    if (item?.outputKind !== 'card' || item?.outputRef !== cardId) return acc;
    if (item?.recurringSpend !== true) return acc;
    return acc + getUnifiedEffectiveOutflowAmount(item);
  }, 0);
}

function syncUnifiedCardBillForecastAmounts(month) {
  if (!month || !Array.isArray(month.cardBills)) return false;
  let changed = false;
  month.cardBills.forEach(bill => {
    if (!bill || bill.manualAmountSet === true) return;
    const forecastAmount = Number(getUnifiedCardRecurringForecastAmount(month, bill.cardId) || 0);
    if (!Number.isFinite(forecastAmount)) return;
    const normalizedForecast = Number(forecastAmount.toFixed(2));
    const currentForecast = Number(Number(bill.forecastAmount || 0).toFixed(2));
    if (bill.amount !== 0) {
      bill.amount = 0;
      changed = true;
    }
    if (normalizedForecast === currentForecast && bill.source === 'forecast') return;
    bill.forecastAmount = normalizedForecast;
    bill.source = 'forecast';
    changed = true;
  });
  return changed;
}

function diagnoseSuspiciousUnifiedCardBills(months = data) {
  const currentRealSort = getMonthSortValue({ id: getCurrentRealMonthId(true) });
  const findings = [];
  (months || []).forEach(month => {
    const monthSort = getMonthSortValue(month || {});
    const isPastOrCurrent = monthSort <= currentRealSort;
    (month?.cardBills || []).forEach(bill => {
      if (!bill) return;
      const amount = Math.max(0, Number(bill.amount || 0) || 0);
      const forecast = Math.max(0, Number(getUnifiedCardRecurringForecastAmount(month, bill.cardId) || bill.forecastAmount || 0) || 0);
      const reasons = [];
      if (isPastOrCurrent && amount === 0) reasons.push('past_or_current_bill_zero');
      if (isPastOrCurrent && bill.manualAmountSet !== true) reasons.push('past_or_current_without_authoritative_flag');
      if (isPastOrCurrent && forecast > 0 && Number(amount.toFixed(2)) === Number(forecast.toFixed(2)) && bill.manualAmountSet !== true) {
        reasons.push('matches_recurring_forecast_without_manual_flag');
      }
      if (!reasons.length) return;
      findings.push({
        monthId: month.id || '',
        monthName: month.nome || '',
        cardId: bill.cardId || '',
        billId: bill.id || '',
        amount,
        forecastAmount: forecast,
        manualAmountSet: bill.manualAmountSet === true,
        source: bill.source || '',
        reasons
      });
    });
  });
  return findings;
}

function getUnifiedCardLaunchesAmount(month, cardId) {
  if (window.MesAtualCards?.getUnifiedCardLaunchesAmount) {
    return window.MesAtualCards.getUnifiedCardLaunchesAmount(month, cardId);
  }
  ensureUnifiedOutflowPilotMonth(month);
  return (month.outflows || []).reduce((acc, item) => {
    if (item?.outputKind !== 'card' || item?.outputRef !== cardId) return acc;
    return acc + getUnifiedEffectiveOutflowAmount(item);
  }, 0);
}

function getUnifiedRecurringSpendPlannedTotal(month) {
  if (window.MesAtualTotals?.getUnifiedRecurringSpendPlannedTotal) {
    return window.MesAtualTotals.getUnifiedRecurringSpendPlannedTotal(month);
  }
  ensureUnifiedOutflowPilotMonth(month);
  return (month.outflows || []).reduce((acc, item) => {
    if (item?.type !== 'spend') return acc;
    if (item?.recurringSpend !== true) return acc;
    // Regra de planejamento: não somar fatura/cartão diretamente.
    // Entram apenas gastos recorrentes vinculados a cartão.
    if (item?.outputKind !== 'card') return acc;
    return acc + getUnifiedEffectiveOutflowAmount(item);
  }, 0);
}

function getUnifiedMonthPilotMetrics(month) {
  ensureUnifiedOutflowPilotMonth(month);
  const totals = getEffectiveTotalsForMes(month);
  const totalIncome = Number(totals.rendaFixa || 0) + Number(totals.totalProj || 0);
  const totalGoals = Number(totals.totalFinancialGoals || 0);
  const selectedDespesas = getSelectedDespesas(month);
  const outflowById = new Map((month.outflows || []).map(item => [String(item.id || ''), item]));
  const selectedDespesaIds = new Set(
    (selectedDespesas || []).map(item => String(item?.id || '').trim()).filter(Boolean)
  );
  const normalizeCategoryKey = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  const isCardCategory = (value) => {
    const normalized = normalizeCategoryKey(value);
    return normalized === 'CARTAO'
      || normalized === 'CARTAO DE CREDITO'
      || normalized.includes('CARTAO');
  };
  const isFixedOrBillDespesa = (item) => {
    const category = resolveCategoryName(item?.categoria || '');
    if (isCardCategory(category)) return true;
    const sourceOutflow = outflowById.get(String(item?.id || ''));
    if (!sourceOutflow) return true;
    return isUnifiedExpenseType(sourceOutflow);
  };
  const fixedPlannedTotal = (month.outflows || []).reduce((acc, item) => {
    if (!isUnifiedExpenseType(item)) return acc;
    if (item?.outputKind === 'card') return acc;
    if (item?.countsInPrimaryTotals === false) return acc;
    const id = String(item?.id || '').trim();
    if (selectedDespesaIds.size > 0 && id && !selectedDespesaIds.has(id)) return acc;
    return acc + getUnifiedEffectiveOutflowAmount(item);
  }, 0);
  const fixedDoneTotal = selectedDespesas.reduce((acc, item) => {
    if (!isFixedOrBillDespesa(item)) return acc;
    const category = resolveCategoryName(item?.categoria || '');
    if (isCardCategory(category)) return acc + Number(item?.valor || 0);
    const sourceOutflow = outflowById.get(String(item?.id || ''));
    const isDirectMethodFixed = isUnifiedExpenseType(sourceOutflow)
      && sourceOutflow?.outputKind === 'method'
      && ['pix', 'dinheiro', 'debito'].includes(String(sourceOutflow?.outputMethod || ''));
    if (isDirectMethodFixed && sourceOutflow?.paid !== true) return acc;
    return acc + Number(item?.valor || 0);
  }, 0);
  const cardBillsTotal = (month.cardBills || []).reduce((acc, bill) => {
    const id = String(bill?.id || '').trim();
    if (selectedDespesaIds.size > 0 && id && !selectedDespesaIds.has(id)) return acc;
    return acc + Number(getUnifiedCardBillEffectiveAmount(month, bill) || 0);
  }, 0);
  const dailyGoalTarget = Number(getDailyGoalTarget(month) || 0);
  const spendsDoneOutsideCard = (month.outflows || []).reduce((acc, item) => {
    if (item.type !== 'spend' || item.status !== 'done') return acc;
    if (item.outputKind === 'card') return acc;
    if (item.countsInPrimaryTotals === false) return acc;
    if (item.outputKind === 'method' && ['pix', 'dinheiro', 'debito'].includes(item.outputMethod) && item.paid !== true) return acc;
    return acc + getUnifiedEffectiveOutflowAmount(item);
  }, 0);
  const recurringSpendPlannedTotal = getUnifiedRecurringSpendPlannedTotal(month);
  // Regra autoritativa:
  // Despesas planejadas = despesas/compromissos não-cartão + metas financeiras + metas estabelecidas.
  // Faturas/cartões nunca entram nesta métrica.
  const plannedExpenses = fixedPlannedTotal + totalGoals + dailyGoalTarget;
  const doneExpenses = fixedDoneTotal + totalGoals + spendsDoneOutsideCard;
  const paidFixedAndBills = selectedDespesas.reduce((acc, item) => {
    const category = resolveCategoryName(item?.categoria || '');
    return acc + (item?.pago === true && isFixedOrBillDespesa(item) ? Number(item.valor || 0) : 0);
  }, 0);
  const paidOut = paidFixedAndBills
    + (month.outflows || []).reduce((acc, item) => {
      if (item.type !== 'spend' || item.status !== 'done') return acc;
      if (item.outputKind === 'card') return acc;
      if (item.countsInPrimaryTotals === false) return acc;
      if (item.paid !== true) return acc;
      if (item.outputKind === 'account') return acc + getUnifiedEffectiveOutflowAmount(item);
      if (item.outputKind === 'method' && ['boleto', 'dinheiro', 'pix', 'debito'].includes(item.outputMethod)) return acc + getUnifiedEffectiveOutflowAmount(item);
      return acc;
    }, 0);
  return {
    totalIncome,
    totalGoals,
    dailyGoalTarget,
    fixedTotal: fixedPlannedTotal,
    fixedDoneTotal,
    cardBillsTotal,
    spendsDoneOutsideCard,
    recurringSpendPlannedTotal,
    plannedExpenses,
    doneExpenses,
    paidOut
  };
}

function getUnifiedOutflowFilterValue(month) {
  const currentRaw = String(month?.unifiedOutflowUi?.filter || 'expense');
  const current = currentRaw === 'fixed' ? 'expense' : currentRaw;
  if (current.startsWith('tag:')) {
    const legacyTag = decodeURIComponent(current.slice(4));
    if (month?.unifiedOutflowUi && typeof month.unifiedOutflowUi === 'object') {
      month.unifiedOutflowUi.filter = 'all';
      month.unifiedOutflowUi.tagFilter = legacyTag;
    }
    return 'all';
  }
  const allowed = new Set(getUnifiedOutflowFilterOptions(month).map(option => String(option.value || '')));
  if (allowed.has(current)) return current;
  if (month?.unifiedOutflowUi && typeof month.unifiedOutflowUi === 'object') {
    month.unifiedOutflowUi.filter = 'expense';
  }
  return 'expense';
}

function getUnifiedOutflowTagFilterValue(month) {
  const current = String(month?.unifiedOutflowUi?.tagFilter || '').trim();
  const allowed = new Set(getUnifiedOutflowTagFilterOptions(month));
  if (!current || allowed.has(current)) return current;
  if (month?.unifiedOutflowUi && typeof month.unifiedOutflowUi === 'object') {
    month.unifiedOutflowUi.tagFilter = '';
  }
  return '';
}

function renderUnifiedMonthSummary(month, filterValue, rows) {
  const metrics = getUnifiedMonthPilotMetrics(month);
  const countOutflows = rows.filter(row => row.kind === 'outflow').length;
  const countBills = rows.filter(row => row.kind === 'bill').length;
  if (filterValue === 'expense') {
    const fixedOutflows = rows.filter(row => row.kind === 'outflow').map(row => row.item);
    const bills = rows.filter(row => row.kind === 'bill').map(row => row.item);
    const total = fixedOutflows.reduce((acc, item) => acc + getUnifiedEffectiveOutflowAmount(item), 0) + bills.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const paid = fixedOutflows.filter(item => item.paid).reduce((acc, item) => acc + getUnifiedEffectiveOutflowAmount(item), 0) + bills.filter(item => item.paid).reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const pending = Math.max(0, total - paid);
    return `<div class="unified-summary"><div class="unified-summary-head"><div><div class="unified-summary-title">Compromissos do mês</div><div class="unified-summary-text">Veja o que precisa ser cobrado neste mês e o que já foi marcado como pago.</div></div></div><div class="unified-summary-grid">${renderUnifiedSummaryCard('Total previsto', fmt(total), `${fixedOutflows.length + bills.length} itens nesta visão`)}${renderUnifiedSummaryCard('Já pago', fmt(paid), 'Valores já marcados como quitados', paid > 0 ? 'positive' : '')}${renderUnifiedSummaryCard('Ainda pendente', fmt(pending), 'Valor restante nesta aba', pending > 0 ? 'warning' : 'positive')}</div></div>`;
  }
  if (filterValue === 'spend') {
    const total = rows
      .filter(row => row.kind === 'outflow' && isComparableDailyGoalSpend(row.item))
      .reduce((acc, row) => acc + getUnifiedEffectiveOutflowAmount(row.item), 0);
    const target = Number(getDailyGoalTarget(month) || 0);
    const remaining = target - total;
    return `<div class="unified-summary"><div class="unified-summary-head"><div><div class="unified-summary-title">Consumo por categoria</div><div class="unified-summary-text">Acompanhe o que já foi gasto por categoria e quanto ainda cabe dentro da meta planejada.</div></div></div><div class="unified-summary-grid">${renderUnifiedSummaryCard('Total gasto', fmt(total), `${countOutflows} lançamentos nesta visão`, total > 0 ? 'negative' : '')}${renderUnifiedSummaryCard('Meta planejada', target > 0 ? fmt(target) : '—', 'Soma das metas das categorias')}${renderUnifiedSummaryCard(remaining >= 0 ? 'Ainda resta' : 'Ultrapassou', fmt(Math.abs(remaining)), remaining >= 0 ? 'Espaço restante dentro da meta' : 'Valor acima da meta', remaining >= 0 ? 'positive' : 'negative')}</div></div>`;
  }
  if (filterValue.startsWith('card:')) {
    const cardId = filterValue.slice(5);
    const card = (month.outflowCards || []).find(entry => entry.id === cardId);
    const total = rows.filter(row => row.kind === 'outflow').reduce((acc, row) => acc + getUnifiedEffectiveOutflowAmount(row.item), 0);
    const bill = (month.cardBills || []).find(entry => entry.cardId === cardId);
    const billAmount = getUnifiedCardBillEffectiveAmount(month, bill);
    return `<div class="unified-summary"><div class="unified-summary-head"><div><div class="unified-summary-title">${escapeHtml(card?.name || 'Cartão')}</div><div class="unified-summary-text">Aqui você vê o consumo lançado nesse cartão por categoria. A fatura mensal continua sendo controlada separadamente.</div></div></div><div class="unified-summary-grid">${renderUnifiedSummaryCard('Total lançado', fmt(total), `${countOutflows} lançamentos neste cartão`, total > 0 ? 'negative' : '')}${renderUnifiedSummaryCard('Fechamento', card ? getUnifiedCardClosingDateLabel(month, card) : '—', 'Data de fechamento do cartão')}${renderUnifiedSummaryCard('Fatura do mês', fmt(billAmount), card ? `Pagamento ${getUnifiedCardPaymentDateLabel(month, card)}` : 'Sem data definida', bill?.paid ? 'positive' : 'warning')}</div></div>`;
  }
  if (filterValue.startsWith('account:') || filterValue.startsWith('method:')) {
    const total = rows.filter(row => row.kind === 'outflow').reduce((acc, row) => acc + getUnifiedEffectiveOutflowAmount(row.item), 0);
    const fixedCount = rows.filter(row => row.kind === 'outflow' && isUnifiedExpenseType(row.item)).length;
    const spendCount = rows.filter(row => row.kind === 'outflow' && row.item.type === 'spend').length;
    const title = filterValue.startsWith('account:')
      ? 'Saídas por conta'
      : String(filterValue.split(':')[1] || 'Saída').replace(/^./, c => c.toUpperCase());
    return `<div class="unified-summary"><div class="unified-summary-head"><div><div class="unified-summary-title">${escapeHtml(title)}</div><div class="unified-summary-text">Visualize tudo o que passou por esse meio de saída, sem misturar com o restante do mês.</div></div></div><div class="unified-summary-grid">${renderUnifiedSummaryCard('Total nesta visão', fmt(total), `${countOutflows + countBills} itens filtrados`, total > 0 ? 'negative' : '')}${renderUnifiedSummaryCard('Despesas', String(fixedCount), 'Compromissos nessa saída')}${renderUnifiedSummaryCard('Gastos', String(spendCount), 'Lançamentos de consumo nessa saída')}</div></div>`;
  }
  const allTotal = rows.filter(row => row.kind === 'outflow').reduce((acc, row) => acc + getUnifiedEffectiveOutflowAmount(row.item), 0);
  return `<div class="unified-summary"><div class="unified-summary-head"><div><div class="unified-summary-title">Visão geral das saídas</div><div class="unified-summary-text">Use esta aba para ver o mês inteiro junto. Se quiser mais clareza, troque o filtro para compromissos ou consumo.</div></div></div><div class="unified-summary-grid">${renderUnifiedSummaryCard('Total na lista', fmt(allTotal), `${countOutflows + countBills} itens nesta visão`, allTotal > 0 ? 'negative' : '')}${renderUnifiedSummaryCard('Despesas planejadas', fmt(metrics.plannedExpenses), 'Compromissos e metas do mês')}${renderUnifiedSummaryCard('Lançamentos', String(countOutflows + countBills), 'Itens que compõem esta visão')}</div></div>`;
}

function isUnifiedOutflowCategoryExpanded(month, category) {
  return !!unifiedOutflowExpandedCategories[`${getUnifiedOutflowPilotKey(month)}::${category}`];
}

function ensureUnifiedSpendCategorySelectionState(month, categories = []) {
  if (!month) return {};
  const ui = month.unifiedOutflowUi && typeof month.unifiedOutflowUi === 'object'
    ? month.unifiedOutflowUi
    : (month.unifiedOutflowUi = {});
  const current = ui.spendCategorySelection && typeof ui.spendCategorySelection === 'object'
    ? { ...ui.spendCategorySelection }
    : {};
  categories.forEach(category => {
    const key = resolveCategoryName(category || 'OUTROS');
    if (!Object.prototype.hasOwnProperty.call(current, key)) current[key] = true;
  });
  ui.spendCategorySelection = current;
  return current;
}

function isUnifiedSpendCategorySelected(month, category) {
  const normalized = resolveCategoryName(category || 'OUTROS');
  const state = ensureUnifiedSpendCategorySelectionState(month, [normalized]);
  return state[normalized] !== false;
}

function getUnifiedCardBillingDateLabel(month, card) {
  return getUnifiedCardPaymentDateLabel(month, card);
}

function getUnifiedFixedSelectionIndex(month, row) {
  const list = Array.isArray(month?.despesas) ? month.despesas : [];
  if (!row?.item?.id) return -1;
  return list.findIndex(item => item?.id === row.item.id);
}

function isUnifiedDirectMethodSummaryRow(row) {
  const item = row?.item;
  return row?.kind === 'outflow'
    && item?.outputKind === 'method'
    && !isUnifiedExpenseType(item)
    && ['pix', 'dinheiro', 'debito'].includes(item?.outputMethod);
}

function getUnifiedDirectMethodCategoryLabel(month, item) {
  const fallback = getUnifiedOutflowPaymentLabel(item, month) || 'OUTROS';
  return resolveCategoryName(item?.category || fallback);
}

function getUnifiedDirectMethodGroupDisplay(method) {
  const normalized = String(method || '').toLowerCase();
  if (normalized === 'pix') return 'PIX';
  if (normalized === 'dinheiro') return 'DINHEIRO';
  if (normalized === 'debito') return 'DEBITO';
  return String(getUnifiedOutflowPaymentLabel({ outputKind: 'method', outputMethod: method }, getCurrentMonth()) || method || 'SAÍDA').toUpperCase();
}

function getUnifiedDirectMethodGroupBadge(method) {
  const normalized = String(method || '').toLowerCase();
  const iconName = normalized === 'pix'
    ? 'pix'
    : normalized === 'debito'
    ? 'debit'
    : normalized === 'dinheiro'
    ? 'money'
    : 'cash';
  if (typeof renderSmartIconBadge === 'function') {
    return renderSmartIconBadge(iconName, 'info');
  }
  return '';
}

function renderUnifiedFixedRows(month, rows) {
  const groupedDirectMethods = new Map();
  const regularRows = [];
  rows.forEach(row => {
    if (!isUnifiedDirectMethodSummaryRow(row)) {
      regularRows.push(row);
      return;
    }
    const method = String(row.item?.outputMethod || '').toLowerCase();
    const category = method ? String(method).toUpperCase() : getUnifiedDirectMethodCategoryLabel(month, row.item);
    const groupKey = method ? `method::${method}` : `category::${category}`;
    if (!groupedDirectMethods.has(groupKey)) {
      groupedDirectMethods.set(groupKey, {
        kind: 'methodGroup',
        item: {
          id: `method_group_${groupKey.toLowerCase().replace(/[^a-z0-9:]+/g, '_')}`,
          groupKey,
          category,
          categoryDisplay: method ? getUnifiedDirectMethodGroupDisplay(method) : category,
          amount: 0,
          paid: false,
          included: true,
          methods: new Set(),
          rows: []
        }
      });
    }
    const groupRow = groupedDirectMethods.get(groupKey);
    groupRow.item.amount += getUnifiedEffectiveOutflowAmount(row.item);
    groupRow.item.paid = groupRow.item.paid || row.item?.paid === true;
    groupRow.item.included = groupRow.item.included && row.item?.countsInPrimaryTotals !== false;
    groupRow.item.methods.add(String(getUnifiedOutflowPaymentLabel(row.item, month) || '').toUpperCase());
    groupRow.item.rows.push(row);
  });
  const groupedRows = [
    ...regularRows,
    ...Array.from(groupedDirectMethods.values()).map(row => ({
      ...row,
      item: {
        ...row.item,
        methods: Array.from(row.item.methods)
      }
    }))
  ];
  const sort = getUnifiedOutflowSort(month);
  const field = sort.field || 'data';
  const direction = sort.direction === 'asc' ? 1 : -1;
  const sortedRows = groupedRows.sort((a, b) => {
    const labelA = a.kind === 'bill'
      ? ((month.outflowCards || []).find(entry => entry.id === a.item.cardId)?.name || 'Cartão')
      : a.kind === 'methodGroup'
      ? String(a.item.category || '')
      : String(a.item.description || '');
    const labelB = b.kind === 'bill'
      ? ((month.outflowCards || []).find(entry => entry.id === b.item.cardId)?.name || 'Cartão')
      : b.kind === 'methodGroup'
      ? String(b.item.category || '')
      : String(b.item.description || '');
    if (field === 'descricao') return labelA.localeCompare(labelB, 'pt-BR') * direction;
    if (field === 'categoria') {
      const catA = a.kind === 'methodGroup' ? String(a.item.category || '') : (a.kind === 'bill' ? 'CARTÃO DE CRÉDITO' : String(a.item.category || ''));
      const catB = b.kind === 'methodGroup' ? String(b.item.category || '') : (b.kind === 'bill' ? 'CARTÃO DE CRÉDITO' : String(b.item.category || ''));
      return catA.localeCompare(catB, 'pt-BR') * direction;
    }
    if (field === 'valor') return (getUnifiedEffectiveOutflowAmount(a.item) - getUnifiedEffectiveOutflowAmount(b.item)) * direction;
    if (field === 'pago') {
      const paidA = a.kind === 'bill' ? (a.item?.paid === true ? 1 : 0) : (a.item?.paid === true ? 1 : 0);
      const paidB = b.kind === 'bill' ? (b.item?.paid === true ? 1 : 0) : (b.item?.paid === true ? 1 : 0);
      return (paidA - paidB) * direction;
    }
    const dateA = a.kind === 'bill'
      ? (() => {
        const card = (month.outflowCards || []).find(entry => entry.id === a.item.cardId);
        return parseData(getUnifiedCardPaymentDateLabel(month, card)) || 0;
      })()
      : a.kind === 'methodGroup'
      ? 0
      : (parseData(a.item?.date || '') || 0);
    const dateB = b.kind === 'bill'
      ? (() => {
        const card = (month.outflowCards || []).find(entry => entry.id === b.item.cardId);
        return parseData(getUnifiedCardPaymentDateLabel(month, card)) || 0;
      })()
      : b.kind === 'methodGroup'
      ? 0
      : (parseData(b.item?.date || '') || 0);
    return (dateA - dateB) * direction;
  });
  if (!rows.length) return '<div class="unified-empty-state">Nenhuma saída relevante registrada ainda.</div>';
  const totalSelected = sortedRows.reduce((acc, row) => {
    if (row.kind === 'methodGroup') return acc + (row.item?.included !== false ? Number(row.item?.amount || 0) : 0);
    if (row.kind === 'bill') {
      const selectionIdx = getUnifiedFixedSelectionIndex(month, row);
      const selected = selectionIdx === -1
        ? true
        : isDespesaSelected(month.id, selectionIdx);
      return acc + (selected ? getUnifiedCardBillEffectiveAmount(month, row.item) : 0);
    }
    const item = row.item;
    const selectionIdx = getUnifiedFixedSelectionIndex(month, row);
    const selected = selectionIdx === -1
      ? true
      : isDespesaSelected(month.id, selectionIdx);
    return acc + (selected ? getUnifiedEffectiveOutflowAmount(row.item) : 0);
  }, 0);
  const body = sortedRows.map(row => {
    if (row.kind === 'methodGroup') {
      const item = row.item;
      const category = resolveCategoryName(item.category || 'OUTROS');
      const groupKey = String(item.groupKey || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const methodsLabel = Array.isArray(item.methods) && item.methods.length
        ? item.methods.join(' + ')
        : 'PIX / DINHEIRO / DÉBITO';
      const amountLabel = fmt(item.amount);
      return `
        <tr>
          <td style="padding-left:22px"><input type="checkbox" ${item.included !== false ? 'checked' : ''} onchange="toggleUnifiedDirectMethodCategoryIncluded('${groupKey}', this.checked)"></td>
          <td class="unified-outflow-description-cell" style="padding-left:22px">${escapeHtml(methodsLabel)}</td>
          <td>${item.groupKey.startsWith('method::') ? `<span class="category-inline-label">${getUnifiedDirectMethodGroupBadge(String(item.groupKey || '').split('::')[1] || '')}<span>${escapeHtml(item.categoryDisplay || item.category || 'SAÍDA')}</span></span>` : renderCategoryLabel(category)}</td>
          <td></td>
          <td class="amount amount-neg">${amountLabel}</td>
          <td><label class="unified-paid-toggle"><input type="checkbox" ${item.paid ? 'checked' : ''} onchange="toggleUnifiedDirectMethodCategoryPaid('${groupKey}', this.checked)"><span>Pago</span></label></td>
          <td></td>
        </tr>`;
    }
    const selectionIdx = getUnifiedFixedSelectionIndex(month, row);
    const selected = selectionIdx === -1 ? true : isDespesaSelected(month.id, selectionIdx);
    if (row.kind === 'bill') {
      const bill = row.item;
      const card = (month.outflowCards || []).find(entry => entry.id === bill.cardId);
      const cardLaunchesAmount = getUnifiedCardLaunchesAmount(month, bill.cardId);
      const billAmount = getUnifiedCardBillEffectiveAmount(month, bill);
      const billAmountDisplay = `<span title="${escapeHtml(`Valor pelos lançamentos desse cartão: ${fmt(cardLaunchesAmount)}`)}">${fmt(billAmount)}</span>`;
      const selectionControl = selectionIdx === -1
        ? '<input type="checkbox" checked disabled>'
        : `<input type="checkbox" ${selected ? 'checked' : ''} onchange="toggleDespesaSelection(${selectionIdx})">`;
      return `
        <tr>
          <td style="padding-left:22px">${selectionControl}</td>
          <td class="unified-outflow-description-cell" style="padding-left:22px">${renderUnifiedCardLabel(card, 'Cartão')}</td>
          <td>${renderCategoryLabel('CARTÃO DE CRÉDITO')}</td>
          <td>${escapeHtml(getUnifiedCardBillingDateLabel(month, card))}</td>
          ${renderInlineCell({ table:'unifiedCardBill', row:bill.id, field:'amount', kind:'number', value:billAmount, displayValue:billAmountDisplay, className:'amount amount-neg' })}
          <td><label class="unified-paid-toggle"><input type="checkbox" ${bill.paid ? 'checked' : ''} onchange="toggleUnifiedCardBillPaid('${bill.id}', this.checked)"><span>Pago</span></label></td>
          <td><button class="btn-icon" onclick="openUnifiedCardModal('${card?.id || ''}')">✎</button></td>
        </tr>`;
    }
    const item = row.item;
    const linkedCard = item.outputKind === 'card'
      ? (month.outflowCards || []).find(entry => entry.id === item.outputRef)
      : null;
    const descriptionDisplay = `${escapeHtml(item.description)}${getUnifiedSharedNoteHtml(item)}${item.tag ? `<div class="text-muted" style="margin-top:4px;font-size:11px">Tag • ${escapeHtml(item.tag)}</div>` : ''}${linkedCard ? `<div class="text-muted unified-card-reference" style="margin-top:4px;font-size:11px">No cartão • ${renderUnifiedCardLabel(linkedCard, 'Cartão')}</div>` : ''}`;
    const selectionControl = selectionIdx === -1
      ? '<input type="checkbox" checked disabled>'
      : `<input type="checkbox" ${selected ? 'checked' : ''} onchange="toggleDespesaSelection(${selectionIdx})">`;
    const paidCell = `<label class="unified-paid-toggle"><input type="checkbox" ${item.paid ? 'checked' : ''} onchange="toggleUnifiedOutflowPaid('${item.id}', this.checked)"><span>Pago</span></label>`;
    const categoryCell = renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'category', kind:'unified-category', value:item.category, displayValue:renderCategoryLabel(item.category) });
    const dateCell = renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'date', kind:'var-date', value:item.date || '', displayValue:escapeHtml(item.date || '—') });
    return `
      <tr>
        <td style="padding-left:22px">${selectionControl}</td>
        ${renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'description', kind:'text', value:item.description, displayValue:descriptionDisplay, className:'unified-outflow-description-cell', style:'padding-left:22px' })}
        ${categoryCell}
        ${dateCell}
        ${renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'amount', kind:'number', value:item.amount, displayValue:fmt(item.amount), className:'amount amount-neg' })}
        <td>${paidCell}</td>
        <td><button class="btn-icon" onclick="openUnifiedOutflowModal('${item.id}')">✎</button><button class="btn-icon" onclick="deleteUnifiedOutflow('${item.id}')">✕</button></td>
      </tr>`;
  }).join('');
  const metrics = getUnifiedMonthPilotMetrics(month);
  return `<table class="fin-table unified-outflow-table"><thead><tr><th style="padding-left:22px">Somado</th><th style="padding-left:22px" class="sortable" onclick="setUnifiedOutflowSort('descricao')">${renderUnifiedSortLabel(month, 'descricao', 'Descrição')}</th><th class="sortable" onclick="setUnifiedOutflowSort('categoria')">${renderUnifiedSortLabel(month, 'categoria', 'Categoria')}</th><th class="sortable" onclick="setUnifiedOutflowSort('data')">${renderUnifiedSortLabel(month, 'data', 'Data de cobrança')}</th><th class="sortable" onclick="setUnifiedOutflowSort('valor')">${renderUnifiedSortLabel(month, 'valor', 'Valor')}</th><th class="sortable" onclick="setUnifiedOutflowSort('pago')">${renderUnifiedSortLabel(month, 'pago', 'Status')}</th><th></th></tr></thead><tbody>${body}</tbody><tfoot><tr class="totals-row"><td></td><td colspan="3" style="padding-top:12px;padding-bottom:12px">Total do resumo</td><td class="amount amount-neg">${fmt(totalSelected)}</td><td colspan="2" style="text-align:right"><span class="unified-cashout-inline">Já saiu: ${fmt(metrics.paidOut)}</span></td></tr></tfoot></table>`;
}

function toggleUnifiedDirectMethodCategoryPaid(category, checked) {
  const month = getCurrentMonth();
  if (!month) return;
  ensureUnifiedOutflowPilotMonth(month);
  const rows = getUnifiedDirectMethodRowsByGroupKey(month, category);
  if (!rows.length) return;
  recordHistoryState();
  rows.forEach(item => {
    item.paid = checked === true;
    // Preserve an explicit field to prevent defaulting logic from forcing true again.
    if (item.paid !== true) item.status = 'planned';
    if (item.paid === true && item.type === 'spend') item.status = 'done';
  });
  syncUnifiedOutflowLegacyData(month);
  save(true);
  preserveCurrentScroll(() => renderMes());
}

function toggleUnifiedDirectMethodCategoryIncluded(category, checked) {
  const month = getCurrentMonth();
  if (!month) return;
  ensureUnifiedOutflowPilotMonth(month);
  const rows = getUnifiedDirectMethodRowsByGroupKey(month, category);
  if (!rows.length) return;
  recordHistoryState();
  rows.forEach(item => { item.countsInPrimaryTotals = checked === true; });
  syncUnifiedOutflowLegacyData(month);
  save(true);
  preserveCurrentScroll(() => renderMes());
}

function editUnifiedDirectMethodCategoryAmount(category) {
  const month = getCurrentMonth();
  if (!month) return;
  ensureUnifiedOutflowPilotMonth(month);
  const key = String(category || '');
  const normalized = resolveCategoryName(key.replace(/^category::/i, '') || 'OUTROS');
  const rows = getUnifiedDirectMethodRowsByGroupKey(month, category);
  if (!rows.length) return;
  const label = key.startsWith('method::') ? String(key.split('::')[1] || '').toUpperCase() : normalized;
  const currentTotal = rows.reduce((acc, item) => acc + Number(item?.amount || 0), 0);
  const nextValue = prompt(`Novo valor total para ${label}:`, String(Number(currentTotal.toFixed(2))).replace('.', ','));
  if (nextValue === null) return;
  const normalizedValue = String(nextValue).trim();
  const parsed = Number(normalizedValue.includes(',')
    ? normalizedValue.replace(/\./g, '').replace(',', '.')
    : normalizedValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    alert('Informe um valor válido.');
    return;
  }
  recordHistoryState();
  if (currentTotal > 0) {
    const ratio = parsed / currentTotal;
    rows.forEach(item => {
      item.amount = Number((Number(item.amount || 0) * ratio).toFixed(2));
    });
    const adjustedTotal = rows.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const adjustDiff = Number((parsed - adjustedTotal).toFixed(2));
    rows[0].amount = Number((Number(rows[0].amount || 0) + adjustDiff).toFixed(2));
  } else {
    rows[0].amount = Number(parsed.toFixed(2));
    rows.slice(1).forEach(item => { item.amount = 0; });
  }
  syncUnifiedOutflowLegacyData(month);
  save(true);
  preserveCurrentScroll(() => renderMes());
}

function getUnifiedDirectMethodRowsByGroupKey(month, category) {
  const key = String(category || '').trim();
  if (!month || !key) return [];
  const normalizedMethodFromKey = String(key.split('::')[1] || '').trim().toLowerCase();
  const byMethod = key.startsWith('method::')
    ? (month.outflows || []).filter(item =>
        item?.outputKind === 'method'
          && String(item?.outputMethod || '').trim().toLowerCase() === normalizedMethodFromKey
      )
    : [];
  if (byMethod.length) return byMethod;
  const normalizedCategory = resolveCategoryName(key.replace(/^category::/i, '') || 'OUTROS');
  return (month.outflows || []).filter(item =>
    item?.outputKind === 'method'
      && ['pix', 'dinheiro', 'debito'].includes(String(item?.outputMethod || '').trim().toLowerCase())
      && resolveCategoryName(item?.category || getUnifiedOutflowPaymentLabel(item, month) || 'OUTROS') === normalizedCategory
  );
}

function renderUnifiedAllRows(month, rows) {
  const sortedRows = getSortedUnifiedRows(month, rows, 'data', 'desc');
  if (!rows.length) return '<div class="unified-empty-state">Nenhuma saída registrada ainda.</div>';
  const totalWithoutCardDuplication = window.FinancialGuards?.getAllViewTotalWithoutCardDuplication
    ? window.FinancialGuards.getAllViewTotalWithoutCardDuplication(sortedRows)
    : sortedRows.reduce((acc, row) => {
      if (row.kind === 'bill') return acc + getUnifiedCardBillEffectiveAmount(month, row.item);
      if (row.kind === 'outflow' && row.item?.outputKind === 'card') return acc;
      return acc + Number(row.item?.amount || 0);
    }, 0);
  const body = sortedRows.map(row => {
    if (row.kind === 'bill') {
      const bill = row.item;
      const card = (month.outflowCards || []).find(entry => entry.id === bill.cardId);
      const cardLaunchesAmount = getUnifiedCardLaunchesAmount(month, bill.cardId);
      const billAmount = getUnifiedCardBillEffectiveAmount(month, bill);
      const billAmountDisplay = `<span title="${escapeHtml(`Valor pelos lançamentos desse cartão: ${fmt(cardLaunchesAmount)}`)}">${fmt(billAmount)}</span>`;
      return `
        <tr>
          <td style="padding-left:22px">${escapeHtml(getUnifiedCardBillingDateLabel(month, card))}</td>
          <td class="unified-outflow-description-cell">${renderUnifiedCardLabel(card, 'Cartão')}</td>
          <td>${renderCategoryLabel('CARTÃO DE CRÉDITO')}</td>
          <td><span class="unified-kind-chip card">Cartão de crédito</span></td>
          <td>${escapeHtml(card ? `Fecha ${getUnifiedCardClosingDateLabel(month, card)} · paga ${getUnifiedCardPaymentDateLabel(month, card)}` : 'Conta mensal')}</td>
          ${renderInlineCell({ table:'unifiedCardBill', row:bill.id, field:'amount', kind:'number', value:billAmount, displayValue:billAmountDisplay, className:'amount amount-neg' })}
          <td><button class="btn-icon" onclick="openUnifiedCardModal('${card?.id || ''}')">✎</button></td>
        </tr>`;
    }
    const item = row.item;
    const descriptionDisplay = `${escapeHtml(item.description)}${getUnifiedSharedNoteHtml(item)}${item.tag ? `<div class="text-muted" style="margin-top:4px;font-size:11px">Tag • ${escapeHtml(item.tag)}</div>` : ''}`;
    return `
      <tr>
        ${renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'date', kind:'var-date', value:item.date || '', displayValue:escapeHtml(item.date || '—'), style:'padding-left:22px' })}
        ${renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'description', kind:'text', value:item.description, displayValue:descriptionDisplay, className:'unified-outflow-description-cell' })}
        ${renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'category', kind:'unified-category', value:item.category, displayValue:renderCategoryLabel(item.category) })}
        <td><span class="unified-kind-chip ${item.recurringSpend === true ? 'recurring' : (isUnifiedExpenseType(item) ? 'fixed' : 'spend')}">${escapeHtml(getUnifiedOutflowTypeLabel(item))}</span></td>
        ${renderInlineCell({
          table:'unifiedOutflow',
          row:item.id,
          field:'output',
          kind:'unified-output',
          value: item.outputKind === 'method' ? `method:${item.outputMethod}` : `${item.outputKind}:${item.outputRef}`,
          displayValue: item.outputKind === 'card'
            ? renderUnifiedCardLabel((month.outflowCards || []).find(entry => entry.id === item.outputRef), getUnifiedOutflowPaymentLabel(item, month))
            : escapeHtml(getUnifiedOutflowPaymentLabel(item, month))
        })}
        ${renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'amount', kind:'number', value:item.amount, displayValue:fmt(item.amount), className:'amount amount-neg' })}
        <td><button class="btn-icon" onclick="openUnifiedOutflowModal('${item.id}')">✎</button><button class="btn-icon" onclick="deleteUnifiedOutflow('${item.id}')">✕</button></td>
      </tr>`;
  }).join('');
  return `<table class="fin-table unified-outflow-table"><thead><tr><th style="padding-left:22px" class="sortable" onclick="setUnifiedOutflowSort('data')">${renderUnifiedSortLabel(month, 'data', 'Data')}</th><th class="sortable" onclick="setUnifiedOutflowSort('descricao')">${renderUnifiedSortLabel(month, 'descricao', 'Descrição')}</th><th class="sortable" onclick="setUnifiedOutflowSort('categoria')">${renderUnifiedSortLabel(month, 'categoria', 'Categoria')}</th><th class="sortable" onclick="setUnifiedOutflowSort('tipo')">${renderUnifiedSortLabel(month, 'tipo', 'Tipo')}</th><th class="sortable" onclick="setUnifiedOutflowSort('saida')">${renderUnifiedSortLabel(month, 'saida', 'Saída')}</th><th class="sortable" onclick="setUnifiedOutflowSort('valor')">${renderUnifiedSortLabel(month, 'valor', 'Valor')}</th><th></th></tr></thead><tbody>${body}</tbody><tfoot><tr class="totals-row"><td colspan="5" style="padding-left:22px;padding-top:12px;padding-bottom:12px">Total</td><td class="amount amount-neg">${fmt(totalWithoutCardDuplication)}</td><td></td></tr></tfoot></table>`;
}

function renderUnifiedCategoryGroups(month, items, options = {}) {
  const {
    emptyText = 'Nenhum gasto registrado ainda.',
    includePaymentLabel = true,
    totalLabel = 'Total dos gastos',
    forcedCategories = null,
    showCategoryRemove = false,
  } = options;
  const totals = new Map();
  items.forEach(item => {
    const category = resolveCategoryName(item.category || 'OUTROS');
    if (!totals.has(category)) totals.set(category, []);
    totals.get(category).push(item);
  });
  const categories = Array.isArray(forcedCategories) && forcedCategories.length
    ? Array.from(new Set(forcedCategories.map(cat => resolveCategoryName(cat || 'OUTROS'))))
    : Array.from(totals.keys());
  if (!categories.length) return `<div class="unified-empty-state">${emptyText}</div>`;
  ensureUnifiedSpendCategorySelectionState(month, categories);
  const categoryRows = categories.map(category => {
    const categoryItems = totals.get(category) || [];
    const spendItemsInCategory = categoryItems.filter(item => item?.type === 'spend');
    const nonRecurringSpendItemsInCategory = spendItemsInCategory.filter(item => isComparableDailyGoalSpend(item));
    const nonRecurringSpendTotalInCategory = nonRecurringSpendItemsInCategory.reduce((acc, item) => acc + getUnifiedEffectiveOutflowAmount(item), 0);
    const hasSpendInCategory = nonRecurringSpendItemsInCategory.length > 0;
    const hasItems = categoryItems.length > 0;
    const total = categoryItems.reduce((acc, item) => acc + getUnifiedEffectiveOutflowAmount(item), 0);
    const hasConfiguredGoal = month.dailyGoals && Object.prototype.hasOwnProperty.call(month.dailyGoals, category);
    const meta = hasConfiguredGoal ? Number(month.dailyGoals[category] || 0) : null;
    const percentual = meta > 0 ? (total / meta) * 100 : 0;
    const selected = isUnifiedSpendCategorySelected(month, category);
    return { category, categoryItems, hasSpendInCategory, hasItems, total, meta, percentual, nonRecurringSpendTotalInCategory, selected };
  });

  const sort = getUnifiedOutflowSort(month);
  const sortField = sort.field || 'categoria';
  const sortDir = sort.direction === 'asc' ? 'asc' : 'desc';
  const factor = sortDir === 'asc' ? 1 : -1;
  categoryRows.sort((a, b) => {
    if (sortField === 'categoria') return a.category.localeCompare(b.category, 'pt-BR') * factor;
    if (sortField === 'valor') return (a.total - b.total) * factor;
    if (sortField === 'meta') return ((Number(a.meta || 0)) - (Number(b.meta || 0))) * factor;
    if (sortField === 'percentual') return (a.percentual - b.percentual) * factor;
    return a.category.localeCompare(b.category, 'pt-BR');
  });

  const body = categoryRows.map(({ category, categoryItems, hasSpendInCategory, hasItems, total, meta, percentual, nonRecurringSpendTotalInCategory, selected }) => {
    const hasConfiguredGoal = month.dailyGoals && Object.prototype.hasOwnProperty.call(month.dailyGoals, category);
    const editableGoalValue = hasConfiguredGoal ? Number(month.dailyGoals[category] || 0) : '';
    const editableGoalDisplay = hasConfiguredGoal ? fmt(Number(month.dailyGoals[category] || 0)) : fmt(0);
    const metaCell = renderInlineCell({
      table:'daily',
      row:category,
      field:'meta',
      kind:'number',
      value:editableGoalValue,
      displayValue:editableGoalDisplay,
      className:'text-muted'
    });
    const expanded = hasItems && isUnifiedOutflowCategoryExpanded(month, category);
    const list = expanded ? categoryItems.sort((a, b) => parseData(b.date || '') - parseData(a.date || '')).map(item => `
      <tr class="unified-spend-detail-row">
        ${renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'description', kind:'text', value:item.description, displayValue:`${escapeHtml(item.description)}${getUnifiedSharedNoteHtml(item)}${item.tag ? `<div class="text-muted" style="margin-top:4px;font-size:11px">Tag • ${escapeHtml(item.tag)}</div>` : ''}`, className:'unified-outflow-description-cell', style:'padding-left:56px' }).replace('<td class="unified-outflow-description-cell" style="padding-left:56px"', '<td class="unified-outflow-description-cell" colspan="2" style="padding-left:56px"')}
        ${renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'date', kind:'var-date', value:item.date || '', displayValue:escapeHtml(item.date || '—') })}
        ${includePaymentLabel
          ? renderInlineCell({
              table:'unifiedOutflow',
              row:item.id,
              field:'output',
              kind:'unified-output',
              value: item.outputKind === 'method' ? `method:${item.outputMethod}` : `${item.outputKind}:${item.outputRef}`,
              displayValue: item.outputKind === 'card'
                ? renderUnifiedCardLabel((month.outflowCards || []).find(entry => entry.id === item.outputRef), getUnifiedOutflowPaymentLabel(item, month))
                : escapeHtml(getUnifiedOutflowPaymentLabel(item, month))
            })
          : '<td></td>'}
        ${renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'amount', kind:'number', value:item.amount, displayValue:fmt(item.amount), className:'amount amount-neg' })}
        <td><button class="btn-icon" onclick="openUnifiedOutflowModal('${item.id}')">✎</button><button class="btn-icon" onclick="deleteUnifiedOutflow('${item.id}')">✕</button></td>
      </tr>`).join('') : '';
    return `
      <tr>
        <td style="padding-left:22px"><input type="checkbox" ${selected ? 'checked' : ''} onchange="toggleUnifiedSpendCategorySelection('${category.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', this.checked)"></td>
        <td style="padding-left:22px">
          <div class="unified-spend-category-cell">
            <button class="btn-icon unified-expand-btn" ${hasItems ? `onclick="toggleUnifiedOutflowCategory('${category.replace(/'/g, "\\'")}')"` : 'disabled title="Sem lançamentos nesta categoria neste mês"'}>${expanded ? '▾' : '▸'}</button>
            <div ondblclick="renameUnifiedOutflowCategoryGroup('${category.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" title="Clique duas vezes para editar a categoria">${renderCategoryLabel(category)}</div>
          </div>
        </td>
        <td class="amount amount-neg">${fmt(total)}</td>
        ${metaCell}
        <td colspan="2">${meta !== null ? renderDailyGoalProgress(meta, total, percentual) : '<span class="text-muted">—</span>'}</td>
        <td>${showCategoryRemove ? `<button class="btn-icon" onclick="removeUnifiedSpendCategory('${category.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" title="Remover categoria da lista">✕</button>` : ''}</td>
      </tr>
      ${list}`;
  }).join('');
  const selectedCategorySet = new Set(categoryRows.filter(row => row.selected).map(row => row.category));
  const selectedItems = items.filter(item => selectedCategorySet.has(resolveCategoryName(item.category || 'OUTROS')));
  const totalSpent = selectedItems.reduce((acc, item) => acc + getUnifiedEffectiveOutflowAmount(item), 0);
  const totalSpendOnly = selectedItems.reduce((acc, item) => acc + getUnifiedEffectiveOutflowAmount(item), 0);
  const totalMeta = Number(getDailyGoalTarget(month) || 0);
  const totalPercentual = totalMeta > 0 ? (totalSpendOnly / totalMeta) * 100 : 0;
  return `<table class="fin-table unified-outflow-table"><thead><tr><th style="padding-left:22px">Somado</th><th style="padding-left:22px" class="sortable" onclick="setUnifiedOutflowSort('categoria')">${renderUnifiedSortLabel(month, 'categoria', 'Categoria')}</th><th class="sortable" onclick="setUnifiedOutflowSort('valor')">${renderUnifiedSortLabel(month, 'valor', 'Total gasto')}</th><th class="sortable" onclick="setUnifiedOutflowSort('meta')">${renderUnifiedSortLabel(month, 'meta', 'Meta estabelecida')}</th><th colspan="2" class="sortable" onclick="setUnifiedOutflowSort('percentual')">${renderUnifiedSortLabel(month, 'percentual', 'Resultado')}</th><th></th></tr></thead><tbody>${body}</tbody><tfoot><tr class="totals-row"><td></td><td style="padding-left:22px;padding-top:12px;padding-bottom:12px">${escapeHtml(totalLabel)}</td><td class="amount amount-neg">${fmt(totalSpent)}</td><td class="text-muted">${totalMeta > 0 ? fmt(totalMeta) : '—'}</td><td colspan="2"></td><td></td></tr></tfoot></table>`;
}

function renderUnifiedSpendGroups(month, rows) {
  const directMethodCategoryKeys = new Set(['PIX', 'DÉBITO', 'DEBITO', 'DINHEIRO']);
  const isDirectMethodCategory = (value) => directMethodCategoryKeys.has(resolveCategoryName(value || ''));
  const monthCategoryItems = (month.outflows || [])
    .filter(item => getUnifiedEffectiveOutflowAmount(item) > 0)
    .filter(item => {
      if (item?.type === 'expense') return true;
      if (item?.type !== 'spend') return false;
      return !isDirectMethodCategory(item?.category || '');
    });
  const prevMonth = getPreviousMonthFor(month);
  const inheritedPrevCategories = prevMonth
    ? (prevMonth.outflows || [])
      .filter(item => item?.type === 'spend')
      .filter(item => !isDirectMethodCategory(item?.category || ''))
      .filter(item => getUnifiedEffectiveOutflowAmount(item) > 0)
      .map(item => resolveCategoryName(item?.category || 'OUTROS'))
    : [];
  const spendCategories = monthCategoryItems.map(item => resolveCategoryName(item.category || 'OUTROS'));
  const categories = Array.from(new Set([
    ...inheritedPrevCategories,
    ...spendCategories
  ].map(cat => resolveCategoryName(cat || 'OUTROS'))));
  return renderUnifiedCategoryGroups(month, monthCategoryItems, {
    emptyText: 'Nenhum gasto registrado ainda.',
    includePaymentLabel: true,
    totalLabel: 'Total dos gastos',
    forcedCategories: categories,
    showCategoryRemove: true,
  });
}

function removeUnifiedSpendCategory(category) {
  const month = getCurrentMonth();
  if (!month) return;
  ensureUnifiedOutflowPilotMonth(month);
  const normalized = resolveCategoryName(category || 'OUTROS');
  const hasItems = (month.outflows || []).some(item => item?.type === 'spend' && resolveCategoryName(item.category || 'OUTROS') === normalized);
  if (hasItems) {
    alert('Essa categoria ainda tem gastos neste mês. Remova ou recategorize os lançamentos antes de apagar da lista.');
    return;
  }
  recordHistoryState();
  if (Array.isArray(month.dailyCategorySeeds)) {
    month.dailyCategorySeeds = month.dailyCategorySeeds.filter(cat => resolveCategoryName(cat || 'OUTROS') !== normalized);
  }
  if (month.dailyGoals && Object.prototype.hasOwnProperty.call(month.dailyGoals, normalized)) {
    delete month.dailyGoals[normalized];
  }
  syncUnifiedOutflowLegacyData(month);
  save(true);
  preserveCurrentScroll(() => renderMes());
}

function renderUnifiedCardCategoryGroups(month, rows, filterValue) {
  const cardId = String(filterValue || '').slice(5);
  const card = (month.outflowCards || []).find(entry => entry.id === cardId);
  const items = rows.filter(row => row.kind === 'outflow').map(row => row.item);
  return renderUnifiedCategoryGroups(month, items, {
    emptyText: 'Nenhuma despesa associada a esse cartão ainda.',
    includePaymentLabel: false,
    totalLabel: card ? `Total no ${card.name}` : 'Total no cartão',
  });
}

function renderUnifiedMethodRows(month, rows, filterValue) {
  const sortedRows = getSortedUnifiedRows(month, rows, 'data', 'desc');
  if (!sortedRows.length) return '<div class="unified-empty-state">Nenhuma saída encontrada nesse filtro.</div>';
  const isBoleto = filterValue === 'method:boleto';
  const isCardFilter = filterValue.startsWith('card:');
  const isTagFilter = filterValue.startsWith('tag:');
  const total = sortedRows.reduce((acc, row) => {
    if (row.kind === 'bill') return acc;
    return acc + Number(row.item?.amount || 0);
  }, 0);
  const body = sortedRows.map(row => {
    if (row.kind === 'bill') {
      const bill = row.item;
      const card = (month.outflowCards || []).find(entry => entry.id === bill.cardId);
      const cardLaunchesAmount = getUnifiedCardLaunchesAmount(month, bill.cardId);
      const billAmount = getUnifiedCardBillEffectiveAmount(month, bill);
      const billAmountDisplay = `<span title="${escapeHtml(`Valor pelos lançamentos desse cartão: ${fmt(cardLaunchesAmount)}`)}">${fmt(billAmount)}</span>`;
      return `
        <tr>
          <td style="padding-left:22px">${escapeHtml(getUnifiedCardBillingDateLabel(month, card))}</td>
          <td class="unified-outflow-description-cell">${renderUnifiedCardLabel(card, 'Cartão')}</td>
          <td>${renderCategoryLabel('CARTÃO DE CRÉDITO')}</td>
          <td><span class="unified-kind-chip card">Cartão de crédito</span></td>
          ${renderInlineCell({ table:'unifiedCardBill', row:bill.id, field:'amount', kind:'number', value:billAmount, displayValue:billAmountDisplay, className:'amount amount-neg' })}
          <td>${isBoleto ? '<label class="unified-paid-toggle"><input type="checkbox" ' + (bill.paid ? 'checked' : '') + ' onchange="toggleUnifiedCardBillPaid(\'' + bill.id + '\', this.checked)"><span>Pago</span></label>' : ''}</td>
          <td>${!isCardFilter ? '<button class="btn-icon" onclick="openUnifiedCardModal(\'' + (card?.id || '') + '\')">✎</button>' : ''}</td>
        </tr>`;
    }
    const item = row.item;
    const paidCell = isUnifiedExpenseType(item) && isBoleto
      ? `<label class="unified-paid-toggle"><input type="checkbox" ${item.paid ? 'checked' : ''} onchange="toggleUnifiedOutflowPaid('${item.id}', this.checked)"><span>Pago</span></label>`
      : '';
    const categoryCell = renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'category', kind:'unified-category', value:item.category, displayValue:renderCategoryLabel(item.category) });
    const descriptionCell = renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'description', kind:'text', value:item.description, displayValue:`${escapeHtml(item.description)}${getUnifiedSharedNoteHtml(item)}${item.tag ? `<div class="text-muted" style="margin-top:4px;font-size:11px">Tag • ${escapeHtml(item.tag)}</div>` : ''}`, className:'unified-outflow-description-cell' });
    return `
      <tr>
        ${renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'date', kind:'var-date', value:item.date || '', displayValue:escapeHtml(item.date || '—'), style:'padding-left:22px' })}
        ${descriptionCell}
        ${categoryCell}
        <td><span class="unified-kind-chip ${item.recurringSpend === true ? 'recurring' : (isUnifiedExpenseType(item) ? 'fixed' : 'spend')}">${escapeHtml(getUnifiedOutflowTypeLabel(item))}</span></td>
        ${renderInlineCell({ table:'unifiedOutflow', row:item.id, field:'amount', kind:'number', value:item.amount, displayValue:fmt(item.amount), className:'amount amount-neg' })}
        <td>${paidCell}</td>
        <td><button class="btn-icon" onclick="openUnifiedOutflowModal('${item.id}')">✎</button><button class="btn-icon" onclick="deleteUnifiedOutflow('${item.id}')">✕</button></td>
      </tr>`;
  }).join('');
  const totalLabel = isTagFilter
    ? `Total da tag ${decodeURIComponent(filterValue.slice(4))}`
    : 'Total nesta visão';
  return `<table class="fin-table unified-outflow-table"><thead><tr><th style="padding-left:22px" class="sortable" onclick="setUnifiedOutflowSort('data')">${renderUnifiedSortLabel(month, 'data', 'Data')}</th><th class="sortable" onclick="setUnifiedOutflowSort('descricao')">${renderUnifiedSortLabel(month, 'descricao', 'Descrição')}</th><th class="sortable" onclick="setUnifiedOutflowSort('categoria')">${renderUnifiedSortLabel(month, 'categoria', 'Categoria')}</th><th class="sortable" onclick="setUnifiedOutflowSort('tipo')">${renderUnifiedSortLabel(month, 'tipo', 'Tipo')}</th><th class="sortable" onclick="setUnifiedOutflowSort('valor')">${renderUnifiedSortLabel(month, 'valor', 'Valor')}</th><th>${isBoleto ? 'Pago' : ''}</th><th></th></tr></thead><tbody>${body}</tbody><tfoot><tr class="totals-row"><td colspan="4" style="padding-left:22px;padding-top:12px;padding-bottom:12px">${escapeHtml(totalLabel)}</td><td class="amount amount-neg">${fmt(total)}</td><td></td><td></td></tr></tfoot></table>`;
}

function renameUnifiedOutflowCategoryGroup(currentCategory) {
  const month = getCurrentMonth();
  if (!month) return;
  ensureUnifiedOutflowPilotMonth(month);
  const nextName = prompt('Nova categoria:', resolveCategoryName(currentCategory || 'OUTROS'));
  if (nextName === null) return;
  const normalized = resolveCategoryName(String(nextName || '').trim());
  if (typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(normalized)) {
    alert('Esse nome representa forma de saída. Escolha uma categoria real.');
    return;
  }
  if (!normalized) return;
  const previous = resolveCategoryName(currentCategory || 'OUTROS');
  if (normalized === previous) return;
  recordHistoryState();
  (month.outflows || []).forEach(item => {
    if (resolveCategoryName(item.category || 'OUTROS') === previous) item.category = normalized;
  });
  if (month.dailyGoals && Object.prototype.hasOwnProperty.call(month.dailyGoals, previous)) {
    const previousGoal = Number(month.dailyGoals[previous] || 0);
    month.dailyGoals[normalized] = Number(month.dailyGoals[normalized] || 0) + previousGoal;
    delete month.dailyGoals[previous];
  }
  if (!Array.isArray(month.dailyCategorySeeds)) month.dailyCategorySeeds = [];
  month.dailyCategorySeeds = Array.from(new Set(month.dailyCategorySeeds.map(cat => resolveCategoryName(cat) === previous ? normalized : resolveCategoryName(cat))));
  if (!month.dailyCategorySeeds.includes(normalized)) month.dailyCategorySeeds.push(normalized);
  if (!month.categorias) month.categorias = {};
  if (Object.prototype.hasOwnProperty.call(month.categorias, previous)) {
    month.categorias[normalized] = Number(month.categorias[normalized] || 0) + Number(month.categorias[previous] || 0);
    delete month.categorias[previous];
  } else if (!Object.prototype.hasOwnProperty.call(month.categorias, normalized)) {
    month.categorias[normalized] = 0;
  }
  syncUnifiedOutflowLegacyData(month);
  save(true);
  preserveCurrentScroll(() => renderMes());
}

function renderUnifiedMonthPilot(month) {
  const section = document.getElementById('section-unified-month');
  const filterSelect = document.getElementById('unifiedOutflowFilter');
  const tagFilterSelect = document.getElementById('unifiedOutflowTagFilter');
  const searchInput = document.getElementById('unifiedOutflowSearch');
  const content = document.getElementById('unifiedMonthContent');
  if (!section || !filterSelect || !content || !tagFilterSelect || !searchInput) return;
  if (!isUnifiedMonthPilotEnabled()) {
    section.style.display = 'none';
    return;
  }
  ensureUnifiedOutflowPilotMonth(month);
  const currentFilter = getUnifiedOutflowFilterValue(month);
  const currentTagFilter = getUnifiedOutflowTagFilterValue(month);
  const currentSearch = getUnifiedOutflowSearchValue(month);
  const tagOptions = getUnifiedOutflowTagFilterOptions(month);
  filterSelect.innerHTML = renderUnifiedOutflowFilterOptions(month, currentFilter);
  tagFilterSelect.innerHTML = renderUnifiedOutflowTagFilterOptions(month, currentTagFilter);
  tagFilterSelect.disabled = tagOptions.length === 0;
  const showSearch = currentFilter === 'all';
  searchInput.style.display = showSearch ? '' : 'none';
  if (searchInput.value !== currentSearch) {
    searchInput.value = currentSearch;
  }
  if (!showSearch && currentSearch) {
    month.unifiedOutflowUi.allSearch = '';
    saveUIState();
  }
  section.style.display = '';
  const rows = getUnifiedFilterRows(month, currentFilter, currentTagFilter, showSearch ? currentSearch : '');
  content.innerHTML = currentFilter === 'expense'
    ? renderUnifiedFixedRows(month, rows)
    : currentFilter === 'spend'
    ? renderUnifiedSpendGroups(month, rows)
    : currentFilter === 'all'
    ? renderUnifiedAllRows(month, rows)
    : currentFilter.startsWith('card:')
    ? renderUnifiedMethodRows(month, rows, currentFilter)
    : renderUnifiedMethodRows(month, rows, currentFilter);
}

function getMonthReimbursementGroups(month) {
  const groups = new Map();
  (month?.outflows || []).forEach(item => {
    if (item?.sharedExpense !== true) return;
    if (!Array.isArray(item?.sharedParticipants)) return;
    item.sharedParticipants.forEach((participant, index) => {
      if (participant?.isOwner === true) return;
      const amount = Math.max(0, Number(participant?.amount || 0) || 0);
      if (!(amount > 0)) return;
      const rawName = String(participant?.name || '').trim();
      const displayName = rawName || 'Pessoa sem nome';
      const key = rawName ? rawName.toLocaleLowerCase('pt-BR') : 'sem_nome';
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: displayName,
          total: 0,
          paid: true,
          rows: []
        });
      }
      const group = groups.get(key);
      group.total += amount;
      group.paid = group.paid && participant?.paid === true;
      group.rows.push({
        outflowId: item.id,
        participantIndex: index,
        description: String(item.description || 'Compra dividida').trim() || 'Compra dividida',
        amount,
        paid: participant?.paid === true
      });
    });
  });
  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function toggleReimbursementPersonExpanded(personKey) {
  const key = String(personKey || '').trim();
  if (!key) return;
  unifiedReimbursementExpandedPeople[key] = !unifiedReimbursementExpandedPeople[key];
  preserveCurrentScroll(() => renderMes());
}

function toggleReimbursementPersonPaid(personKey, checked) {
  const month = getCurrentMonth();
  if (!month) return;
  const key = String(personKey || '').trim();
  if (!key) return;
  recordHistoryState();
  (month.outflows || []).forEach(item => {
    if (!(item?.sharedExpense === true) || !Array.isArray(item?.sharedParticipants)) return;
    item.sharedParticipants = item.sharedParticipants.map(participant => {
      if (participant?.isOwner === true) return participant;
      const rawName = String(participant?.name || '').trim();
      const participantKey = rawName ? rawName.toLocaleLowerCase('pt-BR') : 'sem_nome';
      if (participantKey !== key) return participant;
      return { ...participant, paid: checked === true };
    });
  });
  save(true);
  preserveCurrentScroll(() => renderMes());
}

function renderReimbursementsSection(month) {
  const section = document.getElementById('section-reembolsos');
  const body = document.getElementById('reembolsosBody');
  if (!section || !body) return;
  const groups = getMonthReimbursementGroups(month);
  if (!groups.length) {
    section.style.display = 'none';
    body.innerHTML = '';
    return;
  }
  section.style.display = '';
  body.innerHTML = groups.map(group => {
    const expanded = unifiedReimbursementExpandedPeople[group.key] === true;
    const details = expanded
      ? group.rows.map(row => `
          <tr>
            <td style="padding-left:56px"></td>
            <td colspan="2" class="text-muted" style="font-size:12px">${escapeHtml(row.description)}</td>
            <td class="amount amount-pos" style="font-size:12px">${fmt(row.amount)}</td>
          </tr>
        `).join('')
      : '';
    return `
      <tr>
        <td style="padding-left:22px"><button class="btn-icon unified-expand-btn" onclick="toggleReimbursementPersonExpanded('${group.key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')">${expanded ? '▾' : '▸'}</button></td>
        <td style="padding-left:22px">${escapeHtml(group.name)}</td>
        <td class="amount amount-pos">${fmt(group.total)}</td>
        <td><label class="unified-paid-toggle"><input type="checkbox" ${group.paid ? 'checked' : ''} onchange="toggleReimbursementPersonPaid('${group.key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', this.checked)"><span>Pago</span></label></td>
      </tr>
      ${details}
    `;
  }).join('');
}

function updateUnifiedCardBillAmount(billId, value) {
  const month = getCurrentMonth();
  ensureUnifiedOutflowPilotMonth(month);
  const bill = (month.cardBills || []).find(entry => entry.id === billId);
  if (!bill) return;
  recordHistoryState();
  bill.amount = Math.max(0, Number(value || 0) || 0);
  bill.manualAmountSet = true;
  bill.source = 'manual';
  syncUnifiedOutflowLegacyData(month);
  save(true);
  preserveCurrentScroll(() => renderMes());
}

function toggleUnifiedCardBillPaid(billId, checked) {
  const month = getCurrentMonth();
  ensureUnifiedOutflowPilotMonth(month);
  const bill = (month.cardBills || []).find(entry => entry.id === billId);
  if (!bill) return;
  recordHistoryState();
  bill.paid = checked === true;
  syncUnifiedOutflowLegacyData(month);
  save(true);
  preserveCurrentScroll(() => renderMes());
}

function toggleUnifiedOutflowPaid(outflowId, checked) {
  const month = getCurrentMonth();
  ensureUnifiedOutflowPilotMonth(month);
  const item = (month.outflows || []).find(entry => entry.id === outflowId);
  if (!item) return;
  recordHistoryState();
  item.paid = checked === true;
  syncUnifiedOutflowLegacyData(month);
  save(true);
  preserveCurrentScroll(() => renderMes());
}

function deleteUnifiedOutflow(outflowId) {
  const month = getCurrentMonth();
  ensureUnifiedOutflowPilotMonth(month);
  const target = (month.outflows || []).find(entry => entry.id === outflowId);
  if (!target) return;
  const seriesKey = target?.installmentsGroupId || target?.recurringGroupId || '';
  const performDelete = (applyForward) => {
    recordHistoryState();
    month.outflows = (month.outflows || []).filter(entry => entry.id !== outflowId);
    if (seriesKey && applyForward && canPropagateRecurringFromMonth(month)) {
      markRecurringSeriesStopFromMonth(month, seriesKey);
      const currentSort = getMonthSortValue(month);
      data.forEach(otherMonth => {
        if (otherMonth.id === month.id || getMonthSortValue(otherMonth) < currentSort) return;
        ensureUnifiedOutflowPilotMonth(otherMonth);
        otherMonth.outflows = (otherMonth.outflows || []).filter(entry => (entry.installmentsGroupId || entry.recurringGroupId || '') !== seriesKey);
        syncUnifiedOutflowLegacyData(otherMonth);
      });
    }
    syncUnifiedOutflowLegacyData(month);
    save(true);
    preserveCurrentScroll(() => renderMes());
    renderUnifiedOutflowModalRecentList();
  };
  if (seriesKey && canPropagateRecurringFromMonth(month)) {
    openRecurringChangeScopeModal({
      message: 'Este lançamento se repete em outros meses. Como você deseja aplicar esta exclusão?',
      onThisMonth: () => performDelete(false),
      onForward: () => performDelete(true),
      onCancel: () => {}
    });
    return;
  }
  openYesNoQuestion('Remover esta saída?', () => performDelete(false), () => {});
}

function getUnifiedCardBankOptionMarkup(key, meta, selected) {
  return `
    <button type="button" class="unified-card-bank-option ${selected === key ? 'is-selected' : ''}" onclick="selectUnifiedCardBank('${key}')">
      <span class="smart-icon-badge smart-bank-badge ${meta.className}" aria-hidden="true">${meta.short}</span>
      <span>${escapeHtml(meta.label)}</span>
    </button>`;
}

function renderUnifiedCardBankPicker(selected = '') {
  const menu = document.getElementById('unifiedCardBankMenu');
  const input = document.getElementById('unifiedCardBank');
  const triggerContent = document.getElementById('unifiedCardBankTriggerContent');
  const selectedMeta = selected && selected !== 'outro' ? PATRIMONIO_INSTITUTION_META[selected] : null;
  const otherMeta = { label: 'Outro', short: '•', className: 'bank-outra' };
  if (triggerContent) {
    triggerContent.innerHTML = selectedMeta
      ? `<span class="smart-icon-badge smart-bank-badge ${selectedMeta.className}" aria-hidden="true">${selectedMeta.short}</span><span>${escapeHtml(selectedMeta.label)}</span>`
      : selected === 'outro'
      ? `<span class="smart-icon-badge smart-bank-badge bank-outra" aria-hidden="true">•</span><span>Outro</span>`
      : '<span>Selecione</span>';
  }
  if (!menu || !input) return;
  input.value = selected || '';
  const buttons = Object.entries(PATRIMONIO_INSTITUTION_META)
    .filter(([key]) => key !== 'outra')
    .map(([key, meta]) => getUnifiedCardBankOptionMarkup(key, meta, selected))
    .join('');
  menu.innerHTML = `${buttons}${getUnifiedCardBankOptionMarkup('outro', otherMeta, selected)}`;
}

function selectUnifiedCardBank(value) {
  const input = document.getElementById('unifiedCardBank');
  if (input) input.value = value;
  renderUnifiedCardBankPicker(value);
  const menu = document.getElementById('unifiedCardBankMenu');
  if (menu) {
    menu.style.display = 'none';
    menu.style.left = '';
    menu.style.top = '';
    menu.style.width = '';
  }
  toggleUnifiedCardOtherBank();
}

function toggleUnifiedCardBankMenu() {
  const trigger = document.getElementById('unifiedCardBankTrigger');
  const menu = document.getElementById('unifiedCardBankMenu');
  if (!menu || !trigger) return;
  if (menu.style.display === 'block') {
    menu.style.display = 'none';
    menu.style.left = '';
    menu.style.top = '';
    menu.style.width = '';
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const desiredWidth = Math.max(rect.width, 280);
  const maxLeft = Math.max(12, viewportWidth - desiredWidth - 12);
  const left = Math.min(rect.left, maxLeft);
  menu.style.display = 'block';
  menu.style.left = `${left}px`;
  menu.style.top = `${rect.bottom + 8}px`;
  menu.style.width = `${desiredWidth}px`;
}

function toggleUnifiedCardOtherBank() {
  const select = document.getElementById('unifiedCardBank');
  const wrap = document.getElementById('unifiedCardOtherBankWrap');
  if (!select || !wrap) return;
  wrap.style.display = select.value === 'outro' ? 'block' : 'none';
}

function sanitizeUnifiedCardDayInput(input) {
  if (!input) return;
  input.value = formatUnifiedExpenseDateInput(input.value || '');
}

function resolveUnifiedCardDateInput(rawValue, month = getCurrentMonth()) {
  const date = normalizeFlexibleDateInput(rawValue, month, { simpleDayMonthOffset: 1 });
  if (!date) return null;
  const day = Math.max(1, Math.min(31, Number(date.split('/')[0] || 1) || 1));
  return { date, day };
}

function getUnifiedCardDateForMonth(sourceDate, sourceMonth, targetMonth) {
  const normalized = normalizeVarDate(sourceDate || '');
  if (!normalized) return '';
  if (window.MesAtualOutflowExpenseDate?.getExpenseDateForTargetMonth) {
    const targetMonthDate = getMonthDateFromMonthObject(targetMonth);
    return window.MesAtualOutflowExpenseDate.getExpenseDateForTargetMonth(normalized, sourceMonth, targetMonthDate) || normalized;
  }
  return normalized;
}

function getUnifiedCardClosingDateLabel(month, card) {
  if (!card) return '—';
  return normalizeVarDate(card.closingDate || '') || `Dia ${String(card.closingDay || 1).padStart(2, '0')}`;
}

function getUnifiedCardPaymentDateLabel(month, card) {
  if (!month || !card) return '—';
  const explicit = normalizeVarDate(card.paymentDate || '');
  if (explicit) return explicit;
  const base = getMonthDateFromMonthObject(month);
  const day = Math.max(1, Math.min(31, Number(card.paymentDay || 1) || 1));
  const billingDate = new Date(base.getFullYear(), base.getMonth() + 1, day);
  return normalizeVarDate(`${String(billingDate.getDate()).padStart(2, '0')}/${String(billingDate.getMonth() + 1).padStart(2, '0')}/${billingDate.getFullYear()}`) || '—';
}

function formatCategoryOptionLabel(category) {
  const resolved = resolveCategoryName(category || 'OUTROS');
  return resolved;
}

function populateUnifiedOutflowCategoryOptions(month, selected = '') {
  const select = document.getElementById('unifiedOutflowCategory');
  if (!select) return;
  const categories = getUnifiedOutflowCategories(month);
  select.innerHTML = ['<option value="">Selecione</option>']
    .concat(categories.map(category => `<option value="${category}" ${selected === category ? 'selected' : ''}>${escapeHtml(formatCategoryOptionLabel(category))}</option>`))
    .concat('<option value="nova">+ Nova categoria</option>')
    .join('');
  renderUnifiedOutflowCategorySuggestionList('');
}

function toggleUnifiedOutflowNewCategory() {
  const select = document.getElementById('unifiedOutflowCategory');
  const wrap = document.getElementById('unifiedOutflowNewCategoryWrap');
  if (!select || !wrap) return;
  wrap.style.display = select.value === 'nova' ? 'block' : 'none';
  if (select.value === 'nova') {
    renderUnifiedOutflowCategorySuggestionList(document.getElementById('unifiedOutflowNewCategory')?.value || '');
  }
}

function getUnifiedOutflowBillingDisplayValue(item) {
  const normalized = normalizeVarDate(item?.date || '');
  if (!normalized) return '';
  return normalized;
}

function buildUnifiedFixedBillingDate(dayValue, month = getCurrentMonth()) {
  if (window.MesAtualOutflowExpenseDate?.buildNextMonthDateFromDay) {
    return window.MesAtualOutflowExpenseDate.buildNextMonthDateFromDay(dayValue, month);
  }
  const resolved = normalizeFlexibleDateInput(dayValue, month, { simpleDayMonthOffset: 1 });
  if (resolved) return resolved;
  const digits = String(dayValue || '').replace(/\D/g, '').slice(0, 2);
  const day = Math.min(31, Math.max(1, Number(digits || 1)));
  const base = getMonthDateFromMonthObject(month);
  const dueYear = base.getMonth() === 11 ? base.getFullYear() + 1 : base.getFullYear();
  const dueMonthIndex = (base.getMonth() + 1) % 12;
  const maxDay = new Date(dueYear, dueMonthIndex + 1, 0).getDate();
  const safeDay = Math.min(day, maxDay);
  return `${String(safeDay).padStart(2, '0')}/${String(dueMonthIndex + 1).padStart(2, '0')}/${String(dueYear).slice(-2)}`;
}

function formatUnifiedExpenseDateInput(rawValue) {
  if (window.MesAtualOutflowExpenseDate?.formatExpenseDateInput) {
    return window.MesAtualOutflowExpenseDate.formatExpenseDateInput(rawValue);
  }
  const digits = String(rawValue || '').replace(/\D/g, '').slice(0, 6);
  if (!digits) return '';
  if (digits.length <= 2) return String(Math.min(31, Math.max(1, Number(digits) || 1)));
  const day = String(Math.min(31, Math.max(1, Number(digits.slice(0, 2)) || 1))).padStart(2, '0');
  if (digits.length <= 4) return `${day}/${digits.slice(2, 4)}`;
  const month = String(Math.min(12, Math.max(1, Number(digits.slice(2, 4)) || 1))).padStart(2, '0');
  return `${day}/${month}/${digits.slice(4, 6)}`;
}

function resolveUnifiedExpenseDateInput(rawValue, month) {
  if (window.MesAtualOutflowExpenseDate?.resolveExpenseDate) {
    return window.MesAtualOutflowExpenseDate.resolveExpenseDate(rawValue, month);
  }
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  if (/^\d{1,2}$/.test(raw)) return buildUnifiedFixedBillingDate(raw, month);
  return normalizeVarDate(raw) || '';
}

function sanitizeUnifiedOutflowDateInput(input) {
  if (!input) return;
  input.value = formatUnifiedExpenseDateInput(input.value || '');
}

function shiftUnifiedOutflowDateDay(deltaDays = 0) {
  const input = document.getElementById('unifiedOutflowDate');
  if (!input) return;
  const typeSelect = document.getElementById('unifiedOutflowType');
  const recurringToggle = document.getElementById('unifiedOutflowRecurringToggle');
  const type = normalizeUnifiedOutflowType(typeSelect?.value || 'expense');
  const isExpenseType = type === 'expense';
  const isFixedDay = recurringToggle?.checked === true && !isExpenseType;
  const delta = Number(deltaDays || 0);
  if (!delta) return;
  if (isExpenseType) {
    const raw = String(input.value || '').trim();
    if (!raw || /^\d{1,2}$/.test(raw)) {
      const currentDay = Math.min(31, Math.max(1, Number(raw.replace(/\D/g, '')) || 1));
      const nextDay = Math.min(31, Math.max(1, currentDay + delta));
      input.value = String(nextDay);
      return;
    }
    const normalizedFull = normalizeVarDate(raw);
    if (!normalizedFull) return;
    const [day, monthPart, year] = normalizedFull.split('/').map(v => Number(v || 0));
    const baseDate = new Date(2000 + year, Math.max(0, monthPart - 1), Math.max(1, day));
    baseDate.setDate(baseDate.getDate() + delta);
    input.value = `${String(baseDate.getDate()).padStart(2, '0')}/${String(baseDate.getMonth() + 1).padStart(2, '0')}/${String(baseDate.getFullYear()).slice(-2)}`;
    return;
  }
  if (isFixedDay) {
    const currentDay = Math.min(31, Math.max(1, Number(String(input.value || '').replace(/\D/g, '')) || 1));
    const nextDay = Math.min(31, Math.max(1, currentDay + delta));
    input.value = String(nextDay);
    return;
  }
  const parsed = normalizeVarDate(input.value || '');
  const [day, month, year] = (parsed || '').split('/').map(v => Number(v || 0));
  const baseDate = parsed
    ? new Date(2000 + year, Math.max(0, month - 1), Math.max(1, day))
    : new Date();
  baseDate.setDate(baseDate.getDate() + delta);
  input.value = `${String(baseDate.getDate()).padStart(2, '0')}/${String(baseDate.getMonth() + 1).padStart(2, '0')}/${String(baseDate.getFullYear()).slice(-2)}`;
}

function updateUnifiedOutflowDateFieldState() {
  const typeSelect = document.getElementById('unifiedOutflowType');
  const dateLabel = document.getElementById('unifiedOutflowDateLabel');
  const dateInput = document.getElementById('unifiedOutflowDate');
  const recurringToggle = document.getElementById('unifiedOutflowRecurringToggle');
  if (!typeSelect || !dateLabel || !dateInput) return;
  const type = normalizeUnifiedOutflowType(typeSelect.value);
  const usesBillingDay = type === 'expense' || recurringToggle?.checked === true;
  if (usesBillingDay) {
    dateLabel.textContent = 'Data da cobrança';
    dateInput.placeholder = 'Ex: 10 ou 10/05/26';
    sanitizeUnifiedOutflowDateInput(dateInput);
  } else {
    dateLabel.textContent = 'Data da compra';
    dateInput.placeholder = 'dd/mm/aa';
  }
}

function toggleUnifiedOutflowInstallments() {
  const wrap = document.getElementById('unifiedOutflowInstallmentsWrap');
  const toggle = document.getElementById('unifiedOutflowInstallmentsToggle');
  const recurringToggle = document.getElementById('unifiedOutflowRecurringToggle');
  if (!wrap || !toggle) return;
  if (toggle.checked && recurringToggle) recurringToggle.checked = false;
  wrap.style.display = toggle.checked ? 'flex' : 'none';
  if (toggle.checked) {
    requestAnimationFrame(() => {
      try {
        wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {}
      const countInput = document.getElementById('unifiedOutflowInstallmentsCount');
      try { countInput?.focus({ preventScroll: true }); } catch {}
    });
  }
  handleUnifiedOutflowTypeChange();
}

function toggleUnifiedOutflowRecurring() {
  const recurringToggle = document.getElementById('unifiedOutflowRecurringToggle');
  const installmentsToggle = document.getElementById('unifiedOutflowInstallmentsToggle');
  const installmentsWrap = document.getElementById('unifiedOutflowInstallmentsWrap');
  if (!recurringToggle) return;
  if (recurringToggle.checked && installmentsToggle) {
    installmentsToggle.checked = false;
    if (installmentsWrap) installmentsWrap.style.display = 'none';
  }
  handleUnifiedOutflowTypeChange();
}

function handleUnifiedOutflowTypeChange() {
  const typeSelect = document.getElementById('unifiedOutflowType');
  const type = normalizeUnifiedOutflowType(typeSelect?.value || 'expense');
  const outputSelect = document.getElementById('unifiedOutflowOutput');
  const outputValue = outputSelect?.value || '';
  const outputHelp = document.getElementById('unifiedOutflowOutputHelp');
  const recurringLabel = document.getElementById('unifiedOutflowRecurringLabel');
  const recurringToggle = document.getElementById('unifiedOutflowRecurringToggle');
  const installmentsToggle = document.getElementById('unifiedOutflowInstallmentsToggle');
  const installmentsLabel = document.getElementById('unifiedOutflowInstallmentsToggle')?.closest('label');
  const installmentsWrap = document.getElementById('unifiedOutflowInstallmentsWrap');
  const sharedToggleLabel = document.getElementById('unifiedOutflowSharedToggleLabel');
  const sharedToggle = document.getElementById('unifiedOutflowSharedToggle');
  const sharedWrap = document.getElementById('unifiedOutflowSharedWrap');
  const recurringText = document.getElementById('unifiedOutflowRecurringText');
  const sharedText = document.getElementById('unifiedOutflowSharedText');
  const isCardOutput = outputValue.startsWith('card:');
  if (type === 'expense' && isCardOutput && outputSelect) {
    const fallbackValue = Array.from(outputSelect.options || []).some(option => option.value === 'method:debito')
      ? 'method:debito'
      : (outputSelect.options?.[0]?.value || 'method:debito');
    outputSelect.value = fallbackValue;
  }
  const effectiveType = typeSelect?.value || type;
  if (recurringText) recurringText.textContent = effectiveType === 'expense' ? 'Despesa recorrente' : 'Gasto recorrente';
  if (sharedText) sharedText.textContent = effectiveType === 'expense' ? 'Despesa compartilhada' : 'Gasto compartilhado';
  if (recurringLabel) recurringLabel.style.display = '';
  if (recurringToggle && recurringToggle.checked && installmentsToggle) installmentsToggle.checked = false;
  if (installmentsToggle && installmentsToggle.checked && recurringToggle) recurringToggle.checked = false;
  const canUseInstallments = true;
  if (installmentsLabel) installmentsLabel.style.display = '';
  if (installmentsWrap) installmentsWrap.style.display = installmentsToggle?.checked && canUseInstallments ? 'flex' : 'none';
  const canUseShared = true;
  if (sharedToggleLabel) sharedToggleLabel.style.display = canUseShared ? '' : 'none';
  if (!canUseShared && sharedToggle) sharedToggle.checked = false;
  if (sharedWrap) sharedWrap.style.display = canUseShared && sharedToggle?.checked === true ? '' : 'none';
  if (canUseShared && sharedToggle?.checked === true) renderUnifiedOutflowSharedPeople();
  updateUnifiedOutflowDateFieldState();
  if (!outputHelp) return;
  if (effectiveType === 'expense') {
    if ((outputValue || '').startsWith('card:')) {
      outputHelp.textContent = 'Despesa nao usa cartao diretamente. Selecione pix, debito, dinheiro, boleto ou conta.';
    } else {
      outputHelp.textContent = 'Despesa: informe só o dia (vai para o próximo mês) ou data completa (respeita mês/ano informado).';
    }
  } else if (recurringToggle?.checked === true) {
    outputHelp.textContent = 'Gasto recorrente: use o dia de cobrança.';
  } else {
    outputHelp.textContent = '';
  }
}

function toggleUnifiedOutflowShared() {
  const sharedToggle = document.getElementById('unifiedOutflowSharedToggle');
  const sharedWrap = document.getElementById('unifiedOutflowSharedWrap');
  const enabled = sharedToggle?.checked === true;
  if (sharedWrap) sharedWrap.style.display = enabled ? '' : 'none';
  if (enabled) {
    renderUnifiedOutflowSharedPeople();
    requestAnimationFrame(() => {
      try {
        sharedWrap?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {}
    });
  }
}

function readUnifiedOutflowSharedParticipantsFromDOM() {
  const rows = Array.from(document.querySelectorAll('#unifiedOutflowSharedPeopleList .form-row'));
  if (!rows.length) return [];
  return rows.map((row, idx) => {
    const nameInput = row.querySelector('.unified-shared-name');
    const amountInput = row.querySelector('.unified-shared-amount');
    return {
      isOwner: idx === 0,
      idx,
      name: String(nameInput?.value || '').trim(),
      amount: Math.max(0, Number(amountInput?.value || 0) || 0)
    };
  });
}

function updateUnifiedOutflowManualLastAmount() {
  const wrap = document.getElementById('unifiedOutflowSharedWrap');
  const modeSelect = document.getElementById('unifiedOutflowSharedMode');
  const amountInput = document.getElementById('unifiedOutflowAmount');
  if (!wrap || wrap.style.display === 'none' || !modeSelect || !amountInput) return;
  if (modeSelect.value !== 'manual') return;
  const amountFields = Array.from(document.querySelectorAll('#unifiedOutflowSharedPeopleList .unified-shared-amount'));
  if (amountFields.length < 2) return;
  const totalAmount = Math.max(0, Number(amountInput.value || 0) || 0);
  const lastIndex = amountFields.length - 1;
  let partial = 0;
  amountFields.forEach((field, idx) => {
    if (idx === lastIndex) return;
    partial += Math.max(0, Number(field.value || 0) || 0);
  });
  const remaining = Math.max(0, Number((totalAmount - partial).toFixed(2)));
  const lastField = amountFields[lastIndex];
  if (lastField) {
    lastField.value = String(remaining);
    lastField.readOnly = true;
    lastField.title = 'Calculado automaticamente para fechar o total';
  }
}

function renderUnifiedOutflowSharedPeople(existingParticipants = null) {
  const list = document.getElementById('unifiedOutflowSharedPeopleList');
  const amountInput = document.getElementById('unifiedOutflowAmount');
  const countInput = document.getElementById('unifiedOutflowSharedPeopleCount');
  const modeSelect = document.getElementById('unifiedOutflowSharedMode');
  if (!list || !amountInput || !countInput || !modeSelect) return;
  const previousMode = list.dataset.sharedModeCurrent || '';
  if (previousMode === 'manual') {
    const manualRows = readUnifiedOutflowSharedParticipantsFromDOM();
    if (manualRows.length) {
      unifiedOutflowSharedManualDraft = {
        count: manualRows.length,
        participants: manualRows.map(row => ({ ...row }))
      };
    }
  }
  const totalAmount = Math.max(0, Number(amountInput.value || 0) || 0);
  const peopleCount = Math.max(1, Math.min(20, Number(countInput.value || 1) || 1));
  const mode = modeSelect.value === 'manual' ? 'manual' : 'equal';
  const ownerName = getOwnerDisplayName();
  const suggestions = getSharedParticipantNameSuggestions();
  const datalistId = 'sharedParticipantNameSuggestions';
  const liveRows = readUnifiedOutflowSharedParticipantsFromDOM();
  const draftRows = Array.isArray(unifiedOutflowSharedManualDraft?.participants) ? unifiedOutflowSharedManualDraft.participants : [];
  let previous = Array.isArray(existingParticipants) ? existingParticipants : null;
  if (!previous && liveRows.length) previous = liveRows;
  if (!previous && mode === 'manual' && draftRows.length) previous = draftRows;
  const effectiveCount = peopleCount <= 1 ? 2 : peopleCount;
  const eachShare = effectiveCount > 0 ? (totalAmount / effectiveCount) : 0;
  const rows = [];
  const ownerPrevious = previous?.find(item => item?.isOwner === true) || null;
  rows.push({
    isOwner: true,
    idx: 0,
    name: ownerName,
    amount: mode === 'equal' ? (peopleCount > 1 ? eachShare : 0) : (peopleCount <= 1 ? 0 : (Number(ownerPrevious?.amount || 0) || 0))
  });
  const otherPreviousRows = (previous || []).filter(item => item?.isOwner !== true);
  for (let i = 1; i < effectiveCount; i += 1) {
    const prev = otherPreviousRows[i - 1] || null;
    rows.push({
      isOwner: false,
      idx: i,
      name: String(prev?.name || ''),
      amount: mode === 'equal'
        ? (peopleCount <= 1 ? totalAmount : eachShare)
        : (peopleCount <= 1 ? totalAmount : (Number(prev?.amount || 0) || 0))
    });
  }

  list.innerHTML = `
    <datalist id="${datalistId}">
      ${suggestions.map(name => `<option value="${escapeHtml(name)}"></option>`).join('')}
    </datalist>
    <div class="text-muted" style="font-size:11px;margin:4px 0 8px">A soma das pessoas define quanto realmente pertence ao proprietário e quanto fica como reembolso esperado.</div>
    ${rows.map(row => `
      <div class="form-row" style="margin-bottom:8px">
        <div class="field">
          <label>${row.isOwner ? 'Proprietário' : `Pessoa ${row.idx}`}</label>
          <input
            ${row.isOwner ? 'readonly' : `list="${datalistId}"`}
            data-shared-role="${row.isOwner ? 'owner' : 'other'}"
            data-shared-index="${row.idx}"
            class="unified-shared-name"
            value="${escapeHtml(row.name)}"
            placeholder="${row.isOwner ? '' : 'Nome (opcional)'}">
        </div>
        <div class="field">
          <label>Valor</label>
          <input
            ${mode === 'equal' ? 'readonly' : ''}
            data-shared-role="${row.isOwner ? 'owner' : 'other'}"
            data-shared-index="${row.idx}"
            class="unified-shared-amount"
            type="number"
            step="0.01"
            min="0"
            value="${Number(row.amount || 0)}"
            placeholder="0,00">
        </div>
      </div>
    `).join('')}
  `;
  list.dataset.sharedModeCurrent = mode;
  if (mode === 'manual') {
    const amountFields = Array.from(document.querySelectorAll('#unifiedOutflowSharedPeopleList .unified-shared-amount'));
    amountFields.forEach((field, idx) => {
      if (idx < amountFields.length - 1) {
        field.oninput = () => updateUnifiedOutflowManualLastAmount();
      }
    });
    amountInput.oninput = () => updateUnifiedOutflowManualLastAmount();
    updateUnifiedOutflowManualLastAmount();
  }
}

function collectUnifiedOutflowSharedFromForm(baseAmount = 0) {
  const enabled = document.getElementById('unifiedOutflowSharedToggle')?.checked === true;
  if (!enabled) {
    return {
      enabled: false,
      ownerShare: Math.max(0, Number(baseAmount || 0) || 0),
      othersShare: 0,
      participants: [],
      mode: 'equal'
    };
  }
  const mode = document.getElementById('unifiedOutflowSharedMode')?.value === 'manual' ? 'manual' : 'equal';
  const peopleCount = Math.max(1, Math.min(20, Number(document.getElementById('unifiedOutflowSharedPeopleCount')?.value || 1) || 1));
  const effectiveCount = peopleCount <= 1 ? 2 : peopleCount;
  const totalAmount = Math.max(0, Number(baseAmount || 0) || 0);
  const nameInputs = Array.from(document.querySelectorAll('#unifiedOutflowSharedPeopleList .unified-shared-name'));
  const amountInputs = Array.from(document.querySelectorAll('#unifiedOutflowSharedPeopleList .unified-shared-amount'));
  const participants = [];
  for (let i = 0; i < effectiveCount; i += 1) {
    const role = i === 0 ? 'owner' : 'other';
    const name = String(nameInputs[i]?.value || '').trim();
    let value = Math.max(0, Number(amountInputs[i]?.value || 0) || 0);
    if (peopleCount <= 1) {
      value = role === 'owner' ? 0 : totalAmount;
    }
    if (mode === 'equal') {
      if (peopleCount <= 1) value = role === 'owner' ? 0 : totalAmount;
      else value = totalAmount / effectiveCount;
    }
    participants.push({
      id: `sp_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      isOwner: role === 'owner',
      name: role === 'owner' ? getOwnerDisplayName() : name,
      amount: value,
      paid: false
    });
  }
  if (mode === 'manual') {
    const manualTotal = participants.reduce((acc, participant) => acc + Number(participant.amount || 0), 0);
    if (Math.abs(manualTotal - totalAmount) > 0.01) {
      throw new Error(`A divisão manual precisa somar ${fmt(totalAmount)}.`);
    }
  }
  const computed = getUnifiedSharedComputedValues(totalAmount, peopleCount, mode, participants);
  return {
    enabled: true,
    ownerShare: computed.ownerShare,
    othersShare: computed.othersShare,
    participants,
    mode
  };
}

function openUnifiedCardModal(cardId = '') {
  const month = getCurrentMonth();
  ensureUnifiedOutflowPilotMonth(month);
  closeModal('modalUnifiedOutflow');
  closeModal('modalFinanceCalendar');
  const card = (month.outflowCards || []).find(entry => entry.id === cardId) || null;
  editingUnifiedCardId = card?.id || '';
  document.getElementById('modalUnifiedCardTitle').textContent = card ? 'Editar cartão' : 'Adicionar cartão';
  const selectedBank = card?.visualId?.startsWith('institution:') ? card.visualId.slice(12) : (card?.visualId ? 'outro' : '');
  renderUnifiedCardBankPicker(selectedBank);
  document.getElementById('unifiedCardOtherBank').value = selectedBank === 'outro' ? (card?.name || '') : '';
  document.getElementById('unifiedCardClosingDay').value = card?.closingDate || card?.closingDay || '';
  document.getElementById('unifiedCardPaymentDay').value = card?.paymentDate || card?.paymentDay || '';
  document.getElementById('unifiedCardDescription').value = card?.description || '';
  toggleUnifiedCardOtherBank();
  const menu = document.getElementById('unifiedCardBankMenu');
  if (menu) {
    menu.style.display = 'none';
    menu.style.left = '';
    menu.style.top = '';
    menu.style.width = '';
  }
  renderUnifiedCardManageList();
  openModal('modalUnifiedCard');
}

function renderUnifiedCardManageList() {
  const month = getCurrentMonth();
  const container = document.getElementById('unifiedCardManageList');
  if (!container || !month) return;
  ensureUnifiedOutflowPilotMonth(month);
  const cards = (month.outflowCards || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  if (!cards.length) {
    container.innerHTML = '<div class="text-muted" style="font-size:12px">Nenhum cartão cadastrado.</div>';
    return;
  }
  container.innerHTML = cards.map(card => `
    <div class="unified-card-manage-row">
      <div>${renderUnifiedCardLabel(card, card.name || 'Cartão')}</div>
      <div class="unified-card-manage-actions">
        <button type="button" class="btn btn-ghost" style="padding:6px 10px;font-size:12px" onclick="openUnifiedCardModal('${card.id}')">Editar cartão</button>
        <button type="button" class="btn btn-ghost" style="padding:6px 10px;font-size:12px" onclick="openUnifiedCardDeleteModal('${card.id}')">Excluir cartão</button>
      </div>
    </div>
  `).join('');
}

function openUnifiedCardDeleteModal(cardId) {
  const month = getCurrentMonth();
  if (!month) return;
  ensureUnifiedOutflowPilotMonth(month);
  const card = (month.outflowCards || []).find(entry => entry.id === cardId);
  if (!card) return;
  deletingUnifiedCardId = cardId;
  const currentSort = getMonthSortValue(month);
  const linkedCount = data.reduce((acc, targetMonth) => {
    if (getMonthSortValue(targetMonth) < currentSort) return acc;
    ensureUnifiedOutflowPilotMonth(targetMonth);
    return acc + (targetMonth.outflows || []).filter(item => item.outputKind === 'card' && item.outputRef === cardId).length;
  }, 0);
  const message = document.getElementById('unifiedCardDeleteMessage');
  if (message) {
    message.textContent = linkedCount > 0
      ? `${card.name} possui ${linkedCount} lançamento(s) vinculado(s). Escolha como deseja seguir.`
      : `${card.name} não possui lançamentos vinculados e pode ser excluído com segurança.`;
  }
  const transferSelect = document.getElementById('unifiedCardDeleteTarget');
  if (transferSelect) {
    transferSelect.innerHTML = (month.outflowCards || [])
      .filter(entry => entry.id !== cardId)
      .map(entry => `<option value="${entry.id}">${escapeHtml(entry.name)}</option>`)
      .join('');
  }
  const radioTransfer = document.getElementById('unifiedCardDeleteModeTransfer');
  const radioDelete = document.getElementById('unifiedCardDeleteModeDelete');
  if (radioTransfer) radioTransfer.checked = linkedCount > 0;
  if (radioDelete) radioDelete.checked = linkedCount === 0;
  const confirm = document.getElementById('unifiedCardDeleteConfirm');
  if (confirm) confirm.checked = false;
  toggleUnifiedCardDeleteMode();
  openModal('modalUnifiedCardDelete');
}

function toggleUnifiedCardDeleteMode() {
  const transferWrap = document.getElementById('unifiedCardDeleteTransferWrap');
  const confirmWrap = document.getElementById('unifiedCardDeleteConfirmWrap');
  const isDeleteMode = document.getElementById('unifiedCardDeleteModeDelete')?.checked === true;
  if (transferWrap) transferWrap.style.display = isDeleteMode ? 'none' : '';
  if (confirmWrap) confirmWrap.style.display = isDeleteMode ? '' : 'none';
}

function confirmUnifiedCardDelete() {
  const cardId = deletingUnifiedCardId;
  if (!cardId) return;
  const month = getCurrentMonth();
  if (!month) return;
  const deleteMode = document.getElementById('unifiedCardDeleteModeDelete')?.checked === true;
  const transferTarget = document.getElementById('unifiedCardDeleteTarget')?.value || '';
  const explicitDeleteConfirmed = document.getElementById('unifiedCardDeleteConfirm')?.checked === true;
  const currentSort = getMonthSortValue(month);
  const linkedCount = data.reduce((acc, targetMonth) => {
    if (getMonthSortValue(targetMonth) < currentSort) return acc;
    ensureUnifiedOutflowPilotMonth(targetMonth);
    return acc + (targetMonth.outflows || []).filter(item => item.outputKind === 'card' && item.outputRef === cardId).length;
  }, 0);
  if (!deleteMode && linkedCount > 0 && !transferTarget) {
    alert('Selecione o cartão de destino para transferir os lançamentos.');
    return;
  }
  if (deleteMode && linkedCount > 0 && !explicitDeleteConfirmed) {
    alert('Confirme a exclusão dos dados vinculados para continuar.');
    return;
  }

  const runDelete = () => {
  recordHistoryState();
  const currentMonth = getCurrentMonth();
  const targetCardModel = transferTarget
    ? ((currentMonth?.outflowCards || []).find(card => card.id === transferTarget) || null)
    : null;
  data.forEach(targetMonth => {
    if (getMonthSortValue(targetMonth) < currentSort) return;
    ensureUnifiedOutflowPilotMonth(targetMonth);
    if (!deleteMode && transferTarget && targetCardModel) {
      const hasTargetCard = (targetMonth.outflowCards || []).some(card => card.id === transferTarget);
      if (!hasTargetCard) {
        targetMonth.outflowCards.push(normalizeUnifiedCard({ ...targetCardModel }));
      }
    }
    if (deleteMode) {
      targetMonth.outflows = (targetMonth.outflows || []).filter(item => !(item.outputKind === 'card' && item.outputRef === cardId));
    } else if (transferTarget) {
      (targetMonth.outflows || []).forEach(item => {
        if (item.outputKind === 'card' && item.outputRef === cardId) {
          item.outputRef = transferTarget;
        }
      });
    }
    const sourceBill = (targetMonth.cardBills || []).find(bill => bill.cardId === cardId);
    if (sourceBill) {
      if (!deleteMode && transferTarget) {
        const targetBill = (targetMonth.cardBills || []).find(bill => bill.cardId === transferTarget);
        if (targetBill) {
          targetBill.amount = getUnifiedCardBillEffectiveAmount(targetMonth, targetBill) + getUnifiedCardBillEffectiveAmount(targetMonth, sourceBill);
          targetBill.manualAmountSet = targetBill.manualAmountSet === true || sourceBill.manualAmountSet === true;
          targetBill.source = targetBill.manualAmountSet === true ? 'manual' : 'forecast';
          targetBill.paid = targetBill.paid === true || sourceBill.paid === true;
        } else {
          targetMonth.cardBills.push(normalizeUnifiedCardBill(targetMonth, {
            cardId: transferTarget,
            amount: getUnifiedCardBillEffectiveAmount(targetMonth, sourceBill),
            manualAmountSet: sourceBill.manualAmountSet === true,
            source: sourceBill.source || (sourceBill.manualAmountSet === true ? 'manual' : 'forecast'),
            paid: sourceBill.paid === true
          }, (targetMonth.cardBills || []).length));
        }
      }
      targetMonth.cardBills = (targetMonth.cardBills || []).filter(bill => bill.cardId !== cardId);
    }
    targetMonth.outflowCards = (targetMonth.outflowCards || []).filter(card => card.id !== cardId);
    syncUnifiedOutflowLegacyData(targetMonth);
  });
  deletingUnifiedCardId = '';
  save(true);
  closeModal('modalUnifiedCardDelete');
  closeModal('modalUnifiedCard');
  preserveCurrentScroll(() => renderMes());
  };

  if (deleteMode && linkedCount > 0) {
    openYesNoQuestion(
      'Tem certeza que deseja excluir todos os dados vinculados desse cartão a partir deste mês?',
      () => runDelete(),
      () => {}
    );
    return;
  }
  runDelete();
}

function saveUnifiedCard() {
  const month = getCurrentMonth();
  ensureUnifiedOutflowPilotMonth(month);
  const bankValue = document.getElementById('unifiedCardBank').value || '';
  const otherBank = document.getElementById('unifiedCardOtherBank').value.trim();
  const name = bankValue === 'outro' ? otherBank : (PATRIMONIO_INSTITUTION_META[bankValue]?.label || '');
  const closing = resolveUnifiedCardDateInput(document.getElementById('unifiedCardClosingDay').value || '', month);
  const payment = resolveUnifiedCardDateInput(document.getElementById('unifiedCardPaymentDay').value || '', month);
  const description = document.getElementById('unifiedCardDescription').value.trim();
  const visualId = bankValue && bankValue !== 'outro' ? normalizeUnifiedCardVisualId(`institution:${bankValue}`) : '';
  if (!name || !closing || !payment) {
    alert('Preencha instituição, fechamento e pagamento como dia (1 a 31) ou data completa.');
    return;
  }
  recordHistoryState();
  const nextCard = normalizeUnifiedCard({
    id: editingUnifiedCardId || '',
    name,
    closingDay: closing.day,
    paymentDay: payment.day,
    closingDate: closing.date,
    paymentDate: payment.date,
    description,
    visualId
  });
  const existingIndex = (month.outflowCards || []).findIndex(entry => entry.id === nextCard.id);
  if (existingIndex >= 0) month.outflowCards[existingIndex] = nextCard;
  else month.outflowCards.push(nextCard);
  const currentSort = getMonthSortValue(month);
  data.forEach(otherMonth => {
    if (getMonthSortValue(otherMonth) < currentSort) return;
    if (otherMonth.id === month.id) return;
    ensureUnifiedOutflowPilotMonth(otherMonth);
    const otherIndex = (otherMonth.outflowCards || []).findIndex(entry => entry.id === nextCard.id);
    const propagatedCard = normalizeUnifiedCard({
      ...nextCard,
      closingDate: getUnifiedCardDateForMonth(nextCard.closingDate, month, otherMonth),
      paymentDate: getUnifiedCardDateForMonth(nextCard.paymentDate, month, otherMonth)
    });
    if (otherIndex >= 0) {
      otherMonth.outflowCards[otherIndex] = propagatedCard;
    } else {
      // Exceção do domínio: criação de cartão em mês passado propaga dali para frente.
      otherMonth.outflowCards.push(propagatedCard);
    }
    const otherBill = getUnifiedCardBill(otherMonth, nextCard.id);
    if (!otherBill) {
      otherMonth.cardBills.push(normalizeUnifiedCardBill(otherMonth, { cardId: nextCard.id }, otherMonth.cardBills.length));
    }
    syncUnifiedOutflowLegacyData(otherMonth);
  });
  ensureUnifiedOutflowPilotMonth(month);
  const existingBill = getUnifiedCardBill(month, nextCard.id);
  if (!existingBill) {
    month.cardBills.push(normalizeUnifiedCardBill(month, { cardId: nextCard.id }, month.cardBills.length));
  }
  syncUnifiedOutflowLegacyData(month);
  save(true);
  closeModal('modalUnifiedCard');
  preserveCurrentScroll(() => renderMes());
}

function showUnifiedOutflowQuickToast(message = 'Adicionado') {
  const el = document.getElementById('unifiedOutflowQuickToast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  if (unifiedOutflowToastTimer) clearTimeout(unifiedOutflowToastTimer);
  unifiedOutflowToastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 1100);
}

function setUnifiedOutflowFloatingButtonVisible(visible) {
  const button = document.getElementById('unifiedOutflowFloatingButton');
  if (!button) return;
  button.classList.toggle('show', visible === true);
}

function collectUnifiedOutflowDescriptionHistory() {
  const map = new Map();
  const pushText = (raw) => {
    const text = String(raw || '').trim();
    if (!text) return;
    const key = text.toLocaleLowerCase('pt-BR');
    if (!map.has(key)) map.set(key, text);
  };
  (data || []).forEach(month => {
    (month?.outflows || []).forEach(item => pushText(item?.description));
    (month?.gastosVar || []).forEach(item => pushText(item?.titulo || item?.nome));
    (month?.despesas || []).forEach(item => pushText(item?.nome || item?.description));
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function renderUnifiedOutflowDescriptionSuggestions(term = '') {
  const container = document.getElementById('unifiedOutflowDescriptionSuggestions');
  if (!container) return;
  const query = String(term || '').trim().toLocaleLowerCase('pt-BR');
  if (!query) {
    container.classList.remove('show');
    container.innerHTML = '';
    return;
  }
  const history = collectUnifiedOutflowDescriptionHistory();
  const startsWith = history.filter(item => item.toLocaleLowerCase('pt-BR').startsWith(query));
  const contains = history.filter(item => {
    const value = item.toLocaleLowerCase('pt-BR');
    return !value.startsWith(query) && value.includes(query);
  });
  const suggestions = startsWith.concat(contains).slice(0, 10);
  if (!suggestions.length) {
    container.classList.remove('show');
    container.innerHTML = '';
    return;
  }
  container.innerHTML = suggestions.map(item => (
    `<button type="button" class="unified-desc-suggestion-item" onclick="selectUnifiedOutflowDescriptionSuggestion('${String(item).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')">${escapeHtml(item)}</button>`
  )).join('');
  container.classList.add('show');
}

function handleUnifiedOutflowDescriptionInput(term = '') {
  if (unifiedOutflowDescriptionSuggestionTimer) {
    clearTimeout(unifiedOutflowDescriptionSuggestionTimer);
    unifiedOutflowDescriptionSuggestionTimer = null;
  }
  renderUnifiedOutflowDescriptionSuggestions(term);
}

function scheduleHideUnifiedOutflowDescriptionSuggestions() {
  if (unifiedOutflowDescriptionSuggestionTimer) clearTimeout(unifiedOutflowDescriptionSuggestionTimer);
  unifiedOutflowDescriptionSuggestionTimer = setTimeout(() => {
    const container = document.getElementById('unifiedOutflowDescriptionSuggestions');
    if (!container) return;
    container.classList.remove('show');
    container.innerHTML = '';
  }, 120);
}

function cancelHideUnifiedOutflowDescriptionSuggestions() {
  if (unifiedOutflowDescriptionSuggestionTimer) {
    clearTimeout(unifiedOutflowDescriptionSuggestionTimer);
    unifiedOutflowDescriptionSuggestionTimer = null;
  }
}

function selectUnifiedOutflowDescriptionSuggestion(value = '') {
  const input = document.getElementById('unifiedOutflowDescription');
  if (!input) return;
  input.value = String(value || '');
  handleUnifiedOutflowDescriptionInput(input.value);
  const container = document.getElementById('unifiedOutflowDescriptionSuggestions');
  if (container) {
    container.classList.remove('show');
    container.innerHTML = '';
  }
  input.focus();
}

function getUnifiedOutflowDraftStorageKey(monthId = '') {
  if (window.MesAtualModals?.getUnifiedOutflowDraftStorageKey) {
    return window.MesAtualModals.getUnifiedOutflowDraftStorageKey(monthId, {
      currentMonthId,
      currentMonth: getCurrentMonth()
    });
  }
  const userId = String(window.__APP_BOOTSTRAP__?.session?.id || 'anonymous').trim() || 'anonymous';
  const safeMonthId = String(monthId || currentMonthId || getCurrentMonth()?.id || 'sem_mes').trim() || 'sem_mes';
  return `finUnifiedOutflowDraft::${userId}::${safeMonthId}`;
}

function readUnifiedOutflowDraft(month) {
  if (window.MesAtualModals?.readUnifiedOutflowDraft) {
    return window.MesAtualModals.readUnifiedOutflowDraft(month, {
      currentMonthId,
      currentMonth: getCurrentMonth()
    });
  }
  try {
    const raw = localStorage.getItem(getUnifiedOutflowDraftStorageKey(month?.id || ''));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function saveUnifiedOutflowDraft(month, draft) {
  if (window.MesAtualModals?.saveUnifiedOutflowDraft) {
    window.MesAtualModals.saveUnifiedOutflowDraft(month, draft, {
      currentMonthId,
      currentMonth: getCurrentMonth()
    });
    return;
  }
  try {
    localStorage.setItem(getUnifiedOutflowDraftStorageKey(month?.id || ''), JSON.stringify(draft || {}));
  } catch {}
}

function clearUnifiedOutflowDraft(month) {
  if (window.MesAtualModals?.clearUnifiedOutflowDraft) {
    window.MesAtualModals.clearUnifiedOutflowDraft(month, {
      currentMonthId,
      currentMonth: getCurrentMonth()
    });
    return;
  }
  try {
    localStorage.removeItem(getUnifiedOutflowDraftStorageKey(month?.id || ''));
  } catch {}
}

function buildUnifiedOutflowDraftFromForm(month) {
  if (window.MesAtualModals?.buildUnifiedOutflowDraftFromForm) {
    return window.MesAtualModals.buildUnifiedOutflowDraftFromForm(month, {
      getCurrentMonth,
      readSharedParticipantsFromDOM: readUnifiedOutflowSharedParticipantsFromDOM
    });
  }
  const safeMonth = month || getCurrentMonth();
  const description = String(document.getElementById('unifiedOutflowDescription')?.value || '').trim();
  const type = normalizeUnifiedOutflowType(document.getElementById('unifiedOutflowType')?.value);
  const category = String(document.getElementById('unifiedOutflowCategory')?.value || '');
  const newCategory = String(document.getElementById('unifiedOutflowNewCategory')?.value || '').trim();
  const amount = String(document.getElementById('unifiedOutflowAmount')?.value || '').trim();
  const outputValue = String(document.getElementById('unifiedOutflowOutput')?.value || 'method:debito').trim();
  const date = String(document.getElementById('unifiedOutflowDate')?.value || '').trim();
  const recurringToggle = document.getElementById('unifiedOutflowRecurringToggle')?.checked === true;
  const installmentsToggle = document.getElementById('unifiedOutflowInstallmentsToggle')?.checked === true;
  const installmentsCount = String(document.getElementById('unifiedOutflowInstallmentsCount')?.value || '2').trim();
  const tag = String(document.getElementById('unifiedOutflowTag')?.value || '');
  const newTag = String(document.getElementById('unifiedOutflowNewTagInline')?.value || '').trim();
  const sharedToggle = document.getElementById('unifiedOutflowSharedToggle')?.checked === true;
  const sharedPeopleCount = String(document.getElementById('unifiedOutflowSharedPeopleCount')?.value || '2').trim();
  const sharedMode = document.getElementById('unifiedOutflowSharedMode')?.value === 'manual' ? 'manual' : 'equal';
  const sharedParticipants = readUnifiedOutflowSharedParticipantsFromDOM();

  return {
    monthId: safeMonth?.id || '',
    description,
    type,
    category,
    newCategory,
    amount,
    outputValue,
    date,
    recurringToggle,
    installmentsToggle,
    installmentsCount,
    tag,
    newTag,
    sharedToggle,
    sharedPeopleCount,
    sharedMode,
    sharedParticipants,
    updatedAt: Date.now()
  };
}

function applyUnifiedOutflowDraftToForm(month, draft) {
  if (window.MesAtualModals?.applyUnifiedOutflowDraftToForm) {
    return window.MesAtualModals.applyUnifiedOutflowDraftToForm(month, draft, {
      populateCategoryOptions: populateUnifiedOutflowCategoryOptions,
      resolveDefaultCategory: resolveCategoryName,
      toggleNewCategory: toggleUnifiedOutflowNewCategory,
      getOutputOptions: getUnifiedOutflowOutputOptions,
      populateTagOptions: populateUnifiedOutflowTagOptions,
      toggleNewTag: toggleUnifiedOutflowNewTag,
      toggleInstallments: toggleUnifiedOutflowInstallments,
      handleTypeChange: handleUnifiedOutflowTypeChange,
      renderSharedPeople: renderUnifiedOutflowSharedPeople,
      renderDescriptionSuggestions: renderUnifiedOutflowDescriptionSuggestions
    });
  }
  if (!draft || typeof draft !== 'object') return false;
  const descriptionInput = document.getElementById('unifiedOutflowDescription');
  if (descriptionInput) descriptionInput.value = String(draft.description || '');
  document.getElementById('unifiedOutflowType').value = normalizeUnifiedOutflowType(draft.type) === 'spend' ? 'spend' : 'expense';
  populateUnifiedOutflowCategoryOptions(month, String(draft.category || resolveCategoryName('COMPRAS') || ''));
  document.getElementById('unifiedOutflowNewCategory').value = String(draft.newCategory || '');
  toggleUnifiedOutflowNewCategory();
  document.getElementById('unifiedOutflowAmount').value = String(draft.amount || '');
  document.getElementById('unifiedOutflowOutput').innerHTML = getUnifiedOutflowOutputOptions(month, String(draft.outputValue || 'method:debito'));
  document.getElementById('unifiedOutflowDate').value = String(draft.date || '');
  document.getElementById('unifiedOutflowRecurringToggle').checked = draft.recurringToggle === true;
  document.getElementById('unifiedOutflowInstallmentsToggle').checked = draft.installmentsToggle === true;
  document.getElementById('unifiedOutflowInstallmentsCount').value = String(draft.installmentsCount || '2');
  populateUnifiedOutflowTagOptions(String(draft.tag || ''));
  document.getElementById('unifiedOutflowNewTagInline').value = String(draft.newTag || '');
  toggleUnifiedOutflowNewTag();
  const sharedToggle = document.getElementById('unifiedOutflowSharedToggle');
  const sharedCount = document.getElementById('unifiedOutflowSharedPeopleCount');
  const sharedMode = document.getElementById('unifiedOutflowSharedMode');
  if (sharedToggle) sharedToggle.checked = draft.sharedToggle === true;
  if (sharedCount) sharedCount.value = String(draft.sharedPeopleCount || '2');
  if (sharedMode) sharedMode.value = draft.sharedMode === 'manual' ? 'manual' : 'equal';
  toggleUnifiedOutflowInstallments();
  handleUnifiedOutflowTypeChange();
  if (sharedToggle?.checked) renderUnifiedOutflowSharedPeople(Array.isArray(draft.sharedParticipants) ? draft.sharedParticipants : []);
  renderUnifiedOutflowDescriptionSuggestions(descriptionInput?.value || '');
  return true;
}

function scheduleUnifiedOutflowDraftSave() {
  if (editingUnifiedOutflowId) return;
  const modal = document.getElementById('modalUnifiedOutflow');
  if (!modal?.classList.contains('open') && !unifiedOutflowModalMinimized) return;
  if (unifiedOutflowDraftSaveTimer) clearTimeout(unifiedOutflowDraftSaveTimer);
  unifiedOutflowDraftSaveTimer = setTimeout(() => {
    const month = getCurrentMonth();
    if (!month) return;
    saveUnifiedOutflowDraft(month, buildUnifiedOutflowDraftFromForm(month));
  }, 180);
}

function bindUnifiedOutflowDraftListeners() {
  if (unifiedOutflowDraftListenersBound) return;
  const dialog = document.getElementById('modalUnifiedOutflowDialog');
  if (!dialog) return;
  const handler = (event) => {
    const target = event?.target;
    if (!target || !(target instanceof Element)) return;
    if (!target.closest('#modalUnifiedOutflowDialog')) return;
    scheduleUnifiedOutflowDraftSave();
  };
  dialog.addEventListener('input', handler, true);
  dialog.addEventListener('change', handler, true);
  unifiedOutflowDraftListenersBound = true;
}

function fillUnifiedOutflowFormFromItem(month, item) {
  const submitButton = document.getElementById('unifiedOutflowSubmitBtn');
  if (submitButton) submitButton.textContent = editingUnifiedOutflowId ? 'Salvar' : 'Adicionar';
  const descriptionInput = document.getElementById('unifiedOutflowDescription');
  if (descriptionInput) descriptionInput.value = item?.description || '';
  const preferredSpendCategory = resolveCategoryName('COMPRAS') || 'OUTROS';
  document.getElementById('unifiedOutflowType').value = item ? normalizeUnifiedOutflowType(item?.type || 'expense') : 'spend';
  populateUnifiedOutflowCategoryOptions(month, item?.category || preferredSpendCategory);
  document.getElementById('unifiedOutflowNewCategory').value = '';
  toggleUnifiedOutflowNewCategory();
  populateUnifiedOutflowTagOptions(item?.tag || '');
  const inlineTagInput = document.getElementById('unifiedOutflowNewTagInline');
  if (inlineTagInput) inlineTagInput.value = '';
  toggleUnifiedOutflowNewTag();
  const editAmount = item?.sharedExpense === true
    ? Math.max(0, Number(item?.sharedOriginalAmount || item?.amount || 0) || 0)
    : Number(item?.amount || 0);
  document.getElementById('unifiedOutflowAmount').value = editAmount > 0 ? editAmount : '';
  const outputValue = item
    ? (item.outputKind === 'method' ? `method:${item.outputMethod}` : `${item.outputKind}:${item.outputRef}`)
    : 'method:debito';
  document.getElementById('unifiedOutflowOutput').innerHTML = getUnifiedOutflowOutputOptions(month, outputValue);
  const today = new Date();
  const currentDateMask = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getFullYear()).slice(-2)}`;
  document.getElementById('unifiedOutflowDate').value = item
    ? (isUnifiedExpenseType(item) || item?.recurringSpend === true
      ? getUnifiedOutflowBillingDisplayValue(item)
      : (item?.date || ''))
    : currentDateMask;
  document.getElementById('unifiedOutflowRecurringToggle').checked = item?.recurringSpend === true || item?.expenseRecurring === true;
  document.getElementById('unifiedOutflowInstallmentsToggle').checked = !!(item?.installmentsTotal > 1);
  document.getElementById('unifiedOutflowInstallmentsCount').value = item?.installmentsTotal > 1 ? item.installmentsTotal : 2;
  const sharedToggle = document.getElementById('unifiedOutflowSharedToggle');
  const sharedCount = document.getElementById('unifiedOutflowSharedPeopleCount');
  const sharedMode = document.getElementById('unifiedOutflowSharedMode');
  if (sharedToggle) sharedToggle.checked = item?.sharedExpense === true;
  if (sharedCount) {
    const countFromItem = Array.isArray(item?.sharedParticipants) && item.sharedParticipants.length
      ? item.sharedParticipants.length
      : 2;
    sharedCount.value = Math.max(1, Math.min(20, Number(countFromItem || 2) || 2));
  }
  if (sharedMode) sharedMode.value = String(item?.sharedSplitMode || 'equal').toLowerCase() === 'manual' ? 'manual' : 'equal';
  toggleUnifiedOutflowInstallments();
  handleUnifiedOutflowTypeChange();
  if (sharedToggle?.checked) {
    renderUnifiedOutflowSharedPeople(item?.sharedParticipants || []);
  }
  if (!item) {
    const draft = readUnifiedOutflowDraft(month);
    applyUnifiedOutflowDraftToForm(month, draft);
  }
  renderUnifiedOutflowDescriptionSuggestions(descriptionInput?.value || '');
  if (!editingUnifiedOutflowId) {
    scheduleUnifiedOutflowDraftSave();
  }
}

function minimizeUnifiedOutflowModal() {
  if (window.__unifiedOutflowSimpleEditMode === true) return;
  if (!editingUnifiedOutflowId) {
    const month = getCurrentMonth();
    if (month) {
      saveUnifiedOutflowDraft(month, buildUnifiedOutflowDraftFromForm(month));
    }
  }
  unifiedOutflowModalMinimized = true;
  closeModal('modalUnifiedOutflow');
  setUnifiedOutflowFloatingButtonVisible(true);
}

function restoreUnifiedOutflowModal() {
  unifiedOutflowModalMinimized = false;
  setUnifiedOutflowFloatingButtonVisible(false);
  openModal('modalUnifiedOutflow');
  renderUnifiedOutflowModalRecentList();
}

function closeUnifiedOutflowModal() {
  const shouldReturnToCategoryEditor = window.__unifiedOutflowReturnToCategoryEditor === true
    && window.__unifiedOutflowSimpleEditMode === true;
  if (!editingUnifiedOutflowId) {
    const month = getCurrentMonth();
    if (month) {
      saveUnifiedOutflowDraft(month, buildUnifiedOutflowDraftFromForm(month));
    }
  }
  unifiedOutflowModalMinimized = false;
  setUnifiedOutflowModalMode(false);
  closeModal('modalUnifiedOutflow');
  setUnifiedOutflowFloatingButtonVisible(false);
  if (shouldReturnToCategoryEditor && typeof openCategoryEditorModal === 'function') {
    window.__unifiedOutflowReturnToCategoryEditor = false;
    requestAnimationFrame(() => {
      openCategoryEditorModal();
    });
    return;
  }
  window.__unifiedOutflowReturnToCategoryEditor = false;
}

function setUnifiedOutflowModalMode(isSimpleEditMode) {
  const modalBg = document.getElementById('modalUnifiedOutflow');
  const dialog = document.getElementById('modalUnifiedOutflowDialog');
  if (!modalBg || !dialog) return;
  const editMode = isSimpleEditMode === true;
  modalBg.classList.toggle('unified-outflow-simple-edit', editMode);
  dialog.classList.toggle('unified-outflow-edit-mode', editMode);
  window.__unifiedOutflowSimpleEditMode = editMode;
}

function getUnifiedOutflowRowsForRecentList(month) {
  return (month?.outflows || [])
    .slice()
    .sort((a, b) => {
      const aTail = isUnifiedExpenseType(a) || a?.recurringSpend === true;
      const bTail = isUnifiedExpenseType(b) || b?.recurringSpend === true;
      if (aTail !== bTail) return aTail ? 1 : -1;
      const createdDiff = new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
      if (createdDiff !== 0) return createdDiff;
      const dateDiff = parseData(b?.date || '') - parseData(a?.date || '');
      if (dateDiff !== 0) return dateDiff;
      return String(b?.id || '').localeCompare(String(a?.id || ''), 'pt-BR');
    });
}

function renderUnifiedOutflowModalRecentList() {
  const wrap = document.getElementById('unifiedOutflowRecentList');
  if (!wrap) return;
  const month = getCurrentMonth();
  ensureUnifiedOutflowPilotMonth(month);
  const rows = getUnifiedOutflowRowsForRecentList(month);
  if (!rows.length) {
    wrap.innerHTML = '<div class="text-muted" style="font-size:12px;padding:6px 4px">Nenhum lançamento neste mês.</div>';
    return;
  }
  wrap.innerHTML = rows.map(item => `
    <div class="unified-outflow-recent-item" onclick="copyUnifiedOutflowIntoForm('${String(item.id).replace(/'/g, "\\'")}')">
      <div class="unified-outflow-recent-item-name">${escapeHtml(item.description || 'Sem descrição')}</div>
      <div class="unified-outflow-recent-item-date">${escapeHtml(item.date || '—')}</div>
      <div class="unified-outflow-recent-item-value">${fmt(item.amount || 0)}</div>
      <button class="unified-outflow-recent-item-remove" type="button" onclick="event.stopPropagation();deleteUnifiedOutflowFromModalList('${String(item.id).replace(/'/g, "\\'")}')">✕</button>
    </div>
  `).join('');
}

function copyUnifiedOutflowIntoForm(outflowId) {
  const month = getCurrentMonth();
  ensureUnifiedOutflowPilotMonth(month);
  const item = (month.outflows || []).find(entry => entry.id === outflowId);
  if (!item) return;
  editingUnifiedOutflowId = '';
  window.__unifiedOutflowReturnToCategoryEditor = false;
  document.getElementById('modalUnifiedOutflowTitle').textContent = 'Adicionar gasto ou despesa';
  fillUnifiedOutflowFormFromItem(month, item);
  setUnifiedOutflowModalMode(false);
  showUnifiedOutflowQuickToast('Dados copiados');
}

function deleteUnifiedOutflowFromModalList(outflowId) {
  deleteUnifiedOutflow(outflowId);
  renderUnifiedOutflowModalRecentList();
}

function canPropagateRecurringFromMonth(month) {
  if (window.MesAtualRecurrence?.canPropagateRecurringFromMonth) {
    return window.MesAtualRecurrence.canPropagateRecurringFromMonth(month);
  }
  const currentRealMonthId = getCurrentRealMonthId(true);
  const currentRealMonth = (data || []).find(entry => entry.id === currentRealMonthId);
  if (!currentRealMonth) return true;
  return getMonthSortValue(month) >= getMonthSortValue(currentRealMonth);
}

function getIncomeRecurringGroupId(item, fallbackName = '') {
  const existing = String(item?.recurringGroupId || '').trim();
  if (existing) return existing;
  const normalized = normalizeIncomeName(String(item?.fonte || fallbackName || 'RENDA'));
  return `rin_${normalized.replace(/[^A-Z0-9]+/g, '_')}`;
}

function getRecurringIncomeChangedFields(previousItem, nextItem) {
  const before = {
    fonte: String(previousItem?.fonte || ''),
    valor: Number(previousItem?.valor || 0),
    paid: previousItem?.paid === true,
    includeInTotals: previousItem?.includeInTotals !== false,
    dataRecebimento: String(previousItem?.dataRecebimento || ''),
    recurringFixed: previousItem?.recurringFixed !== false
  };
  const after = {
    fonte: String(nextItem?.fonte || ''),
    valor: Number(nextItem?.valor || 0),
    paid: nextItem?.paid === true,
    includeInTotals: nextItem?.includeInTotals !== false,
    dataRecebimento: String(nextItem?.dataRecebimento || ''),
    recurringFixed: nextItem?.recurringFixed !== false
  };
  return Object.keys(after).filter(key => before[key] !== after[key]);
}

function applyRecurringIncomeForwardChanges(baseMonth, groupId, sourceIncome, changedFields = []) {
  const sourceSort = getMonthSortValue(baseMonth);
  const fields = Array.isArray(changedFields) ? changedFields : [];
  const sourceNameKey = normalizeIncomeName(sourceIncome?.fonte || '');
  data.forEach(month => {
    if (getMonthSortValue(month) <= sourceSort) return;
    normalizeMonth(month);
    const target = (month.renda || []).find(item => {
      const sameGroup = getIncomeRecurringGroupId(item) === groupId;
      const sameName = sourceNameKey && normalizeIncomeName(item?.fonte || '') === sourceNameKey;
      return sameGroup || sameName;
    });
    if (!target) {
      const clone = {
        fonte: String(sourceIncome?.fonte || '').trim(),
        valor: Number(sourceIncome?.valor || 0) || 0,
        paid: false,
        includeInTotals: sourceIncome?.includeInTotals !== false,
        patrimonioMovementId: '',
        dataRecebimento: String(sourceIncome?.dataRecebimento || ''),
        recurringFixed: sourceIncome?.recurringFixed !== false,
        recurringGroupId: groupId
      };
      month.renda.push(clone);
      recalcTotals(month);
      return;
    }
    fields.forEach(field => {
      if (field === 'paid') {
        target.paid = false;
        return;
      }
      target[field] = sourceIncome[field];
    });
    target.recurringGroupId = groupId;
    if (target.recurringFixed === undefined) target.recurringFixed = true;
    recalcTotals(month);
  });
}

function removeRecurringIncomeForward(baseMonth, groupId, sourceName = '') {
  const sourceSort = getMonthSortValue(baseMonth);
  const sourceNameKey = normalizeIncomeName(sourceName);
  data.forEach(month => {
    if (getMonthSortValue(month) <= sourceSort) return;
    normalizeMonth(month);
    const before = month.renda.length;
    month.renda = (month.renda || []).filter(item => {
      const sameGroup = getIncomeRecurringGroupId(item) === groupId;
      const sameName = sourceNameKey && normalizeIncomeName(item?.fonte || '') === sourceNameKey;
      return !(sameGroup || sameName);
    });
    if (month.renda.length !== before) recalcTotals(month);
  });
}

function openUnifiedOutflowModal(outflowId = '', context = {}) {
  const month = getCurrentMonth();
  ensureUnifiedOutflowPilotMonth(month);
  const item = (month.outflows || []).find(entry => entry.id === outflowId) || null;
  window.__unifiedOutflowReturnToCategoryEditor = context?.fromCategoryEditor === true;
  editingUnifiedOutflowId = item?.id || '';
  document.getElementById('modalUnifiedOutflowTitle').textContent = item ? 'Editar gasto ou despesa' : 'Adicionar gasto ou despesa';
  bindUnifiedOutflowDraftListeners();
  fillUnifiedOutflowFormFromItem(month, item);
  unifiedOutflowModalMinimized = false;
  setUnifiedOutflowModalMode(Boolean(item));
  setUnifiedOutflowFloatingButtonVisible(false);
  openModal('modalUnifiedOutflow');
  renderUnifiedOutflowModalRecentList();
}

function getMonthDateFromMonthObject(month) {
  const monthName = getMonthName(month);
  const year = Number.parseInt(getYear(month), 10) || new Date().getFullYear();
  return new Date(year, MONTH_INDEX[monthName] ?? 0, 1);
}

function addMonthsToMonthObject(month, offset) {
  const base = getMonthDateFromMonthObject(month);
  return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}

function cloneUnifiedOutflowForMonth(item, targetDate, sourceMonth = null) {
  const isDirectRealOutflow = item?.outputKind === 'method' && ['pix', 'dinheiro', 'debito'].includes(item?.outputMethod);
  const clone = normalizeUnifiedOutflowItem({
    ...item,
    id: '',
    paid: isDirectRealOutflow,
    status: item.type === 'spend' ? item.status : 'planned',
    createdAt: new Date().toISOString()
  });
  if (clone.installmentsTotal > 1) {
    clone.installmentIndex = Math.min(clone.installmentsTotal, Number(item.installmentIndex || 1) + 1);
  }
  if (clone.installmentsTotal > 1 && clone.outputKind === 'card' && clone.outputRef) {
    const referenceMonth = sourceMonth || getCurrentMonth();
    const referenceCard = (referenceMonth?.outflowCards || []).find(entry => entry.id === clone.outputRef);
    const closingDay = Math.max(1, Math.min(31, Number(referenceCard?.closingDay || 1) || 1));
    const maxDay = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    const nextDay = Math.min(closingDay, maxDay);
    clone.date = `${String(nextDay).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}/${String(targetDate.getFullYear()).slice(-2)}`;
  } else if (isUnifiedExpenseType(clone) && clone.outputKind !== 'card') {
    if (window.MesAtualOutflowExpenseDate?.getExpenseDateForTargetMonth) {
      const resolved = window.MesAtualOutflowExpenseDate.getExpenseDateForTargetMonth(clone.date || '', sourceMonth || getCurrentMonth(), targetDate);
      if (resolved) clone.date = resolved;
    } else {
      const normalized = normalizeVarDate(clone.date || '');
      if (normalized) {
        const [day] = normalized.split('/');
        const monthName = Object.keys(MONTH_INDEX).find(name => MONTH_INDEX[name] === targetDate.getMonth()) || 'JANEIRO';
        const monthRef = { nome: `${monthName} ${targetDate.getFullYear()}` };
        clone.date = buildUnifiedFixedBillingDate(String(Number(day || 1)), monthRef);
      }
    }
  } else if (clone.date) {
    const normalized = normalizeVarDate(clone.date);
    if (normalized) {
      const [day] = normalized.split('/');
      const maxDay = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
      const nextDay = Math.min(Number(day || 1), maxDay);
      clone.date = `${String(nextDay).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}/${String(targetDate.getFullYear()).slice(-2)}`;
    }
  }
  return clone;
}

function buildUnifiedPilotMonthFromPrevious(prev, newMonthName) {
  const date = new Date(Number(newMonthName.split(' ')[1]), MONTH_INDEX[newMonthName.split(' ')[0]] ?? 0, 1);
  const month = buildBlankMonth(date);
  month.nome = newMonthName;
  month.id = getMonthIdFromParts(getMonthName(month), getYear(month));
  normalizeMonth(month);
  normalizeMonth(prev);
  ensureUnifiedOutflowPilotMonth(prev);
  month.outflowCards = (prev.outflowCards || []).map(card => normalizeUnifiedCard({ ...card }));
  month.cardBills = month.outflowCards.map((card, idx) => {
    const prevBill = getUnifiedCardBill(prev, card.id);
    return normalizeUnifiedCardBill(month, {
      cardId: card.id,
      amount: 0,
      forecastAmount: prevBill?.manualAmountSet === true ? Number(prevBill?.amount || 0) : 0,
      manualAmountSet: false,
      source: 'forecast',
      paid: false
    }, idx);
  });
  month.outflows = (prev.outflows || []).flatMap(item => {
    if (item.installmentsTotal > 1 && item.installmentIndex < item.installmentsTotal) {
      return [cloneUnifiedOutflowForMonth(item, date, prev)];
    }
    if (isUnifiedExpenseType(item) && item.installmentsTotal <= 1) {
      return [cloneUnifiedOutflowForMonth(item, date, prev)];
    }
    if (item.type === 'spend' && item.recurringSpend === true && item.installmentsTotal <= 1) {
      return [cloneUnifiedOutflowForMonth(item, date, prev)];
    }
    return [];
  });
  month.dailyCategorySeeds = getUsedDailyGoalCategoriesFromMonth(prev);
  month.dailyGoals = {};
  ensureUnifiedOutflowPilotMonth(month);
  return month;
}

function getProjetoRecurringGroupId(item, fallbackName = '') {
  const existing = String(item?.recurringGroupId || '').trim();
  if (existing) return existing;
  const normalized = normalizeIncomeName(String(item?.nome || fallbackName || 'RENDA_EXTRA'));
  return `proj_${normalized.replace(/[^A-Z0-9]+/g, '_')}`;
}

function getMonthNameFromDate(date) {
  return Object.keys(MONTH_INDEX).find(name => MONTH_INDEX[name] === date.getMonth()) || 'JANEIRO';
}

function ensureUnifiedMonthByDate(targetDate) {
  const monthName = getMonthNameFromDate(targetDate);
  const monthId = getMonthIdFromParts(monthName, targetDate.getFullYear());
  let month = (data || []).find(entry => entry?.id === monthId);
  if (month) return month;
  month = buildSmartMonthForSelection(monthName, targetDate.getFullYear());
  if (!month?.id) month.id = monthId;
  if (!month?.nome) month.nome = `${monthName} ${targetDate.getFullYear()}`;
  data.push(month);
  sortDataChronologically();
  return (data || []).find(entry => entry?.id === monthId) || month;
}

function cloneProjetoRecurringForMonth(sourceProject, targetDate, installmentIndex) {
  const normalizedDate = normalizeFlexibleDateInput(String(sourceProject?.dataRecebimento || ''), {
    nome: `${getMonthNameFromDate(targetDate)} ${targetDate.getFullYear()}`
  }, { simpleDayMonthOffset: 0 }) || String(sourceProject?.dataRecebimento || '');
  return {
    nome: String(sourceProject?.nome || '').trim(),
    valor: Number(sourceProject?.valor || 0) || 0,
    paid: false,
    includeInTotals: sourceProject?.includeInTotals !== false,
    patrimonioMovementId: '',
    dataRecebimento: normalizedDate,
    recurringExtra: true,
    recurringInstallmentsTotal: Math.max(2, Number(sourceProject?.recurringInstallmentsTotal || 2) || 2),
    recurringInstallmentIndex: Math.max(1, Number(installmentIndex || 1) || 1),
    recurringGroupId: getProjetoRecurringGroupId(sourceProject, sourceProject?.nome || 'RENDA_EXTRA')
  };
}

function removeProjetoRecurringForward(baseMonth, groupId) {
  const sourceSort = getMonthSortValue(baseMonth);
  data.forEach(month => {
    if (getMonthSortValue(month) <= sourceSort) return;
    const before = (month?.projetos || []).length;
    month.projetos = (month?.projetos || []).filter(item => String(item?.recurringGroupId || '').trim() !== groupId);
    if ((month?.projetos || []).length !== before) recalcTotals(month);
  });
}

function applyProjetoRecurringForwardChanges(baseMonth, sourceProject) {
  const groupId = getProjetoRecurringGroupId(sourceProject, sourceProject?.nome || 'RENDA_EXTRA');
  const total = Math.max(2, Number(sourceProject?.recurringInstallmentsTotal || 2) || 2);
  removeProjetoRecurringForward(baseMonth, groupId);
  for (let offset = 1; offset < total; offset += 1) {
    const futureDate = addMonthsToMonthObject(baseMonth, offset);
    const futureMonth = ensureUnifiedMonthByDate(futureDate);
    if (!futureMonth) continue;
    const clone = cloneProjetoRecurringForMonth(sourceProject, futureDate, offset + 1);
    futureMonth.projetos = Array.isArray(futureMonth.projetos) ? futureMonth.projetos : [];
    const existingIdx = futureMonth.projetos.findIndex(item => String(item?.recurringGroupId || '').trim() === groupId && Number(item?.recurringInstallmentIndex || 0) === clone.recurringInstallmentIndex);
    if (existingIdx >= 0) futureMonth.projetos[existingIdx] = clone;
    else futureMonth.projetos.push(clone);
    recalcTotals(futureMonth);
  }
}

function buildSmartMonthForSelection(monthName, year) {
  if (!isUnifiedMonthPilotEnabled()) {
    return buildBlankMonth(new Date(Number(year), MONTH_INDEX[monthName] ?? 0, 1));
  }
  const targetName = `${monthName} ${year}`;
  const targetSortValue = getMonthSortValue({ nome: targetName });
  const previousMonths = data.filter(entry => getMonthSortValue(entry) < targetSortValue);
  const prev = previousMonths[previousMonths.length - 1] || null;
  if (!prev) return buildBlankMonth(new Date(Number(year), MONTH_INDEX[monthName] ?? 0, 1));
  return buildUnifiedPilotMonthFromPrevious(prev, targetName);
}

function saveUnifiedOutflow() {
  const month = getCurrentMonth();
  ensureUnifiedOutflowPilotMonth(month);
  const wasEditing = Boolean(editingUnifiedOutflowId);
  const previousItem = editingUnifiedOutflowId
    ? (month.outflows || []).find(entry => entry.id === editingUnifiedOutflowId) || null
    : null;
  const description = document.getElementById('unifiedOutflowDescription').value.trim();
  const requestedType = normalizeUnifiedOutflowType(document.getElementById('unifiedOutflowType').value);
  let category = document.getElementById('unifiedOutflowCategory').value;
  if (category === 'nova') category = document.getElementById('unifiedOutflowNewCategory').value.trim();
  category = resolveCategoryName(category || 'OUTROS');
  if (typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(category)) {
    category = 'OUTROS';
  }
  let tag = document.getElementById('unifiedOutflowTag').value;
  if (tag === 'nova') tag = String(document.getElementById('unifiedOutflowNewTagInline')?.value || '').trim();
  const amount = Number(document.getElementById('unifiedOutflowAmount').value || 0);
  const output = parseUnifiedOutflowOutputValue(document.getElementById('unifiedOutflowOutput').value || '');
  const type = output.outputKind === 'card' ? 'spend' : requestedType;
  const recurringToggleChecked = document.getElementById('unifiedOutflowRecurringToggle').checked;
  const recurringSpend = type === 'spend' && recurringToggleChecked;
  const expenseRecurring = type === 'expense' && recurringToggleChecked;
  const rawDateValue = document.getElementById('unifiedOutflowDate').value || '';
  const usesBillingDay = recurringSpend || expenseRecurring;
  let resolvedExpenseDate = '';
  if (type === 'expense') {
    const date = resolveUnifiedExpenseDateInput(rawDateValue, month);
    if (!date) {
      alert('Informe a data da cobrança como dia (1 a 31) ou data completa (dd/mm/aa).');
      return;
    }
    resolvedExpenseDate = date;
  } else if (usesBillingDay) {
    const date = normalizeFlexibleDateInput(rawDateValue, month, { simpleDayMonthOffset: 1 });
    if (!date) {
      alert('Preencha a data de cobrança como dia (1 a 31) ou data completa (dd/mm/aa).');
      return;
    }
  }
  const date = type === 'expense'
    ? resolvedExpenseDate
    : (usesBillingDay
    ? normalizeFlexibleDateInput(rawDateValue, month, { simpleDayMonthOffset: 1 })
    : normalizeUnifiedOutflowSpendDateInput(rawDateValue, month));
  const status = type === 'expense' ? 'planned' : 'done';
  const isInstallment = document.getElementById('unifiedOutflowInstallmentsToggle').checked;
  const installmentsTotal = isInstallment ? Math.max(2, Number(document.getElementById('unifiedOutflowInstallmentsCount').value || 2)) : 1;
  const isDirectRealOutflow = output.outputKind === 'method' && ['pix', 'dinheiro', 'debito'].includes(output.outputMethod);
  if (!description || !category || !(amount > 0)) {
    alert('Preencha descrição, categoria e valor corretamente.');
    return;
  }
  let sharedState = {
    enabled: false,
    ownerShare: amount,
    othersShare: 0,
    participants: [],
    mode: 'equal'
  };
  if (type === 'spend' || type === 'expense') {
    try {
      sharedState = collectUnifiedOutflowSharedFromForm(amount);
    } catch (error) {
      alert(error?.message || 'Não foi possível validar a divisão do gasto compartilhado.');
      return;
    }
  }
  const baseItem = normalizeUnifiedOutflowItem({
    id: editingUnifiedOutflowId || '',
    description,
    type,
    category,
    tag,
    amount: sharedState.enabled ? sharedState.ownerShare : amount,
    ...output,
    date,
    recurringSpend,
    expenseRecurring,
    status,
    paid: editingUnifiedOutflowId
      ? ((month.outflows || []).find(entry => entry.id === editingUnifiedOutflowId)?.paid === true)
      : isDirectRealOutflow,
    installmentsTotal,
    installmentIndex: editingUnifiedOutflowId ? ((month.outflows || []).find(entry => entry.id === editingUnifiedOutflowId)?.installmentIndex || 1) : 1,
    installmentsGroupId: editingUnifiedOutflowId ? ((month.outflows || []).find(entry => entry.id === editingUnifiedOutflowId)?.installmentsGroupId || '') : (installmentsTotal > 1 ? `inst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` : ''),
    recurringGroupId: (expenseRecurring || recurringSpend) && installmentsTotal <= 1
      ? (editingUnifiedOutflowId ? ((month.outflows || []).find(entry => entry.id === editingUnifiedOutflowId)?.recurringGroupId || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`) : `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`)
      : '',
    sharedExpense: sharedState.enabled,
    sharedSplitMode: sharedState.mode,
    sharedOriginalAmount: amount,
    sharedOwnerName: getOwnerDisplayName(),
    sharedOthersAmount: sharedState.othersShare,
    sharedParticipants: sharedState.participants
  });
  const existingIndex = (month.outflows || []).findIndex(entry => entry.id === baseItem.id);
  const seriesKey = baseItem.installmentsGroupId || baseItem.recurringGroupId;
  const changedFields = previousItem ? getRecurringChangedFields(previousItem, baseItem) : [];

  const persistOutflowSave = (applyForward) => {
    recordHistoryState();
    if (existingIndex >= 0) month.outflows[existingIndex] = baseItem;
    else month.outflows.push(baseItem);
    if (seriesKey) clearRecurringSeriesStopFromMonth(month, seriesKey);

    if (editingUnifiedOutflowId && seriesKey && applyForward && changedFields.length && canPropagateRecurringFromMonth(month)) {
      applyRecurringForwardChanges(month, seriesKey, baseItem, changedFields, previousItem || baseItem);
    }

    if (!editingUnifiedOutflowId && installmentsTotal > 1) {
      for (let offset = 1; offset < installmentsTotal; offset += 1) {
        const futureDate = addMonthsToMonthObject(month, offset);
        const futureId = getMonthIdFromParts(Object.keys(MONTH_INDEX)[futureDate.getMonth()], futureDate.getFullYear());
        const futureMonth = data.find(entry => entry.id === futureId);
        if (!futureMonth) continue;
        ensureUnifiedOutflowPilotMonth(futureMonth);
        futureMonth.outflows.push(cloneUnifiedOutflowForMonth({ ...baseItem, installmentIndex: offset }, futureDate, month));
      }
    }
    if (!editingUnifiedOutflowId && (expenseRecurring || recurringSpend) && installmentsTotal <= 1) {
      const currentSort = getMonthSortValue(month);
      data.forEach(otherMonth => {
        if (getMonthSortValue(otherMonth) <= currentSort) return;
        ensureUnifiedOutflowPilotMonth(otherMonth);
        const futureDate = getMonthDateFromMonthObject(otherMonth);
        otherMonth.outflows.push(cloneUnifiedOutflowForMonth(baseItem, futureDate, month));
        syncUnifiedCardBillForecastAmounts(otherMonth);
        syncUnifiedOutflowLegacyData(otherMonth);
      });
    }

    syncUnifiedCardBillForecastAmounts(month);
    syncUnifiedOutflowLegacyData(month);
    save(true);
    preserveCurrentScroll(() => renderMes());
    renderUnifiedOutflowModalRecentList();
    const savedLabel = String(baseItem?.name || '').trim() || 'Lançamento';
    showUnifiedOutflowQuickToast(
      editingUnifiedOutflowId
        ? `${savedLabel} atualizado`
        : `${savedLabel} adicionado`
    );
    if (!wasEditing) {
      clearUnifiedOutflowDraft(month);
      const sharedToggleEl = document.getElementById('unifiedOutflowSharedToggle');
      if (sharedToggleEl) {
        sharedToggleEl.checked = false;
        toggleUnifiedOutflowSharedSection();
      }
    }
    if (wasEditing) {
      closeUnifiedOutflowModal();
      editingUnifiedOutflowId = '';
    }
  };

  if (editingUnifiedOutflowId && seriesKey && changedFields.length && canPropagateRecurringFromMonth(month)) {
    openRecurringChangeScopeModal({
      onThisMonth: () => persistOutflowSave(false),
      onForward: () => persistOutflowSave(true),
      onCancel: () => {}
    });
    return;
  }

  persistOutflowSave(false);
  if (!editingUnifiedOutflowId) {
    document.getElementById('modalUnifiedOutflowTitle').textContent = 'Adicionar gasto ou despesa';
  }
}


function renderMes() {
  const m = getCurrentMonth();
  ensureInheritedDailyGoalCategoriesAcrossData();
  if (m?.id && unifiedLastRenderedMonthId !== m.id) {
    resetUnifiedOutflowViewForMonth(m);
    unifiedLastRenderedMonthId = m.id;
  }
  const projetosTitle = sectionTitles.projetos || (isPrimaryUserEnvironment() ? 'Projetos / entradas extras' : 'Renda extra');
  const unifiedPilotEnabled = isUnifiedMonthPilotEnabled();
  normalizeMonth(m);
  ensureRecurringIncomeNextMonthScheduleAcrossData();
  if (unifiedPilotEnabled) ensureUnifiedOutflowPilotMonth(m);
  if (ensureInheritedDailyGoalCategories(m)) {
    if (unifiedPilotEnabled) syncUnifiedOutflowLegacyData(m);
    save();
  }
  if (unifiedPilotEnabled && unifiedOutflowDefaultFilterPending) {
    if (!m.unifiedOutflowUi || typeof m.unifiedOutflowUi !== 'object') m.unifiedOutflowUi = {};
    m.unifiedOutflowUi.filter = 'expense';
    unifiedOutflowDefaultFilterPending = false;
  }
  ensureMonthSectionOrder();
  ensureDespSelectionState(m);
  updateHistoryButtons();
  document.getElementById('mesTitle').textContent = m.nome;
  const mesSub = document.getElementById('mesSub');
  const mesResultSelect = document.getElementById('mesResultSelect');
  if (mesResultSelect) {
    mesResultSelect.style.display = 'none';
  }
  renderTitles();
  applyMonthSectionThemes();
  const obsEl = document.getElementById('obsField');
  if (obsEl) obsEl.value = m.obs || '';
  renderDaily();

  const totals = getEffectiveTotalsForMes(m);
  const totalRenda = totals.rendaFixa;
  const totalIncome = totals.rendaFixa + totals.totalProj;
  const totalDesp = totals.totalGastos;
  const totalGoals = totals.totalFinancialGoals;
  const resultado = totals.resultadoMes;
  const unifiedMetrics = unifiedPilotEnabled ? getUnifiedMonthPilotMetrics(m) : null;
  if (mesSub) {
    mesSub.textContent = unifiedPilotEnabled
      ? ''
      : `${fmt(totalIncome)} entrando · ${fmt(totalGoals)} em metas · ${fmt(totalDesp)} comprometidos`;
  }
  const mesGuide = document.getElementById('mesGuide');
  if (mesGuide) {
    mesGuide.innerHTML = '';
  }
  const mesInsights = document.getElementById('mesInsights');
  if (mesInsights) {
    const shouldRotate = !!window.__rotateMonthMessage;
    const monthMessage = getCurrentMonthHighlightMessage(m, shouldRotate);
    mesInsights.innerHTML = monthMessage ? `<div class="month-message-box">${escapeHtml(monthMessage)}</div>` : '';
    mesInsights.classList.toggle('has-content', !!monthMessage);
    window.__rotateMonthMessage = false;
  }
  monthMetricOrder = sanitizeMonthMetricOrder(monthMetricOrder);
  if (unifiedPilotEnabled) {
    monthMetricOrder = ['renda', 'resultado', 'gastos', 'projetos'];
  }
  saveMonthMetricOrder();

  const monthlyResultUnified = totalIncome - Number(unifiedMetrics?.doneExpenses || 0);
  const previousMonth = getPreviousMonthFor(m);
  const previousUnifiedMetrics = unifiedPilotEnabled && previousMonth ? getUnifiedMonthPilotMetrics(previousMonth) : null;
  const previousTotals = previousMonth ? getEffectiveTotalsForMes(previousMonth) : null;
  const previousIncome = previousTotals ? Number(previousTotals.rendaFixa || 0) + Number(previousTotals.totalProj || 0) : 0;
  const previousPlanned = Number(previousUnifiedMetrics?.plannedExpenses || 0);
  const previousDone = Number(previousUnifiedMetrics?.doneExpenses || 0);
  const metricCards = {
    resultado: `
    <div class="metric-card ${unifiedPilotEnabled ? 'month-planned' : ((resultado)>=0?'month-result-pos':'month-result-neg')}" draggable="true" data-metric-key="resultado" ondragstart="onMonthMetricDragStart(event,'resultado')" ondragend="onMonthMetricDragEnd()" ondragover="onMonthMetricDragOver(event)" ondragleave="onMonthMetricDragLeave(event)" ondrop="onMonthMetricDrop(event,'resultado')">
      ${unifiedPilotEnabled ? renderStaticMonthMetricLabel('Despesas planejadas para o mês', 'Valores que você planejou gastar no mês.') : renderMonthMetricLabel('resultado', 'Resultado do mês')}
      <div class="mc-value">${unifiedPilotEnabled ? fmt(unifiedMetrics.plannedExpenses) : fmtSigned(resultado)}</div>
      ${unifiedPilotEnabled ? renderMonthMetricVariation(unifiedMetrics.plannedExpenses, previousPlanned, { invertMeaning: true }) : ''}
      <div class="mc-note">${unifiedPilotEnabled ? 'Valores que você planejou gastar no mês.' : 'Depois das despesas e metas.'}</div>
    </div>`,
    gastos: `
    <div class="metric-card ${unifiedPilotEnabled ? 'month-spent' : 'month-desp'}" draggable="true" data-metric-key="gastos" ondragstart="onMonthMetricDragStart(event,'gastos')" ondragend="onMonthMetricDragEnd()" ondragover="onMonthMetricDragOver(event)" ondragleave="onMonthMetricDragLeave(event)" ondrop="onMonthMetricDrop(event,'gastos')">
      ${unifiedPilotEnabled ? renderStaticMonthMetricLabel('Despesas do mês', 'Total gasto até agora no mês.') : renderMonthMetricLabel('gastos', 'Saiu no mês')}
      <div class="mc-value">${fmt(unifiedPilotEnabled ? unifiedMetrics.doneExpenses : totalDesp)}</div>
      ${unifiedPilotEnabled ? renderMonthMetricVariation(unifiedMetrics.doneExpenses, previousDone, { invertMeaning: true }) : ''}
      <div class="mc-note">${unifiedPilotEnabled ? 'Total gasto até agora no mês.' : 'Tudo o que já saiu neste mês.'}</div>
    </div>`,
    renda: `
    <div class="metric-card month-renda" draggable="true" data-metric-key="renda" ondragstart="onMonthMetricDragStart(event,'renda')" ondragend="onMonthMetricDragEnd()" ondragover="onMonthMetricDragOver(event)" ondragleave="onMonthMetricDragLeave(event)" ondrop="onMonthMetricDrop(event,'renda')">
      ${unifiedPilotEnabled ? renderStaticMonthMetricLabel('Renda total', 'Entradas consideradas no mês.') : renderMonthMetricLabel('renda', 'Total das rendas')}
      <div class="mc-value">${fmt(totalIncome)}</div>
      ${unifiedPilotEnabled ? renderMonthMetricVariation(totalIncome, previousIncome) : ''}
      <div class="mc-note">Entradas somadas para formar sua renda do mês.</div>
    </div>`,
    projetos: unifiedPilotEnabled ? `
    <div class="metric-card ${monthlyResultUnified >= 0 ? 'month-result-pos' : 'month-result-neg'}" draggable="true" data-metric-key="projetos" ondragstart="onMonthMetricDragStart(event,'projetos')" ondragend="onMonthMetricDragEnd()" ondragover="onMonthMetricDragOver(event)" ondragleave="onMonthMetricDragLeave(event)" ondrop="onMonthMetricDrop(event,'projetos')">
      ${renderStaticMonthMetricLabel('Resultado', 'Renda total menos despesas do mês.')}
      <div class="mc-value">${fmtSigned(monthlyResultUnified)}</div>
      <div class="mc-note">Renda total menos despesas do mês.</div>
    </div>` : '',
    metas: unifiedPilotEnabled ? '' : `
    <div class="metric-card month-goals" draggable="true" data-metric-key="metas" ondragstart="onMonthMetricDragStart(event,'metas')" ondragend="onMonthMetricDragEnd()" ondragover="onMonthMetricDragOver(event)" ondragleave="onMonthMetricDragLeave(event)" ondrop="onMonthMetricDrop(event,'metas')">
      ${renderMonthMetricLabel('metas', 'Separado em metas')}
      <div class="mc-value">${fmt(totalGoals)}</div>
      <div class="mc-note">Valor planejado para guardar.</div>
    </div>`
  };
  document.getElementById('mesMetrics').innerHTML = monthMetricOrder.map(key => metricCards[key]).filter(Boolean).join('');
  renderUnifiedMonthPilot(m);
  const unifiedSection = document.getElementById('section-unified-month');
  const despesasSection = document.getElementById('section-despesas');
  const dailySection = document.getElementById('section-daily');
  if (unifiedSection) unifiedSection.style.display = unifiedPilotEnabled ? '' : 'none';
  if (despesasSection) despesasSection.style.display = unifiedPilotEnabled ? 'none' : '';
  if (dailySection) dailySection.style.display = unifiedPilotEnabled ? 'none' : '';
  buildDespCategoriaFiltro(m);

  // Despesas table
  updateDespTableHeaders();
  const despBody = document.getElementById('despBody');
  const despesasOrdenadas = getSortedDespesas(m);
  despBody.innerHTML = despesasOrdenadas.length === 0
    ? '<tr><td colspan="7" style="padding:20px 22px;color:var(--text3)">Nenhuma despesa registrada.</td></tr>'
    : despesasOrdenadas.map(({ item: d, idx: realIdx }) => `
      <tr>
        <td style="padding-left:22px"><input type="checkbox" ${isDespesaSelected(m.id, realIdx) ? 'checked' : ''} onchange="toggleDespesaSelection(${realIdx})"></td>
        ${renderInlineCell({ table:'despesa', row:realIdx, field:'nome', kind:'text', value:d.nome, displayValue:escapeHtml(d.nome) })}
        ${renderInlineCell({ table:'despesa', row:realIdx, field:'valor', kind:'number', value:d.valor, displayValue:fmt(d.valor), className:'amount amount-neg' })}
        ${renderInlineCell({ table:'despesa', row:realIdx, field:'data', kind:'text', value:d.data||'', displayValue:escapeHtml(d.data||'—'), className:'text-muted', style:'font-size:12px' })}
        ${renderInlineCell({ table:'despesa', row:realIdx, field:'categoria', kind:'expense-category', value:d.categoria||'OUTROS', displayValue:renderCategoryLabel(d.categoria||'OUTROS'), className:'text-muted', style:'font-size:12px' })}
        <td class="expense-paid-cell ${d.pago ? 'is-paid' : ''}">
          <label style="display:inline-flex;align-items:center;cursor:pointer">
            <input class="expense-paid-toggle" type="checkbox" ${d.pago ? 'checked' : ''} onchange="toggleDespesaPaid(${realIdx})">
            <span>Pago</span>
          </label>
        </td>
        <td>
          <button class="btn-icon" onclick="deleteItem('despesa',${realIdx})">✕</button>
        </td>
      </tr>`).join('');
  document.getElementById('despTotal').textContent = fmt(getDespTotalExibido(m, despesasOrdenadas));
  updateDespPaidAllToggle(m);

  // Renda table
  updateRendaTableHeaders();
  const rendaBody = document.getElementById('rendaBody');
  const rendaOrdenada = getSortedRenda(m);
  rendaBody.innerHTML = rendaOrdenada.length === 0
    ? '<tr><td colspan="6" style="padding:20px 22px;color:var(--text3)">Nenhuma renda registrada.</td></tr>'
    : rendaOrdenada.map(({ item: r, idx: realIdx }) => `
      <tr>
        <td style="padding-left:22px"><input type="checkbox" ${isIncomeIncludedInTotals(r) ? 'checked' : ''} onchange="toggleRendaIncludeInTotals(${realIdx}, this.checked)"></td>
        ${renderInlineCell({ table:'renda', row:realIdx, field:'fonte', kind:'text', value:r.fonte, displayValue:escapeHtml(r.fonte), style:'padding-left:22px' })}
        ${renderInlineCell({ table:'renda', row:realIdx, field:'dataRecebimento', kind:'var-date', value:getRecurringIncomeReceiveDay(r.dataRecebimento || ''), displayValue:escapeHtml(getIncomeReceiveDateLabel(r, m)), className:'text-muted' })}
        ${renderInlineCell({ table:'renda', row:realIdx, field:'valor', kind:'number', value:r.valor, displayValue:fmt(r.valor), className:'amount amount-pos' })}
        <td><label class="unified-paid-toggle"><input type="checkbox" ${r.paid ? 'checked' : ''} onchange="toggleRendaPaidStatus(${realIdx}, this.checked)"><span>Pago</span></label></td>
        <td>
          <button class="btn-icon" onclick="deleteItem('renda',${realIdx})">✕</button>
        </td>
      </tr>`).join('');
  document.getElementById('rendaTotal').textContent = fmt(totalRenda);

  renderFinancialGoals(m);

  // Projetos table
  updateProjTableHeaders();
  const projBody = document.getElementById('projBody');
  const projList = Array.isArray(m.projetos) ? m.projetos : [];
  const projOrdenado = getSortedProjetos(projList);
  projBody.innerHTML = projOrdenado.length === 0
    ? '<tr><td colspan="6" style="padding:20px 22px;color:var(--text3)">Nenhum projeto registrado.</td></tr>'
    : projOrdenado.map(({ item: p, idx: realIdx }) => `
      <tr>
        <td style="padding-left:22px"><input type="checkbox" ${isProjectIncludedInTotals(p) ? 'checked' : ''} onchange="toggleProjetoIncludeInTotals(${realIdx}, this.checked)"></td>
        ${renderInlineCell({ table:'projeto', row:realIdx, field:'nome', kind:'text', value:p.nome, displayValue:escapeHtml(p.nome), style:'padding-left:22px' })}
        ${renderInlineCell({ table:'projeto', row:realIdx, field:'dataRecebimento', kind:'var-date', value:p.dataRecebimento || '', displayValue:escapeHtml(p.dataRecebimento || '—'), className:'text-muted' })}
        ${renderInlineCell({ table:'projeto', row:realIdx, field:'valor', kind:'number', value:p.valor, displayValue:fmt(p.valor), className:'amount', style:'color:var(--blue)' })}
        <td><label class="unified-paid-toggle"><input type="checkbox" ${p.paid ? 'checked' : ''} onchange="toggleProjetoPaidStatus(${realIdx}, this.checked)"><span>Pago</span></label></td>
        <td>
          <button class="btn-icon" onclick="deleteItem('projeto',${realIdx})">✕</button>
        </td>
      </tr>`).join('');
  document.getElementById('projTotal').textContent = fmt(projList.reduce((a,p)=>a+(isProjectIncludedInTotals(p) ? p.valor : 0),0));
  renderReimbursementsSection(m);

  // Categorias
  renderCatGrid();
  if (document.getElementById('modalUnifiedOutflow')?.classList.contains('open')) {
    renderUnifiedOutflowModalRecentList();
  }
  setUnifiedOutflowFloatingButtonVisible(unifiedOutflowModalMinimized);
  applyMonthSectionCollapseStates();
  renderNotificationBells();
  if (globalThis.FinanceCalendar?.refreshIfOpen) {
    globalThis.FinanceCalendar.refreshIfOpen(m);
  }
}

function renderFinancialGoals(m) {
  const body = document.getElementById('goalsBody');
  const totalNode = document.getElementById('goalsTotal');
  if (!body || !totalNode) return;

  const goals = Array.isArray(m.financialGoals) ? m.financialGoals : [];
  const totalGoals = goals.reduce((acc, item) => acc + (isFinancialGoalIncludedInTotals(item) ? (item.valor || 0) : 0), 0);
  totalNode.textContent = fmt(totalGoals);
  totalNode.style.color = 'var(--gold, #8e6a1f)';

  if (!goals.length) {
    body.innerHTML = '<tr><td colspan="5" style="padding:20px 22px;color:var(--text3)">Nenhuma meta financeira cadastrada. Adicione uma meta para separar parte da renda antes de gastar.</td></tr>';
    return;
  }

  body.innerHTML = goals.map((goal, idx) => `
      <tr>
        <td style="padding-left:22px"><input type="checkbox" ${isFinancialGoalIncludedInTotals(goal) ? 'checked' : ''} onchange="toggleFinancialGoalIncludeInTotals(${idx}, this.checked)"></td>
        ${renderInlineCell({ table:'financialGoal', row:idx, field:'nome', kind:'text', value:goal.nome || '', displayValue:escapeHtml(goal.nome || '—'), style:'padding-left:22px' })}
        ${renderInlineCell({ table:'financialGoal', row:idx, field:'valor', kind:'number', value:goal.valor, displayValue:fmt(goal.valor), className:'amount', style:'color:var(--gold, #8e6a1f)' })}
        <td>
          <select class="btn patrimonio-goal-select" ${goal.patrimonioTransferredAt ? 'disabled' : ''} onchange="changeFinancialGoalPatrimonioAccount(${idx}, this.value, this)" data-goal-row="${goal.id}">
            ${getPatrimonioAccountOptions(goal.patrimonioAccountId || '')}
          </select>
        </td>
        <td>
          ${!goal.patrimonioTransferredAt && goal.patrimonioAccountId
            ? `<button class="btn btn-primary btn-goal-transfer" title="Adicionar ao patrimônio" onclick="transferFinancialGoalToPatrimonio('${m.id}','${goal.id}', this)">Adicionar ao patrimônio</button>`
            : ''}
          <button class="btn-icon" onclick="deleteItem('financialGoal',${idx})">✕</button>
        </td>
      </tr>
    `).join('');
}

function getDailyGoalTotal(m) {
  if (!m || !m.dailyGoals || typeof m.dailyGoals !== 'object') return 0;
  const spentByCategory = new Map();
  (m.outflows || []).forEach(item => {
    if (!isComparableDailyGoalSpend(item)) return;
    const category = resolveCategoryName(item?.category || 'OUTROS');
    spentByCategory.set(category, Number(spentByCategory.get(category) || 0) + Number(item?.amount || 0));
  });
  return Object.entries(m.dailyGoals).reduce((acc, [category, value]) => {
    const spent = Number(spentByCategory.get(resolveCategoryName(category || 'OUTROS')) || 0);
    if (!(spent > 0)) return acc;
    const goal = Number(value || 0);
    return acc + (goal > 0 ? goal : 0);
  }, 0);
}

function getDailyGoalTarget(m) {
  return getDailyGoalTotal(m);
}

function applyMonthSectionThemes() {
  [
    { id: 'section-despesas', key: 'despesas' },
    { id: 'section-daily', key: 'daily' },
    { id: 'section-renda', key: 'renda' },
    { id: 'section-goals', key: 'goals' },
    { id: 'section-projetos', key: 'projetos' },
    { id: 'section-reembolsos', key: 'reembolsos' },
    { id: 'section-observacoes', key: 'observacoes' }
  ].forEach(({ id, key }) => {
    const section = document.getElementById(id);
    if (!section) return;
    const color = getMonthSectionColor(key);
    section.classList.add('section-theme-custom');
    section.style.setProperty('--section-bg', `linear-gradient(180deg, ${hexToRgba(color, 0.06)} 0%, ${hexToRgba(color, 0.02)} 100%)`);
    section.style.setProperty('--section-border-color', hexToRgba(color, 0.22));
    section.style.setProperty('--section-head-bg', `linear-gradient(180deg, ${hexToRgba(color, 0.08)} 0%, ${hexToRgba(color, 0.03)} 100%)`);
    section.style.setProperty('--section-table-head-bg', `linear-gradient(180deg, ${hexToRgba(color, 0.08)} 0%, ${hexToRgba(color, 0.03)} 100%)`);
    section.style.setProperty('--section-table-row-bg', hexToRgba(color, 0.025));
    section.style.setProperty('--section-table-hover-bg', hexToRgba(color, 0.08));
    section.style.setProperty('--section-table-foot-bg', `linear-gradient(180deg, ${hexToRgba(color, 0.05)} 0%, ${hexToRgba(color, 0.02)} 100%)`);
    section.style.setProperty('--section-title-color', color);
  });
}

function buildDespCategoriaFiltro(m) {
  const select = document.getElementById('despCategoriaFiltro');
  if (!select) return;
  const categorias = Array.from(new Set((m.despesas || []).map(d => (d.categoria || 'OUTROS')))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (despCategoriaFiltro !== 'TODAS' && !categorias.includes(despCategoriaFiltro)) {
    despCategoriaFiltro = 'TODAS';
  }
  select.innerHTML = `<option value="TODAS">Todas</option>${categorias.map(cat => `<option value="${cat}" ${cat===despCategoriaFiltro?'selected':''}>${cat}</option>`).join('')}`;
}

function getDespTotalExibido(m, despesasOrdenadas = null) {
  ensureDespSelectionState(m);
  if (despCategoriaFiltro === 'TODAS') {
    return (m.despesas || []).reduce((acc, d, idx) => acc + (isDespesaSelected(m.id, idx) ? d.valor : 0), 0);
  }
  const rows = despesasOrdenadas || getSortedDespesas(m);
  return rows.reduce((acc, row) => acc + (isDespesaSelected(m.id, row.idx) ? row.item.valor : 0), 0);
}

function toggleDespesaSelection(idx) {
  const m = getCurrentMonth();
  const state = ensureDespSelectionState(m);
  state[idx] = state[idx] === false ? true : false;
  preserveCurrentScroll(() => renderMes());
}

function toggleDespesaPaid(idx) {
  const m = getCurrentMonth();
  if (!m?.despesas?.[idx]) return;
  recordHistoryState();
  m.despesas[idx].pago = m.despesas[idx].pago === true ? false : true;
  save(true);
  preserveCurrentScroll(() => renderMes());
}

function toggleRendaIncludeInTotals(idx, checked) {
  const m = getCurrentMonth();
  if (!m?.renda?.[idx]) return;
  recordHistoryState();
  m.renda[idx].includeInTotals = checked === true;
  recalcTotals(m);
  save(true);
  preserveCurrentScroll(() => renderMes());
}

function toggleFinancialGoalIncludeInTotals(idx, checked) {
  const m = getCurrentMonth();
  if (!m?.financialGoals?.[idx]) return;
  recordHistoryState();
  m.financialGoals[idx].includeInTotals = checked === true;
  recalcTotals(m);
  save(true);
  preserveCurrentScroll(() => renderMes());
}

function toggleProjetoIncludeInTotals(idx, checked) {
  const m = getCurrentMonth();
  if (!m?.projetos?.[idx]) return;
  recordHistoryState();
  m.projetos[idx].includeInTotals = checked === true;
  recalcTotals(m);
  save(true);
  preserveCurrentScroll(() => renderMes());
}

function updateDespPaidAllToggle(m) {
  const toggle = document.getElementById('despPaidAllToggle');
  if (!toggle) return;
  const despesas = Array.isArray(m?.despesas) ? m.despesas : [];
  if (!despesas.length) {
    toggle.checked = false;
    toggle.indeterminate = false;
    toggle.disabled = true;
    return;
  }
  const paidCount = despesas.filter(d => d?.pago === true).length;
  toggle.disabled = false;
  toggle.checked = paidCount === despesas.length;
  toggle.indeterminate = paidCount > 0 && paidCount < despesas.length;
}

function toggleAllDespesasPaid(checked) {
  const m = getCurrentMonth();
  if (!Array.isArray(m?.despesas) || !m.despesas.length) return;
  const nextValue = checked === true;
  const hasChange = m.despesas.some(d => (d?.pago === true) !== nextValue);
  if (!hasChange) {
    preserveCurrentScroll(() => renderMes());
    return;
  }
  recordHistoryState();
  m.despesas = m.despesas.map(d => ({ ...d, pago: nextValue }));
  save(true);
  preserveCurrentScroll(() => renderMes());
}

function getSortedDespesas(m) {
  let rows = (m.despesas || []).map((item, idx) => ({ item, idx }));
  if (despCategoriaFiltro !== 'TODAS') {
    rows = rows.filter(({ item }) => (item.categoria || 'OUTROS') === despCategoriaFiltro);
  }
  if (!despSort.field) return rows;
  const factor = despSort.direction === 'desc' ? -1 : 1;
  return rows.sort((a, b) => {
    if (despSort.field === 'valor') {
      return (a.item.valor - b.item.valor) * factor;
    }
    if (despSort.field === 'data') {
      const diff = parseData(a.item.data || '') - parseData(b.item.data || '');
      if (diff !== 0) return diff * factor;
      return a.item.nome.localeCompare(b.item.nome, 'pt-BR') * factor;
    }
    if (despSort.field === 'categoria') {
      const catDiff = (a.item.categoria || 'OUTROS').localeCompare(b.item.categoria || 'OUTROS', 'pt-BR');
      if (catDiff !== 0) return catDiff * factor;
      return a.item.nome.localeCompare(b.item.nome, 'pt-BR') * factor;
    }
    return a.item.nome.localeCompare(b.item.nome, 'pt-BR') * factor;
  });
}

function updateDespTableHeaders() {
  const table = document.getElementById('despTable');
  if (!table) return;
  const labels = {
    nome: 'Descrição',
    valor: 'Valor',
    data: 'Data pag.',
    categoria: 'Categoria'
  };
  table.querySelectorAll('th.sortable').forEach(th => {
    const onclick = th.getAttribute('onclick') || '';
    const match = onclick.match(/setDespSort\('([^']+)'\)/);
    const field = match ? match[1] : '';
    const arrow = despSort.field === field ? (despSort.direction === 'asc' ? ' ▲' : ' ▼') : '';
    th.textContent = `${labels[field] || th.textContent.replace(/[ ▲▼]+$/,'')}${arrow}`;
  });
}

function getSortedRenda(m) {
  const rows = (m.renda || []).map((item, idx) => ({ item, idx }));
  if (!rendaSort.field) return rows;
  const factor = rendaSort.direction === 'desc' ? -1 : 1;
  return rows.sort((a, b) => {
    if (rendaSort.field === 'dataRecebimento') {
      const diff = getIncomeReceiveDateSortValue(a.item, m) - getIncomeReceiveDateSortValue(b.item, m);
      if (diff !== 0) return diff * factor;
      return (a.item.fonte || '').localeCompare(b.item.fonte || '', 'pt-BR') * factor;
    }
    if (rendaSort.field === 'valor') return (a.item.valor - b.item.valor) * factor;
    return (a.item.fonte || '').localeCompare(b.item.fonte || '', 'pt-BR') * factor;
  });
}

function updateRendaTableHeaders() {
  const table = document.getElementById('rendaTable');
  if (!table) return;
  const labels = { fonte: 'Fonte', dataRecebimento: 'Recebimento', valor: 'Valor' };
  table.querySelectorAll('th.sortable').forEach(th => {
    const onclick = th.getAttribute('onclick') || '';
    const match = onclick.match(/setRendaSort\('([^']+)'\)/);
    const field = match ? match[1] : '';
    const arrow = rendaSort.field === field ? (rendaSort.direction === 'asc' ? ' ▲' : ' ▼') : '';
    th.textContent = `${labels[field] || th.textContent.replace(/[ ▲▼]+$/,'')}${arrow}`;
  });
}

function getSortedProjetos(projList) {
  const rows = (projList || []).map((item, idx) => ({ item, idx }));
  if (!projSort.field) return rows;
  const factor = projSort.direction === 'desc' ? -1 : 1;
  return rows.sort((a, b) => {
    if (projSort.field === 'dataRecebimento') {
      const diff = parseData(a.item.dataRecebimento || '') - parseData(b.item.dataRecebimento || '');
      if (diff !== 0) return diff * factor;
      return (a.item.nome || '').localeCompare(b.item.nome || '', 'pt-BR') * factor;
    }
    if (projSort.field === 'valor') return (a.item.valor - b.item.valor) * factor;
    return (a.item.nome || '').localeCompare(b.item.nome || '', 'pt-BR') * factor;
  });
}

function updateProjTableHeaders() {
  const table = document.getElementById('projTable');
  if (!table) return;
  const labels = { nome: 'Descrição', dataRecebimento: 'Recebimento', valor: 'Valor' };
  table.querySelectorAll('th.sortable').forEach(th => {
    const onclick = th.getAttribute('onclick') || '';
    const match = onclick.match(/setProjSort\('([^']+)'\)/);
    const field = match ? match[1] : '';
    const arrow = projSort.field === field ? (projSort.direction === 'asc' ? ' ▲' : ' ▼') : '';
    th.textContent = `${labels[field] || th.textContent.replace(/[ ▲▼]+$/,'')}${arrow}`;
  });
}

// Totais de categorias apenas das despesas fixas
function getFixedCategoryTotals(m) {
  const totals = {};
  (m.despesas || []).forEach(d => {
    const c = (d.categoria || 'OUTROS').toUpperCase();
    totals[c] = (totals[c] || 0) + d.valor;
  });
  return totals;
}

function renderCatGrid() {
  const m = getCurrentMonth();
  const cats = getVariableCategoryTotals(m);
  const keys = Object.keys(cats);
  const total = keys.reduce((a,k)=>a+(cats[k]||0),0);
  const grid = document.getElementById('catGrid');
  if (keys.length === 0) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><span>📊</span><p>Adicione categorias de gastos variáveis para rastrear onde seu dinheiro vai.</p></div>';
    return;
  }
  grid.innerHTML = keys.map(k => {
    const meta = metas[k];
    const pct = meta ? Math.min((cats[k]/meta)*100, 100) : null;
    const over = meta && cats[k] > meta;
    const visual = inferCategoryVisual(k);
    return `
      <div class="cat-item" style="flex-direction:column;align-items:flex-start;gap:6px">
        <div style="display:flex;align-items:center;gap:8px;width:100%">
          ${renderSmartIconBadge(visual.icon, visual.tone)}
          <div class="cat-dot" style="background:${CAT_COLORS[k]||'#95a5a6'}"></div>
          <span style="font-size:12px;font-weight:600;flex:1">${k}</span>
          <span style="font-size:13px;font-weight:600;color:${over?'var(--red)':'var(--text)'}">${fmt(cats[k])}</span>
          <button class="btn-icon" onclick="deleteCat('${k}')">✕</button>
        </div>
        ${meta ? `
          <div style="width:100%">
            <div class="progress-wrap">
              <div class="progress-bar" style="width:${pct}%;background:${over?'var(--red)':CAT_COLORS[k]||'#27ae60'}"></div>
            </div>
            <div style="font-size:11px;color:${over?'var(--red)':'var(--text3)'};margin-top:3px">
              ${over?'⚠ ':''}Meta: ${fmt(meta)} · ${pct.toFixed(0)}% usado
            </div>
          </div>
        ` : `<div style="font-size:11px;color:var(--text3)">${((cats[k]/total)*100).toFixed(1)}% do total variável</div>`}
      </div>`;
  }).join('');
}

// ============================================================
// ADD / EDIT / DELETE ITEMS
// ============================================================
function openAddItem(type) {
  editingItem = null;
  editingType = type;
  const titles = {despesa:'Adicionar despesa', renda:'Adicionar renda', financialGoal:'Adicionar meta financeira', projeto:'Adicionar projeto/entrada'};
  document.getElementById('modalItemTitle').textContent = titles[type];
  buildItemForm(type, null);
  openModal('modalItem');
}

function editItem(type, idx) {
  editingType = type;
  editingItem = idx;
  const m = getCurrentMonth();
  const arr = type === 'despesa' ? m.despesas : type === 'renda' ? m.renda : type === 'financialGoal' ? m.financialGoals : m.projetos;
  const item = arr[idx];
  const titles = {despesa:'Editar despesa', renda:'Editar renda', financialGoal:'Editar meta financeira', projeto:'Editar projeto/entrada'};
  document.getElementById('modalItemTitle').textContent = titles[type];
  buildItemForm(type, item);
  openModal('modalItem');
}

function buildItemForm(type, item) {
  const f = document.getElementById('modalItemForm');
  if (type === 'despesa') {
    const cats = ['DESPESA', 'GASTO'];
    const buildExpenseCategoryOption = (name) => `<option ${item&&item.categoria===name?'selected':''}>${escapeHtml(formatCategoryOptionLabel(name))}</option>`;
    f.innerHTML = `
      <div class="form-row">
        <div class="field"><label>Descrição</label><input id="fi_nome" value="${item?item.nome:''}" placeholder="ex: NUBANK"></div>
        <div class="field"><label>Valor (R$)</label><input id="fi_valor" type="number" step="0.01" value="${item?item.valor:''}" placeholder="0,00"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Data pagamento (opcional)</label><input id="fi_data" value="${item&&item.data?item.data:''}" placeholder="ex: 10"></div>
        <div class="field"><label>Categoria</label>
          <select id="fi_cat" onchange="toggleDespNovaCat()">
            ${cats.map(buildExpenseCategoryOption).join('') || '<option>OUTROS</option>'}
            <option value="nova">+ Nova categoria</option>
          </select>
        </div>
      </div>
      <div class="field" id="fi_cat_nova_wrap" style="display:none"><label>Nova categoria</label><input id="fi_cat_nova" placeholder="Nome da categoria"></div>`;
  } else if (type === 'renda') {
    const paid = item?.paid === true;
    const rendaReceiveValue = item?.recurringFixed !== false
      ? String(item?.dataRecebimento || '')
      : String(item?.dataRecebimento || '');
    f.innerHTML = `
      <div class="form-row">
        <div class="field"><label>Fonte</label><input id="fi_nome" value="${item?item.fonte:''}" placeholder="ex: SALÁRIO"></div>
        <div class="field"><label>Valor (R$)</label><input id="fi_valor" type="number" step="0.01" value="${item?item.valor:''}" placeholder="0,00"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Dia de recebimento</label><input id="fi_recebimento" value="${escapeHtml(rendaReceiveValue)}" placeholder="dia (1 a 31) ou dd/mm/aa"></div>
      </div>
      <div class="form-help-inline">Por padrão informe só o dia. Se precisar ajustar mês/ano (ex.: atraso), digite a data completa.</div>
      <label class="month-copy-toggle form-help-label" data-help="Marque quando essa renda já entrou de verdade. Você pode enviar esse valor para uma conta de patrimônio logo após salvar.">
        <input id="fi_renda_pago" type="checkbox" ${paid ? 'checked' : ''} onchange="toggleRendaFormPaid(this.checked)">
        <span>Pago</span>
      </label>
      <input id="fi_renda_send_patrimonio" type="hidden" value="0">`;
    if (!item) {
      const sendFlag = document.getElementById('fi_renda_send_patrimonio');
      if (sendFlag) sendFlag.value = '0';
    }
  } else if (type === 'financialGoal') {
      f.innerHTML = `
        <div class="form-row">
          <div class="field"><label>Descrição</label><input id="fi_nome" value="${item?item.nome:''}" placeholder="ex: Reserva"></div>
          <div class="field"><label>Valor (R$)</label><input id="fi_valor" type="number" step="0.01" value="${item?item.valor:''}" placeholder="0,00"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Conta patrimonial (opcional)</label>
            <select id="fi_goal_target">${getPatrimonioAccountOptions(item?.patrimonioAccountId || '')}</select>
          </div>
        </div>`;
  } else {
    const paid = item?.paid === true;
    const recurringExtra = item?.recurringExtra === true;
    const recurringInstallmentsTotal = Math.max(2, Number(item?.recurringInstallmentsTotal || 2) || 2);
    f.innerHTML = `
      <div class="form-row">
        <div class="field"><label>Descrição</label><input id="fi_nome" value="${item?item.nome:''}" placeholder="ex: Cliente X"></div>
        <div class="field"><label>Valor (R$)</label><input id="fi_valor" type="number" step="0.01" value="${item?item.valor:''}" placeholder="0,00"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Data de recebimento</label><input id="fi_recebimento" value="${item?.dataRecebimento || ''}" placeholder="dd/mm/aa"></div>
      </div>
      <label class="month-copy-toggle form-help-label">
        <input id="fi_proj_recorrente" type="checkbox" ${recurringExtra ? 'checked' : ''} onchange="toggleProjetoRecurringInstallments(this.checked)">
        <span>Renda extra recorrente</span>
      </label>
      <div id="fi_proj_recorrente_wrap" class="field" style="${recurringExtra ? '' : 'display:none'}">
        <label>Quantidade de parcelas/meses</label>
        <input id="fi_proj_recorrente_qtd" type="number" min="2" step="1" value="${recurringInstallmentsTotal}">
      </div>
      <label class="month-copy-toggle form-help-label" data-help="Marque quando essa renda extra já entrou no caixa e está disponível de verdade.">
        <input id="fi_renda_pago" type="checkbox" ${paid ? 'checked' : ''} onchange="toggleRendaFormPaid(this.checked)">
        <span>Pago</span>
      </label>
      <input id="fi_renda_send_patrimonio" type="hidden" value="0">`;
  }
}

function toggleProjetoRecurringInstallments(enabled) {
  const wrap = document.getElementById('fi_proj_recorrente_wrap');
  if (!wrap) return;
  wrap.style.display = enabled ? '' : 'none';
}

function applyDespesaUpdate(m, obj, previousName = '', editingIndex = null) {
  const categoria = resolveCategoryName(obj.categoria || 'OUTROS');
  const data_val = obj.data || '';
  const normalizedNome = normalizeExpenseName(obj.nome);
  const normalizedPreviousName = normalizeExpenseName(previousName);
  const mCats = getAllCategories(m);
  if (!mCats.includes(categoria)) m.categorias[categoria] = 0;

  const nextObj = { nome: obj.nome, valor: obj.valor, categoria, data: data_val };
  if (editingIndex !== null) m.despesas[editingIndex] = nextObj;
  else {
    m.despesas.push(nextObj);
    const state = ensureDespSelectionState(m);
    state[m.despesas.length - 1] = true;
  }

  if (normalizedPreviousName && normalizedPreviousName !== normalizedNome) {
    Object.keys(expenseNameRenameMap).forEach(key => {
      if (normalizeExpenseName(expenseNameRenameMap[key]) === normalizedPreviousName) {
        expenseNameRenameMap[key] = obj.nome;
      }
    });
    expenseNameRenameMap[normalizedPreviousName] = obj.nome;
    if (expenseCategoryRules[normalizedPreviousName] !== undefined && expenseCategoryRules[normalizedNome] === undefined) {
      expenseCategoryRules[normalizedNome] = expenseCategoryRules[normalizedPreviousName];
    }
    if (expensePaymentDateRules[normalizedPreviousName] !== undefined && expensePaymentDateRules[normalizedNome] === undefined) {
      expensePaymentDateRules[normalizedNome] = expensePaymentDateRules[normalizedPreviousName];
    }
    delete expenseCategoryRules[normalizedPreviousName];
    delete expensePaymentDateRules[normalizedPreviousName];
    saveExpenseNameRenameMap();
  }

  expenseCategoryRules[normalizedNome] = categoria;
  expensePaymentDateRules[normalizedNome] = data_val;
  saveExpenseCategoryRules();
  saveExpensePaymentDateRules();

  data.forEach(month => {
    applyExpenseNameRulesToMonth(month);
    applyExpenseCategoryRulesToMonth(month);
    applyExpensePaymentDateRulesToMonth(month);
    recalcTotals(month);
  });
  save();
}

function saveItem() {
  const nome = document.getElementById('fi_nome').value.trim();
  const valor = parseFloat(document.getElementById('fi_valor').value);
  if (!nome || isNaN(valor) || valor <= 0) { alert('Preencha todos os campos corretamente.'); return; }
  recordHistoryState();
  const m = getCurrentMonth();
  if (editingType === 'despesa') {
    const previousName = editingItem !== null && m.despesas[editingItem] ? m.despesas[editingItem].nome : '';
    const dataRaw = document.getElementById('fi_data')?.value || '';
    const data_val = dataRaw ? normalizeFlexibleDateInput(dataRaw, m, { simpleDayMonthOffset: 1 }) : '';
    if (dataRaw && !data_val) {
      undoStack.pop();
      alert('Informe a data como dia (1 a 31) ou data completa.');
      return;
    }
    let cat = document.getElementById('fi_cat')?.value || 'OUTROS';
    if (cat === 'nova') cat = document.getElementById('fi_cat_nova').value.trim() || 'OUTROS';
    applyDespesaUpdate(m, { nome, valor, categoria: cat, data: data_val }, previousName, editingItem);
  } else if (editingType === 'renda') {
    const previousFonte = editingItem !== null && m.renda[editingItem] ? m.renda[editingItem].fonte : '';
    const previousItem = editingItem !== null && m.renda[editingItem] ? { ...m.renda[editingItem] } : null;
    const paid = document.getElementById('fi_renda_pago')?.checked === true;
    const shouldSendToPatrimonio = document.getElementById('fi_renda_send_patrimonio')?.value === '1';
    const previousMovementId = editingItem !== null && m.renda[editingItem]
      ? String(m.renda[editingItem].patrimonioMovementId || '')
      : '';
    const dataRecebimento = normalizeIncomeReceiveDate(document.getElementById('fi_recebimento')?.value || '', m, true);
    const includeInTotals = editingItem !== null && m.renda[editingItem]
      ? m.renda[editingItem].includeInTotals !== false
      : true;
    const obj = {
      fonte: nome,
      valor,
      paid,
      includeInTotals,
      patrimonioMovementId: previousMovementId,
      dataRecebimento,
      recurringFixed: true,
      recurringGroupId: getIncomeRecurringGroupId(previousItem, nome)
    };
    const normalizedPreviousFonte = normalizeIncomeName(previousFonte);
    const normalizedFonte = normalizeIncomeName(nome);
    if (normalizedPreviousFonte && normalizedPreviousFonte !== normalizedFonte) {
      Object.keys(incomeNameRenameMap).forEach(key => {
        if (normalizeIncomeName(incomeNameRenameMap[key]) === normalizedPreviousFonte) {
          incomeNameRenameMap[key] = nome;
        }
      });
      incomeNameRenameMap[normalizedPreviousFonte] = nome;
      saveIncomeNameRenameMap();
    }
    const changedFields = previousItem ? getRecurringIncomeChangedFields(previousItem, obj) : ['fonte', 'valor', 'dataRecebimento', 'includeInTotals', 'paid', 'recurringFixed'];
    const persistIncomeSave = (applyForward) => {
      if (editingItem !== null) m.renda[editingItem] = obj;
      else m.renda.push(obj);
      if (applyForward && canPropagateRecurringFromMonth(m)) {
        applyRecurringIncomeForwardChanges(m, obj.recurringGroupId, obj, changedFields);
      } else if (!previousItem && canPropagateRecurringFromMonth(m)) {
        applyRecurringIncomeForwardChanges(m, obj.recurringGroupId, obj, ['fonte', 'valor', 'dataRecebimento', 'includeInTotals', 'recurringFixed']);
      }
      if (paid && shouldSendToPatrimonio) {
        setTimeout(() => openRendaPatrimonioModalPreset(nome, valor), 20);
      }
      recalcTotals(m);
      save(true);
      closeModal('modalItem');
      preserveCurrentScroll(() => renderMes());
    };
    if (previousItem && changedFields.length && canPropagateRecurringFromMonth(m)) {
      openRecurringChangeScopeModal({
        message: 'Esta receita fixa se repete em outros meses. Como você deseja aplicar essa alteração?',
        onThisMonth: () => persistIncomeSave(false),
        onForward: () => persistIncomeSave(true),
        onCancel: () => {}
      });
      return;
    }
    persistIncomeSave(false);
    return;
  } else if (editingType === 'financialGoal') {
    const obj = {
      id: editingItem !== null && m.financialGoals?.[editingItem]?.id ? m.financialGoals[editingItem].id : `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      nome,
      valor,
      includeInTotals: editingItem !== null && m.financialGoals?.[editingItem]
        ? m.financialGoals[editingItem].includeInTotals !== false
        : true,
      patrimonioAccountId: document.getElementById('fi_goal_target')?.value || '',
      patrimonioTransferredAt: editingItem !== null && m.financialGoals?.[editingItem]?.patrimonioTransferredAt
        ? m.financialGoals[editingItem].patrimonioTransferredAt
        : '',
      patrimonioMovementId: editingItem !== null && m.financialGoals?.[editingItem]?.patrimonioMovementId
        ? m.financialGoals[editingItem].patrimonioMovementId
        : ''
    };
    if (!Array.isArray(m.financialGoals)) m.financialGoals = [];
    if (editingItem !== null) m.financialGoals[editingItem] = obj;
    else m.financialGoals.push(obj);
  } else {
    const paid = document.getElementById('fi_renda_pago')?.checked === true;
    const shouldSendToPatrimonio = document.getElementById('fi_renda_send_patrimonio')?.value === '1';
    const recurringExtra = document.getElementById('fi_proj_recorrente')?.checked === true;
    const recurringInstallmentsTotal = recurringExtra
      ? Math.max(2, Number(document.getElementById('fi_proj_recorrente_qtd')?.value || 2) || 2)
      : 1;
    const previousMovementId = editingItem !== null && m.projetos[editingItem]
      ? String(m.projetos[editingItem].patrimonioMovementId || '')
      : '';
    const dataRecebimento = normalizeIncomeReceiveDate(document.getElementById('fi_recebimento')?.value || '', m, true);
    const includeInTotals = editingItem !== null && m.projetos[editingItem]
      ? m.projetos[editingItem].includeInTotals !== false
      : true;
    const previousProject = editingItem !== null && m.projetos[editingItem]
      ? { ...m.projetos[editingItem] }
      : null;
    const recurringGroupId = recurringExtra
      ? getProjetoRecurringGroupId(previousProject, nome)
      : '';
    const obj = {
      nome,
      valor,
      paid,
      includeInTotals,
      patrimonioMovementId: previousMovementId,
      dataRecebimento,
      recurringExtra,
      recurringInstallmentsTotal,
      recurringInstallmentIndex: previousProject?.recurringInstallmentIndex || 1,
      recurringGroupId
    };
    if (editingItem !== null) m.projetos[editingItem] = obj;
    else m.projetos.push(obj);
    if (recurringExtra && canPropagateRecurringFromMonth(m)) {
      applyProjetoRecurringForwardChanges(m, obj);
    } else if (previousProject?.recurringExtra === true && previousProject?.recurringGroupId) {
      removeProjetoRecurringForward(m, String(previousProject.recurringGroupId));
    }
    m._projectSource = 'manual';
    if (paid && shouldSendToPatrimonio) {
      setTimeout(() => openRendaPatrimonioModalPreset(nome, valor), 20);
    }
  }
  recalcTotals(m);
  save();
  closeModal('modalItem');
  preserveCurrentScroll(() => renderMes());
}

function commitInlineEdit(rawValue) {
  if (!inlineEditState) return;
  const { table, row, field } = inlineEditState;
  const m = getCurrentMonth();
  const item = getInlineItem(table, row);
  if (table !== 'daily' && !item) { inlineEditState = null; table === 'eso' ? renderEso() : preserveCurrentScroll(() => renderMes()); return; }

  let changed = false;
  recordHistoryState();

  if (table === 'despesa') {
    const next = { ...item };
    if (field === 'nome') {
      const nome = String(rawValue || '').trim();
      if (!nome) { undoStack.pop(); cancelInlineEdit(); return; }
      next.nome = nome;
    } else if (field === 'valor') {
      const valor = parseFloat(rawValue);
      if (isNaN(valor) || valor <= 0) { undoStack.pop(); cancelInlineEdit(); return; }
      next.valor = valor;
    } else if (field === 'data') {
      const raw = String(rawValue || '').trim();
      if (!raw) {
        next.data = '';
      } else {
        const normalized = normalizeFlexibleDateInput(raw, m, { simpleDayMonthOffset: 1 });
        if (!normalized) { undoStack.pop(); cancelInlineEdit(); return; }
        next.data = normalized;
      }
    } else if (field === 'categoria') {
      const categoria = String(rawValue || '').trim();
      if (!categoria) { undoStack.pop(); cancelInlineEdit(); return; }
      next.categoria = categoria;
    }
    changed = JSON.stringify(next) !== JSON.stringify(item);
    if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
    applyDespesaUpdate(m, next, item.nome, row);
  } else if (table === 'renda') {
    const original = { ...item };
    const next = {
      ...item,
      recurringFixed: item?.recurringFixed !== false,
      recurringGroupId: getIncomeRecurringGroupId(item, item?.fonte || 'Renda')
    };
    if (field === 'fonte') {
      const fonte = String(rawValue || '').trim();
      if (!fonte) { undoStack.pop(); cancelInlineEdit(); return; }
      next.fonte = fonte;
    } else if (field === 'valor') {
      const valor = parseFloat(rawValue);
      if (isNaN(valor) || valor <= 0) { undoStack.pop(); cancelInlineEdit(); return; }
      next.valor = valor;
    } else if (field === 'dataRecebimento') {
      next.dataRecebimento = normalizeIncomeReceiveDate(rawValue, m, true);
    }
    changed = JSON.stringify(next) !== JSON.stringify(original);
    if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
    const changedFields = getRecurringIncomeChangedFields(original, next);
    const applyIncomeNameRenameMapUpdate = (fromFonte, toFonte) => {
      const previousFonte = String(fromFonte || '').trim();
      const fonte = String(toFonte || '').trim();
      const normalizedPreviousFonte = normalizeIncomeName(previousFonte);
      const normalizedFonte = normalizeIncomeName(fonte);
      if (!normalizedPreviousFonte || normalizedPreviousFonte === normalizedFonte) return;
      Object.keys(incomeNameRenameMap).forEach(key => {
        if (normalizeIncomeName(incomeNameRenameMap[key]) === normalizedPreviousFonte) {
          incomeNameRenameMap[key] = fonte;
        }
      });
      incomeNameRenameMap[normalizedPreviousFonte] = fonte;
      saveIncomeNameRenameMap();
    };
    const applyInlineIncomeUpdate = (applyForward) => {
      applyIncomeNameRenameMapUpdate(original?.fonte, next?.fonte);
      Object.assign(item, next);
      if (applyForward && changedFields.length && canPropagateRecurringFromMonth(m)) {
        applyRecurringIncomeForwardChanges(m, next.recurringGroupId, item, changedFields);
      }
      recalcTotals(m);
      save();
      inlineEditState = null;
      preserveCurrentScroll(() => renderMes());
    };
    if (changedFields.length && canPropagateRecurringFromMonth(m)) {
      openRecurringChangeScopeModal({
        message: 'Esta receita fixa se repete em outros meses. Como você deseja aplicar essa alteração?',
        onThisMonth: () => applyInlineIncomeUpdate(false),
        onForward: () => applyInlineIncomeUpdate(true),
        onCancel: () => {
          undoStack.pop();
          inlineEditState = null;
          preserveCurrentScroll(() => renderMes());
        }
      });
      return;
    }
    applyIncomeNameRenameMapUpdate(original?.fonte, next?.fonte);
    Object.assign(item, next);
    recalcTotals(m);
    save();
  } else if (table === 'projeto') {
    if (field === 'nome') {
      const nome = String(rawValue || '').trim();
      if (!nome) { undoStack.pop(); cancelInlineEdit(); return; }
      changed = nome !== item.nome;
      item.nome = nome;
    } else if (field === 'valor') {
      const valor = parseFloat(rawValue);
      if (isNaN(valor) || valor <= 0) { undoStack.pop(); cancelInlineEdit(); return; }
      changed = valor !== item.valor;
      item.valor = valor;
    } else if (field === 'dataRecebimento') {
      const normalized = normalizeIncomeReceiveDate(rawValue, m, true);
      changed = normalized !== String(item.dataRecebimento || '');
      item.dataRecebimento = normalized;
    }
    if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
    recalcTotals(m);
    save();
  } else if (table === 'financialGoal') {
    if (field === 'nome') {
      const nome = String(rawValue || '').trim();
      if (!nome) { undoStack.pop(); cancelInlineEdit(); return; }
      changed = nome !== item.nome;
      item.nome = nome;
    } else if (field === 'valor') {
      const valor = parseFloat(rawValue);
      if (isNaN(valor) || valor <= 0) { undoStack.pop(); cancelInlineEdit(); return; }
      changed = valor !== item.valor;
      item.valor = valor;
    }
    if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
    recalcTotals(m);
    save();
  } else if (table === 'daily') {
    if (field === 'categoria') {
      const categoria = String(rawValue || '').trim().toUpperCase();
      if (!categoria) { undoStack.pop(); cancelInlineEdit(); return; }
      changed = categoria !== String(row || '').trim().toUpperCase();
      if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
      if (!applyVarCategoryRename(String(row || ''), categoria)) {
        undoStack.pop();
        cancelInlineEdit();
        return;
      }
    } else if (field === 'meta') {
      if (!m.dailyGoals) m.dailyGoals = {};
      const categoriaAtual = String(row || '').trim();
      const texto = String(rawValue ?? '').trim();
      if (!texto) {
        changed = m.dailyGoals[categoriaAtual] !== undefined && Number(m.dailyGoals[categoriaAtual]) !== 0;
        m.dailyGoals[categoriaAtual] = 0;
      } else {
        const meta = parseFloat(texto);
        if (isNaN(meta) || meta < 0) { undoStack.pop(); cancelInlineEdit(); return; }
        changed = Number(m.dailyGoals[categoriaAtual] || 0) !== meta;
        m.dailyGoals[categoriaAtual] = meta;
      }
      if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
      save();
    }
  } else if (table === 'varItem') {
    const next = { ...item };
    if (field === 'titulo') {
      const titulo = String(rawValue || '').trim();
      if (!titulo) { undoStack.pop(); cancelInlineEdit(); return; }
      next.titulo = titulo;
    } else if (field === 'valor') {
      const valor = parseFloat(rawValue);
      if (isNaN(valor) || valor <= 0) { undoStack.pop(); cancelInlineEdit(); return; }
      next.valor = valor;
    } else if (field === 'data') {
      const dataNormalizada = normalizeFlexibleDateInput(rawValue, m, { simpleDayMonthOffset: 1 });
      if (!dataNormalizada) {
        undoStack.pop();
        alert('Use dia (1 a 31) ou data completa (dd/mm/aa).');
        cancelInlineEdit();
        return;
      }
      next.data = dataNormalizada;
    } else if (field === 'categoria') {
      const categoria = resolveCategoryName(String(rawValue || '').trim());
      if (!categoria) { undoStack.pop(); cancelInlineEdit(); return; }
      next.categoria = categoria;
    }
    changed = JSON.stringify(next) !== JSON.stringify(item);
    if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
    Object.assign(item, next);
    if (!m.categorias) m.categorias = {};
    if (!(item.categoria in m.categorias)) m.categorias[item.categoria] = 0;
    if (!Array.isArray(m.dailyCategorySeeds)) m.dailyCategorySeeds = [];
    if (!m.dailyCategorySeeds.includes(item.categoria)) m.dailyCategorySeeds.push(item.categoria);
    recalcTotals(m);
    save();
  } else if (table === 'unifiedOutflow') {
    const original = { ...item };
    const next = { ...item };
    if (field === 'description') {
      const description = String(rawValue || '').trim();
      if (!description) { undoStack.pop(); cancelInlineEdit(); return; }
      next.description = description;
    } else if (field === 'category') {
      const category = resolveCategoryName(String(rawValue || '').trim());
      if (!category) { undoStack.pop(); cancelInlineEdit(); return; }
      next.category = category;
    } else if (field === 'amount') {
      const amount = parseFloat(rawValue);
      if (isNaN(amount) || amount <= 0) { undoStack.pop(); cancelInlineEdit(); return; }
      next.amount = amount;
    } else if (field === 'date') {
      const raw = String(rawValue || '').trim();
      if (isUnifiedExpenseType(next)) {
        if (!raw) {
          next.date = '';
        } else {
          const expenseDate = resolveUnifiedExpenseDateInput(raw, m);
          if (!expenseDate) {
            undoStack.pop();
            alert('Use dia (1 a 31) ou data completa (dd/mm/aa) para a data de cobrança.');
            cancelInlineEdit();
            return;
          }
          next.date = expenseDate;
        }
      } else if (next.recurringSpend === true) {
        const date = normalizeFlexibleDateInput(raw, m, { simpleDayMonthOffset: 1 });
        if (!date) {
          undoStack.pop();
          alert('Use dia (1 a 31) ou data completa (dd/mm/aa) para a data de cobrança.');
          cancelInlineEdit();
          return;
        }
        next.date = date;
      } else {
        const date = normalizeFlexibleDateInput(raw, m, { simpleDayMonthOffset: 1 });
        if (!date) {
          undoStack.pop();
          alert('Use dia (1 a 31) ou data completa (dd/mm/aa).');
          cancelInlineEdit();
          return;
        }
        next.date = date;
      }
    } else if (field === 'output') {
      const parsed = parseUnifiedOutflowOutputValue(rawValue);
      if (!parsed) { undoStack.pop(); cancelInlineEdit(); return; }
      next.outputKind = parsed.outputKind;
      next.outputMethod = parsed.outputMethod;
      next.outputRef = parsed.outputRef;
      if (parsed.outputKind === 'card') {
        next.type = 'spend';
        next.countsInPrimaryTotals = false;
      } else if (isUnifiedExpenseType(next)) {
        next.countsInPrimaryTotals = true;
      }
    }
    changed = JSON.stringify(next) !== JSON.stringify(item);
    if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
    const seriesKey = item.installmentsGroupId || item.recurringGroupId;
    const changedFields = getRecurringChangedFields(original, next);
    const applyUnifiedOutflowInlineUpdate = (applyForward) => {
      Object.assign(item, next);
      if (seriesKey && applyForward && changedFields.length) {
        applyRecurringForwardChanges(m, seriesKey, item, changedFields, original || item);
      }
      if (!m.categorias) m.categorias = {};
      if (!(item.category in m.categorias)) m.categorias[item.category] = 0;
      if (!Array.isArray(m.dailyCategorySeeds)) m.dailyCategorySeeds = [];
      if (!m.dailyCategorySeeds.includes(item.category)) m.dailyCategorySeeds.push(item.category);
      syncUnifiedOutflowLegacyData(m);
      save(true);
      inlineEditState = null;
      preserveCurrentScroll(() => renderMes());
    };
    if (seriesKey && changedFields.length && canPropagateRecurringFromMonth(m)) {
      openRecurringChangeScopeModal({
        onThisMonth: () => applyUnifiedOutflowInlineUpdate(false),
        onForward: () => applyUnifiedOutflowInlineUpdate(true),
        onCancel: () => {
          undoStack.pop();
          inlineEditState = null;
          preserveCurrentScroll(() => renderMes());
        }
      });
      return;
    }
    applyUnifiedOutflowInlineUpdate(false);
  } else if (table === 'unifiedCardBill') {
    const amount = parseFloat(rawValue);
    if (isNaN(amount) || amount < 0) { undoStack.pop(); cancelInlineEdit(); return; }
    changed = Number(item.amount || 0) !== amount;
    if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
    item.amount = amount;
    item.manualAmountSet = true;
    syncUnifiedOutflowLegacyData(m);
    save(true);
  } else if (table === 'eso') {
    const next = { ...item };
    if (field === 'data') {
      const dataNormalizada = normalizeFlexibleDateInput(rawValue, m, { simpleDayMonthOffset: 1 });
      if (!dataNormalizada) { undoStack.pop(); cancelInlineEdit(); return; }
      next.data = dataNormalizada;
    } else if (field === 'cliente') {
      const cliente = String(rawValue || '').trim();
      if (!cliente) { undoStack.pop(); cancelInlineEdit(); return; }
      next.cliente = cliente;
    } else if (field === 'tipo') {
      const tipo = String(rawValue || '').trim();
      if (!tipo) { undoStack.pop(); cancelInlineEdit(); return; }
      next.tipo = tipo;
    } else if (field === 'valor') {
      const valor = parseFloat(rawValue);
      if (isNaN(valor) || valor <= 0) { undoStack.pop(); cancelInlineEdit(); return; }
      next.valor = valor;
    } else if (field === 'entrada') {
      const entrada = String(rawValue || '').trim();
      if (!entrada) { undoStack.pop(); cancelInlineEdit(); return; }
      next.entrada = entrada;
    } else if (field === 'status') {
      next.status = normalizeEsoStatus(rawValue);
    }
    changed = JSON.stringify(next) !== JSON.stringify(item);
    if (!changed) { undoStack.pop(); cancelInlineEdit(); return; }
    const idx = esoData.findIndex(entry => entry.id === item.id);
    if (idx === -1) { undoStack.pop(); cancelInlineEdit(); return; }
    esoData[idx] = normalizeEsoEntry(next, idx);
    saveEsoData();
  }

  inlineEditState = null;
  if (table === 'varItem') {
    buildVarSelects();
    preserveCurrentScroll(() => renderMes());
    renderVarTable();
    return;
  }
  if (table === 'eso') {
    renderEso();
    return;
  }
  preserveCurrentScroll(() => renderMes());
}

function deleteItem(type, idx) {
  if (!confirm('Remover este item?')) return;
  const m = getCurrentMonth();
  const finalizeDelete = () => {
    recalcTotals(m);
    save();
    preserveCurrentScroll(() => renderMes());
  };
  if (type === 'renda' && m?.renda?.[idx]) {
    const item = m.renda[idx];
    const recurring = item?.recurringFixed !== false;
    const groupId = getIncomeRecurringGroupId(item);
    const sourceName = String(item?.fonte || '');
    const performDelete = (applyForward) => {
      recordHistoryState();
      m.renda.splice(idx, 1);
      if (applyForward && recurring && canPropagateRecurringFromMonth(m)) {
        removeRecurringIncomeForward(m, groupId, sourceName);
      }
      finalizeDelete();
    };
    if (recurring && canPropagateRecurringFromMonth(m)) {
      openRecurringChangeScopeModal({
        message: 'Esta receita fixa se repete em outros meses. Como você deseja aplicar a exclusão?',
        onThisMonth: () => performDelete(false),
        onForward: () => performDelete(true),
        onCancel: () => {}
      });
      return;
    }
    performDelete(false);
    return;
  }
  if (type === 'projeto' && m?.projetos?.[idx]) {
    const item = m.projetos[idx];
    const recurring = item?.recurringExtra === true;
    const groupId = String(item?.recurringGroupId || '').trim();
    const performDelete = (applyForward) => {
      recordHistoryState();
      m.projetos.splice(idx, 1);
      if (applyForward && recurring && groupId && canPropagateRecurringFromMonth(m)) {
        removeProjetoRecurringForward(m, groupId);
      }
      finalizeDelete();
    };
    if (recurring && groupId && canPropagateRecurringFromMonth(m)) {
      openRecurringChangeScopeModal({
        message: 'Esta renda extra recorrente se repete em outros meses. Como você deseja aplicar a exclusão?',
        onThisMonth: () => performDelete(false),
        onForward: () => performDelete(true),
        onCancel: () => {}
      });
      return;
    }
    performDelete(false);
    return;
  }
  recordHistoryState();
  if (type === 'despesa') {
    m.despesas.splice(idx, 1);
    const state = ensureDespSelectionState(m);
    state.splice(idx, 1);
  }
  else if (type === 'renda') m.renda.splice(idx, 1);
  else if (type === 'financialGoal') {
    const removedGoal = m.financialGoals[idx];
    if (removedGoal?.patrimonioMovementId) {
      patrimonioMovements = patrimonioMovements.filter(item => item.id !== removedGoal.patrimonioMovementId);
    }
    m.financialGoals.splice(idx, 1);
  }
  else {
    m.projetos.splice(idx, 1);
    m._projectSource = 'manual';
  }
  finalizeDelete();
}

function recalcTotals(m) {
  const varTotal = getCountedVarTotal(m);
  m.total_gastos = parseFloat(m.despesas.reduce((a,d)=>a+d.valor,0).toFixed(2));
  m.total_renda = parseFloat(m.renda.reduce((a,r)=>a+(isIncomeIncludedInTotals(r) ? r.valor : 0),0).toFixed(2));
  m.total_goals = parseFloat((m.financialGoals || []).reduce((a, goal) => a + (isFinancialGoalIncludedInTotals(goal) ? (goal.valor || 0) : 0), 0).toFixed(2));
  const totalProj = parseFloat(m.projetos.reduce((a,p)=>a+(isProjectIncludedInTotals(p) ? p.valor : 0),0).toFixed(2));
  m.resultado = parseFloat((m.total_renda + totalProj - m.total_gastos - m.total_goals).toFixed(2));
  m.categorias = getCategoryTotals(m);
}

// ============================================================
// CATEGORIAS
// ============================================================
function openAddCat() {
  openModal('modalCat');
  document.getElementById('modalCatTitle').textContent = 'Adicionar categoria';
}

function saveCat() {
  const cat = document.getElementById('catNome').value;
  if (!cat) { alert('Informe o nome da categoria'); return; }
  recordHistoryState();
  const m = getCurrentMonth();
  if (!m.categorias) m.categorias = {};
  if (!(cat in m.categorias)) m.categorias[cat] = 0;
  save();
  closeModal('modalCat');
  renderCatGrid();
}

function deleteCat(cat) {
  if (!confirm(`Remover categoria ${cat}?`)) return;
  recordHistoryState();
  const m = getCurrentMonth();
  delete m.categorias[cat];
  save();
  renderCatGrid();
}

let lastAddedVarEntry = null;

function openVarModal(mode) {
  varModalMode = mode || 'view';
  lastAddedVarEntry = null;
  const m = getCurrentMonth();
  normalizeMonth(m);
  buildVarSelects();
  renderVarTable();
  const addWrap = document.getElementById('varAddWrap');
  if (addWrap) addWrap.style.display = varModalMode === 'add' ? 'block' : 'none';
  if (varModalMode !== 'add') {
    const form = document.getElementById('varFormWrap');
    if (form) form.style.display = 'none';
  }
  openModal('modalVar');
}

function buildVarSelects() {
  const m = getCurrentMonth();
  const cats = getVariableCategoryOptions(m);
  const filtro = document.getElementById('varFiltroCat');
  const catSel = document.getElementById('varCat');
  const prevFiltro = filtro.value;
  const prevCat = catSel.value;

  filtro.innerHTML = '<option value="todas">Todas</option>' + cats.map(c => `<option value="${c}">${escapeHtml(formatCategoryOptionLabel(c))}</option>`).join('');
  const catOptions = ['<option value="">Selecione</option>']
    .concat(cats.map(c => `<option value="${c}">${escapeHtml(formatCategoryOptionLabel(c))}</option>`))
    .concat('<option value="nova">+ Nova categoria</option>');
  catSel.innerHTML = catOptions.join('');
  document.getElementById('varNovaCatWrap').style.display = 'none';

  filtro.value = cats.includes(prevFiltro) ? prevFiltro : 'todas';
  syncVarCategoryWithFilter(cats.includes(prevCat) ? prevCat : prevCat === 'nova' ? 'nova' : '');
}

function syncVarCategoryWithFilter(preferredCategory = '') {
  const filtro = document.getElementById('varFiltroCat');
  const catSel = document.getElementById('varCat');
  const novaWrap = document.getElementById('varNovaCatWrap');
  const novaInput = document.getElementById('varNovaCat');
  if (!filtro || !catSel) return;

  const filtroAtual = filtro.value || 'todas';
  const hasPreferred = preferredCategory && Array.from(catSel.options).some(opt => opt.value === preferredCategory);
  if (hasPreferred) {
    catSel.value = preferredCategory;
  } else if (!catSel.value && filtroAtual !== 'todas' && Array.from(catSel.options).some(opt => opt.value === filtroAtual)) {
    // If the form is empty, prefill from the active filter without locking the field.
    catSel.value = filtroAtual;
  } else if (!Array.from(catSel.options).some(opt => opt.value === catSel.value)) {
    catSel.value = '';
  }
  if (catSel.value !== 'nova' && novaWrap) novaWrap.style.display = 'none';
  if (catSel.value !== 'nova' && novaInput) novaInput.value = '';
  toggleNovaCat();
}

function handleVarFilterChange() {
  const catSel = document.getElementById('varCat');
  syncVarCategoryWithFilter(catSel?.value || '');
  renderVarTable();
}

function toggleNovaCat() {
  const sel = document.getElementById('varCat');
  const wrap = document.getElementById('varNovaCatWrap');
  wrap.style.display = sel.value === 'nova' ? 'block' : 'none';
}

function toggleVarForm() {
  const wrap = document.getElementById('varFormWrap');
  if (!wrap) return;
  const isOpen = wrap.style.display !== 'none';
  wrap.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) {
    const today = new Date();
    const todayText = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getFullYear()).slice(-2)}`;
    document.getElementById('varTitulo').value = '';
    document.getElementById('varValor').value = '';
    document.getElementById('varData').value = todayText;
    document.getElementById('varNovaCat').value = '';
    document.getElementById('varCat').value = document.getElementById('varCat').options[0]?.value || '';
    updateVarTitleSuggestions();
    toggleNovaCat();
  }
}

function toggleRendaFormPaid(checked) {
  const sendFlag = document.getElementById('fi_renda_send_patrimonio');
  if (!sendFlag) return;
  if (!checked) {
    sendFlag.value = '0';
    return;
  }
  openYesNoQuestion(
    'Deseja enviar esse valor para uma conta?',
    () => { sendFlag.value = '1'; },
    () => { sendFlag.value = '0'; }
  );
}

function openRendaPatrimonioModalPreset(source, amount) {
  if (typeof openPatrimonioMovementModal !== 'function') return;
  if (typeof ensurePatrimonioData === 'function') ensurePatrimonioData();
  if (!Array.isArray(patrimonioAccounts) || !patrimonioAccounts.length) {
    alert('Crie uma conta no Patrimônio para enviar essa renda.');
    return;
  }
  openPatrimonioMovementModal({
    type: 'aporte',
    accountId: patrimonioSelectedAccountId || patrimonioAccounts[0]?.id || '',
    value: amount,
    description: `Renda · ${source}`,
    date: typeof todayIsoDate === 'function' ? todayIsoDate() : ''
  });
}

function toggleRendaPaidStatus(index, checked) {
  const m = getCurrentMonth();
  if (!m || !Array.isArray(m.renda) || !m.renda[index]) return;
  recordHistoryState();
  m.renda[index].paid = checked === true;
  save(true);
  preserveCurrentScroll(() => renderMes());
  if (checked === true) {
    openYesNoQuestion(
      'Deseja enviar esse valor para uma conta?',
      () => openRendaPatrimonioModalPreset(m.renda[index].fonte || 'Renda', Number(m.renda[index].valor || 0))
    );
  }
}

function toggleProjetoPaidStatus(index, checked) {
  const m = getCurrentMonth();
  if (!m || !Array.isArray(m.projetos) || !m.projetos[index]) return;
  recordHistoryState();
  m.projetos[index].paid = checked === true;
  m._projectSource = 'manual';
  save(true);
  preserveCurrentScroll(() => renderMes());
  if (checked === true) {
    openYesNoQuestion(
      'Deseja enviar esse valor para uma conta?',
      () => openRendaPatrimonioModalPreset(m.projetos[index].nome || 'Renda extra', Number(m.projetos[index].valor || 0))
    );
  }
}

function getLastVarEntry() {
  for (let monthIndex = data.length - 1; monthIndex >= 0; monthIndex -= 1) {
    const month = data[monthIndex];
    const entries = Array.isArray(month?.gastosVar) ? month.gastosVar : [];
    for (let itemIndex = entries.length - 1; itemIndex >= 0; itemIndex -= 1) {
      const item = entries[itemIndex];
      if (item?.titulo && Number(item?.valor) > 0 && item?.categoria) {
        return item;
      }
    }
  }
  return null;
}

function repeatLastVarEntry() {
  const lastEntry = getLastVarEntry();
  if (!lastEntry) {
    alert('Ainda não existe um gasto diário anterior para repetir.');
    return;
  }
  const wrap = document.getElementById('varFormWrap');
  if (wrap && wrap.style.display === 'none') {
    wrap.style.display = 'flex';
  }
  const today = new Date();
  const todayText = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getFullYear()).slice(-2)}`;
  document.getElementById('varTitulo').value = lastEntry.titulo || '';
  document.getElementById('varValor').value = lastEntry.valor || '';
  document.getElementById('varData').value = todayText;
  document.getElementById('varNovaCat').value = '';
  syncVarCategoryWithFilter(lastEntry.categoria || '');
  updateVarTitleSuggestions();
  const valueInput = document.getElementById('varValor');
  if (valueInput) valueInput.focus();
}

function handleVarFormKeydown(event) {
  if (event.key !== 'Enter') return;
  const target = event.target;
  if (target && target.tagName === 'TEXTAREA') return;
  event.preventDefault();
  addVarGasto();
}

function normalizeVarSuggestionText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getVarTitleSuggestions(term = '') {
  const query = normalizeVarSuggestionText(term);
  if (query.length < 1) return [];

  const titles = new Map();
  data.forEach((month, monthIndex) => {
    (month?.gastosVar || []).forEach((item, itemIndex) => {
      const title = String(item?.titulo || '').trim();
      if (!title) return;
      const normalizedTitle = normalizeVarSuggestionText(title);
      if (!normalizedTitle.includes(query)) return;

      const existing = titles.get(normalizedTitle) || {
        title,
        normalizedTitle,
        count: 0,
        startsWith: false,
        lastSeen: -1
      };

      existing.count += 1;
      existing.startsWith = existing.startsWith || normalizedTitle.startsWith(query);
      existing.lastSeen = Math.max(existing.lastSeen, (monthIndex * 1000) + itemIndex);
      titles.set(normalizedTitle, existing);
    });
  });

  return Array.from(titles.values())
    .sort((a, b) => {
      if (a.startsWith !== b.startsWith) return a.startsWith ? -1 : 1;
      if (a.count !== b.count) return b.count - a.count;
      if (a.lastSeen !== b.lastSeen) return b.lastSeen - a.lastSeen;
      if (a.title.length !== b.title.length) return a.title.length - b.title.length;
      return a.title.localeCompare(b.title, 'pt-BR');
    })
    .slice(0, 8)
    .map(item => item.title);
}

function updateVarTitleSuggestions() {
  const input = document.getElementById('varTitulo');
  const list = document.getElementById('varTituloSugestoes');
  if (!input || !list) return;

  const suggestions = getVarTitleSuggestions(input.value);
  list.innerHTML = '';
  suggestions.forEach(title => {
    const option = document.createElement('option');
    option.value = title;
    list.appendChild(option);
  });
}

function isSameVarEntry(a, b) {
  if (!a || !b) return false;
  return normalizeVarSuggestionText(a.titulo) === normalizeVarSuggestionText(b.titulo)
    && Number(a.valor) === Number(b.valor)
    && String(a.data || '').trim() === String(b.data || '').trim()
    && normalizeVarSuggestionText(a.categoria) === normalizeVarSuggestionText(b.categoria);
}

function toggleDespNovaCat() {
  const sel = document.getElementById('fi_cat');
  const wrap = document.getElementById('fi_cat_nova_wrap');
  if (wrap) wrap.style.display = sel.value === 'nova' ? 'block' : 'none';
}

function addVarGasto() {
  const titulo = document.getElementById('varTitulo').value.trim();
  const valor = parseFloat(document.getElementById('varValor').value);
  const dataTxt = document.getElementById('varData').value.trim();
  const dataNormalizada = normalizeFlexibleDateInput(dataTxt, getCurrentMonth(), { simpleDayMonthOffset: 1 });
  let cat = document.getElementById('varCat').value;
  const selectedCatValue = cat;
  if (cat === 'nova') {
    cat = document.getElementById('varNovaCat').value.trim();
  }
  if (!titulo || isNaN(valor) || valor <= 0 || !cat) { alert('Preencha título, valor e categoria.'); return; }
  if (!dataNormalizada) { alert('Informe dia (1 a 31) ou data completa (dd/mm/aa).'); return; }

  const m = getCurrentMonth();
  normalizeMonth(m);
  if (!m.categorias) m.categorias = {};
  if (!(cat in m.categorias)) m.categorias[cat] = 0;
  const nextEntry = { titulo, valor, data: dataNormalizada, categoria: cat };
  const lastEntry = (m.gastosVar || [])[m.gastosVar.length - 1];
  if (isSameVarEntry(lastEntry, nextEntry) && !confirm('Esse gasto é igual ao último que você acabou de adicionar. Quer adicionar novamente mesmo assim?')) {
    return;
  }
  recordHistoryState();
  m.gastosVar.push(nextEntry);
  lastAddedVarEntry = { monthId: m.id, idx: m.gastosVar.length - 1 };

  recalcTotals(m);
  save();
  renderCatGrid();
  preserveCurrentScroll(() => renderMes());
  const filtro = document.getElementById('varFiltroCat');
  if (filtro && filtro.value !== 'todas' && filtro.value !== cat) {
    filtro.value = 'todas';
  }
  buildVarSelects();
  renderVarTable();

  document.getElementById('varTitulo').value = titulo;
  document.getElementById('varValor').value = '';
  document.getElementById('varData').value = dataNormalizada;
  document.getElementById('varCat').value = selectedCatValue === 'nova' ? 'nova' : cat;
  document.getElementById('varNovaCat').value = selectedCatValue === 'nova' ? cat : '';
  syncVarCategoryWithFilter(selectedCatValue === 'nova' ? 'nova' : cat);
  updateVarTitleSuggestions();
  const valorInput = document.getElementById('varValor');
  if (valorInput) valorInput.focus();
}

function renderVarTable() {
  const m = getCurrentMonth();
  normalizeMonth(m);
  const filtro = document.getElementById('varFiltroCat').value || 'todas';
  let rows = (m.gastosVar || []).map((g, idx) => ({...g, __idx: idx}));
  if (filtro !== 'todas') rows = rows.filter(g => g.categoria === filtro);

  const campo = varSort.field || 'valor';
  const direcao = varSort.direction || 'desc';
  rows.sort((a,b) => {
    if (campo === 'categoria') {
      const ca = (a.categoria || '').localeCompare(b.categoria || '', 'pt-BR');
      return direcao === 'asc' ? ca : -ca;
    }
    if (campo === 'valor') return (direcao === 'asc' ? a.valor - b.valor : b.valor - a.valor);
    if (campo === 'data') {
      const da = parseData(a.data);
      const db = parseData(b.data);
      return direcao === 'asc' ? da - db : db - da;
    }
    const ta = (a.titulo||'').toLowerCase();
    const tb = (b.titulo||'').toLowerCase();
    return direcao === 'asc' ? ta.localeCompare(tb) : tb.localeCompare(ta);
  });

  if (lastAddedVarEntry?.monthId === m.id) {
    const recentIdx = rows.findIndex(row => row.__idx === lastAddedVarEntry.idx);
    if (recentIdx > 0) {
      const [recentRow] = rows.splice(recentIdx, 1);
      rows.unshift(recentRow);
    }
  }

  const tbody = document.getElementById('varTableBody');
  updateVarTableHeaders();
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:18px;color:var(--text3)">Nenhum gasto variável lançado.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((g, i) => `
    <tr>
      ${renderInlineCell({ table:'varItem', row:g.__idx, field:'data', kind:'var-date', value:g.data || '', displayValue:escapeHtml(g.data || '—'), style:'padding-left:16px' })}
      ${renderInlineCell({ table:'varItem', row:g.__idx, field:'categoria', kind:'var-category', value:g.categoria, displayValue:renderCategoryLabel(g.categoria) })}
      ${renderInlineCell({ table:'varItem', row:g.__idx, field:'titulo', kind:'text', value:g.titulo || '', displayValue:escapeHtml(g.titulo || '—') })}
      ${renderInlineCell({ table:'varItem', row:g.__idx, field:'valor', kind:'number', value:g.valor, displayValue:fmt(g.valor), className:'amount amount-neg' })}
      <td><button class="btn-icon" onclick="deleteVar(${g.__idx})">✕</button></td>
    </tr>
  `).join('');
}

function updateVarTableHeaders() {
  const table = document.getElementById('varTable');
  if (!table) return;
  const labels = { data: 'Data', categoria: 'Categoria', titulo: 'Título', valor: 'Valor' };
  table.querySelectorAll('th.sortable').forEach(th => {
    const onclick = th.getAttribute('onclick') || '';
    const match = onclick.match(/setVarSort\('([^']+)'\)/);
    const field = match ? match[1] : '';
    const arrow = varSort.field === field ? (varSort.direction === 'asc' ? ' ▲' : ' ▼') : '';
    th.textContent = `${labels[field] || th.textContent.replace(/[ ▲▼]+$/,'')}${arrow}`;
  });
}

function setVarSort(field) {
  if (varSort.field === field) {
    varSort.direction = varSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    varSort = { field, direction: field === 'valor' ? 'desc' : 'asc' };
  }
  renderVarTable();
}

// Daily categories table
function renderDaily() {
  const m = getCurrentMonth();
  const body = document.getElementById('dailyBody');
  if (!body) return;
  const catTotals = getVariableCategoryTotals(m);
  const total = Object.values(catTotals || {}).reduce((acc, val) => acc + val, 0);
  const dailyGoalTotal = getDailyGoalTarget(m);
  updateDailyTableHeaders();
  const rowsData = getSortedDailyRows(catTotals, total);
  const rows = rowsData.map(({ categoria, valor, percentual }) => {
        const meta = (m.dailyGoals && m.dailyGoals[categoria] !== undefined) ? m.dailyGoals[categoria] : null;
        const valorColor = meta === null ? 'var(--text)' : (valor > meta ? 'var(--red)' : 'var(--green)');
        const progressMarkup = renderDailyGoalProgress(meta, valor, percentual);
        return `
        <tr>
          ${renderInlineCell({ table:'daily', row:categoria, field:'categoria', kind:'text', value:categoria, displayValue:renderCategoryLabel(categoria), style:'padding-left:22px' })}
          <td class="amount" style="color:${valorColor}">${fmt(valor)}</td>
          ${renderInlineCell({ table:'daily', row:categoria, field:'meta', kind:'number', value:meta ?? '', displayValue:meta === null ? '—' : fmt(meta), className:'text-muted' })}
          <td>${progressMarkup}</td>
        </tr>`;
      }).join('');
    body.innerHTML = rows || '<tr><td colspan="5" style="padding:12px;color:var(--text3)">Sem gastos variáveis.</td></tr>';
    const totalEl = document.getElementById('dailyTotal');
    if (totalEl) totalEl.textContent = fmt(total);
    const totalMetaEl = document.getElementById('dailyGoalTotal');
    if (totalMetaEl) {
      totalMetaEl.textContent = dailyGoalTotal > 0 ? fmt(dailyGoalTotal) : '—';
      totalMetaEl.className = dailyGoalTotal > 0 ? 'text-muted' : 'text-muted';
    }
    const totalUsageEl = document.querySelector('#dailyTable tfoot tr td:last-child');
    if (totalUsageEl) totalUsageEl.innerHTML = renderDailyGoalProgress(dailyGoalTotal > 0 ? dailyGoalTotal : null, total, dailyGoalTotal > 0 ? (total / dailyGoalTotal) * 100 : 0, true);
  }

function getSortedDailyRows(catTotals, total) {
  const rows = Object.keys(catTotals || {}).map(categoria => ({
      categoria,
      valor: catTotals[categoria] || 0,
      percentual: (() => {
        const meta = getCurrentMonth().dailyGoals && getCurrentMonth().dailyGoals[categoria] !== undefined
          ? Number(getCurrentMonth().dailyGoals[categoria]) || 0
          : 0;
        return meta > 0 ? ((catTotals[categoria] || 0) / meta) * 100 : 0;
      })()
    }));
  if (!dailySort.field) {
    return rows.sort((a, b) => {
      const ai = IMPORTED_CATEGORY_ORDER.indexOf(a.categoria);
      const bi = IMPORTED_CATEGORY_ORDER.indexOf(b.categoria);
      if (ai === -1 && bi === -1) return a.categoria.localeCompare(b.categoria, 'pt-BR');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }
  const factor = dailySort.direction === 'desc' ? -1 : 1;
    return rows.sort((a, b) => {
      if (dailySort.field === 'valor') return (a.valor - b.valor) * factor;
      if (dailySort.field === 'percentual') return (a.percentual - b.percentual) * factor;
      return a.categoria.localeCompare(b.categoria, 'pt-BR') * factor;
    });
  }

function updateDailyTableHeaders() {
  const table = document.getElementById('dailyTable');
  if (!table) return;
    const labels = { categoria: 'Categoria', valor: 'Total gasto', percentual: '' };
  table.querySelectorAll('th.sortable').forEach(th => {
    const onclick = th.getAttribute('onclick') || '';
    const match = onclick.match(/setDailySort\('([^']+)'\)/);
    const field = match ? match[1] : '';
    const arrow = dailySort.field === field ? (dailySort.direction === 'asc' ? ' ▲' : ' ▼') : '';
    th.textContent = `${Object.prototype.hasOwnProperty.call(labels, field) ? labels[field] : th.textContent.replace(/[ ▲▼]+$/,'')}${arrow}`;
  });
}

function setDailySort(field) {
  if (dailySort.field === field) {
    dailySort.direction = dailySort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    dailySort = { field, direction: 'asc' };
  }
  renderDaily();
}

function deleteVar(idx) {
  if (!confirm('Remover este gasto variável?')) return;
  recordHistoryState();
  const m = getCurrentMonth();
  m.gastosVar.splice(idx,1);
  if (m.gastosVar.length === 0) m.categorias = {};
  recalcTotals(m);
  save();
  renderCatGrid();
  preserveCurrentScroll(() => renderMes());
  renderVarTable();
}

function areProjectListsEquivalent(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  return left.every((item, idx) =>
    (item?.nome || '') === (right[idx]?.nome || '') &&
    Number(item?.valor || 0) === Number(right[idx]?.valor || 0)
  );
}

function ensureProjetos(m) {
  if (!m) return;
  if (!canUseBundledFinanceData()) {
    if (!Array.isArray(m.projetos)) m.projetos = [];
    return;
  }
  if (IMPORTED_PROJECTS[m.id]) {
    const imported = getImportedProjectsForMonth(m.id);
    if (!Array.isArray(m.projetos)) {
      m.projetos = imported;
      m._projectSource = 'imported';
      return;
    }
    if (m._projectSource === 'imported' || m._projectSource === 'manual') {
      return;
    }
    const originalHistProjects = HIST_DATA.find(o => o.id === m.id)?.projetos || [];
    const shouldHydrateFromImport = m.projetos.length === 0 || areProjectListsEquivalent(m.projetos, originalHistProjects);
    if (shouldHydrateFromImport) {
      m.projetos = imported;
    }
    m._projectSource = 'imported';
    return;
  }
  if (!Array.isArray(m.projetos)) m.projetos = [];
  if (m.projetos.length === 0) {
    const orig = HIST_DATA.find(o => o.id === m.id);
    if (orig && Array.isArray(orig.projetos) && orig.projetos.length) {
      m.projetos = JSON.parse(JSON.stringify(orig.projetos));
    }
  }
}

function saveObs() {
  recordHistoryState();
  const m = getCurrentMonth();
  m.obs = document.getElementById('obsField').value;
  save();
  alert('Observação salva.');
}

// ============================================================
// NEW MONTH
// ============================================================
function getDefaultMonthCopyPreferences() {
  return {
    enabled: true,
    despesas: {},
    gastosCategorias: {},
    renda: {},
    projetos: {}
  };
}

function getMonthCopyPreferences() {
  const saved = Storage.getJSON(STORAGE_KEYS.monthCopyPreferences, null) || {};
  return {
    enabled: saved.enabled !== false,
    despesas: { ...(saved.despesas || {}) },
    gastosCategorias: { ...(saved.gastosCategorias || {}) },
    renda: { ...(saved.renda || {}) },
    projetos: { ...(saved.projetos || {}) }
  };
}

function saveMonthCopyPreferences(prefs) {
  Storage.setJSON(STORAGE_KEYS.monthCopyPreferences, {
    enabled: prefs.enabled !== false,
    despesas: { ...(prefs.despesas || {}) },
    gastosCategorias: { ...(prefs.gastosCategorias || {}) },
    renda: { ...(prefs.renda || {}) },
    projetos: { ...(prefs.projetos || {}) }
  });
}

function renderDailyGoalProgress(meta, valor, percentual, compact = false) {
  if (!(meta > 0)) {
    return '<span class="daily-goal-progress-empty">—</span>';
  }
  const clampedRatio = Math.min(Math.max((percentual || 0) / 100, 0), 1);
  const percentUsed = Math.round(clampedRatio * 100);
  const hue = Math.round(120 - (120 * clampedRatio));
  const barColor = `hsl(${hue} 62% 46%)`;
  const remaining = Number((meta - valor).toFixed(2));
  const isOver = remaining < 0;
  const moodEmoji = getDailyGoalMoodSymbol(percentual || 0);
  const percentLabel = `${Math.abs(Number(percentual || 0)).toFixed(0)}%`;
  return `
    <div class="daily-goal-progress ${compact ? 'is-compact' : ''}">
      <div class="daily-goal-progress-row">
        <span class="daily-goal-progress-emoji" aria-hidden="true">${moodEmoji}</span>
        <div class="daily-goal-progress-main">
          <div class="daily-goal-progress-topline ${isOver ? 'is-negative' : ''}">${isOver ? 'Ultrapassou:' : 'Restam:'} ${fmt(Math.abs(remaining))}<span class="daily-goal-progress-percent">${escapeHtml(percentLabel)}</span></div>
          <div class="daily-goal-progress-track" aria-hidden="true">
            <div class="daily-goal-progress-fill" style="width:${percentUsed}%;background:${barColor};"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getDailyGoalMoodSymbol(percentual) {
  const usage = Number(percentual) || 0;
  if (usage < 35) return '😌';
  if (usage < 55) return '🙂';
  if (usage < 75) return '😐';
  if (usage < 90) return '😳';
  if (usage <= 100) return '⚠️';
  return '🚨';
}

function getPreviousMonthFor(currentMonth) {
  const idx = data.findIndex(item => item?.id === currentMonth?.id);
  if (idx <= 0) return null;
  return data[idx - 1] || null;
}

function renderMonthMetricVariation(currentValue, previousValue, options = {}) {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);
  if (!(previous > 0)) return '<div class="mc-variation mc-variation-neutral">↔ Sem base anterior</div>';
  const percent = ((current - previous) / previous) * 100;
  if (Math.abs(percent) < 0.01) return '<div class="mc-variation mc-variation-neutral">↔ 0,0% vs mês anterior</div>';
  const up = percent > 0;
  const invertMeaning = options?.invertMeaning === true;
  const positiveClass = invertMeaning ? 'mc-variation-down' : 'mc-variation-up';
  const negativeClass = invertMeaning ? 'mc-variation-up' : 'mc-variation-down';
  const arrow = up ? '▲' : '▼';
  return `<div class="mc-variation ${up ? positiveClass : negativeClass}">${arrow} ${Math.abs(percent).toFixed(1)}% vs mês anterior</div>`;
}

function getTopVariableCategory(month) {
  const totals = getVariableCategoryTotals(month || {});
  const entries = Object.entries(totals || {}).filter(([, value]) => Number(value) > 0);
  if (!entries.length) return null;
  entries.sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));
  return { category: entries[0][0], value: Number(entries[0][1] || 0) };
}

function getBestCategoryDrop(currentMonth, previousMonth) {
  if (!currentMonth || !previousMonth) return null;
  const currentTotals = getVariableCategoryTotals(currentMonth);
  const previousTotals = getVariableCategoryTotals(previousMonth);
  let best = null;
  Object.keys(previousTotals || {}).forEach(category => {
    const previousValue = Number(previousTotals[category] || 0);
    const currentValue = Number(currentTotals[category] || 0);
    const diff = previousValue - currentValue;
    if (diff > 0.009 && (!best || diff > best.diff)) {
      const percent = previousValue > 0 ? Math.round((diff / previousValue) * 100) : 0;
      best = { category, diff, percent };
    }
  });
  return best;
}

function getWorstCategoryIncrease(currentMonth, previousMonth) {
  if (!currentMonth || !previousMonth) return null;
  const currentTotals = getVariableCategoryTotals(currentMonth);
  const previousTotals = getVariableCategoryTotals(previousMonth);
  let worst = null;
  Object.keys(currentTotals || {}).forEach(category => {
    const currentValue = Number(currentTotals[category] || 0);
    const previousValue = Number(previousTotals[category] || 0);
    const diff = currentValue - previousValue;
    if (diff > 0.009 && (!worst || diff > worst.diff)) {
      const percent = previousValue > 0 ? Math.round((diff / previousValue) * 100) : 100;
      worst = { category, diff, percent };
    }
  });
  return worst;
}

function addTemplatedMessages(target, condition, templates, payload = {}) {
  if (!condition || !Array.isArray(templates) || !templates.length) return;
  templates.forEach(template => {
    if (typeof template !== 'function') return;
    const text = template(payload);
    if (text) target.push(text);
  });
}

function getCurrentMonthHighlightMessage(month, forceRefresh = false) {
  if (!month) return '';
  if (!forceRefresh && currentMonthMessageCache.monthId === month.id && currentMonthMessageCache.text) {
    return currentMonthMessageCache.text;
  }

  const previousMonth = getPreviousMonthFor(month);
  const totals = getEffectiveTotalsForMes(month);
  const totalIncome = Number(totals.rendaFixa || 0) + Number(totals.totalProj || 0);
  const totalExpenses = Number(totals.totalGastos || 0);
  const totalGoals = Number(totals.totalFinancialGoals || 0);
  const result = Number(totals.resultadoMes || 0);
  const dailyGoalTotal = getDailyGoalTarget(month);
  const dailySpent = Object.values(getVariableCategoryTotals(month) || {}).reduce((acc, value) => acc + (Number(value) || 0), 0);
  const topCategory = getTopVariableCategory(month);
  const bestDrop = getBestCategoryDrop(month, previousMonth);
  const worstIncrease = getWorstCategoryIncrease(month, previousMonth);
  const goalRatio = totalIncome > 0 ? Math.round((totalGoals / totalIncome) * 100) : 0;
  const expenseRatio = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;
  const dailyRatio = dailyGoalTotal > 0 ? Math.round((dailySpent / dailyGoalTotal) * 100) : 0;
  const availableAfterEssentials = Number((totalIncome - totalExpenses - totalGoals).toFixed(2));
  const topCategoryShare = topCategory && totalExpenses > 0 ? Math.round((topCategory.value / totalExpenses) * 100) : 0;
  const previousTotals = previousMonth ? getEffectiveTotalsForMes(previousMonth) : null;
  const resultDiff = previousTotals ? Number(result - Number(previousTotals.resultadoMes || 0)) : 0;

  const candidates = [];
  addTemplatedMessages(candidates, bestDrop && bestDrop.diff >= 1, [
    ({ bestDrop }) => `Você gastou ${fmt(bestDrop.diff)} a menos em ${bestDrop.category.toLowerCase()} do que no mês passado.`,
    ({ bestDrop }) => `${bestDrop.category} caiu ${bestDrop.percent}% em relação ao último mês e ajudou a aliviar o total.`,
    ({ bestDrop }) => `Houve uma queda de ${fmt(bestDrop.diff)} em ${bestDrop.category.toLowerCase()} na comparação com o mês anterior.`,
    ({ bestDrop }) => `${bestDrop.category} perdeu peso no orçamento neste mês, com ${fmt(bestDrop.diff)} a menos do que antes.`,
    ({ bestDrop }) => `Seu mês ficou um pouco mais leve porque ${bestDrop.category.toLowerCase()} recuou ${fmt(bestDrop.diff)}.`,
    ({ bestDrop }) => `${bestDrop.category} veio mais controlada neste ciclo e isso já apareceu nos números.`,
    ({ bestDrop }) => `Na comparação com o último mês, ${bestDrop.category.toLowerCase()} caiu ${bestDrop.percent}%`,
    ({ bestDrop }) => `${bestDrop.category} foi a categoria que mais aliviou na virada de mês, com ${fmt(bestDrop.diff)} a menos.`,
    ({ bestDrop }) => `A maior redução até aqui veio de ${bestDrop.category.toLowerCase()}, que recuou ${fmt(bestDrop.diff)}.`,
    ({ bestDrop }) => `Seu controle em ${bestDrop.category.toLowerCase()} melhorou em relação ao mês passado.`
  ], { bestDrop });

  addTemplatedMessages(candidates, worstIncrease && worstIncrease.diff >= 1, [
    ({ worstIncrease }) => `${worstIncrease.category} subiu ${fmt(worstIncrease.diff)} em relação ao mês anterior. Vale acompanhar essa categoria mais cedo.`,
    ({ worstIncrease }) => `${worstIncrease.category} cresceu ${worstIncrease.percent}% sobre o mês passado e merece mais atenção neste ciclo.`,
    ({ worstIncrease }) => `O maior aumento até aqui veio de ${worstIncrease.category.toLowerCase()}, com ${fmt(worstIncrease.diff)} a mais.`,
    ({ worstIncrease }) => `${worstIncrease.category} puxou o mês para cima em ${fmt(worstIncrease.diff)} na comparação com o anterior.`,
    ({ worstIncrease }) => `Se houver uma categoria para observar mais de perto agora, é ${worstIncrease.category.toLowerCase()}.`,
    ({ worstIncrease }) => `${worstIncrease.category} acelerou neste mês e já está acima do ritmo do último fechamento.`,
    ({ worstIncrease }) => `A diferença mais visível para o mês passado está em ${worstIncrease.category.toLowerCase()}.`,
    ({ worstIncrease }) => `${worstIncrease.category} está pesando mais cedo desta vez. Ainda dá para ajustar o ritmo.`,
    ({ worstIncrease }) => `${worstIncrease.category} foi o grupo de gastos que mais cresceu na comparação recente.`,
    ({ worstIncrease }) => `Os gastos em ${worstIncrease.category.toLowerCase()} começaram mais acelerados este mês.`
  ], { worstIncrease });

  addTemplatedMessages(candidates, totalGoals > 0 && totalIncome > 0, [
    ({ totalGoals, goalRatio }) => `Você já separou ${fmt(totalGoals)} para metas, o equivalente a ${goalRatio}% da renda deste mês.`,
    ({ totalGoals }) => `${fmt(totalGoals)} já ganharam destino nas metas financeiras deste mês.`,
    ({ totalGoals, totalIncome }) => `De ${fmt(totalIncome)} que entraram, ${fmt(totalGoals)} já foram reservados para metas.`,
    ({ goalRatio }) => `${goalRatio}% da renda do mês já está direcionada para metas.`,
    ({ totalGoals }) => `Suas metas já ocupam ${fmt(totalGoals)} do planejamento atual.`,
    ({ totalGoals }) => `${fmt(totalGoals)} já estão protegidos dentro das metas do mês.`,
    ({ totalGoals, goalRatio }) => `O valor separado em metas já representa uma fatia importante do mês: ${goalRatio}%.`,
    ({ totalGoals }) => `O mês já começou com ${fmt(totalGoals)} alocados para metas.`,
    ({ totalGoals }) => `Você já deu destino a ${fmt(totalGoals)} antes que esse valor se espalhe no mês.`,
    ({ totalGoals }) => `${fmt(totalGoals)} já foram reservados. Isso ajuda o restante do mês a ficar mais claro.`
  ], { totalGoals, goalRatio, totalIncome });

  addTemplatedMessages(candidates, dailyGoalTotal > 0 && dailySpent <= dailyGoalTotal, [
    ({ dailyRatio, dailyGoalTotal, dailySpent }) => `Os gastos diários usaram ${dailyRatio}% da meta total. Ainda restam ${fmt(dailyGoalTotal - dailySpent)} nesse espaço.`,
    ({ dailyGoalTotal, dailySpent }) => `Da meta total de gastos diários, ainda sobram ${fmt(dailyGoalTotal - dailySpent)}.`,
    ({ dailyRatio }) => `Os gastos diários ainda estão dentro da meta, com ${dailyRatio}% já utilizados.`,
    ({ dailySpent, dailyGoalTotal }) => `Você já usou ${fmt(dailySpent)} dos ${fmt(dailyGoalTotal)} planejados para gastos diários.`,
    ({ dailyGoalTotal, dailySpent }) => `Ainda existe uma margem de ${fmt(dailyGoalTotal - dailySpent)} dentro da meta diária.`,
    ({ dailyRatio }) => `O ritmo dos gastos diários ainda cabe no que foi planejado.`,
    ({ dailySpent }) => `Até aqui, os gastos do dia a dia somam ${fmt(dailySpent)}.`,
    ({ dailyGoalTotal, dailySpent }) => `O espaço restante nos gastos diários ainda é de ${fmt(dailyGoalTotal - dailySpent)}.`,
    ({ dailyRatio }) => `A meta de gastos diários ainda está respirando: ${dailyRatio}% usados.`,
    ({ dailyGoalTotal, dailySpent }) => `${fmt(dailyGoalTotal - dailySpent)} ainda cabem no orçamento diário deste mês.`
  ], { dailyRatio, dailyGoalTotal, dailySpent });

  addTemplatedMessages(candidates, dailyGoalTotal > 0 && dailySpent > dailyGoalTotal, [
    ({ dailyGoalTotal, dailySpent }) => `Os gastos diários passaram da meta em ${fmt(dailySpent - dailyGoalTotal)}. Ajustar o ritmo agora pode aliviar o fechamento.`,
    ({ dailyGoalTotal, dailySpent }) => `A meta de gastos diários já ficou para trás em ${fmt(dailySpent - dailyGoalTotal)}.`,
    ({ dailySpent, dailyGoalTotal }) => `Os gastos do dia a dia já excederam o planejado em ${fmt(dailySpent - dailyGoalTotal)}.`,
    ({ dailySpent, dailyGoalTotal }) => `Os gastos diários já ultrapassaram o limite previsto para este mês.`,
    ({ dailySpent, dailyGoalTotal }) => `Os gastos diários estão acima do limite e isso já aparece em ${fmt(dailySpent - dailyGoalTotal)}.`,
    ({ dailyGoalTotal, dailySpent }) => `Ultrapassar a meta diária em ${fmt(dailySpent - dailyGoalTotal)} muda bastante o fechamento.`,
    ({ dailyGoalTotal, dailySpent }) => `Se os gastos diários continuarem nesse ritmo, o mês tende a ficar mais pressionado.`,
    ({ dailySpent, dailyGoalTotal }) => `O excesso atual nos gastos diários já soma ${fmt(dailySpent - dailyGoalTotal)}.`,
    ({ dailySpent, dailyGoalTotal }) => `A meta diária foi ultrapassada. Vale proteger melhor o restante do mês.`,
    ({ dailySpent, dailyGoalTotal }) => `O orçamento do dia a dia já está acima do planejado.`
  ], { dailyGoalTotal, dailySpent });

  addTemplatedMessages(candidates, availableAfterEssentials > 0, [
    ({ availableAfterEssentials }) => `Depois das despesas e metas, ainda restam ${fmt(availableAfterEssentials)} livres no mês.`,
    ({ availableAfterEssentials }) => `${fmt(availableAfterEssentials)} ainda estão livres depois do que já foi comprometido.`,
    ({ availableAfterEssentials }) => `O mês ainda tem ${fmt(availableAfterEssentials)} sem destino definido.`,
    ({ availableAfterEssentials }) => `Depois do essencial, sobram ${fmt(availableAfterEssentials)} para o restante do mês.`,
    ({ availableAfterEssentials }) => `Ainda existe uma folga de ${fmt(availableAfterEssentials)} no planejamento atual.`,
    ({ availableAfterEssentials }) => `${fmt(availableAfterEssentials)} ainda podem ser usados com mais intenção neste mês.`,
    ({ availableAfterEssentials }) => `O valor ainda livre no mês soma ${fmt(availableAfterEssentials)}.`,
    ({ availableAfterEssentials }) => `Você ainda tem ${fmt(availableAfterEssentials)} fora de despesas e metas.`,
    ({ availableAfterEssentials }) => `Depois do que já foi reservado, o mês ainda guarda ${fmt(availableAfterEssentials)} de margem.`,
    ({ availableAfterEssentials }) => `${fmt(availableAfterEssentials)} ainda podem virar folga em vez de pressão no fechamento.`
  ], { availableAfterEssentials });

  addTemplatedMessages(candidates, availableAfterEssentials < 0, [
    ({ availableAfterEssentials }) => `Depois das despesas e metas, o mês está ${fmt(Math.abs(availableAfterEssentials))} acima do espaço planejado.`,
    ({ availableAfterEssentials }) => `Hoje o compromisso do mês já supera o espaço disponível em ${fmt(Math.abs(availableAfterEssentials))}.`,
    ({ availableAfterEssentials }) => `O planejamento atual já está pressionado em ${fmt(Math.abs(availableAfterEssentials))}.`,
    ({ availableAfterEssentials }) => `Despesas e metas já passaram do espaço do mês em ${fmt(Math.abs(availableAfterEssentials))}.`,
    ({ availableAfterEssentials }) => `As saídas já superam o que entrou no mês em ${fmt(Math.abs(availableAfterEssentials))}.`,
    ({ availableAfterEssentials }) => `A soma de despesas e metas já passou do limite do mês.`,
    ({ availableAfterEssentials }) => `O espaço financeiro deste mês já foi ultrapassado.`,
    ({ availableAfterEssentials }) => `Hoje o mês pede mais ajuste do que expansão.`,
    ({ availableAfterEssentials }) => `O sinal de atenção está no valor que já passou do planejado.`,
    ({ availableAfterEssentials }) => `Esse desvio de ${fmt(Math.abs(availableAfterEssentials))} merece ser visto cedo.`
  ], { availableAfterEssentials });

  addTemplatedMessages(candidates, previousMonth && resultDiff > 0.009, [
    ({ resultDiff }) => `O resultado deste mês está ${fmt(resultDiff)} melhor do que o do mês anterior.`,
    ({ resultDiff }) => `Na comparação com o último mês, o resultado melhorou ${fmt(resultDiff)}.`,
    ({ resultDiff }) => `Seu fechamento atual está ${fmt(resultDiff)} acima do mês passado.`,
    ({ resultDiff }) => `Há uma melhora de ${fmt(resultDiff)} no resultado em relação ao ciclo anterior.`,
    ({ resultDiff }) => `Este mês está andando melhor do que o anterior em ${fmt(resultDiff)}.`,
    ({ resultDiff }) => `O número final do mês já supera o anterior em ${fmt(resultDiff)}.`,
    ({ resultDiff }) => `O resultado ganhou fôlego em relação ao último fechamento.`,
    ({ resultDiff }) => `Faltam ${fmt(resultDiff)} para este mês repetir o resultado do anterior.`,
    ({ resultDiff }) => `Seu mês atual já está à frente do último em ${fmt(resultDiff)}.`,
    ({ resultDiff }) => `A comparação com o mês passado mostra um avanço concreto no resultado.`
  ], { resultDiff });

  addTemplatedMessages(candidates, previousMonth && resultDiff < -0.009, [
    ({ resultDiff }) => `O resultado deste mês está ${fmt(Math.abs(resultDiff))} abaixo do mês anterior.`,
    ({ resultDiff }) => `Na comparação com o último mês, o resultado caiu ${fmt(Math.abs(resultDiff))}.`,
    ({ resultDiff }) => `Seu fechamento atual está ${fmt(Math.abs(resultDiff))} abaixo do mês passado.`,
    ({ resultDiff }) => `Há uma diferença de ${fmt(Math.abs(resultDiff))} para baixo no resultado deste mês.`,
    ({ resultDiff }) => `Este mês começou mais pressionado do que o anterior.`,
    ({ resultDiff }) => `O resultado ainda não alcançou o do último ciclo.`,
    ({ resultDiff }) => `A comparação com o mês passado sugere mais atenção neste fechamento.`,
    ({ resultDiff }) => `${fmt(Math.abs(resultDiff))} separam o resultado atual do mês anterior.`,
    ({ resultDiff }) => `O mês ainda está atrás do último resultado registrado.`,
    ({ resultDiff }) => `O sinal de atenção está no resultado mais baixo que o do mês passado.`
  ], { resultDiff });

  addTemplatedMessages(candidates, topCategory && topCategory.value > 0, [
    ({ topCategory }) => `${topCategory.category} é a categoria que mais pesa até agora, com ${fmt(topCategory.value)}.`,
    ({ topCategory }) => `O maior peso do mês está em ${topCategory.category}, com ${fmt(topCategory.value)}.`,
    ({ topCategory }) => `${topCategory.category} lidera as saídas do mês neste momento.`,
    ({ topCategory }) => `Até aqui, ${topCategory.category.toLowerCase()} é o principal centro de gasto do mês.`,
    ({ topCategory }) => `${topCategory.category} aparece como a categoria mais pesada do ciclo atual.`,
    ({ topCategory }) => `O mês está sendo puxado principalmente por ${topCategory.category.toLowerCase()}.`,
    ({ topCategory }) => `${fmt(topCategory.value)} já saíram só em ${topCategory.category.toLowerCase()}.`,
    ({ topCategory }) => `Se houver uma categoria para observar primeiro agora, é ${topCategory.category.toLowerCase()}.`,
    ({ topCategory, topCategoryShare }) => `${topCategory.category} representa ${topCategoryShare}% do que já saiu no mês.`,
    ({ topCategory, topCategoryShare }) => `Quase ${topCategoryShare}% das saídas do mês estão concentradas em ${topCategory.category.toLowerCase()}.`
  ], { topCategory, topCategoryShare });

  addTemplatedMessages(candidates, totalExpenses > 0 && totalIncome > 0, [
    ({ expenseRatio }) => `Hoje ${expenseRatio}% da sua renda já está comprometida com saídas do mês.`,
    ({ expenseRatio, totalExpenses }) => `${expenseRatio}% da renda já virou saída neste mês.`,
    ({ totalExpenses, totalIncome }) => `De ${fmt(totalIncome)} que entraram, ${fmt(totalExpenses)} já saíram.`,
    ({ totalExpenses }) => `As saídas do mês já somam ${fmt(totalExpenses)}.`,
    ({ expenseRatio }) => `O mês já comprometeu uma parte importante da renda: ${expenseRatio}%.`,
    ({ totalExpenses, totalIncome }) => `O ritmo atual mostra ${fmt(totalExpenses)} saindo de um total de ${fmt(totalIncome)}.`,
    ({ expenseRatio }) => `Boa parte da renda do mês já encontrou saída.`,
    ({ totalExpenses }) => `${fmt(totalExpenses)} já deixaram o mês até aqui.`,
    ({ totalExpenses, totalIncome }) => `Comparar o que entrou com o que já saiu ajuda a dar clareza ao seu momento atual.`,
    ({ expenseRatio }) => `O nível de comprometimento da renda já é visível neste momento do mês.`
  ], { expenseRatio, totalExpenses, totalIncome });

  addTemplatedMessages(candidates, totalIncome > 0 && totalGoals === 0 && totalExpenses === 0, [
    ({ totalIncome }) => `Entraram ${fmt(totalIncome)} neste mês e ainda não há despesas nem metas registradas. Pode ser um bom momento para organizar o começo do mês.`,
    ({ totalIncome }) => `O mês começou com ${fmt(totalIncome)} de entrada e ainda está em branco nas saídas.`,
    ({ totalIncome }) => `${fmt(totalIncome)} já entraram neste mês. Este é um bom ponto para definir prioridades.`,
    ({ totalIncome }) => `Ainda não há movimentações registradas além da entrada do mês.`,
    ({ totalIncome }) => `Com ${fmt(totalIncome)} já registrados de entrada, este é um bom momento para estruturar o mês.`,
    ({ totalIncome }) => `O mês ainda está limpo nas saídas. Organizar agora tende a ser mais simples.`,
    ({ totalIncome }) => `Você ainda pode definir o tom do mês antes que ele ganhe ritmo.`,
    ({ totalIncome }) => `${fmt(totalIncome)} já estão no mês, e o restante ainda pode ser decidido com calma.`,
    ({ totalIncome }) => `Ainda não há pressão registrada no mês. Boa hora para planejar.`,
    ({ totalIncome }) => `O começo do mês ainda está aberto para decisões mais conscientes.`
  ], { totalIncome });

  addTemplatedMessages(candidates, totalIncome > 0 && totalGoals === 0, [
    ({ totalIncome }) => `Entraram ${fmt(totalIncome)} neste mês e ainda não há metas financeiras registradas.`,
    ({ totalIncome }) => `${fmt(totalIncome)} já entraram, mas nenhuma parte disso ainda foi separada em metas.`,
    ({ totalIncome }) => `O mês já recebeu renda, mas ainda não há valor reservado para metas.`,
    ({ totalIncome }) => `Ainda dá tempo de definir uma parte da renda para metas antes que o mês avance.`,
    ({ totalIncome }) => `Sem metas registradas, toda a renda do mês ainda está sem direção clara.`,
    ({ totalIncome }) => `Se quiser dar mais estrutura ao mês, começar pelas metas pode ajudar.`,
    ({ totalIncome }) => `A renda do mês já entrou. Falta decidir quanto dela deve ser protegido.`,
    ({ totalIncome }) => `Ainda não há metas financeiras neste ciclo.`,
    ({ totalIncome }) => `O mês pode ficar mais claro se parte da renda ganhar destino agora.`,
    ({ totalIncome }) => `Este é um bom ponto para decidir o que será gasto e o que será guardado.`
  ], { totalIncome });

  addTemplatedMessages(candidates, totalExpenses > 0 && totalGoals === 0 && availableAfterEssentials > 0, [
    ({ availableAfterEssentials }) => `Depois das despesas, ainda restam ${fmt(availableAfterEssentials)} que podem ganhar destino antes de virar gasto solto.`,
    ({ availableAfterEssentials }) => `${fmt(availableAfterEssentials)} ainda estão livres depois das despesas do mês.`,
    ({ availableAfterEssentials }) => `Ainda há ${fmt(availableAfterEssentials)} que podem ser organizados com mais intenção.`,
    ({ availableAfterEssentials }) => `O mês ainda guarda ${fmt(availableAfterEssentials)} depois das saídas já registradas.`,
    ({ availableAfterEssentials }) => `Sem metas definidas, ${fmt(availableAfterEssentials)} ainda estão totalmente livres.`,
    ({ availableAfterEssentials }) => `${fmt(availableAfterEssentials)} ainda podem virar folga ou objetivo, dependendo do próximo passo.`,
    ({ availableAfterEssentials }) => `Depois das despesas já lançadas, ainda existe margem neste mês.`,
    ({ availableAfterEssentials }) => `Há um valor ainda solto no mês que pode ser melhor direcionado.`,
    ({ availableAfterEssentials }) => `Essa sobra atual ainda pode ser organizada antes de se espalhar.`,
    ({ availableAfterEssentials }) => `${fmt(availableAfterEssentials)} ainda cabem em uma decisão melhor do que o improviso.`
  ], { availableAfterEssentials });

  addTemplatedMessages(candidates, !previousMonth && totalIncome > 0, [
    ({ totalIncome, totalExpenses }) => `Este é um bom mês para começar uma referência clara: até agora entraram ${fmt(totalIncome)} e saíram ${fmt(totalExpenses)}.`,
    ({ totalIncome, totalExpenses }) => `Como ainda não há mês anterior para comparar, este fechamento vai servir como base.`,
    ({ totalIncome, totalExpenses }) => `Este ciclo pode virar sua primeira referência real de comparação.`,
    ({ totalIncome, totalExpenses }) => `A leitura deste mês já começa a formar um histórico útil.`,
    ({ totalIncome, totalExpenses }) => `Sem mês anterior, o mais útil agora é criar uma base clara do que entra e do que sai.`,
    ({ totalIncome, totalExpenses }) => `O sistema já tem dados suficientes para começar a contar a história deste mês.`,
    ({ totalIncome, totalExpenses }) => `Este primeiro mês registrado pode ajudar bastante nas próximas comparações.`,
    ({ totalIncome, totalExpenses }) => `Quanto mais claro este fechamento ficar, melhor será a leitura dos próximos.`,
    ({ totalIncome, totalExpenses }) => `Você está começando uma referência que vai ajudar a enxergar evolução depois.`,
    ({ totalIncome, totalExpenses }) => `Este mês já serve como ponto de partida para os próximos ajustes.`
  ], { totalIncome, totalExpenses });

  const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)));
  const nextMessage = uniqueCandidates.length
    ? uniqueCandidates[Math.floor(Math.random() * uniqueCandidates.length)]
    : 'Entraram valores neste mês, e o próximo passo mais útil agora é deixar claro o que já saiu e o que ainda precisa de destino.';

  currentMonthMessageCache = { monthId: month.id, text: nextMessage };
  return nextMessage;
}

function normalizeProjectCopyName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function getMonthCopyOptions(prev) {
  const despesasMap = new Map();
  (prev?.despesas || []).forEach(item => {
    const key = normalizeExpenseName(item.nome);
    if (!key || despesasMap.has(key)) return;
    despesasMap.set(key, {
      key,
      label: item.nome || 'Despesa',
      meta: fmt(Number(item.valor || 0))
    });
  });

  const rendaMap = new Map();
  (prev?.renda || []).forEach(item => {
    const key = normalizeIncomeName(item.fonte);
    if (!key || rendaMap.has(key)) return;
    rendaMap.set(key, {
      key,
      label: item.fonte || 'Renda',
      meta: fmt(Number(item.valor || 0))
    });
  });

  const projetosMap = new Map();
  (prev?.projetos || []).forEach(item => {
    const key = normalizeProjectCopyName(item.nome);
    if (!key || projetosMap.has(key)) return;
    projetosMap.set(key, {
      key,
      label: item.nome || 'Renda extra',
      meta: fmt(Number(item.valor || 0))
    });
  });

  const gastosMap = new Map();
  const pushCategory = category => {
    const resolved = resolveCategoryName(category || 'OUTROS');
    if (!resolved || gastosMap.has(resolved)) return;
    const amount = Number(getVariableCategoryTotals(prev || {})[resolved] || 0);
    gastosMap.set(resolved, {
      key: resolved,
      label: resolved,
      meta: amount > 0 ? fmt(amount) : 'Sem lançamentos no mês anterior'
    });
  };
  (prev?.gastosVar || []).forEach(item => pushCategory(item.categoria));
  (prev?.dailyCategorySeeds || []).forEach(pushCategory);
  Object.keys(prev?.dailyGoals || {}).forEach(pushCategory);

  return {
    despesas: Array.from(despesasMap.values()),
    gastosCategorias: Array.from(gastosMap.values()),
    renda: Array.from(rendaMap.values()),
    projetos: Array.from(projetosMap.values())
  };
}

function ensureMonthCopyPreferencesForOptions(prefs, options) {
  ['despesas', 'gastosCategorias', 'renda', 'projetos'].forEach(group => {
    prefs[group] = prefs[group] || {};
    (options[group] || []).forEach(option => {
      if (prefs[group][option.key] === undefined) prefs[group][option.key] = true;
    });
  });
  return prefs;
}

function getMonthCopyGroupTitle(group) {
  if (group === 'despesas') return 'Despesas';
  if (group === 'gastosCategorias') return 'Gastos diários';
  if (group === 'renda') return 'Renda';
  return 'Renda extra';
}

function renderMonthCopyPicker() {
  const picker = document.getElementById('monthCopyPicker');
  const toggle = document.getElementById('copyPrevMonthToggle');
  const chooseBtn = document.getElementById('monthCopyChooseBtn');
  const summary = document.getElementById('monthCopySummary');
  if (!picker || !toggle || !chooseBtn || !summary) return;

  const prev = getMonthCopySourceMonth();
  if (!prev) {
    chooseBtn.disabled = true;
    picker.hidden = true;
    summary.textContent = 'Ainda não existe um mês anterior para copiar.';
    picker.innerHTML = '';
    return;
  }

  const prefs = ensureMonthCopyPreferencesForOptions(getMonthCopyPreferences(), getMonthCopyOptions(prev));
  saveMonthCopyPreferences(prefs);

  chooseBtn.disabled = !toggle.checked;
  summary.textContent = toggle.checked
    ? 'Selecione exatamente quais dados do mês anterior devem ser copiados para este e para os próximos meses.'
    : 'Desmarque para começar o novo mês vazio. Suas escolhas continuam salvas para os próximos meses.';

  const options = getMonthCopyOptions(prev);
  picker.innerHTML = ['despesas', 'gastosCategorias', 'renda', 'projetos'].map(group => {
    const items = options[group] || [];
    if (!items.length) {
      return `
      <div class="month-copy-group">
        <h4>${getMonthCopyGroupTitle(group)}</h4>
        <div class="month-copy-empty">Nada disponível para copiar no mês anterior.</div>
      </div>`;
    }
    const rows = items.map(item => `
      <label class="month-copy-item">
        <input type="checkbox" ${prefs[group]?.[item.key] !== false ? 'checked' : ''} onchange="toggleMonthCopyItem('${group}', '${encodeURIComponent(item.key)}', this.checked)">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.meta)}</span>
        </div>
      </label>`).join('');
    return `
      <div class="month-copy-group">
        <h4>${getMonthCopyGroupTitle(group)}</h4>
        <div class="month-copy-list">${rows}</div>
      </div>`;
  }).join('');
}

function updateMonthCopyVisibility(showPicker) {
  const controls = document.getElementById('monthCopyControls');
  const picker = document.getElementById('monthCopyPicker');
  const toggle = document.getElementById('copyPrevMonthToggle');
  const chooseBtn = document.getElementById('monthCopyChooseBtn');
  if (!controls || !picker || !toggle || !chooseBtn) return;
  if (controls.hidden) {
    picker.hidden = true;
    return;
  }
  const hasPrev = !!getMonthCopySourceMonth();
  chooseBtn.disabled = !hasPrev || !toggle.checked;
  if (!toggle.checked || !hasPrev) {
    picker.hidden = true;
    chooseBtn.textContent = 'Escolher dados';
    return;
  }
  picker.hidden = !showPicker;
  chooseBtn.textContent = picker.hidden ? 'Escolher dados' : 'Ocultar dados';
}

function setupMonthCopyControls() {
  const controls = document.getElementById('monthCopyControls');
  const toggle = document.getElementById('copyPrevMonthToggle');
  if (!controls || !toggle) return;
  if (isPrimaryUserEnvironment()) {
    controls.hidden = true;
    return;
  }
  controls.hidden = false;
  const prev = getMonthCopySourceMonth();
  const prefs = prev
    ? ensureMonthCopyPreferencesForOptions(getMonthCopyPreferences(), getMonthCopyOptions(prev))
    : getMonthCopyPreferences();
  saveMonthCopyPreferences(prefs);
  toggle.checked = prefs.enabled !== false;
  renderMonthCopyPicker();
  updateMonthCopyVisibility(false);
}

function refreshMonthCopyControls() {
  if (isPrimaryUserEnvironment()) return;
  const modal = document.getElementById('modalNewMonth');
  if (!modal || modal.dataset.mode !== 'create') return;
  setupMonthCopyControls();
}

function getMonthCopySourceMonth() {
  const targetName = `${document.getElementById('newMonthMes').value} ${document.getElementById('newMonthAno').value}`;
  const targetSortValue = getMonthSortValue({ nome: targetName });
  const previousMonths = data.filter(m => getMonthSortValue(m) < targetSortValue);
  return previousMonths[previousMonths.length - 1] || null;
}

function handleMonthCopyEnabledChange(checked) {
  if (isPrimaryUserEnvironment()) return;
  const prefs = getMonthCopyPreferences();
  prefs.enabled = !!checked;
  saveMonthCopyPreferences(prefs);
  renderMonthCopyPicker();
  updateMonthCopyVisibility(false);
}

function toggleMonthCopyPicker() {
  if (isPrimaryUserEnvironment()) return;
  const picker = document.getElementById('monthCopyPicker');
  if (!picker) return;
  renderMonthCopyPicker();
  updateMonthCopyVisibility(picker.hidden);
}

function toggleMonthCopyItem(group, encodedKey, checked) {
  const prefs = getMonthCopyPreferences();
  const key = decodeURIComponent(encodedKey || '');
  prefs[group] = prefs[group] || {};
  prefs[group][key] = !!checked;
  saveMonthCopyPreferences(prefs);
  renderMonthCopyPicker();
  updateMonthCopyVisibility(true);
}

function openNewMonth() {
  const baseMonth = getCurrentMonth() || data[data.length - 1];
  const next = getNextMonthInfo(baseMonth);
  document.getElementById('modalNewMonth').dataset.mode = 'create';
  document.getElementById('modalNewMonth').dataset.editingMonthId = '';
  document.getElementById('modalNewMonthTitle').textContent = 'Novo mês';
  document.getElementById('modalNewMonthSubmit').textContent = 'Criar mês';
  document.getElementById('modalNewMonthHelp').innerHTML = isPrimaryUserEnvironment()
    ? 'O novo mês copia automaticamente do mês anterior: gastos recorrentes selecionados, a categoria <b>ASSINATURAS</b> em gastos diários e as rendas fixas recorrentes.'
    : 'Você pode começar do zero ou copiar apenas os dados que quiser do mês anterior. As escolhas ficam salvas para os próximos meses.';
  document.getElementById('newMonthMes').value = next.monthName;
  document.getElementById('newMonthAno').value = next.year;
  setupMonthCopyControls();
  openModal('modalNewMonth');
}

function openEditCurrentMonth() {
  const current = getCurrentMonth();
  if (!current) return;
  const monthName = getMonthName(current);
  const year = getYear(current);
  document.getElementById('modalNewMonth').dataset.mode = 'edit';
  document.getElementById('modalNewMonth').dataset.editingMonthId = current.id;
  document.getElementById('modalNewMonthTitle').textContent = 'Editar mês';
  document.getElementById('modalNewMonthSubmit').textContent = 'Salvar mês';
  document.getElementById('modalNewMonthHelp').textContent = 'Altere o mês e o ano para corrigir este registro sem perder os dados já lançados.';
  document.getElementById('newMonthMes').value = monthName;
  document.getElementById('newMonthAno').value = year;
  const controls = document.getElementById('monthCopyControls');
  if (controls) controls.hidden = true;
  openModal('modalNewMonth');
}

function replaceMonthIdReferences(oldId, newId, oldYear, newYear) {
  if (currentMonthId === oldId) currentMonthId = newId;
  if (periodFilter.month === oldId) periodFilter.month = newId;
  if (periodFilter.start === oldId) periodFilter.start = newId;
  if (periodFilter.end === oldId) periodFilter.end = newId;
  if (periodFilter.type === 'year' && String(periodFilter.year || '') === String(oldYear || '') && String(oldYear || '') !== String(newYear || '')) {
    periodFilter.year = String(newYear || oldYear || '');
  }
  if (despSelectionState[oldId]) {
    despSelectionState[newId] = despSelectionState[oldId];
    delete despSelectionState[oldId];
  }
}

function updateCurrentMonthIdentity() {
  const current = getCurrentMonth();
  if (!current) return;
  const mes = document.getElementById('newMonthMes').value;
  const ano = document.getElementById('newMonthAno').value;
  const nome = `${mes} ${ano}`;
  const id = nome.toLowerCase().replace(/ /g,'_');
  if (data.find(m => m.id === id && m.id !== current.id)) { alert('Este mês já existe!'); return; }

  recordHistoryState();
  const oldId = current.id;
  const oldYear = getYear(current);
  current.id = id;
  current.nome = nome;
  normalizeMonth(current);
  sortDataChronologically();
  replaceMonthIdReferences(oldId, id, oldYear, ano);
  save();
  buildMonthSelect();
  document.getElementById('monthSelect').value = id;
  closeModal('modalNewMonth');
  nav('mes');
}

function getRecurringPrevMonth(prev, newMonthName) {
  if (isUnifiedMonthPilotEnabled()) {
    return buildUnifiedPilotMonthFromPrevious(prev, newMonthName);
  }
  if (!isPrimaryUserEnvironment()) {
    const prefs = getMonthCopyPreferences();
    const expenseKeys = new Set(Object.entries(prefs.despesas || {}).filter(([, enabled]) => enabled !== false).map(([key]) => key));
    const incomeKeys = new Set(Object.entries(prefs.renda || {}).filter(([, enabled]) => enabled !== false).map(([key]) => key));
    const projectKeys = new Set(Object.entries(prefs.projetos || {}).filter(([, enabled]) => enabled !== false).map(([key]) => key));
    const categoryKeys = new Set(Object.entries(prefs.gastosCategorias || {}).filter(([, enabled]) => enabled !== false).map(([key]) => key));

    const despesas = (prev?.despesas || [])
      .filter(item => expenseKeys.has(normalizeExpenseName(item.nome)))
      .map(item => ({ ...item }));

    const renda = (prev?.renda || [])
      .filter(item => incomeKeys.has(normalizeIncomeName(item.fonte)) && item?.recurringFixed !== false)
      .map(item => ({
        ...item,
        paid: false,
        patrimonioMovementId: '',
        recurringFixed: true,
        recurringGroupId: getIncomeRecurringGroupId(item)
      }));

    const projetos = (prev?.projetos || [])
      .filter(item => projectKeys.has(normalizeProjectCopyName(item.nome)))
      .map(item => ({ ...item, paid: false, patrimonioMovementId: '' }));

    const gastosVar = (prev?.gastosVar || [])
      .filter(item => categoryKeys.has(resolveCategoryName(item.categoria || 'OUTROS')))
      .map(item => ({ ...item }));

    const dailyCategorySeeds = Array.from(new Set((prev?.dailyCategorySeeds || [])
      .filter(category => categoryKeys.has(resolveCategoryName(category)))
      .map(category => resolveCategoryName(category))));

    const dailyGoals = {};
    Object.entries(prev?.dailyGoals || {}).forEach(([category, value]) => {
      const resolved = resolveCategoryName(category);
      if (!categoryKeys.has(resolved)) return;
      dailyGoals[resolved] = value;
    });

    const month = {
      id: newMonthName.toLowerCase().replace(/ /g, '_'),
      nome: newMonthName,
      despesas,
      renda,
      financialGoals: [],
      projetos,
      gastosVar,
      dailyCategorySeeds,
      dailyGoals,
      total_gastos: 0,
      total_renda: 0,
      resultado: 0,
      categorias: {}
    };
    recalcTotals(month);
    return month;
  }

  const recurringExpenseNamesZeroed = new Set(AUTO_COPY_EXPENSES_ZEROED.map(name => normalizeExpenseName(resolveExpenseName(name))));
  const recurringExpenseNamesWithLastValue = new Set(AUTO_COPY_EXPENSES_WITH_LAST_VALUE.map(name => normalizeExpenseName(resolveExpenseName(name))));
  const recurringIncomeNames = new Set(AUTO_COPY_RENDA.map(name => normalizeIncomeName(resolveIncomeName(name))));
  const recurringDailyCategories = new Set(AUTO_COPY_DAILY_CATEGORIES.map(name => resolveCategoryName(name)));
  const prevVariableCategories = Object.keys(getVariableCategoryTotals(prev || {})).map(cat => resolveCategoryName(cat));

  const despesas = (prev?.despesas || [])
    .filter(d => {
      const normalized = normalizeExpenseName(d.nome);
      return recurringExpenseNamesZeroed.has(normalized) || recurringExpenseNamesWithLastValue.has(normalized);
    })
    .map(d => {
      const normalized = normalizeExpenseName(d.nome);
      return {
        ...d,
        valor: recurringExpenseNamesZeroed.has(normalized) ? 0 : d.valor
      };
    });

  const renda = (prev?.renda || [])
    .filter(r => r?.recurringFixed !== false || recurringIncomeNames.has(normalizeIncomeName(r.fonte)))
    .map(r => ({
      ...r,
      paid: false,
      patrimonioMovementId: '',
      recurringFixed: true,
      recurringGroupId: getIncomeRecurringGroupId(r)
    }));

  const gastosVar = (prev?.gastosVar || [])
    .filter(g => recurringDailyCategories.has(resolveCategoryName(g.categoria || 'OUTROS')))
    .map(g => ({ ...g }));

  const dailyGoals = {};
  const dailyCategorySeeds = Array.from(new Set(prevVariableCategories));
  recurringDailyCategories.forEach(cat => {
    if (prev?.dailyGoals && prev.dailyGoals[cat] !== undefined) {
      dailyGoals[cat] = prev.dailyGoals[cat];
    }
  });

  const month = {
    id: newMonthName.toLowerCase().replace(/ /g, '_'),
    nome: newMonthName,
    despesas,
    renda,
    financialGoals: [],
    projetos: [],
    gastosVar,
    dailyCategorySeeds,
    dailyGoals,
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  };
  recalcTotals(month);
  return month;
}

function createNewMonth() {
  const mes = document.getElementById('newMonthMes').value;
  const ano = document.getElementById('newMonthAno').value;
  const nome = `${mes} ${ano}`;
  const id = nome.toLowerCase().replace(/ /g,'_');
  if (data.find(m => m.id === id)) { alert('Este mês já existe!'); return; }

  recordHistoryState();
  let newMonth = { id, nome, despesas:[], renda:[], financialGoals:[], projetos:[], gastosVar:[], dailyGoals:{}, total_gastos:0, total_renda:0, resultado:0, categorias:{} };
  const newSortValue = getMonthSortValue({ nome });
  const previousMonths = data.filter(m => getMonthSortValue(m) < newSortValue);
  const prev = previousMonths[previousMonths.length - 1] || null;
  const shouldCopyPrevious = isUnifiedMonthPilotEnabled()
    ? !!prev
    : isPrimaryUserEnvironment()
    ? !!prev
    : !!prev && getMonthCopyPreferences().enabled !== false;
  if (shouldCopyPrevious) {
    newMonth = getRecurringPrevMonth(prev, nome);
  }
  normalizeMonth(newMonth);

  data.push(newMonth);
  sortDataChronologically();
  currentMonthId = id;
  save();
  buildMonthSelect();
  document.getElementById('monthSelect').value = id;
  closeModal('modalNewMonth');
  nav('mes');
}

function submitMonthModal() {
  const mode = document.getElementById('modalNewMonth').dataset.mode || 'create';
  if (mode === 'edit') {
    updateCurrentMonthIdentity();
    return;
  }
  createNewMonth();
}
