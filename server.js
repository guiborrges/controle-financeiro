const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const { ROOT_DIR, resolveStoragePath } = require('./server/paths');
const { recoverMissingMonthsFromLegacyBackups } = require('./server/http/month-recovery');
const { registerPageRoutes } = require('./server/http/routes/pages');
const { registerDeveloperRoutes } = require('./server/http/routes/developer');
const { registerAuthRoutes } = require('./server/http/routes/auth');
const { registerProfileRoutes } = require('./server/http/routes/profile');
const { registerAppStateRoutes } = require('./server/http/routes/app-state');
const {
  REMEMBER_COOKIE_NAME,
  ensureSessionSecret,
  noStore,
  parseCookies,
  hashRememberToken,
  deriveRememberTokenKey,
  pruneRememberTokens,
  setRememberMeCookie,
  clearRememberMeCookie,
  applySecurityHeaders,
  ensureCsrfToken,
  requireCsrf,
  createRateLimit,
  requireAuth,
  requireDeveloper,
  normalizeBirthDate,
  isValidEmail,
  isValidBrazilPhone
} = require('./server/http/security');

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
  findUserByEmail,
  buildPublicProfile,
  buildPrivateProfile,
  getLoginConfig,
  createUser,
  updateUser,
  deleteUser
} = require('./server/user-store');
const {
  hasUserAppState: hasUserAppStateFile,
  readUserAppState: readUserAppStateFile,
  writeUserAppState: writeUserAppStateFile,
  deleteUserAppState: deleteUserAppStateFile,
  archiveDeletedUserAppState,
  purgeExpiredDeletedUserBackups,
  archiveOrphanUserStateArtifacts,
  buildFreshUserAppState,
  syncUserAppStateLocation,
  syncAllUserAppStateLocations
} = require('./server/app-state-store');
const { createStateStore } = require('./server/state-store-factory');
const { consumeOperationToken } = require('./server/operation-token-store');
const {
  ensureDeveloperStore,
  hasDeveloperPassword,
  verifyDeveloperAccess,
  changeDeveloperPassword
} = require('./server/developer-store');
const {
  createUserBackup,
  registerUserLogin,
  touchUserActivity,
  listUserBackups,
  getUserBackupLogs,
  getUserDataIntegrity,
  revalidateBackup,
  restoreUserBackup,
  listDeveloperUsers,
  toClientBackupMeta
} = require('./server/backup-store');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const LOGIN_DIR = path.join(ROOT_DIR, 'public', 'login');
const APP_DIR = path.join(ROOT_DIR, 'public', 'app');
const DEVELOPER_DIR = path.join(ROOT_DIR, 'public', 'developer');
const SHARED_DIR = path.join(ROOT_DIR, 'public', 'shared');
const USERS_DATA_DIR = resolveStoragePath('data', 'users');
const SESSION_SECRET_PATH = resolveStoragePath('auth', 'session-secret.txt');
const rateLimitState = new Map();
const REMEMBER_ME_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const MIN_USER_PASSWORD_LENGTH = 4;
const MIN_DEVELOPER_PASSWORD_LENGTH = 8;
const stateStore = createStateStore();
const hasUserAppState = stateStore.hasUserAppState || hasUserAppStateFile;
const readUserAppState = stateStore.readUserAppState || readUserAppStateFile;
const writeUserAppState = stateStore.writeUserAppState || writeUserAppStateFile;
const deleteUserAppState = stateStore.deleteUserAppState || deleteUserAppStateFile;

ensureUsersStore();
ensureDeveloperStore();
syncAllUserAppStateLocations();
purgeExpiredDeletedUserBackups();
try {
  const orphanCleanupReport = archiveOrphanUserStateArtifacts();
  if (orphanCleanupReport?.archived) {
    console.log(`[startup] Artefatos órfãos arquivados: ${orphanCleanupReport.archived} (${orphanCleanupReport.dirs} pastas, ${orphanCleanupReport.files} arquivos) em ${orphanCleanupReport.archiveBase}`);
  }
} catch (error) {
  console.warn('[startup] Falha ao arquivar artefatos órfãos:', error?.message || error);
}

