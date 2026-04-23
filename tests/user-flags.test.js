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

test('legacy recurrence restriction is migrated by user model and defaults by username', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-user-flag-'));
  const script = `
    const { createUser, readUsersStore } = require('./server/user-store.js');
    createUser({
      id: 'g1',
      username: 'guilherme',
      email: 'g@test.local',
      fullName: 'Guilherme',
      displayName: 'G',
      passwordHash: 'hash'
    });
    createUser({
      id: 'u2',
      username: 'maria',
      email: 'm@test.local',
      fullName: 'Maria',
      displayName: 'M',
      passwordHash: 'hash'
    });
    const users = readUsersStore().users || [];
    const guilherme = users.find(user => user.id === 'g1') || {};
    const maria = users.find(user => user.id === 'u2') || {};
    console.log(JSON.stringify({
      guilhermeFlag: !!guilherme.legacyRecurrenceBackfillRestricted,
      mariaFlag: !!maria.legacyRecurrenceBackfillRestricted
    }));
  `;
  const out = runNodeScript(script, { FIN_STORAGE_DIR: tempRoot });
  assert.equal(out.guilhermeFlag, true);
  assert.equal(out.mariaFlag, false);
});
