const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { writeJsonFileAtomic } = require('./fs-atomic');

const pkg = require('../package.json');
const { getUserDataPath, getDesiredUserDataDir } = require('./app-state-store');
const { readUsersStore, findUserById, updateUser } = require('./user-store');
const { resolveStoragePath } = require('./paths');

const USER_BACKUP_ROOT = resolveStoragePath('data', 'user-backups');
const MAX_BACKUPS_PER_USER = Math.max(0, Number(process.env.FIN_MAX_BACKUPS_PER_USER || 0) || 0);
const MAX_LOG_ENTRIES = 80;
const BACKUP_ID_PATTERN = /^[a-zA-Z0-9_-]{6,120}$/;

function ensureBackupRoot() {
  fs.mkdirSync(USER_BACKUP_ROOT, { recursive: true });
}

function sanitizeSegment(value) {
  return String(value || '')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '') || 'Usuario';
}

function getUserBackupDir(user) {
  ensureBackupRoot();
  const expectedSuffix = `__${String(user?.id || 'sem-id')}`;
  const existingDir = fs.readdirSync(USER_BACKUP_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.endsWith(expectedSuffix))
    .map(entry => path.join(USER_BACKUP_ROOT, entry.name))[0];
  if (existingDir) return existingDir;

  const label = sanitizeSegment(user?.fullName || user?.displayName || user?.email || user?.id || 'Usuario');
  return path.join(USER_BACKUP_ROOT, `${label}${expectedSuffix}`);
}

function getUserBackupIndexPath(user) {
  return path.join(getUserBackupDir(user), 'index.json');
}

function getBackupItemDir(user, backupId) {
  return path.join(getUserBackupDir(user), 'items', validateBackupId(backupId));
}

function validateBackupId(backupId) {
  const safeId = String(backupId || '').trim();
  if (!safeId || !BACKUP_ID_PATTERN.test(safeId)) {
    throw new Error('Identificador de backup inválido.');
  }
  return safeId;
}

function ensureUserBackupDir(user) {
  const userDir = getUserBackupDir(user);
  fs.mkdirSync(path.join(userDir, 'items'), { recursive: true });
  return userDir;
}

function readJsonSafe(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readBackupIndex(user) {
  ensureUserBackupDir(user);
  const filePath = getUserBackupIndexPath(user);
  const parsed = readJsonSafe(filePath, null);
  if (!parsed || typeof parsed !== 'object') {
    return { backups: [], logs: [] };
  }
  return {
    backups: Array.isArray(parsed.backups) ? parsed.backups : [],
    logs: Array.isArray(parsed.logs) ? parsed.logs : []
  };
}

function writeBackupIndex(user, index) {
  ensureUserBackupDir(user);
  const filePath = getUserBackupIndexPath(user);
  const normalized = {
    backups: Array.isArray(index?.backups) ? index.backups : [],
    logs: Array.isArray(index?.logs) ? index.logs.slice(-MAX_LOG_ENTRIES) : []
  };
  writeJsonFileAtomic(filePath, normalized);
}

function appendBackupLog(user, entry) {
  const index = readBackupIndex(user);
  index.logs.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...entry
  });
  writeBackupIndex(user, index);
}

