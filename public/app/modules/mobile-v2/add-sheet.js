(function initMobileV2AddSheet(global) {
  'use strict';

  function ensureSheet() {
    let root = document.getElementById('mobileV2AddSheet');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'mobileV2AddSheet';
    root.className = 'bottom-sheet';
    root.innerHTML = `
      <button class="bottom-sheet-scrim" type="button" aria-label="Fechar"></button>
      <div class="bottom-sheet-panel" role="dialog" aria-modal="true" aria-label="Adicionar lançamento">
        <div class="bottom-sheet-grip"></div>
        <h3 style="margin:0 0 4px;font-size:18px">O que deseja adicionar?</h3>
        <p style="margin:0 0 12px;color:var(--text3);font-size:12px">Escolha como quer registrar a saída.</p>
        <div class="m2-choose-grid">
          <button type="button" class="m2-choose-card" data-m2-add-type="spend">
            <strong style="font-size:15px;display:block">💳 Gasto</strong>
            <span style="font-size:12px;color:var(--text3)">Compra/saída rápida</span>
          </button>
          <button type="button" class="m2-choose-card" data-m2-add-type="expense">
            <strong style="font-size:15px;display:block">📋 Despesa</strong>
            <span style="font-size:12px;color:var(--text3)">Compromisso/recorrência</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    root.querySelector('.bottom-sheet-scrim')?.addEventListener('click', close);
    root.querySelectorAll('[data-m2-add-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-m2-add-type');
        close();
        if (global.MobileV2OutflowForm?.open) {
          global.MobileV2OutflowForm.open(type);
          return;
        }
        if (typeof global.openUnifiedOutflowModal === 'function') {
          global.openUnifiedOutflowModal('', { mobileType: type });
        }
      });
    });

    return root;
  }

  function open() {
    ensureSheet().classList.add('open');
  }

  function close() {
    document.getElementById('mobileV2AddSheet')?.classList.remove('open');
  }

  global.MobileV2AddSheet = { ensureSheet, open, close };
})(window);
