const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppStateService, AppStateConflict, hasDangerousMonthDrop, hasRevisionConflict } = require('../server/services/app-state-service');
const { createBackupService } = require('../server/services/backup-service');
const { createSerialQueue } = require('../server/jobs/serial-queue');
const { createErrorHandler } = require('../server/http/error-handler');

const silent = { log() {}, warn() {}, error() {} };
const months = count => ({ finData: Array.from({ length: count }, (_, id) => ({ id })) });

function stateFixture(overrides = {}) {
  const calls = [];
  const deps = {
    logger: silent,
    readUserAppState: (id, key) => { calls.push(['read', id, key]); return { updatedAt: 'r1', state: months(12) }; },
    writeUserAppState: (id, state, key) => { calls.push(['write', id, key, state]); return { updatedAt: 'r2', partitionVersion: 3 }; },
    hasUserAppState: () => true,
    recoverMissingMonthsFromLegacyBackups: (_id, state) => ({ changed: false, state }),
    ...overrides
  };
  return { calls, service: createAppStateService(deps) };
}

test('state service passes authenticated owner, encryption key and exact snapshot to the store', () => {
  const f = stateFixture();
  const state = months(12);
  assert.deepEqual(f.service.commit({ id: 'owner-a' }, state, 'r1', 'secret'), { updatedAt: 'r2', partitionVersion: 3 });
  assert.deepEqual(f.calls, [['read', 'owner-a', 'secret'], ['write', 'owner-a', 'secret', state]]);
});

test('revision conflict is checked before month loss and prevents any write', () => {
  const f = stateFixture();
  assert.throws(() => f.service.commit({ id: 'a' }, months(0), 'old'), error =>
    error instanceof AppStateConflict && error.kind === 'revision' && error.details.currentRevision === 'r1');
  assert.equal(f.calls.length, 1);
});

test('month drop conflict reports original counts without writing', () => {
  const f = stateFixture();
  assert.throws(() => f.service.commit({ id: 'a' }, months(9), 'r1'), error => {
    assert.equal(error.kind, 'month-drop');
    assert.deepEqual(error.details, { currentRevision: 'r1', previousMonthCount: 12, nextMonthCount: 9 });
    return true;
  });
  assert.equal(f.calls.length, 1);
});

test('revision and month-loss boundaries preserve the existing policy', () => {
  assert.equal(hasRevisionConflict('', ''), false);
  assert.equal(hasRevisionConflict(' r1 ', 'r1'), false);
  assert.equal(hasRevisionConflict(undefined, 'r1'), true);
  for (const [previous, next, blocked] of [[9, 0, false], [10, 8, false], [10, 7, true], [12, 10, false], [12, 9, true], [20, 16, false], [20, 15, true]]) {
    assert.equal(hasDangerousMonthDrop(months(previous), months(next)), blocked);
  }
});

test('a widget failure cannot undo a committed state or disguise a storage failure', () => {
  let widgetCalls = 0;
  const deps = { buildWidgetSnapshot: () => { widgetCalls++; throw new Error('widget'); }, saveWidgetSnapshot() {} };
  const f = stateFixture(deps);
  assert.equal(f.service.commit({ id: 'a', widgetToken: 'token' }, months(12), 'r1').updatedAt, 'r2');
  assert.equal(widgetCalls, 1);
  const broken = stateFixture({ ...deps, writeUserAppState: () => { throw new Error('disk'); } });
  assert.throws(() => broken.service.commit({ id: 'a', widgetToken: 'token' }, months(12), 'r1'), /disk/);
  assert.equal(widgetCalls, 1);
});

for (const kind of ['recovery', 'partition', 'encryption', 'empty-encryption']) {
  test(`bootstrap service preserves ${kind} rewrite revision and envelope`, () => {
    const f = stateFixture({ recoverMissingMonthsFromLegacyBackups: (_id, state) => ({ changed: kind === 'recovery', state }) });
    const input = { state: kind === 'empty-encryption' ? null : months(12), updatedAt: 'r1', encrypted: false,
      partitioned: kind !== 'partition', partitionVersion: kind === 'partition' ? 2 : 3 };
    const output = f.service.prepareBootstrap('a', input, 'key');
    assert.equal(output.updatedAt, 'r2');
    assert.equal(output.encrypted, input.encrypted);
    assert.equal(output.state, input.state);
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.calls[0].slice(0, 3), ['write', 'a', 'key']);
    assert.equal(input.updatedAt, 'r1');
  });
}

test('current encrypted bootstrap and missing accounts do not write', () => {
  const f = stateFixture();
  const input = { state: months(12), encrypted: true, partitioned: true, partitionVersion: 3, updatedAt: 'r1' };
  assert.equal(f.service.prepareBootstrap('a', input, 'key'), input);
  assert.equal(f.service.prepareBootstrap('a', null, 'key'), null);
  assert.equal(f.calls.length, 0);
});

