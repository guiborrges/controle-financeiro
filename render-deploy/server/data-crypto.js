const crypto = require('crypto');

const DATA_KEY_ALGORITHM = 'sha512';
const DATA_KEY_ITERATIONS = 210000;
const DATA_KEY_LENGTH = 32;
const DATA_CIPHER_ALGORITHM = 'aes-256-gcm';
const DATA_IV_LENGTH = 12;

function createEncryptionSalt() {
  return crypto.randomBytes(16).toString('base64');
}

function deriveDataKey(password, salt, options = {}) {
  const algorithm = options.algorithm || DATA_KEY_ALGORITHM;
  const iterations = Number(options.iterations || DATA_KEY_ITERATIONS);
  const saltBuffer = Buffer.isBuffer(salt) ? salt : Buffer.from(String(salt || ''), 'base64');
  return crypto.pbkdf2Sync(String(password || ''), saltBuffer, iterations, DATA_KEY_LENGTH, algorithm);
}

function normalizeKeyBuffer(key) {
  if (Buffer.isBuffer(key)) return key;
  return Buffer.from(String(key || ''), 'base64');
}

function encryptDataWithKey(data, key) {
  const keyBuffer = normalizeKeyBuffer(key);
  const iv = crypto.randomBytes(DATA_IV_LENGTH);
  const cipher = crypto.createCipheriv(DATA_CIPHER_ALGORITHM, keyBuffer, iv);
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = {
    v: 1,
    alg: DATA_CIPHER_ALGORITHM,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ciphertext.toString('base64')
  };
  return `enc$${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')}`;
}

function decryptDataWithKey(encryptedData, key) {
  if (typeof encryptedData !== 'string' || !encryptedData.startsWith('enc$')) {
    return typeof encryptedData === 'string' ? JSON.parse(encryptedData) : encryptedData;
  }
  const keyBuffer = normalizeKeyBuffer(key);
  const packed = encryptedData.slice(4);
  const payload = JSON.parse(Buffer.from(packed, 'base64').toString('utf8'));
  const decipher = crypto.createDecipheriv(
    payload.alg || DATA_CIPHER_ALGORITHM,
    keyBuffer,
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final()
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}

function encryptData(data, password, options = {}) {
  const salt = options.salt || createEncryptionSalt();
  const algorithm = options.algorithm || DATA_KEY_ALGORITHM;
  const iterations = Number(options.iterations || DATA_KEY_ITERATIONS);
  const key = deriveDataKey(password, salt, { algorithm, iterations });
  const encryptedPayload = encryptDataWithKey(data, key);
  const packed = {
    v: 1,
    kdf: 'pbkdf2',
    algorithm,
    iterations,
    salt,
    payload: encryptedPayload
  };
  return `encpbkdf2$${Buffer.from(JSON.stringify(packed), 'utf8').toString('base64')}`;
}

function decryptData(encryptedData, password) {
  if (typeof encryptedData !== 'string' || !encryptedData.startsWith('encpbkdf2$')) {
    return typeof encryptedData === 'string' ? JSON.parse(encryptedData) : encryptedData;
  }
  const packed = JSON.parse(Buffer.from(encryptedData.slice(10), 'base64').toString('utf8'));
  const key = deriveDataKey(password, packed.salt, {
    algorithm: packed.algorithm,
    iterations: packed.iterations
  });
  return decryptDataWithKey(packed.payload, key);
}

module.exports = {
  DATA_KEY_ALGORITHM,
  DATA_KEY_ITERATIONS,
  createEncryptionSalt,
  deriveDataKey,
  encryptData,
  decryptData,
  encryptDataWithKey,
  decryptDataWithKey
};
