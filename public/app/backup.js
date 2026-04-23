// ============================================================
// EXPORT / IMPORT
// ============================================================
function getBackupSessionUserId() {
  return String(currentSession?.id || window.__APP_BOOTSTRAP__?.session?.id || '').trim();
}

function buildBackupStateSnapshotFromRuntime() {
  return {
    [STORAGE_KEYS.data]: data,
    [STORAGE_KEYS.patrimonioAccounts]: patrimonioAccounts,
    [STORAGE_KEYS.patrimonioMovements]: patrimonioMovements,
    [STORAGE_KEYS.metas]: metas,
    [STORAGE_KEYS.esoData]: esoData,
    [STORAGE_KEYS.categoryRenameMap]: categoryRenameMap || {},
    [STORAGE_KEYS.expenseCategoryRules]: expenseCategoryRules || {},
    [STORAGE_KEYS.expenseNameRenameMap]: expenseNameRenameMap || {},
    [STORAGE_KEYS.expensePaymentDateRules]: expensePaymentDateRules || {},
    [STORAGE_KEYS.incomeNameRenameMap]: incomeNameRenameMap || {},
    [STORAGE_KEYS.schemaVersion]: STATE_SCHEMA_VERSION,
    [STORAGE_KEYS.migrationVersion]: DATA_MIGRATION_VERSION,
    compatibilityPreferences: typeof captureCompatibilityPreferences === 'function'
      ? captureCompatibilityPreferences({ includeTransientState: false })
      : null
  };
}

function normalizeImportedBackupPayload(rawParsed) {
  const parsed = rawParsed && typeof rawParsed === 'object' ? rawParsed : null;
  if (!parsed) throw new Error('Arquivo de backup invalido.');

  const sessionUserId = getBackupSessionUserId();
  const ownerId = String(parsed.userId || parsed.ownerId || '').trim();
  if (ownerId && sessionUserId && ownerId !== sessionUserId) {
    throw new Error('Este backup pertence a outro usuario.');
  }

  if (parsed.format === 'fin_backup_v2') {
    if (!parsed.appState || typeof parsed.appState !== 'object' || Array.isArray(parsed.appState)) {
      throw new Error('Backup v2 sem appState valido.');
    }
    return parsed.appState;
  }

  if (parsed.data || Array.isArray(parsed)) {
    const legacyData = Array.isArray(parsed) ? parsed : parsed.data;
    if (!Array.isArray(legacyData)) throw new Error('Formato de backup legado invalido.');
    return {
      [STORAGE_KEYS.data]: legacyData,
      [STORAGE_KEYS.patrimonioAccounts]: Array.isArray(parsed.patrimonioAccounts) ? parsed.patrimonioAccounts : [],
      [STORAGE_KEYS.patrimonioMovements]: Array.isArray(parsed.patrimonioMovements) ? parsed.patrimonioMovements : [],
      [STORAGE_KEYS.metas]: parsed.metas && typeof parsed.metas === 'object' ? parsed.metas : {},
      [STORAGE_KEYS.esoData]: Array.isArray(parsed.esoData) ? parsed.esoData : [],
      [STORAGE_KEYS.categoryRenameMap]: parsed.categoryRenameMap && typeof parsed.categoryRenameMap === 'object' ? parsed.categoryRenameMap : {},
      [STORAGE_KEYS.expenseCategoryRules]: parsed.expenseCategoryRules && typeof parsed.expenseCategoryRules === 'object' ? parsed.expenseCategoryRules : {},
      [STORAGE_KEYS.expenseNameRenameMap]: parsed.expenseNameRenameMap && typeof parsed.expenseNameRenameMap === 'object' ? parsed.expenseNameRenameMap : {},
      [STORAGE_KEYS.expensePaymentDateRules]: parsed.expensePaymentDateRules && typeof parsed.expensePaymentDateRules === 'object' ? parsed.expensePaymentDateRules : {},
      [STORAGE_KEYS.incomeNameRenameMap]: parsed.incomeNameRenameMap && typeof parsed.incomeNameRenameMap === 'object' ? parsed.incomeNameRenameMap : {},
      [STORAGE_KEYS.schemaVersion]: parsed.finStateSchemaVersion || STATE_SCHEMA_VERSION,
      [STORAGE_KEYS.migrationVersion]: parsed.finDataMigrationVersion || DATA_MIGRATION_VERSION,
      compatibilityPreferences: parsed.compatibilityPreferences && typeof parsed.compatibilityPreferences === 'object'
        ? parsed.compatibilityPreferences
        : null
    };
  }

  throw new Error('Formato de backup nao reconhecido.');
}