function getClientCryptoConfig(user) {
  return {
    salt: user?.encryptionSalt || '',
    algorithm: String(DATA_KEY_ALGORITHM || 'sha512').toUpperCase().replace(/^SHA(\d+)$/, 'SHA-$1'),
    iterations: DATA_KEY_ITERATIONS
  };
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

  const nextUser = registerUserLogin(user.id) || findUserById(user.id) || user;
  req.session.authenticated = true;
  req.session.user = {
    id: nextUser.id,
    username: nextUser.username,
    displayName: nextUser.displayName,
    fullName: nextUser.fullName || nextUser.displayName,
    permissions: {
      canAccessESO: !!nextUser.permissions?.canAccessESO
    }
  };
  req.session.dataEncryptionKey = dataEncryptionKey;
  ensureCsrfToken(req);
  return next();
}

function getAuthenticatedUser(req) {
  if (!req.session?.user?.id) return null;
  return findUserById(req.session.user.id);
}

function getDeveloperSessionPayload(req) {
  return {
    authenticated: !!req.session?.developerAuthenticated,
    csrfToken: ensureCsrfToken(req)
  };
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(applySecurityHeaders);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(session({
  name: 'fin.sid',
  secret: ensureSessionSecret(SESSION_SECRET_PATH),
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
app.use('/developer-assets', noStore, requireDeveloper, express.static(DEVELOPER_DIR, { index: false, fallthrough: false }));

registerPageRoutes(app, {
  noStore,
  requireAuth,
  requireDeveloper,
  loginHtmlPath: path.join(LOGIN_DIR, 'index.html'),
  appHtmlPath: path.join(APP_DIR, 'index.html'),
  developerHtmlPath: path.join(DEVELOPER_DIR, 'index.html')
});

registerDeveloperRoutes(app, {
  noStore,
  requireDeveloper,
  requireCsrf,
  createRateLimit,
  rateLimitState,
  hasDeveloperPassword,
  verifyDeveloperAccess,
  changeDeveloperPassword,
  getDeveloperSessionPayload,
  ensureCsrfToken,
  crypto,
  listDeveloperUsers,
  findUserById,
  getUserDataIntegrity,
  listUserBackups,
  getUserBackupLogs,
  toClientBackupMeta,
  revalidateBackup,
  restoreUserBackup,
  MIN_DEVELOPER_PASSWORD_LENGTH
});

registerAuthRoutes(app, {
  noStore,
  requireAuth,
  requireCsrf,
  createRateLimit,
  rateLimitState,
  getLoginConfig,
  hasDeveloperPassword,
  getAuthenticatedUser,
  ensureCsrfToken,
  findUserByEmail,
  verifyPassword,
  registerUserLogin,
  findUserById,
  deriveDataKey,
  issueRememberMeToken,
  setRememberMeCookie,
  clearRememberMeCookie,
  buildPublicProfile,
  createUser,
  writeUserAppState,
  buildFreshUserAppState,
  hashPassword,
  normalizeBirthDate,
  isValidEmail,
  isValidBrazilPhone,
  getClientCryptoConfig,
  parseCookies,
  REMEMBER_COOKIE_NAME,
  revokeRememberMeToken,
  crypto,
  REMEMBER_ME_MAX_AGE_MS,
  MIN_USER_PASSWORD_LENGTH
});

registerProfileRoutes(app, {
  noStore,
  requireAuth,
  requireCsrf,
  ensureCsrfToken,
  getAuthenticatedUser,
  buildPrivateProfile,
  createUserBackup,
  toClientBackupMeta,
  updateUser,
  syncUserAppStateLocation,
  isValidEmail,
  isValidBrazilPhone,
  verifyPassword,
  deriveDataKey,
  readUserAppState,
  hashPassword,
  writeUserAppState,
  getClientCryptoConfig,
  archiveDeletedUserAppState,
  deleteUserAppState,
  deleteUser,
  consumeOperationToken,
  MIN_USER_PASSWORD_LENGTH
});

registerAppStateRoutes(app, {
  noStore,
  requireAuth,
  requireCsrf,
  getAuthenticatedUser,
  touchUserActivity,
  findUserById,
  readUserAppState,
  recoverMissingMonthsFromLegacyBackups,
  USERS_DATA_DIR,
  writeUserAppState,
  ensureCsrfToken,
  buildPrivateProfile,
  hasUserAppState
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'Rota não encontrada.' });
  }
  if (req.session?.developerAuthenticated) {
    return res.redirect('/developer');
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
  console.log(`Controle Financeiro protegido rodando em http://localhost:${PORT} (state-backend=${stateStore.backend || 'json'})`);
});


