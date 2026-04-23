const test = require('node:test');
const assert = require('node:assert/strict');

const { registerAuthRoutes } = require('../server/http/routes/auth');

function createMockApp() {
  const routes = new Map();
  return {
    routes,
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers[handlers.length - 1]);
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
    cookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
    },
    clearCookie() {}
  };
}

function createBaseDeps(overrides = {}) {
  return {
    noStore: (_req, _res, next) => next?.(),
    requireAuth: (_req, _res, next) => next?.(),
    requireCsrf: (_req, _res, next) => next?.(),
    createRateLimit: () => (_req, _res, next) => next?.(),
    rateLimitState: new Map(),
    getLoginConfig: () => ({ allowRegistration: true }),
    hasDeveloperPassword: () => false,
    getAuthenticatedUser: () => null,
    ensureCsrfToken: () => 'csrf-token',
    findUserByEmail: () => null,
    verifyPassword: () => false,
    registerUserLogin: userId => ({
      id: userId,
      username: 'tester',
      displayName: 'Tester',
      fullName: 'Tester',
      encryptionSalt: 'salt',
      legacyRecurrenceBackfillRestricted: false,
      permissions: {}
    }),
    findUserById: () => null,
    deriveDataKey: () => Buffer.from('k'.repeat(32)),
    issueRememberMeToken: () => 'remember-token',
    setRememberMeCookie: () => {},
    clearRememberMeCookie: () => {},
    buildPublicProfile: user => user,
    createUser: payload => ({
      id: 'new-user',
      username: 'new-user',
      displayName: payload.displayName,
      fullName: payload.fullName,
      encryptionSalt: 'salt',
      permissions: {}
    }),
    writeUserAppState: () => {},
    buildFreshUserAppState: () => ({ finData: [] }),
    hashPassword: () => 'hash',
    normalizeBirthDate: value => String(value || '').replace(/\D/g, ''),
    isValidEmail: () => true,
    isValidBrazilPhone: () => true,
    getClientCryptoConfig: () => ({ ok: true }),
    parseCookies: () => ({}),
    REMEMBER_COOKIE_NAME: 'fin.remember',
    revokeRememberMeToken: () => {},
    MIN_USER_PASSWORD_LENGTH: 8,
    REMEMBER_ME_MAX_AGE_MS: 1000,
    crypto: { randomBytes: () => ({ toString: () => 'csrf-random' }) },
    ...overrides
  };
}

test('auth login rejects invalid credentials', () => {
  const app = createMockApp();
  registerAuthRoutes(app, createBaseDeps({
    findUserByEmail: () => null
  }));
  const handler = app.routes.get('POST /api/auth/login');
  const req = {
    body: { email: 'x@y.com', password: 'wrong' },
    session: {
      regenerate(callback) { callback?.(null); }
    }
  };
  const res = createMockRes();
  handler(req, res, () => {});
  assert.equal(res.statusCode, 401);
  assert.match(String(res.payload?.message || ''), /inv/i);
});

test('auth login success populates authenticated session payload', () => {
  const app = createMockApp();
  const user = {
    id: 'u-auth-1',
    username: 'tester',
    displayName: 'Tester',
    fullName: 'Tester',
    email: 't@x.com',
    encryptionSalt: 'salt',
    legacyRecurrenceBackfillRestricted: true,
    permissions: { canAccessESO: true }
  };
  registerAuthRoutes(app, createBaseDeps({
    findUserByEmail: () => user,
    verifyPassword: () => true,
    registerUserLogin: () => user
  }));
  const handler = app.routes.get('POST /api/auth/login');
  const req = {
    body: { email: user.email, password: 'ok', rememberMe: false },
    session: {
      regenerate(callback) { callback?.(null); },
      cookie: {}
    }
  };
  const res = createMockRes();
  handler(req, res, () => {});
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.ok, true);
  assert.equal(req.session?.authenticated, true);
  assert.equal(req.session?.user?.id, user.id);
  assert.equal(req.session?.user?.legacyRecurrenceBackfillRestricted, true);
  assert.equal(typeof req.session?.dataEncryptionKey, 'string');
});

test('auth session payload exposes recurrence restriction flag', () => {
  const app = createMockApp();
  registerAuthRoutes(app, createBaseDeps({
    getAuthenticatedUser: () => ({
      id: 'u-auth-2',
      username: 'legacy',
      displayName: 'Legacy',
      fullName: 'Legacy',
      email: 'legacy@test.local',
      legacyRecurrenceBackfillRestricted: true,
      permissions: { canAccessESO: false }
    })
  }));
  const handler = app.routes.get('GET /api/auth/session');
  const req = { session: { authenticated: true } };
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.legacyRecurrenceBackfillRestricted, true);
});

