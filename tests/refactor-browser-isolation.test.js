const test = require('node:test');
const assert = require('node:assert/strict');
const { createBrowserFixtureServer } = require('./helpers/refactor-browser-server');

test('2A browser harness isolates synthetic tenants and blocks every mutation before touching fixtures', async () => {
  const fixture = await createBrowserFixtureServer(new Map());
  try {
    assert.equal((await fetch(`${fixture.origin}/api/app/bootstrap`)).status, 401);
    const session = async tenant => {
      const login = await fetch(fixture.link(tenant), { redirect: 'manual' });
      assert.equal(login.status, 302);
      return login.headers.get('set-cookie').split(';')[0];
    };
    const a = await session('a');
    const b = await session('b');
    const bootstrap = async cookie => (await fetch(`${fixture.origin}/api/app/bootstrap`, { headers: { Cookie: cookie } })).json();
    assert.equal((await bootstrap(a)).session.id, 'synthetic-a');
    assert.equal((await bootstrap(b)).appState.finData[0].outflows[0].amount, 200);
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const response = await fetch(`${fixture.origin}/api/app-state`, {
        method, headers: { Cookie: a, 'Content-Type': 'application/json' }, body: '{"state":{"finData":[]}}'
      });
      assert.equal(response.status, 403);
    }
    assert.equal((await bootstrap(a)).appState.finData[0].outflows[0].amount, 100);
    assert.equal(fixture.unchanged(), true);
    assert.equal(fixture.requests.blockedWrites.length, 4);
    assert.equal(fixture.requests.writes, 0);
    assert.equal((await fetch(`${fixture.origin}/server.js`, { headers: { Cookie: a } })).status, 404);
  } finally { await fixture.close(); }
});
