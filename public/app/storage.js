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
let serverStorageCache = {};
let storageFlushTimer = null;
let storageFlushPromise = Promise.resolve();
let storageInitialized = false;
let scopedStorageNamespace = 'anonymous';
let serverStateRevision = '';
let storageWriteConflictDetected = false;

function getCsrfHeaders(extraHeaders = {}) {
  const token = window.__CSRF_TOKEN__ || '';
  return token ? { ...extraHeaders, 'X-CSRF-Token': token } : { ...extraHeaders };
}

const ScopedLocalStorage = {
  getJSON(key, fallback = null) {
    try {
      const raw = localStorage.getItem(`finScoped::${scopedStorageNamespace}::${key}`);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  setJSON(key, value) {
    try { localStorage.setItem(`finScoped::${scopedStorageNamespace}::${key}`, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(`finScoped::${scopedStorageNamespace}::${key}`); } catch {}
  }
};

function cloneStateValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

// --- FUNÇÃO CORRIGIDA COM TOLERÂNCIA DE 2s ---
async function flushServerStorage(force = false) {
  if (!storageInitialized || storageWriteConflictDetected) return;
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
    let body = {};
    try { body = await response.json(); } catch (e) { body = {}; }

    if (response.ok) {
      serverStateRevision = String(body?.updatedAt || serverStateRevision || '');
      console.log('[storage] ✅ Salvamento bem-sucedido!', { newRevision: serverStateRevision });
      return;
    }

    if (response.status === 409 || body?.conflict) {
      const serverTime = new Date(body.currentRevision || 0).getTime();
      const myTime = new Date(payload.baseRevision || 0).getTime();
      const diff = Math.abs(serverTime - myTime);

      if (diff < 2000) {
        console.warn('[storage] ⚠️ Conflito leve ignorado.', { diffMs: diff });
        serverStateRevision = String(body.currentRevision || serverStateRevision);
        return;
      }

      storageWriteConflictDetected = true;
      if (typeof window.showAppStatus === 'function') {
        window.showAppStatus('Conflito detectado. Recarregue a página.', 'Erro', 'warn');
      }
      return;
    }
    console.error('[storage] ❌ Erro HTTP:', response.status);
  })
  .catch((error) => { console.error('[storage] ❌ Erro de rede:', error); });

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
  try {
    const response = await fetch('/api/app/bootstrap', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) {
        if (response.status === 401) window.location.replace('/login');
        return;
    }
    const payload = await response.json();
    window.__APP_BOOTSTRAP__ = payload;
    window.__CSRF_TOKEN__ = payload.session?.csrfToken || '';
    scopedStorageNamespace = payload.session?.id || 'anonymous';
    serverStorageCache = payload.appState || {};
    serverStateRevision = String(payload.stateRevision || '');
    storageInitialized = true;
    return payload;
  } catch (e) { console.error('Erro boot:', e); }
}

const Storage = {
  getJSON(key, fallback = null) {
    if (Object.prototype.hasOwnProperty.call(serverStorageCache, key)) return cloneStateValue(serverStorageCache[key]);
    return ScopedLocalStorage.getJSON(key, fallback);
  },
  setJSON(key, value) {
    serverStorageCache[key] = cloneStateValue(value);
    if (!ENCRYPTED_STORAGE_KEYS.has(key)) ScopedLocalStorage.setJSON(key, value);
    if (key !== 'finUIState') scheduleServerStorageFlush();
  }
};