function validateImportedBackupState(appState) {
  if (!appState || typeof appState !== 'object' || Array.isArray(appState)) {
    throw new Error('appState de backup invalido.');
  }
  const months = appState[STORAGE_KEYS.data];
  if (!Array.isArray(months)) {
    throw new Error('Backup sem finData valida.');
  }
  const invalidMonth = months.find(month => !month || typeof month !== 'object' || Array.isArray(month));
  if (invalidMonth) {
    throw new Error('Backup com mes invalido em finData.');
  }
  const invalidMonthId = months.find(month => String(month?.id || '').trim() === '');
  if (invalidMonthId) {
    throw new Error('Backup com mes sem identificador.');
  }
  if (appState[STORAGE_KEYS.patrimonioAccounts] != null && !Array.isArray(appState[STORAGE_KEYS.patrimonioAccounts])) {
    throw new Error('Backup com contas patrimoniais invalidas.');
  }
  if (appState[STORAGE_KEYS.patrimonioMovements] != null && !Array.isArray(appState[STORAGE_KEYS.patrimonioMovements])) {
    throw new Error('Backup com movimentacoes patrimoniais invalidas.');
  }
  if (appState[STORAGE_KEYS.metas] != null && (typeof appState[STORAGE_KEYS.metas] !== 'object' || Array.isArray(appState[STORAGE_KEYS.metas]))) {
    throw new Error('Backup com metas invalidas.');
  }
}

function applyImportedBackupState(appState) {
  const allowBundledData = canUseBundledFinanceData();
  const importedData = Array.isArray(appState[STORAGE_KEYS.data]) ? appState[STORAGE_KEYS.data] : [];
  data = importedData.length ? importedData : [buildBlankMonth()];
  patrimonioAccounts = Array.isArray(appState[STORAGE_KEYS.patrimonioAccounts]) ? appState[STORAGE_KEYS.patrimonioAccounts] : [];
  patrimonioMovements = Array.isArray(appState[STORAGE_KEYS.patrimonioMovements]) ? appState[STORAGE_KEYS.patrimonioMovements] : [];
  metas = appState[STORAGE_KEYS.metas] && typeof appState[STORAGE_KEYS.metas] === 'object' ? appState[STORAGE_KEYS.metas] : {};
  esoData = (Array.isArray(appState[STORAGE_KEYS.esoData]) ? appState[STORAGE_KEYS.esoData] : (allowBundledData ? getDefaultEsoData() : []))
    .map((entry, idx) => normalizeEsoEntry(entry, idx));
  categoryRenameMap = appState[STORAGE_KEYS.categoryRenameMap] && typeof appState[STORAGE_KEYS.categoryRenameMap] === 'object'
    ? appState[STORAGE_KEYS.categoryRenameMap]
    : {};
  expenseCategoryRules = appState[STORAGE_KEYS.expenseCategoryRules] && typeof appState[STORAGE_KEYS.expenseCategoryRules] === 'object'
    ? appState[STORAGE_KEYS.expenseCategoryRules]
    : {};
  expenseNameRenameMap = appState[STORAGE_KEYS.expenseNameRenameMap] && typeof appState[STORAGE_KEYS.expenseNameRenameMap] === 'object'
    ? appState[STORAGE_KEYS.expenseNameRenameMap]
    : {};
  expensePaymentDateRules = appState[STORAGE_KEYS.expensePaymentDateRules] && typeof appState[STORAGE_KEYS.expensePaymentDateRules] === 'object'
    ? appState[STORAGE_KEYS.expensePaymentDateRules]
    : {};
  incomeNameRenameMap = appState[STORAGE_KEYS.incomeNameRenameMap] && typeof appState[STORAGE_KEYS.incomeNameRenameMap] === 'object'
    ? appState[STORAGE_KEYS.incomeNameRenameMap]
    : {};

  sortDataChronologically();
  data.forEach(m => {
    normalizeMonth(m);
    recalcTotals(m);
  });
  if (typeof ensurePatrimonioData === 'function') ensurePatrimonioData();
  currentMonthId = data[data.length - 1]?.id || getDefaultMonthId();
  periodFilter = sanitizePeriodFilter({
    ...periodFilter,
    month: currentMonthId,
    start: currentMonthId,
    end: currentMonthId
  });
  if (typeof applyCompatibilityPreferences === 'function') {
    applyCompatibilityPreferences(appState.compatibilityPreferences || null);
  }
}

