const fs = require('fs');
const path = require('path');

const SERVER_MONTH_INDEX = {
  JANEIRO: 0,
  FEVEREIRO: 1,
  MARCO: 2,
  'MARÇO': 2,
  ABRIL: 3,
  MAIO: 4,
  JUNHO: 5,
  JULHO: 6,
  AGOSTO: 7,
  SETEMBRO: 8,
  OUTUBRO: 9,
  NOVEMBRO: 10,
  DEZEMBRO: 11
};

function normalizeServerMonthToken(value) {
  const raw = String(value || '').trim().toUpperCase();
  const normalized = raw
    .replace(/MARÃ‡O/g, 'MARÇO')
    .replace(/MARÃ§O/g, 'MARÇO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (normalized === 'MARCO') return 'MARÇO';
  if (SERVER_MONTH_INDEX[normalized] !== undefined) {
    return normalized === 'MARCO' ? 'MARÇO' : normalized;
  }
  return '';
}

function buildServerMonthId(monthName, year) {
  return `${String(monthName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}_${year}`;
}

function normalizeServerMonthRecord(month) {
  if (!month || typeof month !== 'object') return null;
  const next = JSON.parse(JSON.stringify(month));
  const rawName = String(next.nome || '').trim();
  const nameParts = rawName.split(/\s+/);
  const monthName = normalizeServerMonthToken(nameParts[0] || '');
  const idMatch = String(next.id || '').match(/(19|20)\d{2}$/);
  const nameMatch = rawName.match(/(19|20)\d{2}/);
  const year = nameMatch?.[0] || idMatch?.[0] || '';
  if (!monthName || !year) return next;
  next.nome = `${monthName} ${year}`;
  next.id = buildServerMonthId(monthName, year);
  return next;
}

function sortServerMonthsChronologically(months) {
  return (Array.isArray(months) ? months : []).sort((a, b) => {
    const yearA = Number.parseInt(String(a?.nome || '').match(/(19|20)\d{2}/)?.[0] || '0', 10);
    const yearB = Number.parseInt(String(b?.nome || '').match(/(19|20)\d{2}/)?.[0] || '0', 10);
    const monthA = normalizeServerMonthToken(String(a?.nome || '').split(/\s+/)[0] || '');
    const monthB = normalizeServerMonthToken(String(b?.nome || '').split(/\s+/)[0] || '');
    return (yearA * 12 + (SERVER_MONTH_INDEX[monthA] ?? -1)) - (yearB * 12 + (SERVER_MONTH_INDEX[monthB] ?? -1));
  });
}

function getLegacyUserBackupFiles(userId, usersDataDir) {
  if (!fs.existsSync(usersDataDir)) return [];
  return fs.readdirSync(usersDataDir)
    .filter(name => name.startsWith(`${String(userId || '').trim()}.backup-`) && name.endsWith('.json'))
    .map(name => path.join(usersDataDir, name));
}

function recoverMissingMonthsFromLegacyBackups(userId, state, usersDataDir) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.finData)) {
    return { changed: false, state };
  }

  const nextState = JSON.parse(JSON.stringify(state));
  let changed = false;
  nextState.finData = nextState.finData.map(month => {
    const normalized = normalizeServerMonthRecord(month);
    if (JSON.stringify(normalized) !== JSON.stringify(month)) changed = true;
    return normalized;
  });

  const existingIds = new Set(nextState.finData.map(month => month?.id).filter(Boolean));
  const backupFiles = getLegacyUserBackupFiles(userId, usersDataDir)
    .map(file => ({ file, payload: JSON.parse(fs.readFileSync(file, 'utf8')) }))
    .filter(entry => Array.isArray(entry.payload?.state?.finData))
    .sort((a, b) => {
      const monthDiff = (b.payload?.state?.finData?.length || 0) - (a.payload?.state?.finData?.length || 0);
      if (monthDiff !== 0) return monthDiff;
      const timeA = Date.parse(a.payload?.updatedAt || '') || 0;
      const timeB = Date.parse(b.payload?.updatedAt || '') || 0;
      return timeB - timeA;
    });

  backupFiles.forEach(entry => {
    (entry.payload.state.finData || []).forEach(month => {
      const normalized = normalizeServerMonthRecord(month);
      if (!normalized?.id || existingIds.has(normalized.id)) return;
      nextState.finData.push(normalized);
      existingIds.add(normalized.id);
      changed = true;
    });
  });

  if (changed) {
    nextState.finData = sortServerMonthsChronologically(nextState.finData);
  }
  return { changed, state: nextState };
}

module.exports = {
  normalizeServerMonthToken,
  buildServerMonthId,
  normalizeServerMonthRecord,
  sortServerMonthsChronologically,
  recoverMissingMonthsFromLegacyBackups
};

