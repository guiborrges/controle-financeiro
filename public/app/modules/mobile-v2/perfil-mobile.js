(function initMobileV2PerfilSheet(global) {
  'use strict';

  function row(label, action, danger) {
    return `
      <button class="row-link" type="button" data-profile-action="${action}">
        <span>${label}</span>
        <span style="color:${danger ? 'var(--red)' : 'var(--text3)'}">&gt;</span>
      </button>
    `;
  }

  function ensureSheet() {
    if (global.MobileV2?.isEnabled?.() !== true) return null;
    let root = document.getElementById('mobileV2PerfilSheet');
    if (root) return root;

    root = document.createElement('div');
    root.id = 'mobileV2PerfilSheet';
    root.className = 'bottom-sheet';
    root.innerHTML = `
      <div class="bottom-sheet-scrim" data-close-perfil></div>
      <div class="bottom-sheet-panel">
        <div class="bottom-sheet-grip"></div>
        <div class="m2-header">
          <div>
            <h2 class="m2-title" style="font-size:20px">Perfil</h2>
            <p id="mobileV2PerfilSubtitle" class="m2-subtitle"></p>
          </div>
          <button class="m2-icon-btn" type="button" data-close-perfil aria-label="Fechar">✕</button>
        </div>
        <section class="m2-card m2-list-like">
          <h3 class="m2-card-title">Conta</h3>
          ${row('Editar perfil', 'preferences')}
          ${row('Alterar senha', 'recovery')}
        </section>
        <section class="m2-card m2-list-like">
          <h3 class="m2-card-title">Dados</h3>
          ${row('Fazer backup', 'backup')}
          ${row('Restaurar backup', 'restore')}
          ${row('Categorias e tags', 'categories')}
        </section>
        <section class="m2-card m2-list-like">
          <h3 class="m2-card-title">Preferências</h3>
          ${row('Abrir preferências', 'preferences')}
        </section>
        <section class="m2-card">
          <button class="btn" type="button" style="width:100%" onclick="logout()">Sair da conta</button>
        </section>
      </div>
    `;

    document.body.appendChild(root);
    root.setAttribute('hidden', 'hidden');
    root.style.display = 'none';
    root.querySelectorAll('[data-close-perfil]').forEach((el) => {
      el.addEventListener('click', close);
    });
    root.querySelectorAll('[data-profile-action]').forEach((el) => {
      el.addEventListener('click', () => runAction(el.getAttribute('data-profile-action')));
    });
    return root;
  }

  function open() {
    if (global.MobileV2?.isEnabled?.() !== true) return;
    const root = ensureSheet();
    if (!root) return;
    const userName = document.getElementById('sessionUserName')?.textContent?.trim() || 'Usuário';
    const subtitle = root.querySelector('#mobileV2PerfilSubtitle');
    if (subtitle) subtitle.textContent = userName;
    root.style.display = '';
    root.removeAttribute('hidden');
    root.classList.add('open');
  }

  function close() {
    const root = document.getElementById('mobileV2PerfilSheet');
    if (!root) return;
    root.classList.remove('open');
    root.setAttribute('hidden', 'hidden');
    root.style.display = 'none';
  }

  function runAction(action) {
    close();
    setTimeout(() => {
      if (action === 'preferences') {
        global.openPreferences?.();
        return;
      }
      if (action === 'recovery') {
        global.openModal?.('modalRecovery');
        return;
      }
      if (action === 'backup') {
        global.createManualBackup?.();
        return;
      }
      if (action === 'restore') {
        document.getElementById('importInput')?.click();
        return;
      }
      if (action === 'categories') {
        global.openCategoryEditorModal?.();
      }
    }, 120);
  }

  global.MobileV2PerfilSheet = {
    ensureSheet,
    open,
    close,
    runAction
  };
})(window);


