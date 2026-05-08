const fs = require('fs');
const path = require('path');
const { resolveStoragePath } = require('./paths');
const { writeJsonFileAtomic } = require('./fs-atomic');

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
  const month = finData.find(item => String(item?.id || '').trim() === currentMonthId) || fallbackMonth || {};

  const outflows = Array.isArray(month?.outflows) ? month.outflows : [];
  const cardBills = Array.isArray(month?.cardBills) ? month.cardBills : [];
  const renda = Array.isArray(month?.renda) ? month.renda : [];
  const projetos = Array.isArray(month?.projetos) ? month.projetos : [];

  const nonCardOutflows = outflows
    .filter(item => item && item.countsInPrimaryTotals !== false)
    .filter(item => {
      const type = String(item?.type || '').toLowerCase();
      const outputKind = String(item?.outputKind || '').toLowerCase();
      return type === 'expense' || (type === 'spend' && outputKind !== 'card');
    })
    .reduce((sum, item) => sum + safeNumber(item?.amount), 0);

  const totalCardBills = cardBills.reduce((sum, bill) => sum + safeNumber(bill?.amount), 0);
  const monthlyExpenses = round2(nonCardOutflows + totalCardBills);

  const rendaTotal = renda
    .filter(item => item && (item.paid === true || item.includeInTotals !== false))
    .reduce((sum, item) => sum + safeNumber(item?.valor), 0);

  const projetosTotal = projetos
    .filter(item => item && (item.paid === true || item.includeInTotals !== false))
    .reduce((sum, item) => sum + safeNumber(item?.valor), 0);

  const monthlyIncome = round2(rendaTotal + projetosTotal);
  const result = round2(monthlyIncome - monthlyExpenses);

  const dailyGoals = month?.dailyGoals && typeof month.dailyGoals === 'object' ? month.dailyGoals : {};
  const categoryEmojis = state?.finCategoryEmojis && typeof state.finCategoryEmojis === 'object'
    ? state.finCategoryEmojis
    : {};

  const goals = Object.entries(dailyGoals)
    .map(([category, rawGoal]) => {
      const goal = safeNumber(rawGoal);
      if (!(goal > 0)) return null;
      const spent = outflows
        .filter(item => item && item.countsInPrimaryTotals !== false && String(item?.category || '') === String(category))
        .reduce((sum, item) => sum + safeNumber(item?.amount), 0);
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

