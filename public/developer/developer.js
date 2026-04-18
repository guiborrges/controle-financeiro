let developerState = {
  users: [],
  metrics: null,
  selectedUserId: '',
  backupsByUser: {},
  logsByUser: {},
  dataStatusByUser: {}
};

function developerHeaders(extra = {}) {
  const token = window.__CSRF_TOKEN__ || '';
  return token ? { ...extra, 'X-CSRF-Token': token } : { ...extra };
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function getStatusLabel(status) {
  if (status === 'ok') return 'Integro';
  if (status === 'alert') return 'Com alerta';
  return 'Corrompido';
}

function setDeveloperPasswordStatus(message = '', tone = 'muted') {
  const el = document.getElementById('devPasswordStatus');
  if (!el) return;
  el.textContent = message;
  el.style.color = tone === 'error'
    ? 'var(--red)'
    : tone === 'success'
      ? 'var(--green)'
      : 'var(--text-soft)';
}

function toggleDeveloperPasswordPanel(forceState) {
  const panel = document.getElementById('devPasswordPanel');
  if (!panel) return;
  const shouldShow = typeof forceState === 'boolean' ? forceState : !!panel.hidden;
  panel.hidden = !shouldShow;
  if (shouldShow) {
    window.setTimeout(() => document.getElementById('devCurrentPassword')?.focus(), 20);
  }
}

function getBackupTypeLabel(type) {
  return type === 'automatic' ? 'Backup automatico' : 'Backup manual';
}

function getLogActionLabel(action) {
  const labels = {
    backup_created: 'Backup criado',
    backup_revalidated: 'Backup revalidado',
    backup_restored: 'Backup restaurado',
    backup_pruned: 'Backup removido',
    restore_blocked: 'Restauracao bloqueada',
    backup_failed: 'Falha de backup'
  };
  return labels[action] || 'Evento tecnico';
}

async function ensureDeveloperSession() {
  const response = await fetch('/api/developer/session', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) {
    window.location.replace('/login');
    return null;
  }
  const payload = await response.json();
  window.__CSRF_TOKEN__ = payload.csrfToken || '';
  return payload;
}

async function reloadDeveloperData() {
  await ensureDeveloperSession();
  const response = await fetch('/api/developer/users', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) return;
  const payload = await response.json();
  developerState.users = Array.isArray(payload.users) ? payload.users : [];
  developerState.metrics = payload.metrics || null;
  renderDeveloperMetrics();
  renderDeveloperUsers();
  const existing = developerState.users.some(user => user.id === developerState.selectedUserId);
  if (!existing) developerState.selectedUserId = developerState.users[0]?.id || '';
  if (developerState.selectedUserId) {
    await loadDeveloperUserDetails(developerState.selectedUserId);
  } else {
    renderDeveloperDetails();
  }
}

function getFilteredUsers() {
  const search = (document.getElementById('devSearchInput')?.value || '').trim().toLowerCase();
  const status = document.getElementById('devStatusFilter')?.value || 'all';
  const recent = Number(document.getElementById('devRecentFilter')?.value || 'all');
  const sortBy = document.getElementById('devSortSelect')?.value || 'lastUsedAt';

  const filtered = developerState.users.filter(user => {
    if (status !== 'all' && user.dataStatus !== status) return false;
    if (Number.isFinite(recent) && recent > 0) {
      const lastUsed = Date.parse(user.lastUsedAt || '');
      if (!lastUsed || (Date.now() - lastUsed) > (recent * 24 * 60 * 60 * 1000)) return false;
    }
    if (search) {
      const haystack = [
        user.fullName,
        user.username,
        user.email,
        user.phone
      ].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'dataStatus') {
      const order = { corrupted: 0, alert: 1, ok: 2 };
      return (order[a.dataStatus] ?? 9) - (order[b.dataStatus] ?? 9);
    }
    if (sortBy === 'loginCount') {
      return Number(b.loginCount || 0) - Number(a.loginCount || 0);
    }
    return (Date.parse(b[sortBy] || '') || 0) - (Date.parse(a[sortBy] || '') || 0);
  });

  return filtered;
}

function renderDeveloperMetrics() {
  const wrap = document.getElementById('devMetrics');
  const metrics = developerState.metrics || {
    totalUsers: 0,
    activeRecently: 0,
    usersWithErrors: 0,
    usersWithAlerts: 0,
    totalBackups: 0
  };

  wrap.innerHTML = `
    <article class="dev-metric"><span>Total de usuarios</span><strong>${metrics.totalUsers}</strong></article>
    <article class="dev-metric"><span>Ativos recentemente</span><strong>${metrics.activeRecently}</strong></article>
    <article class="dev-metric"><span>Usuarios com erro</span><strong>${metrics.usersWithErrors}</strong></article>
    <article class="dev-metric"><span>Total de backups</span><strong>${metrics.totalBackups}</strong></article>
  `;
}

function renderDeveloperUsers() {
  const users = getFilteredUsers();
  const body = document.getElementById('devUsersBody');
  const countLabel = document.getElementById('devUserCountLabel');
  countLabel.textContent = `${users.length} usuario(s) exibido(s)`;

  if (!users.length) {
    body.innerHTML = `<tr><td colspan="8">Nenhum usuario encontrado com os filtros atuais.</td></tr>`;
    return;
  }

  body.innerHTML = users.map(user => `
    <tr class="dev-user-row ${user.id === developerState.selectedUserId ? 'is-active' : ''}" data-user-id="${user.id}">
      <td><strong>${escapeHtml(user.fullName || '-')}</strong></td>
      <td>${escapeHtml(user.email || '-')}</td>
      <td>${escapeHtml(user.phone || '-')}</td>
      <td>${formatDateTime(user.createdAt)}</td>
      <td>${formatDateTime(user.lastUsedAt)}</td>
      <td>${Number(user.loginCount || 0)}</td>
      <td><span class="dev-status status-${user.dataStatus}"><span class="dev-status-dot"></span>${getStatusLabel(user.dataStatus)}</span></td>
      <td>${Number(user.backupCount || 0)}</td>
    </tr>
  `).join('');

  body.querySelectorAll('.dev-user-row').forEach(row => {
    row.addEventListener('click', () => {
      developerState.selectedUserId = row.dataset.userId || '';
      renderDeveloperUsers();
      loadDeveloperUserDetails(developerState.selectedUserId);
    });
  });
}

async function loadDeveloperUserDetails(userId) {
  const response = await fetch(`/api/developer/users/${encodeURIComponent(userId)}/backups`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) return;
  const payload = await response.json();
  developerState.backupsByUser[userId] = payload.backups || [];
  developerState.logsByUser[userId] = payload.logs || [];
  developerState.dataStatusByUser[userId] = payload.dataStatus || null;
  developerState.selectedUser = payload.user || null;
  renderDeveloperDetails();
}

function renderDeveloperDetails() {
  const detail = document.getElementById('devUserDetail');
  const backupsWrap = document.getElementById('devBackupsList');
  const logsWrap = document.getElementById('devLogsList');
  const title = document.getElementById('devSelectedUserLabel');
  const user = developerState.selectedUser;

  if (!user) {
    detail.innerHTML = 'Nenhum usuario selecionado.';
    backupsWrap.innerHTML = 'Selecione um usuario para listar os backups.';
    logsWrap.innerHTML = 'Nenhum log disponivel.';
    title.textContent = 'Selecione um usuario';
    return;
  }

  title.textContent = user.fullName || user.email || 'Usuario';
  const integrity = developerState.dataStatusByUser[user.id] || { status: 'alert', message: '' };
  detail.innerHTML = `
    <div class="dev-detail">
      <div class="dev-detail-grid">
        <div class="dev-detail-item"><span>Nome completo</span><strong>${escapeHtml(user.fullName || '-')}</strong></div>
        <div class="dev-detail-item"><span>E-mail</span><strong>${escapeHtml(user.email || '-')}</strong></div>
        <div class="dev-detail-item"><span>Telefone</span><strong>${escapeHtml(user.phone || '-')}</strong></div>
        <div class="dev-detail-item"><span>Criado em</span><strong>${formatDateTime(user.createdAt)}</strong></div>
        <div class="dev-detail-item"><span>Ultimo uso</span><strong>${formatDateTime(user.lastUsedAt)}</strong></div>
        <div class="dev-detail-item"><span>Quantidade de logins</span><strong>${Number(user.loginCount || 0)}</strong></div>
        <div class="dev-detail-item"><span>Ultima restauracao</span><strong>${formatDateTime(user.lastRestoreAt)}</strong></div>
      </div>
      <div class="dev-detail-item">
        <span>Status do arquivo</span>
        <strong class="dev-status status-${integrity.status}"><span class="dev-status-dot"></span>${getStatusLabel(integrity.status)}</strong>
        <p class="dev-panel-subtitle">${escapeHtml(integrity.message || '')}</p>
      </div>
    </div>
  `;

  const backups = developerState.backupsByUser[user.id] || [];
  if (!backups.length) {
    backupsWrap.innerHTML = '<div class="dev-detail-empty">Nenhum backup disponivel para este usuario.</div>';
  } else {
    backupsWrap.innerHTML = `<div class="dev-backup-list">${backups.map(backup => `
      <details class="dev-event-card">
        <summary class="dev-event-summary">
          <div class="dev-event-main">
            <strong>${escapeHtml(getBackupTypeLabel(backup.type))}</strong>
            <span class="dev-event-time">${formatDateTime(backup.createdAt)}</span>
          </div>
          <div class="dev-event-side">
            <span class="dev-status status-${backup.integrityStatus}"><span class="dev-status-dot"></span>${getStatusLabel(backup.integrityStatus)}</span>
          </div>
        </summary>
        <div class="dev-event-body">
          <div class="dev-backup-meta">
            <span>Tamanho: ${formatFileSize(backup.size)}</span>
            <span>Versao: ${escapeHtml(backup.version || '-')}</span>
            <span>Ultima restauracao: ${formatDateTime(backup.restoredAt)}</span>
          </div>
          <div class="dev-backup-meta">
            <span>Observacao: ${escapeHtml(backup.note || '-')}</span>
            <span>Checksum: ${escapeHtml(backup.checksum || '-')}</span>
          </div>
          <div class="dev-backup-actions">
            <button class="dev-mini-btn" type="button" onclick="revalidateSelectedBackup('${user.id}', '${backup.id}')">Revalidar</button>
            <button class="dev-mini-btn danger" type="button" onclick="restoreSelectedBackup('${user.id}', '${backup.id}')">Restaurar</button>
          </div>
        </div>
      </details>
    `).join('')}</div>`;
  }

  const logs = developerState.logsByUser[user.id] || [];
  if (!logs.length) {
    logsWrap.innerHTML = '<div class="dev-detail-empty">Nenhum log disponivel.</div>';
  } else {
    logsWrap.innerHTML = `<div class="dev-log-list">${logs.map(log => `
      <details class="dev-event-card">
        <summary class="dev-event-summary">
          <div class="dev-event-main">
            <strong>${escapeHtml(getLogActionLabel(log.action || 'evento'))}</strong>
            <span class="dev-event-time">${formatDateTime(log.createdAt)}</span>
          </div>
          <div class="dev-event-side">
            <span class="dev-status status-${log.integrityStatus || 'alert'}"><span class="dev-status-dot"></span>${getStatusLabel(log.integrityStatus || 'alert')}</span>
          </div>
        </summary>
        <div class="dev-event-body">
          <div class="dev-backup-meta">
            <span>Backup: ${escapeHtml(log.backupId || '-')}</span>
            <span>Origem: ${escapeHtml(log.backupType || '-')}</span>
            <span>Status: ${escapeHtml(log.integrityStatus || '-')}</span>
          </div>
          <div class="dev-panel-subtitle">${escapeHtml(log.note || '')}</div>
        </div>
      </details>
    `).join('')}</div>`;
  }
}

async function revalidateSelectedBackup(userId, backupId) {
  const response = await fetch(`/api/developer/users/${encodeURIComponent(userId)}/backups/${encodeURIComponent(backupId)}/revalidate`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: developerHeaders({ Accept: 'application/json' })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    alert(payload.message || 'Nao foi possivel revalidar o backup.');
    return;
  }
  await loadDeveloperUserDetails(userId);
  await reloadDeveloperData();
}

async function restoreSelectedBackup(userId, backupId) {
  const confirmed = confirm('Tem certeza que deseja restaurar este backup? O estado atual do usuario sera substituido e um backup preventivo sera criado antes da restauracao.');
  if (!confirmed) return;

  const response = await fetch(`/api/developer/users/${encodeURIComponent(userId)}/backups/${encodeURIComponent(backupId)}/restore`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: developerHeaders({ Accept: 'application/json' })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    alert(payload.message || 'Nao foi possivel restaurar o backup.');
    return;
  }
  await loadDeveloperUserDetails(userId);
  await reloadDeveloperData();
}

async function logoutDeveloper() {
  await fetch('/api/developer/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: developerHeaders({ Accept: 'application/json' })
  }).catch(() => null);
  window.location.replace('/login');
}

