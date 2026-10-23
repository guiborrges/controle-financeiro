const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const commands = require('../public/app/modules/mes-atual/outflow-commands');
const { browserSandbox, loadBrowser } = require('./helpers/refactor-fixtures');
const shared = browserSandbox();
loadBrowser(shared, ['modules/mes-atual/shared-expense.js']);
const sharedContext = {
  getOwnerDisplayName: () => 'Owner', fmt: value => `R$ ${value}`,
  getUnifiedSharedComputedValues: shared.MesAtualSharedExpense.getUnifiedSharedComputedValues
};

function environment(draft, confirmed = true) {
  const month = { id: 'outubro_2026', outflows: [], outflowCards: [{ id: 'c' }] };
  const events = [];
  return { month, data: [month], events,
    ensureUnifiedOutflowPilotMonth() {}, normalizeUnifiedOutflowType: value => value,
    resolveCategoryName: value => String(value).toUpperCase(), isNonRealCategoryLabel: value => value === 'PIX',
    parseUnifiedOutflowOutputValue: value => {
      const [kind, ref] = value.split(':');
      return { outputKind: kind, outputRef: kind === 'card' ? ref : '', outputMethod: kind === 'method' ? ref : '' };
    },
    resolveUnifiedExpenseDateInput: value => value === 'invalid' ? '' : value,
    normalizeUnifiedOutflowSpendDateInput: value => value === 'invalid' ? '' : value,
    normalizeUnifiedOutflowItem: item => ({ ...item, id: item.id || 'new' }),
    shouldAutoPayUnifiedOutflow: item => ['pix', 'debito', 'dinheiro'].includes(item.outputMethod),
    getOwnerDisplayName: sharedContext.getOwnerDisplayName,
    collectShared: amount => commands.collectShared(amount, draft.sharedInput || { enabled: false }, sharedContext),
    getRecurringChangedFields: () => [], getUnifiedOutflowTags: () => [],
    recordHistoryState: () => events.push('history'), markUnifiedOutflowSelectionVisibleFromMonth() {},
    clearRecurringSeriesStopFromMonth() {}, updateContinuousCalendarRule: () => events.push('rule'),
    canPropagateRecurringFromMonth: () => true, isContinuousCalendarEnabled: () => true,
    syncUnifiedCardBillForecastAmounts() {}, syncUnifiedOutflowLegacyData() {},
    save: () => { events.push('save'); return Promise.resolve(confirmed); },
    alert: message => events.push(message), onChanged: () => events.push('changed'),
    onSaved: () => events.push('saved'), onPending: () => events.push('pending')
  };
}

function baseDraft() {
  return { description: 'Test', requestedType: 'launch', category: 'CASA', tag: 'F\u00e9rias',
    amount: 100, outputValue: 'method:debito', rawDateValue: '23/10/26',
    recurringToggleChecked: false, planningToggleChecked: false, isInstallment: false, installmentsCount: 2 };
}

const predicates = {
  isUnifiedInstallmentLaunch: item => item.installmentsTotal > 1,
  isUnifiedRecurringLaunch: item => item.expenseRecurring === true,
  isUnifiedSharedLaunch: item => item.sharedExpense === true
};

function stable(value) {
  return JSON.parse(JSON.stringify(value, (key, entry) =>
    typeof entry === 'string' && /^(rec_|inst_|sp_)/.test(entry) ? entry.split('_')[0] : entry));
}

for (const mode of ['launch', 'recurring', 'installment', 'shared']) {
  for (const output of ['method:debito', 'method:pix', 'method:boleto', 'card:c']) {
    test(`3C Desktop and Mobile command results agree: ${mode}, ${output}`, async () => {
      const desktop = { ...baseDraft(), outputValue: output,
        recurringToggleChecked: mode === 'recurring', planningToggleChecked: mode === 'recurring',
        isInstallment: mode === 'installment',
        sharedInput: { enabled: mode === 'shared', peopleCount: 2, mode: 'equal',
          participants: [{ name: 'Owner' }, { name: 'Guest' }] } };
      const left = environment(desktop);
      const mobile = commands.fromMobile(mode, {
        description: desktop.description, category: desktop.category, tag: desktop.tag, amount: desktop.amount,
        output, date: desktop.rawDateValue, planning: false, installmentsCount: 2,
        sharedPeopleCount: 2, sharedMode: 'equal', sharedParticipants: desktop.sharedInput.participants
      }, left.month, predicates);
      const right = environment(mobile);
      assert.equal((await commands.saveDraft(desktop, left)).status, 'saved');
      assert.equal((await commands.saveDraft(mobile, right)).status, 'saved');
      assert.deepEqual(stable(left.month.outflows), stable(right.month.outflows));
      assert.deepEqual(left.events, right.events);
      assert.equal(left.month.outflows[0].amount, mode === 'shared' ? 50 : 100);
      assert.equal(left.month.outflows[0].installmentsTotal, mode === 'installment' ? 2 : 1);
      assert.equal(left.month.outflows[0].expenseRecurring, mode === 'recurring');
    });
  }
}

test('3C invalid description, amount or date cannot create, save or record undo history', () => {
  for (const change of [{ description: '' }, { amount: 0 }, { amount: -1 },
    { rawDateValue: 'invalid' }, { rawDateValue: 'invalid', recurringToggleChecked: true }]) {
    const draft = { ...baseDraft(), ...change };
    const ctx = environment(draft);
    assert.equal(commands.saveDraft(draft, ctx).status, 'invalid');
    assert.equal(ctx.month.outflows.length, 0);
    assert.equal(ctx.events.includes('history'), false);
    assert.equal(ctx.events.includes('save'), false);
    assert.equal(ctx.events.length, 1);
  }
});

test('3C shared manual validation and one-person handling keep prior rules', () => {
  const input = { enabled: true, peopleCount: 2, mode: 'manual',
    participants: [{ name: 'Owner', amount: 30 }, { name: 'Guest', amount: 70 }] };
  const before = JSON.stringify(input);
  const split = commands.collectShared(100, input, sharedContext);
  assert.equal(split.ownerShare, 30);
  assert.equal(split.othersShare, 70);
  assert.equal(JSON.stringify(input), before);
  assert.throws(() => commands.collectShared(120, input, sharedContext), /precisa somar/);
  const single = commands.collectShared(100, { ...input, peopleCount: 1 }, sharedContext);
  assert.equal(single.ownerShare, 0);
  assert.equal(single.othersShare, 100);
});

test('3C pending persistence never announces a confirmed save', async () => {
  const draft = baseDraft();
  const ctx = environment(draft, false);
  assert.equal((await commands.saveDraft(draft, ctx)).status, 'pending');
  assert.deepEqual(ctx.events, ['history', 'save', 'changed', 'pending']);
});

test('3C processor has no DOM dependencies or private storage', () => {
  const source = fs.readFileSync(require.resolve('../public/app/modules/mes-atual/outflow-commands'), 'utf8');
  assert.doesNotMatch(source, /document\.|getElementById|querySelector|localStorage|sessionStorage/);
});
