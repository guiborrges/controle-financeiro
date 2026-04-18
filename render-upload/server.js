const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT_DIR, resolveStoragePath } = require('./server/paths');

const { verifyPassword, hashPassword } = require('./server/password');
const {
  DATA_KEY_ALGORITHM,
  DATA_KEY_ITERATIONS,
  deriveDataKey,
  encryptDataWithKey,
  decryptDataWithKey
} = require('./server/data-crypto');
const {
  ensureUsersStore,
  readUsersStore,
  findUserById,
  findUserByUsername,
  findUserByEmail,
  buildPublicProfile,
  buildPrivateProfile,
  getLoginConfig,
  createUser,
  updateUser,
  deleteUser
} = require('./server/user-store');
const {
  hasUserAppState,
  readUserAppState,
  writeUserAppState,
  deleteUserAppState,
  archiveDeletedUserAppState,
  purgeExpiredDeletedUserBackups,
  buildFreshUserAppState,
  syncUserAppStateLocation,
  syncAllUserAppStateLocations
} = require('./server/app-state-store');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const LOGIN_DIR = path.join(ROOT_DIR, 'public', 'login');
const APP_DIR = path.join(ROOT_DIR, 'public', 'app');
const SHARED_DIR = path.join(ROOT_DIR, 'public', 'shared');
const SESSION_SECRET_PATH = resolveStoragePath('auth', 'session-secret.txt');
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const rateLimitState = new Map();
const REMEMBER_COOKIE_NAME = 'fin.remember';
const REMEMBER_ME_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

ensureUsersStore();
syncAllUserAppStateLocations();
purgeExpiredDeletedUserBackups();

function getClientCryptoConfig(user) {
  return {
    salt: user?.encryptionSalt || '',
    algorithm: String(DATA_KEY_ALGORITHM || 'sha512').toUpperCase().replace(/^SHA(\d+)$/, 'SHA-$1'),
    iterations: DATA_KEY_ITERATIONS
  };
}

function ensureSessionSecret() {
  if (process.env.FIN_SESSION_SECRET) return process.env.FIN_SESSION_SECRET;
  if (fs.existsSync(SESSION_SECRET_PATH)) {
    return fs.readFileSync(SESSION_SECRET_PATH, 'utf8').trim();
  }
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(SESSION_SECRET_PATH, `${secret}\n`, 'utf8');
  return secret;
}

function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return acc;
    const key = part.slice(0, idx).trim();
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) acc[key] = value;
    return acc;
  }, {});
}

function hashRememberToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('base64');
}

function deriveRememberTokenKey(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('base64');
}

function pruneRememberTokens(tokens) {
  const now = Date.now();
  return (Array.isArray(tokens) ? tokens : []).filter(token => {
    const expiresAt = Date.parse(token?.expiresAt || '');
    return token?.tokenHash && expiresAt && expiresAt > now;
  });
}

function setRememberMeCookie(res, token) {
  res.cookie(REMEMBER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: REMEMBER_ME_MAX_AGE_MS,
    path: '/'
  });
}

function clearRememberMeCookie(res) {
  res.clearCookie(REMEMBER_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
}

function issueRememberMeToken(user, dataEncryptionKey) {
  const plainToken = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + REMEMBER_ME_MAX_AGE_MS).toISOString();
  const tokenKey = deriveRememberTokenKey(plainToken);
  const rememberTokens = pruneRememberTokens(user?.rememberTokens);
  rememberTokens.push({
    tokenHash: hashRememberToken(plainToken),
    expiresAt,
    wrappedKey: encryptDataWithKey({ dataEncryptionKey }, tokenKey)
  });
  updateUser(user.id, { rememberTokens });
  return plainToken;
}

function revokeRememberMeToken(user, plainToken) {
  if (!user || !plainToken) return;
  const tokenHash = hashRememberToken(plainToken);
  const rememberTokens = pruneRememberTokens(user.rememberTokens).filter(token => token.tokenHash !== tokenHash);
  updateUser(user.id, { rememberTokens });
}

function restoreRememberedSession(req, res, next) {
  if (req.session?.authenticated) return next();
  const cookies = parseCookies(req);
  const rememberToken = cookies[REMEMBER_COOKIE_NAME];
  if (!rememberToken) return next();

  const tokenHash = hashRememberToken(rememberToken);
  let matchedToken = null;
  const user = (readUsersStore().users || []).find(candidate => {
    const token = pruneRememberTokens(candidate.rememberTokens).find(item => item.tokenHash === tokenHash);
    if (token) matchedToken = token;
    return !!token;
  });

  if (!user || !matchedToken?.wrappedKey) {
    clearRememberMeCookie(res);
    return next();
  }

  let dataEncryptionKey = '';
  try {
    const tokenKey = deriveRememberTokenKey(rememberToken);
    const payload = decryptDataWithKey(matchedToken.wrappedKey, tokenKey);
    dataEncryptionKey = payload?.dataEncryptionKey || '';
  } catch {
    clearRememberMeCookie(res);
    revokeRememberMeToken(user, rememberToken);
    return next();
  }

  req.session.authenticated = true;
  req.session.user = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    fullName: user.fullName || user.displayName,
    permissions: {
      canAccessESO: !!user.permissions?.canAccessESO
    }
  };
  req.session.dataEncryptionKey = dataEncryptionKey;
  ensureCsrfToken(req);
  return next();
}

