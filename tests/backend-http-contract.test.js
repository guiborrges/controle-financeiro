const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const { registerAppStateRoutes } = require('../server/http/routes/app-state');
const { registerProfileRoutes } = require('../server/http/routes/profile');
const { createErrorHandler } = require('../server/http/error-handler');
const security = require('../server/http/security');

test('backend HTTP contract retains authentication, CSRF, owner scope, revisions and backup tokens', async t => {
  const app = express();
  const states = new Map();
  const backups = [];
  const tokens = new Set();
  let revision = 0;
  let failure = '';
  app.use(express.json({ limit: '2kb' }));
  // Test-only sessions; this app is never mounted in the production server.
  app.use((req, _res, next) => {
    req.session = req.get('X-Fixture-User') ? { authenticated: true, userId: req.get('X-Fixture-User'),
      csrfToken: 'fixture-csrf', dataEncryptionKey: 'fixture-key' } : {};
    next();
  });
  const deps = {
    noStore: security.noStore, requireAuth: security.requireAuth, requireCsrf: security.requireCsrf,
    ensureCsrfToken: security.ensureCsrfToken,
    getAuthenticatedUser: req => req.session.userId ? { id: req.session.userId, username: 'fixture', permissions: {} } : null,
    touchUserActivity() {}, findUserById: () => null, buildPrivateProfile: user => ({ id: user.id }),
    readUserAppState: id => { if (failure === 'read') throw new Error('fixture read'); return states.get(id) || null; },
    hasUserAppState: id => states.has(id),
    writeUserAppState(id, state, key) {
      if (failure === 'write' || failure === 'rewrite') throw new Error('fixture write');
      assert.equal(key, 'fixture-key');
      const saved = { state, updatedAt: `revision-${++revision}`, encrypted: true, partitioned: true, partitionVersion: 3 };
      states.set(id, saved);
      return saved;
    },
    recoverMissingMonthsFromLegacyBackups: (_id, state) => ({ changed: failure === 'rewrite', state }),
    createUserBackup(id, options) { const backup = { id: `backup-${backups.length}`, owner: id, ...options }; backups.push(backup); return backup; },
    toClientBackupMeta: backup => ({ id: backup.id, type: backup.type }), updateUser() {},
    consumeOperationToken(scope, id, token) {
      const key = `${scope}:${id}:${token}`;
      if (tokens.has(key)) return { accepted: false, duplicate: true };
      tokens.add(key);
      return { accepted: true };
    }
  };
  registerAppStateRoutes(app, deps);
  registerProfileRoutes(app, deps);
  app.use(createErrorHandler({ logger: { error() {} }, randomUUID: () => 'fixture-request' }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { user = 'a', method = 'GET', body, csrf = 'fixture-csrf', token = 'same-token' } = {}) {
    const response = await fetch(origin + path, { method,
      headers: { ...(user ? { 'X-Fixture-User': user } : {}), 'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}), 'X-Operation-Token': token },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json(), cacheControl: response.headers.get('cache-control') };
  }
  await t.test('unauthenticated requests never reach persistence', async () => {
    assert.equal((await request('/api/app-state', { user: '', method: 'PUT', body: { state: {} } })).status, 401);
    assert.equal(states.size, 0);
  });
  await t.test('missing CSRF cannot save or create a manual backup', async () => {
    assert.equal((await request('/api/app-state', { csrf: '', method: 'PUT', body: { state: {} } })).status, 403);
    assert.equal((await request('/api/backups/manual', { csrf: '', method: 'POST' })).status, 403);
    assert.equal(states.size + backups.length, 0);
  });
  await t.test('invalid state retains the HTTP 400 response', async () => {
    const result = await request('/api/app-state', { method: 'PUT', body: { state: [] } });
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { message: 'Estado invalido.' });
  });
  await t.test('first save uses session owner, not an owner supplied in the body', async () => {
    const result = await request('/api/app-state', { method: 'PUT', body: { userId: 'b', state: { finData: [{ id: 'outubro_2026' }] } } });
    assert.deepEqual(result.body, { ok: true, updatedAt: 'revision-1' });
    assert.equal(states.has('b'), false);
  });
  await t.test('bootstrap exposes the committed revision and disables caching', async () => {
    const result = await request('/api/app/bootstrap');
    assert.equal(result.status, 200);
    assert.equal(result.body.stateRevision, 'revision-1');
    assert.equal(result.body.session.id, 'a');
    assert.match(result.cacheControl, /no-store/);
  });
  await t.test('another tenant cannot read the first tenant state', async () => {
    const result = await request('/api/app/bootstrap', { user: 'b' });
    assert.equal(result.body.appState, null);
    assert.equal(result.body.shouldStartEmpty, true);
  });
  await t.test('stale tab is blocked without replacing committed data', async () => {
    const result = await request('/api/app-state', { method: 'PUT', body: { state: {}, baseRevision: '' } });
    assert.equal(result.status, 409);
    assert.equal(result.body.currentRevision, 'revision-1');
    assert.equal(states.get('a').updatedAt, 'revision-1');
  });
  await t.test('legacy migration cannot overwrite an existing account', async () => {
    const result = await request('/api/app-state/migrate-legacy', { method: 'POST', body: { state: {} } });
    assert.deepEqual(result.body, { ok: true, migrated: false });
    assert.equal(revision, 1);
  });
  await t.test('read failure keeps the protected bootstrap error response', async () => {
    failure = 'read';
    try {
      const result = await request('/api/app/bootstrap');
      assert.equal(result.status, 500);
      assert.deepEqual(result.body, { message: 'Falha ao carregar os dados do usuario com seguranca.' });
    } finally { failure = ''; }
  });
  await t.test('commit write failure retains HTTP 400 and the previous revision', async () => {
    failure = 'write';
    try {
      const result = await request('/api/app-state', { method: 'PUT', body: { state: {}, baseRevision: 'revision-1' } });
      assert.equal(result.status, 400);
      assert.deepEqual(result.body, { message: 'fixture write' });
      assert.equal(revision, 1);
    } finally { failure = ''; }
  });
  await t.test('bootstrap rewrite failure still reaches the global HTTP 500 handler', async () => {
    failure = 'rewrite';
    try {
      const result = await request('/api/app/bootstrap');
      assert.equal(result.status, 500);
      assert.deepEqual(result.body, { message: 'Erro interno no servidor.', requestId: 'fixture-request' });
    } finally { failure = ''; }
  });
  await t.test('manual backup token deduplicates per owner, not globally', async () => {
    assert.equal((await request('/api/backups/manual', { method: 'POST', body: { note: ' fixture ' } })).status, 200);
    assert.equal((await request('/api/backups/manual', { method: 'POST' })).status, 409);
    assert.equal((await request('/api/backups/manual', { user: 'b', method: 'POST' })).status, 200);
    assert.deepEqual(backups.map(item => item.owner), ['a', 'b']);
    assert.equal(backups[0].note, 'fixture');
  });
  await t.test('auto-exit backup accepts body CSRF but rejects an invalid token', async () => {
    assert.equal((await request('/api/backups/auto-exit', { method: 'POST', csrf: '', body: { csrfToken: 'bad' } })).status, 403);
    assert.equal((await request('/api/backups/auto-exit', { method: 'POST', csrf: '', body: { csrfToken: 'fixture-csrf' } })).status, 200);
    assert.equal(backups.at(-1).type, 'automatic');
  });
  await t.test('oversized request retains the generic HTTP 413 message', async () => {
    const result = await request('/api/app-state', { method: 'PUT', body: { state: { value: 'x'.repeat(3000) } } });
    assert.equal(result.status, 413);
    assert.deepEqual(result.body, { message: 'Os dados enviados s\u00e3o grandes demais para o servidor.' });
  });
});
