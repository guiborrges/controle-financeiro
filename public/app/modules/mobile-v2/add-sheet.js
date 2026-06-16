(function initMobileV2AddSheet(global) {
  'use strict';

  const TYPE_ICONS = {
    internetBanking: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
    launch: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
    renda: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
    recurring: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>',
    installment: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line><line x1="12" y1="10" x2="12" y2="20"></line></svg>',
    shared: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    card: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line><path d="M6 15h4"></path></svg>'
  };

  const TYPE_OPTIONS = [
    { key: 'launch', iconKey: 'launch', title: 'Gasto', desc: 'Saída simples' },
    { key: 'recurring', iconKey: 'recurring', title: 'Gasto Recorrente', desc: 'Repete automaticamente todo mês' },
    { key: 'installment', iconKey: 'installment', title: 'Gasto Parcelado', desc: 'Divide em parcelas futuras' },
    { key: 'shared', iconKey: 'shared', title: 'Gasto Compartilhado', desc: 'Divide com outras pessoas' }
  ];

  function bankingConnectedClass() {
    try {
      const hasGroups = typeof global.PluggyBanking?.getMobileSnapshot === 'function';
      return hasGroups ? 'is-connected' : 'is-disconnected';
    } catch {
      return 'is-disconnected';
    }
  }

  function ensureSheet() {
    if (global.MobileV2?.isEnabled?.() !== true) return null;
    let root = document.getElementById('mobileV2AddSheet');
    if (root) return root;

    root = document.createElement('div');
    root.id = 'mobileV2AddSheet';
    root.className = 'bottom-sheet';
    root.innerHTML = `
      <button class="bottom-sheet-scrim" type="button" aria-label="Fechar"></button>
      <div class="bottom-sheet-panel" role="dialog" aria-modal="true" aria-label="Adicionar lançamento">
        <div class="bottom-sheet-grip"></div>
        <div class="m2-sheet-title-row">
          <h3 class="m2-sheet-title">Adicionar lançamento</h3>
          <button class="m2-banking-mini ${bankingConnectedClass()}" type="button" data-m2-open-banking aria-label="Abrir Internet Banking">
            ${TYPE_ICONS.internetBanking}
          </button>
        </div>
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
    root.querySelector('[data-m2-open-banking]')?.addEventListener('click', () => {
      close();
      global.MobileV2?.openInternetBanking?.();
    });
    const panel = root.querySelector('.bottom-sheet-panel');
    let dragStartY = 0;
    let dragCurrentY = 0;
    panel?.addEventListener('touchstart', (event) => {
      dragStartY = Number(event.touches?.[0]?.clientY || 0);
      dragCurrentY = dragStartY;
    }, { passive: true });
    panel?.addEventListener('touchmove', (event) => {
      dragCurrentY = Number(event.touches?.[0]?.clientY || dragStartY);
    }, { passive: true });
    panel?.addEventListener('touchend', () => {
      if ((dragCurrentY - dragStartY) > 88) close();
    });
    root.querySelectorAll('[data-m2-add-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = String(btn.getAttribute('data-m2-add-type') || 'launch');
        close();
        global.MobileV2OutflowForm?.open?.(mode);
      });
    });

    root.setAttribute('hidden', 'hidden');
    root.style.display = 'none';
    return root;
  }

  function open() {
    if (global.MobileV2?.isEnabled?.() !== true) return;
    const sheet = ensureSheet();
    if (!sheet) return;
    const bankingButton = sheet.querySelector('[data-m2-open-banking]');
    if (bankingButton) {
      bankingButton.classList.remove('is-connected', 'is-disconnected');
      bankingButton.classList.add(bankingConnectedClass());
    }
    sheet.style.display = '';
    sheet.removeAttribute('hidden');
    sheet.classList.add('open');
    document.body.classList.add('mobile-v2-sheet-open');
  }

  function close() {
    const sheet = document.getElementById('mobileV2AddSheet');
    if (!sheet) return;
    sheet.classList.remove('open');
    sheet.setAttribute('hidden', 'hidden');
    sheet.style.display = 'none';
    document.body.classList.remove('mobile-v2-sheet-open');
    global.requestAnimationFrame?.(() => global.MobileV2?.refresh?.());
  }

  global.MobileV2AddSheet = {
    ensureSheet,
    open,
    close,
    TYPE_OPTIONS
  };
})(window);

