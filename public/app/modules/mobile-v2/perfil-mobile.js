(function initMobileV2PerfilSheet(global) {
  'use strict';

  let widgetToken = null;

  function icon(name, fallback = '›') {
    return global.SystemIcons?.render ? (global.SystemIcons.render(name) || fallback) : fallback;
  }

  function row(label, action, iconName, detail = '') {
    return `<button class="m2-settings-row" type="button" data-profile-action="${action}">
      <span class="m2-settings-icon" aria-hidden="true">${icon(iconName)}</span>
      <span class="m2-settings-copy"><strong>${label}</strong>${detail ? `<small>${detail}</small>` : ''}</span>
      <span class="m2-settings-chevron" aria-hidden="true">›</span>
    </button>`;
  }

  function shell(title, subtitle, body) {
    return `<div class="m2-settings-subview">
      <header class="m2-settings-subview-head">
        <button class="m2-icon-btn" type="button" data-profile-back aria-label="Voltar">&lt;</button>
        <div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
      </header>${body}
    </div>`;
  }

  function renderHome(root) {
    const session = global.__APP_BOOTSTRAP__?.session || {};
    const profile = global.__APP_BOOTSTRAP__?.profile || {};
    const name = String(profile.displayName || session.displayName || profile.fullName || session.fullName || 'Usuário');
    const email = String(profile.email || session.email || '');
    const initial = name.trim().slice(0, 1).toUpperCase() || 'U';
    const avatar = profile.avatarDataUrl
      ? `<img class="m2-settings-avatar" src="${profile.avatarDataUrl}" alt="Foto do perfil">`
      : `<span class="m2-settings-avatar">${initial}</span>`;
    root.querySelector('.m2-settings-body').innerHTML = `
      <section class="m2-settings-identity">
        ${avatar}
        <span><strong>${name}</strong><small>${email}</small></span>
      </section>
      <h3 class="m2-settings-group-title">Conta</h3>
      <section class="m2-settings-group">${row('Editar perfil', 'edit-profile', 'user', 'Nome, e-mail e dados pessoais')}${row('Segurança', 'security', 'lock', 'Senha e acesso')}</section>
      <h3 class="m2-settings-group-title">Sistema</h3>
      <section class="m2-settings-group">${row('Tema e interface', 'preferences', 'settings')}${row('Notificações', 'preferences', 'bell')}${row('Preferências', 'preferences', 'controls')}</section>
      <h3 class="m2-settings-group-title">Integrações</h3>
      <section class="m2-settings-group">${row('Internet Banking', 'banking', 'internetBanking')}${row('Widget para iPhone', 'widget', 'phone', 'Scriptable e token individual')}</section>
      <h3 class="m2-settings-group-title">Dados</h3>
      <section class="m2-settings-group">${row('Criar backup', 'backup', 'download')}${row('Restaurar ou importar', 'restore', 'upload')}</section>
      <h3 class="m2-settings-group-title">Ajuda</h3>
      <section class="m2-settings-group">${row('Tutorial inicial', 'tutorial', 'help')}${row('Sobre o Meufin', 'about', 'info')}</section>
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
    root.innerHTML = `<div class="bottom-sheet-scrim" data-close-perfil></div><div class="bottom-sheet-panel">
      <header class="m2-settings-main-head"><div><h2>Ajustes</h2><p>Conta, sistema e integrações</p></div><button class="m2-icon-btn" type="button" data-close-perfil aria-label="Fechar">&times;</button></header>
      <div class="m2-settings-body"></div></div>`;
    document.body.appendChild(root);
    root.setAttribute('hidden', 'hidden');
    root.style.display = 'none';
    root.querySelectorAll('[data-close-perfil]').forEach((el) => el.addEventListener('click', close));
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
    global.triggerHapticFeedback?.('light');
  }

  function close() {
    const root = document.getElementById('mobileV2PerfilSheet');
    if (!root) return;
    root.classList.remove('open');
    root.setAttribute('hidden', 'hidden');
    root.style.display = 'none';
  }

  async function openProfileEditor() {
    const root = ensureSheet();
    let profile = global.__APP_BOOTSTRAP__?.profile || {};
    try { profile = await global.loadProfile?.() || profile; } catch {}
    let editedAvatar = String(profile.avatarDataUrl || '');
    const avatarMarkup = editedAvatar
      ? `<img class="m2-settings-avatar large" data-profile-avatar-preview src="${editedAvatar}" alt="Foto do perfil">`
      : `<div class="m2-settings-avatar large" data-profile-avatar-preview>${String(profile.displayName || profile.fullName || 'U').slice(0, 1).toUpperCase()}</div>`;
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
        global.__APP_BOOTSTRAP__ = { ...(global.__APP_BOOTSTRAP__ || {}), profile: result.profile || payload, session: { ...(global.__APP_BOOTSTRAP__?.session || {}), displayName: result.profile?.displayName || payload.displayName, email: result.profile?.email || payload.email } };
        if (status) status.textContent = 'Perfil atualizado.';
        global.triggerHapticFeedback?.('success');
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
    if (action === 'widget') return openWidget();
    if (action === 'tutorial') { close(); return global.MobileV2Onboarding?.openWelcome?.(); }
    close();
    setTimeout(() => {
      if (action === 'preferences') return global.openPreferences?.();
      if (action === 'security') return global.openModal?.('modalRecovery');
      if (action === 'banking') return global.MobileV2?.openInternetBanking?.();
      if (action === 'backup') return global.createManualBackup?.();
      if (action === 'restore') return document.getElementById('importInput')?.click();
      if (action === 'about') return global.openHelpModal?.();
      if (action === 'logout') return global.logout?.();
    }, 100);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  global.MobileV2PerfilSheet = { ensureSheet, open, close, runAction, openProfileEditor, openWidget };
})(window);
