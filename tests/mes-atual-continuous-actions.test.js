const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function month(ordinal) {
  return { id: `m_${ordinal}`, ordinal, outflows: [], outflowCards: [], cardBills: [], renda: [], projetos: [] };
}

function setup({ legacy = false } = {}) {
  const elements = {};
  const ctx = {
    currentSession: null,
    document: { getElementById: id => elements[id] || (elements[id] = { value: '', checked: false }) },
    normalizeVarDate: value => value,
    resolveCategoryName: value => value,
    getMonthSortValue: value => value.ordinal,
    getCurrentRealMonthId: () => 'm_10',
    alert: message => { throw new Error(message); }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of ['modules/continuous-calendar.js', 'modules/continuous-calendar-app.js', 'modules/mes-atual/cards.js', 'modules/mes-atual/outflow-expense-date.js', 'mes-atual.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app', file), 'utf8'), ctx);
  }
  const options = {
    start: 10, sort: ctx.getMonthSortValue, blank: value => month(value.ordinal),
    month: id => month(Number(id.split('_')[1])), normalize: () => {},
    occurrence: (collection, item) => item
  };
  const source = month(10);
  source.outflowCards = [{ id: 'old', name: 'Old' }, { id: 'target', name: 'Target' }];
  source.outflows = [ctx.normalizeUnifiedOutflowItem({
    id: 'original', description: 'Rent', category: 'HOME', amount: 100,
    type: 'expense', outputKind: 'card', outputRef: 'old', date: '05/11/26',
    recurringGroupId: 'rent', expenseRecurring: !legacy, showInMonthPlanning: true
  })];
  if (legacy) {
    source.outflows[0].recurringSpend = false;
    source.outflows[0].expenseRecurring = false;
    source.outflows[0].launchRecurring = false;
  }
  const model = ctx.ContinuousCalendar.createModel([source], options);
  const session = ctx.ContinuousCalendar.createSession(model, options);
  ctx.data = [session.hydrate(source), session.virtual(month(11)), session.virtual(month(12))];
  ctx.getCurrentMonth = () => ctx.data[1];
  ctx.getContinuousCalendarOptions = () => options;
  ctx.testModel = model;
  ctx.testSession = session;
  vm.runInContext('continuousCalendarModel = testModel; continuousCalendarSession = testSession;', ctx);
  for (const name of ['ensureUnifiedOutflowPilotMonth', 'recordHistoryState', 'markUnifiedOutflowSelectionVisibleFromMonth',
    'syncUnifiedCardBillForecastAmounts', 'syncUnifiedOutflowLegacyData', 'renderMes', 'renderUnifiedOutflowModalRecentList',
    'showUnifiedOutflowQuickToast', 'closeUnifiedOutflowModal', 'closeModal', 'resetUnifiedCardAutoBillIfDisabled',
    'syncUnifiedCardAutoAmounts']) ctx[name] = () => {};
  ctx.preserveCurrentScroll = callback => callback();
  ctx.save = () => { ctx.saved = session.serialize(ctx.data); };
  ctx.openYesNoQuestion = (message, yes) => yes();
  ctx.openRecurringChangeScopeModal = handlers => { ctx.scope = handlers; };
  ctx.canPropagateRecurringFromMonth = () => true;
  ctx.getUnifiedOutflowTags = () => [];
  ctx.getOwnerDisplayName = () => 'Owner';
  ctx.collectUnifiedOutflowSharedFromForm = amount => ({ enabled: false, ownerShare: amount, othersShare: 0, participants: [] });
  ctx.resolveUnifiedExpenseDateInput = value => value;
  ctx.normalizeUnifiedOutflowSpendDateInput = value => value;
  ctx.parseUnifiedOutflowOutputValue = () => ({ outputKind: 'card', outputRef: 'old' });
  return { ctx, elements, model, session, options };
}

function editRecurrenceOff(ctx, elements) {
  const item = ctx.getCurrentMonth().outflows[0];
  ctx.editId = item.id;
  vm.runInContext('editingUnifiedOutflowId = editId;', ctx);
  for (const [id, value] of Object.entries({ Description: 'Rent', Type: 'expense', Category: 'HOME',
    Tag: '', Amount: '100', Output: 'old', Date: '05/11/26' })) {
    elements[`unifiedOutflow${id}`] = { value };
  }
  elements.unifiedOutflowPlanningToggle = { checked: true };
  ctx.saveUnifiedOutflow();
  assert.ok(ctx.scope, 'removing recurrence must ask for scope');
  return item.id;
}

