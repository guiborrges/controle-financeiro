const fs = require('fs');
const path = require('path');
const { writeJsonFileAtomic } = require('./fs-atomic');

const { findUserById, readUsersStore } = require('./user-store');
const { encryptDataWithKey, decryptDataWithKey } = require('./data-crypto');
const { resolveStoragePath } = require('./paths');
const { DEFAULT_FIN_STATE_SCHEMA_VERSION, resolveSchemaVersion } = require('./state-schema');

const USER_DATA_DIR = resolveStoragePath('data', 'users');
const DELETED_USER_BACKUP_DIR = resolveStoragePath('data', 'deleted-users');
const ORPHAN_USER_ARCHIVE_DIR = resolveStoragePath('migration-backups', 'orphan-user-state');
const parsedDeletedUserRetentionDays = Number(process.env.FIN_DELETED_USER_RETENTION_DAYS || 0);
const DELETED_USER_RETENTION_MS = Number.isFinite(parsedDeletedUserRetentionDays) && parsedDeletedUserRetentionDays > 0
  ? parsedDeletedUserRetentionDays * 24 * 60 * 60 * 1000
  : 0;

function ensureUserDataDir() {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}

function ensureDeletedUserBackupDir() {
  fs.mkdirSync(DELETED_USER_BACKUP_DIR, { recursive: true });
}

function getLegacyUserDataPath(userId) {
  ensureUserDataDir();
  return path.join(USER_DATA_DIR, `${userId}.json`);
}

function getLegacyUserDataDirById(userId) {
  ensureUserDataDir();
  return path.join(USER_DATA_DIR, String(userId || '').trim());
}

function sanitizeFolderSegment(value) {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  return cleaned || 'Usuario';
}

function buildUserFolderName(user, allUsers = []) {
  const baseName = sanitizeFolderSegment(
    user?.fullName ||
    user?.displayName ||
    String(user?.email || '').split('@')[0] ||
    user?.id ||
    'Usuario'
  );
  const sameBase = (allUsers || []).filter(other => {
    if (!other || other.id === user.id) return false;
    const otherBase = sanitizeFolderSegment(
      other.fullName ||
      other.displayName ||
      String(other.email || '').split('@')[0] ||
      other.id ||
      'Usuario'
    );
    return otherBase.toLowerCase() === baseName.toLowerCase();
  });
  if (!sameBase.length) return baseName;
  return `${baseName} (${String(user.id || '').slice(0, 8)})`;
}

function getDesiredUserDataDir(userId) {
  ensureUserDataDir();
  const user = findUserById(userId);
  if (!user) return getLegacyUserDataDirById(userId);
  const allUsers = readUsersStore().users || [];
  return path.join(USER_DATA_DIR, buildUserFolderName(user, allUsers));
}

