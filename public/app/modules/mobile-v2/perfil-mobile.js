(function initMobileV2Perfil(global) {
  'use strict';

  function row(label, action, danger = false) {
    return `<button class="row-link" type="button" onclick="${action}"><span>${label}</span><span style="color:${danger ? 'var(--red)' : 'var(--text3)'}">›</span></button>`;
  }

  function render(target) {
    if (!target) return;
    const userName = document.getElementById('sessionUserName')?.textContent?.trim() || 'Usuário';
    target.innerHTML = `
      <div class="m2-header">
        <div>
          <h2 class="m2-title">Perfil</h2>
          <p class="m2-subtitle">${global.escapeHtml ? global.escapeHtml(userName) : userName}</p>
        </div>
      </div>

      <section class="m2-card m2-list-like">
        <h3 class="m2-card-title">Conta</h3>
        ${row('Editar perfil', "openPreferences()")}
        ${row('Alterar senha', "openModal('modalRecovery')")}
      </section>

      <section class="m2-card m2-list-like">
        <h3 class="m2-card-title">Dados</h3>
        ${row('Fazer backup', "createManualBackup()")}
        ${row('Restaurar backup', "document.getElementById('importInput') && document.getElementById('importInput').click()")}
        ${row('Categorias e tags', "openCategoryEditorModal()")}
      </section>

      <section class="m2-card m2-list-like">
        <h3 class="m2-card-title">Preferências</h3>
        ${row('Abrir preferências', "openPreferences()")}
      </section>

      <section class="m2-card">
        <button class="btn" type="button" style="width:100%;margin-bottom:8px" onclick="logout()">Sair da conta</button>
      </section>
    `;
  }

  global.MobileV2Perfil = { render };
})(window);