test('explicit planning flags survive repeated real normalization', () => {
  const { ctx } = setup();
  for (const flags of [{ showInMonthPlanning: true }, { includeInMonthPlanning: true },
    { expenseRecurring: true, showInMonthPlanning: false },
    { expenseRecurring: true, includeInMonthPlanning: false },
    { showInMonthPlanning: false, includeInMonthPlanning: true }]) {
    const expected = flags.showInMonthPlanning ?? flags.includeInMonthPlanning;
    let item = { description: 'Test', ...flags };
    for (let index = 0; index < 3; index++) {
      item = ctx.normalizeUnifiedOutflowItem(item);
      assert.equal(item.showInMonthPlanning, expected);
    }
  }
});

test('actual migration preserves normalized planning flags before and after version upgrade', () => {
  const { ctx } = setup();
  ctx.UNIFIED_OUTFLOW_GLOBAL_MIGRATION_VERSION = 5;
  const value = month(11);
  value.outflows = [
    { showInMonthPlanning: true },
    { includeInMonthPlanning: true },
    { expenseRecurring: true, showInMonthPlanning: false },
    { expenseRecurring: true, includeInMonthPlanning: false },
    { showInMonthPlanning: false, includeInMonthPlanning: true },
    { expenseRecurring: true }
  ].map((flags, index) => ({ id: `planning_${index}`, description: 'Test', type: 'expense', amount: 10, ...flags }));
  for (let pass = 0; pass < 3; pass++) {
    // Exercise the migration block twice, then its current-version startup path.
    if (pass < 2) value._unifiedOutflowMigratedVersion = 0;
    ctx.migrateUnifiedOutflowMonth(value, { isGuilherme: false });
    assert.deepEqual(Array.from(value.outflows, item => item.showInMonthPlanning), [true, true, false, false, false, true]);
    assert.equal(value._unifiedOutflowMigratedVersion, 5);
  }
});

for (const legacy of [false, true]) {
  for (const forward of [false, true]) {
    test(`recurrence off (${legacy ? 'legacy identity' : 'explicit flag'}, ${forward ? 'forward' : 'this month'}) survives save/reload`, () => {
      const { ctx, elements, model, options } = setup({ legacy });
      const id = editRecurrenceOff(ctx, elements);
      assert.equal(ctx.getCurrentMonth().outflows[0].recurringGroupId, 'rent', 'no mutation before scope choice');
      ctx.scope[forward ? 'onForward' : 'onThisMonth']();
      const current = ctx.getCurrentMonth().outflows[0];
      assert.equal(current.id, id);
      assert.equal(current.recurringGroupId, '');
      assert.equal(current.launchRecurring, false);
      assert.equal(ctx.data[2].outflows.length, forward ? 0 : 1);
      const reloaded = ctx.ContinuousCalendar.createSession(JSON.parse(JSON.stringify(model)), options);
      const stored = ctx.saved.find(value => value.id === 'm_11');
      const restored = reloaded.hydrate(stored);
      assert.equal(restored.outflows.length, 1, 'current occurrence must not resurrect a duplicate');
      assert.equal(restored.outflows[0].id, id);
      assert.equal(restored.outflows[0].launchRecurring, false);
      assert.equal(reloaded.virtual(month(30)).outflows.length, forward ? 0 : 1);
      assert.equal(reloaded.virtual(month(10)).outflows.length, 1, 'past series remains intact');
    });
  }
}

