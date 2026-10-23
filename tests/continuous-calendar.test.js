const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/app/modules/continuous-calendar.js'), 'utf8'), sandbox);
  return sandbox.ContinuousCalendar;
}

function month(ordinal) {
  return { id: `m_${ordinal}`, nome: `Month ${ordinal}`, ordinal, renda: [], outflows: [], projetos: [], cardBills: [], financialGoals: [], calendarEvents: [], patrimonioTransfers: [], obs: '' };
}

function setup() {
  const engine = load();
  const options = {
    start: 10,
    sort: item => item.ordinal,
    blank: item => month(item.ordinal),
    month: id => month(Number(id.split('_')[1])),
    normalize: () => {},
    occurrence: (collection, item, target, source, offset) => {
      item.paid = false;
      if (collection === 'outflows') item.installmentIndex = Number(item.installmentIndex || 1) + offset;
      return item;
    }
  };
  const source = month(10);
  source.renda = [{ fonte: 'Salario', valor: 3000, recurringFixed: true, recurringGroupId: 'salary', paid: true }];
  source.outflows = [{ id: 'old', description: 'Aluguel', amount: 900, expenseRecurring: true, recurringGroupId: 'rent', paid: true }];
  const model = engine.createModel([source], options);
  const session = engine.createSession(model, options);
  return { engine, options, source, model, session };
}

test('read-only inspector equals navigation, preserves paid/local/removed exceptions and never materializes months', () => {
  const { engine, options, source, model, session } = setup();
  options.monthAtOrdinal = month;
  const loaded = [session.hydrate(source), session.virtual(month(11)), session.virtual(month(12))];
  loaded[1].outflows[0].amount = 1234;
  loaded[2].outflows = [];
  const before = JSON.stringify({ model, loaded, stored: session.serialize(loaded) });
  const rent = engine.inspect(model, loaded[0], loaded, options).find(entry => entry.id === 'outflows:rent');
  assert.deepEqual(Array.from(rent.occurrences, entry => entry.month.ordinal), [10, 11, 13]);
  assert.equal(rent.occurrences[0].exception, 'paid');
  assert.equal(rent.occurrences[1].exception, 'local');
  assert.equal(rent.exceptions.some(entry => entry.month === 'm_12' && entry.kind === 'removed'), true);
  assert.equal(JSON.stringify(rent.occurrences[2].item), JSON.stringify(session.virtual(month(13)).outflows[0]));
  assert.equal(JSON.stringify({ model, loaded, stored: session.serialize(loaded) }), before);
});

test('inspector respects stops, last installment and future card reassignment', () => {
  const { engine, options, model } = setup();
  options.monthAtOrdinal = month;
  const rule = model.rules.find(entry => entry.id === 'outflows:rent');
  rule.versions[0].payload.installmentsTotal = 2;
  rule.versions[0].payload.installmentIndex = 1;
  rule.versions[0].payload.outputKind = 'card';
  rule.versions[0].payload.outputRef = 'xp';
  rule.versions.push({ from: 11, sourceMonth: 'm_11', payload: { ...rule.versions[0].payload, installmentIndex: 2, outputRef: 'inter' } });
  let inspected = engine.inspect(model, month(10), [], options).find(entry => entry.id === rule.id);
  assert.deepEqual(Array.from(inspected.occurrences, entry => entry.item.outputRef), ['xp', 'inter']);
  rule.versions.push({ from: 11, stopped: true });
  rule.versions = rule.versions.filter(entry => entry.from !== 11 || entry.stopped);
  inspected = engine.inspect(model, month(11), [], options).find(entry => entry.id === rule.id);
  assert.equal(inspected.stopped, true);
  assert.equal(inspected.occurrences.length, 0);
});

test('category merge and accented tag rename also update sparse future rules and settings', () => {
  const { engine, options, model } = setup();
  const rule = model.rules.find(entry => entry.id === 'outflows:rent');
  rule.versions[0].payload.category = 'CASA';
  rule.versions[0].payload.tag = 'Fe\u0301rias';
  model.settings[0].payload.selectionVisibility = { version: 2, categories: { CASA: true, MORADIA: false }, tags: { 'férias': true } };
  model.settings[0].payload.dailyGoals = { CASA: 20, MORADIA: 30 };
  engine.renameSelection(model, 'category', 'CASA', 'MORADIA', value => String(value || '').toUpperCase());
  engine.renameSelection(model, 'tag', 'Férias', 'Viagem');
  const projected = engine.project(model, month(30), options);
  assert.equal(projected.outflows[0].category, 'MORADIA');
  assert.equal(projected.outflows[0].tag, 'Viagem');
  assert.equal(projected.dailyGoals.MORADIA, 50);
  assert.equal(projected.selectionVisibility.categories.CASA, undefined);
  assert.equal(projected.selectionVisibility.tags.viagem, true);
});

