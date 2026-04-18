const test = require('node:test');
const assert = require('node:assert/strict');

const { registerAppStateRoutes } = require('../server/http/routes/app-state');

function createMockApp() {
  const routes = new Map();
  return {
    routes,
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers[handlers.length - 1]);
    },
    put(path, ...handlers) {
      routes.set(`PUT ${path}`, handlers[handlers.length - 1]);
    },
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers[handlers.length - 1]);
    }
  };
}

function createMockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    }
  };
}

function registerWithDeps(overrides = {}) {
  const app = createMockApp();
  const deps = {
    noStore: (_req, _res, next) => next?.(),
    requireAuth: (_req, _res, next) => next?.(),
    requireCsrf: (_req, _res, next) => next?.(),
    getAuthenticatedUser: () => ({ id: 'u1', username: 'tester', displayName: 'Tester' }),
    touchUserActivity: () => {},
    findUserById: () => ({ id: 'u1', username: 'tester', displayName: 'Tester', permissions: {} }),
    readUserAppState: () => ({ state: { finData: [] }, updatedAt: '2026-04-18T00:00:00.000Z', encrypted: true }),
    recoverMissingMonthsFromLegacyBackups: (_id, state) => ({ changed: false, state }),
    USERS_DATA_DIR: '',
    writeUserAppState: () => ({ updatedAt: '2026-04-18T00:01:00.000Z' }),
    ensureCsrfToken: () => 'csrf',
    buildPrivateProfile: () => ({}),
    hasUserAppState: () => true,
    ...overrides
  };
  registerAppStateRoutes(app, deps);
  return { app, deps };
}

test('bootstrap returns stateRevision from persisted state', () => {
  const { app } = registerWithDeps({
    readUserAppState: () => ({ state: { finData: [] }, updatedAt: '2026-04-18T10:30:00.000Z', encrypted: true })
  });
  const handler = app.routes.get('GET /api/app/bootstrap');
  const req = { session: { dataEncryptionKey: 'k' } };
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.stateRevision, '2026-04-18T10:30:00.000Z');
});

test('put app-state rejects stale baseRevision with 409 conflict', () => {
  let wrote = false;
  const { app } = registerWithDeps({
    readUserAppState: () => ({ state: { finData: [] }, updatedAt: '2026-04-18T10:30:00.000Z', encrypted: true }),
    writeUserAppState: () => {
      wrote = true;
      return { updatedAt: '2026-04-18T10:31:00.000Z' };
    }
  });
  const handler = app.routes.get('PUT /api/app-state');
  const req = {
    session: { dataEncryptionKey: 'k' },
    body: {
      state: { finData: [] },
      baseRevision: '2026-04-18T10:00:00.000Z'
    }
  };
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.payload.conflict, true);
  assert.equal(wrote, false);
});

test('put app-state accepts matching baseRevision and persists', () => {
  let wrote = false;
  const { app } = registerWithDeps({
    readUserAppState: () => ({ state: { finData: [] }, updatedAt: '2026-04-18T10:30:00.000Z', encrypted: true }),
    writeUserAppState: () => {
      wrote = true;
      return { updatedAt: '2026-04-18T10:31:00.000Z' };
    }
  });
  const handler = app.routes.get('PUT /api/app-state');
  const req = {
    session: { dataEncryptionKey: 'k' },
    body: {
      state: { finData: [] },
      baseRevision: '2026-04-18T10:30:00.000Z'
    }
  };
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(wrote, true);
});
