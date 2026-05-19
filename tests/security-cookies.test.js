const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REMEMBER_COOKIE_NAME,
  REMEMBER_COOKIE_HOST_NAME,
  getRememberCookieName
} = require('../server/http/security');

test('remember cookie uses legacy name on localhost http', () => {
  const req = {
    protocol: 'http',
    headers: { host: 'localhost:3000' }
  };
  assert.equal(getRememberCookieName(req), REMEMBER_COOKIE_NAME);
});

test('remember cookie uses __Host- name on https', () => {
  const req = {
    protocol: 'https',
    headers: { host: 'meufin.duckdns.org' }
  };
  assert.equal(getRememberCookieName(req), REMEMBER_COOKIE_HOST_NAME);
});

test('remember cookie uses __Host- name on non-localhost host even without explicit https', () => {
  const req = {
    protocol: 'http',
    headers: { host: 'meufin.duckdns.org' }
  };
  assert.equal(getRememberCookieName(req), REMEMBER_COOKIE_HOST_NAME);
});

