const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { recoverMissingMonthsFromLegacyBackups: recover } = require('../server/http/month-recovery');

function withBackup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-month-recovery-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'u1.backup-old.json'), JSON.stringify({
    state: { finData: [{ id: 'janeiro_2026', nome: 'JANEIRO 2026' }] }
  }));
  return dir;
}

test('populated sparse state does not resurrect omitted months or normalize saved records', t => {
  const state = { finData: [{ id: 'custom', nome: 'MARCO 2026' }] };
  const result = recover('u1', state, withBackup(t));
  assert.equal(result.changed, false);
  assert.strictEqual(result.state, state);
});

test('continuous calendar with no materialized months does not recover legacy months', t => {
  const state = { finData: [], finCalendarModel: { version: 1, series: [] } };
  const result = recover('u1', state, withBackup(t));
  assert.equal(result.changed, false);
  assert.deepEqual(result.state, state);
});

test('empty legacy month store still recovers backup months', t => {
  const state = { finData: [], finMetas: { goal: 10 } };
  const result = recover('u1', state, withBackup(t));
  assert.equal(result.changed, true);
  assert.equal(result.state.finData[0].id, 'janeiro_2026');
  assert.deepEqual(result.state.finMetas, state.finMetas);
  assert.deepEqual(state.finData, []);
});
