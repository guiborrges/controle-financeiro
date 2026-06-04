const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');

function runNodeScript(code, env) {
  const result = spawnSync(process.execPath, ['-e', code], {
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'child process failed');
  }
  return JSON.parse(String(result.stdout || '{}'));
}

test('backup create/list/restore keeps strict per-user ownership isolation', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-backup-iso-'));
  const script = `
    const { createUser } = require('./server/user-store.js');
    const { writeUserAppState, readUserAppState } = require('./server/app-state-store.js');
    const { createUserBackup, listUserBackups, restoreUserBackup } = require('./server/backup-store.js');

    const userA = createUser({
      id: 'u_a',
      username: 'ua',
      email: 'ua@test.local',
      fullName: 'User A',
      displayName: 'A',
      passwordHash: 'hash'
    });
    const userB = createUser({
      id: 'u_b',
      username: 'ub',
      email: 'ub@test.local',
      fullName: 'User B',
      displayName: 'B',
      passwordHash: 'hash'
    });

    const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString('base64');
    writeUserAppState(userA.id, { finStateSchemaVersion: '3', finData: [{ id: '2026-04', nome: 'ABRIL 2026' }] }, key);
    writeUserAppState(userB.id, { finStateSchemaVersion: '3', finData: [{ id: '2026-05', nome: 'MAIO 2026' }] }, key);

    const backupA = createUserBackup(userA.id, { type: 'manual', note: 'backup a' });
    const backupsA = listUserBackups(userA.id);
    const backupsB = listUserBackups(userB.id);

    let crossRestoreBlocked = false;
    let crossRestoreMessage = '';
    try {
      restoreUserBackup(userB.id, backupA.id);
    } catch (error) {
      crossRestoreBlocked = true;
      crossRestoreMessage = String(error?.message || '');
    }

    const ownRestore = restoreUserBackup(userA.id, backupA.id);
    const stateA = readUserAppState(userA.id, key);
    const stateB = readUserAppState(userB.id, key);
    console.log(JSON.stringify({
      backupsA: backupsA.length,
      backupsB: backupsB.length,
      crossRestoreBlocked,
      crossRestoreMessage,
      ownRestoreOk: !!ownRestore?.restoredAt,
      stateAFirstMonth: stateA?.state?.finData?.[0]?.id || '',
      stateBFirstMonth: stateB?.state?.finData?.[0]?.id || ''
    }));
  `;
  const out = runNodeScript(script, { FIN_STORAGE_DIR: tempRoot });
  assert.equal(out.backupsA, 1);
  assert.equal(out.backupsB, 0);
  assert.equal(out.crossRestoreBlocked, true);
  assert.match(out.crossRestoreMessage, /invalido|nao encontrado|nao pertence/i);
  assert.equal(out.ownRestoreOk, true);
  assert.equal(out.stateAFirstMonth, '2026-04');
  assert.equal(out.stateBFirstMonth, '2026-05');
});

test('backup restore rejects invalid backup id format', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-backup-id-'));
  const script = `
    const { createUser } = require('./server/user-store.js');
    const { writeUserAppState } = require('./server/app-state-store.js');
    const { restoreUserBackup } = require('./server/backup-store.js');
    const user = createUser({
      id: 'u_invalid',
      username: 'uinvalid',
      email: 'uinvalid@test.local',
      fullName: 'User Invalid',
      displayName: 'User Invalid',
      passwordHash: 'hash'
    });
    writeUserAppState(user.id, { finStateSchemaVersion: '3', finData: [] }, '');
    let blocked = false;
    let message = '';
    try {
      restoreUserBackup(user.id, '../etc/passwd');
    } catch (error) {
      blocked = true;
      message = String(error?.message || '');
    }
    console.log(JSON.stringify({ blocked, message }));
  `;
  const out = runNodeScript(script, { FIN_STORAGE_DIR: tempRoot });
  assert.equal(out.blocked, true);
  assert.match(out.message, /identificador de backup inválido/i);
});

