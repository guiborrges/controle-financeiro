const test = require('node:test');
const assert = require('node:assert/strict');
const { browserSandbox, monthAt, loadBrowser } = require('./helpers/refactor-fixtures');

function setup() {
  const ctx = browserSandbox({ SYSTEM_DEFAULT_CATEGORY_PRESETS: [{ name: 'CASA', emoji: 'home' }] });
  const previous = monthAt(2026, 11);
  const current = monthAt(2027, 0);
  previous.outflows = [{ category: 'VIAGEM', amount: 10 }, { category: 'ZERO', amount: 0 },
    { category: 'IGNORADA', amount: 20, countsInPrimaryTotals: false }];
  current.categorias = { ATUAL_ZERO: 0 };
  current.outflows = [{ category: 'ATUAL', amount: 0, tag: 'F\u00e9rias' }];
  ctx.data = [current, previous];
  return { ctx, previous, current };
}

test('3B ordered categories cross year boundaries without mutation or future leakage', () => {
  const { ctx, current } = setup();
  const future = monthAt(2027, 1);
  future.outflows = [{ category: 'FUTURO', amount: 100 }];
  ctx.data.push(future);
  const before = JSON.stringify(ctx.data);
  assert.deepEqual(Array.from(ctx.getMonthCategoryNames(current.id, ctx)), ['CASA', 'VIAGEM', 'ATUAL', 'ATUAL_ZERO']);
  assert.equal(JSON.stringify(ctx.data), before);
  const option = ctx.getMonthCategoryOptions(current, ctx)[0];
  assert.deepEqual(JSON.parse(JSON.stringify(option)), {
    id: 'CASA', value: 'CASA', name: 'CASA', label: 'CASA', icon: 'home', symbol: 'home'
  });
});

test('3B catalog sees direct edits, renames, visibility and state replacement without stale results', () => {
  const { ctx, previous, current } = setup();
  ctx.getMonthCategoryNames(current, ctx);
  previous.outflows[0].amount = 0;
  current.outflows.push({ category: 'NOVA', amount: 2, tag: 'Trabalho' });
  assert.deepEqual(Array.from(ctx.getMonthCategoryNames(current, ctx)), ['CASA', 'ATUAL', 'NOVA', 'ATUAL_ZERO']);
  ctx.resolveCategoryName = value => String(value || '').toUpperCase().replace('NOVA', 'RENOMEADA');
  assert.equal(ctx.getMonthCategoryNames(current, ctx).includes('RENOMEADA'), true);
  current.selectionVisibility = { version: 2, categories: { CASA: true }, tags: { trabalho: true } };
  assert.deepEqual(Array.from(ctx.getMonthCategoryNames(current, ctx)), ['CASA']);
  assert.deepEqual(Array.from(ctx.getMonthTagOptions(current, ctx)), ['Trabalho']);
  assert.equal(ctx.getMonthCategoryNames(current, ctx, { purpose: 'history' }).includes('RENOMEADA'), true);
  const replacement = monthAt(2027, 0);
  replacement.outflows = [{ category: 'RESTAURADA', tag: 'Outra conta' }];
  ctx.data = [replacement];
  assert.deepEqual(Array.from(ctx.getMonthCategoryNames(replacement.id, ctx)), ['CASA', 'RESTAURADA']);
  assert.deepEqual(Array.from(ctx.getMonthTagOptions(replacement.id, ctx)), ['Outra conta']);
});

test('3B tags preserve Unicode accents, case dedupe, explicit visibility and history', () => {
  const { ctx, previous, current } = setup();
  previous.outflows.push({ tag: 'Fe\u0301rias' }, { tag: 'Ferias' }, { tag: ' TRABALHO ' });
  current.selectionVisibility = { version: 2, categories: {}, tags: { 'fe\u0301rias': true, 'Nova tag': true } };
  assert.deepEqual(Array.from(ctx.getMonthTagOptions(current, ctx)), ['F\u00e9rias', 'Nova tag']);
  assert.deepEqual(Array.from(ctx.getMonthTagOptions(current, ctx, { purpose: 'history' })),
    ['Ferias', 'F\u00e9rias', 'Nova tag', 'TRABALHO']);
});

test('3B symbols and legacy prefixes retain scalar, emoji, known and unknown ID contracts', () => {
  const { ctx } = setup();
  loadBrowser(ctx, ['pluggy-banking.js']);
  for (const [input, expected] of [['home', '\ud83c\udfe0'], ['FOOD', '\ud83c\udf7d\ufe0f'],
    ['unknown-id', ''], ['\ud83c\udf89', '\ud83c\udf89'], [{ name: 'market' }, '\ud83d\uded2'], [null, '']]) {
    assert.equal(ctx.__pluggyBankingTest.toVisualCategorySymbol(input), expected);
  }
  for (const [input, expected] of [['home Casa', 'Casa'], ['unknown Casa', 'unknown Casa'],
    [{ label: ' food  ALIMENTACAO ' }, 'ALIMENTACAO'], [null, '']]) {
    assert.equal(ctx.stripLegacyCategoryIconPrefix(input), expected);
    assert.equal(ctx.__pluggyBankingTest.stripLegacyCategoryIconPrefix(input), expected);
  }
});

test('3B shared catalog runs without DOM and separates callers with explicit sources', () => {
  const shared = require('../public/app/modules/shared/month-selection-catalog');
  const make = (category, tag) => {
    const month = { id: 'm', outflows: [{ category, tag }] };
    return shared.create({ data: [month], window: {}, getCurrentMonth: () => month,
      resolveCategoryName: value => String(value || '').toUpperCase() });
  };
  const a = make('CASA', 'Pessoal');
  const b = make('VIAGEM', 'Trabalho');
  assert.deepEqual(a.getMonthCategoryNames('m'), ['CASA']);
  assert.deepEqual(b.getMonthCategoryNames('m'), ['VIAGEM']);
  assert.deepEqual(a.getMonthTagOptions('m'), ['Pessoal']);
  assert.deepEqual(b.getMonthTagOptions('m'), ['Trabalho']);
  assert.equal(shared.getEmojiSymbol('home'), '');
  assert.equal(shared.toVisualCategorySymbol('home'), '\ud83c\udfe0');
  assert.equal(shared.toVisualCategorySymbol('unknown', 'CASA', {
    inferCategoryVisual: () => ({ icon: 'home' })
  }), '\ud83c\udfe0');
});

test('3B public catalog facades delegate using current data and dependencies', () => {
  const { ctx, current } = setup();
  const calls = [];
  ctx.MonthSelectionCatalog.create = environment => {
    calls.push(environment);
    return { getMonthCategoryOptions: () => ['sentinel'], getMonthTagOptions: () => ['tag'] };
  };
  assert.deepEqual(Array.from(ctx.getMonthCategoryOptions(current, ctx)), ['sentinel']);
  const replacement = [];
  ctx.data = replacement;
  assert.deepEqual(Array.from(ctx.getMonthTagOptions(current, ctx)), ['tag']);
  assert.equal(calls[0].data.includes(current), true);
  assert.equal(calls[1].data, replacement);
  assert.equal(calls[1].resolveCategoryName, ctx.resolveCategoryName);
});