function applySecurityHeaders(req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

function ensureCsrfToken(req) {
  if (!req.session) return '';
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('base64url');
  }
  return req.session.csrfToken;
}

function requireCsrf(req, res, next) {
  if (!req.session?.authenticated) {
    return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
  }
  const expected = ensureCsrfToken(req);
  const received = req.get('X-CSRF-Token') || '';
  if (!received || received !== expected) {
    return res.status(403).json({ message: 'Token CSRF inválido.' });
  }
  return next();
}

function createRateLimit({ keyPrefix, maxAttempts, windowMs = RATE_LIMIT_WINDOW_MS }) {
  return function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${String(ip)}`;
    const now = Date.now();
    const bucket = rateLimitState.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      rateLimitState.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }
    if (bucket.count >= maxAttempts) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ message: 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.' });
    }
    bucket.count += 1;
    rateLimitState.set(key, bucket);
    return next();
  };
}

function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  if (req.accepts('html')) {
    return res.redirect('/login');
  }
  return res.status(401).json({ authenticated: false, message: 'Sessão expirada ou inexistente.' });
}

function getAuthenticatedUser(req) {
  if (!req.session?.user?.id) return null;
  return findUserById(req.session.user.id);
}

function normalizeBirthDate(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 8);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isValidBrazilPhone(value) {
  return /^\d{10,11}$/.test(String(value || '').replace(/\D/g, ''));
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(applySecurityHeaders);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '5mb' }));
app.use(session({
  name: 'fin.sid',
  secret: ensureSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));
app.use(restoreRememberedSession);

app.use('/login-assets', noStore, express.static(LOGIN_DIR, { index: false }));
app.use('/shared-assets', noStore, express.static(SHARED_DIR, { index: false }));
app.use('/app-assets', noStore, requireAuth, express.static(APP_DIR, { index: false, fallthrough: false }));

app.get('/', noStore, (req, res) => {
  res.redirect(req.session?.authenticated ? '/app' : '/login');
});

app.get('/login', noStore, (req, res) => {
  if (req.session?.authenticated) {
    return res.redirect('/app');
  }
  return res.sendFile(path.join(LOGIN_DIR, 'index.html'));
});

app.get('/app', noStore, requireAuth, (req, res) => {
  res.sendFile(path.join(APP_DIR, 'index.html'));
});

app.get('/api/auth/login-config', noStore, (req, res) => {
  res.json(getLoginConfig());
});

app.get('/api/auth/session', noStore, (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!req.session?.authenticated || !user) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({
    authenticated: true,
    id: user.id,
    username: user.username,
    email: user.email || '',
    displayName: user.displayName,
    fullName: user.fullName || user.displayName,
    csrfToken: ensureCsrfToken(req),
    permissions: {
      canAccessESO: !!user.permissions?.canAccessESO
    }
  });
});

app.post('/api/auth/password-hint', noStore, createRateLimit({ keyPrefix: 'hint', maxAttempts: 10 }), (req, res) => {
  const { email = '', birthDate = '' } = req.body || {};
  const user = findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ message: 'E-mail ou data de nascimento incorretos.' });
  }
  if (!user.birthDate) {
    return res.status(400).json({ message: 'Nenhuma data de nascimento foi cadastrada ainda.' });
  }
  if (normalizeBirthDate(birthDate) !== normalizeBirthDate(user.birthDate)) {
    return res.status(401).json({ message: 'E-mail ou data de nascimento incorretos.' });
  }
  return res.json({
    hint: user.passwordHint || 'Nenhuma dica foi cadastrada.'
  });
});

app.post('/api/auth/login', noStore, createRateLimit({ keyPrefix: 'login', maxAttempts: 10 }), (req, res, next) => {
  try {
    const { email = '', password = '', rememberMe = false } = req.body || {};
    const user = findUserByEmail(email);
    const passwordOk = !!user && !!password && verifyPassword(password, user.passwordHash);

    if (!user || !passwordOk) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
    }

    req.session.regenerate(error => {
      if (error) return next(error);
      const encryptionKey = deriveDataKey(password, user.encryptionSalt).toString('base64');
      req.session.authenticated = true;
      req.session.dataEncryptionKey = encryptionKey;
      req.session.csrfToken = crypto.randomBytes(32).toString('base64url');
      req.session.user = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        fullName: user.fullName || user.displayName,
        permissions: {
          canAccessESO: !!user.permissions?.canAccessESO
        }
      };
      if (rememberMe === true || rememberMe === 'true' || rememberMe === 1 || rememberMe === '1') {
        req.session.cookie.maxAge = REMEMBER_ME_MAX_AGE_MS;
        const rememberToken = issueRememberMeToken(user, encryptionKey);
        setRememberMeCookie(res, rememberToken);
      } else {
        req.session.cookie.expires = false;
        req.session.cookie.maxAge = null;
        clearRememberMeCookie(res);
      }
      return res.json({ ok: true, crypto: getClientCryptoConfig(user) });
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/register', noStore, createRateLimit({ keyPrefix: 'register', maxAttempts: 5 }), (req, res, next) => {
  try {
    const {
      fullName = '',
      email = '',
      phone = '',
      birthDate = '',
      password = '',
      passwordHint = ''
    } = req.body || {};

    const cleanFullName = String(fullName).trim();
    const cleanEmail = String(email).trim();
    const cleanPhone = String(phone).trim();
    const cleanBirthDate = String(birthDate).trim();
    const cleanPassword = String(password);
    const cleanPasswordHint = String(passwordHint).trim();

    if (!cleanFullName || !cleanEmail || !cleanPhone || !cleanBirthDate || !cleanPassword) {
      return res.status(400).json({ message: 'Preencha todos os campos obrigatórios.' });
    }
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ message: 'Digite um e-mail válido.' });
    }
    if (!isValidBrazilPhone(cleanPhone)) {
      return res.status(400).json({ message: 'Digite um celular brasileiro válido.' });
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(cleanBirthDate)) {
      return res.status(400).json({ message: 'Digite a data de nascimento no formato dd/mm/aaaa.' });
    }
    if (cleanPassword.length < 8) {
      return res.status(400).json({ message: 'A senha precisa ter pelo menos 8 caracteres.' });
    }

    const user = createUser({
      email: cleanEmail,
      phone: cleanPhone,
      fullName: cleanFullName,
      displayName: cleanFullName.split(/\s+/)[0] || cleanFullName,
      birthDate: cleanBirthDate,
      passwordHint: cleanPasswordHint,
      passwordHash: hashPassword(cleanPassword),
      permissions: {
        canAccessESO: false
      }
    });
    const encryptionKey = deriveDataKey(cleanPassword, user.encryptionSalt).toString('base64');
    writeUserAppState(user.id, buildFreshUserAppState(), encryptionKey);

    req.session.regenerate(error => {
      if (error) return next(error);
      req.session.authenticated = true;
      req.session.dataEncryptionKey = encryptionKey;
      req.session.csrfToken = crypto.randomBytes(32).toString('base64url');
      req.session.user = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        fullName: user.fullName || user.displayName,
        permissions: {
          canAccessESO: !!user.permissions?.canAccessESO
        }
      };
      return res.status(201).json({
        ok: true,
        user: buildPublicProfile(user),
        crypto: getClientCryptoConfig(user)
      });
    });
  } catch (error) {
    if (error?.message) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
});

app.get('/api/profile', noStore, requireAuth, (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
  }
  res.json(buildPrivateProfile(user));
});

app.put('/api/profile', noStore, requireAuth, (req, res) => {
  if (!req.get('X-CSRF-Token') || req.get('X-CSRF-Token') !== ensureCsrfToken(req)) {
    return res.status(403).json({ message: 'Token CSRF inválido.' });
  }
  try {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
    }
    const nextProfile = {
      displayName: String(req.body?.displayName || '').trim() || user.displayName,
      fullName: String(req.body?.fullName || '').trim(),
      birthDate: String(req.body?.birthDate || '').trim(),
      phone: String(req.body?.phone || '').trim(),
      email: String(req.body?.email || '').trim(),
      passwordHint: String(req.body?.passwordHint || '').trim()
    };
    if (!isValidEmail(nextProfile.email)) {
      return res.status(400).json({ message: 'Digite um e-mail válido.' });
    }
    if (nextProfile.phone && !isValidBrazilPhone(nextProfile.phone)) {
      return res.status(400).json({ message: 'Digite um celular brasileiro válido.' });
    }
    const nextUser = updateUser(user.id, nextProfile);
    syncUserAppStateLocation(nextUser.id);
    if (req.session?.user) {
      req.session.user.displayName = nextUser.displayName;
      req.session.user.fullName = nextUser.fullName || nextUser.displayName;
    }
    res.json({
      ok: true,
      profile: buildPrivateProfile(nextUser)
    });
  } catch (error) {
    if (error?.message) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Erro interno no servidor.' });
  }
});

app.post('/api/profile/change-password', noStore, requireAuth, requireCsrf, (req, res) => {
  const { currentPassword = '', newPassword = '', confirmPassword = '' } = req.body || {};
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(401).json({ message: 'Senha atual incorreta.' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ message: 'A nova senha precisa ter pelo menos 8 caracteres.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'A confirmação da senha nao confere.' });
  }

  try {
    const currentEncryptionKey = req.session?.dataEncryptionKey || deriveDataKey(currentPassword, user.encryptionSalt).toString('base64');
    const currentState = readUserAppState(user.id, currentEncryptionKey);
    const nextUser = updateUser(user.id, {
      passwordHash: hashPassword(newPassword),
      rememberTokens: []
    });
    const nextEncryptionKey = deriveDataKey(newPassword, nextUser.encryptionSalt).toString('base64');
    writeUserAppState(user.id, currentState?.state || {}, nextEncryptionKey);
    req.session.dataEncryptionKey = nextEncryptionKey;
    return res.json({ ok: true, crypto: getClientCryptoConfig(nextUser) });
  } catch (error) {
    return res.status(500).json({ message: 'Não foi possível recriptografar os dados com a nova senha.' });
  }
});

app.post('/api/profile/delete-account', noStore, requireAuth, requireCsrf, (req, res, next) => {
  const { password = '' } = req.body || {};
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
  }
  if (!password || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Senha incorreta.' });
  }

  try {
    archiveDeletedUserAppState(user);
    deleteUserAppState(user.id);
    deleteUser(user.id);
  } catch (error) {
    return next(error);
  }

  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('fin.sid');
    return res.json({ ok: true });
  });
});

app.get('/api/app/bootstrap', noStore, requireAuth, (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
  }
  const savedState = readUserAppState(user.id, req.session?.dataEncryptionKey || '');
  if (savedState && !savedState.encrypted && req.session?.dataEncryptionKey) {
    writeUserAppState(user.id, savedState.state || {}, req.session.dataEncryptionKey);
  }
  const isPrimaryUser = user.username === 'guilherme';
  return res.json({
    session: {
      authenticated: true,
      id: user.id,
      username: user.username,
      email: user.email || '',
      displayName: user.displayName,
      fullName: user.fullName || user.displayName,
      csrfToken: ensureCsrfToken(req),
      permissions: {
        canAccessESO: !!user.permissions?.canAccessESO
      }
    },
    profile: buildPrivateProfile(user),
    permissions: {
      canAccessESO: !!user.permissions?.canAccessESO
    },
    isPrimaryUser,
    appState: savedState?.state || null,
    hasServerState: !!savedState,
    shouldStartEmpty: !savedState && !isPrimaryUser
  });
});

app.put('/api/app-state', noStore, requireAuth, requireCsrf, (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
  }
  const state = req.body?.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return res.status(400).json({ message: 'Estado inválido.' });
  }
  const saved = writeUserAppState(user.id, state, req.session?.dataEncryptionKey || '');
  return res.json({ ok: true, updatedAt: saved.updatedAt });
});

app.post('/api/app-state/migrate-legacy', noStore, requireAuth, requireCsrf, (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
  }
  const state = req.body?.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return res.status(400).json({ message: 'Estado de migração inválido.' });
  }
  if (hasUserAppState(user.id)) {
    return res.json({ ok: true, migrated: false });
  }
  writeUserAppState(user.id, state, req.session?.dataEncryptionKey || '');
  return res.json({ ok: true, migrated: true });
});

app.post('/api/auth/logout', noStore, requireAuth, requireCsrf, (req, res, next) => {
  const rememberToken = parseCookies(req)[REMEMBER_COOKIE_NAME];
  const user = getAuthenticatedUser(req);
  if (user && rememberToken) {
    revokeRememberMeToken(user, rememberToken);
  }
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('fin.sid');
    clearRememberMeCookie(res);
    return res.json({ ok: true });
  });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'Rota não encontrada.' });
  }
  if (req.session?.authenticated) {
    return res.redirect('/app');
  }
  return res.redirect('/login');
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  if (req.path.startsWith('/api/')) {
    if (error?.type === 'entity.too.large' || error?.status === 413) {
      return res.status(413).json({ message: 'Os dados enviados são grandes demais para o servidor.' });
    }
    return res.status(500).json({ message: 'Erro interno no servidor.' });
  }
  return res.status(500).send('Erro interno no servidor.');
});

app.listen(PORT, () => {
  console.log(`Controle Financeiro protegido rodando em http://localhost:${PORT}`);
});


