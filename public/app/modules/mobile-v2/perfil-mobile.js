(function initMobileV2PerfilSheet(global) {
  'use strict';

  let widgetToken = null;

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function icon(name, fallback = '›') {
    return global.SystemIcons?.render ? (global.SystemIcons.render(name) || fallback) : fallback;
  }

  function row(label, action, iconName, detail = '') {
    return `<button class="m2-settings-row" type="button" data-profile-action="${escapeHtml(action)}">
      <span class="m2-settings-icon" aria-hidden="true">${icon(iconName)}</span>
      <span class="m2-settings-copy"><strong>${escapeHtml(label)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span>
      <span class="m2-settings-chevron" aria-hidden="true">›</span>
    </button>`;
  }

  function toggleRow(label, checked, action, iconName, detail = '') {
    return `<button class="m2-settings-row m2-settings-toggle-row" type="button" data-profile-action="${escapeHtml(action)}">
      <span class="m2-settings-icon" aria-hidden="true">${icon(iconName)}</span>
      <span class="m2-settings-copy"><strong>${escapeHtml(label)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span>
      <span class="m2-switch ${checked ? 'on' : ''}" aria-hidden="true"><span></span></span>
    </button>`;
  }

  function shell(title, subtitle, body) {
    return `<div class="m2-settings-subview">
      <header class="m2-settings-subview-head">
        <button class="m2-icon-btn" type="button" data-profile-back aria-label="Voltar">&lt;</button>
        <div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>
      </header>${body}
    </div>`;
  }

  function getProfileSnapshot() {
    return global.__APP_BOOTSTRAP__?.profile || {};
  }

  function getSessionSnapshot() {
    return global.__APP_BOOTSTRAP__?.session || {};
  }

  function renderHome(root) {
    const session = getSessionSnapshot();
    const profile = getProfileSnapshot();
    const name = String(profile.displayName || session.displayName || profile.fullName || session.fullName || 'Usuário');
    const email = String(profile.email || session.email || '');
    const initial = name.trim().slice(0, 1).toUpperCase() || 'U';
    const avatar = profile.avatarDataUrl
      ? `<img class="m2-settings-avatar" src="${escapeHtml(profile.avatarDataUrl)}" alt="Foto do perfil">`
      : `<span class="m2-settings-avatar">${escapeHtml(initial)}</span>`;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    root.querySelector('.m2-settings-body').innerHTML = `
      <section class="m2-settings-identity">
        ${avatar}
        <span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(email)}</small></span>
      </section>
      <h3 class="m2-settings-group-title">Conta</h3>
      <section class="m2-settings-group">
        ${row('Editar perfil', 'edit-profile', 'user', 'Nome, foto, e-mail e dados pessoais')}
        ${row('Segurança', 'security', 'lock', 'Alterar senha e conferir proteção')}
      </section>
      <h3 class="m2-settings-group-title">Sistema</h3>
      <section class="m2-settings-group">
        ${toggleRow('Modo noturno', isDark, 'toggle-theme', 'moon', 'Alterna claro e escuro')}
        ${row('Preferências do sistema', 'preferences', 'controls', 'Integridade e interface')}
      </section>
      <h3 class="m2-settings-group-title">Integrações</h3>
      <section class="m2-settings-group">
        ${row('Internet Banking', 'banking', 'internetBanking')}
        ${row('Widget para iPhone', 'widget', 'phone', 'Scriptable e token individual')}
      </section>
      <h3 class="m2-settings-group-title">Dados</h3>
      <section class="m2-settings-group">
        ${row('Criar backup', 'backup', 'download')}
        ${row('Restaurar ou importar', 'restore', 'upload')}
      </section>
      <h3 class="m2-settings-group-title">Ajuda</h3>
      <section class="m2-settings-group">
        ${row('Tutorial inicial', 'tutorial', 'help')}
        ${row('Sobre o Meufin', 'about', 'info')}
      </section>
      <button class="m2-settings-logout" type="button" data-profile-action="logout">Sair da conta</button>`;
    bindActions(root);
  }

  function ensureSheet() {
    if (global.MobileV2?.isEnabled?.() !== true) return null;
    let root = document.getElementById('mobileV2PerfilSheet');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'mobileV2PerfilSheet';
    root.className = 'bottom-sheet m2-settings-sheet';
    root.innerHTML = `<div class="bottom-sheet-scrim" aria-hidden="true"></div><div class="bottom-sheet-panel">
      <header class="m2-settings-main-head"><div><h2>Ajustes</h2><p>Conta, sistema e integrações</p></div><button class="m2-icon-btn" type="button" data-close-perfil aria-label="Fechar">&times;</button></header>
      <div class="m2-settings-body"></div></div>`;
    document.body.appendChild(root);
    root.setAttribute('hidden', 'hidden');
    root.style.display = 'none';
    root.querySelectorAll('[data-close-perfil]').forEach((el) => el.addEventListener('click', close));
    root.querySelector('.bottom-sheet-panel')?.addEventListener('touchmove', (event) => event.stopPropagation(), { passive: true });
    return root;
  }

  function bindActions(root) {
    root.querySelectorAll('[data-profile-action]').forEach((el) => {
      el.addEventListener('click', () => runAction(el.getAttribute('data-profile-action')));
    });
  }

  function open() {
    const root = ensureSheet();
    if (!root) return;
    renderHome(root);
    root.style.display = '';
    root.removeAttribute('hidden');
    root.classList.add('open');
    document.body.classList.add('mobile-v2-sheet-open');
    global.triggerHapticFeedback?.('light');
  }

  function close() {
    const root = document.getElementById('mobileV2PerfilSheet');
    if (!root) return;
    root.classList.remove('open');
    root.setAttribute('hidden', 'hidden');
    root.style.display = 'none';
    document.body.classList.remove('mobile-v2-sheet-open');
  }

  async function openProfileEditor() {
    const root = ensureSheet();
    let profile = getProfileSnapshot();
    try { profile = await global.loadProfile?.() || profile; } catch {}
    let editedAvatar = String(profile.avatarDataUrl || '');
    const avatarMarkup = editedAvatar
      ? `<img class="m2-settings-avatar large" data-profile-avatar-preview src="${escapeHtml(editedAvatar)}" alt="Foto do perfil">`
      : `<div class="m2-settings-avatar large" data-profile-avatar-preview>${escapeHtml(String(profile.displayName || profile.fullName || 'U').slice(0, 1).toUpperCase())}</div>`;
    root.querySelector('.m2-settings-body').innerHTML = shell('Editar perfil', 'Seus dados pessoais', `
      <section class="m2-settings-form">
        ${avatarMarkup}
        <label class="m2-avatar-picker">Alterar foto<input type="file" accept="image/png,image/jpeg,image/webp" data-avatar-file></label>
        <label>Nome exibido<input data-m2-profile="displayName" value="${escapeHtml(profile.displayName || '')}"></label>
        <label>Nome completo<input data-m2-profile="fullName" value="${escapeHtml(profile.fullName || '')}"></label>
        <label>E-mail<input type="email" data-m2-profile="email" value="${escapeHtml(profile.email || '')}"></label>
        <label>Telefone<input data-m2-profile="phone" value="${escapeHtml(profile.phone || '')}"></label>
        <label>Data de nascimento<input inputmode="numeric" data-m2-profile="birthDate" value="${escapeHtml(profile.birthDate || '')}"></label>
        <label>Dica da senha<input data-m2-profile="passwordHint" value="${escapeHtml(profile.passwordHint || '')}"></label>
        <button class="m2-settings-primary" type="button" data-save-profile>Salvar perfil</button>
        <p class="m2-settings-status" role="status"></p>
      </section>`);
    root.querySelector('[data-profile-back]')?.addEventListener('click', () => renderHome(root));
    root.querySelector('[data-avatar-file]')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        editedAvatar = await compressAvatar(file);
        const current = root.querySelector('[data-profile-avatar-preview]');
        const image = document.createElement('img');
        image.className = 'm2-settings-avatar large';
        image.dataset.profileAvatarPreview = '';
        image.alt = 'Foto do perfil';
        image.src = editedAvatar;
        current?.replaceWith(image);
        global.triggerHapticFeedback?.('selection');
      } catch (error) {
        root.querySelector('.m2-settings-status').textContent = error.message;
        global.triggerHapticFeedback?.('error');
      }
    });
    root.querySelector('[data-save-profile]')?.addEventListener('click', async () => {
      const payload = {};
      root.querySelectorAll('[data-m2-profile]').forEach((input) => { payload[input.dataset.m2Profile] = input.value; });
      payload.avatarDataUrl = editedAvatar;
      const status = root.querySelector('.m2-settings-status');
      try {
        const response = await fetch('/api/profile', { method: 'PUT', credentials: 'same-origin', headers: global.getCsrfHeaders?.({ 'Content-Type': 'application/json', Accept: 'application/json' }) || { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'Não foi possível salvar o perfil.');
        const profileResult = result.profile || payload;
        global.__APP_BOOTSTRAP__ = { ...(global.__APP_BOOTSTRAP__ || {}), profile: profileResult, session: { ...(getSessionSnapshot()), displayName: profileResult.displayName || payload.displayName, email: profileResult.email || payload.email } };
        if (status) status.textContent = 'Perfil atualizado.';
        global.triggerHapticFeedback?.('success');
        renderHome(root);
      } catch (error) {
        if (status) status.textContent = error.message;
        global.triggerHapticFeedback?.('error');
      }
    });
  }

  function compressAvatar(file) {
    if (!/^image\/(?:png|jpeg|webp)$/i.test(String(file?.type || ''))) {
      return Promise.reject(new Error('Escolha uma imagem PNG, JPEG ou WebP.'));
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível ler a foto.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('A foto selecionada é inválida.'));
        image.onload = () => {
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext('2d');
          const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
          const sx = Math.max(0, (image.naturalWidth - sourceSize) / 2);
          const sy = Math.max(0, (image.naturalHeight - sourceSize) / 2);
          context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', .82));
        };
        image.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  function openSecurity() {
    const root = ensureSheet();
    root.querySelector('.m2-settings-body').innerHTML = shell('Segurança', 'Senha e proteção da conta', `
      <section class="m2-settings-form">
        <label>Senha atual<input type="password" autocomplete="current-password" data-m2-security="currentPassword"></label>
        <label>Nova senha<input type="password" autocomplete="new-password" data-m2-security="newPassword"></label>
        <label>Confirmar nova senha<input type="password" autocomplete="new-password" data-m2-security="confirmPassword"></label>
        <button class="m2-settings-primary" type="button" data-save-security>Alterar senha</button>
        <p class="m2-settings-note">Use uma senha forte. O acesso é protegido por sessão e CSRF.</p>
        <p class="m2-settings-status" role="status"></p>
      </section>`);
    root.querySelector('[data-profile-back]')?.addEventListener('click', () => renderHome(root));
    root.querySelector('[data-save-security]')?.addEventListener('click', async () => {
      const get = (name) => root.querySelector(`[data-m2-security="${name}"]`)?.value || '';
      const status = root.querySelector('.m2-settings-status');
      if (!get('currentPassword') || !get('newPassword') || get('newPassword') !== get('confirmPassword')) {
        if (status) status.textContent = 'Preencha as senhas e confirme a nova senha corretamente.';
        global.triggerHapticFeedback?.('error');
        return;
      }
      try {
        const response = await fetch('/api/profile/change-password', { method: 'POST', credentials: 'same-origin', headers: global.getCsrfHeaders?.({ 'Content-Type': 'application/json', Accept: 'application/json' }) || { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: get('currentPassword'), newPassword: get('newPassword'), confirmPassword: get('confirmPassword') }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'Não foi possível alterar a senha.');
        root.querySelectorAll('[data-m2-security]').forEach((input) => { input.value = ''; });
        if (status) status.textContent = 'Senha alterada com sucesso.';
        global.triggerHapticFeedback?.('success');
      } catch (error) {
        if (status) status.textContent = error.message;
        global.triggerHapticFeedback?.('error');
      }
    });
  }

  function openPreferencesLite() {
    const root = ensureSheet();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    root.querySelector('.m2-settings-body').innerHTML = shell('Preferências', 'Ajustes simples do sistema', `
      <section class="m2-settings-group">
        ${toggleRow('Modo noturno', isDark, 'toggle-theme', 'moon', 'Alterna claro e escuro')}
        ${row('Verificar integridade', 'integrity', 'shield', 'Checa consistência local')}
        ${row('Resetar preferências da interface', 'reset-ui', 'settings', 'Não altera dados financeiros')}
      </section>
      <p class="m2-settings-status" role="status"></p>`);
    root.querySelector('[data-profile-back]')?.addEventListener('click', () => renderHome(root));
    bindActions(root);
  }

  function openRestoreImport() {
    const root = ensureSheet();
    root.querySelector('.m2-settings-body').innerHTML = shell('Restaurar ou importar', 'Fluxos seguros de recuperação', `
      <section class="m2-widget-card">
        <p>Escolha um backup local para restaurar. O sistema pedirá confirmação antes de substituir seus dados.</p>
        <div class="m2-widget-actions">
          <button type="button" data-restore-import-file>Escolher arquivo</button>
          <button type="button" data-restore-create-backup>Criar backup antes</button>
        </div>
        <p class="m2-settings-status" role="status"></p>
      </section>`);
    root.querySelector('[data-profile-back]')?.addEventListener('click', () => renderHome(root));
    root.querySelector('[data-restore-import-file]')?.addEventListener('click', () => {
      document.getElementById('importInput')?.click();
      const status = root.querySelector('.m2-settings-status');
      if (status) status.textContent = 'Selecione o arquivo de backup para continuar.';
    });
    root.querySelector('[data-restore-create-backup]')?.addEventListener('click', () => global.createManualBackup?.());
  }

  async function openWidget() {
    const root = ensureSheet();
    root.querySelector('.m2-settings-body').innerHTML = shell('Widget para iPhone', 'Resumo financeiro no Scriptable', `<section class="m2-widget-card"><p data-widget-status>Consultando token...</p><div class="m2-widget-actions"><button type="button" data-widget-generate>Gerar widget</button><button type="button" data-widget-copy>Copiar código</button><button type="button" data-widget-revoke>Revogar token</button></div><ol><li>Instale o Scriptable no iPhone.</li><li>Crie um script e cole o código.</li><li>Adicione o widget Scriptable à tela inicial.</li></ol><p class="m2-settings-status" role="status"></p></section>`);
    root.querySelector('[data-profile-back]')?.addEventListener('click', () => renderHome(root));
    const refresh = async () => {
      const response = await fetch('/api/widget/token-status', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      const status = root.querySelector('[data-widget-status]');
      if (status) status.textContent = data.hasToken ? `Token ativo · ${data.tokenPreview || ''}` : 'Nenhum token ativo.';
      root.querySelector('[data-widget-copy]')?.toggleAttribute('disabled', !widgetToken);
      root.querySelector('[data-widget-revoke]')?.toggleAttribute('disabled', !data.hasToken);
    };
    root.querySelector('[data-widget-generate]')?.addEventListener('click', async () => {
      const response = await fetch('/api/widget/generate-token', { method: 'POST', credentials: 'same-origin', headers: global.getCsrfHeaders?.({ 'Content-Type': 'application/json', Accept: 'application/json' }) || { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await response.json().catch(() => ({}));
      widgetToken = response.ok ? String(data.token || '') : null;
      global.triggerHapticFeedback?.(response.ok ? 'success' : 'error');
      await refresh();
    });
    root.querySelector('[data-widget-copy]')?.addEventListener('click', async () => {
      if (!widgetToken) return;
      const response = await fetch(`/api/widget/script/latest?token=${encodeURIComponent(widgetToken)}`, { credentials: 'same-origin' });
      if (!response.ok) return global.triggerHapticFeedback?.('error');
      await navigator.clipboard.writeText(await response.text());
      root.querySelector('.m2-settings-status').textContent = 'Código copiado para o Scriptable.';
      global.triggerHapticFeedback?.('success');
    });
    root.querySelector('[data-widget-revoke]')?.addEventListener('click', async () => {
      const response = await fetch('/api/widget/revoke-token', { method: 'POST', credentials: 'same-origin', headers: global.getCsrfHeaders?.({ 'Content-Type': 'application/json', Accept: 'application/json' }) || { 'Content-Type': 'application/json' }, body: '{}' });
      if (response.ok) widgetToken = null;
      global.triggerHapticFeedback?.(response.ok ? 'success' : 'error');
      await refresh();
    });
    await refresh().catch(() => {});
  }

  function runAction(action) {
    global.triggerHapticFeedback?.('selection');
    if (action === 'edit-profile') return openProfileEditor();
    if (action === 'security') return openSecurity();
    if (action === 'preferences') return openPreferencesLite();
    if (action === 'restore') return openRestoreImport();
    if (action === 'widget') return openWidget();
    if (action === 'toggle-theme') {
      const next = document.documentElement.getAttribute('data-theme') !== 'dark';
      global.toggleThemePreference?.(next);
      return renderHome(ensureSheet());
    }
    if (action === 'integrity') return global.runIntegrityCheck?.(true);
    if (action === 'reset-ui') return global.resetUIState?.();
    if (action === 'tutorial') { close(); return global.MobileV2Onboarding?.openWelcome?.(); }
    close();
    setTimeout(() => {
      if (action === 'banking') return global.MobileV2?.openInternetBanking?.();
      if (action === 'backup') return global.createManualBackup?.();
      if (action === 'about') return global.openHelpModal?.();
      if (action === 'logout') return global.logout?.();
    }, 100);
  }

  global.MobileV2PerfilSheet = { ensureSheet, open, close, runAction, openProfileEditor, openWidget };
})(window);
