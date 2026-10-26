'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { appRoot, smokeState } = require('./refactor-fixtures');

async function createBrowserFixtureServer(vendorAssets) {
  const token = crypto.randomBytes(24).toString('hex');
  const states = { a: smokeState('a'), b: smokeState('b'), primary: smokeState('a') };
  const original = JSON.stringify(states);
  const requests = { writes: 0, reads: 0, blockedWrites: [] };
  const types = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
  let origin;
  const server = http.createServer((req, res) => {
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
      res.end(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
    };
    if (req.headers.host !== new URL(origin).host) return send(403, {});
    if (!['GET', 'HEAD'].includes(req.method)) {
      requests.blockedWrites.push({ method: req.method, path: new URL(req.url, origin).pathname });
      return send(403, { message: 'Fixture somente leitura.' });
    }
    requests.reads += 1;
    const url = new URL(req.url, origin);
    if (url.pathname === '/fixture' && url.searchParams.get('token') === token && states[url.searchParams.get('tenant')]) {
      res.setHeader('Set-Cookie', `fixture=${url.searchParams.get('tenant')}.${token}; HttpOnly; SameSite=Strict; Path=/`);
      res.writeHead(302, { Location: '/app' });
      return res.end();
    }
    const tenant = Object.keys(states).find(id => (req.headers.cookie || '').split(';').some(value => value.trim() === `fixture=${id}.${token}`));
    if (!tenant) return send(401, {});
    const session = { authenticated: true, id: `synthetic-${tenant}`, username: `synthetic-${tenant}`,
      displayName: `Pessoa ficticia ${tenant}`, fullName: `Pessoa ficticia ${tenant}`,
      csrfToken: 'fixture-readonly', permissions: { canAccessESO: false } };
    if (url.pathname === '/api/app/bootstrap') return send(200, { session, profile: session,
      isPrimaryUser: tenant === 'primary', permissions: session.permissions, hasServerState: true,
      shouldStartEmpty: true, stateRevision: 'fixture-v1', appState: states[tenant] });
    if (url.pathname === '/api/auth/session') return send(200, session);
    if (url.pathname === '/api/profile') return send(200, session);
    if (url.pathname.startsWith('/api/')) return send(403, { message: 'Integracao desativada na fixture.' });
    if (vendorAssets.has(url.pathname)) return send(200, vendorAssets.get(url.pathname), types['.js']);
    if (url.pathname === '/fixture-readonly.js') {
      // Only the harness is overridden: production sources and calculations stay intact.
      return send(200, `window.__fixtureSave = save;
        save = () => Promise.resolve(false);
        flushServerStorage = () => Promise.resolve(false);
        scheduleServerStorageFlush = () => {};
        migrateToContinuousCalendar = async () => {};
        canUseBundledFinanceData = () => false;`, types['.js']);
    }
    if (url.pathname === '/app') {
      const html = fs.readFileSync(path.join(appRoot, 'index.html'), 'utf8')
        .replace('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js', '/fixture-assets/chart.js')
        .replace('https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.0.0/fuse.min.js', '/fixture-assets/fuse.js')
        .replace('<script defer src="/app-assets/bootstrap.js"></script>', '<script defer src="/fixture-readonly.js"></script><script defer src="/app-assets/bootstrap.js"></script>');
      return send(200, html, types['.html']);
    }
    const prefix = ['/app-assets/', '/shared-assets/'].find(value => url.pathname.startsWith(value));
    if (!prefix) return send(404, {});
    const root = prefix === '/app-assets/' ? appRoot : path.resolve(appRoot, '../shared');
    const file = path.resolve(root, decodeURIComponent(url.pathname.slice(prefix.length)));
    if (!file.startsWith(root + path.sep)) return send(403, {});
    try { return send(200, fs.readFileSync(file), types[path.extname(file)] || 'application/octet-stream'); }
    catch { return send(404, {}); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, requests, unchanged: () => JSON.stringify(states) === original,
    link: tenant => `${origin}/fixture?tenant=${tenant}&token=${token}`,
    close: () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }) };
}

module.exports = { createBrowserFixtureServer };
