const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function load(file, extra = {}, transform = value => value) {
  const ctx = { ImportIdentity: require('../server/import-identity'), document: { getElementById: () => null, querySelector: () => null },
    localStorage: { getItem: () => null, setItem() {} }, ...extra };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(transform(fs.readFileSync(path.join(__dirname, '../public/app', file), 'utf8')), ctx);
  return ctx;
}

for (const batch of [false, true]) {
  test(`banking ${batch ? 'batch' : 'single'} retains review on failed save and retries without duplicate imports`, async () => {
    const month = { id: 'outubro_2026', outflows: [], outflowCards: [{ id: 'c', name: 'Card' }] };
    const messages = [];
    let confirmed = false;
    const ctx = load('pluggy-banking.js', {
      data: [month], getCurrentMonth: () => month,
      save: force => force ? Promise.resolve(confirmed) : undefined,
      showAppStatus: (message, title, tone) => messages.push({ message, tone }),
      BillImportUtils: { getAllCardsFromUserData: () => ({ list: month.outflowCards }),
        getAllCategoriesFromUserData: () => ({ list: [{ name: 'COMPRAS' }] }) }
    }, source => source.replace('global.__pluggyBankingTest = {', 'global.__pluggyBankingTest = { state: STATE,'));
    const state = ctx.__pluggyBankingTest.state;
    const rows = Array.from({ length: batch ? 2 : 1 }, (_, i) => ({ id: `t${i}`, date: '2026-09-15',
      amount: 10 + i, description: `Purchase ${i}`, _ui: { category: 'COMPRAS', description: `Purchase ${i}` } }));
    state.rawData = { accounts: [{ accountId: 'a', accountName: 'Card', accountType: 'CREDIT', transactions: rows }] };
    state.userState.links.a = 'c';
    state.pendingByAccount.a = rows;
    const run = () => batch ? ctx.PluggyBanking.addAll('a') : ctx.PluggyBanking.addOne('a', 't0');
    assert.equal((await run()).status, 'pending');
    assert.equal(state.pendingByAccount.a.length, rows.length);
    assert.equal(month.outflows.length, rows.length);
    assert.equal(messages.some(m => m.tone === 'ok'), false);
    confirmed = true;
    assert.equal((await run()).status, 'saved');
    assert.equal(month.outflows.length, rows.length);
    assert.equal(state.pendingByAccount.a.length, 0);
  });
}

test('banking imports two identical native facts and reconstructs scoped markers after reload', async () => {
  const month = { id: 'outubro_2026', outflows: [], outflowCards: [{ id: 'c', name: 'Card' }] };
  const ctx = load('pluggy-banking.js', {
    data: [month], currentSession: { id: 'tenant-a' }, getCurrentMonth: () => month,
    save: async () => true, showAppStatus() {},
    BillImportUtils: { getAllCardsFromUserData: () => ({ list: month.outflowCards }),
      getAllCategoriesFromUserData: () => ({ list: [{ name: 'COMPRAS' }] }) }
  }, source => source.replace('global.__pluggyBankingTest = {',
    'global.__pluggyBankingTest = { state: STATE, shouldSkipTx, rebuildImportedStateFromSavedData,'));
  const helpers = ctx.__pluggyBankingTest;
  const state = helpers.state;
  const rows = ['one', 'two'].map(id => ({ id, date: '2026-10-10', amount: 50, description: 'Identical',
    _ui: { category: 'COMPRAS', description: 'Identical' } }));
  const account = { accountId: 'a', accountName: 'Card', accountType: 'CREDIT', transactions: rows };
  state.rawData = { accounts: [account] };
  state.userState.links.a = 'c';
  state.pendingByAccount.a = rows;
  assert.equal((await ctx.PluggyBanking.addAll('a')).status, 'saved');
  assert.equal(month.outflows.length, 2);
  assert.notEqual(month.outflows[0].importIdentity.key, month.outflows[1].importIdentity.key);
  month.outflows = JSON.parse(JSON.stringify(month.outflows));
  month.outflows[0].description = 'Renamed';
  state.userState.importedTxKeys = {};
  helpers.rebuildImportedStateFromSavedData();
  assert.equal(helpers.shouldSkipTx(account, rows[0]), true);
  assert.equal(helpers.shouldSkipTx(account, { ...rows[0], id: 'webhook-alias', nativeTransactionId: 'one' }), true);
  assert.equal(helpers.shouldSkipTx({ ...account, accountId: 'b' }, rows[0]), false);
  ctx.currentSession.id = 'tenant-b';
  assert.equal(helpers.shouldSkipTx(account, rows[0]), false);
});

test('bill review remains open until confirmed and retry does not reapply rows or history', async () => {
  const month = { id: 'outubro_2026', outflows: [], outflowCards: [{ id: 'c', name: 'Card' }] };
  let resolve;
  let closed = 0;
  const messages = [];
  const ctx = load('modules/import-bills-review.js', {
    data: [month], currentMonthId: month.id,
    BillImportSchema: { normalizeImportDate: value => value },
    save: force => force ? new Promise(done => { resolve = done; }) : undefined,
    closeModal: () => { closed++; },
    showAppStatus: (message, title, tone) => messages.push({ message, tone })
  });
  ctx.BillImportReview.setReviewData({ context: { cards: month.outflowCards,
    categoryIndex: { byNormalized: new Map([['compras', true]]) } },
    items: [{ id: 'r', monthId: month.id, cardId: 'c', category: 'COMPRAS', date: '15/10/26',
      description: 'Fixture', amount: 100, include: true }] });
  const first = ctx.BillImportReview.applyImport();
  assert.equal(closed, 0);
  assert.equal(month.outflows.length, 1);
  resolve(false);
  assert.equal((await first).status, 'pending');
  assert.equal(closed, 0);
  assert.equal(messages.some(m => m.tone === 'ok'), false);
  const second = ctx.BillImportReview.applyImport();
  resolve(true);
  assert.equal((await second).status, 'saved');
  assert.equal(month.outflows.length, 1);
  assert.equal(month.billImportHistory.length, 1);
  assert.equal(closed, 1);
});

