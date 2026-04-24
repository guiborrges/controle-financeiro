(function initMobileLayout(global) {
  'use strict';

  function setTableLabels(root = document) {
    root.querySelectorAll('table.fin-table').forEach(table => {
      const labels = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
      table.querySelectorAll('tbody tr').forEach(row => {
        Array.from(row.children).forEach((cell, idx) => {
          if (!cell.getAttribute('data-label') && labels[idx]) cell.setAttribute('data-label', labels[idx]);
        });
      });
    });
  }

  function markMobileReady() {
    setTableLabels(document);
    document.querySelectorAll('.dashboard-widget-grip').forEach(el => el.setAttribute('aria-hidden', 'true'));
  }

  const observer = new MutationObserver(() => {
    if (!global.isMobileUiMode?.()) return;
    markMobileReady();
  });

  function init() {
    markMobileReady();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  global.MobileLayout = { init, setTableLabels, markMobileReady };
  global.syncResponsiveTableDataLabels = setTableLabels;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
