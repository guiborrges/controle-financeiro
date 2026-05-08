const crypto = require('crypto');
const { buildWidgetScript } = require('../../widget-script-template');

function maskToken(token) {
  const value = String(token || '').trim();
  if (!value) return '';
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function buildTokenIndex(users = []) {
  const index = new Map();
  users.forEach(user => {
    const token = String(user?.widgetToken || '').trim();
    if (!token) return;
    index.set(token, user);
  });
  return index;
}

function registerWidgetRoutes(app, deps = {}) {
  const noStore = typeof deps.noStore === 'function' ? deps.noStore : ((_, __, next) => next());
  const requireAuth = typeof deps.requireAuth === 'function' ? deps.requireAuth : ((_, __, next) => next());
  const requireCsrf = typeof deps.requireCsrf === 'function' ? deps.requireCsrf : ((_, __, next) => next());
  const getAuthenticatedUser = typeof deps.getAuthenticatedUser === 'function' ? deps.getAuthenticatedUser : () => null;
  const updateUser = typeof deps.updateUser === 'function' ? deps.updateUser : () => null;
  const readUsersStore = typeof deps.readUsersStore === 'function' ? deps.readUsersStore : () => ({ users: [] });
  const readWidgetSnapshot = typeof deps.readWidgetSnapshot === 'function' ? deps.readWidgetSnapshot : () => null;
  const readUserAppState = typeof deps.readUserAppState === 'function' ? deps.readUserAppState : () => null;
  const buildWidgetSnapshot = typeof deps.buildWidgetSnapshot === 'function' ? deps.buildWidgetSnapshot : null;
  const saveWidgetSnapshot = typeof deps.saveWidgetSnapshot === 'function' ? deps.saveWidgetSnapshot : null;

  app.post('/api/widget/generate-token', noStore, requireAuth, requireCsrf, (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
    }
    const token = crypto.randomBytes(40).toString('hex');
    updateUser(user.id, { widgetToken: token });
    if (buildWidgetSnapshot && saveWidgetSnapshot) {
      try {
        const statePayload = readUserAppState(user.id, req.session?.dataEncryptionKey || '');
        const state = statePayload?.state && typeof statePayload.state === 'object' ? statePayload.state : null;
        if (state) {
          const snapshot = buildWidgetSnapshot(user.id, state);
          saveWidgetSnapshot(user.id, snapshot);
        }
      } catch (error) {
        console.error('[widget] Falha ao gerar snapshot inicial:', error?.message || String(error));
      }
    }
    return res.json({ ok: true, token });
  });

  app.post('/api/widget/revoke-token', noStore, requireAuth, requireCsrf, (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
    }
    updateUser(user.id, { widgetToken: '' });
    return res.json({ ok: true });
  });

  app.get('/api/widget/token-status', noStore, requireAuth, (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
    }
    const token = String(user?.widgetToken || '').trim();
    return res.json({
      hasToken: !!token,
      tokenPreview: maskToken(token)
    });
  });

  app.get('/api/widget/finance-summary', noStore, (req, res) => {
    const token = String(req.query?.token || '').trim().toLowerCase();
    if (!token) {
      return res.status(401).json({ error: 'Token ausente.' });
    }
    if (!/^[a-f0-9]{80}$/.test(token)) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const store = readUsersStore();
    const users = Array.isArray(store?.users) ? store.users : [];
    const tokenIndex = buildTokenIndex(users);
    const user = tokenIndex.get(token);
    if (!user) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const snapshot = readWidgetSnapshot(user.id);
    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot não encontrado.' });
    }
    return res.json(snapshot);
  });

  app.get('/api/widget/script/latest', noStore, (req, res) => {
    const token = String(req.query?.token || '').trim().toLowerCase();
    if (!token) {
      return res.status(401).json({ error: 'Token ausente.' });
    }
    if (!/^[a-f0-9]{80}$/.test(token)) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const store = readUsersStore();
    const users = Array.isArray(store?.users) ? store.users : [];
    const tokenIndex = buildTokenIndex(users);
    const user = tokenIndex.get(token);
    if (!user) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const code = buildWidgetScript(token, baseUrl);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(code);
  });

  app.all('/api/widget/finance-summary', noStore, (_req, res) => {
    return res.status(405).json({ error: 'Method Not Allowed' });
  });
}

module.exports = {
  registerWidgetRoutes
};
