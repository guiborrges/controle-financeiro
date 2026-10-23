const fs = require('fs');
const path = require('path');
const { resolveStoragePath } = require('./paths');
const { writeJsonFileAtomic } = require('./fs-atomic');
const { getProjectedCalendarMonth } = require('./calendar-projection');
const financial = require('../public/app/modules/shared/financial-query');

const WIDGET_SNAPSHOT_DIR = resolveStoragePath('data', 'widget-snapshots');

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function round2(value) {
  return Math.round((safeNumber(value) + Number.EPSILON) * 100) / 100;
}

function getCurrentMonthId(now = new Date()) {
  const month = MONTH_NAMES[now.getMonth()] || MONTH_NAMES[0];
  return `${month}_${now.getFullYear()}`;
}

function getCurrentMonthLabel(now = new Date()) {
  const monthLabel = MONTH_LABELS[now.getMonth()] || MONTH_LABELS[0];
  return `${monthLabel} ${now.getFullYear()}`;
}

function buildWidgetSnapshot(userId, state) {
  const finData = Array.isArray(state?.finData) ? state.finData : [];
  const now = new Date();
  const currentMonthId = getCurrentMonthId(now);
  const fallbackMonth = finData.length ? finData[finData.length - 1] : null;
  const month = getProjectedCalendarMonth(state, currentMonthId) || fallbackMonth || {};

  const resolveCategory = value => {
    let name = String(value || 'OUTROS');
    const aliases = state?.finCategoryRenameMap || {};
    const visited = new Set();
    while (aliases[name] && !visited.has(name)) { visited.add(name); name = aliases[name]; }
    return name;
  };
  const query = financial.query(month, { resolveCategory });
  const consumption = financial.query(month, { basis: 'consumption', resolveCategory });
  const monthlyExpenses = query.expenseCents / 100;
  const monthlyIncome = query.incomeCents / 100;
  const result = query.resultCents / 100;

  const dailyGoals = month?.dailyGoals && typeof month.dailyGoals === 'object' ? month.dailyGoals : {};
  const categoryEmojis = state?.finCategoryEmojis && typeof state.finCategoryEmojis === 'object'
    ? state.finCategoryEmojis
    : {};

  const goals = Object.entries(dailyGoals)
    .map(([category, rawGoal]) => {
      const goal = safeNumber(rawGoal);
      if (!(goal > 0)) return null;
      const spent = (consumption.categories.find(row => row.category === resolveCategory(category))?.amountCents || 0) / 100;
      const percentage = goal > 0 ? Math.round((spent / goal) * 100) : 0;
      return {
        category: String(category),
        icon: String(categoryEmojis[String(category)] || ''),
        spent: round2(spent),
        goal: round2(goal),
        percentage: Number.isFinite(percentage) ? percentage : 0
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.percentage - a.percentage);

  return {
    updatedAt: new Date().toISOString(),
    monthLabel: getCurrentMonthLabel(now),
    monthlyExpenses,
    monthlyIncome,
    result,
    reservedGoals: query.reserveCents / 100,
    basis: 'commitments',
    currency: 'BRL',
    goals
  };
}

function getWidgetSnapshotPath(userId) {
  return path.join(WIDGET_SNAPSHOT_DIR, `${String(userId || '').trim()}.json`);
}

function saveWidgetSnapshot(userId, snapshot) {
  fs.mkdirSync(WIDGET_SNAPSHOT_DIR, { recursive: true });
  const filePath = getWidgetSnapshotPath(userId);
  writeJsonFileAtomic(filePath, snapshot && typeof snapshot === 'object' ? snapshot : {});
  return filePath;
}

function readWidgetSnapshot(userId) {
  try {
    const filePath = getWidgetSnapshotPath(userId);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  WIDGET_SNAPSHOT_DIR,
  buildWidgetSnapshot,
  saveWidgetSnapshot,
  readWidgetSnapshot
};