function getUserDataPath(userId) {
  return path.join(getDesiredUserDataDir(userId), 'state.json');
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getStateMonthCount(payload) {
  if (Number.isFinite(payload?.monthCount)) return Number(payload.monthCount) || 0;
  return Array.isArray(payload?.state?.finData) ? payload.state.finData.length : 0;
}

function findExistingUserDataDir(userId) {
  const desiredDir = getDesiredUserDataDir(userId);
  const desiredFile = path.join(desiredDir, 'state.json');
  if (fs.existsSync(desiredFile)) return desiredDir;

  ensureUserDataDir();
  const entries = fs.readdirSync(USER_DATA_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'));
  for (const entry of entries) {
    const stateFile = path.join(USER_DATA_DIR, entry.name, 'state.json');
    if (!fs.existsSync(stateFile)) continue;
    const parsed = safeReadJson(stateFile);
    if (parsed?.userId === userId) return path.join(USER_DATA_DIR, entry.name);
  }

  const legacyDir = getLegacyUserDataDirById(userId);
  const legacyStateFile = path.join(legacyDir, 'state.json');
  if (fs.existsSync(legacyStateFile)) return legacyDir;
  return null;
}

function listMigrationCandidateStateFiles(userId, desiredFile = '') {
  ensureUserDataDir();
  const files = new Set();
  const entries = fs.readdirSync(USER_DATA_DIR, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('_'));
  entries.forEach(entry => {
    const file = path.join(USER_DATA_DIR, entry.name, 'state.json');
    if (!fs.existsSync(file)) return;
    if (desiredFile && path.resolve(file) === path.resolve(desiredFile)) return;
    const parsed = safeReadJson(file);
    if (parsed?.userId === userId) files.add(path.resolve(file));
  });
  const legacyDirFile = path.join(getLegacyUserDataDirById(userId), 'state.json');
  const legacyFlat = getLegacyUserDataPath(userId);
  [legacyDirFile, legacyFlat].forEach(file => {
    if (!fs.existsSync(file)) return;
    if (desiredFile && path.resolve(file) === path.resolve(desiredFile)) return;
    files.add(path.resolve(file));
  });
  return Array.from(files);
}

function getPreferredStateFile(files) {
  const candidates = (files || [])
    .map(file => ({ file, payload: safeReadJson(file) }))
    .filter(entry => entry.payload && typeof entry.payload === 'object');
  if (!candidates.length) return '';
  candidates.sort((a, b) => {
    const monthDiff = getStateMonthCount(b.payload) - getStateMonthCount(a.payload);
    if (monthDiff !== 0) return monthDiff;
    const timeA = Date.parse(a.payload.updatedAt || '') || 0;
    const timeB = Date.parse(b.payload.updatedAt || '') || 0;
    return timeB - timeA;
  });
  return candidates[0].file;
}

function getPreferredStatePayloadFromFiles(files) {
  const candidates = (files || [])
    .map(file => ({ file, payload: safeReadJson(file) }))
    .filter(entry => entry.payload && typeof entry.payload === 'object');
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const monthDiff = getStateMonthCount(b.payload) - getStateMonthCount(a.payload);
    if (monthDiff !== 0) return monthDiff;
    const timeA = Date.parse(a.payload.updatedAt || '') || 0;
    const timeB = Date.parse(b.payload.updatedAt || '') || 0;
    return timeB - timeA;
  });
  return candidates[0].payload;
}

function ensureUserDataLocation(userId) {
  ensureUserDataDir();
  const desiredDir = getDesiredUserDataDir(userId);
  const desiredFile = path.join(desiredDir, 'state.json');
  fs.mkdirSync(desiredDir, { recursive: true });

  if (!fs.existsSync(desiredFile)) {
    const migrationCandidates = listMigrationCandidateStateFiles(userId, desiredFile);
    const preferredFile = getPreferredStateFile(migrationCandidates);
    if (preferredFile && fs.existsSync(preferredFile)) {
      fs.copyFileSync(preferredFile, desiredFile);
    }
  }

  const legacyFlat = getLegacyUserDataPath(userId);
  if (fs.existsSync(legacyFlat)) {
    try {
      fs.unlinkSync(legacyFlat);
    } catch {}
  }

  const entries = fs.readdirSync(USER_DATA_DIR, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('_'));
  entries.forEach(entry => {
    const dirPath = path.join(USER_DATA_DIR, entry.name);
    if (path.resolve(dirPath) === path.resolve(desiredDir)) return;
    const stateFile = path.join(dirPath, 'state.json');
    if (!fs.existsSync(stateFile)) return;
    const parsed = safeReadJson(stateFile);
    if (parsed?.userId !== userId) return;
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch {}
  });

  return desiredDir;
}

function syncUserAppStateLocation(userId) {
  const dir = ensureUserDataLocation(userId);
  const filePath = path.join(dir, 'state.json');
  if (fs.existsSync(filePath)) {
    const parsed = safeReadJson(filePath) || {};
    if (parsed.userId !== userId) {
      parsed.userId = userId;
      writeJsonFileAtomic(filePath, parsed);
    }
  }
  return dir;
}

function syncAllUserAppStateLocations() {
  const users = readUsersStore().users || [];
  users.forEach(user => {
    if (user?.id) syncUserAppStateLocation(user.id);
  });
}

function hasUserAppState(userId) {
  if (fs.existsSync(getLegacyUserDataPath(userId))) return true;
  const existingDir = findExistingUserDataDir(userId);
  return !!existingDir && fs.existsSync(path.join(existingDir, 'state.json'));
}

