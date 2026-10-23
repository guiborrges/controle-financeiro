const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { financialMonth } = require('./helpers/refactor-fixtures');

for (const [backend, encrypted] of [['json', false], ['json', true], ['sqlite', true]]) {
  test(`2A ${backend} ${encrypted ? 'encrypted' : 'plain'} preserves fictional fields and totals after process restart`, t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meufin-2a-'));
    t.after(() => {
      const resolved = fs.realpathSync(root);
      assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + 'meufin-2a-'));
      fs.rmSync(resolved, { recursive: true, force: true });
    });
    const month = financialMonth();
    month.outflows[0].source = { provider: 'synthetic', externalId: 'fixture-transaction-1' };
    const state = { finStateSchemaVersion: '3', finData: [month], finCategoryRenameMap: { ANTIGA: 'CASA' },
      finPatrimonioAccounts: [{ id: 'account', nome: 'Conta ficticia' }],
      finPatrimonioMovements: [{ id: 'movement', accountId: 'account', type: 'aporte', value: 100 }],
      finInternetBankingState: { importedKeys: ['synthetic:key'] } };
    const env = { ...process.env, FIN_STORAGE_DIR: root, FIN_STATE_BACKEND: backend };
    const key = encrypted ? Buffer.alloc(32, 7).toString('base64') : '';
    const write = spawnSync(process.execPath, ['-e', `
      const store = require('./server/state-store-factory').createStateStore();
      const state = JSON.parse(process.argv[1]);
      store.writeUserAppState('fixture-a', state, process.argv[2]);
      const other = JSON.parse(JSON.stringify(state)); other.finData[0].renda[0].valor = 5000;
      store.writeUserAppState('fixture-b', other, process.argv[2]);
      console.log(JSON.stringify({ backend: store.backend }));
    `, JSON.stringify(state), key], { cwd: path.resolve(__dirname, '..'), env, encoding: 'utf8' });
    assert.equal(write.status, 0, write.stderr);
    assert.equal(JSON.parse(write.stdout).backend, backend);
    const read = spawnSync(process.execPath, ['-e', `
      const store = require('./server/state-store-factory').createStateStore();
      const financial = require('./public/app/modules/shared/financial-query');
      const a = store.readUserAppState('fixture-a', process.argv[1]);
      const b = store.readUserAppState('fixture-b', process.argv[1]);
      console.log(JSON.stringify({ state: a.state, encrypted: a.encrypted,
        a: financial.query(a.state.finData[0]).resultCents,
        b: financial.query(b.state.finData[0]).resultCents }));
    `, key], { cwd: path.resolve(__dirname, '..'), env, encoding: 'utf8' });
    assert.equal(read.status, 0, read.stderr);
    const actual = JSON.parse(read.stdout);
    assert.deepEqual(actual.state, state);
    assert.equal(actual.encrypted, encrypted);
    assert.equal(actual.a, 161433);
    assert.equal(actual.b, 361433);
  });
}
