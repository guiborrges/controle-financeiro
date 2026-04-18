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

test('app-state read/write roundtrip works in isolated storage', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-state-rw-'));
  const script = `
    const { writeUserAppState, readUserAppState } = require('./server/app-state-store.js');
    const state = {
      finStateSchemaVersion: '3',
      finData: [{ id: '2026-04', nome: 'ABRIL 2026' }],
      finMetas: { ALIMENTACAO: 300 }
    };
    writeUserAppState('u_test_rw', state, '');
    const loaded = readUserAppState('u_test_rw', '');
    console.log(JSON.stringify({
      encrypted: loaded.encrypted,
      userId: loaded.userId,
      monthCount: loaded.monthCount,
      schemaVersion: loaded.schemaVersion,
      firstMonthId: loaded.state?.finData?.[0]?.id || ''
    }));
  `;
  const out = runNodeScript(script, { FIN_STORAGE_DIR: tempRoot });
  assert.equal(out.encrypted, false);
  assert.equal(out.userId, 'u_test_rw');
  assert.equal(out.monthCount, 1);
  assert.equal(out.schemaVersion, '3');
  assert.equal(out.firstMonthId, '2026-04');
});

test('app-state encrypted read/write roundtrip works in isolated storage', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-state-enc-'));
  const script = `
    const { writeUserAppState, readUserAppState } = require('./server/app-state-store.js');
    const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString('base64');
    writeUserAppState('u_test_enc', { finData: [{ id: '2026-05' }] }, key);
    const loaded = readUserAppState('u_test_enc', key);
    console.log(JSON.stringify({
      encrypted: loaded.encrypted,
      userId: loaded.userId,
      monthCount: loaded.monthCount,
      firstMonthId: loaded.state?.finData?.[0]?.id || ''
    }));
  `;
  const out = runNodeScript(script, { FIN_STORAGE_DIR: tempRoot });
  assert.equal(out.encrypted, true);
  assert.equal(out.userId, 'u_test_enc');
  assert.equal(out.monthCount, 1);
  assert.equal(out.firstMonthId, '2026-05');
});

test('app-state writer sanitizes invalid root payload to safe schema defaults', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-state-sanitize-'));
  const script = `
    const { writeUserAppState, readUserAppState } = require('./server/app-state-store.js');
    writeUserAppState('u_test_sanitize', null, '');
    const loaded = readUserAppState('u_test_sanitize', '');
    console.log(JSON.stringify({
      schemaVersion: loaded.schemaVersion,
      finStateSchemaVersion: loaded.state?.finStateSchemaVersion,
      finDataIsArray: Array.isArray(loaded.state?.finData)
    }));
  `;
  const out = runNodeScript(script, { FIN_STORAGE_DIR: tempRoot });
  assert.equal(out.schemaVersion, '3');
  assert.equal(out.finStateSchemaVersion, '3');
  assert.equal(out.finDataIsArray, true);
});

test('app-state writer blocks oversized payload', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-state-limit-'));
  const script = `
    const { writeUserAppState } = require('./server/app-state-store.js');
    const large = { finData: [], notes: 'x'.repeat(16 * 1024 * 1024) };
    try {
      writeUserAppState('u_test_limit', large, '');
      console.log(JSON.stringify({ blocked: false }));
    } catch (error) {
      console.log(JSON.stringify({ blocked: true, message: String(error?.message || '') }));
    }
  `;
  const out = runNodeScript(script, { FIN_STORAGE_DIR: tempRoot });
  assert.equal(out.blocked, true);
  assert.match(out.message, /limite de armazenamento/i);
});