function computeFileChecksum(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function validateBackupStateFile(filePath, expectedUserId = '') {
  if (!fs.existsSync(filePath)) {
    return { status: 'corrupted', message: 'Arquivo ausente.', checksum: '', size: 0 };
  }

  const size = getFileSize(filePath);
  const checksum = computeFileChecksum(filePath);
  const parsed = readJsonSafe(filePath, null);
  if (!parsed || typeof parsed !== 'object') {
    return { status: 'corrupted', message: 'JSON invalido.', checksum, size };
  }
  if (expectedUserId && parsed.userId && parsed.userId !== expectedUserId) {
    return { status: 'corrupted', message: 'Backup pertence a outro usuario.', checksum, size };
  }
  if (!parsed.userId || !parsed.updatedAt || !Object.prototype.hasOwnProperty.call(parsed, 'state')) {
    return { status: 'corrupted', message: 'Estrutura minima ausente.', checksum, size };
  }
  const updatedAtMs = Date.parse(String(parsed.updatedAt || ''));
  if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) {
    return { status: 'corrupted', message: 'updatedAt invalido.', checksum, size };
  }
  const monthCount = Number(parsed.monthCount || 0);
  if (!Number.isFinite(monthCount) || monthCount < 0) {
    return { status: 'corrupted', message: 'monthCount invalido.', checksum, size };
  }
  if (!parsed.schemaVersion || typeof parsed.schemaVersion !== 'string') {
    return { status: 'corrupted', message: 'schemaVersion ausente.', checksum, size };
  }
  if (typeof parsed.encrypted !== 'boolean') {
    return { status: 'corrupted', message: 'Flag encrypted invalida.', checksum, size };
  }
  if (parsed.encrypted === true) {
    if (typeof parsed.state !== 'string' || !parsed.state.startsWith('enc$')) {
      return { status: 'corrupted', message: 'Payload criptografado invalido.', checksum, size };
    }
    return { status: 'ok', message: 'Backup valido.', checksum, size };
  }
  if (parsed.encrypted === false && parsed.state && typeof parsed.state === 'object' && !Array.isArray(parsed.state)) {
    if (!Array.isArray(parsed.state.finData)) {
      return { status: 'corrupted', message: 'Estado legivel sem finData.', checksum, size };
    }
    return { status: 'ok', message: 'Backup valido.', checksum, size };
  }
  return { status: 'corrupted', message: 'Formato de estado nao reconhecido.', checksum, size };
}

function assertBackupBelongsToUser(user, backupId) {
  const safeBackupId = validateBackupId(backupId);
  const backupDir = getBackupItemDir(user, safeBackupId);
  const resolvedUserDir = path.resolve(getUserBackupDir(user));
  const resolvedBackupDir = path.resolve(backupDir);
  if (!resolvedBackupDir.startsWith(`${resolvedUserDir}${path.sep}`) && resolvedBackupDir !== resolvedUserDir) {
    throw new Error('Caminho de backup inválido para este usuário.');
  }
  const filePath = path.join(backupDir, 'state.json');
  const parsed = readJsonSafe(filePath, null);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup invalido ou ausente.');
  }
  if (!parsed.userId || parsed.userId !== user.id) {
    appendBackupLog(user, {
      action: 'restore_blocked',
      backupId: safeBackupId,
      integrityStatus: 'corrupted',
      note: 'Operacao bloqueada porque o backup nao pertence ao usuario selecionado.'
    });
    throw new Error('Este backup nao pertence ao usuario selecionado.');
  }
  return { backupDir, filePath, parsed, backupId: safeBackupId };
}

function normalizeBackupMeta(backup) {
  return {
    id: backup.id,
    createdAt: backup.createdAt || '',
    type: backup.type || 'manual',
    note: backup.note || '',
    checksum: backup.checksum || '',
    size: Number(backup.size || 0),
    version: backup.version || pkg.version || '1.0.0',
    integrityStatus: backup.integrityStatus || 'alert',
    integrityMessage: backup.integrityMessage || '',
    restoredAt: backup.restoredAt || '',
    path: backup.path || ''
  };
}

function toClientBackupMeta(backup) {
  const normalized = normalizeBackupMeta(backup);
  const { path: filePath, ...safeBackup } = normalized;
  return safeBackup;
}

function listUserBackups(userId) {
  const user = findUserById(userId);
  if (!user) return [];
  const index = readBackupIndex(user);
  const nextBackups = index.backups.map(item => {
    const backup = normalizeBackupMeta(item);
    const filePath = path.join(getBackupItemDir(user, backup.id), 'state.json');
    const integrity = validateBackupStateFile(filePath, user.id);
    return {
      ...backup,
      checksum: integrity.checksum,
      size: integrity.size,
      integrityStatus: integrity.status,
      integrityMessage: integrity.message,
      path: filePath
    };
  }).sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));

  if (JSON.stringify(nextBackups) !== JSON.stringify(index.backups)) {
    index.backups = nextBackups.map(item => {
      const { path: filePath, ...rest } = item;
      return rest;
    });
    writeBackupIndex(user, index);
  }

  return nextBackups;
}

