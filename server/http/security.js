const fs = require('fs');
const crypto = require('crypto');

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const REMEMBER_COOKIE_NAME = 'fin.remember';

function ensureSessionSecret(sessionSecretPath) {
  if (process.env.FIN_SESSION_SECRET) return process.env.FIN_SESSION_SECRET;
  if (fs.existsSync(sessionSecretPath)) {
    return fs.readFileSync(sessionSecretPath, 'utf8').trim();
  }
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(sessionSecretPath, `${secret}\n`, 'utf8');
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

function setRememberMeCookie(res, token, rememberMeMaxAgeMs) {
  res.cookie(REMEMBER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: rememberMeMaxAgeMs,
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
  const hasKnownSession = !!req.session?.authenticated || !!req.session?.developerAuthenticated;
  if (!hasKnownSession) {
    return res.status(401).json({ message: 'Sessao expirada ou inexistente.' });
  }
  const expected = ensureCsrfToken(req);
  const received = req.get('X-CSRF-Token') || '';
  if (!received || received !== expected) {
    return res.status(403).json({ message: 'Token CSRF invalido.' });
  }
  return next();
}

function createRateLimit(rateLimitState, { keyPrefix, maxAttempts, windowMs = RATE_LIMIT_WINDOW_MS }) {
  return function rateLimitMiddleware(req, res, next) {
    if (process.env.FIN_DISABLE_RATE_LIMIT === '1') {
      return next();
    }
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
  const wantsHtml = req.accepts('html') && !String(req.path || '').startsWith('/api/');
  if (wantsHtml) {
    return res.redirect('/login');
  }
  return res.status(401).json({ authenticated: false, message: 'Sessão expirada ou inexistente.' });
}

function requireDeveloper(req, res, next) {
  if (req.session?.developerAuthenticated) return next();
  const wantsHtml = req.accepts('html') && !String(req.path || '').startsWith('/api/');
  if (wantsHtml) {
    return res.redirect('/login');
  }
  return res.status(401).json({ authenticated: false, message: 'Sessao de desenvolvedor ausente.' });
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

module.exports = {
  RATE_LIMIT_WINDOW_MS,
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
};
