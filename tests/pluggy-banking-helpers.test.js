const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadHelpers() {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'pluggy-banking.js'),
    'utf8'
  );
  const sandbox = {
    window: {},
    globalThis: {},
    localStorage: {
      getItem() { return null; },
      setItem() {}
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  return sandbox.__pluggyBankingTest;
}

test('filter helper detects "Saldo sincronizado via Pluggy"', () => {
  const helpers = loadHelpers();
  assert.equal(helpers.isSaldoSyncDescription('Saldo sincronizado via Pluggy'), true);
  assert.equal(helpers.isSaldoSyncDescription('SALDO  sincronizado  pluggy'), true);
  assert.equal(helpers.isSaldoSyncDescription('Compra mercado'), false);
});

test('inferBankMovementType prioritizes semantic fields', () => {
  const helpers = loadHelpers();
  assert.equal(helpers.inferBankMovementType({ direction: 'inflow', amount: -10 }), 'aporte');
  assert.equal(helpers.inferBankMovementType({ direction: 'outflow', amount: 10 }), 'retirada');
  assert.equal(helpers.inferBankMovementType({ type: 'CREDIT', amount: -10 }), 'aporte');
  assert.equal(helpers.inferBankMovementType({ type: 'DEBIT', amount: 10 }), 'retirada');
  assert.equal(helpers.inferBankMovementType({ amount: 99 }), 'aporte');
  assert.equal(helpers.inferBankMovementType({ amount: -99 }), 'retirada');
});

test('dedupeLabel avoids duplicated visual names', () => {
  const helpers = loadHelpers();
  assert.equal(helpers.dedupeLabel('XPXP'), 'XP');
  assert.equal(helpers.dedupeLabel('nu Nubank'), 'nu Nubank');
});

test('normalizeDescriptionKey keeps compatible keys for same Pluggy merchant text', () => {
  const helpers = loadHelpers();
  const a = helpers.normalizeDescriptionKey('UBER *TRIP HELP.UBER.COM');
  const b = helpers.normalizeDescriptionKey('Uber Trip Help Uber Com');
  assert.equal(a, b);
});

test('stripLegacyCategoryIconPrefix removes leaked icon ids from category labels', () => {
  const helpers = loadHelpers();
  assert.equal(helpers.stripLegacyCategoryIconPrefix('food ALIMENTACAO'), 'ALIMENTACAO');
  assert.equal(helpers.stripLegacyCategoryIconPrefix('phone ASSINATURAS'), 'ASSINATURAS');
  assert.equal(helpers.stripLegacyCategoryIconPrefix('MERCADO'), 'MERCADO');
});

test('toVisualCategorySymbol maps icon id to display emoji', () => {
  const helpers = loadHelpers();
  assert.equal(helpers.toVisualCategorySymbol('food', 'ALIMENTACAO'), '🍽️');
  assert.equal(helpers.toVisualCategorySymbol('home', 'MORADIA'), '🏠');
});

test('resolveTenantLikeUserKey uses session user identity', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'pluggy-banking.js'),
    'utf8'
  );
  const sandbox = {
    window: {},
    currentSession: {
      user: { id: 'user-id-1', username: 'user-name-1' }
    },
    localStorage: {
      getItem() { return null; },
      setItem() {}
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  const h = sandbox.__pluggyBankingTest;
  assert.equal(h.resolveTenantLikeUserKey(), 'user-id-1');
});

test('composite imported key uses original Pluggy description for dedupe', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'pluggy-banking.js'),
    'utf8'
  );
  const sandbox = {
    window: {},
    currentSession: {
      user: { id: 'user-tenant-1' }
    },
    localStorage: {
      getItem() { return null; },
      setItem() {}
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  const h = sandbox.__pluggyBankingTest;
  const account = { accountName: 'Cartao XP', accountType: 'CREDIT' };
  const tx = {
    date: '2026-05-08T12:00:00.000Z',
    amount: 14.58,
    description: 'Descricao editada',
    descriptionRaw: 'DL*MERCADO',
    _ui: { originalDescription: 'DL*MERCADO' }
  };
  const key = h.buildImportedCompositeKey(account, tx);
  assert.match(key, /^user-tenant-1\|Cartao XP\|CREDIT\|2026-05-08T12:00:00.000Z\|14\.58\|/);
  assert.equal(key.includes('descricao editada'), false);
});

