const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function context(fetch) {
  const sandbox = { fetch, console: { log() {}, warn() {}, error() {} }, localStorage: { getItem() { return null; }, removeItem() {}, setItem() {} } };
  sandbox.timers = [];
  sandbox.window = { setTimeout(callback) { sandbox.timers.push(callback); return 1; }, clearTimeout() {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app/storage.js'), 'utf8'), sandbox);
  vm.runInContext('storageInitialized = true; serverStorageCache = { finData: [1] };', sandbox);
  return sandbox;
}

test('storage reports HTTP errors and network failures rather than successful persistence', async () => {
  for (const status of [409, 500]) {
    const ctx = context(async () => ({ ok: false, status, json: async () => ({}) }));
    assert.equal(await ctx.flushServerStorage(true), false);
  }
  const ctx = context(async () => { throw new Error('offline'); });
  assert.equal(await ctx.flushServerStorage(true), false);
});

test('forced storage flush waits for its queued snapshot, not only the preceding write', async () => {
  const requests = [];
  const ctx = context((url, options) => new Promise(resolve => requests.push({ resolve, payload: JSON.parse(options.body) })));
  const first = ctx.flushServerStorage(true);
  vm.runInContext('serverStorageCache.finData = [2];', ctx);
  let complete = false;
  const second = ctx.flushServerStorage(true).then(value => { complete = true; return value; });
  assert.equal(requests.length, 1);
  requests[0].resolve({ ok: true, json: async () => ({ updatedAt: 'r1' }) });
  await first;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(complete, false);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1].payload.state.finData, [2]);
  assert.equal(requests[1].payload.baseRevision, 'r1');
  assert.equal(ctx.timers.length, 0, 'forced queue must not also schedule duplicate automatic writes');
  requests[1].resolve({ ok: true, json: async () => ({ updatedAt: 'r2' }) });
  assert.equal(await second, true);
  assert.equal(requests.length, 2);
  assert.equal(ctx.timers.length, 0);
});

test('backup import never announces success when server did not persist it', async () => {
  for (const result of [false, true]) {
    const alerts = [];
    let onload;
    const ctx = { FileReader: class { set onload(value) { onload = value; } readAsText() {} },
      saveEmergencyBackup() {}, normalizeImportedBackupPayload: value => value, validateImportedBackupState() {},
      applyImportedBackupState() {}, persistImportedBackupState() {}, flushServerStorage: async () => result,
      buildMonthSelect() {}, renderAll() {}, updateHistoryButtons() {}, showAppStatus() {}, alert: value => alerts.push(value) };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app/backup.js'), 'utf8'), ctx);
    ctx.renderAll = () => {};
    ctx.persistImportedBackupState = () => {};
    ctx.applyImportedBackupState = () => {};
    ctx.saveEmergencyBackup = () => {};
    ctx.normalizeImportedBackupPayload = value => value;
    ctx.validateImportedBackupState = () => {};
    ctx.importData({ target: { files: [{}], value: 'file' } });
    await onload({ target: { result: '{}' } });
    assert.equal(alerts.some(value => value === 'Dados importados com sucesso!'), result);
  }
});

test('legacy migration uses authoritative bootstrap data and revision after a concurrent writer wins', async () => {
  let bootstraps = 0;
  const ctx = context(async url => {
    if (url.includes('migrate-legacy')) return { ok: true, json: async () => ({ migrated: false }) };
    bootstraps += 1;
    return { ok: true, json: async () => ({ session: { id: 'u1', username: 'guilherme' },
      hasServerState: bootstraps > 1, stateRevision: bootstraps > 1 ? 'new-revision' : '',
      appState: bootstraps > 1 ? { finData: ['latest'] } : {} }) };
  });
  vm.runInContext('storageInitialized = false;', ctx);
  ctx.bindCrossTabRevisionSync = () => {};
  ctx.hasLegacyAppData = () => true;
  ctx.captureLegacyAppState = () => ({ finData: '["old"]' });
  const payload = await ctx.initializeServerStorage();
  assert.equal(payload.appState.finData[0], 'latest');
  assert.equal(vm.runInContext('serverStateRevision', ctx), 'new-revision');
  assert.equal(vm.runInContext('serverStorageCache.finData[0]', ctx), 'latest');
});
