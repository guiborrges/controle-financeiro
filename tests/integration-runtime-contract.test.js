const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const { once } = require('node:events');
const { createSerialQueue } = require('../server/jobs/serial-queue');
const { fetchText, positiveLimit } = require('../server/integrations/deadline');
const { runFile } = require('../server/integrations/process-runner');
const { createOracleAccess } = require('../workers/lib/oracle-db');
const staging = require('../server/repositories/pluggy-staging');

test('queue bounds each tenant and the process before accepting new work', async () => {
  const queue = createSerialQueue({ maxPendingPerKey: 1, maxPending: 2 });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const a = queue.enqueue('a', () => gate);
  assert.throws(() => queue.enqueue('a', () => assert.fail()), { code: 'INTEGRATION_BUSY' });
  const b = queue.enqueue('b', () => gate);
  assert.throws(() => queue.enqueue('c', () => assert.fail()), { code: 'INTEGRATION_BUSY' });
  assert.equal(queue.pending(), 2);
  release();
  await Promise.all([a, b]);
  assert.equal(queue.pending(), 0);
  assert.equal(await queue.enqueue('a', () => 7), 7);
});

test('same active job shares one promise, but IDs and tenants remain independent', async () => {
  const queue = createSerialQueue({ maxPendingPerKey: 1 });
  let release;
  let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const a = queue.enqueue('a', () => { calls++; return gate; }, { jobId: 'j' });
  const duplicate = queue.enqueue('a', () => assert.fail(), { jobId: 'j' });
  assert.equal(a, duplicate);
  assert.equal(queue.hasJob('a', 'j'), true);
  assert.equal(await queue.enqueue('b', () => 'other', { jobId: 'j' }), 'other');
  release('done');
  assert.equal(await a, 'done');
  assert.equal(calls, 1);
  assert.equal(queue.hasJob('a', 'j'), false);
  assert.equal(await queue.enqueue('a', () => 'reprocess', { jobId: 'j' }), 'reprocess');
});

test('failed jobs release capacity and their active-job lock', async () => {
  const queue = createSerialQueue({ maxPending: 1 });
  await assert.rejects(queue.enqueue('a', () => { throw new Error('failed'); }, { jobId: 'j' }), /failed/);
  assert.equal(queue.pending(), 0);
  assert.equal(queue.hasJob('a', 'j'), false);
  assert.equal(await queue.enqueue('b', () => 2), 2);
});

