const test = require('node:test');
const assert = require('node:assert/strict');
const { browserSandbox, monthAt, loadBrowser } = require('./helpers/refactor-fixtures');

function setup() {
  const ctx = browserSandbox({ SYSTEM_DEFAULT_CATEGORY_PRESETS: [{ name: 'CASA', emoji: '\u2302' }, { name: 'MERCADO', emoji: '\u25a1' }] });
  loadBrowser(ctx, ['modules/import-bills-utils.js']);
  const previous = monthAt(2026, 8);
  previous.outflows = [{ category: 'VIAGEM', amount: 10 }, { category: 'ZERADA', amount: 0 },
    { category: 'ANTIGA', amount: 5 }];
  const current = monthAt(2026, 9);
  current.categorias = { ATUAL_ZERO: 0 };
  current.outflows = [{ category: 'ATUAL', amount: 10, tag: 'Fe\u0301rias' }];
  const future = monthAt(2026, 10);
  future.outflows = [{ category: 'FUTURA', amount: 10, tag: 'Trabalho' }];
  ctx.data = [previous, current, future];
  ctx.resolveCategoryName = value => {
    const name = String(value || '').trim().toUpperCase();
    return name === 'ANTIGA' ? 'RENOMEADA' : name;
  };
  return { ctx, previous, current };
}

test('2A monthly category catalog keeps defaults, previous positive usage, aliases and current zero, not future-only categories', () => {
  const { ctx, current } = setup();
  const before = JSON.stringify(ctx.data);
  const names = Array.from(ctx.getMonthCategoryNames(current, ctx));
  assert.deepEqual(names, ['CASA', 'MERCADO', 'VIAGEM', 'RENOMEADA', 'ATUAL', 'ATUAL_ZERO']);
  assert.equal(names.includes('ZERADA'), false);
  assert.equal(names.includes('FUTURA'), false);
  assert.equal(JSON.stringify(ctx.data), before);
});

test('2A visibility affects new choices, never erases historical categories or Unicode tags', () => {
  const { ctx, current } = setup();
  current.selectionVisibility = { version: 2, categories: { CASA: true, ATUAL: false }, tags: { 'f\u00e9rias': true, trabalho: false } };
  assert.deepEqual(Array.from(ctx.getMonthCategoryNames(current, ctx)), ['CASA']);
  assert.equal(ctx.getMonthCategoryNames(current, ctx, { purpose: 'history' }).includes('ATUAL'), true);
  assert.deepEqual(Array.from(ctx.getMonthTagOptions(current, ctx)), ['F\u00e9rias']);
  assert.deepEqual(Array.from(ctx.getMonthTagOptions(current, ctx, { purpose: 'history' })), ['F\u00e9rias', 'Trabalho']);
  assert.equal(current.outflows[0].category, 'ATUAL');
});

test('2A category options retain current preset-symbol precedence and public field shape', () => {
  const { ctx, current } = setup();
  ctx.categoryEmojiOverrides = { CASA: '\u2605' };
  const before = JSON.stringify(ctx.data);
  const entry = ctx.getMonthCategoryOptions(current.id, ctx).find(row => row.name === 'CASA');
  assert.deepEqual(JSON.parse(JSON.stringify(entry)), { id: 'CASA', value: 'CASA', name: 'CASA', label: 'CASA', icon: '\u2302', symbol: '\u2302' });
  assert.equal(JSON.stringify(ctx.data), before);
});
