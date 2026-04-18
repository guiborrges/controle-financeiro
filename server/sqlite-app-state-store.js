const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const { resolveStoragePath } = require('./paths');
const { encryptDataWithKey, decryptDataWithKey } = require('./data-crypto');

const SQLITE_PATH = resolveStoragePath('data', 'app-state.sqlite3');
const MAX_STATE_BYTES = 15 * 1024 * 1024;

let dbInstance = null;

function ensureDb() {
  if (dbInstance) return dbInstance;
  fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
  const db = new DatabaseSync(SQLITE_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS app_state (
      user_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  dbInstance = db;
  return dbInstance;
}

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
  const schemaVersion = String(cloned.finStateSchemaVersion || cloned.schemaVersion || '3').trim() || '3';
  cloned.finStateSchemaVersion = schemaVersion;
  return cloned;
}

function ensureOwnedStatePayload(payload, userId) {
  if (payload?.userId && payload.userId !== userId) {
    throw new Error('Estado do usuário inválido: arquivo não pertence à sessão autenticada.');
  }
}

function buildPayload(userId, state, encryptionKey = '') {
  const sanitizedState = sanitizeStateForStorage(state);
  const monthCount = Array.isArray(sanitizedState?.finData) ? sanitizedState.finData.length : 0;
  const schemaVersion = String(sanitizedState?.finStateSchemaVersion || sanitizedState?.schemaVersion || '3');
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
  return {
    userId,
    updatedAt: new Date().toISOString(),
    monthCount,
    schemaVersion,
    encrypted: !!encryptionKey,
    state: serializedState
  };
}

function hasUserAppState(userId) {
  const db = ensureDb();
  const row = db.prepare('SELECT 1 as ok FROM app_state WHERE user_id = ? LIMIT 1').get(userId);
  return !!row;
}

function writeUserAppState(userId, state, encryptionKey = '') {
  const db = ensureDb();
  const payload = buildPayload(userId, state, encryptionKey);
  const payloadJson = JSON.stringify(payload);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      INSERT INTO app_state (user_id, payload_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `).run(userId, payloadJson, payload.updatedAt);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return payload;
}

function readUserAppState(userId, encryptionKey = '') {
  const db = ensureDb();
  const row = db.prepare('SELECT payload_json FROM app_state WHERE user_id = ? LIMIT 1').get(userId);
  if (!row?.payload_json) return null;
  const parsed = JSON.parse(String(row.payload_json || '{}'));
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

function deleteUserAppState(userId) {
  const db = ensureDb();
  const result = db.prepare('DELETE FROM app_state WHERE user_id = ?').run(userId);
  return Number(result?.changes || 0) > 0;
}

function closeSqliteStore() {
  if (!dbInstance) return;
  try {
    dbInstance.close();
  } catch {}
  dbInstance = null;
}

module.exports = {
  SQLITE_PATH,
  hasUserAppState,
  writeUserAppState,
  readUserAppState,
  deleteUserAppState,
  closeSqliteStore
};
