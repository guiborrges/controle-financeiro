let currentSession = null;
let profileCache = null;

function buildOperationToken(prefix = 'op') {
  const safePrefix = String(prefix || 'op').replace(/\s+/g, '-').toLowerCase();
  return `${safePrefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function applySessionPermissions(session) {
  const esoNav = document.getElementById('esoNavItem');
  const canAccessESO = !!session?.permissions?.canAccessESO;
  if (esoNav) esoNav.style.display = canAccessESO ? '' : 'none';
  if (!canAccessESO && activePage === 'eso') {
    nav('dashboard');
  }
}

function formatProfileBirthDateTyping(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function setProfileStatus(message = '', tone = 'muted') {
  const el = document.getElementById('profileStatus');
  if (!el) return;
  el.textContent = message;
  el.style.color = tone === 'error' ? 'var(--red)' : tone === 'success' ? 'var(--green)' : 'var(--text2)';
}

function setPasswordStatus(message = '', tone = 'muted') {
  const el = document.getElementById('passwordStatus');
  if (!el) return;
  el.textContent = message;
  el.style.color = tone === 'error' ? 'var(--red)' : tone === 'success' ? 'var(--green)' : 'var(--text2)';
}

function setDeleteAccountStatus(message = '', tone = 'muted') {
  const el = document.getElementById('deleteAccountStatus');
  if (!el) return;
  el.textContent = message;
  el.style.color = tone === 'error' ? 'var(--red)' : tone === 'success' ? 'var(--green)' : 'var(--text2)';
}

function setManualBackupStatus(message = '', tone = 'muted') {
  const el = document.getElementById('manualBackupStatus');
  if (!el) return;
  el.textContent = message;
  el.style.color = tone === 'error' ? 'var(--red)' : tone === 'success' ? 'var(--green)' : 'var(--text2)';
}

async function syncSessionUser() {
  try {
    if (window.__APP_BOOTSTRAP__?.session) {
      currentSession = window.__APP_BOOTSTRAP__.session;
    } else {
    const response = await fetch('/api/auth/session', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      window.location.replace('/login');
      return null;
    }
    currentSession = await response.json();
    }
    window.__CSRF_TOKEN__ = currentSession?.csrfToken || window.__CSRF_TOKEN__ || '';
    const userName = document.getElementById('sessionUserName');
    if (userName) userName.textContent = currentSession.displayName || currentSession.fullName || currentSession.username || 'Usuario';
    const profileShortcut = document.getElementById('profileShortcut');
    if (profileShortcut) profileShortcut.textContent = currentSession.displayName || currentSession.fullName || 'Dados da pessoa';
    applySessionPermissions(currentSession);
    return currentSession;
  } catch (error) {
    window.location.replace('/login');
    return null;
  }
}

async function initializeProfileState() {
  const session = await syncSessionUser();
  if (!session) return;
  try {
    await loadProfile();
    fillProfileForm(profileCache);
  } catch (error) {
    // Mantem o app funcional mesmo se o perfil falhar temporariamente.
  }
}

async function loadProfile() {
  if (window.__APP_BOOTSTRAP__?.profile) {
    profileCache = window.__APP_BOOTSTRAP__.profile;
    return profileCache;
  }
  const response = await fetch('/api/profile', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error('Nao foi possivel carregar os dados da pessoa.');
  profileCache = await response.json();
  return profileCache;
}

function fillProfileForm(profile) {
  const data = profile || {};
  const setValue = (id, value) => {
    const input = document.getElementById(id);
    if (input) input.value = value || '';
  };
  setValue('profileDisplayName', data.displayName);
  setValue('profileFullName', data.fullName);
  setValue('profileBirthDate', data.birthDate);
  setValue('profilePhone', data.phone);
  setValue('profileEmail', data.email);
  setValue('profileHint', data.passwordHint);
  const userName = document.getElementById('sessionUserName');
  if (userName) userName.textContent = data.displayName || data.fullName || currentSession?.displayName || 'Usuario';
  const profileShortcut = document.getElementById('profileShortcut');
  if (profileShortcut) profileShortcut.textContent = data.displayName || data.fullName || 'Dados da pessoa';
}

async function renderProfilePage(forceReload = false) {
  try {
    if (!profileCache || forceReload) {
      await loadProfile();
    }
    fillProfileForm(profileCache);
    setProfileStatus('');
  } catch (error) {
    setProfileStatus(error.message || 'Falha ao carregar os dados da pessoa.', 'error');
  }
}

async function saveProfile() {
  const payload = {
    displayName: document.getElementById('profileDisplayName')?.value || '',
    fullName: document.getElementById('profileFullName')?.value || '',
    birthDate: document.getElementById('profileBirthDate')?.value || '',
    phone: document.getElementById('profilePhone')?.value || '',
    email: document.getElementById('profileEmail')?.value || '',
    passwordHint: document.getElementById('profileHint')?.value || ''
  };

  const runner = typeof window.runExclusiveAction === 'function'
    ? window.runExclusiveAction
    : async (_k, handler) => { await handler(); return true; };
  await runner('profile:save', async () => {
    try {
      setProfileStatus('Salvando dados...', 'muted');
      const response = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: getCsrfHeaders({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Operation-Token': buildOperationToken('profile-save')
        }),
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProfileStatus(result.message || 'Nao foi possivel salvar os dados.', 'error');
        return;
      }
      profileCache = result.profile || payload;
      currentSession = {
        ...(currentSession || {}),
        displayName: profileCache.displayName || currentSession?.displayName,
        fullName: profileCache.fullName || currentSession?.fullName,
        email: profileCache.email || currentSession?.email,
        permissions: currentSession?.permissions || profileCache.permissions || {}
      };
      window.__APP_BOOTSTRAP__ = {
        ...(window.__APP_BOOTSTRAP__ || {}),
        session: currentSession,
        profile: profileCache
      };
      await renderProfilePage(true);
      setProfileStatus('Dados atualizados com sucesso.', 'success');
    } catch (error) {
      setProfileStatus('Falha ao salvar os dados da pessoa.', 'error');
    }
  });
}

async function changeUserPassword() {
  const currentPassword = document.getElementById('currentPassword')?.value || '';
  const newPassword = document.getElementById('newPassword')?.value || '';
  const confirmPassword = document.getElementById('confirmPassword')?.value || '';

  const runner = typeof window.runExclusiveAction === 'function'
    ? window.runExclusiveAction
    : async (_k, handler) => { await handler(); return true; };
  await runner('profile:change-password', async () => {
    try {
      const response = await fetch('/api/profile/change-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getCsrfHeaders({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Operation-Token': buildOperationToken('profile-change-password')
        }),
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPasswordStatus(result.message || 'Nao foi possivel alterar a senha.', 'error');
        return;
      }
      if (result?.crypto && window.FinCrypto?.deriveSessionKey) {
        const sessionKey = await window.FinCrypto.deriveSessionKey(newPassword, result.crypto);
        window.FinCrypto.storeSessionEncryptionKey(sessionKey);
      }
      ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
      });
      setPasswordStatus('Senha alterada com sucesso.', 'success');
    } catch (error) {
      setPasswordStatus('Falha ao alterar a senha.', 'error');
    }
  });
}

async function deleteAccount() {
  const password = document.getElementById('deleteAccountPassword')?.value || '';
  if (!password) {
    setDeleteAccountStatus('Digite sua senha atual para apagar a conta.', 'error');
    return;
  }

  const confirmed = confirm('Tem certeza que deseja apagar esta conta? Essa ação é permanente.');
  if (!confirmed) return;

  const runner = typeof window.runExclusiveAction === 'function'
    ? window.runExclusiveAction
    : async (_k, handler) => { await handler(); return true; };
  await runner('profile:delete-account', async () => {
    try {
      setDeleteAccountStatus('Apagando conta...', 'muted');
      const response = await fetch('/api/profile/delete-account', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getCsrfHeaders({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Operation-Token': buildOperationToken('profile-delete-account')
        }),
        body: JSON.stringify({ password })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDeleteAccountStatus(result.message || 'Nao foi possivel apagar a conta.', 'error');
        return;
      }
      setDeleteAccountStatus('Conta apagada com sucesso.', 'success');
      window.location.replace('/login');
    } catch (error) {
      setDeleteAccountStatus('Falha ao apagar a conta.', 'error');
    }
  });
}

async function createManualBackup() {
  const runner = typeof window.runExclusiveAction === 'function'
    ? window.runExclusiveAction
    : async (_k, handler) => { await handler(); return true; };
  await runner('profile:create-manual-backup', async () => {
    try {
      setManualBackupStatus('Criando backup...', 'muted');
      const response = await fetch('/api/backups/manual', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getCsrfHeaders({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Operation-Token': buildOperationToken('profile-manual-backup')
        }),
        body: JSON.stringify({ note: '' })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setManualBackupStatus(result.message || 'Nao foi possivel criar o backup.', 'error');
        return;
      }
      const createdAt = result?.backup?.createdAt ? new Date(result.backup.createdAt).toLocaleString('pt-BR') : 'agora';
      setManualBackupStatus(`Backup criado com sucesso em ${createdAt}.`, 'success');
      if (typeof showAppStatus === 'function') {
        showAppStatus('Backup manual criado com sucesso.', 'Backup criado', 'ok');
      }
    } catch (error) {
      setManualBackupStatus('Falha ao criar o backup.', 'error');
    }
  });
}

async function logout() {
  try {
    if (window.FinCrypto?.clearSessionEncryptionKey) {
      window.FinCrypto.clearSessionEncryptionKey();
    }
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: getCsrfHeaders({ 'Content-Type': 'application/json' })
    });
  } finally {
    window.location.replace('/login');
  }
}

document.addEventListener('input', event => {
  if (event.target?.id === 'profileBirthDate') {
    event.target.value = formatProfileBirthDateTyping(event.target.value);
  }
});

initializeProfileState();
