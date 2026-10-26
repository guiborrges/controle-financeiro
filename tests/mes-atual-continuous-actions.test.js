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
  for (const file of ['modules/shared/calendar-projection.js', 'modules/shared/outflow-amounts.js', 'modules/continuous-calendar.js', 'modules/continuous-calendar-app.js', 'modules/mes-atual/cards.js', 'modules/mes-atual/shared-expense.js', 'modules/mes-atual/outflow-commands.js', 'modules/mes-atual/outflow-expense-date.js', 'mes-atual.js']) {
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
  ctx.fmt = value => `R$ ${value}`;
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

test('3C new launch validates before mutation and failed persistence retries the same item', async () => {
  const { ctx, elements } = setup();
  ctx.save = async () => false;
  for (const [id, value] of Object.entries({ Description: '', Type: 'launch', Category: 'HOME',
    Tag: '', Amount: '100', Output: 'old', Date: '05/11/26' })) elements[`unifiedOutflow${id}`] = { value };
  const before = JSON.stringify(ctx.data);
  ctx.alert = message => { ctx.invalidMessage = message; };
  assert.equal(ctx.saveUnifiedOutflow().status, 'invalid');
  assert.equal(JSON.stringify(ctx.data), before);
  elements.unifiedOutflowDescription.value = 'New launch';
  const count = ctx.getCurrentMonth().outflows.length;
  const result = await ctx.saveUnifiedOutflow();
  assert.equal(result.status, 'pending');
  assert.equal(ctx.getCurrentMonth().outflows.length, count + 1);
  ctx.save = async () => true;
  const retry = ctx.saveUnifiedOutflow();
  if (ctx.scope) ctx.scope.onThisMonth();
  assert.equal((await retry).status, 'saved');
  assert.equal(ctx.getCurrentMonth().outflows.length, count + 1);
  assert.equal(ctx.getCurrentMonth().outflows.at(-1).id, result.id);
});

for (const scope of ['cancel', 'this', 'forward']) {
  test(`3C deleting a recurring launch preserves the chosen ${scope} scope`, () => {
    const { ctx } = setup();
    const before = JSON.stringify(ctx.data);
    const item = ctx.getCurrentMonth().outflows[0];
    ctx.deleteUnifiedOutflow(item.id);
    assert.equal(JSON.stringify(ctx.data), before);
    if (scope === 'cancel') {
      ctx.scope.onCancel();
      assert.equal(JSON.stringify(ctx.data), before);
    } else {
      ctx.scope[scope === 'forward' ? 'onForward' : 'onThisMonth']();
      assert.equal(ctx.getCurrentMonth().outflows.length, 0);
      assert.equal(ctx.data[2].outflows.length, scope === 'forward' ? 0 : 1);
    }
  });
}

for (const splitMode of ['equal', 'manual']) {
  test(`3C direct Mobile edit preserves recurring metadata and ${splitMode} participant identities without Desktop DOM`, async () => {
    const { ctx } = setup();
    const item = ctx.getCurrentMonth().outflows[0];
    Object.assign(item, { paid: true, sharedExpense: true, sharedSplitMode: splitMode,
      sharedOriginalAmount: 200, sharedOthersAmount: 100, createdAt: '2026-01-01',
      importSource: 'synthetic', sharedParticipants: [
        { id: 'owner', isOwner: true, name: 'Owner', amount: 100, paid: true },
        { id: 'guest', isOwner: false, name: 'Guest', amount: 100, paid: true }
      ] });
    const before = JSON.stringify(item);
    ctx.save = async () => true;
    ctx.collectUnifiedOutflowSharedFromForm = () => { throw new Error('Desktop collector must not run'); };
    ctx.document.getElementById = () => { throw new Error('Desktop DOM must not be read'); };
    const result = ctx.saveMobileUnifiedOutflow('launch', {
      editId: item.id, description: 'Renamed', category: item.category, tag: item.tag,
      amount: 300, date: item.date, output: 'card:old', planning: true
    });
    assert.equal(JSON.stringify(item), before, 'scope precedes mutation');
    ctx.scope.onThisMonth();
    assert.equal((await result).status, 'saved');
    const saved = ctx.getCurrentMonth().outflows[0];
    assert.equal(saved.description, 'Renamed');
    assert.equal(saved.sharedOriginalAmount, 300);
    assert.equal(saved.amount, splitMode === 'equal' ? 150 : 100);
    assert.equal(saved.sharedOthersAmount, splitMode === 'equal' ? 150 : 200);
    assert.equal(saved.recurringGroupId, 'rent');
    assert.equal(saved.expenseRecurring, item.expenseRecurring);
    assert.equal(saved.paid, true);
    assert.equal(saved.createdAt, '2026-01-01');
    assert.equal(saved.importSource, 'synthetic');
    assert.deepEqual(Array.from(saved.sharedParticipants, row => [row.id, row.name, row.paid]),
      [['owner', 'Owner', true], ['guest', 'Guest', true]]);
  });
}

test('mobile description edit preserves recurrence, payment, participants and original metadata', async () => {
  const { ctx, elements } = setup();
  const item = ctx.getCurrentMonth().outflows[0];
  Object.assign(item, { paid: true, tag: 'KEEP', createdAt: '2026-01-01', sharedExpense: true,
    sharedOriginalAmount: 200, sharedOthersAmount: 100,
    sharedParticipants: [{ id: 'owner', isOwner: true, name: 'Owner', amount: 100, paid: true },
      { id: 'guest', isOwner: false, name: 'Guest', amount: 100, paid: true }] });
  const before = JSON.parse(JSON.stringify(item));
  ctx.editId = item.id;
  vm.runInContext('editingUnifiedOutflowId = editId;', ctx);
  for (const [id, value] of Object.entries({ Description: 'Renamed', Type: 'launch', Category: item.category,
    Tag: item.tag, Amount: '200', Output: 'old', Date: item.date })) elements[`unifiedOutflow${id}`] = { value };
  elements.unifiedOutflowRecurringToggle = { checked: true };
  elements.unifiedOutflowPlanningToggle = { checked: true };
  ctx.collectUnifiedOutflowSharedFromForm = () => ({ enabled: true, ownerShare: 100, othersShare: 100, mode: 'equal',
    participants: before.sharedParticipants.map(p => ({ ...p, id: 'new', paid: false })) });
  ctx.save = async () => true;
  const promise = ctx.saveUnifiedOutflow({ preserveSemantics: true });
  assert.equal(ctx.getCurrentMonth().outflows[0].description, before.description, 'scope must be decided before mutation');
  ctx.scope.onThisMonth();
  assert.equal((await promise).status, 'saved');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.getCurrentMonth().outflows[0])), { ...before, description: 'Renamed' });
});

