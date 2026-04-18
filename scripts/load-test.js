const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('node:child_process');

const TARGET_USERS = Number(process.env.LOAD_USERS || 20);
const ITERATIONS_PER_USER = Number(process.env.LOAD_ITERATIONS || 25);
const BOOTSTRAP_EVERY = Number(process.env.LOAD_BOOTSTRAP_EVERY || 5);
const BASE_PORT = Number(process.env.LOAD_PORT || 3310);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomPort() {
  return BASE_PORT + Math.floor(Math.random() * 200);
}

function parseCookieHeader(headers) {
  if (!headers) return '';
  if (typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    const hit = (values || []).find(value => String(value || '').startsWith('fin.sid='));
    if (hit) return String(hit).split(';')[0].trim();
  }
  const raw = String(headers.get?.('set-cookie') || '');
  const match = raw.match(/(fin\.sid=[^;,\s]+)/i);
  return match ? match[1].trim() : '';
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

async function waitServer(baseUrl, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/login-config`);
      if (response.ok) return true;
    } catch {}
    await sleep(200);
  }
  return false;
}

function buildStatePayload(userIndex, iteration) {
  const monthId = `2026-${String((iteration % 12) + 1).padStart(2, '0')}`;
  return {
    finStateSchemaVersion: '3',
    finData: [
      {
        id: monthId,
        nome: `MÊS ${monthId}`,
        outflows: [
          {
            id: `of_${userIndex}_${iteration}`,
            type: 'spend',
            description: `Gasto ${userIndex}-${iteration}`,
            amount: Number((iteration * 3.17 + 10).toFixed(2)),
            date: `${String((iteration % 28) + 1).padStart(2, '0')}/${String(((iteration + 1) % 12) + 1).padStart(2, '0')}/26`,
            outputKind: iteration % 2 === 0 ? 'pix' : 'debito',
            paid: true
          }
        ]
      }
    ],
    finMetas: { TRANSPORTE: 500 + iteration }
  };
}

function seedUsers(tempStorage) {
  process.env.FIN_STORAGE_DIR = tempStorage;
  const { createUser, findUserByEmail } = require('../server/user-store');
  const { hashPassword } = require('../server/password');
  const { deriveDataKey } = require('../server/data-crypto');
  const { writeUserAppState, buildFreshUserAppState } = require('../server/app-state-store');

  const users = [];
  for (let i = 1; i <= TARGET_USERS; i += 1) {
    const email = `load.user.${i}@local.test`;
    let user = findUserByEmail(email);
    const password = '1234';
    if (!user) {
      user = createUser({
        email,
        phone: '11999999999',
        fullName: `Load User ${i}`,
        displayName: `Load User ${i}`,
        birthDate: '01/01/1990',
        passwordHint: 'hint',
        passwordHash: hashPassword(password),
        permissions: { canAccessESO: false }
      });
      const encryptionKey = deriveDataKey(password, user.encryptionSalt).toString('base64');
      writeUserAppState(user.id, buildFreshUserAppState(), encryptionKey);
    }
    users.push({ index: i, email, password });
  }
  return users;
}

async function runVirtualUser(baseUrl, idx, metrics) {
  let cookie = '';
  let csrf = '';
  const email = `load.user.${idx}@local.test`;
  const password = '1234';
  const loginStart = Date.now();
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  metrics.loginMs.push(Date.now() - loginStart);
  if (!loginRes.ok) {
    const body = await loginRes.text();
    throw new Error(`login user ${idx} failed: ${loginRes.status} ${body}`);
  }
  cookie = parseCookieHeader(loginRes.headers);
  if (!cookie) throw new Error(`login user ${idx} missing session cookie`);

  const bootStart = Date.now();
  const bootRes = await fetch(`${baseUrl}/api/app/bootstrap`, {
    headers: { Cookie: cookie }
  });
  metrics.bootstrapMs.push(Date.now() - bootStart);
  if (!bootRes.ok) {
    const body = await bootRes.text();
    throw new Error(`bootstrap user ${idx} failed: ${bootRes.status} ${body}`);
  }
  const boot = await bootRes.json();
  csrf = String(boot?.session?.csrfToken || '').trim();
  if (!csrf) throw new Error(`bootstrap user ${idx} missing csrf`);

  for (let iteration = 1; iteration <= ITERATIONS_PER_USER; iteration += 1) {
    const putStart = Date.now();
    const putRes = await fetch(`${baseUrl}/api/app-state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
        Cookie: cookie
      },
      body: JSON.stringify({ state: buildStatePayload(idx, iteration) })
    });
    metrics.putMs.push(Date.now() - putStart);
    if (!putRes.ok) {
      const body = await putRes.text();
      throw new Error(`put user ${idx} iteration ${iteration} failed: ${putRes.status} ${body}`);
    }

    if (iteration % BOOTSTRAP_EVERY === 0) {
      const roundBootStart = Date.now();
      const roundBootRes = await fetch(`${baseUrl}/api/app/bootstrap`, {
        headers: { Cookie: cookie }
      });
      metrics.bootstrapMs.push(Date.now() - roundBootStart);
      if (!roundBootRes.ok) {
        const body = await roundBootRes.text();
        throw new Error(`bootstrap user ${idx} iteration ${iteration} failed: ${roundBootRes.status} ${body}`);
      }
      const roundBoot = await roundBootRes.json();
      const nextToken = String(roundBoot?.session?.csrfToken || '').trim();
      if (nextToken) csrf = nextToken;
    }
  }
}

