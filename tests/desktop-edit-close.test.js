const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function adapter() {
  let resolve;
  const confirmation = new Promise(done => { resolve = done; });
  const events = [];
  const ctx = {
    editingUnifiedOutflowId: 'existing', __unifiedOutflowReturnToCategoryEditor: true,
    __unifiedOutflowSimpleEditMode: true, unifiedOutflowModalMinimized: false,
    getCurrentMonth: () => ({ id: 'outubro_2026' }), getUnifiedOutflowCommandContext: () => ({}),
    preserveCurrentScroll: action => action(), renderMes() {}, renderUnifiedOutflowModalRecentList() {},
    setUnifiedOutflowModalMode() {}, setUnifiedOutflowFloatingButtonVisible() {},
    closeModal: id => events.push(`close:${id}`), openCategoryEditorModal: () => events.push('category-editor'),
    showAppStatus: (message, title, tone) => events.push(tone), requestAnimationFrame: action => action(),
    MesAtualOutflowCommands: { saveDraft: async (_draft, context) => {
      const status = await confirmation;
      if (status === 'saved') context.onSaved({ id: 'existing', description: 'Compra editada' });
      if (status === 'pending') context.onPending({ id: 'existing' });
      return { status };
    } }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const source = fs.readFileSync(path.join(__dirname, '../public/app/mes-atual.js'), 'utf8');
  const closeStart = source.indexOf('function closeUnifiedOutflowModal(');
  vm.runInContext(source.slice(closeStart, source.indexOf('function setUnifiedOutflowModalMode(', closeStart)), ctx);
  const saveStart = source.indexOf('function performUnifiedOutflowSave(');
  vm.runInContext(source.slice(saveStart, source.indexOf('function renderMes(', saveStart)), ctx);
  return { ctx, events, resolve };
}

test('confirmed edit closes before success feedback and never reopens the category editor', async () => {
  const { ctx, events, resolve } = adapter();
  const saving = ctx.performUnifiedOutflowSave({}, {});
  assert.deepEqual(events, []);
  resolve('saved');
  assert.equal((await saving).status, 'saved');
  assert.deepEqual(events, ['close:modalUnifiedOutflow', 'ok']);
  assert.equal(ctx.editingUnifiedOutflowId, '');
  assert.equal(ctx.__unifiedOutflowReturnToCategoryEditor, false);
});

for (const status of ['pending', 'invalid', 'cancelled']) {
  test(`${status} edit stays open and never announces success`, async () => {
    const { ctx, events, resolve } = adapter();
    const saving = ctx.performUnifiedOutflowSave({}, {});
    resolve(status);
    await saving;
    assert.equal(events.some(event => event.startsWith('close:')), false);
    assert.equal(events.includes('ok'), false);
    assert.equal(ctx.editingUnifiedOutflowId, 'existing');
    if (status === 'pending') assert.deepEqual(events, ['warn']);
  });
}

test('saving an earlier edit cannot close a different item opened in the meantime', async () => {
  const { ctx, events, resolve } = adapter();
  const saving = ctx.performUnifiedOutflowSave({}, {});
  ctx.editingUnifiedOutflowId = 'another';
  resolve('saved');
  await saving;
  assert.deepEqual(events, ['ok']);
  assert.equal(ctx.editingUnifiedOutflowId, 'another');
});

test('cancelling a category-origin edit preserves the previous return navigation', () => {
  const { ctx, events } = adapter();
  ctx.closeUnifiedOutflowModal();
  assert.deepEqual(events, ['close:modalUnifiedOutflow', 'category-editor']);
});

test('a completed save cannot close the same ID being edited in another month', async () => {
  const { ctx, events, resolve } = adapter();
  const saving = ctx.performUnifiedOutflowSave({}, {});
  ctx.getCurrentMonth = () => ({ id: 'novembro_2026' });
  resolve('saved');
  await saving;
  assert.deepEqual(events, ['ok']);
  assert.equal(ctx.editingUnifiedOutflowId, 'existing');
});
