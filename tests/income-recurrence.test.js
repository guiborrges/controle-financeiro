const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadIncomeRecurrence() {
  const filePath = path.join(__dirname, '..', 'public', 'app', 'modules', 'mes-atual', 'income-recurrence.js');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
  return context.window.MesAtualIncomeRecurrence;
}

test('recurring income finds the prior name during a rename and keeps the series id', () => {
  const recurrence = loadIncomeRecurrence();
  const future = [{ fonte: 'Salário ACME', valor: 1000, recurringGroupId: 'rin_salario_acme' }];
  const target = recurrence.getTargetIncome(future, 'rin_salario_acme', 'Salário ACME', 'Salário Novo', {
    getGroupId: item => item.recurringGroupId,
    normalizeName: value => String(value).toUpperCase()
  });
  assert.equal(target, future[0]);
});

test('recurring income changes never overwrite a future income already received', () => {
  const recurrence = loadIncomeRecurrence();
  const target = { fonte: 'Salário', valor: 1000, paid: true, dataRecebimento: '05' };
  assert.equal(recurrence.applyRecurringIncomeChanges(target, {
    fonte: 'Salário Novo', valor: 1200, dataRecebimento: '10'
  }, ['fonte', 'valor', 'dataRecebimento']), false);
  assert.deepEqual(target, { fonte: 'Salário', valor: 1000, paid: true, dataRecebimento: '05' });
});

test('recurring income clones reset payment and retain recurrence metadata', () => {
  const recurrence = loadIncomeRecurrence();
  assert.deepEqual({ ...recurrence.cloneRecurringIncome({
    fonte: 'Freela fixo', valor: 2500, paid: true, dataRecebimento: '15', recurringFixed: true
  }, 'rin_freela') }, {
    fonte: 'Freela fixo', valor: 2500, paid: false, includeInTotals: true,
    patrimonioMovementId: '', dataRecebimento: '15', recurringFixed: true, recurringGroupId: 'rin_freela'
  });
});

test('repair fills existing current and future months once without changing history or received entries', () => {
  const recurrence = loadIncomeRecurrence();
  const received = { fonte: 'Salario', valor: 1500, paid: true };
  const months = [
    { sort: 1, renda: [{ fonte: 'Salario', valor: 1000, recurringFixed: true, paid: true }, { fonte: 'Bonus', valor: 200, recurringFixed: false }] },
    { sort: 2, renda: [], _incomeContinuityVersion: 1 },
    { sort: 3, renda: [received] },
    { sort: 4, renda: [] }
  ];
  const options = { getMonthSortValue: month => month.sort, startSort: 2, getGroupId: item => item.recurringGroupId || item.fonte };
  assert.equal(recurrence.repairExistingMonths(months, options), true);
  assert.equal(months[0].renda.length, 2);
  assert.equal(months[1].renda.length, 1);
  assert.equal(months[1].renda[0].paid, false);
  assert.equal(months[1]._incomeContinuityVersion, 2);
  assert.equal(months[2].renda[0], received);
  assert.equal(months[3].renda[0].valor, 1500);
  assert.equal(months[3].renda[0].paid, false);
  months[1].renda = [];
  assert.equal(recurrence.repairExistingMonths(months, options), false);
  assert.equal(months[1].renda.length, 0);
});

test('invalid start month cannot mark income repair complete', () => {
  const recurrence = loadIncomeRecurrence();
  const months = [{ sort: 1, renda: [] }];
  assert.throws(() => recurrence.repairExistingMonths(months, {
    startSort: NaN, getMonthSortValue: month => month.sort
  }), /Mes inicial invalido/);
  assert.equal(months[0]._incomeContinuityVersion, undefined);
});
