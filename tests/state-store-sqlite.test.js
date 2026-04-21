const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');

function runNodeScript(code, env) {
  const result = spawnSync(process.execPath, ['-e', code], {
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'child process failed');
  }
  return JSON.parse(String(result.stdout || '{}'));
}

test('sqlite state backend writes and reads payload when enabled', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-sqlite-store-'));
  const script = `
    const { createStateStore } = require('./server/state-store-factory.js');
    const store = createStateStore();
    const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString('base64');
    store.writeUserAppState('u_sqlite_test', { finData: [{ id: 'abril_2026' }], finStateSchemaVersion: '3' }, key);
    const loaded = store.readUserAppState('u_sqlite_test', key);
    console.log(JSON.stringify({
      backend: store.backend,
      has: store.hasUserAppState('u_sqlite_test'),
      monthId: loaded?.state?.finData?.[0]?.id || ''
    }));
  `;
  const out = runNodeScript(script, {
    FIN_STORAGE_DIR: tempRoot,
    FIN_STATE_BACKEND: 'sqlite'
  });
  assert.equal(out.backend, 'sqlite');
  assert.equal(out.has, true);
  assert.equal(out.monthId, 'abril_2026');
});

test('sqlite backend returns latest revision after sequential writes', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-sqlite-revision-'));
  const script = `
    const { createStateStore } = require('./server/state-store-factory.js');
    const store = createStateStore();
    const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 20)).toString('base64');
    const first = store.writeUserAppState('u_sqlite_revision', { finData: [{ id: 'abril_2026' }], finStateSchemaVersion: '3' }, key);
    const second = store.writeUserAppState('u_sqlite_revision', { finData: [{ id: 'abril_2026' }, { id: 'maio_2026' }], finStateSchemaVersion: '3' }, key);
    const loaded = store.readUserAppState('u_sqlite_revision', key);
    console.log(JSON.stringify({
      backend: store.backend,
      firstRevision: first.updatedAt,
      secondRevision: second.updatedAt,
      loadedRevision: loaded?.updatedAt || '',
      monthCount: Array.isArray(loaded?.state?.finData) ? loaded.state.finData.length : 0
    }));
  `;
  const out = runNodeScript(script, {
    FIN_STORAGE_DIR: tempRoot,
    FIN_STATE_BACKEND: 'sqlite'
  });
  assert.equal(out.backend, 'sqlite');
  assert.equal(out.loadedRevision, out.secondRevision);
  assert.equal(out.monthCount, 2);
  assert.notEqual(out.firstRevision, out.secondRevision);
});
