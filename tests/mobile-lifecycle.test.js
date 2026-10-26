const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
const { appRoot, loadBrowser } = require('./helpers/refactor-fixtures');
const { readMobileStyles } = require('./helpers/mobile-styles');

function fixture() {
  const events = [];
  const writes = [];
  const ctx = {
    document: { dispatchEvent: event => events.push(event) },
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
    invalidateCategoryNormalizationCache() {}, Storage: { setJSON: (...args) => writes.push(args) },
    STORAGE_KEYS: { data: 'data', patrimonioAccounts: 'accounts', patrimonioMovements: 'movements' },
    data: [{ id: 'synthetic' }], patrimonioAccounts: [], patrimonioMovements: []
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  loadBrowser(ctx, ['modules/app-events.js']);
  const state = fs.readFileSync(path.join(appRoot, 'state.js'), 'utf8');
  vm.runInContext(state.slice(state.indexOf('function save(forceFlush'), state.indexOf('function saveMetas()')), ctx);
  return { ctx, events, writes };
}

test('save emits one explicit change after storing the financial snapshot', () => {
  const f = fixture();
  assert.equal(f.ctx.save(), undefined);
  assert.equal(f.writes.length, 3);
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].type, 'mobileDataChanged');
  assert.equal(f.events[0].detail.reason, 'save');
  assert.deepEqual(f.writes[0], ['data', f.ctx.data]);
});

for (const result of [true, false]) {
  test(`forced save retains its exact promise and emits once even with pending result ${result}`, async () => {
    const f = fixture();
    const promise = Promise.resolve(result);
    f.ctx.flushServerStorage = force => { assert.equal(force, true); return promise; };
    assert.equal(f.ctx.save(true), promise);
    assert.equal(f.events.length, 1);
    assert.equal(await promise, result);
  });
}

test('save does not emit success-like changes when synchronous storage throws', () => {
  const f = fixture();
  f.ctx.Storage.setJSON = () => { throw new Error('disk'); };
  assert.throws(() => f.ctx.save(), /disk/);
  assert.equal(f.events.length, 0);
});

test('event module initializes once and tolerates non-browser test surfaces', () => {
  const f = fixture();
  const original = f.ctx.AppEvents;
  loadBrowser(f.ctx, ['modules/app-events.js']);
  assert.equal(f.ctx.AppEvents, original);
  f.ctx.CustomEvent = undefined;
  assert.doesNotThrow(() => f.ctx.AppEvents.emit('mobileDataChanged'));
});

test('mobile CSS extraction preserves every rule, value and cascade position', () => {
  const source = readMobileStyles().replace(/\r\n/g, '\n');
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),
    'b307c2325aafba7281f029dbbc83b37d322446da5d5d8d656a59b5b6d124f286');
});

test('mobile lifecycle no longer replaces save/nav or polls for mutation wrappers', () => {
  const mobile = fs.readFileSync(path.join(appRoot, 'mobile-v2.js'), 'utf8');
  const enhancements = fs.readFileSync(path.join(appRoot, 'mobile-v2-enhancements.js'), 'utf8');
  assert.doesNotMatch(mobile, /global\.nav\s*=/);
  assert.doesNotMatch(enhancements, /wrap\('save',|setInterval\(/);
});
