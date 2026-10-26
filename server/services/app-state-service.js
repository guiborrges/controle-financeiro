class AppStateConflict extends Error {
  constructor(kind, details) {
    super(kind);
    this.kind = kind;
    this.details = details;
  }
}

function getFinDataCount(state) {
  return Array.isArray(state?.finData) ? state.finData.length : 0;
}

function hasRevisionConflict(baseRevision, currentRevision) {
  const current = String(currentRevision || '').trim();
  return !!current && String(baseRevision || '').trim() !== current;
}

function hasDangerousMonthDrop(previousState, nextState) {
  const previous = getFinDataCount(previousState);
  const next = getFinDataCount(nextState);
  if (previous < 10 || next >= previous - 2) return false;
  return next < Math.ceil(previous * 0.8);
}

function createAppStateService(deps) {
  const { readUserAppState, writeUserAppState, hasUserAppState,
    recoverMissingMonthsFromLegacyBackups, USERS_DATA_DIR,
    buildWidgetSnapshot, saveWidgetSnapshot } = deps;
  const logger = deps.logger || console;
  const debug = String(process.env.FIN_APP_STATE_DEBUG || '').trim() === '1';

  function prepareBootstrap(userId, savedState, encryptionKey = '') {
    if (savedState?.state) {
      const recovered = recoverMissingMonthsFromLegacyBackups(userId, savedState.state, USERS_DATA_DIR);
      if (recovered.changed) {
        const rewritten = writeUserAppState(userId, recovered.state || {}, encryptionKey);
        return { ...savedState, partitioned: true,
          partitionVersion: rewritten?.partitionVersion || savedState?.partitionVersion,
          state: recovered.state, updatedAt: rewritten?.updatedAt || savedState?.updatedAt || '' };
      }
      if (!savedState.partitioned || Number(savedState.partitionVersion || 0) < 3) {
        const rewritten = writeUserAppState(userId, savedState.state || {}, encryptionKey);
        return { ...savedState, partitioned: true,
          partitionVersion: rewritten?.partitionVersion || savedState?.partitionVersion,
          updatedAt: rewritten?.updatedAt || savedState?.updatedAt || '' };
      }
      if (!savedState.encrypted && encryptionKey) {
        const rewritten = writeUserAppState(userId, savedState.state || {}, encryptionKey);
        return { ...savedState, updatedAt: rewritten?.updatedAt || savedState?.updatedAt || '' };
      }
    } else if (savedState && !savedState.encrypted && encryptionKey) {
      const rewritten = writeUserAppState(userId, savedState.state || {}, encryptionKey);
      return { ...savedState, updatedAt: rewritten?.updatedAt || savedState?.updatedAt || '' };
    }
    return savedState;
  }

  function commit(user, state, baseRevision, encryptionKey = '', context = {}) {
    const currentState = readUserAppState(user.id, encryptionKey);
    const currentRevision = String(currentState?.updatedAt || '').trim();
    if (debug) logger.log('[app-state][put-check]', { ...context, userId: user.id, baseRevision, currentRevision });
    if (hasRevisionConflict(baseRevision, currentRevision)) {
      logger.warn('[app-state] Conflito real detectado - bloqueando write', { ...context, userId: user.id, baseRevision, currentRevision });
      throw new AppStateConflict('revision', { currentRevision });
    }
    if (hasDangerousMonthDrop(currentState?.state, state)) {
      const previousCount = getFinDataCount(currentState?.state);
      const nextCount = getFinDataCount(state);
      logger.warn('[app-state] Queda brusca de meses bloqueada', { ...context, userId: user.id, previousCount, nextCount, baseRevision });
      throw new AppStateConflict('month-drop', { currentRevision,
        previousMonthCount: previousCount, nextMonthCount: nextCount });
    }
    const saved = writeUserAppState(user.id, state, encryptionKey);
    if (user.widgetToken && typeof buildWidgetSnapshot === 'function' && typeof saveWidgetSnapshot === 'function') {
      try { saveWidgetSnapshot(user.id, buildWidgetSnapshot(user.id, state)); }
      catch (error) { logger.error('[widget-snapshot] Erro ao gerar snapshot:', error?.message || String(error)); }
    }
    if (debug) logger.log('[app-state][put-ok]', { ...context, userId: user.id, baseRevision, updatedAt: saved.updatedAt });
    return saved;
  }

  return { read: readUserAppState, has: hasUserAppState, prepareBootstrap, commit,
    migrate: (userId, state, encryptionKey = '') => writeUserAppState(userId, state, encryptionKey) };
}

module.exports = { createAppStateService, AppStateConflict, hasRevisionConflict, hasDangerousMonthDrop };
