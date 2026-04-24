const test = require('node:test');
const assert = require('node:assert/strict');

function loadDates() {
  delete require.cache[require.resolve('../public/app/modules/shared/dates.js')];
  global.getMonthDateFromMonthObject = (month) => {
    const [name, year] = String(month?.nome || 'JANEIRO 2026').split(' ');
    const map = {
      JANEIRO: 0, FEVEREIRO: 1, MARCO: 2, 'MARÇO': 2, 'MARÃ‡O': 2, ABRIL: 3, MAIO: 4, JUNHO: 5,
      JULHO: 6, AGOSTO: 7, SETEMBRO: 8, OUTUBRO: 9, NOVEMBRO: 10, DEZEMBRO: 11
    };
    return new Date(Number(year || 2026), map[name] ?? 0, 1);
  };
  return require('../public/app/modules/shared/dates.js');
}

test('helper central resolve dia simples para o mes seguinte', () => {
  const dates = loadDates();
  const result = dates.resolveDateFromInput('10', { nome: 'ABRIL 2026' });
  assert.equal(result.date, '10/05/26');
  assert.equal(result.mode, 'simple-day');
  assert.equal(result.hasExplicitMonthYear, false);
});

test('helper central respeita data completa no mes atual', () => {
  const dates = loadDates();
  const result = dates.resolveDateFromInput('10/04/2026', { nome: 'ABRIL 2026' });
  assert.equal(result.date, '10/04/26');
  assert.equal(result.mode, 'full-date');
  assert.equal(result.hasExplicitMonthYear, true);
});

test('helper central respeita data completa em outro mes', () => {
  const dates = loadDates();
  const result = dates.resolveDateFromInput('10/06/2026', { nome: 'ABRIL 2026' });
  assert.equal(result.date, '10/06/26');
  assert.equal(result.mode, 'full-date');
});

test('mascara central permite dia simples e data completa progressiva', () => {
  const dates = loadDates();
  assert.equal(dates.formatDateInputProgressive('10'), '10');
  assert.equal(dates.formatDateInputProgressive('1004'), '10/04');
  assert.equal(dates.formatDateInputProgressive('10042026'), '10/04/2026');
});
