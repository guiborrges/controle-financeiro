const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function load(file, extra = {}, transform = value => value) {
  const ctx = { document: { getElementById: () => null, querySelector: () => null },
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
      amount: -(10 + i), description: `Purchase ${i}`, _ui: { category: 'COMPRAS', description: `Purchase ${i}` } }));
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
