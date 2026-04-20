const STORAGE_KEYS = {
  uiState: 'finUIState',
  categoryRenameMap: 'finCategoryRenameMap',
  dashSeriesSelection: 'finDashSeriesSelection',
  dashSeriesSelectionSimple: 'finDashSeriesSelection_simples',
  dashSeriesSelectionFixed: 'finDashSeriesSelection_fixo',
  dashSeriesSelectionVersion: 'finDashSeriesSelectionVersion',
  dashSeriesColors: 'finDashSeriesColors',
  categoryColors: 'finCategoryColors',
  categoryEmojis: 'finCategoryEmojis',
  monthSectionColors: 'finMonthSectionColors',
  monthSectionCollapsed: 'finMonthSectionCollapsed',
  dashMetricOrder: 'finDashMetricOrder',
  dashboardWidgetOrder: 'finDashboardWidgetOrder',
  dashboardWidgetLayout: 'finDashboardWidgetLayout',
  monthMetricOrder: 'finMesMetricOrder',
  monthSectionOrder: 'finMesSectionOrder',
  monthCopyPreferences: 'finMonthCopyPreferences',
  expenseCategoryRules: 'finExpenseCategoryRules',
  expenseNameRenameMap: 'finExpenseNameRenameMap',
  expensePaymentDateRules: 'finExpensePaymentDateRules',
  incomeNameRenameMap: 'finIncomeNameRenameMap',
  esoData: 'finEsoData',
  data: 'finData',
  patrimonioAccounts: 'finPatrimonioAccounts',
  patrimonioMovements: 'finPatrimonioMovements',
  metas: 'finMetas',
  schemaVersion: 'finStateSchemaVersion',
  migrationVersion: 'finDataMigrationVersion',
  titles: 'finTitles',
  resultMode: 'finResultMode'
};

const ENCRYPTED_STORAGE_KEYS = new Set([
  STORAGE_KEYS.data,
  STORAGE_KEYS.patrimonioAccounts,
  STORAGE_KEYS.patrimonioMovements,
  STORAGE_KEYS.metas,
  STORAGE_KEYS.esoData
]);

const LEGACY_STORAGE_KEYS = Object.values(STORAGE_KEYS);
const STATE_SCHEMA_VERSION = '2';
const DASHBOARD_LAYOUT_VERSION = 2;
let serverStorageCache = {};
let storageFlushTimer = null;
let storageFlushPromise = Promise.resolve();
let storageInitialized = false;
let scopedStorageNamespace = 'anonymous';
let serverStateRevision = '';
let storageWriteConflictDetected = false;

function getCsrfHeaders(extraHeaders = {}) {
  const token = window.__CSRF_TOKEN__ || '';
  return token
    ? { ...extraHeaders, 'X-CSRF-Token': token }
    : { ...extraHeaders };
}

const LegacyStorage = {
  getText(key, fallback = '') {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  },
  setText(key, value) {
    try { localStorage.setItem(key, String(value)); } catch {}
  },
  getJSON(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  setJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
  }
};

function getScopedStorageKey(key) {
  return `finScoped::${scopedStorageNamespace}::${key}`;
}

const ScopedLocalStorage = {
  getText(key, fallback = '') {
    try {
      const value = localStorage.getItem(getScopedStorageKey(key));
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  },
  setText(key, value) {
    try { localStorage.setItem(getScopedStorageKey(key), String(value)); } catch {}
  },
  getJSON(key, fallback = null) {
    try {
      const raw = localStorage.getItem(getScopedStorageKey(key));
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  setJSON(key, value) {
    try { localStorage.setItem(getScopedStorageKey(key), JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(getScopedStorageKey(key)); } catch {}
  }
};

function cloneStateValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function hasLegacyAppData() {
  return LEGACY_STORAGE_KEYS.some(key => localStorage.getItem(key) !== null);
}

function captureLegacyAppState() {
  const snapshot = {};
  LEGACY_STORAGE_KEYS.forEach(key => {
    const raw = localStorage.getItem(key);
    if (raw !== null) snapshot[key] = raw;
  });
  return snapshot;
}

function materializeLegacyStateSnapshot(snapshot) {
  const state = {};
  Object.entries(snapshot || {}).forEach(([key, raw]) => {
    if (raw === null || raw === undefined) return;
    if (key === STORAGE_KEYS.resultMode || key === STORAGE_KEYS.migrationVersion || key === STORAGE_KEYS.dashSeriesSelectionVersion) {
      state[key] = String(raw);
      return;
    }
    try {
      state[key] = JSON.parse(raw);
    } catch {
      state[key] = raw;
    }
  });
  return state;
}

async function flushServerStorage(force = false) {
  if (!storageInitialized) return;
  if (storageWriteConflictDetected) return;
  if (!force && storageFlushTimer) return;
  const payload = {
    state: cloneStateValue(serverStorageCache),
    baseRevision: serverStateRevision || ''
  };
  storageFlushPromise = fetch('/api/app-state', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: getCsrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify(payload)
  })
    .then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        serverStateRevision = String(body?.updatedAt || serverStateRevision || '');
        return;
      }
      if (response.status === 409 || body?.conflict) {
        storageWriteConflictDetected = true;
        if (typeof window.showAppStatus === 'function') {
          window.showAppStatus(
            'Detectamos alterações em outra aba/dispositivo. Recarregue para evitar sobrescrita de dados.',
            'Conflito de sincronização',
            'warn'
          );
        }
        console.warn('[storage] conflito de revisão detectado', {
          expectedRevision: payload.baseRevision || '(vazio)',
          currentRevision: String(body?.currentRevision || '').trim() || '(desconhecida)'
        });
      }
    })
    .catch(() => {});
  await storageFlushPromise;
}

