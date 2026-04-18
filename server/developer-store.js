const fs = require('fs');
const path = require('path');

const { hashPassword, verifyPassword } = require('./password');
const { resolveStoragePath } = require('./paths');
const { writeJsonFileAtomic } = require('./fs-atomic');

const DEVELOPER_STORE_PATH = resolveStoragePath('auth', 'developer-access.json');

function ensureDeveloperStore() {
  if (fs.existsSync(DEVELOPER_STORE_PATH)) return;
  fs.mkdirSync(path.dirname(DEVELOPER_STORE_PATH), { recursive: true });
  writeJsonFileAtomic(DEVELOPER_STORE_PATH, {
    passwordHash: '',
    createdAt: '',
    updatedAt: ''
  });
}

function readDeveloperStore() {
  ensureDeveloperStore();
  const raw = fs.readFileSync(DEVELOPER_STORE_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    passwordHash: parsed?.passwordHash || '',
    createdAt: parsed?.createdAt || '',
    updatedAt: parsed?.updatedAt || ''
  };
}

function writeDeveloperStore(store) {
  ensureDeveloperStore();
  const payload = {
    passwordHash: String(store?.passwordHash || ''),
    createdAt: String(store?.createdAt || ''),
    updatedAt: String(store?.updatedAt || '')
  };
  writeJsonFileAtomic(DEVELOPER_STORE_PATH, payload);
}

function hasDeveloperPassword() {
  return !!readDeveloperStore().passwordHash;
}

function setDeveloperPassword(password) {
  const now = new Date().toISOString();
  const current = readDeveloperStore();
  const next = {
    passwordHash: hashPassword(password),
    createdAt: current.createdAt || now,
    updatedAt: now
  };
  writeDeveloperStore(next);
  return next;
}

function verifyDeveloperAccess(password) {
  const store = readDeveloperStore();
  if (!store.passwordHash) return false;
  return verifyPassword(password, store.passwordHash);
}

function changeDeveloperPassword(currentPassword, nextPassword) {
  const store = readDeveloperStore();
  if (!store.passwordHash) {
    throw new Error('A senha do desenvolvedor ainda nao foi configurada.');
  }
  if (!verifyPassword(currentPassword, store.passwordHash)) {
    throw new Error('Senha atual do desenvolvedor incorreta.');
  }
  return setDeveloperPassword(nextPassword);
}

module.exports = {
  DEVELOPER_STORE_PATH,
  ensureDeveloperStore,
  readDeveloperStore,
  hasDeveloperPassword,
  setDeveloperPassword,
  verifyDeveloperAccess,
  changeDeveloperPassword
};