function pruneOldBackups(user) {
  const backups = listUserBackups(user.id);
  if (MAX_BACKUPS_PER_USER <= 0) return backups;
  if (backups.length <= MAX_BACKUPS_PER_USER) return backups;
  const sorted = backups.slice().sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
  const keep = sorted.slice(0, MAX_BACKUPS_PER_USER);
  const remove = sorted.slice(MAX_BACKUPS_PER_USER);
  remove.forEach(item => {
    try {
      fs.rmSync(getBackupItemDir(user, item.id), { recursive: true, force: true });
      appendBackupLog(user, {
        action: 'backup_pruned',
        backupId: item.id,
        backupType: item.type,
        integrityStatus: item.integrityStatus,
        note: `Backup removido automaticamente por exceder o limite de ${MAX_BACKUPS_PER_USER} itens.`
      });
    } catch {}
  });
  const index = readBackupIndex(user);
  index.backups = keep.map(item => {
    const { path: filePath, ...rest } = item;
    return rest;
  });
  writeBackupIndex(user, index);
  return keep;
}

function createUserBackup(userId, options = {}) {
  const user = findUserById(userId);
  if (!user) throw new Error('Usuario nao encontrado.');

  const sourcePath = getUserDataPath(user.id);
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Nenhum estado atual foi encontrado para backup.');
  }

  ensureUserBackupDir(user);
  const backupId = crypto.randomUUID();
  const backupDir = getBackupItemDir(user, backupId);
  fs.mkdirSync(backupDir, { recursive: true });

  const targetStatePath = path.join(backupDir, 'state.json');
  fs.copyFileSync(sourcePath, targetStatePath);

  const integrity = validateBackupStateFile(targetStatePath, user.id);
  const backup = normalizeBackupMeta({
    id: backupId,
    createdAt: new Date().toISOString(),
    type: options.type || 'manual',
    note: options.note || '',
    checksum: integrity.checksum,
    size: integrity.size,
    version: pkg.version || '1.0.0',
    integrityStatus: integrity.status,
    integrityMessage: integrity.message,
    restoredAt: '',
    path: targetStatePath
  });

  const index = readBackupIndex(user);
  index.backups.push({
    ...backup,
    path: undefined
  });
  writeBackupIndex(user, index);

  appendBackupLog(user, {
    action: 'backup_created',
    backupId,
    backupType: backup.type,
    integrityStatus: backup.integrityStatus,
    note: backup.note
  });

  updateUser(user.id, {
    backupStats: {
      ...(user.backupStats || {}),
      lastBackupAt: backup.createdAt,
      lastBackupType: backup.type,
      loginsSinceBackup: 0
    }
  });

  pruneOldBackups(user);
  return backup;
}

function maybeCreateAutomaticBackup(userId) {
  const user = findUserById(userId);
  if (!user) return null;
  const stats = {
    loginCount: Number(user?.loginCount || 0),
    loginsSinceBackup: Number(user?.backupStats?.loginsSinceBackup || 0)
  };
  if (stats.loginsSinceBackup < 2) return null;
  try {
    return createUserBackup(userId, {
      type: 'automatic',
      note: 'Backup automatico apos 2 logins.'
    });
  } catch (error) {
    appendBackupLog(user, {
      action: 'backup_failed',
      backupType: 'automatic',
      integrityStatus: 'corrupted',
      note: error.message || 'Falha ao criar backup automatico.'
    });
    return null;
  }
}

function registerUserLogin(userId) {
  const user = findUserById(userId);
  if (!user) return null;
  const nextStats = {
    ...(user.backupStats || {}),
    loginsSinceBackup: Number(user?.backupStats?.loginsSinceBackup || 0) + 1
  };
  const nextUser = updateUser(userId, {
    loginCount: Number(user?.loginCount || 0) + 1,
    lastLoginAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    backupStats: nextStats
  });
  maybeCreateAutomaticBackup(userId);
  return nextUser;
}

function touchUserActivity(userId) {
  const user = findUserById(userId);
  if (!user) return null;
  return updateUser(userId, { lastUsedAt: new Date().toISOString() });
}

function getUserBackupLogs(userId) {
  const user = findUserById(userId);
  if (!user) return [];
  const index = readBackupIndex(user);
  return index.logs.slice().sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
}

function getUserDataIntegrity(userId) {
  const user = findUserById(userId);
  if (!user) {
    return { status: 'corrupted', message: 'Usuario nao encontrado.', fileSize: 0, checksum: '' };
  }
  const currentPath = getUserDataPath(user.id);
  return validateBackupStateFile(currentPath, user.id);
}

