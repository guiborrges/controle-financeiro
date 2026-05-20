(function initMobileV2AddSheet(global) {
  'use strict';

  const TYPE_ICONS = {
    internetBanking: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
    launch: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
    renda: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
    recurring: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>',
    installment: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line><line x1="12" y1="10" x2="12" y2="20"></line></svg>',
    shared: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>'
  };

  const TYPE_OPTIONS = [
    { key: 'internet-banking', iconKey: 'internetBanking', title: 'Internet Banking', desc: 'Importar do banco conectado' },
    { key: 'launch', iconKey: 'launch', title: 'Lançamento', desc: 'Gasto ou receita simples' },
    { key: 'renda', iconKey: 'renda', title: 'Renda', desc: 'Renda fixa ou renda extra' },
    { key: 'recurring', iconKey: 'recurring', title: 'Recorrente', desc: 'Repete automaticamente todo mês' },
    { key: 'installment', iconKey: 'installment', title: 'Parcelado', desc: 'Divide em parcelas futuras' },
    { key: 'shared', iconKey: 'shared', title: 'Compartilhado', desc: 'Divide com outras pessoas' }
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
        <h3 class="m2-sheet-title">Adicionar</h3>
        <p class="m2-sheet-subtitle">Escolha o tipo para continuar.</p>
        <div class="m2-type-list">
          ${TYPE_OPTIONS.map((option) => `
            <button type="button" class="type-option" data-m2-add-type="${option.key}">
              <span class="type-option-icon">${TYPE_ICONS[option.iconKey] || ''}</span>
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
        const mode = String(btn.getAttribute('data-m2-add-type') || 'launch');
        close();
        if (mode === 'internet-banking') {
          const openBanking = () => global.MobileV2InternetBanking?.open?.();
          if (global.MobileV2InternetBanking?.open) openBanking();
          else global.MobileV2?.loadMobileModule?.('internet-banking')?.then(openBanking);
          return;
        }
        if (mode === 'renda') {
          global.MobileV2OutflowForm?.openIncomePicker?.();
          return;
        }
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
    close,
    TYPE_OPTIONS
  };
})(window);

