const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createEncryptionSalt } = require('./data-crypto');
const { resolveStoragePath } = require('./paths');
const { writeJsonFileAtomic } = require('./fs-atomic');

const USERS_STORE_PATH = resolveStoragePath('auth', 'users.json');
const LEGACY_USER_STORE_PATH = resolveStoragePath('auth', 'user-store.json');

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function slugifyUsername(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function ensureUsersStore() {
  if (fs.existsSync(USERS_STORE_PATH)) return;
  fs.mkdirSync(path.dirname(USERS_STORE_PATH), { recursive: true });
  let users = [];
  if (fs.existsSync(LEGACY_USER_STORE_PATH)) {
    const legacyRaw = fs.readFileSync(LEGACY_USER_STORE_PATH, 'utf8');
    const legacyUser = JSON.parse(legacyRaw);
    users = [{
      id: legacyUser.id || 'guilherme',
      username: normalizeUsername(legacyUser.username || 'guilherme'),
      displayName: legacyUser.displayName || 'Guilherme Borges',
      fullName: legacyUser.fullName || legacyUser.displayName || 'Guilherme Borges',
      birthDate: legacyUser.birthDate || '',
      phone: legacyUser.phone || '',
      email: normalizeEmail(legacyUser.email || ''),
      passwordHint: legacyUser.passwordHint || '',
      passwordHash: legacyUser.passwordHash,
      encryptionSalt: legacyUser.encryptionSalt || createEncryptionSalt(),
      permissions: {
        canAccessESO: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }];
  }
  writeJsonFileAtomic(USERS_STORE_PATH, { users });
}

function readUsersStore() {
  ensureUsersStore();
  const raw = fs.readFileSync(USERS_STORE_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.users)) {
    return { users: [] };
  }
  let changed = false;
  parsed.users = parsed.users.map(user => {
    const nextUser = { ...user };
    let nextChanged = false;
    if (!nextUser?.encryptionSalt) {
      nextUser.encryptionSalt = createEncryptionSalt();
      nextChanged = true;
    }
    if (!Array.isArray(nextUser.rememberTokens)) {
      nextUser.rememberTokens = [];
      nextChanged = true;
    }
    if (!Number.isFinite(nextUser.loginCount)) {
      nextUser.loginCount = 0;
      nextChanged = true;
    }
    if (!nextUser.lastLoginAt) {
      nextUser.lastLoginAt = '';
      nextChanged = true;
    }
    if (!nextUser.lastUsedAt) {
      nextUser.lastUsedAt = '';
      nextChanged = true;
    }
    if (!nextUser.lastRestoreAt) {
      nextUser.lastRestoreAt = '';
      nextChanged = true;
    }
    if (typeof nextUser.legacyRecurrenceBackfillRestricted !== 'boolean') {
      const normalizedUsername = normalizeUsername(nextUser.username || '');
      nextUser.legacyRecurrenceBackfillRestricted = normalizedUsername === 'guilherme';
      nextChanged = true;
    }
    if (!nextUser.backupStats || typeof nextUser.backupStats !== 'object') {
      nextUser.backupStats = {
        lastBackupAt: '',
        lastBackupType: '',
        loginsSinceBackup: 0
      };
      nextChanged = true;
    } else {
      if (!Number.isFinite(nextUser.backupStats.loginsSinceBackup)) {
        nextUser.backupStats.loginsSinceBackup = 0;
        nextChanged = true;
      }
      if (!nextUser.backupStats.lastBackupAt) {
        nextUser.backupStats.lastBackupAt = '';
        nextChanged = true;
      }
      if (!nextUser.backupStats.lastBackupType) {
        nextUser.backupStats.lastBackupType = '';
        nextChanged = true;
      }
    }
    if (nextChanged) {
      changed = true;
      return nextUser;
    }
    return user;
  });
  if (changed) {
    writeUsersStore({ users: parsed.users });
  }
  return parsed;
}

function writeUsersStore(store) {
  ensureUsersStore();
  const normalized = {
    users: Array.isArray(store?.users) ? store.users : []
  };
  writeJsonFileAtomic(USERS_STORE_PATH, normalized);
}

function findUserById(userId) {
  const store = readUsersStore();
  return store.users.find(user => user.id === userId) || null;
}

function findUserByUsername(username) {
  const store = readUsersStore();
  const key = normalizeUsername(username);
  return store.users.find(user => normalizeUsername(user.username) === key) || null;
}

function findUserByEmail(email) {
  const store = readUsersStore();
  const key = normalizeEmail(email);
  return store.users.find(user => normalizeEmail(user.email) === key) || null;
}

function ensureUniqueUserFields({ username, email }, ignoreUserId = '') {
  const store = readUsersStore();
  const usernameKey = normalizeUsername(username);
  const emailKey = normalizeEmail(email);
  const usernameExists = store.users.some(user => user.id !== ignoreUserId && normalizeUsername(user.username) === usernameKey);
  if (usernameExists) {
    throw new Error('Nome de usuário já está em uso.');
  }
  const emailExists = store.users.some(user => user.id !== ignoreUserId && normalizeEmail(user.email) === emailKey);
  if (emailExists) {
    throw new Error('E-mail já está em uso.');
  }
}

function buildUsernameFromEmail(email) {
  const base = slugifyUsername(normalizeEmail(email).split('@')[0]) || 'usuario';
  const store = readUsersStore();
  let candidate = base;
  let index = 2;
  while (store.users.some(user => normalizeUsername(user.username) === candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  return candidate;
}

function buildPublicProfile(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email || '',
    displayName: user.displayName || user.fullName || user.username,
    fullName: user.fullName || user.displayName || user.username,
    legacyRecurrenceBackfillRestricted: !!user.legacyRecurrenceBackfillRestricted,
    permissions: {
      canAccessESO: !!user.permissions?.canAccessESO
    }
  };
}

function buildPrivateProfile(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email || '',
    displayName: user.displayName || user.fullName || user.username,
    fullName: user.fullName || '',
    birthDate: user.birthDate || '',
    phone: user.phone || '',
    passwordHint: user.passwordHint || '',
    legacyRecurrenceBackfillRestricted: !!user.legacyRecurrenceBackfillRestricted,
    permissions: {
      canAccessESO: !!user.permissions?.canAccessESO
    }
  };
}

function getLoginConfig() {
  return {
    allowRegistration: true,
    loginMode: 'email',
    programName: 'Controle Financeiro',
    developerShortcut: 'Ctrl+Alt+D'
  };
}

function createUser(payload) {
  const now = new Date().toISOString();
  const user = {
    id: payload.id || crypto.randomUUID(),
    username: normalizeUsername(payload.username || buildUsernameFromEmail(payload.email)),
    displayName: String(payload.displayName || payload.fullName || payload.username || '').trim(),
    fullName: String(payload.fullName || '').trim(),
    birthDate: String(payload.birthDate || '').trim(),
    phone: String(payload.phone || '').trim(),
    email: normalizeEmail(payload.email),
    passwordHint: String(payload.passwordHint || '').trim(),
    passwordHash: payload.passwordHash,
    encryptionSalt: String(payload.encryptionSalt || createEncryptionSalt()),
    rememberTokens: Array.isArray(payload.rememberTokens) ? payload.rememberTokens : [],
    loginCount: Number(payload.loginCount || 0),
    lastLoginAt: String(payload.lastLoginAt || ''),
    lastUsedAt: String(payload.lastUsedAt || ''),
    lastRestoreAt: String(payload.lastRestoreAt || ''),
    backupStats: {
      lastBackupAt: String(payload?.backupStats?.lastBackupAt || ''),
      lastBackupType: String(payload?.backupStats?.lastBackupType || ''),
      loginsSinceBackup: Number(payload?.backupStats?.loginsSinceBackup || 0)
    },
    legacyRecurrenceBackfillRestricted: payload.legacyRecurrenceBackfillRestricted !== undefined
      ? !!payload.legacyRecurrenceBackfillRestricted
      : normalizeUsername(payload.username || buildUsernameFromEmail(payload.email)) === 'guilherme',
    permissions: {
      canAccessESO: !!payload.permissions?.canAccessESO
    },
    createdAt: now,
    updatedAt: now
  };
  ensureUniqueUserFields(user);
  const store = readUsersStore();
  store.users.push(user);
  writeUsersStore(store);
  return user;
}

function updateUser(userId, patch) {
  const store = readUsersStore();
  const index = store.users.findIndex(user => user.id === userId);
  if (index < 0) return null;
  const current = store.users[index];
  const next = {
    ...current,
    ...patch,
    username: patch.username ? normalizeUsername(patch.username) : current.username,
    email: patch.email !== undefined ? normalizeEmail(patch.email) : current.email,
    loginCount: patch.loginCount !== undefined ? Number(patch.loginCount || 0) : Number(current.loginCount || 0),
    lastLoginAt: patch.lastLoginAt !== undefined ? String(patch.lastLoginAt || '') : String(current.lastLoginAt || ''),
    lastUsedAt: patch.lastUsedAt !== undefined ? String(patch.lastUsedAt || '') : String(current.lastUsedAt || ''),
    lastRestoreAt: patch.lastRestoreAt !== undefined ? String(patch.lastRestoreAt || '') : String(current.lastRestoreAt || ''),
    backupStats: {
      ...(current.backupStats || {}),
      ...((patch.backupStats && typeof patch.backupStats === 'object') ? patch.backupStats : {})
    },
    legacyRecurrenceBackfillRestricted: patch.legacyRecurrenceBackfillRestricted !== undefined
      ? !!patch.legacyRecurrenceBackfillRestricted
      : !!current.legacyRecurrenceBackfillRestricted,
    permissions: {
      ...current.permissions,
      ...(patch.permissions || {})
    },
    updatedAt: new Date().toISOString()
  };
  ensureUniqueUserFields(next, userId);
  store.users[index] = next;
  writeUsersStore(store);
  return next;
}

function deleteUser(userId) {
  const store = readUsersStore();
  const index = store.users.findIndex(user => user.id === userId);
  if (index < 0) return null;
  const [removed] = store.users.splice(index, 1);
  writeUsersStore(store);
  return removed;
}

module.exports = {
  USERS_STORE_PATH,
  LEGACY_USER_STORE_PATH,
  normalizeUsername,
  normalizeEmail,
  buildUsernameFromEmail,
  ensureUsersStore,
  readUsersStore,
  writeUsersStore,
  findUserById,
  findUserByUsername,
  findUserByEmail,
  buildPublicProfile,
  buildPrivateProfile,
  getLoginConfig,
  createUser,
  updateUser,
  deleteUser
};
