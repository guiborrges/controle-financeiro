const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const crypto = require('node:crypto');
const { requireAuth } = require('../server/http/security');
const { registerAppStateRoutes } = require('../server/http/routes/app-state');
const { getLegacySeedForUser } = require('../server/legacy-seed-data');

test('private legacy copy retains the exact original records and never shares a mutable reference', () => {
  const owner = { username: 'guilherme', permissions: { canAccessESO: true } };
  const seed = getLegacySeedForUser(owner);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(seed)).digest('hex'), '71037c7e798059c1d5a3b13b8acf5b501ff2ed1ea44ef96925ddce94fe25ef55');
  seed.histData.length = 0;
  assert.ok(getLegacySeedForUser(owner).histData.length > 0);
  assert.equal(getLegacySeedForUser({ username: 'other' }), null);
});

test('browser seeds load only after bootstrap and clear on an empty next identity', () => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app/data.js'), 'utf8'), context);
  context.seed = { extraHistMonths: [{ id: 'synthetic-extra' }], histData: [{ id: 'synthetic' }],
    importedBreakdowns: { synthetic: { CASA: [1] } }, importedProjects: { synthetic: [{ valor: 2 }] }, esoImportedClosings: [] };
  vm.runInContext('applyLegacyFinanceSeed(seed)', context);
  assert.equal(vm.runInContext('HIST_DATA[0].id', context), 'synthetic');
  vm.runInContext('applyLegacyFinanceSeed(null)', context);
  assert.equal(vm.runInContext('HIST_DATA.length + EXTRA_HIST_MONTHS.length + Object.keys(IMPORTED_PROJECTS).length + Object.keys(IMPORTED_BREAKDOWNS).length', context), 0);
});

test('public data asset contains empty legacy containers, never personal seed records', () => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app/data.js'), 'utf8'), context);
  const counts = vm.runInContext('[EXTRA_HIST_MONTHS.length, HIST_DATA.length, Object.keys(IMPORTED_BREAKDOWNS).length, Object.keys(IMPORTED_PROJECTS).length, ESO_IMPORTED_CLOSINGS.length]', context);
  assert.deepEqual(Array.from(counts), [0, 0, 0, 0, 0]);
});

test('bootstrap serves legacy compatibility only to its authenticated owner and filters ESO permission', async () => {
  const app = express();
  const users = {
    owner: { id: 'owner', username: 'guilherme', permissions: { canAccessESO: true } },
    ownerNoEso: { id: 'owner', username: 'guilherme', permissions: {} },
    other: { id: 'other', username: 'synthetic-other', permissions: { canAccessESO: true } }
  };
  app.use((req, _res, next) => { req.fixtureUser = users[req.get('X-Fixture-User')]; req.session = { authenticated: !!req.fixtureUser }; next(); });
  registerAppStateRoutes(app, { noStore: (_req, _res, next) => next(), requireAuth,
    requireCsrf: (_req, _res, next) => next(), getAuthenticatedUser: req => req.fixtureUser,
    findUserById: () => null, touchUserActivity() {}, ensureCsrfToken: () => 'fixture',
    readUserAppState: () => ({ state: { finData: [{ id: 'synthetic' }] }, encrypted: true, partitioned: true, partitionVersion: 3 }),
    recoverMissingMonthsFromLegacyBackups: (_id, state) => ({ state, changed: false }),
    buildPrivateProfile: user => ({ id: user.id }) });
  const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/app/bootstrap`;
    assert.equal((await fetch(url)).status, 401);
    const load = async user => (await fetch(url, { headers: { 'X-Fixture-User': user } })).json();
    const other = await load('other');
    assert.equal(other.legacySeed, null);
    const owner = await load('owner');
    assert.ok(owner.legacySeed.histData.length > 0);
    assert.ok(owner.legacySeed.esoImportedClosings.length > 0);
    assert.deepEqual(owner.appState.finData, [{ id: 'synthetic' }]);
    assert.equal((await load('ownerNoEso')).legacySeed.esoImportedClosings.length, 0);
    assert.equal((await load('other')).legacySeed, null);
  } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
});