async function main() {
  const tempStorage = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-load-'));
  const port = randomPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  seedUsers(tempStorage);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      FIN_STORAGE_DIR: tempStorage,
      FIN_DISABLE_RATE_LIMIT: '1',
      NODE_ENV: 'test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverStdErr = '';
  server.stderr.on('data', chunk => {
    serverStdErr += String(chunk || '');
  });

  try {
    const ready = await waitServer(baseUrl, 20000);
    if (!ready) {
      throw new Error(`server did not start in time. stderr=${serverStdErr.slice(-500)}`);
    }

    const metrics = { loginMs: [], bootstrapMs: [], putMs: [] };
    const startedAt = Date.now();
    const jobs = Array.from({ length: TARGET_USERS }, (_, i) => runVirtualUser(baseUrl, i + 1, metrics));
    const results = await Promise.allSettled(jobs);
    const totalMs = Date.now() - startedAt;
    const failures = results.filter(item => item.status === 'rejected');

    const summary = {
      users: TARGET_USERS,
      iterationsPerUser: ITERATIONS_PER_USER,
      totalRequestsEstimate: TARGET_USERS * (1 + 1 + ITERATIONS_PER_USER + Math.floor(ITERATIONS_PER_USER / BOOTSTRAP_EVERY)),
      durationMs: totalMs,
      throughputReqPerSec: Number((((TARGET_USERS * ITERATIONS_PER_USER) + TARGET_USERS) / Math.max(1, totalMs / 1000)).toFixed(2)),
      put: {
        count: metrics.putMs.length,
        p50: percentile(metrics.putMs, 50),
        p95: percentile(metrics.putMs, 95),
        max: Math.max(0, ...metrics.putMs)
      },
      bootstrap: {
        count: metrics.bootstrapMs.length,
        p50: percentile(metrics.bootstrapMs, 50),
        p95: percentile(metrics.bootstrapMs, 95),
        max: Math.max(0, ...metrics.bootstrapMs)
      },
      login: {
        count: metrics.loginMs.length,
        p50: percentile(metrics.loginMs, 50),
        p95: percentile(metrics.loginMs, 95),
        max: Math.max(0, ...metrics.loginMs)
      },
      failures: failures.map(item => String(item.reason?.message || item.reason || 'unknown failure'))
    };

    console.log(JSON.stringify(summary, null, 2));
    if (failures.length > 0) process.exitCode = 1;
  } finally {
    server.kill('SIGTERM');
    await sleep(250);
    try {
      fs.rmSync(tempStorage, { recursive: true, force: true });
    } catch {}
  }
}

main().catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
