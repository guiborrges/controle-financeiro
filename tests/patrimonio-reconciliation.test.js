const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPatrimonio(accounts, movements) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'patrimonio-clean.js'), 'utf8');
  const sandbox = {
    patrimonioAccounts: accounts,
    patrimonioMovements: movements,
    patrimonioFilters: {},
    patrimonioSelectedAccountId: '',
    window: {},
    data: [],
    console
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox);
  return { sandbox, helpers: sandbox.__patrimonioTest };
}

test('reconciliation checkpoint protects a verified balance from prior movements', () => {
  const { helpers } = loadPatrimonio([
    {
      id: 'wallet',
      nome: 'Carteira',
      reconciliationCheckpoints: [{ id: 'check-1', date: '2026-01-10', balance: 100, createdAt: '2026-01-10T12:00:00.000Z' }]
    }
  ], [
    { id: 'before', type: 'aporte', accountId: 'wallet', value: 30, date: '2026-01-05' },
    { id: 'after', type: 'aporte', accountId: 'wallet', value: 25, date: '2026-01-11' }
  ]);

  assert.equal(helpers.getPatrimonioBalanceForAccount('wallet'), 125);
  assert.equal(helpers.getPatrimonioBalanceForAccount('wallet', [{ id: 'before', type: 'aporte', accountId: 'wallet', value: 30, date: '2026-01-05' }]), 100);
});

test('saving a new reconciliation creates its audit movement and deletion previews the restored balance', () => {
  const { sandbox } = loadPatrimonio([{ id: 'wallet', nome: 'Carteira' }], [
    { id: 'deposit', type: 'aporte', accountId: 'wallet', value: 30, date: '2026-01-05' }
  ]);
  const values = {
    patrimonioMovementId: '', patrimonioMovementType: 'atualizacao',
    patrimonioMovementValue: '100', patrimonioMovementDescription: '',
    patrimonioMovementDate: '2026-01-10', patrimonioMovementAccount: 'wallet',
    patrimonioMovementFrom: '', patrimonioMovementTo: ''
  };
  sandbox.document = { getElementById: id => ({ value: values[id] }) };
  sandbox.parsePatrimonioAmountInput = Number;
  sandbox.recordHistoryState = () => {};
  sandbox.save = () => {};
  sandbox.closeModal = () => {};
  sandbox.renderPatrimonio = () => {};
  sandbox.renderMes = () => {};
  sandbox.fmt = value => String(value);
  sandbox.savePatrimonioMovement();
  const reconciliation = sandbox.patrimonioMovements.find(item => item.type === 'atualizacao');
  assert.ok(reconciliation);
  assert.equal(sandbox.getPatrimonioBalanceForAccount('wallet'), 100);
  const evolution = sandbox.getPatrimonioEvolutionSeries();
  assert.equal(evolution[0].total, 30);
  assert.equal(evolution[evolution.length - 1].total, 100);
  let preview = '';
  sandbox.confirm = message => { preview = message; return true; };
  sandbox.deletePatrimonioMovement(reconciliation.id);
  assert.match(preview, /100 -> 30/);
  assert.equal(sandbox.getPatrimonioBalanceForAccount('wallet'), 30);
});
