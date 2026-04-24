(function initMobileShell(global) {
  'use strict';

  const MOBILE_BREAKPOINT = 900;
  let mobileUiState = false;
  let booted = false;

  function supportsTouch() {
    try {
      return 'ontouchstart' in global || navigator.maxTouchPoints > 0 || global.matchMedia?.('(pointer: coarse)')?.matches === true;
    } catch {
      return false;
    }
  }

  function isMobileUiMode() {
    const width = Number(global.innerWidth || document.documentElement?.clientWidth || 0);
    return width > 0 && width <= MOBILE_BREAKPOINT && supportsTouch();
  }

  function updateViewportUnit() {
    const vh = (global.visualViewport?.height || global.innerHeight || 0) * 0.01;
    if (vh > 0) document.documentElement.style.setProperty('--app-vh', `${vh}px`);
  }

  function applyState() {
    const enabled = isMobileUiMode();
    mobileUiState = enabled;
    document.documentElement.classList.toggle('mobile-ui', enabled);
    document.body?.classList.toggle('mobile-ui', enabled);
    updateViewportUnit();
    if (enabled) boot();
    if (global.MobileNav?.sync) global.MobileNav.sync();
    return enabled;
  }

  function icon(name) {
    return global.SystemIcons?.render ? global.SystemIcons.render(name) : '';
  }

  function createHeader() {
    if (document.getElementById('mobileAppHeader')) return;
    const header = document.createElement('header');
    header.id = 'mobileAppHeader';
    header.className = 'mobile-app-header';
    header.innerHTML = `
      <button class="mobile-nav-btn" data-mobile-page="mes" type="button" onclick="nav('mes')" aria-label="Mes atual">${icon('month')}</button>
      <button class="mobile-nav-btn" data-mobile-page="dashboard" type="button" onclick="nav('dashboard')" aria-label="Dashboard">${icon('dashboard')}</button>
      <button class="mobile-nav-btn" data-mobile-page="patrimonio" type="button" onclick="nav('patrimonio')" aria-label="Patrimonio">${icon('wealth')}</button>
      <button class="mobile-nav-btn" data-mobile-page="historico" type="button" onclick="nav('historico')" aria-label="Historico">${icon('history')}</button>
      <button class="mobile-nav-btn" type="button" onclick="openMonthCalendar()" aria-label="Mes">${icon('calendar')}</button>
      <button class="mobile-nav-btn" type="button" onclick="openModal('modalHelp')" aria-label="Ajuda">${icon('help')}</button>
      <button class="mobile-nav-btn" type="button" onclick="logout()" aria-label="Sair">${icon('logout')}</button>
      <button class="mobile-nav-btn" data-mobile-page="perfil" type="button" onclick="nav('perfil')" aria-label="Perfil">${icon('user')}</button>
    `;
    document.body.prepend(header);
  }

  function createActionLayer() {
    if (document.getElementById('mobileActionFab')) return;
    const fab = document.createElement('button');
    fab.id = 'mobileActionFab';
    fab.className = 'mobile-action-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Adicionar');
    fab.innerHTML = icon('plus');
    fab.addEventListener('click', () => global.MobileNav?.openAddSheet?.());
    document.body.appendChild(fab);

    const sheet = document.createElement('div');
    sheet.id = 'mobileAddSheet';
    sheet.className = 'mobile-add-sheet';
    sheet.innerHTML = `
      <button class="mobile-add-scrim" type="button" aria-label="Fechar" onclick="MobileNav.closeAddSheet()"></button>
      <div class="mobile-add-panel" role="dialog" aria-label="Adicionar lançamento">
        <div class="mobile-add-grip"></div>
        <strong>Adicionar</strong>
        <button type="button" onclick="MobileNav.addOutflow('spend')">${icon('card')}<span>Gasto</span></button>
        <button type="button" onclick="MobileNav.addOutflow('expense')">${icon('invoice')}<span>Despesa</span></button>
      </div>
    `;
    document.body.appendChild(sheet);
  }

  function replaceStaticIcons() {
    document.querySelectorAll('[data-system-icon]').forEach(node => {
      const name = node.getAttribute('data-system-icon');
      node.innerHTML = icon(name);
    });
  }

  function boot() {
    if (booted) return;
    booted = true;
    createHeader();
    createActionLayer();
    replaceStaticIcons();
  }

  function init() {
    boot();
    applyState();
    global.addEventListener('resize', applyState, { passive: true });
    global.addEventListener('orientationchange', applyState);
    if (global.visualViewport?.addEventListener) {
      global.visualViewport.addEventListener('resize', applyState, { passive: true });
      global.visualViewport.addEventListener('scroll', updateViewportUnit, { passive: true });
    }
  }

  global.isMobileUiMode = isMobileUiMode;
  global.applyMobileUiState = applyState;
  global.updateMobileViewportUnit = updateViewportUnit;
  global.MobileShell = { init, boot, applyState, isMobileUiMode, updateViewportUnit };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
