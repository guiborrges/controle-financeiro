const test = require('node:test');
const assert = require('node:assert/strict');

const IncomeDateRules = require('../public/app/modules/mes-atual/income-dates.js');

global.normalizeVarDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 8) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(6, 8)}`;
  return '';
};
global.getMonthDateFromMonthObject = (month) => {
  const [name, year] = String(month?.nome || 'JANEIRO 2026').split(' ');
  const map = {
    JANEIRO: 0, FEVEREIRO: 1, MARÇO: 2, ABRIL: 3, MAIO: 4, JUNHO: 5,
    JULHO: 6, AGOSTO: 7, SETEMBRO: 8, OUTUBRO: 9, NOVEMBRO: 10, DEZEMBRO: 11
  };
  return new Date(Number(year || 2026), map[name] ?? 0, 1);
};
global.parseData = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized || !/^\d{2}\/\d{2}\/\d{2}$/.test(normalized)) return 0;
  const [dd, mm, yy] = normalized.split('/').map(Number);
  return new Date(2000 + yy, mm - 1, dd).getTime();
};

test('recurring income receive day keeps only day and clamps range', () => {
  assert.equal(IncomeDateRules.getRecurringIncomeReceiveDay('5'), '05');
  assert.equal(IncomeDateRules.getRecurringIncomeReceiveDay('40'), '31');
  assert.equal(IncomeDateRules.getRecurringIncomeReceiveDay(''), '');
});

test('recurring label derives month/year from next month context by default', () => {
  const label = IncomeDateRules.getIncomeReceiveDateLabel(
    { recurringFixed: true, dataRecebimento: '10' },
    { nome: 'ABRIL 2026' }
  );
  assert.equal(label, '10/05/26');
});

test('recurring income keeps explicit month/year when manually informed', () => {
  const label = IncomeDateRules.getIncomeReceiveDateLabel(
    { recurringFixed: true, dataRecebimento: '10/07/26' },
    { nome: 'ABRIL 2026' }
  );
  assert.equal(label, '10/07/26');
});

test('income manual edit with simple day resolves to next month', () => {
  const date = IncomeDateRules.normalizeIncomeReceiveDate('10', { nome: 'ABRIL 2026' }, true);
  assert.equal(date, '10/05/26');
});

test('income manual edit with full date keeps explicit month', () => {
  const date = IncomeDateRules.normalizeIncomeReceiveDate('10/04/26', { nome: 'ABRIL 2026' }, true);
  assert.equal(date, '10/04/26');
});

test('non recurring income keeps full date semantics', () => {
  const label = IncomeDateRules.getIncomeReceiveDateLabel(
    { recurringFixed: false, dataRecebimento: '02/03/26' },
    { nome: 'ABRIL 2026' }
  );
  assert.equal(label, '02/03/26');
});
