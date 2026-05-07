const test = require('node:test');
const assert = require('node:assert/strict');

const {
  registerPluggyWebhookRoutes,
  resolveTenantUserId,
  normalizeTransactionsFromWebhook,
  getEventType,
  getItem
} = require('../server/http/routes/pluggy-webhook');

function createMockApp() {
  const routes = new Map();
  return {
    routes,
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

test('webhook helper resolves tenant from payload fields', () => {
  assert.equal(resolveTenantUserId({ clientUserId: 'u1' }), 'u1');
  assert.equal(resolveTenantUserId({ data: { clientUserId: 'u2' } }), 'u2');
  assert.equal(resolveTenantUserId({ data: { item: { clientUserId: 'u3' } } }), 'u3');
});

test('webhook helper normalizes event + item + tx list', () => {
  assert.equal(getEventType({ event: 'transactions/created' }), 'transactions/created');
  assert.deepEqual(normalizeTransactionsFromWebhook({ data: { transactions: [{ id: 't1' }] } }), [{ id: 't1' }]);
  assert.equal(getItem({ data: { item: { id: 'item-1' } } }).id, 'item-1');
});

test('webhook uses resolved tenant for item and transactions upsert', async () => {
  const app = createMockApp();
  const calls = [];

  registerPluggyWebhookRoutes(app, {
    noStore: (_req, _res, next) => next?.(),
    webhookSecret: 'secret-1',
    upsertConnection: async (item, tenantUserId) => {
      calls.push({ kind: 'item', tenantUserId, itemId: item.id });
    },
    upsertTransactions: async (items, tenantUserId) => {
      calls.push({ kind: 'tx', tenantUserId, count: items.length });
      return { inserted: items.length, skipped: 0 };
    }
  });

  const itemReq = {
    headers: { 'x-pluggy-webhook-secret': 'secret-1' },
    body: {
      event: 'item/created',
      data: { item: { id: 'it-1' }, clientUserId: 'user-A' }
    }
  };
  const itemRes = createMockRes();
  const webhookHandler = app.routes.get('POST /api/pluggy/webhook');
  await webhookHandler(itemReq, itemRes);
  assert.equal(itemRes.statusCode, 200);

  const txReq = {
    headers: { 'x-pluggy-webhook-secret': 'secret-1' },
    body: {
      event: 'transactions/created',
      clientUserId: 'user-B',
      data: { transactions: [{ id: 'tx-1' }, { id: 'tx-2' }] }
    }
  };
  const txRes = createMockRes();
  await webhookHandler(txReq, txRes);
  assert.equal(txRes.statusCode, 200);

  assert.deepEqual(calls, [
    { kind: 'item', tenantUserId: 'user-A', itemId: 'it-1' },
    { kind: 'tx', tenantUserId: 'user-B', count: 2 }
  ]);
});

test('webhook rejects invalid secret when configured', async () => {
  const app = createMockApp();
  registerPluggyWebhookRoutes(app, {
    noStore: (_req, _res, next) => next?.(),
    webhookSecret: 'expected',
    upsertConnection: async () => {},
    upsertTransactions: async () => ({ inserted: 0, skipped: 0 })
  });

  const res = createMockRes();
  await app.routes.get('POST /api/pluggy/webhook')({
    headers: { 'x-pluggy-webhook-secret': 'wrong' },
    body: { event: 'item/created', data: { item: { id: 'it-1' } } }
  }, res);
  assert.equal(res.statusCode, 401);
});
