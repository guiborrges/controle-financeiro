const fs = require('fs');
const path = require('path');
const { writeJsonFileAtomic } = require('../server/fs-atomic');

const { ROOT_DIR } = require('../server/paths');
const { readUsersStore } = require('../server/user-store');
const {
  getUserDataPath,
  USER_DATA_DIR,
  DELETED_USER_BACKUP_DIR,
  ORPHAN_USER_ARCHIVE_DIR
} = require('../server/app-state-store');
const { USER_BACKUP_ROOT } = require('../server/backup-store');

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function listFilesRecursively(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  const out = [];
  const walk = dir => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    });
  };
  walk(baseDir);
  return out;
}

function collectServerSources() {
  const targets = [
    path.join(ROOT_DIR, 'server.js'),
    path.join(ROOT_DIR, 'server')
  ];
  const files = new Set();
  targets.forEach(target => {
    if (!fs.existsSync(target)) return;
    const stat = fs.statSync(target);
    if (stat.isFile() && target.endsWith('.js')) {
      files.add(target);
      return;
    }
    listFilesRecursively(target)
      .filter(file => file.endsWith('.js'))
      .forEach(file => files.add(file));
  });
  return Array.from(files);
}

function hasRouteInServerSources(route) {
  const sources = collectServerSources();
  return sources.some(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      return content.includes(route);
    } catch {
      return false;
    }
  });
}

function main() {
  const users = readUsersStore().users || [];
  const activeIds = new Set(users.map(user => String(user.id || '').trim()).filter(Boolean));

  const findings = [];
  const stats = {
    users: users.length,
    activeStateFiles: 0,
    activeStateMismatches: 0,
    missingSchemaVersionDetected: 0,
    missingSchemaVersionPending: 0,
    missingSchemaVersionAutoFixed: 0,
    duplicateMonths: 0,
    orphanStateArtifacts: 0,
    backupIndexes: 0,
    deletedUserArchives: 0
  };

  users.forEach(user => {
    const statePath = getUserDataPath(user.id);
    if (!fs.existsSync(statePath)) {
      findings.push(`[missing-state] ${user.id} sem state.json em ${statePath}`);
      return;
    }
    stats.activeStateFiles += 1;
    const parsed = safeReadJson(statePath);
    if (!parsed || typeof parsed !== 'object') {
      stats.activeStateMismatches += 1;
      findings.push(`[invalid-json] ${user.id} state.json inválido.`);
      return;
    }
    if (parsed.userId && parsed.userId !== user.id) {
      stats.activeStateMismatches += 1;
      findings.push(`[userid-mismatch] ${user.id} aponta para userId=${parsed.userId}.`);
    }
    const state = parsed?.state && typeof parsed.state === 'object' ? parsed.state : null;
    const schemaVersion = String(parsed?.schemaVersion || state?.finStateSchemaVersion || '').trim();
    if (!schemaVersion) {
      stats.missingSchemaVersionDetected += 1;
      const recoveredSchema = String(state?.finStateSchemaVersion || '3').trim() || '3';
      try {
        const nextPayload = { ...parsed, schemaVersion: recoveredSchema };
        writeJsonFileAtomic(statePath, nextPayload);
        stats.missingSchemaVersionAutoFixed += 1;
        findings.push(`[schema-fixed] ${user.id} schemaVersion ausente foi ajustado para ${recoveredSchema}.`);
      } catch {
        stats.missingSchemaVersionPending += 1;
        findings.push(`[schema-missing] ${user.id} sem schemaVersion no estado salvo.`);
      }
    }
    const finData = Array.isArray(state?.finData) ? state.finData : [];
    const seenMonthIds = new Set();
    finData.forEach(month => {
      const monthId = String(month?.id || '').trim();
      if (!monthId) return;
      if (seenMonthIds.has(monthId)) {
        stats.duplicateMonths += 1;
        findings.push(`[duplicate-month] ${user.id} possui mês duplicado: ${monthId}`);
      } else {
        seenMonthIds.add(monthId);
      }
    });
  });

  const userStateCandidates = listFilesRecursively(USER_DATA_DIR).filter(file => file.endsWith('.json'));
  userStateCandidates.forEach(file => {
    const fileName = path.basename(file);
    if (fileName === '.gitkeep') return;
    if (fileName.includes('.backup-')) return;
    const parsed = safeReadJson(file);
    const ownerId = String(parsed?.userId || '').trim();
    if (!ownerId || !activeIds.has(ownerId)) {
      stats.orphanStateArtifacts += 1;
    }
  });

  const backupIndexes = listFilesRecursively(USER_BACKUP_ROOT).filter(file => path.basename(file) === 'index.json');
  stats.backupIndexes = backupIndexes.length;
  const deletedArchives = listFilesRecursively(DELETED_USER_BACKUP_DIR).filter(file => path.basename(file) === 'meta.json');
  stats.deletedUserArchives = deletedArchives.length;

  const protectedMutatingRoutes = [
    '/api/app-state',
    '/api/backups/manual',
    '/api/profile/change-password',
    '/api/profile/delete-account',
    '/api/developer/users/:userId/backups/:backupId/restore'
  ];
  protectedMutatingRoutes.forEach(route => {
    if (!hasRouteInServerSources(route)) {
      findings.push(`[route-missing] Rota não localizada no servidor: ${route}`);
    }
  });

  const report = {
    generatedAt: new Date().toISOString(),
    stats,
    findings
  };

  const outputPath = path.join(ORPHAN_USER_ARCHIVE_DIR, 'latest-audit-report.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('[system-audit] resumo:', JSON.stringify(stats));
  if (findings.length) {
    console.log('[system-audit] findings:');
    findings.forEach(item => console.log(` - ${item}`));
  } else {
    console.log('[system-audit] nenhuma inconsistência crítica encontrada nas verificações automáticas.');
  }
  console.log(`[system-audit] relatório salvo em ${outputPath}`);
}

main();
