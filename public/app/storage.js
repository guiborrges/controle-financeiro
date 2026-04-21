const STORAGE_KEYS = {
  uiState: 'finUIState',
  categoryRenameMap: 'finCategoryRenameMap',
  data: 'finData',
  resultMode: 'finResultMode'
};

const ENCRYPTED_STORAGE_KEYS = new Set([STORAGE_KEYS.data]);
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
  }
};

function cloneStateValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

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
  getText(key, fallback = '') {
    if (Object.prototype.hasOwnProperty.call(serverStorageCache, key)) {
      const v = serverStorageCache[key];
      return v === null ? fallback : String(v);
    }
    return fallback;
  },
  setText(key, value) {
    serverStorageCache[key] = String(value);
    scheduleServerStorageFlush();
  },
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
