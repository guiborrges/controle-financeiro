const TOKEN_TTL_MS = 60 * 1000;
const tokenStore = new Map();

function getTokenKey(scope, userId, token) {
  return `${String(scope || '').trim()}::${String(userId || '').trim()}::${String(token || '').trim()}`;
}

function purgeExpiredTokens(now = Date.now()) {
  for (const [key, expiresAt] of tokenStore.entries()) {
    if (!Number.isFinite(expiresAt) || expiresAt <= now) tokenStore.delete(key);
  }
}

function consumeOperationToken(scope, userId, token) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) return { accepted: true, duplicate: false };
  const now = Date.now();
  purgeExpiredTokens(now);
  const key = getTokenKey(scope, userId, normalizedToken);
  const existingExpiry = tokenStore.get(key);
  if (Number.isFinite(existingExpiry) && existingExpiry > now) {
    return { accepted: false, duplicate: true };
  }
  tokenStore.set(key, now + TOKEN_TTL_MS);
  return { accepted: true, duplicate: false };
}

module.exports = {
  consumeOperationToken,
  purgeExpiredTokens
};
