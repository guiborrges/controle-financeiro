const fileStore = require('./app-state-store');

function buildFileFirstStore() {
  return {
    backend: 'json',
    hasUserAppState: fileStore.hasUserAppState,
    readUserAppState: fileStore.readUserAppState,
    writeUserAppState: fileStore.writeUserAppState,
    deleteUserAppState: fileStore.deleteUserAppState
  };
}

function buildSqliteMirroredStore() {
  let sqliteStore = null;
  try {
    sqliteStore = require('./sqlite-app-state-store');
  } catch (error) {
    console.warn('[state-store] SQLite backend indisponível; mantendo JSON.', error?.message || error);
    return buildFileFirstStore();
  }
  return {
    backend: 'sqlite',
    hasUserAppState(userId) {
      return sqliteStore.hasUserAppState(userId) || fileStore.hasUserAppState(userId);
    },
    readUserAppState(userId, encryptionKey = '') {
      const sqlitePayload = sqliteStore.readUserAppState(userId, encryptionKey);
      if (sqlitePayload) return sqlitePayload;
      const filePayload = fileStore.readUserAppState(userId, encryptionKey);
      if (filePayload?.state) {
        try {
          sqliteStore.writeUserAppState(userId, filePayload.state, encryptionKey);
        } catch {}
      }
      return filePayload;
    },
    writeUserAppState(userId, state, encryptionKey = '') {
      const sqlitePayload = sqliteStore.writeUserAppState(userId, state, encryptionKey);
      // Mirror to JSON store to preserve current backup/audit flows.
      try {
        fileStore.writeUserAppState(userId, state, encryptionKey);
      } catch (error) {
        console.warn('[state-store] Falha no espelhamento JSON apos persistencia SQLite', {
          userId,
          message: error?.message || String(error)
        });
      }
      return sqlitePayload;
    },
    deleteUserAppState(userId) {
      const sqliteRemoved = sqliteStore.deleteUserAppState(userId);
      const fileRemoved = fileStore.deleteUserAppState(userId);
      return sqliteRemoved || fileRemoved;
    }
  };
}

function createStateStore() {
  const backend = String(process.env.FIN_STATE_BACKEND || '').trim().toLowerCase();
  if (backend === 'sqlite') return buildSqliteMirroredStore();
  return buildFileFirstStore();
}

module.exports = {
  createStateStore
};
