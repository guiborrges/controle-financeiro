const crypto = require('crypto');

const DEFAULT_ALGORITHM = 'sha512';
const DEFAULT_ITERATIONS = 210000;
const DEFAULT_KEY_LENGTH = 32;

function hashPassword(password, options = {}) {
  const iterations = Number(options.iterations || DEFAULT_ITERATIONS);
  const algorithm = options.algorithm || DEFAULT_ALGORITHM;
  const salt = options.salt || crypto.randomBytes(16).toString('base64');
  const derivedKey = crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64'), iterations, DEFAULT_KEY_LENGTH, algorithm);
  const hash = derivedKey.toString('base64');
  return `pbkdf2$${algorithm}$${iterations}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const [type, algorithm, iterations, salt, hash] = storedHash.split('$');
  if (type !== 'pbkdf2' || !algorithm || !iterations || !salt || !hash) return false;
  const derivedKey = crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64'), Number(iterations), Buffer.from(hash, 'base64').length, algorithm);
  const storedBuffer = Buffer.from(hash, 'base64');
  if (derivedKey.length !== storedBuffer.length) return false;
  return crypto.timingSafeEqual(derivedKey, storedBuffer);
}

module.exports = {
  hashPassword,
  verifyPassword
};
