(function () {
  const SESSION_KEY_STORAGE = 'finSessionDerivedKey';

  function base64ToBytes(base64) {
    const binary = atob(String(base64 || ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function bytesToBase64(bytes) {
    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  function normalizeHashAlgorithm(value) {
    const text = String(value || '').trim().toUpperCase().replace(/_/g, '-');
    if (text === 'SHA512' || text === 'SHA-512') return 'SHA-512';
    if (text === 'SHA256' || text === 'SHA-256') return 'SHA-256';
    if (text === 'SHA384' || text === 'SHA-384') return 'SHA-384';
    if (text === 'SHA1' || text === 'SHA-1') return 'SHA-1';
    return 'SHA-512';
  }

  async function deriveSessionKey(password, config = {}) {
    const algorithm = normalizeHashAlgorithm(config.algorithm || 'SHA-512');
    const iterations = Number(config.iterations || 210000);
    const saltBytes = base64ToBytes(config.salt || '');
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(String(password || '')),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    const cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations,
        hash: algorithm
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const exported = await crypto.subtle.exportKey('raw', cryptoKey);
    return bytesToBase64(new Uint8Array(exported));
  }

  function storeSessionEncryptionKey(keyBase64) {
    if (!keyBase64) return;
    sessionStorage.setItem(SESSION_KEY_STORAGE, String(keyBase64));
  }

  function getSessionEncryptionKey() {
    return sessionStorage.getItem(SESSION_KEY_STORAGE) || '';
  }

  function clearSessionEncryptionKey() {
    sessionStorage.removeItem(SESSION_KEY_STORAGE);
  }

  function hasSessionEncryptionKey() {
    return !!getSessionEncryptionKey();
  }

  async function importAesKeyFromBase64(keyBase64) {
    return crypto.subtle.importKey(
      'raw',
      base64ToBytes(keyBase64),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptDataWithSessionKey(data, keyBase64) {
    const aesKey = await importAesKeyFromBase64(keyBase64);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
    const payload = {
      v: 1,
      alg: 'AES-GCM',
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(encrypted))
    };
    return `enc$${bytesToBase64(new TextEncoder().encode(JSON.stringify(payload)))}`;
  }

  async function decryptDataWithSessionKey(encryptedData, keyBase64) {
    if (typeof encryptedData !== 'string' || !encryptedData.startsWith('enc$')) {
      return typeof encryptedData === 'string' ? JSON.parse(encryptedData) : encryptedData;
    }
    const packed = encryptedData.slice(4);
    const payloadJson = new TextDecoder().decode(base64ToBytes(packed));
    const payload = JSON.parse(payloadJson);
    const aesKey = await importAesKeyFromBase64(keyBase64);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
      aesKey,
      base64ToBytes(payload.data)
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  async function encryptData(data, password, config = {}) {
    const keyBase64 = await deriveSessionKey(password, config);
    return encryptDataWithSessionKey(data, keyBase64);
  }

  async function decryptData(encryptedData, password, config = {}) {
    const keyBase64 = await deriveSessionKey(password, config);
    return decryptDataWithSessionKey(encryptedData, keyBase64);
  }

  window.FinCrypto = {
    encryptData,
    decryptData,
    deriveSessionKey,
    encryptDataWithSessionKey,
    decryptDataWithSessionKey,
    storeSessionEncryptionKey,
    getSessionEncryptionKey,
    clearSessionEncryptionKey,
    hasSessionEncryptionKey
  };
})();
