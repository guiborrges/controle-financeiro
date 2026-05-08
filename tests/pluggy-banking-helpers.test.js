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
