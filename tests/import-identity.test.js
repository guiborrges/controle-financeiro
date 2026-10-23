const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const api = require('../server/import-identity');
const { planInvoiceImport } = require('../server/invoice-import-plan');
const { inventory } = require('../scripts/audit-import-identities');

const source = (externalId, accountId = 'a', tenantId = 'u', quality = 'native') => api.create({ tenantId, provider: 'pluggy', accountId, externalId, quality });
const row = identity => ({ identity, context: 'card', date: '10/10/26', amount: 50, direction: 'debit', description: 'Padaria' });

test('external identity is stable across display changes and scoped by tenant and account', () => {
  assert.equal(source('t').key, source('t').key);
  assert.notEqual(source('t', 'a').key, source('t', 'b').key);
  assert.notEqual(source('t', 'a', 'u').key, source('t', 'a', 'v').key);
  assert.notEqual(source('a|b', 'c').key, source('b', 'c|a').key);
  assert.equal(source(''), null);
});

test('worker and webhook use the same scoped staging identifier without truncating native ids', () => {
  const { txExternalId } = require('../workers/worker_pluggy');
  const { normalizeExternalTransactionId } = require('../server/http/routes/pluggy-webhook');
  const tx = { id: 'x'.repeat(300), accountId: 'a', description: 'Original' };
  assert.equal(txExternalId(tx, 'a', 'u'), normalizeExternalTransactionId(tx, 'u'));
  assert.equal(txExternalId(tx, 'a', 'u').length, 69);
  assert.equal(txExternalId({ ...tx, description: 'Renamed' }, 'a', 'u'), txExternalId(tx, 'a', 'u'));
  assert.notEqual(txExternalId(tx, 'b', 'u'), txExternalId(tx, 'a', 'u'));
  assert.equal(txExternalId({ amount: 50, description: 'Identical' }, 'a', 'u'), '');
});

test('staging reuses a unique legacy key but refuses ambiguous history without writing or merging it', async () => {
  for (const ids of [[], ['tx:t'], ['t', 'tx:t']]) {
    let calls = 0;
    const result = await api.resolveStagingKey({ execute: async (sql, params) => {
      calls++;
      assert.match(sql, /^SELECT/);
      assert.equal(params.tenant, 'u');
      assert.equal(params.account, 'a');
      return { rows: ids.map(id => ({ EXTERNAL_TRANSACTION_ID: id })) };
    } }, { id: 't' }, 'a', 'u');
    assert.equal(calls, 1);
    assert.equal(result.status, ids.length > 1 ? 'ambiguous' : ids.length ? 'legacy-or-existing' : 'new');
    assert.equal(!!result.key, ids.length < 2);
  }
});

test('two identical purchases with different native IDs are not merged', () => {
  const match = api.createMatcher([row(source('one'))]);
  assert.equal(match(row(source('two'))).kind, 'new');
  assert.equal(match({ ...row(source('one')), description: 'Edited' }).kind, 'exact');
});

test('an uncertain candidate is consumed at most once; credits and substring descriptions do not match debits', () => {
  const match = api.createMatcher([row(null)]);
  assert.equal(match(row(source('one'))).kind, 'candidate');
  assert.equal(match(row(source('two'))).kind, 'new');
  assert.equal(api.createMatcher([row(null)])({ ...row(source('three')), direction: 'credit' }).kind, 'new');
  assert.equal(api.createMatcher([row(null)])({ ...row(source('four')), description: 'Padaria Outra' }).kind, 'new');
  const reserved = api.createMatcher([row(source('exact'))]);
  assert.equal(reserved(row(source('exact'))).kind, 'exact');
  assert.equal(reserved(row(null)).kind, 'new');
});

test('provenance survives real outflow and patrimony normalization and JSON reload', () => {
  const ctx = { ImportIdentity: api, currentSession: null, data: [], document: { addEventListener() {} },
    normalizeVarDate: value => value, resolveCategoryName: value => value };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of ['mes-atual.js', 'patrimonio-clean.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app', file), 'utf8'), ctx);
  let value = { id: 'r', description: 'Edited', type: 'spend', amount: 50, date: '10/10/26', outputKind: 'card',
    importIdentity: source('t'), ibImportKey: source('t').key, sourceAccountName: 'Original bank', sourceDirection: 'debit' };
  for (let i = 0; i < 3; i++) value = JSON.parse(JSON.stringify(ctx.normalizeUnifiedOutflowItem(value)));
  assert.equal(value.importIdentity.key, source('t').key);
  assert.equal(value.sourceAccountName, 'Original bank');
  value = { ...value, type: 'retirada', value: 50, accountId: 'patrimony', date: '2026-10-10' };
  for (let i = 0; i < 3; i++) value = JSON.parse(JSON.stringify(ctx.normalizePatrimonioMovement(value)));
  assert.equal(value.importIdentity.key, source('t').key);
  assert.equal(value.sourceDirection, 'debit');
});

test('invoice planning preserves multiplicity, requires a decision for uncertain overlap and never mutates history', () => {
  const items = [0, 1].map(sourceIndex => ({ sourceIndex, cardId: 'c', date: '10/10/26', amount: 50, description: 'Padaria', include: true }));
  const empty = [{ outflows: [] }];
  const plan = planInvoiceImport(empty, items, 'u', 'job', value => value);
  assert.notEqual(plan.get(items[0]).identity.key, plan.get(items[1]).identity.key);
  const historic = [{ outflows: [{ outputKind: 'card', outputRef: 'c', date: '10/10/26', amount: 50, description: 'Padaria' }] }];
  const before = JSON.stringify(historic);
  assert.throws(() => planInvoiceImport(historic, items, 'u', 'next', value => value), /Possivel duplicata/);
  const approved = [{ ...items[0], duplicateDecision: 'new' }, items[1]];
  const matched = planInvoiceImport(historic, approved, 'u', 'next', value => value);
  assert.equal(matched.get(approved[0]).match.kind, 'candidate');
  assert.equal(matched.get(approved[1]).match.kind, 'new');
  assert.equal(JSON.stringify(historic), before);
});

test('refunds stay distinct and cannot silently become expenses', () => {
  const item = { cardId: 'c', date: '10/10/26', amount: 50, description: 'Refund', sourceDirection: 'credit' };
  assert.throws(() => planInvoiceImport([], [item], 'u', 'j', value => value), /estorno/);
  assert.equal(planInvoiceImport([], [{ ...item, include: false }], 'u', 'j', value => value).size, 1);
});

test('dry-run inventory reports ambiguity and missing IDs without modifying its input', () => {
  const rows = [{ tenantId: 'u', accountId: 'a', external_transaction_id: 't', raw: { id: 't' } },
    { tenantId: 'u', accountId: 'a', external_transaction_id: 'tx:t', raw: { id: 't' } },
    { tenantId: 'u', accountId: 'b', raw: {} }];
  const before = JSON.stringify(rows);
  assert.deepEqual(inventory(rows), { total: 3, canonical: 0, legacy: 2, missingIdentity: 1, ambiguousGroups: 1 });
  assert.equal(JSON.stringify(rows), before);
});