function scheduleServerStorageFlush() {
  if (!storageInitialized) return;
  if (storageFlushTimer) window.clearTimeout(storageFlushTimer);
  storageFlushTimer = window.setTimeout(async () => {
    storageFlushTimer = null;
    await flushServerStorage(true);
  }, 250);
}

async function initializeServerStorage() {
  if (storageInitialized && window.__APP_BOOTSTRAP__) return window.__APP_BOOTSTRAP__;
  let payload = null;
  let bootstrapErrorMessage = '';
  try {
    const response = await fetch('/api/app/bootstrap', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    if (response.ok) {
      payload = await response.json();
    } else if (response.status === 401) {
      window.location.replace('/login');
      throw new Error('Sessao expirada ou inexistente.');
    } else {
      const failPayload = await response.json().catch(() => ({}));
      bootstrapErrorMessage = failPayload?.message || 'Falha ao carregar bootstrap.';
    }
  } catch (error) {
    bootstrapErrorMessage = error?.message || bootstrapErrorMessage || 'Falha ao carregar bootstrap.';
  }

  if (!payload) {
    const sessionResponse = await fetch('/api/auth/session', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    if (!sessionResponse.ok) {
      window.location.replace('/login');
      throw new Error('Nao foi possivel validar a sessao.');
    }
    const session = await sessionResponse.json();
    payload = {
      session,
      profile: null,
      permissions: session?.permissions || {},
      isPrimaryUser: false,
      appState: {},
      hasServerState: false,
      shouldStartEmpty: true,
      bootstrapFallback: true,
      bootstrapFallbackReason: bootstrapErrorMessage || 'Bootstrap indisponivel.'
    };
  }
  window.__APP_BOOTSTRAP__ = payload;
  window.__CSRF_TOKEN__ = payload.session?.csrfToken || '';
  scopedStorageNamespace = payload.session?.id || payload.session?.email || payload.session?.username || 'anonymous';
  serverStorageCache = payload.appState && typeof payload.appState === 'object'
    ? cloneStateValue(payload.appState)
    : {};
  serverStateRevision = String(payload.stateRevision || '');
  storageWriteConflictDetected = false;

  if (!payload.hasServerState && payload.session?.username === 'guilherme' && hasLegacyAppData()) {
    const legacyState = materializeLegacyStateSnapshot(captureLegacyAppState());
    await fetch('/api/app-state/migrate-legacy', {
      method: 'POST',
      credentials: 'same-origin',
      headers: getCsrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify({ state: legacyState })
    }).catch(() => null);
    serverStorageCache = legacyState;
    payload.appState = cloneStateValue(legacyState);
    payload.hasServerState = true;
  }

  storageInitialized = true;
  ENCRYPTED_STORAGE_KEYS.forEach(key => {
    LegacyStorage.remove(key);
    ScopedLocalStorage.remove(key);
  });
  return payload;
}

const Storage = {
  getText(key, fallback = '') {
    try {
      if (Object.prototype.hasOwnProperty.call(serverStorageCache, key)) {
        const value = serverStorageCache[key];
        return value === null ? fallback : value;
      }
      if (ENCRYPTED_STORAGE_KEYS.has(key)) return fallback;
      return ScopedLocalStorage.getText(key, fallback);
    } catch {
      return fallback;
    }
  },
  setText(key, value) {
    try {
      serverStorageCache[key] = String(value);
      if (!ENCRYPTED_STORAGE_KEYS.has(key)) {
        ScopedLocalStorage.setText(key, value);
      } else {
        ScopedLocalStorage.remove(key);
      }
      scheduleServerStorageFlush();
    } catch {}
  },
  getJSON(key, fallback = null) {
    try {
      if (Object.prototype.hasOwnProperty.call(serverStorageCache, key)) {
        return cloneStateValue(serverStorageCache[key]);
      }
      if (ENCRYPTED_STORAGE_KEYS.has(key)) return fallback;
      return ScopedLocalStorage.getJSON(key, fallback);
    } catch {
      return fallback;
    }
  },
  setJSON(key, value) {
    try {
      serverStorageCache[key] = cloneStateValue(value);
      if (!ENCRYPTED_STORAGE_KEYS.has(key)) {
        ScopedLocalStorage.setJSON(key, value);
      } else {
        ScopedLocalStorage.remove(key);
      }
      if (key !== STORAGE_KEYS.uiState) {
        scheduleServerStorageFlush();
      }
    } catch {}
  },
  remove(key) {
    try {
      delete serverStorageCache[key];
      ScopedLocalStorage.remove(key);
      scheduleServerStorageFlush();
    } catch {}
  }
};

function getDefaultMonthId() {
  return data.length ? data[data.length - 1].id : '';
}

function sanitizePeriodFilter(filter) {
  const fallbackMonthId = currentMonthId || getDefaultMonthId();
  const fallbackYear = getYear(data.find(m => m.id === fallbackMonthId) || data[data.length - 1] || {});
  const validIds = new Set(data.map(m => m.id));
  const validYears = new Set(data.map(getYear));
  if (!filter || typeof filter !== 'object') {
    return { type: 'all', month: fallbackMonthId, year: fallbackYear, start: fallbackMonthId, end: fallbackMonthId };
  }
  return {
    type: ['all','month','year','range'].includes(filter.type) ? filter.type : 'all',
    month: validIds.has(filter.month) ? filter.month : fallbackMonthId,
    year: validYears.has(String(filter.year)) ? String(filter.year) : fallbackYear,
    start: validIds.has(filter.start) ? filter.start : fallbackMonthId,
    end: validIds.has(filter.end) ? filter.end : fallbackMonthId
  };
}

function saveUIState() {
  let prevScrollYByPage = {};
  const prev = Storage.getJSON(STORAGE_KEYS.uiState, {});
  if (prev && typeof prev === 'object' && prev.scrollYByPage && typeof prev.scrollYByPage === 'object') {
    prevScrollYByPage = prev.scrollYByPage;
  }
  Storage.setJSON(STORAGE_KEYS.uiState, {
    activePage,
    currentMonthId,
    periodFilter,
    esoFilter,
    patrimonioSelectedAccountId,
    patrimonioFilters,
    resultMode,
    dashMetricOrder,
    dashboardWidgetOrder,
    dashboardWidgetLayout,
    dashSeriesColorOverrides,
    categoryColorOverrides,
    monthMetricOrder,
    monthSectionOrder,
    dashSeriesSelectionsByMode,
    histActiveTab,
    notificationsSeenDayKey,
    scrollYByPage: {
      ...prevScrollYByPage,
      [activePage]: window.scrollY || 0
    }
  });
}

function restoreUIState() {
  try {
    const saved = Storage.getJSON(STORAGE_KEYS.uiState, null);
    if (!saved || typeof saved !== 'object') return;
    if (saved.currentMonthId && data.some(m => m.id === saved.currentMonthId)) {
      currentMonthId = saved.currentMonthId;
    }
    if (saved.resultMode) resultMode = saved.resultMode;
    if (saved.dashMetricOrder) {
      dashMetricOrder = sanitizeDashMetricOrder(saved.dashMetricOrder);
    }
    if (saved.dashboardWidgetOrder) {
      dashboardWidgetOrder = sanitizeDashboardWidgetOrder(saved.dashboardWidgetOrder);
    }
    const savedDashboardLayoutVersion = parseInt(saved.dashboardLayoutVersion || '0', 10);
    if (savedDashboardLayoutVersion >= DASHBOARD_LAYOUT_VERSION && saved.dashboardWidgetLayout) {
      dashboardWidgetLayout = sanitizeDashboardWidgetLayout(saved.dashboardWidgetLayout);
    } else {
      dashboardWidgetOrder = sanitizeDashboardWidgetOrder(Object.keys(dashboardWidgetBaseLayout()));
      dashboardWidgetLayout = sanitizeDashboardWidgetLayout(dashboardWidgetBaseLayout());
    }
    if (saved.dashSeriesColorOverrides && typeof saved.dashSeriesColorOverrides === 'object') {
      dashSeriesColorOverrides = { ...saved.dashSeriesColorOverrides };
    }
    if (saved.categoryColorOverrides && typeof saved.categoryColorOverrides === 'object') {
      categoryColorOverrides = { ...saved.categoryColorOverrides };
    }
    if (saved.monthMetricOrder) {
      monthMetricOrder = sanitizeMonthMetricOrder(saved.monthMetricOrder);
    }
    if (saved.monthSectionOrder) {
      monthSectionOrder = sanitizeMonthSectionOrder(saved.monthSectionOrder);
    }
    if (saved.dashSeriesSelectionsByMode && typeof saved.dashSeriesSelectionsByMode === 'object') {
      uiDashSeriesSelectionsFallback = {
        simples: sanitizeDashSeriesSelection(saved.dashSeriesSelectionsByMode.simples),
        fixo: sanitizeDashSeriesSelection(saved.dashSeriesSelectionsByMode.fixo)
      };
    }
    esoFilter = sanitizeEsoFilter(saved.esoFilter);
    if (saved.activePage && ['dashboard','mes','historico','patrimonio','eso','perfil'].includes(saved.activePage)) {
      activePage = saved.activePage;
    }
    if (typeof saved.patrimonioSelectedAccountId === 'string') {
      patrimonioSelectedAccountId = saved.patrimonioSelectedAccountId;
    }
    if (saved.patrimonioFilters && typeof saved.patrimonioFilters === 'object') {
      patrimonioFilters = { ...patrimonioFilters, ...saved.patrimonioFilters };
    }
    if (saved.histActiveTab && ['tabela','grafico'].includes(saved.histActiveTab)) {
      histActiveTab = saved.histActiveTab;
    }
    if (typeof saved.notificationsSeenDayKey === 'string') {
      notificationsSeenDayKey = saved.notificationsSeenDayKey;
    }
    periodFilter = sanitizePeriodFilter(saved.periodFilter);
    const savedScroll = saved.scrollYByPage && typeof saved.scrollYByPage === 'object'
      ? saved.scrollYByPage[activePage]
      : null;
    pendingScrollY = Number.isFinite(savedScroll) ? savedScroll : null;
  } catch {}
}

function restoreScrollPosition() {
  if (pendingScrollY === null) return;
  const y = pendingScrollY;
  pendingScrollY = null;
  requestAnimationFrame(() => window.scrollTo(0, y));
}

function preserveCurrentScroll(renderFn) {
  pendingScrollY = window.scrollY || window.pageYOffset || 0;
  renderFn();
  restoreScrollPosition();
}

function preserveElementViewportPosition(target, renderFn) {
  const getNode = () => {
    if (!target) return null;
    if (typeof target === 'string') return document.querySelector(target);
    return target instanceof Element ? target : null;
  };
  const beforeNode = getNode();
  const beforeTop = beforeNode ? beforeNode.getBoundingClientRect().top : null;
  renderFn();
  if (beforeTop === null) {
    restoreScrollPosition();
    return;
  }
  requestAnimationFrame(() => {
    const afterNode = getNode();
    if (!afterNode) return;
    const afterTop = afterNode.getBoundingClientRect().top;
    const delta = afterTop - beforeTop;
    if (delta) window.scrollBy(0, delta);
    requestAnimationFrame(() => {
      const lateNode = getNode();
      if (!lateNode) return;
      const lateTop = lateNode.getBoundingClientRect().top;
      const lateDelta = lateTop - beforeTop;
      if (lateDelta) window.scrollBy(0, lateDelta);
    });
  });
}

function saveCategoryRenameMap() {
  Storage.setJSON(STORAGE_KEYS.categoryRenameMap, categoryRenameMap);
}

function sanitizeDashSeriesSelection(list) {
  const validKeys = Object.keys(DASH_SERIES_OPTIONS);
  const next = Array.isArray(list) ? list.filter(key => validKeys.includes(key)) : [];
  return Array.from(new Set(next));
}

function getDashSeriesModeKey(mode = resultMode) {
  return mode === 'fixo' ? 'fixo' : 'simples';
}

function getDashSeriesSelectionForMode(mode = resultMode) {
  const key = getDashSeriesModeKey(mode);
  const selection = dashSeriesSelectionsByMode[key];
  if (!Array.isArray(selection)) return [...DEFAULT_DASH_SERIES];
  return sanitizeDashSeriesSelection(selection);
}

function setDashSeriesSelectionForMode(selection, mode = resultMode) {
  const key = getDashSeriesModeKey(mode);
  const next = sanitizeDashSeriesSelection(selection);
  dashSeriesSelectionsByMode[key] = next;
  dashSeriesSelection = [...dashSeriesSelectionsByMode[key]];
}

function saveDashSeriesSelection() {
  setDashSeriesSelectionForMode(dashSeriesSelection, resultMode);
  Storage.setJSON(STORAGE_KEYS.dashSeriesSelection, dashSeriesSelectionsByMode);
  Storage.setJSON(STORAGE_KEYS.dashSeriesSelectionSimple, sanitizeDashSeriesSelection(dashSeriesSelectionsByMode.simples));
  Storage.setJSON(STORAGE_KEYS.dashSeriesSelectionFixed, sanitizeDashSeriesSelection(dashSeriesSelectionsByMode.fixo));
  Storage.setText(STORAGE_KEYS.dashSeriesSelectionVersion, DASH_SERIES_SELECTION_VERSION);
}

function loadDashSeriesSelectionState() {
  const savedSimpleSelection = Storage.getJSON(STORAGE_KEYS.dashSeriesSelectionSimple, null);
  const savedFixoSelection = Storage.getJSON(STORAGE_KEYS.dashSeriesSelectionFixed, null);
  const savedDashSeriesSelection = Storage.getJSON(STORAGE_KEYS.dashSeriesSelection, null);
  const savedDashSeriesVersion = parseInt(Storage.getText(STORAGE_KEYS.dashSeriesSelectionVersion, '0') || '0', 10);
  if (savedSimpleSelection || savedFixoSelection) {
    dashSeriesSelectionsByMode = {
      simples: sanitizeDashSeriesSelection(savedSimpleSelection ?? undefined),
      fixo: sanitizeDashSeriesSelection(savedFixoSelection ?? undefined)
    };
  } else if (savedDashSeriesSelection && savedDashSeriesVersion >= 2) {
    try {
      const parsedSelection = savedDashSeriesSelection;
      if (Array.isArray(parsedSelection)) {
        dashSeriesSelectionsByMode = {
          simples: sanitizeDashSeriesSelection(parsedSelection),
          fixo: [...DEFAULT_DASH_SERIES]
        };
      } else if (parsedSelection && typeof parsedSelection === 'object') {
        dashSeriesSelectionsByMode = {
          simples: sanitizeDashSeriesSelection(parsedSelection.simples),
          fixo: sanitizeDashSeriesSelection(parsedSelection.fixo)
        };
      }
    } catch {}
  } else if (uiDashSeriesSelectionsFallback && typeof uiDashSeriesSelectionsFallback === 'object') {
    dashSeriesSelectionsByMode = {
      simples: sanitizeDashSeriesSelection(uiDashSeriesSelectionsFallback.simples),
      fixo: sanitizeDashSeriesSelection(uiDashSeriesSelectionsFallback.fixo)
    };
  } else {
    dashSeriesSelectionsByMode = {
      simples: [...DEFAULT_DASH_SERIES],
      fixo: [...DEFAULT_DASH_SERIES]
    };
    Storage.setText(STORAGE_KEYS.dashSeriesSelectionVersion, DASH_SERIES_SELECTION_VERSION);
  }
  if (!dashSeriesSelectionsByMode.simples) dashSeriesSelectionsByMode.simples = [...DEFAULT_DASH_SERIES];
  if (!dashSeriesSelectionsByMode.fixo) dashSeriesSelectionsByMode.fixo = [...DEFAULT_DASH_SERIES];
  dashSeriesSelection = getDashSeriesSelectionForMode(resultMode);
}

function saveDashSeriesColors() {
  Storage.setJSON(STORAGE_KEYS.dashSeriesColors, dashSeriesColorOverrides);
}

function saveCategoryColors() {
  Storage.setJSON(STORAGE_KEYS.categoryColors, categoryColorOverrides);
}

function saveCategoryEmojis() {
  Storage.setJSON(STORAGE_KEYS.categoryEmojis, categoryEmojiOverrides);
}

function saveMonthSectionColors() {
  Storage.setJSON(STORAGE_KEYS.monthSectionColors, monthSectionColorOverrides);
}

function hexToRgba(hex, alpha, fallbackRgb = '26,24,20') {
  const value = String(hex || '').replace('#', '').trim();
  if (value.length !== 6) return `rgba(${fallbackRgb},${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getMonthSectionColor(key) {
  return monthSectionColorOverrides[key] || MONTH_SECTION_DEFAULT_COLORS[key] || '#7f8c8d';
}

function getDashSeriesColor(key) {
  return dashSeriesColorOverrides[key] || DASH_SERIES_OPTIONS[key]?.color || '#2855a0';
}

function getDashSeriesBackground(key) {
  return hexToRgba(getDashSeriesColor(key), 0.08, '40,85,160');
}

function getCategoryColor(key) {
  return categoryColorOverrides[key] || CAT_COLORS[key] || '#95a5a6';
}

function sanitizeDashMetricOrder(list) {
  const base = ['resultado', 'gastos', 'ganhos', 'renda', 'projetos'];
  const next = Array.isArray(list) ? list.filter(key => base.includes(key)) : [];
  base.forEach(key => { if (!next.includes(key)) next.push(key); });
  return next;
}

function saveDashMetricOrder() {
  Storage.setJSON(STORAGE_KEYS.dashMetricOrder, dashMetricOrder);
}

function sanitizeDashboardWidgetOrder(list) {
  const base = ['gvsr', 'categories', 'result', 'quickhist'];
  const next = Array.isArray(list) ? list.filter(key => base.includes(key)) : [];
  base.forEach(key => { if (!next.includes(key)) next.push(key); });
  return next;
}

function dashboardWidgetBaseLayout() {
  return {
    gvsr: { x: 0, y: 0, w: 680, h: 340 },
    categories: { x: 700, y: 0, w: 340, h: 340 },
    result: { x: 0, y: 360, w: 680, h: 280 },
    quickhist: { x: 700, y: 360, w: 340, h: 280 }
  };
}

function dashboardWidgetLimits() {
  return {
    gvsr: { minW: 520, maxW: 1400, minH: 280, maxH: 900 },
    categories: { minW: 280, maxW: 700, minH: 280, maxH: 900 },
    result: { minW: 320, maxW: 1400, minH: 220, maxH: 700 },
    quickhist: { minW: 280, maxW: 700, minH: 220, maxH: 700 }
  };
}

function sanitizeDashboardWidgetLayout(layout) {
  const base = dashboardWidgetBaseLayout();
  const limits = dashboardWidgetLimits();
  const next = { ...base };
  const looksLikeLegacyGridLayout = !!(layout && Object.keys(base).every(key => {
    const item = layout[key];
    return item && (parseInt(item.w, 10) || 0) <= 12 && (parseInt(item.h, 10) || 0) <= 22;
  }));
  if (layout && typeof layout === 'object') {
    Object.keys(base).forEach(key => {
      const incoming = looksLikeLegacyGridLayout ? base[key] : (layout[key] || {});
      const range = limits[key] || { minW: 280, maxW: 1400, minH: 220, maxH: 900 };
      const parsedX = parseInt(incoming.x, 10);
      const parsedY = parseInt(incoming.y, 10);
      const parsedW = parseInt(incoming.w, 10);
      const parsedH = parseInt(incoming.h, 10);
      next[key] = {
        x: Math.max(0, Number.isFinite(parsedX) ? parsedX : base[key].x),
        y: Math.max(0, Number.isFinite(parsedY) ? parsedY : base[key].y),
        w: Math.max(range.minW, Math.min(range.maxW, Number.isFinite(parsedW) ? parsedW : base[key].w)),
        h: Math.max(range.minH, Math.min(range.maxH, Number.isFinite(parsedH) ? parsedH : base[key].h))
      };
    });
  }
  return next;
}

function fitDashboardWidgetLayoutToCanvas(layout, canvasWidth) {
  const width = Math.max(0, Number(canvasWidth || 0));
  const base = dashboardWidgetBaseLayout();
  const next = sanitizeDashboardWidgetLayout(layout);
  if (!width) return next;

  const desktopFallbackWidth = 980;
  const limits = dashboardWidgetLimits();
  let changed = false;

  Object.keys(next).forEach(key => {
    const item = next[key];
    const range = limits[key] || { minW: 280, maxW: 1400, minH: 220, maxH: 900 };
    const maxWidth = Math.max(range.minW, Math.min(range.maxW, width - 20));
    const clampedWidth = Math.min(item.w, maxWidth);
    const maxX = Math.max(0, width - clampedWidth);
    const clampedX = Math.max(0, Math.min(item.x, maxX));
    if (clampedWidth !== item.w || clampedX !== item.x) {
      changed = true;
      next[key] = {
        ...item,
        w: clampedWidth,
        x: clampedX
      };
    }
  });

  const entries = Object.entries(next);
  const hasSevereOverflow = entries.some(([, item]) => (item.x + item.w) > (width + 24) || item.y > 2400);
  const hasHeavyOverlap = entries.some(([keyA, itemA], index) => {
    return entries.slice(index + 1).some(([keyB, itemB]) => {
      if (keyA === keyB) return false;
      const overlapX = Math.max(0, Math.min(itemA.x + itemA.w, itemB.x + itemB.w) - Math.max(itemA.x, itemB.x));
      const overlapY = Math.max(0, Math.min(itemA.y + itemA.h, itemB.y + itemB.h) - Math.max(itemA.y, itemB.y));
      return (overlapX * overlapY) > 32000;
    });
  });

  if (width >= desktopFallbackWidth && (hasSevereOverflow || hasHeavyOverlap)) {
    return sanitizeDashboardWidgetLayout(base);
  }

  return changed ? sanitizeDashboardWidgetLayout(next) : next;
}

function saveDashboardWidgetState() {
  Storage.setJSON(STORAGE_KEYS.dashboardWidgetOrder, dashboardWidgetOrder);
  Storage.setJSON(STORAGE_KEYS.dashboardWidgetLayout, dashboardWidgetLayout);
  const saved = Storage.getJSON(STORAGE_KEYS.uiState, {}) || {};
  Storage.setJSON(STORAGE_KEYS.uiState, {
    ...saved,
    dashboardLayoutVersion: DASHBOARD_LAYOUT_VERSION,
    dashboardWidgetOrder,
    dashboardWidgetLayout
  });
}

function updateDashboardCanvasHeight() {
  const grid = document.getElementById('dashboardWidgets');
  if (!grid) return;
  const layout = sanitizeDashboardWidgetLayout(dashboardWidgetLayout);
  const bottom = Math.max(...Object.values(layout).map(item => item.y + item.h), 0);
  grid.style.minHeight = `${Math.max(760, bottom + 24)}px`;
}

function renderDashSeriesColorPicker() {
  const layer = document.getElementById('dashSeriesColorPickerLayer');
  if (!layer) return;
  if (!dashSeriesColorPicker.open || !dashSeriesColorPicker.key) {
    layer.innerHTML = '';
    return;
  }
  const key = dashSeriesColorPicker.key;
  const title = typeof DASH_SERIES_OPTIONS[key]?.getLabel === 'function'
    ? DASH_SERIES_OPTIONS[key].getLabel(getFilteredData())
    : (DASH_SERIES_OPTIONS[key]?.label || key);
  layer.innerHTML = `
    <div class="dash-color-picker" data-dash-color-picker="true" style="left:${dashSeriesColorPicker.x}px;top:${dashSeriesColorPicker.y}px">
      <div class="dash-color-picker-title">Cor da linha</div>
      <div style="font-size:13px;color:var(--text);margin-bottom:12px">${title}</div>
      <div class="dash-color-grid">
        ${DASH_SERIES_COLOR_OPTIONS.map(color => `
          <button class="dash-color-btn ${getDashSeriesColor(key) === color ? 'active' : ''}" style="background:${color}" onclick="setDashSeriesColor('${key}','${color}')"></button>
        `).join('')}
      </div>
    </div>
  `;
}

function openDashSeriesColorPicker(key, x, y) {
  dashSeriesColorPicker = { open: true, key, x: Math.max(16, x), y: Math.max(16, y) };
  renderDashSeriesColorPicker();
}

function closeDashSeriesColorPicker() {
  if (!dashSeriesColorPicker.open) return;
  dashSeriesColorPicker = { open: false, key: '', x: 0, y: 0 };
  renderDashSeriesColorPicker();
}

function setDashSeriesColor(key, color) {
  if (getDashSeriesColor(key) === color) {
    closeDashSeriesColorPicker();
    return;
  }
  recordHistoryState();
  dashSeriesColorOverrides[key] = color;
  saveDashSeriesColors();
  saveUIState();
  closeDashSeriesColorPicker();
  renderDashboard();
}

function renderCategoryColorPicker() {
  const layer = document.getElementById('catColorPickerLayer');
  if (!layer) return;
  if (!categoryColorPicker.open || !categoryColorPicker.key) {
    layer.innerHTML = '';
    return;
  }
  const key = categoryColorPicker.key;
  layer.innerHTML = `
    <div class="dash-color-picker" data-cat-color-picker="true" style="left:${categoryColorPicker.x}px;top:${categoryColorPicker.y}px">
      <div class="dash-color-picker-title">Cor da categoria</div>
      <div style="font-size:13px;color:var(--text);margin-bottom:12px">${key}</div>
      <div class="dash-color-grid">
        ${DASH_SERIES_COLOR_OPTIONS.map(color => `
          <button class="dash-color-btn ${getCategoryColor(key) === color ? 'active' : ''}" style="background:${color}" onclick="setCategoryColor('${key}','${color}')"></button>
        `).join('')}
      </div>
    </div>
  `;
}

function openCategoryColorPicker(key, x, y) {
  categoryColorPicker = { open: true, key, x: Math.max(16, x), y: Math.max(16, y) };
  renderCategoryColorPicker();
}

function closeCategoryColorPicker() {
  if (!categoryColorPicker.open) return;
  categoryColorPicker = { open: false, key: '', x: 0, y: 0 };
  renderCategoryColorPicker();
}

function setCategoryColor(key, color) {
  if (getCategoryColor(key) === color) {
    closeCategoryColorPicker();
    return;
  }
  recordHistoryState();
  categoryColorOverrides[key] = color;
  saveCategoryColors();
  saveUIState();
  closeCategoryColorPicker();
  renderDashboard();
}

function renderMonthSectionColorPicker() {
  const layer = document.getElementById('monthSectionColorPickerLayer');
  if (!layer) return;
  if (!monthSectionColorPicker.open || !monthSectionColorPicker.key) {
    layer.innerHTML = '';
    return;
  }
  const key = monthSectionColorPicker.key;
  const title = MONTH_SECTION_LABELS[key] || key;
  layer.innerHTML = `
    <div class="dash-color-picker" data-month-section-color-picker="true" style="left:${monthSectionColorPicker.x}px;top:${monthSectionColorPicker.y}px">
      <div class="dash-color-picker-title">Cor do quadro</div>
      <div style="font-size:13px;color:var(--text);margin-bottom:12px">${title}</div>
      <div class="dash-color-grid">
        ${DASH_SERIES_COLOR_OPTIONS.map(color => `
          <button class="dash-color-btn ${getMonthSectionColor(key) === color ? 'active' : ''}" style="background:${color}" onclick="setMonthSectionColor('${key}','${color}')"></button>
        `).join('')}
      </div>
    </div>
  `;
}

function openMonthSectionColorPicker(key, x, y) {
  monthSectionColorPicker = { open: true, key, x: Math.max(16, x), y: Math.max(16, y) };
  renderMonthSectionColorPicker();
}

function closeMonthSectionColorPicker() {
  if (!monthSectionColorPicker.open) return;
  monthSectionColorPicker = { open: false, key: '', x: 0, y: 0 };
  renderMonthSectionColorPicker();
}

function setMonthSectionColor(key, color) {
  if (getMonthSectionColor(key) === color) {
    closeMonthSectionColorPicker();
    return;
  }
  recordHistoryState();
  monthSectionColorOverrides[key] = color;
  saveMonthSectionColors();
  saveUIState();
  flushServerStorage(true);
  closeMonthSectionColorPicker();
  renderMes();
}

function handleDashLineChartDblClick(event) {
  const chart = charts['lineChart'];
  if (!chart) return;
  const hits = chart.getElementsAtEventForMode(event, 'nearest', { intersect: false }, false);
  if (!hits || !hits.length) return;
  const datasetIndex = hits[0].datasetIndex;
  const dataset = chart.data.datasets?.[datasetIndex];
  const key = dataset?.seriesKey;
  if (!key) return;
  openDashSeriesColorPicker(key, event.clientX + 12, event.clientY + 12);
}

function sanitizeMonthMetricOrder(list) {
  const base = ['resultado', 'gastos', 'renda', 'projetos', 'metas'];
  const next = Array.isArray(list) ? list.filter(key => base.includes(key)) : [];
  base.forEach(key => { if (!next.includes(key)) next.push(key); });
  return next;
}

function saveMonthMetricOrder() {
  Storage.setJSON(STORAGE_KEYS.monthMetricOrder, monthMetricOrder);
}

function sanitizeMonthSectionOrder(list) {
  const base = ['renda', 'goals', 'despesas', 'daily', 'projetos', 'reembolsos', 'observacoes'];
  const next = Array.isArray(list) ? list.filter(key => base.includes(key)) : [];
  base.forEach(key => { if (!next.includes(key)) next.push(key); });
  return next;
}

function saveMonthSectionOrder() {
  Storage.setJSON(STORAGE_KEYS.monthSectionOrder, monthSectionOrder);
}

function saveExpenseCategoryRules() {
  Storage.setJSON(STORAGE_KEYS.expenseCategoryRules, expenseCategoryRules);
}

function saveExpenseNameRenameMap() {
  Storage.setJSON(STORAGE_KEYS.expenseNameRenameMap, expenseNameRenameMap);
}

function saveExpensePaymentDateRules() {
  Storage.setJSON(STORAGE_KEYS.expensePaymentDateRules, expensePaymentDateRules);
}

function saveIncomeNameRenameMap() {
  Storage.setJSON(STORAGE_KEYS.incomeNameRenameMap, incomeNameRenameMap);
}

