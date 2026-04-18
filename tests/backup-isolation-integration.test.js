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

test('backup retention is non-pruning by default (no loss on inactivity policy)', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-backup-retention-'));
  const script = `
    const { createUser } = require('./server/user-store.js');
    const { writeUserAppState } = require('./server/app-state-store.js');
    const { createUserBackup, listUserBackups } = require('./server/backup-store.js');
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
    for (let i = 0; i < 7; i += 1) {
      createUserBackup(user.id, { type: 'manual', note: 'n' + i });
    }
    const backups = listUserBackups(user.id);
    console.log(JSON.stringify({ count: backups.length }));
  `;
  const out = runNodeScript(script, { FIN_STORAGE_DIR: tempRoot });
  assert.equal(out.count, 7);
});
