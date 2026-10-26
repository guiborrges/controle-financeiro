const { createAppStateService, AppStateConflict } = require('../../services/app-state-service');
const { getLegacySeedForUser } = require('../../legacy-seed-data');

function registerAppStateRoutes(app, deps) {
  const {
    noStore,
    requireAuth,
    requireCsrf,
    getAuthenticatedUser,
    touchUserActivity,
    findUserById,
    ensureCsrfToken,
    buildPrivateProfile
  } = deps;

  const DEBUG_APP_STATE = String(process.env.FIN_APP_STATE_DEBUG || '').trim() === '1';
  function buildRequestContext(req, userId = '') {
    const headers = req && typeof req === 'object' && req.headers && typeof req.headers === 'object'
      ? req.headers
      : {};
    return {
      pid: process.pid,
      userId,
      ip: (req && req.ip) || headers['x-forwarded-for'] || '',
      ua: headers['user-agent'] || '',
      requestId: headers['x-request-id'] || ''
    };
  }

  const stateService = createAppStateService(deps);

  app.get('/api/app/bootstrap', noStore, requireAuth, (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Sessao expirada ou inexistente.' });
    }
    touchUserActivity(user.id);
    const refreshedUser = findUserById(user.id) || user;
    let savedState = null;
    try {
      savedState = stateService.read(refreshedUser.id, req.session?.dataEncryptionKey || '');
    } catch (error) {
      console.error('[bootstrap] Falha ao carregar estado do usuario', {
        userId: refreshedUser.id,
        username: refreshedUser.username,
        message: error?.message || String(error)
      });
      return res.status(500).json({ message: 'Falha ao carregar os dados do usuario com seguranca.' });
    }
    savedState = stateService.prepareBootstrap(refreshedUser.id, savedState, req.session?.dataEncryptionKey || '');
    const isPrimaryUser = refreshedUser.username === 'guilherme';
    
    // ✅ CRÍTICO: Sempre retornar updatedAt do estado carregado
    const stateRevision = savedState?.updatedAt || '';
    if (DEBUG_APP_STATE) {
      console.log('[app-state][bootstrap]', {
        ...buildRequestContext(req, refreshedUser.id),
        userId: refreshedUser.id,
        stateRevision,
        hasServerState: !!savedState
      });
    }
    
    return res.json({
      session: {
        authenticated: true,
        id: refreshedUser.id,
        username: refreshedUser.username,
        email: refreshedUser.email || '',
        displayName: refreshedUser.displayName,
        fullName: refreshedUser.fullName || refreshedUser.displayName,
        legacyRecurrenceBackfillRestricted: !!refreshedUser.legacyRecurrenceBackfillRestricted,
        csrfToken: ensureCsrfToken(req),
        permissions: {
          canAccessESO: !!refreshedUser.permissions?.canAccessESO
        }
      },
      profile: buildPrivateProfile(refreshedUser),
      permissions: {
        canAccessESO: !!refreshedUser.permissions?.canAccessESO
      },
      isPrimaryUser,
      legacySeed: getLegacySeedForUser(refreshedUser),
      appState: savedState?.state || null,
      stateRevision: stateRevision,
      hasServerState: !!savedState,
      shouldStartEmpty: !savedState && !isPrimaryUser
    });
  });

  app.put('/api/app-state', noStore, requireAuth, requireCsrf, (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Sessao expirada ou inexistente.' });
    }
    const state = req.body?.state;
    const baseRevision = String(req.body?.baseRevision || '').trim();
    
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return res.status(400).json({ message: 'Estado invalido.' });
    }
    
    try {
      const saved = stateService.commit(user, state, baseRevision,
        req.session?.dataEncryptionKey || '', buildRequestContext(req, user.id));
      return res.json({ ok: true, updatedAt: saved.updatedAt });
    } catch (error) {
      if (error instanceof AppStateConflict) {
        const message = error.kind === 'revision'
          ? 'O estado foi alterado em outra aba/dispositivo. Recarregue para evitar perda de dados.'
          : 'Salvamento bloqueado para proteger seus dados: a aba tentou salvar uma versao com muitos meses a menos. Recarregue a pagina.';
        return res.status(409).json({ message, conflict: true, ...error.details });
      }
      console.error('[app-state] ❌ Erro ao salvar estado', {
        userId: user.id,
        message: error?.message || String(error)
      });
      return res.status(400).json({
        message: error?.message || 'Falha ao salvar o estado.'
      });
    }
  });

  app.post('/api/app-state/migrate-legacy', noStore, requireAuth, requireCsrf, (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Sessao expirada ou inexistente.' });
    }
    const state = req.body?.state;
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return res.status(400).json({ message: 'Estado de migracao invalido.' });
    }
    if (stateService.has(user.id)) {
      return res.json({ ok: true, migrated: false });
    }
    try {
      stateService.migrate(user.id, state, req.session?.dataEncryptionKey || '');
      return res.json({ ok: true, migrated: true });
    } catch (error) {
      return res.status(400).json({
        message: error?.message || 'Falha ao migrar estado.'
      });
    }
  });
}

module.exports = { registerAppStateRoutes };