test('all future months are projected directly without their predecessor being present', () => {
  const { session } = setup();
  const december = session.virtual(month(24));
  assert.equal(december.renda[0].valor, 3000);
  assert.equal(december.renda[0].paid, false);
  assert.equal(december.outflows[0].amount, 900);
  assert.equal(december.outflows[0].paid, false);
});

test('stopping a series removes unpaid future exceptions and stale saved copies after reload', () => {
  const { engine, options, source, model, session } = setup();
  const current = session.hydrate(source);
  const future = session.virtual(month(11));
  future.outflows[0].amount = 999;
  const stale = JSON.parse(JSON.stringify(future));
  session.stop([current, future], current, 'outflows', 'rent');
  assert.equal(future.outflows.length, 0);
  const reload = engine.createSession(JSON.parse(JSON.stringify(model)), options);
  assert.equal(reload.hydrate(stale).outflows.length, 0);
  assert.equal(reload.virtual(month(12)).outflows.length, 0);
  assert.equal(current.outflows.length, 1, 'caller owns removal of current occurrence');
});

test('legacy expenses recur by their series id even when modern boolean flags are false', () => {
  const { engine, options } = setup();
  const source = month(10);
  source.outflows = ['Aluguel', 'Energia', 'Internet'].map((description, index) => ({
    id: `legacy_${index}`, description, type: 'expense', amount: 100,
    expenseRecurring: false, recurringSpend: false, launchRecurring: false,
    recurringGroupId: `legacy_fixed_${description}`, installmentsTotal: 1, paid: true
  }));
  const model = engine.createModel([source], options);
  const future = engine.project(model, month(24), options);
  assert.equal(future.outflows.length, 3);
  assert.equal(future.outflows.every(item => item.paid === false), true);
});

test('repair adds only missing legacy rules and preserves explicit stops and monthly exceptions', () => {
  const { engine, options, model } = setup();
  delete model.recurrenceRevision;
  model.rules.find(rule => rule.key === 'rent').versions.push({ from: 11, stopped: true });
  const source = month(10);
  source.outflows = [{ id: 'legacy', description: 'Internet', type: 'expense', amount: 100, recurringGroupId: 'legacy_fixed_INTERNET', expenseRecurring: false }];
  const count = model.rules.length;
  assert.equal(engine.repairRecurringRules(model, [source], options), true);
  assert.equal(model.rules.length, count + 1);
  assert.equal(model.rules.find(rule => rule.key === 'rent').versions.at(-1).stopped, true);
  assert.equal(engine.project(model, month(12), options).outflows.length, 1);
  assert.equal(engine.repairRecurringRules(model, [source], options), false);
  assert.equal(model.rules.length, count + 1);
});

test('a marked recurring expense without a series id gets one stable schedule', () => {
  const { engine, options } = setup();
  const source = month(10);
  source.outflows = [{ id: 'one', description: 'Internet', amount: 100, expenseRecurring: true }];
  const model = engine.createModel([source], options);
  const session = engine.createSession(model, options);
  assert.equal(model.rules.length, 1);
  assert.equal(session.hydrate(source).outflows.length, 1);
  assert.equal(session.virtual(month(11)).outflows.length, 1);
});

test('browsing two years does not add virtual months to stored data', () => {
  const { source, session } = setup();
  const history = session.hydrate(source);
  const months = [history, ...Array.from({ length: 24 }, (_, i) => session.virtual(month(i + 11)))];
  const stored = session.serialize(months);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].outflows[0].id, 'old');
  assert.equal(stored[0].outflows[0].paid, true);
});

test('monthly receipts and local edits survive repeated save and reload', () => {
  const { engine, model, options, session } = setup();
  const future = session.virtual(month(11));
  future.renda[0].paid = true;
  future.renda[0].patrimonioMovementId = 'receipt';
  future.outflows[0].amount = 950;
  let stored = session.serialize([future]);
  for (let i = 0; i < 3; i += 1) {
    const restored = engine.createSession(model, options);
    const hydrated = stored.map(value => restored.hydrate(value));
    assert.equal(hydrated[0].renda[0].paid, true);
    assert.equal(hydrated[0].renda[0].patrimonioMovementId, 'receipt');
    assert.equal(hydrated[0].outflows[0].amount, 950);
    stored = restored.serialize(hydrated);
    assert.equal(stored.length, 1);
  }
});

