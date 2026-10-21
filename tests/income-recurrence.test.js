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
