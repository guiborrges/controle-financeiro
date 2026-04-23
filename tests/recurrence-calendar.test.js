const test = require('node:test');
const assert = require('node:assert/strict');

global.normalizeVarDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parts = raw.split(/[\/-]/).map(part => part.trim());
  if (parts.length !== 3) return '';
  const [dd, mm, yy] = parts;
  const day = String(Number(dd || 0)).padStart(2, '0');
  const month = String(Number(mm || 0)).padStart(2, '0');
  const year = String(yy || '').slice(-2).padStart(2, '0');
  if (day === '00' || month === '00') return '';
  return `${day}/${month}/${year}`;
};

global.getMonthDateFromMonthObject = (month) => {
  const id = String(month?.id || '');
  const [year, monthNum] = id.split('-').map(Number);
  if (year && monthNum) return new Date(year, monthNum - 1, 1);
  return new Date(2026, 3, 1);
};

global.getRecurringIncomeReceiveDay = (value) => {
  const day = Math.max(1, Math.min(31, Number(String(value || '').replace(/\D/g, '')) || 0));
  return day ? String(day).padStart(2, '0') : '';
};

const CalendarUtils = require('../public/app/modules/calendar-utils.js');

test('expense outflow with explicit month/year only appears in its real due month', () => {
  const item = { type: 'expense', outputKind: 'method', date: '10/05/26' };
  const april = { id: '2026-04', nome: 'ABRIL 2026' };
  const may = { id: '2026-05', nome: 'MAIO 2026' };
  assert.equal(CalendarUtils.getMonthDayFromOutflow(item, april), 0);
  assert.equal(CalendarUtils.getMonthDayFromOutflow(item, may), 10);
});

test('recurring fixed income is projected to the next month by day', () => {
  const sourceMonth = { id: '2026-04', nome: 'ABRIL 2026' };
  const targetMonth = { id: '2026-05', nome: 'MAIO 2026' };
  const item = { recurringFixed: true, dataRecebimento: '06' };
  assert.equal(CalendarUtils.getMonthDayFromIncome(item, targetMonth, sourceMonth), 6);
});