for (const remove of [false, true]) {
  test(`card ${remove ? 'deletion' : 'transfer'} updates loaded months and distant projections`, () => {
    const { ctx, elements, model, options } = setup();
    vm.runInContext("deletingUnifiedCardId = 'old';", ctx);
    elements.unifiedCardDeleteModeDelete = { checked: remove };
    elements.unifiedCardDeleteTarget = { value: remove ? '' : 'target' };
    elements.unifiedCardDeleteConfirm = { checked: true };
    ctx.confirmUnifiedCardDelete();
    for (const value of ctx.data.slice(1)) {
      assert.equal(value.outflowCards.some(card => card.id === 'old'), false);
      assert.equal(value.outflows.length, remove ? 0 : 1);
      if (!remove) assert.equal(value.outflows[0].outputRef, 'target');
    }
    const engine = ctx.ContinuousCalendar;
    const reloadedModel = JSON.parse(JSON.stringify(model));
    const reloaded = engine.createSession(reloadedModel, options);
    for (const stored of ctx.saved.filter(value => value.ordinal >= 11)) {
      const restored = reloaded.hydrate(stored);
      assert.equal(restored.outflowCards.some(card => card.id === 'old'), false);
      assert.equal(restored.outflows.length, remove ? 0 : 1);
      if (!remove) assert.equal(restored.outflows[0].outputRef, 'target');
    }
    const future = engine.project(reloadedModel, month(30), options);
    assert.equal(future.outflowCards.some(card => card.id === 'old'), false);
    assert.equal(future.outflows.length, remove ? 0 : 1);
    if (!remove) assert.equal(future.outflows[0].outputRef, 'target');
    assert.equal(engine.project(reloadedModel, month(10), options).outflows[0].outputRef, 'old');
  });
}

test('saving card edits updates settings beyond the loaded window', () => {
  const { ctx, elements, model, options } = setup();
  vm.runInContext("editingUnifiedCardId = 'old';", ctx);
  for (const [id, value] of Object.entries({ Bank: 'outro', OtherBank: 'Renamed', ClosingDay: '5', PaymentDay: '15', Description: 'Updated' })) {
    elements[`unifiedCard${id}`] = { value };
  }
  ctx.resolveUnifiedCardDateInput = value => ({ day: Number(value), date: '' });
  ctx.getUnifiedCardDateForMonth = value => value;
  ctx.saveUnifiedCard();
  assert.equal(ctx.data[2].outflowCards.find(card => card.id === 'old').name, 'Renamed');
  const future = ctx.ContinuousCalendar.project(JSON.parse(JSON.stringify(model)), month(30), options);
  assert.equal(future.outflowCards.find(card => card.id === 'old').name, 'Renamed');
  assert.equal(ctx.ContinuousCalendar.project(model, month(10), options).outflowCards[0].name, 'Old');
});

test('creating a card updates loaded months and distant settings', () => {
  const { ctx, elements, model, options } = setup();
  for (const [id, value] of Object.entries({ Bank: 'outro', OtherBank: 'New card', ClosingDay: '5', PaymentDay: '15', Description: '' })) {
    elements[`unifiedCard${id}`] = { value };
  }
  ctx.resolveUnifiedCardDateInput = value => ({ day: Number(value), date: '' });
  ctx.getUnifiedCardDateForMonth = value => value;
  ctx.saveUnifiedCard();
  const created = ctx.getCurrentMonth().outflowCards.find(card => card.name === 'New card');
  assert.ok(created?.id);
  assert.ok(ctx.data[2].outflowCards.some(card => card.id === created.id));
  const future = ctx.ContinuousCalendar.project(JSON.parse(JSON.stringify(model)), month(30), options);
  assert.ok(future.outflowCards.some(card => card.id === created.id));
  assert.equal(ctx.ContinuousCalendar.project(model, month(10), options).outflowCards.length, 2);
});

test('actual billing harmonizer preserves explicit month/year across repeated startup passes', () => {
  const { ctx } = setup();
  ctx.normalizeVarDate = value => {
    const match = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    return match ? `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3].slice(-2)}` : '';
  };
  ctx.getMonthDateFromMonthObject = () => new Date(2026, 3, 1);
  const value = { nome: 'ABRIL 2026', outflows: [
    { type: 'expense', date: '10/04/26' },
    { type: 'expense', expenseRecurring: true, date: '10/06/2026' },
    { type: 'expense', date: '1/1/2027' },
    { type: 'expense', outputKind: 'card', date: '10/12/26' }
  ] };
  assert.equal(ctx.harmonizeUnifiedFixedBillingDates(value), true);
  assert.deepEqual(value.outflows.map(item => item.date), ['10/04/26', '10/06/26', '01/01/27', '10/12/26']);
  assert.equal(ctx.harmonizeUnifiedFixedBillingDates(value), false);
});
