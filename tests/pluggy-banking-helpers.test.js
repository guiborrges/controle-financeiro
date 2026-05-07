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

