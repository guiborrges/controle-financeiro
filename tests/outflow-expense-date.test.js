const test = require('node:test');
const assert = require('node:assert/strict');

function loadModule() {
  delete require.cache[require.resolve('../public/app/modules/mes-atual/outflow-expense-date.js')];
  return require('../public/app/modules/mes-atual/outflow-expense-date.js');
}

function buildMonth(nome) {
  return { nome };
}

global.normalizeVarDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return '';
  const dd = String(Number(match[1])).padStart(2, '0');
  const mm = String(Number(match[2])).padStart(2, '0');
  const yyNum = Number(match[3]);
  const yy = String(match[3].length === 2 ? yyNum : yyNum % 100).padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
};

global.getMonthDateFromMonthObject = (month) => {
  const raw = String(month?.nome || '');
  const [name, year] = raw.split(' ');
  const map = {
    JANEIRO: 0, FEVEREIRO: 1, MARÇO: 2, ABRIL: 3, MAIO: 4, JUNHO: 5,
    JULHO: 6, AGOSTO: 7, SETEMBRO: 8, OUTUBRO: 9, NOVEMBRO: 10, DEZEMBRO: 11
  };
  return new Date(Number(year || 2026), map[name] ?? 0, 1);
};

test('despesa com dia simples cai no proximo mes', () => {
  const mod = loadModule();
  const date = mod.resolveExpenseDate('10', buildMonth('ABRIL 2026'));
  assert.equal(date, '10/05/26');
});

test('despesa com data completa respeita mes/ano informados', () => {
  const mod = loadModule();
  const date = mod.resolveExpenseDate('10/04/26', buildMonth('ABRIL 2026'));
  assert.equal(date, '10/04/26');
});

test('despesa com data completa em outro mes respeita mes/ano informados', () => {
  const mod = loadModule();
  const date = mod.resolveExpenseDate('10/06/2026', buildMonth('ABRIL 2026'));
  assert.equal(date, '10/06/26');
});

test('parcelamento/recorrencia continua a partir da primeira data informada', () => {
  const mod = loadModule();
  const nextMonth = new Date(2026, 4, 1); // maio/2026
  const clonedDate = mod.getExpenseDateForTargetMonth('10/05/26', buildMonth('ABRIL 2026'), nextMonth);
  assert.equal(clonedDate, '10/06/26');
});

test('formatacao de entrada da despesa aceita data completa progressiva', () => {
  const mod = loadModule();
  assert.equal(mod.formatExpenseDateInput('10'), '10');
  assert.equal(mod.formatExpenseDateInput('1005'), '10/05');
  assert.equal(mod.formatExpenseDateInput('100526'), '10/05/26');
});