function readUserAppState(userId, encryptionKey = '') {
  const dir = ensureUserDataLocation(userId);
  const filePath = path.join(dir, 'state.json');
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const parseMessage = error?.message || 'JSON inválido';
    throw new Error(`Estado do usuário corrompido (falha de leitura JSON): ${parseMessage}`);
  }
  ensureOwnedStatePayload(parsed, userId);
  if (parsed?.encrypted === true && typeof parsed.state === 'string') {
    if (!encryptionKey) {
      throw new Error('A chave de criptografia da sessão não está disponível.');
    }
    return {
      ...parsed,
      state: decryptDataWithKey(parsed.state, encryptionKey)
    };
  }
  return parsed;
}

function ensureOwnedStatePayload(payload, userId) {
  if (payload?.userId && payload.userId !== userId) {
    throw new Error('Estado do usuário inválido: arquivo não pertence à sessão autenticada.');
  }
}

const MAX_STATE_BYTES = 15 * 1024 * 1024;

function sanitizeStateForStorage(state) {
  const base = state && typeof state === 'object' && !Array.isArray(state)
    ? state
    : {};
  let cloned = {};
  try {
    cloned = JSON.parse(JSON.stringify(base));
  } catch {
    cloned = {};
  }
  if (!Array.isArray(cloned.finData)) cloned.finData = [];
  const schemaVersion = resolveSchemaVersion(cloned.finStateSchemaVersion || cloned.schemaVersion);
  cloned.finStateSchemaVersion = schemaVersion;
  return cloned;
}

function writeUserAppState(userId, state, encryptionKey = '') {
  const dir = ensureUserDataLocation(userId);
  const filePath = path.join(dir, 'state.json');
  const sanitizedState = sanitizeStateForStorage(state);
  const monthCount = Array.isArray(sanitizedState?.finData) ? sanitizedState.finData.length : 0;
  const schemaVersion = resolveSchemaVersion(sanitizedState?.finStateSchemaVersion || sanitizedState?.schemaVersion);
  const serializedState = encryptionKey
    ? encryptDataWithKey(sanitizedState, encryptionKey)
    : sanitizedState;
  const stateBytes = Buffer.byteLength(
    typeof serializedState === 'string'
      ? serializedState
      : JSON.stringify(serializedState),
    'utf8'
  );
  if (stateBytes > MAX_STATE_BYTES) {
    throw new Error('Estado excede o limite de armazenamento permitido.');
  }
  const payload = {
    userId,
    updatedAt: new Date().toISOString(),
    monthCount,
    schemaVersion,
    encrypted: !!encryptionKey,
    state: serializedState
  };
  writeJsonFileAtomic(filePath, payload);
  return payload;
}

function deleteUserAppState(userId) {
  const legacyFlat = getLegacyUserDataPath(userId);
  const existingDir = findExistingUserDataDir(userId);
  let removed = false;
  if (existingDir && fs.existsSync(existingDir)) {
    try {
      fs.rmSync(existingDir, { recursive: true, force: true });
      removed = true;
    } catch {}
  }
  if (fs.existsSync(legacyFlat)) {
    try {
      fs.unlinkSync(legacyFlat);
      removed = true;
    } catch {}
  }
  return removed;
}

