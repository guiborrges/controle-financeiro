const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getDashboardEligibleMonths,
  isMonthStartedForDashboard
} = require('../public/app/modules/shared/dashboard-rules.js');

test('dashboard ignores future months before real start date', () => {
  const months = [
    { nome: 'MARÇO 2026' },
    { nome: 'ABRIL 2026' },
    { nome: 'MAIO 2026' }
  ];
  const referenceDate = new Date('2026-04-17T12:00:00Z');
  const eligible = getDashboardEligibleMonths(months, referenceDate);
  assert.deepEqual(eligible.map(item => item.nome), ['MARÇO 2026', 'ABRIL 2026']);
});

test('dashboard includes month when it reaches day 1 of that month', () => {
  const month = { nome: 'MAIO 2026' };
  const referenceDate = new Date('2026-05-01T03:00:00Z');
  assert.equal(isMonthStartedForDashboard(month, referenceDate), true);
});

test('dashboard normalizes month name with accent and still resolves correctly', () => {
  const month = { nome: 'MARÇO 2026' };
  const referenceDate = new Date('2026-03-15T12:00:00Z');
  assert.equal(isMonthStartedForDashboard(month, referenceDate), true);
});

test('dashboard removes duplicated month entries by id/key', () => {
  const months = [
    { id: 'abril_2026', nome: 'ABRIL 2026' },
    { id: 'abril_2026', nome: 'ABRIL 2026' },
    { id: 'maio_2026', nome: 'MAIO 2026' }
  ];
  const referenceDate = new Date('2026-05-10T12:00:00Z');
  const eligible = getDashboardEligibleMonths(months, referenceDate);
  assert.equal(eligible.length, 2);
  assert.deepEqual(eligible.map(item => item.id), ['abril_2026', 'maio_2026']);
});