for (const status of [200, 409, 500]) {
  test(`invoice job HTTP ${status} closes review only for confirmed persistence`, async () => {
    let resolve;
    let closed = 0;
    const messages = [];
    const ctx = load('modules/import-bills.js', {
      flushServerStorage: async () => true,
      fetch: url => url === '/api/invoice/import'
        ? new Promise(done => { resolve = done; })
        : Promise.resolve({ ok: true, json: async () => ({ jobs: [] }) }),
      closeModal: () => { closed++; },
      showAppStatus: (message, title, tone) => messages.push({ message, tone })
    }, source => source.replace('global.BillImport = {', 'global.BillImport = { stateForTest: state,'));
    ctx.BillImport.stateForTest.activeJobId = 'job';
    const result = ctx.BillImport.runImportFromReview();
    await new Promise(done => setImmediate(done));
    assert.equal(closed, 0);
    assert.equal(messages.some(m => m.tone === 'ok'), false);
    resolve({ ok: status === 200, json: async () => ({ ok: status === 200, imported: 1, updatedAt: 'revision', message: 'Refused' }) });
    assert.equal((await result).status, status === 200 ? 'saved' : 'failed');
    assert.equal(closed, status === 200 ? 1 : 0);
  });
}

test('invoice jobs do not start while local state has unconfirmed writes', async () => {
  let posted = false;
  const ctx = load('modules/import-bills.js', {
    flushServerStorage: async () => false,
    fetch: async url => { if (url === '/api/invoice/import') posted = true; return { ok: true, json: async () => ({}) }; },
    showAppStatus() {}
  }, source => source.replace('global.BillImport = {', 'global.BillImport = { stateForTest: state,'));
  ctx.BillImport.stateForTest.activeJobId = 'job';
  assert.equal((await ctx.BillImport.runImportFromReview()).status, 'pending');
  assert.equal(posted, false);
});

test('invoice context uses live calendar months and authenticated bootstrap without window.data', () => {
  const months = [{ id: 'outubro_2026' }];
  const categories = { list: [{ name: 'OUTROS' }], byNormalized: new Map([['outros', 'OUTROS']]) };
  const ctx = load('modules/import-bills.js', {
    getAllFinanceMonths: () => months, __APP_BOOTSTRAP__: { session: { id: 'real-tenant' } },
    BillImportUtils: { buildImportContext: (data, session) => ({ user: session }),
      getAllCardsFromUserData: () => ({ list: [] }), getAllCategoriesFromUserData: () => categories },
    fetch: async () => ({ ok: true, json: async () => ({}) })
  }, source => source.replace('global.BillImport = {', 'global.BillImport = { contextForTest: getCurrentContext,'));
  const context = ctx.BillImport.contextForTest();
  assert.equal(context.data, months);
  assert.equal(context.user.id, 'real-tenant');
  assert.equal(context.categoryIndex, categories);
});

test('review consumes a legacy candidate once, exposes the decision and never imports it silently', async () => {
  const month = { id: 'outubro_2026', outflowCards: [{ id: 'c', name: 'Card' }],
    outflows: [{ outputKind: 'card', outputRef: 'c', date: '10/10/26', amount: 50, description: 'Padaria' }] };
  const ctx = load('modules/import-bills-review.js', {
    getAllFinanceMonths: () => [month], getCurrentMonth: () => month,
    __APP_BOOTSTRAP__: { session: { id: 'real-tenant' } },
    BillImportSchema: { normalizeImportDate: value => value },
    showAppStatus() {}, showStatusMessage() {}, save: async () => true
  });
  ctx.BillImportReview.setReviewData({ sourceImportId: 'job', context: { cards: month.outflowCards,
    categoryIndex: { byNormalized: new Map([['outros', 'OUTROS']]) } },
    items: ['a', 'b'].map(id => ({ id, monthId: month.id, cardId: 'c', category: 'OUTROS', date: '10/10/26',
      description: 'Padaria', amount: 50, include: true })) });
  let exported = ctx.BillImportReview.exportPayload().items;
  assert.equal(exported[0].status, 'needs_review');
  assert.equal(exported[1].status, 'valid');
  assert.equal((await ctx.BillImportReview.applyImport()).status, 'invalid');
  assert.equal(month.outflows.length, 1);
  ctx.BillImportReview.updateField('a', 'duplicateDecision', 'new');
  exported = ctx.BillImportReview.exportPayload().items;
  assert.equal(exported[0].status, 'warning');
  assert.equal((await ctx.BillImportReview.applyImport()).status, 'saved');
  assert.equal(month.outflows.length, 3);
  assert.equal(month.outflows[1].importIdentity.tenantId, 'real-tenant');
});