test('3C Mobile installment edit keeps its group, installment index and paid state', async () => {
  const { ctx } = setup();
  const item = ctx.getCurrentMonth().outflows[0];
  Object.assign(item, { installmentsTotal: 4, installmentIndex: 2, installmentsGroupId: 'inst-test',
    recurringGroupId: '', expenseRecurring: false, paid: true });
  ctx.save = async () => true;
  const promise = ctx.saveMobileUnifiedOutflow('launch', { editId: item.id, description: 'Updated installment',
    amount: item.amount, category: item.category, date: item.date, output: 'card:old', planning: true });
  if (ctx.scope) ctx.scope.onThisMonth();
  assert.equal((await promise).status, 'saved');
  const saved = ctx.getCurrentMonth().outflows[0];
  assert.equal(saved.installmentsTotal, 4);
  assert.equal(saved.installmentIndex, 2);
  assert.equal(saved.installmentsGroupId, 'inst-test');
  assert.equal(saved.paid, true);
});

test('3C concurrent Mobile submissions share one persistence operation', async () => {
  const { ctx } = setup();
  let resolve;
  let writes = 0;
  ctx.save = () => { writes++; return new Promise(done => { resolve = done; }); };
  const payload = { description: 'New mobile', category: 'HOME', amount: 25, date: '05/11/26', output: 'card:old' };
  const first = ctx.saveMobileUnifiedOutflow('launch', payload);
  const second = ctx.saveMobileUnifiedOutflow('launch', payload);
  assert.equal(first, second);
  assert.equal(writes, 1);
  resolve(true);
  assert.equal((await first).status, 'saved');
  assert.equal(ctx.getCurrentMonth().outflows.filter(item => item.description === 'New mobile').length, 1);
});

test('cancelled scope resolves without changing the month or confirming a save', async () => {
  const { ctx, elements } = setup();
  const before = JSON.stringify(ctx.data);
  editRecurrenceOff(ctx, elements);
  const promise = ctx.saveUnifiedOutflow();
  ctx.scope.onCancel();
  assert.equal((await promise).status, 'cancelled');
  assert.equal(JSON.stringify(ctx.data), before);
});

test('outflow save confirms only after the matching persistence promise resolves', async () => {
  for (const confirmed of [false, true]) {
    const { ctx, elements } = setup();
    let resolve;
    let toasts = 0;
    ctx.save = () => new Promise(done => { resolve = done; });
    ctx.showUnifiedOutflowQuickToast = () => { toasts++; };
    editRecurrenceOff(ctx, elements);
    const promise = ctx.saveUnifiedOutflow();
    ctx.scope.onThisMonth();
    assert.equal(toasts, 0);
    resolve(confirmed);
    assert.equal((await promise).status, confirmed ? 'saved' : 'pending');
    assert.equal(toasts, confirmed ? 1 : 0);
  }
});

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
