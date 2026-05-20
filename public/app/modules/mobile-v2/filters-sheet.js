(function initMobileV2FiltersSheet(global) {
  'use strict';

  function ensureSheet() {
    let root = document.getElementById('mobileV2FiltersSheet');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'mobileV2FiltersSheet';
    root.className = 'bottom-sheet';
    root.innerHTML = `
      <button class="bottom-sheet-scrim" type="button" aria-label="Fechar"></button>
      <div class="bottom-sheet-panel" role="dialog" aria-modal="true" aria-label="Filtros">
        <div class="bottom-sheet-grip"></div>
        <h3 style="margin:0 0 10px">Filtros</h3>
        <div class="m2-card" style="margin-bottom:0">
          <button class="row-link" type="button" data-filter="expense">Planejamento do mês</button>
          <button class="row-link" type="button" data-filter="spend">Gastos</button>
          <button class="row-link" type="button" data-filter="all">Todos</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    root.querySelector('.bottom-sheet-scrim')?.addEventListener('click', close);
    root.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter') || 'expense';
        if (typeof global.setUnifiedOutflowFilter === 'function') {
          global.setUnifiedOutflowFilter(filter);
        }
        close();
      });
    });
    return root;
  }

  function open() { ensureSheet().classList.add('open'); }
  function close() { document.getElementById('mobileV2FiltersSheet')?.classList.remove('open'); }

  global.MobileV2FiltersSheet = { ensureSheet, open, close };
})(window);