test('skip one month is preserved without ending the recurring series', () => {
  const { engine, model, options, session } = setup();
  const future = session.virtual(month(11));
  future.renda = [];
  const stored = session.serialize([future]);
  const restored = engine.createSession(model, options);
  assert.equal(restored.hydrate(stored[0]).renda.length, 0);
  assert.equal(restored.virtual(month(12)).renda.length, 1);
  session.upsert([future], month(10), 'renda', { fonte: 'Salario', valor: 4000, recurringFixed: true, recurringGroupId: 'salary' });
  assert.equal(future.renda.length, 0);
});

test('obsolete historical series are not revived beside the latest active income', () => {
  const { engine, options } = setup();
  const old = month(8);
  old.renda = [{ fonte: 'Emprego antigo', valor: 1000, recurringGroupId: 'old' }];
  const current = month(10);
  current.renda = [{ fonte: 'Emprego atual', valor: 3000, recurringGroupId: 'new' }];
  const model = engine.createModel([old, current], options);
  const future = engine.project(model, month(11), options);
  assert.equal(future.renda.length, 1);
  assert.equal(future.renda[0].fonte, 'Emprego atual');
});

test('forward changes respect paid and individually changed months and persist beyond window', () => {
  const { engine, model, options, session } = setup();
  const months = [11, 12, 13].map(value => session.virtual(month(value)));
  months[0].renda[0].paid = true;
  months[1].renda[0].valor = 3500;
  session.upsert(months, month(10), 'renda', { fonte: 'Salario', valor: 4000, recurringFixed: true, recurringGroupId: 'salary' });
  assert.equal(months[0].renda[0].valor, 3000);
  assert.equal(months[1].renda[0].valor, 3500);
  assert.equal(months[2].renda[0].valor, 4000);
  assert.equal(engine.project(model, month(40), options).renda[0].valor, 4000);
  session.stop(months, month(14), 'renda', 'salary');
  assert.equal(engine.project(model, month(40), options).renda.length, 0);
});

test('finite installment schedules stop on the last installment', () => {
  const { engine, options } = setup();
  const source = month(10);
  source.outflows = [{ id: 'installment', description: 'Notebook', amount: 200, installmentsGroupId: 'purchase', installmentsTotal: 3, installmentIndex: 1 }];
  const model = engine.createModel([source], options);
  assert.equal(engine.project(model, month(12), options).outflows[0].installmentIndex, 3);
  assert.equal(engine.project(model, month(13), options).outflows.length, 0);
});

test('legacy future card copies cannot undo current card assignments during repair', () => {
  const { engine, options } = setup();
  const current = month(10);
  current.outflows = [{ id: 'current', description: 'Streaming', recurringGroupId: 'legacy_signature_old_2', outputKind: 'card', outputRef: 'xp', amount: 20 }];
  const future = month(11);
  future.outflows = [{ ...current.outflows[0], id: 'future', outputRef: 'inter', amount: 25 }];
  const paid = month(12);
  paid.outflows = [{ ...future.outflows[0], paid: true }];
  const model = engine.createModel([current, future, paid], options);
  assert.equal(engine.repairLegacyCardOutputs(model, [current, future, paid], options), true);
  assert.equal(future.outflows[0].outputRef, 'xp');
  assert.equal(future.outflows[0].amount, 25);
  assert.equal(paid.outflows[0].outputRef, 'inter');
  assert.equal(engine.project(model, month(24), options).outflows[0].outputRef, 'xp');
  const session = engine.createSession(model, options);
  const stored = session.serialize([session.hydrate(future)]);
  assert.equal(engine.createSession(model, options).hydrate(stored[0]).outflows[0].outputRef, 'xp');
  assert.equal(engine.repairLegacyCardOutputs(model, [current, future], options), false);
});

test('forward changes preserve a monthly exception after saving and reloading', () => {
  const { engine, options, model, session } = setup();
  const future = session.virtual(month(12));
  future.renda[0].valor = 3500;
  future.outflows[0].amount = 950;
  const saved = session.serialize([future]);
  const restored = engine.createSession(model, options);
  const months = saved.map(item => restored.hydrate(item));
  restored.upsert(months, month(10), 'renda', { fonte: 'Salario', valor: 4000, recurringGroupId: 'salary' });
  restored.upsert(months, month(10), 'outflows', { description: 'Aluguel', amount: 1000, recurringGroupId: 'rent' });
  assert.equal(months[0].renda[0].valor, 3500);
  assert.equal(months[0].outflows[0].amount, 950);
  const reloaded = engine.createSession(model, options).hydrate(restored.serialize(months)[0]);
  assert.equal(reloaded.renda[0].valor, 3500);
  assert.equal(reloaded.outflows[0].amount, 950);
});