test('HTTP deadline includes a response body stalled after successful headers', async t => {
  const server = http.createServer((_req, res) => { res.writeHead(200); res.flushHeaders(); res.write('{'); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  await assert.rejects(fetchText(`http://127.0.0.1:${server.address().port}`, {}, 100));
});

test('HTTP deadline preserves caller cancellation', async () => {
  const controller = new AbortController();
  controller.abort(new Error('caller cancelled'));
  await assert.rejects(fetchText('http://127.0.0.1:1', { signal: controller.signal }, 100), /caller cancelled/);
});

test('invalid deadline settings cannot disable finite limits', () => {
  for (const value of ['bad', 0, -1, Infinity, 1.5, Number.MAX_SAFE_INTEGER]) assert.equal(positiveLimit(value, 45), 45);
  assert.equal(positiveLimit('99', 45), 99);
});

test('OCI subprocess is asynchronous and returns stdout', async () => {
  let timerRan = false;
  const timer = setTimeout(() => { timerRan = true; }, 10);
  const result = await runFile(process.execPath, ['-e', "setTimeout(()=>process.stdout.write('ok'),60)"], { encoding: 'utf8', timeout: 5000 });
  clearTimeout(timer);
  assert.equal(result, 'ok');
  assert.equal(timerRan, true);
});

test('OCI subprocess timeout terminates a stalled command', async () => {
  await assert.rejects(runFile(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeout: 100 }), error => error.killed === true);
});

function oracleFixture(overrides = {}) {
  const calls = [];
  const conn = { rollback: async () => calls.push('rollback'), close: async () => calls.push('close') };
  const pool = { getConnection: async () => conn, close: async () => calls.push('pool-close') };
  const driver = { OUT_FORMAT_OBJECT: 4002, createPool: async config => { calls.push(config); return pool; }, ...overrides };
  const access = createOracleAccess(driver, { ORACLE_DB_USER: 'fixture', ORACLE_DB_PASSWORD: 'not-real', ORACLE_DB_CONNECT_STRING: 'fixture' });
  return { calls, conn, pool, driver, access };
}

test('Oracle access shares its pool and bounds queued acquisition and each round trip', async () => {
  const f = oracleFixture();
  await Promise.all([f.access.withConnection(async conn => assert.equal(conn.callTimeout, 45000)), f.access.withConnection(async () => {})]);
  assert.equal(f.calls.filter(value => typeof value === 'object').length, 1);
  assert.equal(f.calls[0].queueTimeout, 30000);
  assert.equal(f.calls[0].queueMax, 100);
  assert.equal(f.driver.outFormat, 4002);
  await f.access.closePool();
  assert.equal(f.calls.at(-1), 'pool-close');
});

test('Oracle pool creation failure is not cached forever', async () => {
  const f = oracleFixture();
  let attempts = 0;
  f.driver.createPool = async () => { if (++attempts === 1) throw new Error('unavailable'); return f.pool; };
  await assert.rejects(f.access.withConnection(() => {}), /unavailable/);
  await f.access.withConnection(() => {});
  assert.equal(attempts, 2);
  await f.access.closePool();
});

test('Oracle rolls back and closes on failure without hiding the original error', async () => {
  const f = oracleFixture();
  f.conn.close = async () => { f.calls.push('close'); throw new Error('close failure'); };
  const original = new Error('write failure');
  await assert.rejects(f.access.withConnection(() => { throw original; }), error => error === original);
  assert.deepEqual(f.calls.slice(-2), ['rollback', 'close']);
  await f.access.closePool();
});

test('Oracle commit remains under caller control and successful reads do not commit', async () => {
  const f = oracleFixture();
  let commits = 0;
  f.conn.commit = async () => { commits++; };
  assert.equal(await f.access.withConnection(async () => 'read'), 'read');
  assert.equal(commits, 0);
  assert.equal(f.calls.includes('rollback'), false);
  await f.access.closePool();
});

for (const [includeBalance, hash] of [
  [true, '3aa3264c94fc400930a103b9d78c626ad6e77297e70b84f30d0dbe41f5d27a9e'],
  [false, '32c74d97dc21c1d27a5d924e3a5c4b0cbc6a4cefc04e882754c2fae4bd885627']
]) {
  test(`shared staging SQL matches the baseline transaction statement, balance=${includeBalance}`, async () => {
    const calls = [];
    const row = { tenant_user_id: 'a', external_transaction_id: 'tx' };
    await staging.upsertTransaction({ execute: async (...args) => calls.push(args) }, row, { includeBalance });
    const [sql, binds, options] = calls[0];
    assert.equal(crypto.createHash('sha256').update(sql.replace(/\s+/g, '')).digest('hex'), hash);
    assert.equal(binds, row);
    assert.deepEqual(options, includeBalance ? { autoCommit: false } : undefined);
    assert.match(sql, /t\.tenant_user_id = src\.tenant_user_id/);
    if (!includeBalance) assert.doesNotMatch(sql, /balance_amount/);
  });
}

test('shared connection SQL matches the baseline and leaves binds/commit ownership intact', async () => {
  const calls = [];
  const row = { tenant_user_id: 'a', pluggy_item_id: 'item' };
  await staging.upsertConnection({ execute: async (...args) => calls.push(args) }, row);
  assert.equal(crypto.createHash('sha256').update(calls[0][0].replace(/\s+/g, '')).digest('hex'),
    '80a0c938985aeec5ae3b80908ac8702a029e3486d9cc04a04fbf9dba91227b35');
  assert.equal(calls[0][1], row);
  assert.equal(calls[0].length, 2);
});

test('repository preserves each adapter schema setup, without adding indexes silently', async () => {
  const calls = [];
  const conn = { execute: async sql => calls.push(sql) };
  await staging.ensureConnectionsTable(conn, { includeStatusIndex: false });
  assert.equal(calls.length, 2);
  calls.length = 0;
  await staging.ensureConnectionsTable(conn);
  assert.equal(calls.length, 3);
  calls.length = 0;
  await staging.ensureTransactionsTable(conn);
  assert.equal(calls.length, 3);
  assert.match(calls[1], /tenant_user_id, external_transaction_id/);
});