function persistImportedBackupState(appState) {
  save();
  saveMetas();
  saveEsoData();
  saveCategoryRenameMap();
  saveExpenseCategoryRules();
  saveExpenseNameRenameMap();
  saveExpensePaymentDateRules();
  saveIncomeNameRenameMap();
  Storage.setText(STORAGE_KEYS.schemaVersion, String(appState[STORAGE_KEYS.schemaVersion] || STATE_SCHEMA_VERSION));
  Storage.setText(STORAGE_KEYS.migrationVersion, String(appState[STORAGE_KEYS.migrationVersion] || DATA_MIGRATION_VERSION));
  saveUIState();
}

function saveEmergencyBackup(reason = 'manual') {
  const snapshot = {
    savedAt: new Date().toISOString(),
    reason,
    format: 'fin_backup_v2',
    userId: getBackupSessionUserId(),
    appState: buildBackupStateSnapshotFromRuntime()
  };
  // Scoped by authenticated user namespace to avoid cross-user residue in shared browsers.
  ScopedLocalStorage.setJSON('finEmergencyBackup', snapshot);
}

function exportData() {
  const payload = {
    format: 'fin_backup_v2',
    exportedAt: new Date().toISOString(),
    userId: getBackupSessionUserId(),
    appState: buildBackupStateSnapshotFromRuntime()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'controle_financeiro_backup.json';
  a.click();
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const snapshotBeforeImport = typeof createHistorySnapshot === 'function' ? createHistorySnapshot() : '';
      saveEmergencyBackup('before-import');
      const parsed = JSON.parse(ev.target.result);
      const importedAppState = normalizeImportedBackupPayload(parsed);
      validateImportedBackupState(importedAppState);

      applyImportedBackupState(importedAppState);
      undoStack = [];
      redoStack = [];
      persistImportedBackupState(importedAppState);
      if (typeof flushServerStorage === 'function') {
        await flushServerStorage(true);
      }
      if (typeof registerBackupRestoreUndoSnapshot === 'function' && snapshotBeforeImport) {
        registerBackupRestoreUndoSnapshot(snapshotBeforeImport);
      }

      buildMonthSelect();
      renderAll();
      updateHistoryButtons();
      showAppStatus(
        'Importacao concluida. Se voce se arrepender, use Ctrl+Z antes de fazer outra alteracao.',
        'Importacao concluida',
        'ok'
      );
      alert('Dados importados com sucesso!');
    } catch (error) {
      showAppStatus(
        'A importacao falhou. O ultimo estado anterior ficou salvo localmente como backup de emergencia.',
        'Importacao falhou',
        'error'
      );
      alert(`Erro ao importar: ${error?.message || 'arquivo invalido.'}`);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function renderAll() {
  renderDashboard();
  const active = document.querySelector('.page.active')?.id;
  if (active === 'page-mes') renderMes();
  if (active === 'page-patrimonio') renderPatrimonio();
  if (active === 'page-historico') renderHistorico();
  if (active === 'page-eso') renderEso();
  saveUIState();
}
