const test = require('node:test');
const assert = require('node:assert/strict');

const { registerPluggyPreviewRoutes, resolveTenantUserId } = require('../server/http/routes/pluggy-preview');

function createMockApp() {
  const routes = new Map();
  return {
    routes,
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers[handlers.length - 1]);
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

test('resolveTenantUserId prioritizes stable user identity fields', () => {
  assert.equal(resolveTenantUserId({ id: 'u-1', username: 'x' }), 'u-1');
  assert.equal(resolveTenantUserId({ username: 'user-a' }), 'user-a');
  assert.equal(resolveTenantUserId({ email: 'a@b.com' }), 'a@b.com');
  assert.equal(resolveTenantUserId(null), '');
});

test('pluggy preview routes use authenticated user tenant id (no cross-user leakage)', async () => {
  const app = createMockApp();
  const seenTenants = [];
  process.env.PLUGGY_ALLOWED_USER_IDS = 'user-A,user-B';

  registerPluggyPreviewRoutes(app, {
    noStore: (_req, _res, next) => next?.(),
    requireAuth: (_req, _res, next) => next?.(),
    getAuthenticatedUser: req => req.user,
    loadConnectionSummary: async tenantUserId => {
      seenTenants.push(`conn:${tenantUserId}`);
      return [{ pluggyItemId: `item-${tenantUserId}` }];
    },
    loadTransactions: async tenantUserId => {
      seenTenants.push(`tx:${tenantUserId}`);
      return [{
        id: `tx-${tenantUserId}`,
        itemId: 'item1',
        accountId: 'acc-1',
        accountName: 'Conta A',
        accountType: 'BANK',
        amount: 10,
        updatedAt: '2026-05-07T00:00:00.000Z'
      }];
    }
  });

  const handler = app.routes.get('GET /api/pluggy/transactions');
  const reqA = { user: { id: 'user-A', username: 'a' }, query: {} };
  const resA = createMockRes();
  await handler(reqA, resA);

  const reqB = { user: { id: 'user-B', username: 'b' }, query: {} };
  const resB = createMockRes();
  await handler(reqB, resB);

  assert.equal(resA.statusCode, 200);
  assert.equal(resB.statusCode, 200);
  assert.equal(resA.payload.tenantUserId, 'user-A');
  assert.equal(resB.payload.tenantUserId, 'user-B');
  assert.deepEqual(seenTenants, ['conn:user-A', 'tx:user-A', 'conn:user-B', 'tx:user-B']);
  delete process.env.PLUGGY_ALLOWED_USER_IDS;
});

test('pluggy preview route blocks not-allowed users', async () => {
  const app = createMockApp();
  registerPluggyPreviewRoutes(app, {
    noStore: (_req, _res, next) => next?.(),
    requireAuth: (_req, _res, next) => next?.(),
    getAuthenticatedUser: () => ({ id: 'u-x', username: 'nao-permitido', fullName: 'Outro User' }),
    loadConnectionSummary: async () => [],
    loadTransactions: async () => []
  });

  const handler = app.routes.get('GET /api/pluggy/preview');
  const res = createMockRes();
  await handler({ query: {} }, res);
  assert.equal(res.statusCode, 403);
});

test('pluggy transactions route sanitizes invalid limit query', async () => {
  const app = createMockApp();
  const seenLimits = [];
  process.env.PLUGGY_ALLOWED_USER_IDS = 'user-A';

  registerPluggyPreviewRoutes(app, {
    noStore: (_req, _res, next) => next?.(),
    requireAuth: (_req, _res, next) => next?.(),
    getAuthenticatedUser: () => ({ id: 'user-A', username: 'a' }),
    loadConnectionSummary: async () => [],
    loadTransactions: async (_tenantUserId, limit) => {
      seenLimits.push(limit);
      return [];
    }
  });

  const handler = app.routes.get('GET /api/pluggy/transactions');
  const res = createMockRes();
  await handler({ query: { limit: 'abc' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(seenLimits, [1200]);
  delete process.env.PLUGGY_ALLOWED_USER_IDS;
});
