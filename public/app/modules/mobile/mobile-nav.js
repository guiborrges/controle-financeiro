(function initMobileNav(global) {
  'use strict';

  function getActivePage() {
    const active = document.querySelector('.page.active');
    return String(active?.id || '').replace(/^page-/, '') || String(global.activePage || 'dashboard');
  }

  function sync() {
    const page = getActivePage();
    document.querySelectorAll('[data-mobile-page]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mobile-page') === page);
    });
    const fab = document.getElementById('mobileActionFab');
    if (fab) fab.hidden = !(page === 'mes');
  }

  function openAddSheet() {
    if (!global.isMobileUiMode?.()) {
      if (typeof global.openUnifiedOutflowModal === 'function') global.openUnifiedOutflowModal();
      return;
    }
    document.getElementById('mobileAddSheet')?.classList.add('open');
  }

  function closeAddSheet() {
    document.getElementById('mobileAddSheet')?.classList.remove('open');
  }

  function addOutflow(type) {
    closeAddSheet();
    if (typeof global.openUnifiedOutflowModal !== 'function') return;
    global.openUnifiedOutflowModal('', { mobileType: type });
    setTimeout(() => {
      const typeSelect = document.getElementById('unifiedOutflowType');
      if (typeSelect && type) {
        typeSelect.value = type;
        typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, 40);
  }

  function patchNav() {
    if (global.__mobileNavPatched || typeof global.nav !== 'function') return;
    const original = global.nav;
    global.nav = function patchedMobileNav(page) {
      const result = original.apply(this, arguments);
      setTimeout(sync, 0);
      return result;
    };
    global.__mobileNavPatched = true;
  }

  const observer = new MutationObserver(sync);
  function init() {
    patchNav();
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    sync();
    const retry = setInterval(() => {
      patchNav();
      if (global.__mobileNavPatched) clearInterval(retry);
    }, 100);
    setTimeout(() => clearInterval(retry), 5000);
  }

  global.MobileNav = { init, sync, openAddSheet, closeAddSheet, addOutflow };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
