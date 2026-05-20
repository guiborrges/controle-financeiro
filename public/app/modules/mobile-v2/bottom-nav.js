(function initMobileV2BottomNav(global) {
  'use strict';

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    mes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><line x1="8" y1="14" x2="16" y2="14"></line><line x1="8" y1="18" x2="12" y2="18"></line></svg>',
    patrimonio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="3" y1="22" x2="21" y2="22"></line><line x1="6" y1="18" x2="6" y2="11"></line><line x1="10" y1="18" x2="10" y2="11"></line><line x1="14" y1="18" x2="14" y2="11"></line><line x1="18" y1="18" x2="18" y2="11"></line><polygon points="12 2 2 7 22 7"></polygon></svg>',
    historico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line><line x1="2" y1="20" x2="22" y2="20"></line></svg>',
    calendario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><rect x="7" y="14" width="3" height="3" rx="0.4" fill="currentColor" stroke="none"></rect><rect x="14" y="14" width="3" height="3" rx="0.4"></rect></svg>'
  };

  const TABS = [
    { key: 'dashboard', label: 'Dashboard', iconKey: 'home' },
    { key: 'mes', label: 'Mês', iconKey: 'mes' },
    { key: 'patrimonio', label: 'Patrimônio', iconKey: 'patrimonio' },
    { key: 'historico', label: 'Histórico', iconKey: 'historico' },
    { key: 'calendario', label: 'Calendário', iconKey: 'calendario' }
  ];

  function render(container, currentTab, onChange) {
    if (!container) return;
    container.innerHTML = `
      <nav class="bottom-nav" role="tablist" aria-label="Navegação principal mobile">
        ${TABS.map((tab) => `
          <button type="button" class="bottom-nav-item ${tab.key === currentTab ? 'active' : ''}" data-mobile-v2-tab="${tab.key}" aria-label="${tab.label}">
            <span class="nav-icon">${ICONS[tab.iconKey] || ''}</span>
            <span class="nav-label">${tab.label}</span>
          </button>
        `).join('')}
      </nav>
    `;

    container.querySelectorAll('[data-mobile-v2-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-mobile-v2-tab');
        if (typeof onChange === 'function') onChange(key);
      });
    });
  }

  global.MobileV2BottomNav = { render, TABS, ICONS };
})(window);

