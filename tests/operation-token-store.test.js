const test = require('node:test');
const assert = require('node:assert/strict');

const { consumeOperationToken, purgeExpiredTokens } = require('../server/operation-token-store');

test('consumeOperationToken accepts first token and blocks immediate duplicate', () => {
  const scope = `scope_${Date.now()}`;
  const userId = `user_${Date.now()}`;
  const token = `token_${Date.now()}`;
  const first = consumeOperationToken(scope, userId, token);
  const second = consumeOperationToken(scope, userId, token);
  assert.equal(first.accepted, true);
  assert.equal(first.duplicate, false);
  assert.equal(second.accepted, false);
  assert.equal(second.duplicate, true);
});

test('consumeOperationToken does not block when token is empty', () => {
  const first = consumeOperationToken('scope-empty', 'user-empty', '');
  const second = consumeOperationToken('scope-empty', 'user-empty', '');
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
});

test('purgeExpiredTokens can be called safely', () => {
  purgeExpiredTokens(Date.now() + 10_000_000);
  assert.equal(true, true);
});
