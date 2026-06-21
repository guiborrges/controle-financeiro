(function initMobileV2(global) {
  'use strict';

  const MOBILE_BREAKPOINT = 900;
  const state = {
    enabled: false,
    currentTab: 'mes',
    fabMenuOpen: false,
    fabMenuHideTimer: null,
    defaultLandingApplied: false,
    hiddenAt: 0
  };
  const modulePromises = {};
  const MOBILE_MODULE_VERSION = '2026-06-16-mobile-parity-banking-categories';

  function closeLeakingMobileSheets() {
    [
      'mobileV2AddSheet',
      'mobileV2OutflowSheet',
      'mobileV2FiltersSheet',
      'mobileV2PerfilSheet',
      'mobileV2DatePickerSheet'
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('open', 'active');
      el.setAttribute('hidden', 'hidden');
      el.style.display = 'none';
    });
  }

  function loadMobileModule(key) {
    if (key === 'calendario' && !global.MobileV2Calendario) {
      modulePromises.calendario = modulePromises.calendario || import(`/app-assets/modules/mobile-v2/calendario-mobile.js?v=${MOBILE_MODULE_VERSION}`).then(() => render());
      return modulePromises.calendario;
    }
    if (key === 'internet-banking' && !global.MobileV2InternetBanking) {
      modulePromises.internetBanking = modulePromises.internetBanking || import(`/app-assets/modules/mobile-v2/internet-banking-mobile.js?v=${MOBILE_MODULE_VERSION}`);
      return modulePromises.internetBanking;
    }
    return Promise.resolve();
  }

  function openInternetBanking() {
    closeFabMenu({ instant: true });
    hideFabTemporarily(420);
    const openLoadedModule = () => global.MobileV2InternetBanking?.open?.();
    if (global.MobileV2InternetBanking?.open) {
      openLoadedModule();
      return Promise.resolve();
    }
    return loadMobileModule('internet-banking')
      .then(openLoadedModule)
      .catch(() => {
        global.MobileV2OutflowForm?.openInlineSheet?.({
          title: 'Internet Banking',
          subtitle: 'Pré-visualização indisponível',
          body: '<div class="m2-empty">Não foi possível abrir os dados do Internet Banking agora.</div>'
        });
      });
  }

  function openUniversalSearch() {
    closeFabMenu({ instant: true });
    hideFabTemporarily(420);
    if (global.UniversalSearch?.open) {
      global.UniversalSearch.open();
      return;
    }
    if (typeof global.showToast === 'function') {
      global.showToast('Buscador universal indisponível no momento.');
    }
  }

  function closeFabMenu(options = {}) {
    const instant = options === true || options?.instant === true;
    state.fabMenuOpen = false;
    const menu = document.getElementById('mobileV2FabMenu');
    const fab = document.getElementById('mobileV2Fab');
    if (state.fabMenuHideTimer) {
      global.clearTimeout(state.fabMenuHideTimer);
      state.fabMenuHideTimer = null;
    }
    if (menu) {
      menu.classList.remove('open');
      if (instant) {
        menu.setAttribute('hidden', 'hidden');
      } else {
        state.fabMenuHideTimer = global.setTimeout(() => {
          if (!state.fabMenuOpen) menu.setAttribute('hidden', 'hidden');
          state.fabMenuHideTimer = null;
        }, 220);
      }
    }
    if (fab) fab.classList.remove('open');
    global.triggerHapticFeedback?.('light');
  }

  function hideFabTemporarily(duration = 280) {
    const fab = document.getElementById('mobileV2Fab');
    if (!fab) return;
    fab.classList.remove('show', 'open');
    global.setTimeout(() => {
      if (!state.enabled || state.currentTab !== 'mes') return;
      if (document.body?.classList.contains('mobile-v2-sheet-open')) return;
      fab.classList.add('show');
    }, duration);
  }

  function openFabMenu() {
    if (!state.enabled || state.currentTab !== 'mes') return;
    const menu = document.getElementById('mobileV2FabMenu');
    const fab = document.getElementById('mobileV2Fab');
    if (!menu || !fab) return;
    if (state.fabMenuHideTimer) {
      global.clearTimeout(state.fabMenuHideTimer);
      state.fabMenuHideTimer = null;
    }
    state.fabMenuOpen = true;
    menu.removeAttribute('hidden');
    menu.classList.add('open');
    fab.classList.add('open');
    global.triggerHapticFeedback?.('light');
  }

  function toggleFabMenu() {
    if (state.fabMenuOpen) {
      closeFabMenu();
      return;
    }
    openFabMenu();
  }

  function supportsTouch() {
    try {
      return 'ontouchstart' in global || navigator.maxTouchPoints > 0 || global.matchMedia?.('(pointer: coarse)')?.matches === true;
    } catch {
      return false;
    }
  }

  function isDesktopLikeUserAgent() {
    try {
      const ua = String(navigator.userAgent || '');
      if (!ua) return false;
      const mobileMarkers = /(Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile)/i;
      return !mobileMarkers.test(ua);
    } catch {
      return false;
    }
  }

  function isMobileV2Mode() {
    if (typeof global.__isMobileV2Candidate === 'function') return global.__isMobileV2Candidate();
    const width = Number(global.innerWidth || document.documentElement?.clientWidth || 0);
    if (isDesktopLikeUserAgent()) return false;
    return width > 0 && width <= MOBILE_BREAKPOINT && supportsTouch();
  }

  function icon(name) {
    return global.SystemIcons?.render ? global.SystemIcons.render(name) : '';
  }

  function getPatrimonioData() {
    if (global.MobileV2Data?.getPatrimonioData) return global.MobileV2Data.getPatrimonioData();
    return { accounts: [], movements: [], error: 'Dados de patrimônio indisponíveis no momento.' };
  }

  function ensureRoot() {
    let root = document.getElementById('mobileV2Root');
    if (root) return root;

    const main = document.querySelector('.main');
    if (!main) return null;

    root = document.createElement('div');
    root.id = 'mobileV2Root';
    root.innerHTML = `
      <div class="mobile-v2-content">
        <section id="mobileV2Screen-dashboard" class="mobile-v2-screen active" data-mobile-v2-screen="dashboard"></section>
        <section id="mobileV2Screen-mes" class="mobile-v2-screen" data-mobile-v2-screen="mes"></section>
        <section id="mobileV2Screen-patrimonio" class="mobile-v2-screen" data-mobile-v2-screen="patrimonio"></section>
        <section id="mobileV2Screen-historico" class="mobile-v2-screen" data-mobile-v2-screen="historico"></section>
        <section id="mobileV2Screen-calendario" class="mobile-v2-screen" data-mobile-v2-screen="calendario"></section>
      </div>
      <div id="mobileV2BottomNavMount"></div>
      <div id="mobileV2FabMenu" class="m2-fab-menu" hidden>
        <button type="button" class="m2-fab-scrim" aria-label="Fechar ações rápidas"></button>
        <button type="button" class="m2-fab-text-action is-left" data-m2-fab-action="card">Novo cartão</button>
        <button type="button" class="m2-fab-text-action is-top" data-m2-fab-action="launch">Lançamentos</button>
        <button type="button" class="m2-fab-text-action is-right" data-m2-fab-action="income">Renda</button>
      </div>
      <button id="mobileV2Fab" type="button" aria-label="Adicionar lançamento"><span class="m2-fab-glyph">${icon('plus') || '+'}</span></button>
    `;
    main.appendChild(root);

    const fab = root.querySelector('#mobileV2Fab');
    const activateFab = () => {
      if (!state.enabled || state.currentTab !== 'mes') return;
      toggleFabMenu();
    };
    const directHapticBinding = global.HapticFeedback?.bindDirectTarget?.(fab, activateFab);
    if (!directHapticBinding) fab?.addEventListener('click', activateFab);
    root.querySelector('.m2-fab-scrim')?.addEventListener('click', closeFabMenu);
    root.querySelectorAll('[data-m2-fab-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = String(button.getAttribute('data-m2-fab-action') || '');
        closeFabMenu({ instant: true });
        hideFabTemporarily(780);
        if (action === 'launch') {
          global.MobileV2AddSheet?.open?.();
          return;
        }
        if (action === 'card') {
          global.openUnifiedCardModal?.();
          return;
        }
        if (action === 'income') global.MobileV2OutflowForm?.openIncomePicker?.();
      });
    });

    global.MobileV2AddSheet?.ensureSheet?.();
    global.MobileV2OutflowForm?.ensureSheet?.();
    global.MobileV2FiltersSheet?.ensureSheet?.();
    global.MobileV2PerfilSheet?.ensureSheet?.();

    return root;
  }

  function setTab(tabKey) {
    if (!tabKey) return;
    state.currentTab = tabKey;
    closeFabMenu();
    loadMobileModule(tabKey).catch(() => {});
    render();
  }

  function applyDefaultLanding() {
    state.currentTab = 'mes';
    global.MobileV2MesAtual?.resetView?.();
    const months = typeof global.getAllFinanceMonths === 'function' ? global.getAllFinanceMonths() : [];
    if (!Array.isArray(months) || !months.length) {
      state.defaultLandingApplied = false;
      return;
    }
    const monthId = typeof global.getCurrentRealMonthId === 'function'
      ? global.getCurrentRealMonthId(false)
      : '';
    if (monthId && typeof global.selectMonth === 'function') {
      const currentId = String(global.getCurrentMonth?.()?.id || '');
      if (currentId !== String(monthId)) global.selectMonth(monthId);
    }
    state.defaultLandingApplied = true;
  }

  function updateBodyClasses() {
    document.documentElement.classList.toggle('mobile-v2', state.enabled);
    document.body?.classList.toggle('mobile-v2', state.enabled);

    if (state.enabled) {
      document.documentElement.classList.remove('mobile-ui');
      document.body?.classList.remove('mobile-ui');
    }
  }

  function renderScreens(root) {
    const screenDashboard = root.querySelector('#mobileV2Screen-dashboard');
    const screenMes = root.querySelector('#mobileV2Screen-mes');
    const screenPat = root.querySelector('#mobileV2Screen-patrimonio');
    const screenHis = root.querySelector('#mobileV2Screen-historico');
    const screenCal = root.querySelector('#mobileV2Screen-calendario');

    if (state.currentTab === 'dashboard') global.MobileV2HomeScreen?.render?.(screenDashboard);
    if (state.currentTab === 'mes') global.MobileV2MesAtual?.render?.(screenMes);
    if (state.currentTab === 'patrimonio') global.MobileV2Patrimonio?.render?.(screenPat);
    if (state.currentTab === 'historico') global.MobileV2Historico?.render?.(screenHis);
    if (state.currentTab === 'calendario' && !global.MobileV2Calendario) {
      if (screenCal) screenCal.innerHTML = '<div class="m2-empty">Carregando calendário...</div>';
      loadMobileModule('calendario').catch(() => {
        if (screenCal) screenCal.innerHTML = '<div class="m2-empty">Não foi possível carregar o calendário.</div>';
      });
    } else if (state.currentTab === 'calendario') {
      global.MobileV2Calendario?.render?.(screenCal);
    }

    root.querySelectorAll('[data-mobile-v2-screen]').forEach((screen) => {
      const isActive = screen.getAttribute('data-mobile-v2-screen') === state.currentTab;
      screen.classList.toggle('active', isActive);
    });

    const fab = root.querySelector('#mobileV2Fab');
    if (fab) fab.classList.toggle('show', state.currentTab === 'mes' && !document.body?.classList.contains('mobile-v2-sheet-open'));
    if (state.currentTab !== 'mes') closeFabMenu();
  }

  function renderBottomNav(root) {
    const mount = root.querySelector('#mobileV2BottomNavMount');
    global.MobileV2BottomNav?.render?.(mount, state.currentTab, (key) => {
      setTab(key);
    });
  }

  function render() {
    if (!state.enabled) return;
    const root = ensureRoot();
    if (!root) return;
    renderScreens(root);
    renderBottomNav(root);
  }

  function apply() {
    const wasEnabled = state.enabled;
    state.enabled = isMobileV2Mode();
    if (!wasEnabled && state.enabled) {
      applyDefaultLanding();
    }
    updateBodyClasses();
    if (state.enabled) {
      const root = ensureRoot();
      if (root) {
        root.removeAttribute('hidden');
        root.style.display = '';
      }
      render();
      return;
    }

    const root = document.getElementById('mobileV2Root');
    if (root) {
      root.setAttribute('hidden', 'hidden');
      root.style.display = 'none';
    }
    closeFabMenu();
    closeLeakingMobileSheets();
  }

  function refresh() {
    if (!state.enabled) return;
    if (!state.defaultLandingApplied) applyDefaultLanding();
    render();
  }

  function init() {
    apply();
    global.addEventListener('resize', apply, { passive: true });
    global.addEventListener('orientationchange', apply);
    global.addEventListener('pageshow', () => {
      if (!state.enabled) return;
      applyDefaultLanding();
      render();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        state.hiddenAt = Date.now();
        return;
      }
      if (!state.enabled || !state.hiddenAt) return;
      applyDefaultLanding();
      render();
    });
    document.addEventListener('mobileDataChanged', () => {
      if (!state.enabled || state.defaultLandingApplied) return;
      applyDefaultLanding();
      render();
    });

    const oldNav = global.nav;
    if (typeof oldNav === 'function') {
      global.nav = function patchedNav(page) {
        const result = oldNav.apply(this, arguments);
        if (state.enabled) {
          // A navegação mobile é controlada pela bottom nav. O bootstrap desktop
          // não pode restaurar a última página por cima do landing do mês atual.
          render();
        }
        return result;
      };
    }
  }

  global.MobileV2 = {
    init,
    apply,
    refresh,
    loadMobileModule,
    openInternetBanking,
    openUniversalSearch,
    closeFabMenu,
    setTab,
    isEnabled: () => state.enabled
  };
  if (typeof global.getPatrimonioData !== 'function') {
    getPatrimonioData.__mobileV2Fallback = true;
    global.getPatrimonioData = getPatrimonioData;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);