test('extractImportedKeysFromSavedData reads persisted internet banking markers', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'pluggy-banking.js'),
    'utf8'
  );
  const sandbox = {
    window: {},
    data: [
      {
        id: 'maio_2026',
        outflows: [
          { id: 'a', ibImportKey: 'key-outflow-1' },
          { id: 'b', internetBankingImportKey: 'key-outflow-2' }
        ]
      }
    ],
    patrimonioMovements: [
      { id: 'm1', ibImportKey: 'key-mov-1' },
      { id: 'm2', internetBankingImportKey: 'key-mov-2' }
    ],
    localStorage: {
      getItem() { return null; },
      setItem() {}
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  const h = sandbox.__pluggyBankingTest;
  const keys = Array.from(h.extractImportedKeysFromSavedData());
  assert.deepEqual(keys.sort(), ['key-mov-1', 'key-mov-2', 'key-outflow-1', 'key-outflow-2']);
});

test('internet banking state merges canonical app-state with legacy local browser state', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'pluggy-banking.js'),
    'utf8'
  );
  const localState = {
    importedTxIds: { localImported: true },
    ignoredTxKeys: { localIgnoredKey: true },
    links: { accountA: 'card-local', sharedAccount: 'card-local-stale' }
  };
  const canonicalState = {
    importedTxIds: { canonicalImported: true },
    ignoredTxIds: { canonicalIgnored: true },
    links: { accountB: 'card-server', sharedAccount: 'card-server-current' }
  };
  const sandbox = {
    window: {},
    STORAGE_KEYS: { pluggyBankingState: 'finPluggyBankingState' },
    Storage: {
      getJSON(key) {
        assert.equal(key, 'finPluggyBankingState');
        return canonicalState;
      },
      setJSON(key, value) {
        assert.equal(key, 'finPluggyBankingState');
        sandbox.persistedCanonical = value;
      }
    },
    currentSession: { user: { id: 'user-merge-1' } },
    localStorage: {
      getItem(key) {
        assert.equal(key, 'pluggy_banking_state_v2:user-merge-1');
        return JSON.stringify(localState);
      },
      setItem(key, value) {
        sandbox.persistedLocal = { key, value: JSON.parse(value) };
      }
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  const state = sandbox.__pluggyBankingTest.loadUserStateForTest();

  assert.equal(state.importedTxIds.canonicalImported, true);
  assert.equal(state.importedTxIds.localImported, true);
  assert.equal(state.ignoredTxIds.canonicalIgnored, true);
  assert.equal(state.ignoredTxKeys.localIgnoredKey, true);
  assert.equal(state.links.accountA, 'card-local');
  assert.equal(state.links.accountB, 'card-server');
  assert.equal(state.links.sharedAccount, 'card-server-current');
  assert.equal(sandbox.persistedCanonical.importedTxIds.localImported, true);
  assert.equal(sandbox.persistedLocal.key, 'pluggy_banking_state_v2:user-merge-1');
});

test('internet banking state persists to canonical app-state and compatibility local cache', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'pluggy-banking.js'),
    'utf8'
  );
  const sandbox = {
    window: {},
    STORAGE_KEYS: { pluggyBankingState: 'finPluggyBankingState' },
    Storage: {
      getJSON() { return {}; },
      setJSON(key, value) {
        sandbox.persistedCanonical = { key, value };
      }
    },
    currentSession: { user: { id: 'user-persist-1' } },
    localStorage: {
      getItem() { return null; },
      setItem(key, value) {
        sandbox.persistedLocal = { key, value: JSON.parse(value) };
      }
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  sandbox.__pluggyBankingTest.persistUserStateForTest({
    importedTxIds: { tx123: true },
    ignoredTxKeys: { keyABC: true }
  });

  assert.equal(sandbox.persistedCanonical.key, 'finPluggyBankingState');
  assert.equal(sandbox.persistedCanonical.value.importedTxIds.tx123, true);
  assert.equal(sandbox.persistedCanonical.value.ignoredTxKeys.keyABC, true);
  assert.equal(sandbox.persistedLocal.key, 'pluggy_banking_state_v2:user-persist-1');
  assert.equal(sandbox.persistedLocal.value.importedTxIds.tx123, true);
});