function buildDeletedUserBackupName(user) {
  const base = sanitizeFolderSegment(
    user?.fullName ||
    user?.displayName ||
    String(user?.email || '').split('@')[0] ||
    user?.id ||
    'Usuario'
  );
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${base}__${String(user?.id || 'sem-id')}__${stamp}`;
}

function copyDirContents(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  entries.forEach(entry => {
    const src = path.join(sourceDir, entry.name);
    const dest = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirContents(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  });
}

function archiveDeletedUserAppState(user) {
  ensureDeletedUserBackupDir();
  const backupName = buildDeletedUserBackupName(user);
  const backupDir = path.join(DELETED_USER_BACKUP_DIR, backupName);
  fs.mkdirSync(backupDir, { recursive: true });

  const metadata = {
    archivedAt: new Date().toISOString(),
    deleteAfter: DELETED_USER_RETENTION_MS > 0
      ? new Date(Date.now() + DELETED_USER_RETENTION_MS).toISOString()
      : '',
    user: {
      id: user?.id || '',
      fullName: user?.fullName || '',
      displayName: user?.displayName || '',
      email: user?.email || ''
    }
  };
  writeJsonFileAtomic(path.join(backupDir, 'meta.json'), metadata);

  const existingDir = findExistingUserDataDir(user?.id);
  if (existingDir && fs.existsSync(existingDir)) {
    copyDirContents(existingDir, path.join(backupDir, 'app-state'));
  }

  const legacyFlat = getLegacyUserDataPath(user?.id);
  if (fs.existsSync(legacyFlat)) {
    fs.copyFileSync(legacyFlat, path.join(backupDir, `${String(user?.id || 'user')}.legacy.json`));
  }

  return backupDir;
}

function purgeExpiredDeletedUserBackups() {
  if (!(DELETED_USER_RETENTION_MS > 0)) return;
  ensureDeletedUserBackupDir();
  const now = Date.now();
  const entries = fs.readdirSync(DELETED_USER_BACKUP_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory());
  entries.forEach(entry => {
    const dirPath = path.join(DELETED_USER_BACKUP_DIR, entry.name);
    const metaPath = path.join(dirPath, 'meta.json');
    let expiresAt = 0;
    if (fs.existsSync(metaPath)) {
      const meta = safeReadJson(metaPath);
      expiresAt = Date.parse(meta?.deleteAfter || '') || 0;
    }
    if (!expiresAt) {
      const stat = fs.statSync(dirPath);
      expiresAt = stat.mtimeMs + DELETED_USER_RETENTION_MS;
    }
    if (expiresAt <= now) {
      try {
        fs.rmSync(dirPath, { recursive: true, force: true });
      } catch {}
    }
  });
}

function archiveOrphanUserStateArtifacts() {
  ensureUserDataDir();
  const users = readUsersStore().users || [];
  const activeIds = new Set(users.map(user => String(user?.id || '').trim()).filter(Boolean));
  if (!activeIds.size) return { archived: 0, files: 0, dirs: 0, archiveBase: '' };

  const nowStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveBase = path.join(ORPHAN_USER_ARCHIVE_DIR, `orphaned-${nowStamp}`);
  let archived = 0;
  let files = 0;
  let dirs = 0;

  const archiveEntry = targetPath => {
    try {
      const relative = path.relative(USER_DATA_DIR, targetPath);
      const safeRelative = String(relative || '')
        .replace(/[<>:"|?*]/g, '_')
        .replace(/\.\./g, '_');
      const destination = path.join(archiveBase, safeRelative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        fs.cpSync(targetPath, destination, { recursive: true });
        fs.rmSync(targetPath, { recursive: true, force: true });
        dirs += 1;
      } else {
        fs.copyFileSync(targetPath, destination);
        fs.rmSync(targetPath, { force: true });
        files += 1;
      }
      archived += 1;
      return true;
    } catch {
      return false;
    }
  };

  const entries = fs.readdirSync(USER_DATA_DIR, { withFileTypes: true });
  entries.forEach(entry => {
    if (entry.name === '.gitkeep') return;
    const entryPath = path.join(USER_DATA_DIR, entry.name);

    if (entry.isFile()) {
      if (entry.name.includes('.backup-') && entry.name.endsWith('.json')) return;
      if (!entry.name.endsWith('.json')) return;
      const parsed = safeReadJson(entryPath);
      const ownerId = String(parsed?.userId || '').trim();
      if (!ownerId || !activeIds.has(ownerId)) {
        archiveEntry(entryPath);
      }
      return;
    }

    if (!entry.isDirectory()) return;
    if (entry.name.startsWith('_')) return;
    const stateFile = path.join(entryPath, 'state.json');
    if (!fs.existsSync(stateFile)) {
      archiveEntry(entryPath);
      return;
    }
    const parsed = safeReadJson(stateFile);
    const ownerId = String(parsed?.userId || '').trim();
    if (!ownerId || !activeIds.has(ownerId)) {
      archiveEntry(entryPath);
    }
  });

  return { archived, files, dirs, archiveBase: archived ? archiveBase : '' };
}

function getMonthName(date) {
  const months = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];
  return months[date.getMonth()];
}

const SYSTEM_DEFAULT_CATEGORY_PRESETS = [
  { name: 'MORADIA', emoji: '🏠' },
  { name: 'SERVIÇOS', emoji: '🛠️' },
  { name: 'ALIMENTAÇÃO', emoji: '🍽️' },
  { name: 'TRANSPORTE', emoji: '🚗' },
  { name: 'COMPRAS', emoji: '🛍️' },
  { name: 'SAÚDE', emoji: '💊' },
  { name: 'LAZER', emoji: '🎬' },
  { name: 'EDUCAÇÃO', emoji: '🎓' },
  { name: 'FINANCEIRO', emoji: '💳' },
  { name: 'ASSINATURAS', emoji: '📱' },
  { name: 'TRABALHO', emoji: '💼' },
  { name: 'OUTROS', emoji: '📦' }
];

function buildEmptyMonth(date = new Date()) {
  const monthName = getMonthName(date);
  const year = date.getFullYear();
  const id = `${monthName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}_${year}`;
  const categorias = {};
  const dailyCategorySeeds = [];
  SYSTEM_DEFAULT_CATEGORY_PRESETS.forEach(entry => {
    const key = String(entry.name || '').trim();
    if (!key) return;
    categorias[key] = 0;
    dailyCategorySeeds.push(key);
  });
  return {
    id,
    nome: `${monthName} ${year}`,
    despesas: [],
    renda: [],
    financialGoals: [],
    projetos: [],
    patrimonioTransfers: [],
    outflowCards: [],
    outflows: [],
    cardBills: [],
    unifiedOutflowUi: {},
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias,
    gastosVar: [],
    dailyCategorySeeds,
    dailyGoals: {},
    dailyGoalTarget: null,
    dailyGoalManualCats: [],
    obs: ''
  };
}

function buildFreshUserAppState() {
  const defaultEmojis = {};
  SYSTEM_DEFAULT_CATEGORY_PRESETS.forEach(entry => {
    const key = String(entry.name || '').trim();
    if (!key || !entry.emoji) return;
    defaultEmojis[key] = entry.emoji;
  });
  return {
    finStateSchemaVersion: DEFAULT_FIN_STATE_SCHEMA_VERSION,
    finData: [buildEmptyMonth()],
    finMetas: {},
    finEsoData: [],
    finTitles: null,
    finUIState: null,
    finCategoryRenameMap: {},
    finExpenseCategoryRules: {},
    finExpenseNameRenameMap: {},
    finExpensePaymentDateRules: {},
    finIncomeNameRenameMap: {},
    finDashSeriesSelection: null,
    finDashSeriesSelection_simples: null,
    finDashSeriesSelection_fixo: null,
    finDashSeriesSelectionVersion: '',
    finDashSeriesColors: {},
    finCategoryColors: {},
    finCategoryEmojis: defaultEmojis,
    finMonthSectionColors: {},
    finMonthSectionCollapsed: {},
    finDashMetricOrder: null,
    finDashboardWidgetOrder: null,
    finDashboardWidgetLayout: null,
    finDashboardLayoutVersion: 2,
    finMesMetricOrder: null,
    finMesSectionOrder: null,
    finMonthCopyPreferences: {},
    finDataMigrationVersion: '',
    finResultMode: ''
  };
}

module.exports = {
  USER_DATA_DIR,
  DELETED_USER_BACKUP_DIR,
  ORPHAN_USER_ARCHIVE_DIR,
  getUserDataPath,
  getDesiredUserDataDir,
  hasUserAppState,
  readUserAppState,
  writeUserAppState,
  deleteUserAppState,
  archiveDeletedUserAppState,
  purgeExpiredDeletedUserBackups,
  archiveOrphanUserStateArtifacts,
  syncUserAppStateLocation,
  syncAllUserAppStateLocations,
  buildFreshUserAppState,
  ensureOwnedStatePayload,
  sanitizeStateForStorage,
  DEFAULT_FIN_STATE_SCHEMA_VERSION
};