test('backup retention keeps the 50 newest backups by default', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-backup-retention-'));
  const script = `
    const { createUser } = require('./server/user-store.js');
    const { writeUserAppState } = require('./server/app-state-store.js');
    const { createUserBackup, listUserBackups, MAX_BACKUPS_PER_USER } = require('./server/backup-store.js');
    const user = createUser({
      id: 'u_retention',
      username: 'uretention',
      email: 'uretention@test.local',
      fullName: 'User Retention',
      displayName: 'Retention',
      passwordHash: 'hash'
    });
    const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString('base64');
    writeUserAppState(user.id, { finStateSchemaVersion: '3', finData: [] }, key);
    for (let i = 0; i < 55; i += 1) {
      createUserBackup(user.id, { type: 'manual', note: 'n' + i });
    }
    const backups = listUserBackups(user.id);
    console.log(JSON.stringify({
      count: backups.length,
      max: MAX_BACKUPS_PER_USER,
      hasNewest: backups.some(item => item.note === 'n54'),
      hasOldest: backups.some(item => item.note === 'n0')
    }));
  `;
  const out = runNodeScript(script, { FIN_STORAGE_DIR: tempRoot });
  assert.equal(out.max, 50);
  assert.equal(out.count, 50);
  assert.equal(out.hasNewest, true);
  assert.equal(out.hasOldest, false);
});

test('backup retention can be lowered by environment limit', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-backup-env-prune-'));
  const script = `
    const { createUser } = require('./server/user-store.js');
    const { writeUserAppState } = require('./server/app-state-store.js');
    const { createUserBackup, listUserBackups, MAX_BACKUPS_PER_USER } = require('./server/backup-store.js');
    const user = createUser({
      id: 'u_env_prune',
      username: 'uenvprune',
      email: 'uenvprune@test.local',
      fullName: 'User Env Prune',
      displayName: 'EnvPrune',
      passwordHash: 'hash'
    });
    const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString('base64');
    writeUserAppState(user.id, { finStateSchemaVersion: '3', finData: [] }, key);
    for (let i = 0; i < 7; i += 1) {
      createUserBackup(user.id, { type: 'manual', note: 'n' + i });
    }
    const backups = listUserBackups(user.id);
    console.log(JSON.stringify({ count: backups.length, max: MAX_BACKUPS_PER_USER }));
  `;
  const out = runNodeScript(script, { FIN_STORAGE_DIR: tempRoot, FIN_MAX_BACKUPS_PER_USER: '3' });
  assert.equal(out.max, 3);
  assert.equal(out.count, 3);
});

test('backup retention preserves monthly anchors beyond regular limit', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-backup-monthly-anchors-'));
  const script = `
    const fs = require('fs');
    const path = require('path');
    const { createUser } = require('./server/user-store.js');
    const { writeUserAppState } = require('./server/app-state-store.js');
    const {
      createUserBackup,
      listUserBackups,
      pruneUserBackups,
      USER_BACKUP_ROOT,
      MAX_BACKUPS_PER_USER,
      MAX_MONTHLY_BACKUPS_PER_USER
    } = require('./server/backup-store.js');
    const user = createUser({
      id: 'u_monthly_anchor',
      username: 'umonthlyanchor',
      email: 'umonthlyanchor@test.local',
      fullName: 'User Monthly Anchor',
      displayName: 'MonthlyAnchor',
      passwordHash: 'hash'
    });
    const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString('base64');
    writeUserAppState(user.id, { finStateSchemaVersion: '3', finData: [] }, key);
    const seed = createUserBackup(user.id, { type: 'manual', note: 'seed' });
    const userBackupDir = fs.readdirSync(USER_BACKUP_ROOT)
      .map(name => path.join(USER_BACKUP_ROOT, name))
      .find(name => name.endsWith('__' + user.id));
    const seedState = path.join(userBackupDir, 'items', seed.id, 'state.json');
    const itemsDir = path.join(userBackupDir, 'items');
    const entries = [
      ['b_jun_30', '2026-06-30T22:00:00.000Z', 'jun30'],
      ['b_jun_29', '2026-06-29T22:00:00.000Z', 'jun29'],
      ['b_jun_28', '2026-06-28T22:00:00.000Z', 'jun28'],
      ['b_may_31', '2026-05-31T22:00:00.000Z', 'may31'],
      ['b_apr_30', '2026-04-30T22:00:00.000Z', 'apr30'],
      ['b_mar_31', '2026-03-31T22:00:00.000Z', 'mar31']
    ];
    for (const [id] of entries) {
      const dir = path.join(itemsDir, id);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(seedState, path.join(dir, 'state.json'));
    }
    fs.writeFileSync(path.join(userBackupDir, 'index.json'), JSON.stringify({
      backups: entries.map(([id, createdAt, note]) => ({ id, createdAt, note, type: 'manual' })),
      logs: []
    }), 'utf8');
    pruneUserBackups(user.id);
    const backups = listUserBackups(user.id);
    const notes = backups.map(item => item.note).sort();
    console.log(JSON.stringify({
      count: backups.length,
      max: MAX_BACKUPS_PER_USER,
      monthlyMax: MAX_MONTHLY_BACKUPS_PER_USER,
      notes
    }));
  `;
  const out = runNodeScript(script, {
    FIN_STORAGE_DIR: tempRoot,
    FIN_MAX_BACKUPS_PER_USER: '3',
    FIN_MONTHLY_BACKUPS_PER_USER: '2'
  });
  assert.equal(out.max, 3);
  assert.equal(out.monthlyMax, 2);
  assert.equal(out.count, 5);
  assert.deepEqual(out.notes, ['apr30', 'jun28', 'jun29', 'jun30', 'may31']);
});

