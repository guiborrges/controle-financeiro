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

test('all future months are projected directly without their predecessor being present', () => {
  const { session } = setup();
  const december = session.virtual(month(24));
  assert.equal(december.renda[0].valor, 3000);
  assert.equal(december.renda[0].paid, false);
  assert.equal(december.outflows[0].amount, 900);
  assert.equal(december.outflows[0].paid, false);
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
