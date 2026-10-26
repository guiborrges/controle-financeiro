function createBackupService({ createUserBackup, toClientBackupMeta, updateUser, now = Date.now }) {
  return {
    createManual(userId, note) {
      return toClientBackupMeta(createUserBackup(userId, { type: 'manual', note: String(note || '').trim() }));
    },
    getAutoExitTime(user) {
      const minIntervalMs = Math.max(5_000, Number(process.env.FIN_AUTO_EXIT_BACKUP_MIN_MS || 21_600_000) || 21_600_000);
      const last = Date.parse(String(user?.backupStats?.lastAutoExitBackupAt || ''));
      const nowMs = now();
      return Number.isFinite(last) && nowMs - last < minIntervalMs ? null : nowMs;
    },
    createAutoExit(user, rawReason, nowMs) {
      const reason = String(rawReason || 'auto-exit').trim().slice(0, 64) || 'auto-exit';
      const backup = createUserBackup(user.id, { type: 'automatic',
        note: `Backup autom\u00e1tico de sa\u00edda (${reason}).` });
      updateUser(user.id, { backupStats: { ...(user.backupStats || {}), lastAutoExitBackupAt: new Date(nowMs).toISOString() } });
      return toClientBackupMeta(backup);
    }
  };
}

module.exports = { createBackupService };
