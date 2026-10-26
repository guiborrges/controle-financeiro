const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadCoreCategorySandbox() {
  const sandbox = {
    console,
    data: [],
    window: null,
    addEventListener() {},
    document: {
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; }
    },
    SYSTEM_DEFAULT_CATEGORY_PRESETS: [
      { name: 'Mercado', emoji: 'bag' },
      { name: 'Casa', emoji: 'home' },
      { name: 'Saúde', emoji: 'health' }
    ],
    categoryEmojiOverrides: {},
    resolveCategoryName(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
    },
    isNonRealCategoryLabel(value) {
      const normalized = sandbox.resolveCategoryName(value);
      return ['PIX', 'DEBITO', 'DINHEIRO', 'CARTAO', 'CARTAO DE CREDITO', 'CREDITO'].includes(normalized);
    },
    getCategoryEmoji(value) {
      const normalized = sandbox.resolveCategoryName(value);
      const map = new Map([
        ['MERCADO', 'bag'],
        ['CASA', 'home'],
        ['SAUDE', 'health'],
        ['VIAGEM', 'plane'],
        ['ACADEMIA', 'gym']
      ]);
      return map.get(normalized) || '';
    },
    getMonthSortValue(month) {
      return Number(month?.sort || 0);
    },
    getCurrentMonth() {
      return sandbox.data[1];
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app/modules/shared/month-selection-catalog.js'), 'utf8'), sandbox);
  const corePath = path.join(__dirname, '..', 'public', 'app', 'core.js');
  vm.runInContext(fs.readFileSync(corePath, 'utf8'), sandbox, { filename: corePath });
  return sandbox;
}

test('tag options read canonical lexical data even when window.data is absent', () => {
  const sandbox = loadCoreCategorySandbox();
  delete sandbox.data;
  vm.runInContext("let data = [{ id: 'junho_2026', outflows: [{ tag: 'Viagem' }] }];", sandbox);
  const tags = sandbox.getMonthTagOptions({ id: 'junho_2026' }, sandbox);
  assert.deepEqual(Array.from(tags), ['Viagem']);
});

test('history can query hidden categories and tags without offering them for new entries', () => {
  const sandbox = loadCoreCategorySandbox();
  const month = { id: 'junho_2026', outflows: [{ category: 'Casa', tag: 'Férias' }],
    selectionVisibility: { version: 2, categories: { CASA: false }, tags: { 'férias': false } } };
  sandbox.data = [month];
  const before = JSON.stringify(month);
  assert.equal(sandbox.getMonthCategoryOptions(month, sandbox).length, 0);
  assert.equal(sandbox.getMonthTagOptions(month, sandbox).length, 0);
  assert.equal(sandbox.getMonthCategoryOptions(month, sandbox, { purpose: 'history' }).some(entry => entry.name === 'CASA'), true);
  assert.deepEqual(Array.from(sandbox.getMonthTagOptions(month, sandbox, { purpose: 'history' })), ['Férias']);
  assert.equal(JSON.stringify(month), before);
});

test('tag visibility canonicalizes case and Unicode without losing accents or duplicating options', () => {
  const sandbox = loadCoreCategorySandbox();
  const month = { id: 'junho_2026', outflows: [{ tag: 'Fe\u0301rias' }],
    selectionVisibility: { version: 2, tags: { 'FÉRIAS': true, 'Trabalho': true } } };
  sandbox.data = [month];
  assert.deepEqual(Array.from(sandbox.getMonthTagOptions(month, sandbox)), ['Férias', 'Trabalho']);
});

test('one-time visibility repair keeps each month independent and exposes manually checked categories', () => {
  const sandbox = loadCoreCategorySandbox();
  const first = { id: 'maio_2026', dailyCategorySeeds: ['Casa', 'Mercado'], categorias: { CASA: 0, MERCADO: 0 }, outflows: [{ category: 'Viagem', tag: 'Ferias' }], selectionVisibility: { version: 1, categories: { CASA: true, MERCADO: true }, tags: { trabalho: true } } };
  const second = { id: 'junho_2026', outflows: [{ category: 'Academia', tag: 'Saude' }] };
  sandbox.data = [first, second];
  assert.equal(sandbox.migrateMonthSelectionVisibility(first, sandbox.data), true);
  assert.equal(sandbox.migrateMonthSelectionVisibility(second, sandbox.data), true);
  assert.deepEqual(Array.from(sandbox.getMonthCategoryNames(first, sandbox)), ['VIAGEM']);
  assert.deepEqual(Array.from(sandbox.getMonthTagOptions(first, sandbox)), ['Ferias']);
  assert.deepEqual(Array.from(sandbox.getMonthCategoryNames(second, sandbox)), ['ACADEMIA']);
  first.selectionVisibility.categories.CASA = true;
  assert.equal(sandbox.getMonthCategoryNames(first, sandbox).includes('CASA'), true);
  const before = JSON.stringify(first);
  assert.equal(sandbox.migrateMonthSelectionVisibility(first, sandbox.data), false);
  assert.equal(JSON.stringify(first), before);
});

test('month category options are the single ordered source for defaults, previous spent and current used categories', () => {
  const sandbox = loadCoreCategorySandbox();
  sandbox.data = [
    {
      id: 'maio_2026',
      nome: 'MAIO 2026',
      outflows: [
        { category: 'Veterinário', amount: 120 },
        { category: 'Faculdade', amount: 500 },
        { category: 'Viagem', amount: 300 },
        { category: 'IPTU', amount: 90 },
        { category: 'Dentista', amount: 200 },
        { category: 'Pix', amount: 1000 },
        { category: 'Zerada', amount: 0 }
      ]
    },
    {
      id: 'junho_2026',
      nome: 'JUNHO 2026',
      categorias: {
        'IFOOD+BESTEIRAS': 0
      },
      outflows: [
        { category: 'Academia', amount: 80 }
      ]
    },
    {
      id: 'julho_2026',
      nome: 'JULHO 2026',
      outflows: [
        { category: 'Dentista', amount: 40 }
      ]
    }
  ];

  const names = Array.from(
    sandbox.getMonthCategoryOptions('junho_2026', sandbox, { includeFallbackBase: false }),
    entry => String(entry.name)
  );

  assert.deepEqual(names, [
    'MERCADO',
    'CASA',
    'SAUDE',
    'VETERINARIO',
    'FACULDADE',
    'VIAGEM',
    'IPTU',
    'DENTISTA',
    'ACADEMIA',
    'IFOOD+BESTEIRAS'
  ]);
  assert.equal(names.includes('PIX'), false);
  assert.equal(names.includes('ZERADA'), false);

  const futureNames = Array.from(
    sandbox.getMonthCategoryOptions('julho_2026', sandbox, { includeFallbackBase: false }),
    entry => String(entry.name)
  );

  assert.deepEqual(futureNames, [
    'MERCADO',
    'CASA',
    'SAUDE',
    'ACADEMIA',
    'DENTISTA'
  ]);
  assert.equal(futureNames.includes('VIAGEM'), false);
});

test('month category options keep materialized zero-value categories selectable in that month', () => {
  const sandbox = loadCoreCategorySandbox();
  sandbox.data = [
    {
      id: 'julho_2026',
      nome: 'JULHO 2026',
      categorias: {
        'IFOOD+BESTEIRAS': 0,
        OUTROS: 0
      },
      outflows: []
    }
  ];

  const names = sandbox.getMonthCategoryNames('julho_2026', sandbox, { includeFallbackBase: false });

  assert.equal(names.includes('IFOOD+BESTEIRAS'), true);
  assert.equal(names.includes('OUTROS'), true);
});

test('month category and tag options respect per-month visibility without changing launches', () => {
  const sandbox = loadCoreCategorySandbox();
  sandbox.data = [{
    id: 'julho_2026',
    nome: 'JULHO 2026',
    selectionVisibility: {
      version: 1,
      categories: { MERCADO: true, CASA: false, SAUDE: true },
      tags: { fixa: true, oculta: false }
    },
    outflows: [
      { category: 'Casa', amount: 900, tag: 'Oculta' },
      { category: 'Mercado', amount: 120, tag: 'Fixa' }
    ]
  }];

  const categories = sandbox.getMonthCategoryNames('julho_2026', sandbox, { includeFallbackBase: false });
  assert.equal(categories.includes('CASA'), false);
  assert.equal(categories.includes('MERCADO'), true);
  assert.deepEqual(Array.from(sandbox.getMonthTagOptions('julho_2026', sandbox)), ['Fixa']);
  assert.equal(sandbox.data[0].outflows[0].category, 'Casa');
});

test('desktop and mobile category entry points depend on getMonthCategoryOptions', () => {
  const desktop = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'mes-atual.js'), 'utf8');
  const mobileForm = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'modules', 'mobile-v2', 'outflow-form-mobile.js'), 'utf8');
  const mobileBanking = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'modules', 'mobile-v2', 'internet-banking-mobile.js'), 'utf8');
  const pluggy = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'pluggy-banking.js'), 'utf8');

  assert.match(desktop, /getMonthCategoryOptions\(month \|\| getCurrentMonth\(\), window/);
  assert.match(mobileForm, /getMonthCategoryOptions\(month\?\.id \|\| month, global/);
  assert.match(mobileBanking, /getMonthCategoryOptions\(month\?\.id \|\| month, global/);
  assert.match(pluggy, /getMonthCategoryOptions\(month\?\.id \|\| month, global/);
  assert.match(pluggy, /getSelectedMonthForCategories/);
  assert.match(pluggy, /getCurrentMonth\(\)/);
  assert.doesNotMatch(mobileForm, /ALIMENTA/);
  assert.doesNotMatch(mobileBanking, /BillImportUtils\.getAllCategoriesFromUserData/);
});

test('native category selects do not render internal icon ids as visible labels', () => {
  const desktop = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'mes-atual.js'), 'utf8');
  const mobileForm = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'modules', 'mobile-v2', 'outflow-form-mobile.js'), 'utf8');
  const importReview = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'modules', 'import-bills-review.js'), 'utf8');

  assert.match(desktop, /getCategoryOptionDisplaySymbol/);
  assert.match(desktop, /toVisualCategorySymbol/);
  assert.match(mobileForm, /toVisualCategorySymbol/);
  assert.match(importReview, /getVisibleSymbol/);
  assert.match(importReview, /toVisualCategorySymbol/);
});

test('manual category labels use the banking symbol resolver even without stored metadata', () => {
  const sandbox = loadCoreCategorySandbox();
  sandbox.inferCategoryVisual = name => ({ icon: name === 'MORADIA' ? 'home' : 'fun' });
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'mes-atual.js'), 'utf8');
  const start = source.indexOf('function getCategoryOptionDisplaySymbol(');
  const end = source.indexOf('function populateUnifiedOutflowCategoryOptions(', start);
  vm.runInContext(source.slice(start, end), sandbox);
  assert.equal(sandbox.formatCategoryOptionLabelFromEntry({ name: 'MORADIA', symbol: '' }), '\u{1F3E0} MORADIA');
  assert.equal(sandbox.formatCategoryOptionLabelFromEntry({ name: 'LAZER', icon: 'fun' }), '\u{1F389} LAZER');
  assert.equal(sandbox.formatCategoryOptionLabelFromEntry({ name: 'LAZER', emoji: '\u{1F381}' }), '\u{1F381} LAZER');
});
