(function initMobileV2AddSheet(global) {
  'use strict';

  const TYPE_OPTIONS = [
    { key: 'launch', icon: '??', title: 'Lançamento', desc: 'Gasto ou receita simples' },
    { key: 'recurring', icon: '??', title: 'Recorrente', desc: 'Repete automaticamente todo mês' },
    { key: 'installment', icon: '??', title: 'Parcelado', desc: 'Divide em parcelas futuras' },
    { key: 'shared', icon: '??', title: 'Compartilhado', desc: 'Divide com outras pessoas' }
  ];

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
        <h3 class="m2-sheet-title">Adicionar lançamento</h3>
        <p class="m2-sheet-subtitle">Escolha o tipo para continuar.</p>
        <div class="m2-type-list">
          ${TYPE_OPTIONS.map((option) => `
            <button type="button" class="type-option" data-m2-add-type="${option.key}">
              <span class="type-option-icon">${option.icon}</span>
              <span>
                <strong>${option.title}</strong>
                <span class="type-option-desc">${option.desc}</span>
              </span>
              <span class="type-option-arrow">›</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(root);

    root.querySelector('.bottom-sheet-scrim')?.addEventListener('click', close);
    root.querySelectorAll('[data-m2-add-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-m2-add-type') || 'launch';
        close();
        global.MobileV2OutflowForm?.open?.(mode);
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

  global.MobileV2AddSheet = {
    ensureSheet,
    open,
    close
  };
})(window);
