const test = require('node:test');
const assert = require('node:assert/strict');

const { registerWidgetRoutes } = require('../server/http/routes/widget');
const { buildWidgetSnapshot } = require('../server/widget-snapshot');

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
    all(path, ...handlers) {
      routes.set(`ALL ${path}`, handlers[handlers.length - 1]);
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

function registerRoutes(overrides = {}) {
  const app = createMockApp();
  const users = overrides.users || [{ id: 'u1', widgetToken: '' }];
  const snapshots = overrides.snapshots || new Map();
  const deps = {
    noStore: (_req, _res, next) => next?.(),
    requireAuth: (_req, _res, next) => next?.(),
    requireCsrf: (_req, _res, next) => next?.(),
    getAuthenticatedUser: req => req.user || users[0] || null,
    readUsersStore: () => ({ users }),
    updateUser: (userId, patch) => {
      const index = users.findIndex(user => user.id === userId);
      if (index < 0) return null;
      users[index] = { ...users[index], ...patch };
      return users[index];
    },
    readWidgetSnapshot: userId => snapshots.get(userId) || null,
    ...overrides.deps
  };
  registerWidgetRoutes(app, deps);
  return { app, users, snapshots, deps };
}

test('POST /api/widget/generate-token returns 80-char hex token', () => {
  const { app, users } = registerRoutes();
  const handler = app.routes.get('POST /api/widget/generate-token');
  const req = { user: users[0] };
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.match(String(res.payload.token || ''), /^[a-f0-9]{80}$/);
  assert.equal(users[0].widgetToken, res.payload.token);
});

test('POST /api/widget/revoke-token clears token', () => {
  const { app, users } = registerRoutes({ users: [{ id: 'u1', widgetToken: 'a'.repeat(80) }] });
  const handler = app.routes.get('POST /api/widget/revoke-token');
  const req = { user: users[0] };
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(users[0].widgetToken, '');
});

test('GET /api/widget/finance-summary with valid token returns snapshot', () => {
  const token = 'b'.repeat(80);
  const snapshots = new Map([['u1', { monthLabel: 'Maio 2026', monthlyExpenses: 100, result: 50, goals: [] }]]);
  const { app } = registerRoutes({ users: [{ id: 'u1', widgetToken: token }], snapshots });
  const handler = app.routes.get('GET /api/widget/finance-summary');
  const req = { query: { token } };
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.monthLabel, 'Maio 2026');
  assert.equal(res.payload.monthlyExpenses, 100);
});

test('GET /api/widget/finance-summary with invalid token returns 401', () => {
  const token = 'c'.repeat(80);
  const { app } = registerRoutes({ users: [{ id: 'u1', widgetToken: token }] });
  const handler = app.routes.get('GET /api/widget/finance-summary');
  const req = { query: { token: 'z'.repeat(80) } };
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 401);
});

test('GET /api/widget/finance-summary without token returns 401', () => {
  const { app } = registerRoutes();
  const handler = app.routes.get('GET /api/widget/finance-summary');
  const req = { query: {} };
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 401);
});

test('widget endpoint isolates users by token', () => {
  const tokenA = 'a'.repeat(80);
  const tokenB = 'b'.repeat(80);
  const snapshots = new Map([
    ['uA', { owner: 'A', result: 1 }],
    ['uB', { owner: 'B', result: 2 }]
  ]);
  const { app } = registerRoutes({
    users: [
      { id: 'uA', widgetToken: tokenA },
      { id: 'uB', widgetToken: tokenB }
    ],
    snapshots
  });
  const handler = app.routes.get('GET /api/widget/finance-summary');
  const resA = createMockRes();
  handler({ query: { token: tokenA } }, resA);
  assert.equal(resA.payload.owner, 'A');
  const resB = createMockRes();
  handler({ query: { token: tokenB } }, resB);
  assert.equal(resB.payload.owner, 'B');
});

test('buildWidgetSnapshot computes monthlyExpenses and result correctly', () => {
  const year = new Date().getFullYear();
  const monthNames = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const monthId = `${monthNames[new Date().getMonth()]}_${year}`;
  const state = {
    finData: [{
      id: monthId,
      outflows: [
        { type: 'spend', outputKind: 'pix', amount: 200, countsInPrimaryTotals: true, category: 'ALIMENTAÇÃO' },
        { type: 'spend', outputKind: 'card', amount: 50, countsInPrimaryTotals: true, category: 'ALIMENTAÇÃO' },
        { type: 'expense', amount: 100, countsInPrimaryTotals: true, category: 'MORADIA' }
      ],
      cardBills: [{ amount: 300 }],
      renda: [{ valor: 1200, paid: true }],
      projetos: [{ valor: 100, paid: true }],
      dailyGoals: { 'ALIMENTAÇÃO': 500, 'MORADIA': 0 }
    }],
    finCategoryEmojis: { 'ALIMENTAÇÃO': '🍽️' }
  };
  const snapshot = buildWidgetSnapshot('u1', state);
  assert.equal(snapshot.monthlyExpenses, 600);
  assert.equal(snapshot.monthlyIncome, 1300);
  assert.equal(snapshot.result, 700);
});

test('buildWidgetSnapshot includes only goals with value > 0', () => {
  const year = new Date().getFullYear();
  const monthNames = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const monthId = `${monthNames[new Date().getMonth()]}_${year}`;
  const snapshot = buildWidgetSnapshot('u1', {
    finData: [{
      id: monthId,
      outflows: [{ category: 'ALIMENTAÇÃO', amount: 100, countsInPrimaryTotals: true }],
      cardBills: [],
      renda: [],
      projetos: [],
      dailyGoals: { 'ALIMENTAÇÃO': 200, 'SAÚDE': 0 }
    }],
    finCategoryEmojis: { 'ALIMENTAÇÃO': '🍽️' }
  });
  assert.equal(snapshot.goals.length, 1);
  assert.equal(snapshot.goals[0].category, 'ALIMENTAÇÃO');
});

test('buildWidgetSnapshot returns empty goals when dailyGoals is missing', () => {
  const year = new Date().getFullYear();
  const monthNames = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const monthId = `${monthNames[new Date().getMonth()]}_${year}`;
  const snapshot = buildWidgetSnapshot('u1', {
    finData: [{ id: monthId, outflows: [], cardBills: [], renda: [], projetos: [] }]
  });
  assert.deepEqual(snapshot.goals, []);
});

test('non-GET /api/widget/finance-summary returns 405', () => {
  const { app } = registerRoutes();
  const handler = app.routes.get('ALL /api/widget/finance-summary');
  const res = createMockRes();
  handler({}, res);
  assert.equal(res.statusCode, 405);
});