test('login registration does not create automatic backups', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-backup-login-no-auto-'));
  const script = `
    const { createUser } = require('./server/user-store.js');
    const { writeUserAppState } = require('./server/app-state-store.js');
    const { registerUserLogin, listUserBackups } = require('./server/backup-store.js');
    const user = createUser({
      id: 'u_login_no_backup',
      username: 'uloginnobackup',
      email: 'uloginnobackup@test.local',
      fullName: 'User Login No Backup',
      displayName: 'LoginNoBackup',
      passwordHash: 'hash'
    });
    const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString('base64');
    writeUserAppState(user.id, { finStateSchemaVersion: '3', finData: [] }, key);
    for (let i = 0; i < 5; i += 1) registerUserLogin(user.id);
    setTimeout(() => {
      const backups = listUserBackups(user.id);
      console.log(JSON.stringify({ count: backups.length }));
    }, 20);
  `;
  const out = runNodeScript(script, { FIN_STORAGE_DIR: tempRoot });
  assert.equal(out.count, 0);
});

test('backup restore performs full replacement (no merge residues)', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-backup-replace-'));
  const script = `
    const { createUser } = require('./server/user-store.js');
    const { writeUserAppState, readUserAppState } = require('./server/app-state-store.js');
    const { createUserBackup, restoreUserBackup } = require('./server/backup-store.js');
    const user = createUser({
      id: 'u_replace',
      username: 'ureplace',
      email: 'ureplace@test.local',
      fullName: 'User Replace',
      displayName: 'Replace',
      passwordHash: 'hash'
    });
    const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString('base64');
    const sourceState = {
      finStateSchemaVersion: '3',
      finData: [{ id: '2026-04', nome: 'ABRIL 2026' }],
      finMetas: { casa: 1000 }
    };
    writeUserAppState(user.id, sourceState, key);
    const backup = createUserBackup(user.id, { type: 'manual', note: 'source' });
    writeUserAppState(user.id, {
      finStateSchemaVersion: '3',
      finData: [{ id: '2026-05', nome: 'MAIO 2026' }],
      finMetas: { carro: 999 },
      finGhostField: { shouldDisappear: true }
    }, key);
    restoreUserBackup(user.id, backup.id);
    const restored = readUserAppState(user.id, key);
    console.log(JSON.stringify({
      monthId: restored?.state?.finData?.[0]?.id || '',
      hasCasaMeta: Object.prototype.hasOwnProperty.call(restored?.state?.finMetas || {}, 'casa'),
      hasCarroMeta: Object.prototype.hasOwnProperty.call(restored?.state?.finMetas || {}, 'carro'),
      hasGhostField: Object.prototype.hasOwnProperty.call(restored?.state || {}, 'finGhostField')
    }));
  `;
  const out = runNodeScript(script, { FIN_STORAGE_DIR: tempRoot });
  assert.equal(out.monthId, '2026-04');
  assert.equal(out.hasCasaMeta, true);
  assert.equal(out.hasCarroMeta, false);
  assert.equal(out.hasGhostField, false);
});
