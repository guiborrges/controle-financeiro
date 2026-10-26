'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function probe() {
  const { createUser } = require('./server/user-store');
  const { createStateStore } = require('./server/state-store-factory');
  const files = require('./server/app-state-store');
  const backups = require('./server/backup-store');
  const user = createUser({ id: 'synthetic_validation', username: 'synthetic_validation', passwordHash: 'fixture-only' });
  const store = createStateStore();
  const OriginalDate = Date;
  const now = OriginalDate.parse('2026-10-26T12:00:00Z');
  global.Date = class extends OriginalDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  };
  const first = store.writeUserAppState(user.id, { finData: [{ id: 'outubro_2026' }] });
  const backup = backups.createUserBackup(user.id);
  const second = store.writeUserAppState(user.id, { finData: [{ id: 'novembro_2026' }] });
  global.Date = OriginalDate;
  backups.restoreUserBackup(user.id, backup.id);
  const sqlMonth = store.readUserAppState(user.id).state.finData[0].id;
  const fileMonth = files.readUserAppState(user.id).state.finData[0].id;
  console.log(JSON.stringify({ backend: store.backend,
    F03: { restoreDiverges: sqlMonth !== fileMonth }, F04: { revisionsRepeat: first.updatedAt === second.updatedAt } }));
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meufin-known-risks-'));
try {
  const result = spawnSync(process.execPath, ['-e', `(${probe.toString()})()`], {
    cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 30000,
    env: { ...process.env, FIN_STORAGE_DIR: root, FIN_STATE_BACKEND: 'sqlite' }
  });
  if (result.status !== 0) throw new Error(result.stderr || 'Isolated probe failed');
  const report = JSON.parse(result.stdout);
  const unresolved = report.backend !== 'sqlite' || report.F03.restoreDiverges || report.F04.revisionsRepeat;
  console.log(JSON.stringify({ status: unresolved ? 'NOT_APPROVED' : 'CHECKS_PASSED', ...report }, null, 2));
  process.exitCode = unresolved ? 2 : 0;
} finally {
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
  fs.rmSync(root, { recursive: true, force: true });
}
