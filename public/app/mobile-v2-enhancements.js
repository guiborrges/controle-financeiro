(function initMobileV2Enhancements(global) {
  'use strict';

  const state = {
    patched: false,
    loadingCount: 0,
    pullActive: false,
    refreshInFlight: false,
    lastRefreshToastAt: 0,
    idleWarningTimer: null,
    idleLogoutTimer: null,
    datePickerInput: null
  };
  const CACHE_MAX_AGE_MS = 10 * 60 * 1000;
  const REFRESH_TOAST_COOLDOWN_MS = 15000;

  function isMobileEnabled() {
    return global.MobileV2?.isEnabled?.() === true || document.documentElement.classList.contains('mobile-v2');
  }

  function haptic(type = 'light') {
    if (!navigator.vibrate) return;
    const patterns = {
      light: 10,
      medium: 20,
      error: [30, 50, 30]
    };
    try { navigator.vibrate(patterns[type] || patterns.light); } catch {}
  }

  function ensureToastRoot() {
    let root = document.getElementById('mobileV2ToastRoot');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'mobileV2ToastRoot';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
    return root;
  }

  function showToast(message, options = {}) {
    const root = ensureToastRoot();
    const toast = document.createElement('div');
    toast.className = 'mobile-v2-toast';
    const action = options.actionLabel
      ? `<button type="button" class="mobile-v2-toast-action">${String(options.actionLabel)}</button>`
      : '';
    toast.innerHTML = `<span class="mobile-v2-toast-check" aria-hidden="true">OK</span><span>${String(message || '')}</span>${action}`;
    root.appendChild(toast);

    let actionTaken = false;
    const close = () => {
      toast.classList.add('leaving');
      window.setTimeout(() => toast.remove(), 180);
      if (!actionTaken && typeof options.onClose === 'function') options.onClose();
    };
    toast.querySelector('.mobile-v2-toast-action')?.addEventListener('click', () => {
      actionTaken = true;
      try { options.onAction?.(); } finally { close(); }
    });
    window.setTimeout(close, Math.max(1200, Number(options.duration || 2600)));
    return toast;
  }

  function ensureLoadingBar() {
    if (!isMobileEnabled()) return null;
    let bar = document.getElementById('mobileV2LoadingBar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'mobileV2LoadingBar';
    document.body.appendChild(bar);
    return bar;
  }

  function setLoading(active) {
    if (!isMobileEnabled()) return;
    state.loadingCount = Math.max(0, state.loadingCount + (active ? 1 : -1));
    const bar = ensureLoadingBar();
    if (!bar) return;
    bar.classList.toggle('active', state.loadingCount > 0);
  }

  function shouldTrackFetchForLoading(args) {
    const input = args?.[0];
    const init = args?.[1] || {};
    const rawUrl = typeof input === 'string'
      ? input
      : (typeof input?.url === 'string' ? input.url : '');
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    if (!rawUrl) return true;
    const lowerUrl = rawUrl.toLowerCase();
    // Background sync/autosave and session pings should not keep the top loading bar busy.
    if (lowerUrl.includes('/api/app-state') && (method === 'PUT' || method === 'POST')) return false;
    if (lowerUrl.includes('/api/auth/session') && method === 'GET') return false;
    if (lowerUrl.includes('/api/developer/session') && method === 'GET') return false;
    return true;
  }

  function patchFetch() {
    if (global.fetch?.__mobileV2Patched) return;
    const originalFetch = global.fetch;
    if (typeof originalFetch !== 'function') return;
    const patched = async function mobileV2Fetch() {
      const trackLoading = shouldTrackFetchForLoading(arguments);
      if (trackLoading) setLoading(true);
      try {
        return await originalFetch.apply(this, arguments);
      } finally {
        if (trackLoading) setLoading(false);
      }
    };
    patched.__mobileV2Patched = true;
    global.fetch = patched;
  }

  function notifyDataChanged(reason = 'unknown') {
    try {
      document.dispatchEvent(new CustomEvent('mobileDataChanged', { detail: { reason } }));
    } catch {}
    try {
      persistFinanceCache();
      rebuildWidgetSnapshot();
      const month = typeof global.getCurrentMonth === 'function' ? global.getCurrentMonth() : null;
      if (month) {
        sessionStorage.setItem('mobileV2:lastMonthSummary', JSON.stringify({
          label: month.nome || '',
          updatedAt: Date.now()
        }));
      }
    } catch {}
  }

  function getUserCacheKey() {
    const userId = String(global.__APP_BOOTSTRAP__?.session?.id || document.getElementById('sessionUserName')?.textContent || 'anonymous').trim() || 'anonymous';
    return `mobileV2:financeState:${userId}`;
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
  }

  function getAllMonths() {
    if (typeof global.getAllFinanceMonths === 'function') return global.getAllFinanceMonths();
    return Array.isArray(global.data) ? global.data : [];
  }

  function persistFinanceCache() {
    try {
      const months = getAllMonths();
      if (!Array.isArray(months) || !months.length) return;
      const current = typeof global.getCurrentMonth === 'function' ? global.getCurrentMonth() : months[months.length - 1];
      const payload = {
        userId: String(global.__APP_BOOTSTRAP__?.session?.id || 'anonymous'),
        timestamp: Date.now(),
        revision: String(global.__APP_BOOTSTRAP__?.stateRevision || ''),
        currentMonthId: String(current?.id || ''),
        months: clone(months),
        patrimonioAccounts: clone(global.patrimonioAccounts || []),
        patrimonioMovements: clone(global.patrimonioMovements || [])
      };
      sessionStorage.setItem(getUserCacheKey(), JSON.stringify(payload));
    } catch {}
  }

  function readFinanceCache() {
    try {
      const payload = JSON.parse(sessionStorage.getItem(getUserCacheKey()) || 'null');
      if (!payload || Date.now() - Number(payload.timestamp || 0) > CACHE_MAX_AGE_MS) return null;
      if (!Array.isArray(payload.months) || !payload.months.length) return null;
      return payload;
    } catch {
      return null;
    }
  }

  function getCachedFinanceMonths() {
    return readFinanceCache()?.months || [];
  }

  function hydrateCachedFinanceState() {
    const payload = readFinanceCache();
    if (!payload) return;
    global.__MOBILE_V2_CACHED_STATE__ = payload;
    try {
      document.dispatchEvent(new CustomEvent('mobileDataChanged', { detail: { reason: 'session-cache' } }));
    } catch {}
  }

  async function rebuildWidgetSnapshot() {
    if (!global.__CSRF_TOKEN__) return;
    try {
      await fetch('/api/widget/rebuild-snapshot', {
        method: 'POST',
        credentials: 'same-origin',
        headers: typeof global.getCsrfHeaders === 'function'
          ? global.getCsrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' })
          : { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': global.__CSRF_TOKEN__ || '' },
        body: '{}'
      });
    } catch {}
  }

  function patchSaveAndMutations() {
    const wrap = (name, after) => {
      const original = global[name];
      if (typeof original !== 'function' || original.__mobileV2Wrapped) return false;
      const wrapped = function mobileV2Wrapped() {
        const result = original.apply(this, arguments);
        try { after?.(arguments, result); } catch {}
        return result;
      };
      wrapped.__mobileV2Wrapped = true;
      global[name] = wrapped;
      return true;
    };
    const didWrapSave = wrap('save', () => notifyDataChanged('save'));
    wrap('saveUnifiedOutflow', () => {
      haptic('light');
      notifyDataChanged('saveUnifiedOutflow');
    });
    wrap('deleteUnifiedOutflow', () => {
      haptic('medium');
      notifyDataChanged('deleteUnifiedOutflow');
    });
    state.patched = didWrapSave || state.patched;
  }

  function normalizeNumericInputs(root = document) {
    root.querySelectorAll('input[type="number"], input[id*="Amount"], input[id*="Value"], input[id*="Valor"], input[id*="valor"]').forEach((input) => {
      input.setAttribute('inputmode', 'decimal');
      input.setAttribute('pattern', '[0-9]*');
    });
  }

  function closeSheet(sheet) {
    sheet?.classList.remove('open');
  }

  function attachBottomSheetGestures(root = document) {
    root.querySelectorAll('.bottom-sheet:not([data-mobile-v2-gestures])').forEach((sheet) => {
      sheet.setAttribute('data-mobile-v2-gestures', '1');
      sheet.querySelector('.bottom-sheet-scrim')?.addEventListener('click', () => closeSheet(sheet));
      const panel = sheet.querySelector('.bottom-sheet-panel');
      const grip = sheet.querySelector('.bottom-sheet-grip') || panel;
      if (!panel || !grip) return;
      let startY = 0;
      let deltaY = 0;
      grip.addEventListener('touchstart', (event) => {
        startY = event.touches?.[0]?.clientY || 0;
        deltaY = 0;
      }, { passive: true });
      grip.addEventListener('touchmove', (event) => {
        deltaY = Math.max(0, (event.touches?.[0]?.clientY || 0) - startY);
        if (deltaY > 0) panel.style.transform = `translateY(${Math.min(deltaY, 180)}px)`;
      }, { passive: true });
      grip.addEventListener('touchend', () => {
        panel.style.transform = '';
        if (deltaY > 76) closeSheet(sheet);
        deltaY = 0;
      });
    });
  }

  async function refreshFromServer() {
    if (state.refreshInFlight) return;
    state.refreshInFlight = true;
    setLoading(true);
    try {
      if (typeof global.initializeServerStorage === 'function') {
        await global.initializeServerStorage();
      }
      document.dispatchEvent(new CustomEvent('mobileDataChanged', { detail: { reason: 'pull-refresh' } }));
      global.MobileV2?.refresh?.();
      haptic('light');
    } finally {
      setLoading(false);
      state.refreshInFlight = false;
    }
  }

  function attachPullToRefresh() {
    let startY = 0;
    let startX = 0;
    let startAt = 0;
    let tracking = false;
    document.addEventListener('touchstart', (event) => {
      if (!isMobileEnabled() || !event.touches?.length) return;
      const screen = event.target?.closest?.('.mobile-v2-screen.active');
      if (!screen || screen.scrollTop > 0) return;
      if (event.target?.closest?.('input, textarea, select, button, .bottom-sheet')) return;
      tracking = true;
      startY = event.touches[0].clientY;
      startX = event.touches[0].clientX;
      startAt = Date.now();
    }, { passive: true });
    document.addEventListener('touchend', (event) => {
      if (!tracking || state.pullActive) return;
      tracking = false;
      const endY = event.changedTouches?.[0]?.clientY || startY;
      const endX = event.changedTouches?.[0]?.clientX || startX;
      const deltaY = endY - startY;
      const deltaX = Math.abs(endX - startX);
      const gestureDuration = Date.now() - startAt;
      if (deltaY < 90) return;
      if (deltaX > 40) return;
      if (gestureDuration > 900) return;
      state.pullActive = true;
      refreshFromServer().finally(() => { state.pullActive = false; });
    }, { passive: true });
  }

  function attachMonthSwipe() {
    let startX = 0;
    let startY = 0;
    document.addEventListener('touchstart', (event) => {
      if (!isMobileEnabled() || !event.touches?.length) return;
      if (event.target?.closest?.('input, textarea, select, button, .bottom-sheet')) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', (event) => {
      if (!startX) return;
      const dx = (event.changedTouches?.[0]?.clientX || startX) - startX;
      const dy = Math.abs((event.changedTouches?.[0]?.clientY || startY) - startY);
      startX = 0;
      if (Math.abs(dx) < 80 || dy > 60) return;
      const active = document.querySelector('.mobile-v2-screen.active')?.getAttribute('data-mobile-v2-screen');
      if (active !== 'mes' && active !== 'calendario') return;
      const api = active === 'calendario' ? global.MobileV2Calendario : global.MobileV2MesAtual;
      if (dx > 0) api?.prevMonth?.();
      else api?.nextMonth?.();
      const screen = document.querySelector('.mobile-v2-screen.active');
      screen?.classList.add(dx > 0 ? 'swipe-from-left' : 'swipe-from-right');
      window.setTimeout(() => screen?.classList.remove('swipe-from-left', 'swipe-from-right'), 260);
    }, { passive: true });
  }

  function ensurePrivacyOverlay() {
    let overlay = document.getElementById('mobileV2PrivacyOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'mobileV2PrivacyOverlay';
    overlay.innerHTML = '<div>Controle Financeiro</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function attachPrivacyOverlay() {
    document.addEventListener('visibilitychange', () => {
      ensurePrivacyOverlay().classList.toggle('active', document.hidden && isMobileEnabled());
    });
  }

  function ensureIdleOverlay() {
    let overlay = document.getElementById('mobileV2IdleOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'mobileV2IdleOverlay';
    overlay.innerHTML = `
      <div class="mobile-v2-idle-card">
        <h2>Sessao pausada</h2>
        <p>Por seguranca, confirme para continuar usando o app.</p>
        <button type="button" class="btn btn-primary" id="mobileV2IdleContinue">Continuar</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#mobileV2IdleContinue')?.addEventListener('click', () => {
      overlay.classList.remove('active');
      resetIdleTimer();
    });
    return overlay;
  }

  function resetIdleTimer() {
    window.clearTimeout(state.idleWarningTimer);
    window.clearTimeout(state.idleLogoutTimer);
    if (!isMobileEnabled()) return;
    state.idleWarningTimer = window.setTimeout(() => {
      ensureIdleOverlay().classList.add('active');
      state.idleLogoutTimer = window.setTimeout(() => {
        try { global.save?.(true); } catch {}
        if (typeof global.logout === 'function') global.logout();
      }, 60000);
    }, 30 * 60 * 1000);
  }

  function attachIdleTimer() {
    ['touchstart', 'touchmove', 'click', 'keydown'].forEach((eventName) => {
      document.addEventListener(eventName, resetIdleTimer, { passive: true });
    });
    resetIdleTimer();
  }

  function attachScreenshotWarning() {
    document.addEventListener('keydown', (event) => {
      const isPrint = event.key === 'PrintScreen';
      const isShortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && ['3', '4', '5', 's', 'S'].includes(event.key);
      if (!isPrint && !isShortcut) return;
      showToast('Atencao ao compartilhar dados financeiros.');
    });
  }

  function registerPwa() {
    // Disabled on purpose: legacy cache interference was causing desktop/mobile asset crossover.
    // Keep this no-op until a dedicated PWA scope is reintroduced safely.
    return;
  }

  function closeSplash() {
    const splash = document.getElementById('mobileV2Splash');
    if (!splash) return;
    window.setTimeout(() => {
      splash.classList.add('leaving');
      window.setTimeout(() => splash.remove(), 240);
    }, 800);
    // Fail-safe: never allow splash to block the app indefinitely.
    window.setTimeout(() => {
      splash.classList.add('leaving');
      splash.remove();
    }, 3500);
  }

  function attachObservers() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          normalizeNumericInputs(node);
          attachBottomSheetGestures(node);
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function initDatePicker() {
    document.addEventListener('focusin', (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.id !== 'mobileV2OutflowDate') return;
      event.preventDefault();
      openDatePicker(input);
    });
    document.addEventListener('click', (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.id !== 'mobileV2OutflowDate') return;
      event.preventDefault();
      openDatePicker(input);
    });
  }

  function parseDateParts(value) {
    const text = String(value || '').trim();
    const now = new Date();
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!match) {
      return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
    }
    const year = Number(match[3]) > 99 ? Number(match[3]) : 2000 + Number(match[3]);
    return {
      day: Math.min(31, Math.max(1, Number(match[1]) || now.getDate())),
      month: Math.min(12, Math.max(1, Number(match[2]) || now.getMonth() + 1)),
      year
    };
  }

  function formatPickerDate(day, month, year) {
    const max = new Date(year, month, 0).getDate();
    const safeDay = Math.min(day, max);
    return `${String(safeDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
  }

  function ensureDatePickerSheet() {
    let sheet = document.getElementById('mobileV2DatePickerSheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'mobileV2DatePickerSheet';
    sheet.className = 'bottom-sheet';
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 11 }, (_, index) => currentYear - 5 + index);
    sheet.innerHTML = `
      <button class="bottom-sheet-scrim" type="button" aria-label="Fechar"></button>
      <div class="bottom-sheet-panel" role="dialog" aria-modal="true" aria-label="Selecionar data">
        <div class="bottom-sheet-grip"></div>
        <div class="m2-sheet-head-inline">
          <h3 class="m2-sheet-title">Selecionar data</h3>
          <button type="button" class="m2-chip-btn positive" data-date-picker-apply>OK</button>
        </div>
        <div class="m2-date-picker" aria-label="Data">
          <select class="m2-date-slot" data-date-part="day">${Array.from({ length: 31 }, (_, index) => `<option value="${index + 1}">${String(index + 1).padStart(2, '0')}</option>`).join('')}</select>
          <select class="m2-date-slot" data-date-part="month">${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}">${String(index + 1).padStart(2, '0')}</option>`).join('')}</select>
          <select class="m2-date-slot" data-date-part="year">${years.map((year) => `<option value="${year}">${year}</option>`).join('')}</select>
        </div>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.querySelector('.bottom-sheet-scrim')?.addEventListener('click', () => sheet.classList.remove('open'));
    sheet.querySelector('[data-date-picker-apply]')?.addEventListener('click', applyDatePicker);
    attachBottomSheetGestures(sheet.parentElement || document);
    return sheet;
  }

  function openDatePicker(input) {
    state.datePickerInput = input;
    input.blur();
    const sheet = ensureDatePickerSheet();
    const parts = parseDateParts(input.value);
    sheet.querySelector('[data-date-part="day"]').value = String(parts.day);
    sheet.querySelector('[data-date-part="month"]').value = String(parts.month);
    sheet.querySelector('[data-date-part="year"]').value = String(parts.year);
    sheet.classList.add('open');
  }

  function applyDatePicker() {
    const sheet = ensureDatePickerSheet();
    const day = Number(sheet.querySelector('[data-date-part="day"]')?.value || 1);
    const month = Number(sheet.querySelector('[data-date-part="month"]')?.value || 1);
    const year = Number(sheet.querySelector('[data-date-part="year"]')?.value || new Date().getFullYear());
    if (state.datePickerInput) {
      state.datePickerInput.value = formatPickerDate(day, month, year);
      state.datePickerInput.dispatchEvent(new Event('input', { bubbles: true }));
      state.datePickerInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    sheet.classList.remove('open');
  }

  function init() {
    if (isMobileEnabled()) patchFetch();
    patchSaveAndMutations();
    if (isMobileEnabled()) hydrateCachedFinanceState();
    normalizeNumericInputs();
    if (isMobileEnabled()) attachBottomSheetGestures();
    if (isMobileEnabled()) attachPullToRefresh();
    if (isMobileEnabled()) attachMonthSwipe();
    if (isMobileEnabled()) attachPrivacyOverlay();
    if (isMobileEnabled()) attachIdleTimer();
    if (isMobileEnabled()) attachScreenshotWarning();
    attachObservers();
    if (isMobileEnabled()) initDatePicker();
    registerPwa();
    if (isMobileEnabled()) closeSplash();
    if (isMobileEnabled()) document.addEventListener('mobileDataChanged', () => global.MobileV2?.refresh?.());
    window.setInterval(patchSaveAndMutations, 1000);
  }

  global.showToast = global.showToast || showToast;
  global.MobileV2Enhancements = {
    haptic,
    showToast,
    notifyDataChanged,
    refreshFromServer
    ,
    getCachedFinanceMonths,
    persistFinanceCache,
    rebuildWidgetSnapshot
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
