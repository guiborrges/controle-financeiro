(function initPendingSync(global) {
  'use strict';

  let queue = Promise.resolve();
  function serial(operation) {
    const result = queue.catch(() => {}).then(operation);
    queue = result;
    return result;
  }

  async function openDatabase() {
    if (!global.indexedDB || !global.crypto?.subtle) throw new Error('Armazenamento protegido indisponivel.');
    return new Promise((resolve, reject) => {
      const request = global.indexedDB.open('meufin-pending-sync', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  function recordId(userId) {
    const name = `finPendingRecord::${userId}`;
    let id = global.sessionStorage.getItem(name);
    if (!id) {
      id = global.crypto.randomUUID();
      global.sessionStorage.setItem(name, id);
    }
    return `${userId}::${id}`;
  }

  function transaction(db, mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', mode);
      const request = action(tx.objectStore('drafts'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Gravacao local interrompida.'));
    });
  }

  async function withDatabase(userId, operation) {
    if (!userId || userId === 'anonymous') return null;
    const db = await openDatabase();
    try { return await operation(db, recordId(userId)); }
    finally { db.close(); }
  }

  function save(userId, snapshot) {
    const text = JSON.stringify(snapshot);
    return serial(() => withDatabase(userId, async (db, id) => {
      const prior = await transaction(db, 'readonly', store => store.get(id));
      const key = prior?.key || await global.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const iv = global.crypto.getRandomValues(new Uint8Array(12));
      const cipher = await global.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
      await transaction(db, 'readwrite', store => store.put({ key, iv, cipher }, id));
      return true;
    }));
  }

  function read(userId) {
    return serial(() => withDatabase(userId, async (db, id) => {
      const row = await transaction(db, 'readonly', store => store.get(id));
      if (!row) return null;
      const clear = await global.crypto.subtle.decrypt({ name: 'AES-GCM', iv: row.iv }, row.key, row.cipher);
      return JSON.parse(new TextDecoder().decode(clear));
    }));
  }

  function clear(userId) {
    return serial(() => withDatabase(userId, (db, id) => transaction(db, 'readwrite', store => store.delete(id))));
  }

  global.PendingSync = { save, read, clear };
})(window);
