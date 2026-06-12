(function initMobileV2(global) {
  'use strict';

  const MOBILE_BREAKPOINT = 900;
  const state = {
    enabled: false,
    currentTab: 'dashboard'
  };
  const modulePromises = {};

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
      modulePromises.calendario = modulePromises.calendario || import('/app-assets/modules/mobile-v2/calendario-mobile.js').then(() => render());
      return modulePromises.calendario;
    }
    if (key === 'internet-banking' && !global.MobileV2InternetBanking) {
      modulePromises.internetBanking = modulePromises.internetBanking || import('/app-assets/modules/mobile-v2/internet-banking-mobile.js');
      return modulePromises.internetBanking;
    }
    return Promise.resolve();
  }

  function openInternetBanking() {
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
      <button id="mobileV2Fab" type="button" aria-label="Adicionar lançamento">${icon('plus') || '+'}</button>
    `;
    main.appendChild(root);

    root.querySelector('#mobileV2Fab')?.addEventListener('click', () => {
      if (!state.enabled || state.currentTab !== 'mes') return;
      global.MobileV2AddSheet?.open?.();
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
    loadMobileModule(tabKey).catch(() => {});
    render();
  }

  function syncTabFromCurrentPage() {
    const activePage = document.querySelector('.page.active')?.id || '';
    if (activePage === 'page-dashboard') state.currentTab = 'dashboard';
    else if (activePage === 'page-mes') state.currentTab = 'mes';
    else if (activePage === 'page-patrimonio') state.currentTab = 'patrimonio';
    else if (activePage === 'page-historico' || activePage === 'page-eso') state.currentTab = 'historico';
    else if (activePage === 'page-calendario') state.currentTab = 'calendario';
    else state.currentTab = state.currentTab || 'dashboard';
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
    if (fab) fab.classList.toggle('show', state.currentTab === 'mes');
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
      // Sync only when entering mobile mode; resize during scroll must not reset active tab.
      syncTabFromCurrentPage();
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
    closeLeakingMobileSheets();
  }

  function refresh() {
    if (!state.enabled) return;
    render();
  }

  function init() {
    apply();
    global.addEventListener('resize', apply, { passive: true });
    global.addEventListener('orientationchange', apply);

    const oldNav = global.nav;
    if (typeof oldNav === 'function') {
      global.nav = function patchedNav(page) {
        const result = oldNav.apply(this, arguments);
        if (state.enabled) {
          if (page === 'dashboard') state.currentTab = 'dashboard';
          if (page === 'mes') state.currentTab = 'mes';
          if (page === 'patrimonio') state.currentTab = 'patrimonio';
          if (page === 'historico') state.currentTab = 'historico';
          if (page === 'calendario') state.currentTab = 'calendario';
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