test('card settings changes persist beyond loaded months without resetting other settings', () => {
  const { engine, options, model } = setup();
  model.settings[0].payload.dailyGoalTarget = 200;
  model.settings[0].payload.outflowCards = [{ id: 'old' }];
  model.settings.push({ from: 12, payload: { dailyGoalTarget: 300, outflowCards: [{ id: 'old' }, { id: 'future-only' }] } });
  const source = month(11);
  source.outflowCards = [{ id: 'new', name: 'Renamed' }];
  engine.updateCards(model, source, options);
  const future = engine.project(JSON.parse(JSON.stringify(model)), month(40), options);
  assert.equal(future.outflowCards.find(card => card.id === 'new').name, 'Renamed');
  assert.equal(future.dailyGoalTarget, 300);
  assert.ok(future.outflowCards.some(card => card.id === 'future-only'));
  assert.equal(engine.project(model, month(10), options).dailyGoalTarget, 200);
  source.outflowCards = [];
  engine.updateCards(model, source, options);
  assert.equal(engine.project(model, month(40), options).outflowCards.length, 1);
  assert.equal(engine.project(model, month(40), options).outflowCards[0].id, 'future-only');
});

test('editing one card preserves scheduled changes for unrelated future cards', () => {
  const { engine, options, model } = setup();
  model.settings[0].payload.outflowCards = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  model.settings.push({ from: 12, payload: { outflowCards: [{ id: 'a', name: 'A' }, { id: 'b', name: 'Future B' }] } });
  const edited = month(11);
  edited.outflowCards = [{ id: 'a', name: 'Updated A' }, { id: 'b', name: 'B' }];
  engine.updateCards(model, edited, options, 'a');
  const future = engine.project(model, month(30), options);
  assert.equal(future.outflowCards.find(card => card.id === 'a').name, 'Updated A');
  assert.equal(future.outflowCards.find(card => card.id === 'b').name, 'Future B');
});

test('an unrelated card keeps its explicit date offset when a new settings version is created', () => {
  const { engine, options, model } = setup();
  options.monthAtOrdinal = month;
  options.projectSettings = (payload, target, source) => {
    payload.outflowCards.forEach(card => {
      const [day, monthNumber, year] = card.paymentDate.split('/').map(Number);
      const date = new Date(Date.UTC(2000 + year, monthNumber - 1 + target.ordinal - source.ordinal, day));
      card.paymentDate = `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCFullYear()).slice(-2)}`;
    });
  };
  model.settings[0].payload.outflowCards = [{ id: 'a', name: 'A', paymentDate: '10/11/26' }, { id: 'b', name: 'B', paymentDate: '15/11/26' }];
  const edited = month(11);
  edited.outflowCards = [{ id: 'a', name: 'Updated', paymentDate: '10/12/26' }, { id: 'b', name: 'B', paymentDate: '15/12/26' }];
  engine.updateCards(model, edited, options, 'a');
  const projected = engine.project(model, month(12), options);
  assert.equal(projected.outflowCards.find(card => card.id === 'b').paymentDate, '15/01/27');
});

test('card transfer and deletion update future rules without changing history or installment positions', () => {
  const { engine, options } = setup();
  const source = month(10);
  source.outflows = [{ id: 'purchase', description: 'Purchase', outputKind: 'card', outputRef: 'old', installmentsGroupId: 'purchase', installmentsTotal: 6, installmentIndex: 1 }];
  const model = engine.createModel([source], options);
  engine.changeCard(model, month(12), 'old', 'new', options);
  assert.equal(engine.project(model, month(11), options).outflows[0].outputRef, 'old');
  const projected = engine.project(model, month(13), options).outflows[0];
  assert.equal(projected.outputRef, 'new');
  assert.equal(projected.installmentIndex, 4);
  assert.equal(engine.project(model, month(16), options).outflows.length, 0);
  const finished = JSON.parse(JSON.stringify(model));
  engine.changeCard(finished, month(20), 'new', 'third', options);
  assert.equal(engine.project(finished, month(21), options).outflows.length, 0);
  engine.changeCard(model, month(14), 'new', '', options);
  assert.equal(engine.project(model, month(15), options).outflows.length, 0);
});
