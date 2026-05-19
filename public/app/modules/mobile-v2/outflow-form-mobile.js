(function initMobileV2OutflowForm(global) {
  'use strict';

  function ensureSheet() {
    let root = document.getElementById('mobileV2OutflowSheet');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'mobileV2OutflowSheet';
    root.className = 'bottom-sheet';
    root.innerHTML = `
      <button class="bottom-sheet-scrim" type="button" aria-label="Fechar"></button>
      <div class="bottom-sheet-panel" role="dialog" aria-modal="true" aria-label="Formulário de lançamento">
        <div class="bottom-sheet-grip"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <h3 id="mobileV2OutflowTitle" style="margin:0;font-size:18px">Novo lançamento</h3>
          <button class="m2-chip-btn" type="button" id="mobileV2OutflowOpenFull">Abrir completo</button>
        </div>
        <p style="margin:4px 0 12px;color:var(--text3);font-size:12px">Use o formulário completo para detalhes avançados.</p>
        <button class="btn btn-primary" type="button" style="width:100%" id="mobileV2OutflowAction">Abrir formulário</button>
      </div>
    `;
    document.body.appendChild(root);

    root.querySelector('.bottom-sheet-scrim')?.addEventListener('click', close);
    const openBtn = root.querySelector('#mobileV2OutflowOpenFull');
    const actionBtn = root.querySelector('#mobileV2OutflowAction');
    const openFn = () => {
      const type = root.getAttribute('data-mobile-v2-type') || '';
      close();
      if (typeof global.openUnifiedOutflowModal === 'function') {
        global.openUnifiedOutflowModal('', { mobileType: type });
      }
    };
    openBtn?.addEventListener('click', openFn);
    actionBtn?.addEventListener('click', openFn);

    return root;
  }

  function open(type = 'spend') {
    const sheet = ensureSheet();
    sheet.setAttribute('data-mobile-v2-type', String(type || 'spend'));
    const title = sheet.querySelector('#mobileV2OutflowTitle');
    if (title) title.textContent = type === 'expense' ? 'Nova despesa' : 'Novo gasto';
    sheet.classList.add('open');
  }

  function close() {
    document.getElementById('mobileV2OutflowSheet')?.classList.remove('open');
  }

  global.MobileV2OutflowForm = { ensureSheet, open, close };
})(window);
