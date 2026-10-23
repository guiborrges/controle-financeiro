const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function adapter(save) {
  const nodes = {};
  const ctx = {
    Event: class {}, MobileV2Data: { escapeHtml: String },
    document: { getElementById: id => nodes[id] ||= {
      value: '', checked: true, dispatchEvent() {},
      querySelector: () => ({ value: 'method:debito' })
    } },
    openUnifiedOutflowModal() { throw new Error('Mobile must not open the Desktop form'); }, saveMobileUnifiedOutflow: save,
    closeUnifiedOutflowModal() { ctx.closed = true; },
    toggleUnifiedOutflowInstallments() { ctx.toggled = true; }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const source = fs.readFileSync(path.join(__dirname, '../public/app/modules/mobile-v2/outflow-form-mobile.js'), 'utf8');
  vm.runInContext(source.replace('    ensureSheet,', '    applyOutflowCommand, parseMoneyInput,\n    ensureSheet,'), ctx);
  return { ctx, nodes };
}

test('mobile edit sends the explicit payload and waits without touching Desktop controls', async () => {
  let resolve;
  let command;
  const { ctx, nodes } = adapter((mode, payload) => { command = { mode, payload }; return new Promise(done => { resolve = done; }); });
  const result = ctx.MobileV2OutflowForm.applyOutflowCommand('launch', {
    editId: 'existing', description: 'Renamed', category: 'HOME', amount: 100,
    date: '15/10/26', output: 'method:debito', planning: true
  });
  assert.equal(ctx.closed, undefined);
  assert.equal(ctx.toggled, undefined);
  assert.equal(command.mode, 'launch');
  assert.equal(command.payload.editId, 'existing');
  assert.equal(command.payload.planning, true);
  assert.deepEqual(Object.keys(nodes), []);
  resolve({ status: 'saved', id: 'existing' });
  assert.equal((await result).status, 'saved');
  assert.equal(ctx.closed, undefined);
});

test('mobile monetary edits preserve cents with comma or decimal point', () => {
  const { ctx } = adapter(async () => ({ status: 'saved' }));
  for (const value of ['99.90', '99,90']) assert.equal(ctx.MobileV2OutflowForm.parseMoneyInput(value), 99.9);
  assert.equal(ctx.MobileV2OutflowForm.parseMoneyInput('1.234,56'), 1234.56);
});

test('mobile does not close the form for invalid, cancelled or pending saves', async () => {
  for (const status of ['invalid', 'cancelled', 'pending']) {
    const { ctx } = adapter(async () => ({ status }));
    const result = await ctx.MobileV2OutflowForm.applyOutflowCommand('launch', { editId: 'existing', output: 'method:debito' });
    assert.equal(result.status, status);
    assert.equal(ctx.closed, undefined);
  }
});
