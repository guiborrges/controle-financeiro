const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function createDocumentStub(initial = {}) {
  const elements = new Map(Object.entries(initial).map(([id, value]) => [id, { ...value }]));
  return {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, { value: '', checked: false, innerHTML: '' });
      }
      return elements.get(id);
    }
  };
}

function loadModalsModule(contextOverrides = {}) {
  const filePath = path.resolve(__dirname, '../public/app/modules/mes-atual/modals.js');
  const code = fs.readFileSync(filePath, 'utf8');
  const baseContext = {
    window: {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    document: createDocumentStub(),
    ...contextOverrides
  };
  vm.createContext(baseContext);
  vm.runInContext(code, baseContext, { filename: filePath });
  return baseContext.window.MesAtualModals;
}

test('buildUnifiedOutflowDraftFromForm defaults type to expense when select is missing/invalid', () => {
  const document = createDocumentStub({
    unifiedOutflowType: { value: '', checked: false },
    unifiedOutflowDescription: { value: 'teste' },
    unifiedOutflowCategory: { value: 'COMPRAS' },
    unifiedOutflowNewCategory: { value: '' },
    unifiedOutflowAmount: { value: '10' },
    unifiedOutflowOutput: { value: 'method:pix' },
    unifiedOutflowDate: { value: '10/04/26' },
    unifiedOutflowRecurringToggle: { checked: false },
    unifiedOutflowPlanningToggle: { checked: false },
    unifiedOutflowInstallmentsToggle: { checked: false },
    unifiedOutflowInstallmentsCount: { value: '2' },
    unifiedOutflowTag: { value: '' },
    unifiedOutflowNewTagInline: { value: '' },
    unifiedOutflowSharedToggle: { checked: false },
    unifiedOutflowSharedPeopleCount: { value: '2' },
    unifiedOutflowSharedMode: { value: 'equal' }
  });
  const modals = loadModalsModule({ document });
  const draft = modals.buildUnifiedOutflowDraftFromForm({ id: '2026-04' }, {
    readSharedParticipantsFromDOM: () => []
  });
  assert.equal(draft.type, 'expense');
  assert.equal(draft.entryKind, 'launch');
  assert.equal(draft.launchType, 'expense');
  assert.equal(draft.launchRecurring, false);
  assert.equal(draft.launchInstallment, false);
  assert.equal(draft.launchShared, false);
  assert.equal(draft.showInMonthPlanning, false);
});

test('applyUnifiedOutflowDraftToForm maps legacy fixed type to expense selection', () => {
  const document = createDocumentStub({
    unifiedOutflowType: { value: 'spend' },
    unifiedOutflowDescription: { value: '' },
    unifiedOutflowCategory: { value: '' },
    unifiedOutflowNewCategory: { value: '' },
    unifiedOutflowAmount: { value: '' },
    unifiedOutflowOutput: { value: '', innerHTML: '' },
    unifiedOutflowDate: { value: '' },
    unifiedOutflowRecurringToggle: { checked: false },
    unifiedOutflowPlanningToggle: { checked: false },
    unifiedOutflowInstallmentsToggle: { checked: false },
    unifiedOutflowInstallmentsCount: { value: '2' },
    unifiedOutflowTag: { value: '' },
    unifiedOutflowNewTagInline: { value: '' },
    unifiedOutflowSharedToggle: { checked: false },
    unifiedOutflowSharedPeopleCount: { value: '2' },
    unifiedOutflowSharedMode: { value: 'equal' }
  });
  const modals = loadModalsModule({ document });
  modals.applyUnifiedOutflowDraftToForm({ id: '2026-04' }, {
    type: 'fixed',
    outputValue: 'method:boleto'
  }, {
    populateCategoryOptions: () => {},
    toggleNewCategory: () => {},
    getOutputOptions: () => '',
    populateTagOptions: () => {},
    toggleNewTag: () => {},
    toggleInstallments: () => {},
    handleTypeChange: () => {},
    renderDescriptionSuggestions: () => {}
  });
  assert.equal(document.getElementById('unifiedOutflowType').value, 'expense');
});

test('applyUnifiedOutflowDraftToForm prioritizes launch flags when present', () => {
  const document = createDocumentStub({
    unifiedOutflowType: { value: 'expense' },
    unifiedOutflowDescription: { value: '' },
    unifiedOutflowCategory: { value: '' },
    unifiedOutflowNewCategory: { value: '' },
    unifiedOutflowAmount: { value: '' },
    unifiedOutflowOutput: { value: '', innerHTML: '' },
    unifiedOutflowDate: { value: '' },
    unifiedOutflowRecurringToggle: { checked: false },
    unifiedOutflowPlanningToggle: { checked: false },
    unifiedOutflowInstallmentsToggle: { checked: false },
    unifiedOutflowInstallmentsCount: { value: '2' },
    unifiedOutflowTag: { value: '' },
    unifiedOutflowNewTagInline: { value: '' },
    unifiedOutflowSharedToggle: { checked: false },
    unifiedOutflowSharedPeopleCount: { value: '2' },
    unifiedOutflowSharedMode: { value: 'equal' }
  });
  const modals = loadModalsModule({ document });
  modals.applyUnifiedOutflowDraftToForm({ id: '2026-04' }, {
    launchType: 'spend',
    launchRecurring: true,
    launchInstallment: true,
    launchShared: true,
    outputValue: 'method:pix'
  }, {
    populateCategoryOptions: () => {},
    toggleNewCategory: () => {},
    getOutputOptions: () => '',
    populateTagOptions: () => {},
    toggleNewTag: () => {},
    toggleInstallments: () => {},
    handleTypeChange: () => {},
    renderDescriptionSuggestions: () => {}
  });
  assert.equal(document.getElementById('unifiedOutflowType').value, 'spend');
  assert.equal(document.getElementById('unifiedOutflowRecurringToggle').checked, true);
  assert.equal(document.getElementById('unifiedOutflowInstallmentsToggle').checked, true);
  assert.equal(document.getElementById('unifiedOutflowSharedToggle').checked, true);
});
