// ============================================================
// EXPORT / IMPORT
// ============================================================
function saveEmergencyBackup(reason = 'manual') {
  const snapshot = {
    savedAt: new Date().toISOString(),
    reason,
    data,
    metas,
    esoData
  };
  LegacyStorage.setJSON('finEmergencyBackup', snapshot);
}

function exportData() {
  const blob = new Blob([JSON.stringify({data, metas, esoData}, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'controle_financeiro_backup.json';
  a.click();
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const allowBundledData = canUseBundledFinanceData();
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      saveEmergencyBackup('before-import');
      const parsed = JSON.parse(ev.target.result);
      if (parsed.data) { data = parsed.data; metas = parsed.metas || {}; esoData = (parsed.esoData || (allowBundledData ? getDefaultEsoData() : [])).map((entry, idx) => normalizeEsoEntry(entry, idx)); }
      else if (Array.isArray(parsed)) { data = parsed; esoData = allowBundledData ? getDefaultEsoData() : []; }
      else { alert('Formato invalido'); return; }
      undoStack = [];
      redoStack = [];
      if (allowBundledData) mergeMissingHistoricalMonths();
      sortDataChronologically();
      data.forEach(m => { normalizeMonth(m); recalcTotals(m); });
      currentMonthId = data[data.length-1].id;
      periodFilter = sanitizePeriodFilter({
        ...periodFilter,
        month: currentMonthId,
        start: currentMonthId,
        end: currentMonthId
      });
      save(); saveMetas(); saveEsoData();
      Storage.setText(STORAGE_KEYS.migrationVersion, DATA_MIGRATION_VERSION);
      saveUIState();
      buildMonthSelect();
      renderAll();
      updateHistoryButtons();
      showAppStatus('Backup local salvo antes da importacao. Importacao concluida com sucesso.', 'Importacao concluida', 'ok');
      alert('Dados importados com sucesso!');
    } catch {
      showAppStatus('A importacao falhou. O ultimo estado anterior ficou salvo localmente como backup de emergencia.', 'Importacao falhou', 'error');
      alert('Erro ao importar: arquivo invalido.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function renderAll() {
  renderDashboard();
  const active = document.querySelector('.page.active')?.id;
  if (active === 'page-mes') renderMes();
  if (active === 'page-historico') renderHistorico();
  if (active === 'page-eso') renderEso();
  saveUIState();
}