async function changeDeveloperPassword(event) {
  event.preventDefault();
  const currentPassword = document.getElementById('devCurrentPassword')?.value || '';
  const newPassword = document.getElementById('devNewPassword')?.value || '';
  const confirmPassword = document.getElementById('devConfirmPassword')?.value || '';

  setDeveloperPasswordStatus('Salvando nova senha...', 'muted');
  const response = await fetch('/api/developer/change-password', {
    method: 'POST',
    credentials: 'same-origin',
    headers: developerHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    setDeveloperPasswordStatus(payload.message || 'Nao foi possivel alterar a senha do admin.', 'error');
    return;
  }

  ['devCurrentPassword', 'devNewPassword', 'devConfirmPassword'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
  setDeveloperPasswordStatus('Senha do admin atualizada com sucesso.', 'success');
  toggleDeveloperPasswordPanel(false);
}

async function exportDeveloperReport() {
  const response = await fetch('/api/developer/report', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) return;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'relatorio-tecnico.json';
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

['devSearchInput', 'devStatusFilter', 'devRecentFilter', 'devSortSelect'].forEach(id => {
  document.addEventListener('DOMContentLoaded', () => {
    const element = document.getElementById(id);
    if (element) element.addEventListener('input', renderDeveloperUsers);
    if (element) element.addEventListener('change', renderDeveloperUsers);
  });
});

document.addEventListener('DOMContentLoaded', async () => {
  await reloadDeveloperData();
});
