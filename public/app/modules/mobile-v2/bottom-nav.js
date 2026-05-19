(function initMobileV2BottomNav(global) {
  'use strict';

  const TABS = [
    { key: 'home', label: 'Início', icon: 'dashboard' },
    { key: 'mes', label: 'Mês', icon: 'month' },
    { key: 'patrimonio', label: 'Patrimônio', icon: 'wealth' },
    { key: 'historico', label: 'Histórico', icon: 'history' }
  ];

  function icon(name) {
    return global.SystemIcons?.render ? global.SystemIcons.render(name) : '';
  }

  function render(container, currentTab, onChange) {
    if (!container) return;
    container.innerHTML = `
      <nav class="bottom-nav" role="tablist" aria-label="Navegação principal mobile">
        ${TABS.map(tab => `
          <button type="button" class="bottom-nav-item ${tab.key === currentTab ? 'active' : ''}" data-mobile-v2-tab="${tab.key}" aria-label="${tab.label}">
            <span class="nav-icon">${icon(tab.icon)}</span>
            <span>${tab.label}</span>
          </button>
        `).join('')}
      </nav>
    `;

    container.querySelectorAll('[data-mobile-v2-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-mobile-v2-tab');
        if (typeof onChange === 'function') onChange(key);
      });
    });
  }

  global.MobileV2BottomNav = { render, TABS };
})(window);
