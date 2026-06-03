const express = require('express');
const session = require('express-session');
const FileStoreFactory = require('session-file-store');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { ROOT_DIR, resolveStoragePath } = require('./server/paths');

function loadEnvFile() {
  const envPath = path.join(ROOT_DIR, '.env');
  try {
    const fs = require('fs');
    if (!fs.existsSync(envPath)) return;
    const text = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of String(text || '').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (!key || process.env[key] !== undefined) continue;
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch (error) {
    console.warn('[startup] Falha ao carregar .env:', error?.message || error);
  }
}
loadEnvFile();
const { createPersistentRateLimitStore } = require('./server/rate-limit-store');
const { recoverMissingMonthsFromLegacyBackups } = require('./server/http/month-recovery');
const { registerPageRoutes } = require('./server/http/routes/pages');
const { registerDeveloperRoutes } = require('./server/http/routes/developer');
const { registerAuthRoutes } = require('./server/http/routes/auth');
const { registerProfileRoutes } = require('./server/http/routes/profile');
const { registerAppStateRoutes } = require('./server/http/routes/app-state');
const { registerBillImportAiRoutes } = require('./server/http/routes/bill-import-ai');
const { registerPluggyWebhookRoutes } = require('./server/http/routes/pluggy-webhook');
const { registerPluggyPreviewRoutes } = require('./server/http/routes/pluggy-preview');
const { registerWidgetRoutes } = require('./server/http/routes/widget');
const { buildWidgetSnapshot, saveWidgetSnapshot, readWidgetSnapshot } = require('./server/widget-snapshot');
const {
  REMEMBER_COOKIE_NAME,
  REMEMBER_COOKIE_HOST_NAME,
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

const { verifyPassword, verifyPasswordAsync, hashPassword } = require('./server/password');
const {
  DATA_KEY_ALGORITHM,
  DATA_KEY_ITERATIONS,
  deriveDataKey,
  deriveDataKeyAsync,
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
const SESSIONS_DATA_DIR = resolveStoragePath('data', 'sessions');
const SESSION_SECRET_PATH = resolveStoragePath('auth', 'session-secret.txt');
const rateLimitState = createPersistentRateLimitStore(resolveStoragePath('auth', 'rate-limit-state.json'));
const REMEMBER_ME_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const MIN_USER_PASSWORD_LENGTH = Math.max(12, Number(process.env.FIN_MIN_USER_PASSWORD_LENGTH || 12));
const MIN_DEVELOPER_PASSWORD_LENGTH = 8;
const stateStore = createStateStore();
const hasUserAppState = stateStore.hasUserAppState || hasUserAppStateFile;
const readUserAppState = stateStore.readUserAppState || readUserAppStateFile;
const writeUserAppState = stateStore.writeUserAppState || writeUserAppStateFile;
const deleteUserAppState = stateStore.deleteUserAppState || deleteUserAppStateFile;

ensureUsersStore();
ensureDeveloperStore();
if (process.env.NODE_ENV === 'production' && !String(process.env.FIN_SESSION_SECRET || '').trim()) {
  console.error('[security] FIN_SESSION_SECRET obrigatorio em producao. Defina no ambiente.');
  process.exit(1);
}
if (!String(process.env.PLUGGY_WEBHOOK_SECRET || '').trim()) {
  console.warn('[security] PLUGGY_WEBHOOK_SECRET nao configurado: webhook Pluggy sera rejeitado (HTTP 503).');
}
if (!String(process.env.FIN_REMEMBER_TOKEN_SECRET || '').trim()) {
  console.warn('[security] FIN_REMEMBER_TOKEN_SECRET nao configurado: defina um segredo dedicado para tokens remember-me.');
}
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

const PASSWORD_RECOVERY_SECRET = String(process.env.FIN_PASSWORD_RECOVERY_SECRET || '').trim();
let cachedPasswordRecoveryKey = null;

function derivePasswordRecoveryKey() {
  if (!PASSWORD_RECOVERY_SECRET) return '';
  if (cachedPasswordRecoveryKey) return cachedPasswordRecoveryKey;
  cachedPasswordRecoveryKey = crypto
    .pbkdf2Sync(
      PASSWORD_RECOVERY_SECRET,
      Buffer.from('fin:password-recovery:key'),
      210000,
      32,
      'sha512'
    )
    .toString('base64');
  return cachedPasswordRecoveryKey;
}

function validateUserPassword(password) {
  const raw = String(password || '');
  if (raw.length < MIN_USER_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `A senha precisa ter pelo menos ${MIN_USER_PASSWORD_LENGTH} caracteres.`
    };
  }
  if (!/\d/.test(raw)) {
    return {
      ok: false,
      message: 'A senha precisa incluir pelo menos 1 numero.'
    };
  }
  return { ok: true };
}

function wrapRecoveryEncryptionKey(dataEncryptionKey) {
  const recoveryKey = derivePasswordRecoveryKey();
  if (!recoveryKey || !dataEncryptionKey) return '';
  return encryptDataWithKey({ dataEncryptionKey }, recoveryKey);
}

function unwrapRecoveryEncryptionKey(wrappedPayload) {
  const recoveryKey = derivePasswordRecoveryKey();
  if (!recoveryKey || !wrappedPayload) return '';
  const payload = decryptDataWithKey(wrappedPayload, recoveryKey);
  return String(payload?.dataEncryptionKey || '');
}

let mailTransporter = null;
function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  if (!host || !port || !user || !pass) return null;
  mailTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
  return mailTransporter;
}

async function sendPasswordResetEmail({ email, displayName, token, resetLink, expiresAt }) {
  const transporter = getMailTransporter();
  const expiration = new Date(expiresAt).toLocaleString('pt-BR');
  const subject = 'Recuperacao de senha - Controle Financeiro';
  const text = [
    `Ola ${displayName || 'usuario'},`,
    '',
    'Recebemos um pedido para redefinir sua senha.',
    `Codigo de recuperacao: ${token}`,
    resetLink ? `Link direto: ${resetLink}` : '',
    `Valido ate: ${expiration}`,
    '',
    'Se voce nao pediu essa alteracao, ignore este e-mail.'
  ].filter(Boolean).join('\n');

  if (!transporter) {
    console.log('[auth] SMTP nao configurado. Reset solicitado (codigo nao logado por seguranca):', { email, resetLink, expiresAt });
    return;
  }

  const from = String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
  await transporter.sendMail({ from, to: email, subject, text });
}
function restoreRememberedSession(req, res, next) {
  if (req.session?.authenticated) return next();
  const cookies = parseCookies(req);
  const rememberToken = cookies[REMEMBER_COOKIE_HOST_NAME] || cookies[REMEMBER_COOKIE_NAME];
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

  // Restoring remember-me should not trigger login counters/backups synchronously.
  const nextUser = touchUserActivity(user.id) || findUserById(user.id) || user;
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
function resolveTrustProxySetting() {
  const raw = String(process.env.FIN_TRUST_PROXY || '').trim().toLowerCase();
  if (!raw) return 'loopback';
  if (['0', 'false', 'off', 'no'].includes(raw)) return false;
  if (raw === '1' || raw === 'true') return 1;
  if (raw === 'loopback') return 'loopback';
  return raw;
}
app.set('trust proxy', resolveTrustProxySetting());
const SESSION_COOKIE_NAME = String(process.env.FIN_SESSION_COOKIE_NAME || (process.env.NODE_ENV === 'production' ? '__Host-fin.sid' : 'fin.sid')).trim() || 'fin.sid';
const SESSION_COOKIE_SECURE = SESSION_COOKIE_NAME.startsWith('__Host-') ? true : 'auto';
const FileStore = FileStoreFactory(session);
app.use(applySecurityHeaders);
app.use('/api', (req, res, next) => {
  const origin = String(req.get('origin') || '').trim();
  if (!origin) return next();
  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    return res.status(403).json({ message: 'Origin invalida.' });
  }
  const requestHost = String(req.get('host') || '').trim();
  if (!originHost || !requestHost || originHost !== requestHost) {
    return res.status(403).json({ message: 'Origin nao permitida.' });
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    return res.status(204).end();
  }
  return next();
});
app.use('/api/app-state', express.json({ limit: process.env.FIN_APP_STATE_BODY_LIMIT || '20mb' }));
app.use('/api/app-state', express.urlencoded({ extended: false, limit: process.env.FIN_APP_STATE_BODY_LIMIT || '20mb' }));
app.use('/api/bill-import-ai', express.json({ limit: process.env.FIN_IMPORT_BODY_LIMIT || '15mb' }));
app.use('/api/bill-import-ai', express.urlencoded({ extended: false, limit: process.env.FIN_IMPORT_BODY_LIMIT || '15mb' }));
app.use(express.json({ limit: process.env.FIN_DEFAULT_BODY_LIMIT || '2mb' }));
app.use(express.urlencoded({ extended: false, limit: process.env.FIN_DEFAULT_BODY_LIMIT || '2mb' }));
app.use(session({
  name: SESSION_COOKIE_NAME,
  secret: ensureSessionSecret(SESSION_SECRET_PATH),
  store: new FileStore({
    path: SESSIONS_DATA_DIR,
    ttl: Math.floor(REMEMBER_ME_MAX_AGE_MS / 1000),
    retries: 1,
    reapInterval: 15 * 60,
    reapAsync: true
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: SESSION_COOKIE_SECURE,
    path: '/'
  }
}));
app.use(restoreRememberedSession);

app.use('/login-assets', noStore, express.static(LOGIN_DIR, { index: false }));
app.use('/shared-assets', noStore, express.static(SHARED_DIR, { index: false }));
app.use('/app-assets', noStore, express.static(APP_DIR, {
  index: false,
  fallthrough: false,
  setHeaders: (res, filePath) => {
    if (typeof filePath === 'string' && filePath.toLowerCase().endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  }
}));
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
  verifyPasswordAsync,
  registerUserLogin,
  findUserById,
  deriveDataKey,
  deriveDataKeyAsync,
  issueRememberMeToken,
  setRememberMeCookie,
  clearRememberMeCookie,
  buildPublicProfile,
  createUser,
  updateUser,
  readUserAppState,
  writeUserAppState,
  buildFreshUserAppState,
  hashPassword,
  normalizeBirthDate,
  isValidEmail,
  isValidBrazilPhone,
  getClientCryptoConfig,
  wrapRecoveryEncryptionKey,
  unwrapRecoveryEncryptionKey,
  sendPasswordResetEmail,
  parseCookies,
  REMEMBER_COOKIE_NAME,
  REMEMBER_COOKIE_HOST_NAME,
  revokeRememberMeToken,
  crypto,
  REMEMBER_ME_MAX_AGE_MS,
  MIN_USER_PASSWORD_LENGTH,
  validateUserPassword
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
  wrapRecoveryEncryptionKey,
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
  hasUserAppState,
  buildWidgetSnapshot,
  saveWidgetSnapshot
});

registerBillImportAiRoutes(app, {
  noStore,
  requireAuth,
  requireCsrf,
  getAuthenticatedUser,
  readUserAppState,
  writeUserAppState,
  USERS_DATA_DIR
});

registerPluggyWebhookRoutes(app, { noStore });
registerPluggyPreviewRoutes(app, {
  noStore,
  requireAuth,
  getAuthenticatedUser
});

registerWidgetRoutes(app, {
  noStore,
  requireAuth,
  requireCsrf,
  getAuthenticatedUser,
  readUsersStore,
  updateUser,
  readWidgetSnapshot,
  readUserAppState,
  buildWidgetSnapshot,
  saveWidgetSnapshot
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
  const requestId = crypto.randomUUID();
  const safeMessage = String(error?.message || 'Erro interno').slice(0, 300);
  const safePath = String(req?.path || '');
  console.error(`[error:${requestId}] ${safePath} ${safeMessage}`);
  if (res.headersSent) return next(error);
  if (req.path.startsWith('/api/')) {
    if (error?.type === 'entity.too.large' || error?.status === 413) {
      return res.status(413).json({ message: 'Os dados enviados são grandes demais para o servidor.' });
    }
    return res.status(500).json({ message: 'Erro interno no servidor.', requestId });
  }
  return res.status(500).send(`Erro interno no servidor. Ref: ${requestId}`);
});

app.listen(PORT, () => {
  console.log(`Controle Financeiro protegido rodando em http://localhost:${PORT} (state-backend=${stateStore.backend || 'json'})`);
});