test('bootstrap recovery write failure propagates instead of returning an invented revision', () => {
  const f = stateFixture({ writeUserAppState: () => { throw new Error('recovery disk'); } });
  assert.throws(() => f.service.prepareBootstrap('a', { state: months(12), partitioned: false }, 'k'), /recovery disk/);
});

test('manual backup keeps owner, trimmed note and metadata mapping', () => {
  const calls = [];
  const service = createBackupService({ createUserBackup: (...args) => { calls.push(args); return { id: 'b', privatePath: '/private' }; },
    toClientBackupMeta: backup => ({ id: backup.id }), updateUser() {} });
  assert.deepEqual(service.createManual('a', ' note '), { id: 'b' });
  assert.deepEqual(calls, [['a', { type: 'manual', note: 'note' }]]);
});

test('automatic backup preserves cooldown boundary, reason limit and other statistics', () => {
  const now = Date.parse('2026-10-26T12:00:00Z');
  const calls = [];
  const service = createBackupService({ now: () => now,
    createUserBackup: (...args) => { calls.push(['backup', ...args]); return { id: 'b' }; },
    toClientBackupMeta: value => value,
    updateUser: (...args) => calls.push(['update', ...args]) });
  const min = Math.max(5000, Number(process.env.FIN_AUTO_EXIT_BACKUP_MIN_MS || 21600000) || 21600000);
  const user = { id: 'a', backupStats: { preserved: 3, lastAutoExitBackupAt: new Date(now - min + 1).toISOString() } };
  assert.equal(service.getAutoExitTime(user), null);
  user.backupStats.lastAutoExitBackupAt = new Date(now - min).toISOString();
  assert.equal(service.getAutoExitTime(user), now);
  assert.deepEqual(service.createAutoExit(user, 'x'.repeat(80), now), { id: 'b' });
  assert.equal(calls[0][1], 'a');
  assert.equal(calls[0][2].note, `Backup autom\u00e1tico de sa\u00edda (${'x'.repeat(64)}).`);
  assert.deepEqual(calls[1], ['update', 'a', { backupStats: { preserved: 3, lastAutoExitBackupAt: new Date(now).toISOString() } }]);
});

test('automatic backup failure does not advance the cooldown', () => {
  let updated = false;
  const service = createBackupService({ createUserBackup: () => { throw new Error('backup failed'); },
    updateUser: () => { updated = true; }, toClientBackupMeta: value => value });
  assert.throws(() => service.createAutoExit({ id: 'a' }, '', Date.now()), /backup failed/);
  assert.equal(updated, false);
});

test('job queue serializes one owner while allowing independent owners', async () => {
  const queue = createSerialQueue();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const order = [];
  const first = queue.enqueue('a', async () => { order.push('a1'); await gate; return 1; });
  const second = queue.enqueue('a', () => { order.push('a2'); return 2; });
  assert.equal(await queue.enqueue('b', () => { order.push('b'); return 3; }), 3);
  assert.deepEqual(order, ['a1', 'b']);
  release();
  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  assert.deepEqual(order, ['a1', 'b', 'a2']);
});

test('PDF queue does not retry a failed job and later jobs still run', async () => {
  const queue = createSerialQueue();
  let calls = 0;
  await assert.rejects(queue.enqueue('pdf', () => { calls++; throw new Error('pdf'); }), /pdf/);
  assert.equal(calls, 1);
  assert.equal(await queue.enqueue('pdf', () => 4), 4);
});

test('user queue retains exactly one retry on failure and preserves rejection after the retry', async () => {
  const queue = createSerialQueue({ retryFailure: true });
  let calls = 0;
  assert.equal(await queue.enqueue('a', () => { if (++calls === 1) throw new Error('once'); return 'ok'; }), 'ok');
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(queue.enqueue('a', () => { calls++; return Promise.reject(new Error('twice')); }), /twice/);
  assert.equal(calls, 2);
  assert.equal(await queue.enqueue('a', () => 'later'), 'later');
});

for (const [api, oversized] of [[true, false], [true, true], [false, false]]) {
  test(`HTTP error contract preserves api=${api} oversized=${oversized}`, () => {
    const handler = createErrorHandler({ logger: silent, randomUUID: () => 'trace' });
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; }, send(body) { this.body = body; } };
    handler(Object.assign(new Error('private detail'), oversized ? { status: 413 } : {}), { path: api ? '/api/app-state' : '/app' }, res, () => assert.fail());
    assert.equal(res.code, oversized ? 413 : 500);
    if (api) assert.deepEqual(res.body, oversized
      ? { message: 'Os dados enviados s\u00e3o grandes demais para o servidor.' }
      : { message: 'Erro interno no servidor.', requestId: 'trace' });
    else assert.equal(res.body, 'Erro interno no servidor. Ref: trace');
  });
}

test('HTTP error handler delegates an already-started response', () => {
  const error = new Error('started');
  let forwarded;
  createErrorHandler({ logger: silent, randomUUID: () => 'id' })(error, { path: '/api/test' }, { headersSent: true }, value => { forwarded = value; });
  assert.equal(forwarded, error);
});
