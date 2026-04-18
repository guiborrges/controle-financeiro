const test = require('node:test');
const assert = require('node:assert/strict');

const { ensureOwnedStatePayload } = require('../server/app-state-store.js');

test('ownership validator allows matching user id', () => {
  assert.doesNotThrow(() => {
    ensureOwnedStatePayload({ userId: 'user_1' }, 'user_1');
  });
});

test('ownership validator rejects cross-user payload', () => {
  assert.throws(() => {
    ensureOwnedStatePayload({ userId: 'user_a' }, 'user_b');
  }, /não pertence à sessão autenticada/i);
});