function revalidateBackup(userId, backupId) {
  const user = findUserById(userId);
  if (!user) throw new Error('Usuario nao encontrado.');
  const { filePath, backupId: safeBackupId } = assertBackupBelongsToUser(user, backupId);
  const integrity = validateBackupStateFile(filePath, user.id);
  const index = readBackupIndex(user);
  index.backups = index.backups.map(item => item.id === safeBackupId ? {
    ...item,
    checksum: integrity.checksum,
    size: integrity.size,
    integrityStatus: integrity.status,
    integrityMessage: integrity.message
  } : item);
  writeBackupIndex(user, index);
  appendBackupLog(user, {
    action: 'backup_revalidated',
    backupId: safeBackupId,
    integrityStatus: integrity.status,
    note: integrity.message
  });
  return integrity;
}

function restoreUserBackup(userId, backupId) {
  const user = findUserById(userId);
  if (!user) throw new Error('Usuario nao encontrado.');
  const { filePath: sourceFile, backupId: safeBackupId } = assertBackupBelongsToUser(user, backupId);

  const availableBackups = listUserBackups(user.id);
  const selected = availableBackups.find(item => item.id === safeBackupId);
  if (!selected) throw new Error('Backup nao encontrado.');
  if (selected.integrityStatus !== 'ok') {
    appendBackupLog(user, {
      action: 'restore_blocked',
      backupId: safeBackupId,
      backupType: selected.type,
      integrityStatus: selected.integrityStatus,
      note: 'Restauracao bloqueada porque o backup nao esta integro.'
    });
    throw new Error('O backup selecionado nao esta integro e nao pode ser restaurado.');
  }

  const safetyBackup = createUserBackup(user.id, {
    type: 'automatic',
    note: 'Backup criado antes da restauracao.'
  });

  const targetFile = getUserDataPath(user.id);
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.copyFileSync(sourceFile, targetFile);
  const restoredIntegrity = validateBackupStateFile(targetFile, user.id);
  if (restoredIntegrity.status !== 'ok') {
    throw new Error('Falha de integridade apos restauracao do backup.');
  }
  if (restoredIntegrity.checksum !== selected.checksum) {
    throw new Error('Checksum divergente apos restauracao do backup.');
  }

  const restoredAt = new Date().toISOString();
  const index = readBackupIndex(user);
  index.backups = index.backups.map(item => item.id === safeBackupId ? {
    ...item,
    restoredAt
  } : item);
  index.logs.push({
    id: crypto.randomUUID(),
    action: 'backup_restored',
    backupId: safeBackupId,
    createdAt: restoredAt,
    backupType: selected.type,
    integrityStatus: selected.integrityStatus,
    note: `Restauracao concluida. Backup de seguranca: ${safetyBackup.id}.`
  });
  writeBackupIndex(user, index);
  updateUser(user.id, { lastRestoreAt: restoredAt });
  return { restoredAt, backup: selected };
}

function buildDeveloperUserSummary(user) {
  const integrity = getUserDataIntegrity(user.id);
  const backups = listUserBackups(user.id);
  const logs = getUserBackupLogs(user.id);
  return {
    id: user.id,
    fullName: user.fullName || user.displayName || user.username,
    username: user.username || '',
    email: user.email || '',
    phone: user.phone || '',
    createdAt: user.createdAt || '',
    lastUsedAt: user.lastUsedAt || '',
    lastLoginAt: user.lastLoginAt || '',
    loginCount: Number(user.loginCount || 0),
    lastRestoreAt: user.lastRestoreAt || '',
    dataStatus: integrity.status,
    dataStatusMessage: integrity.message,
    backupCount: backups.length,
    lastBackupAt: user?.backupStats?.lastBackupAt || '',
    lastBackupType: user?.backupStats?.lastBackupType || '',
    canAccessESO: !!user.permissions?.canAccessESO,
    recentLogs: logs.slice(0, 10)
  };
}

function listDeveloperUsers() {
  const store = readUsersStore();
  return (store.users || []).map(buildDeveloperUserSummary);
}

module.exports = {
  USER_BACKUP_ROOT,
  listUserBackups,
  getUserBackupLogs,
  createUserBackup,
  registerUserLogin,
  touchUserActivity,
  getUserDataIntegrity,
  revalidateBackup,
  restoreUserBackup,
  listDeveloperUsers,
  buildDeveloperUserSummary,
  toClientBackupMeta
};
