(function initMobileV2FiltersSheet(global) {
  'use strict';

  function ensureSheet() {
    if (global.MobileV2?.isEnabled?.() !== true) return null;
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
          <button class="row-link" type="button" data-filter="all">Todos os lançamentos</button>
          <button class="row-link" type="button" data-filter="expense">Lançamentos do mês</button>
          <button class="row-link" type="button" data-filter="spend">Lançamentos variáveis</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    root.setAttribute('hidden', 'hidden');
    root.style.display = 'none';
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

  function open() {
    if (global.MobileV2?.isEnabled?.() !== true) return;
    const sheet = ensureSheet();
    if (!sheet) return;
    sheet.style.display = '';
    sheet.removeAttribute('hidden');
    sheet.classList.add('open');
  }
  function close() {
    const sheet = document.getElementById('mobileV2FiltersSheet');
    if (!sheet) return;
    sheet.classList.remove('open');
    sheet.setAttribute('hidden', 'hidden');
    sheet.style.display = 'none';
  }

  global.MobileV2FiltersSheet = { ensureSheet, open, close };
})(window);

