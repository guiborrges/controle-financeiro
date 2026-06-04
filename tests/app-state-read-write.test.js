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

test('app-state writer stores state as partitioned bundle', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-state-partition-'));
  const script = `
    const fs = require('fs');
    const path = require('path');
    const { writeUserAppState, readUserAppState, getUserDataPath } = require('./server/app-state-store.js');
    const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString('base64');
    const state = {
      finStateSchemaVersion: '3',
      finData: Array.from({ length: 3 }, (_, idx) => ({ id: 'm' + idx, outflows: [{ id: 'o' + idx }] })),
      finPatrimonioAccounts: [{ id: 'acc1', saldo: 100 }],
      finEsoData: [{ id: 'eso1' }],
      finCategoryEmojis: { MERCADO: '🛒' }
    };
    writeUserAppState('u_partition', state, key);
    const statePath = getUserDataPath('u_partition');
    const manifest = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const partsDir = path.join(path.dirname(statePath), 'state-parts');
    const partFiles = fs.readdirSync(partsDir).sort();
    const loaded = readUserAppState('u_partition', key);
    console.log(JSON.stringify({
      partitioned: manifest.partitioned === true,
      manifestHasEncryptedBlob: typeof manifest.state === 'string',
      hasMonthsPart: partFiles.includes('months.json'),
      hasPatrimonioPart: partFiles.includes('patrimonio.json'),
      hasEsoPart: partFiles.includes('eso.json'),
      monthCount: loaded.state.finData.length,
      accountId: loaded.state.finPatrimonioAccounts[0].id,
      emoji: loaded.state.finCategoryEmojis.MERCADO
    }));
  `;
  const out = runNodeScript(script, { FIN_STORAGE_DIR: tempRoot });
  assert.equal(out.partitioned, true);
  assert.equal(out.manifestHasEncryptedBlob, false);
  assert.equal(out.hasMonthsPart, true);
  assert.equal(out.hasPatrimonioPart, true);
  assert.equal(out.hasEsoPart, true);
  assert.equal(out.monthCount, 3);
  assert.equal(out.accountId, 'acc1');
  assert.equal(out.emoji, '🛒');
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
