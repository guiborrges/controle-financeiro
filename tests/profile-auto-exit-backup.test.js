const test = require('node:test');
const assert = require('node:assert/strict');

const { registerProfileRoutes } = require('../server/http/routes/profile');

function createMockApp() {
  const routes = new Map();
  return {
    routes,
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers[handlers.length - 1]);
    },
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers[handlers.length - 1]);
    },
    put(path, ...handlers) {
      routes.set(`PUT ${path}`, handlers[handlers.length - 1]);
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

function createReq(overrides = {}) {
  return {
    session: { authenticated: true, user: { id: 'u1' } },
    body: {},
    get() {
      return '';
    },
    ...overrides
  };
}

function registerWithDeps(overrides = {}) {
  const app = createMockApp();
  const deps = {
    noStore: (_req, _res, next) => next?.(),
    requireAuth: (_req, _res, next) => next?.(),
    requireCsrf: (_req, _res, next) => next?.(),
    ensureCsrfToken: () => 'csrf-token',
    getAuthenticatedUser: () => ({
      id: 'u1',
      backupStats: {}
    }),
    buildPrivateProfile: () => ({}),
    createUserBackup: () => ({
      id: 'b1',
      createdAt: '2026-04-22T00:00:00.000Z',
      type: 'automatic'
    }),
    toClientBackupMeta: (value) => value,
    updateUser: () => ({}),
    syncUserAppStateLocation: () => {},
    isValidEmail: () => true,
    isValidBrazilPhone: () => true,
    verifyPassword: () => true,
    deriveDataKey: () => Buffer.from(''),
    readUserAppState: () => ({ state: {} }),
    hashPassword: () => 'hash',
    writeUserAppState: () => ({ updatedAt: '2026-04-22T00:00:00.000Z' }),
    getClientCryptoConfig: () => ({}),
    archiveDeletedUserAppState: () => {},
    deleteUserAppState: () => {},
    deleteUser: () => {},
    consumeOperationToken: () => ({ accepted: true, duplicate: false }),
    MIN_USER_PASSWORD_LENGTH: 4,
    ...overrides
  };
  registerProfileRoutes(app, deps);
  return { app, deps };
}

test('auto-exit backup accepts csrf from body and creates backup', () => {
  let created = 0;
  const { app } = registerWithDeps({
    createUserBackup: () => {
      created += 1;
      return {
        id: 'b_auto',
        createdAt: '2026-04-22T00:00:00.000Z',
        type: 'automatic'
      };
    }
  });
  const handler = app.routes.get('POST /api/backups/auto-exit');
  const req = createReq({
    body: {
      csrfToken: 'csrf-token',
      reason: 'beforeunload'
    }
  });
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(created, 1);
  assert.equal(res.payload?.ok, true);
  assert.equal(res.payload?.backup?.id, 'b_auto');
});

test('auto-exit backup respects cooldown and skips duplicate triggers', () => {
  let created = 0;
  const { app } = registerWithDeps({
    getAuthenticatedUser: () => ({
      id: 'u1',
      backupStats: {
        lastAutoExitBackupAt: new Date().toISOString()
      }
    }),
    createUserBackup: () => {
      created += 1;
      return {
        id: 'b_auto',
        createdAt: '2026-04-22T00:00:00.000Z',
        type: 'automatic'
      };
    }
  });
  const handler = app.routes.get('POST /api/backups/auto-exit');
  const req = createReq({
    body: {
      csrfToken: 'csrf-token',
      reason: 'pagehide'
    }
  });
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(created, 0);
  assert.equal(res.payload?.ok, true);
  assert.equal(res.payload?.skipped, true);
});

test('auto-exit backup rejects invalid csrf token', () => {
  const { app } = registerWithDeps();
  const handler = app.routes.get('POST /api/backups/auto-exit');
  const req = createReq({
    body: {
      csrfToken: 'wrong-token'
    }
  });
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 403);
  assert.match(String(res.payload?.message || ''), /csrf/i);
});

