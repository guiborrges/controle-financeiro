function registerAppStateRoutes(app, deps) {
  const {
    noStore,
    requireAuth,
    requireCsrf,
    getAuthenticatedUser,
    touchUserActivity,
    findUserById,
    readUserAppState,
    recoverMissingMonthsFromLegacyBackups,
    USERS_DATA_DIR,
    writeUserAppState,
    ensureCsrfToken,
    buildPrivateProfile,
    hasUserAppState,
    buildWidgetSnapshot,
    saveWidgetSnapshot
  } = deps;

  // Constantes para tolerância de conflito (2 segundos)
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

  /**
   * Verifica se há um conflito REAL comparando timestamps com tolerância
   */
  function hasRevisionConflict(baseRevisionStr, currentRevisionStr) {
    const base = String(baseRevisionStr || '').trim();
    const current = String(currentRevisionStr || '').trim();
    if (!base || !current) return false;
    return base !== current;
  }

  app.get('/api/app/bootstrap', noStore, requireAuth, (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Sessao expirada ou inexistente.' });
    }
    touchUserActivity(user.id);
    const refreshedUser = findUserById(user.id) || user;
    let savedState = null;
    try {
      savedState = readUserAppState(refreshedUser.id, req.session?.dataEncryptionKey || '');
    } catch (error) {
      console.error('[bootstrap] Falha ao carregar estado do usuario', {
        userId: refreshedUser.id,
        username: refreshedUser.username,
        message: error?.message || String(error)
      });
      return res.status(500).json({ message: 'Falha ao carregar os dados do usuario com seguranca.' });
    }
    if (savedState?.state) {
      const recovered = recoverMissingMonthsFromLegacyBackups(refreshedUser.id, savedState.state, USERS_DATA_DIR);
      if (recovered.changed) {
        const rewritten = writeUserAppState(refreshedUser.id, recovered.state || {}, req.session?.dataEncryptionKey || '');
        savedState = {
          ...savedState,
          state: recovered.state,
          updatedAt: rewritten?.updatedAt || savedState?.updatedAt || ''
        };
      } else if (!savedState.encrypted && req.session?.dataEncryptionKey) {
        const rewritten = writeUserAppState(refreshedUser.id, savedState.state || {}, req.session.dataEncryptionKey);
        savedState = {
          ...savedState,
          updatedAt: rewritten?.updatedAt || savedState?.updatedAt || ''
        };
      }
    } else if (savedState && !savedState.encrypted && req.session?.dataEncryptionKey) {
      const rewritten = writeUserAppState(refreshedUser.id, savedState.state || {}, req.session.dataEncryptionKey);
      savedState = {
        ...savedState,
        updatedAt: rewritten?.updatedAt || savedState?.updatedAt || ''
      };
    }
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
      // ✅ NOVO: Validar conflito APENAS se baseRevision não estiver vazio
      if (baseRevision) {
        const currentState = readUserAppState(user.id, req.session?.dataEncryptionKey || '');
        const currentRevision = String(currentState?.updatedAt || '').trim();
        
        if (DEBUG_APP_STATE) {
          console.log('[app-state][put-check]', {
            ...buildRequestContext(req, user.id),
            userId: user.id,
            baseRevision,
            currentRevision
          });
        }

        if (currentRevision && hasRevisionConflict(baseRevision, currentRevision)) {
          console.warn('[app-state] Conflito real detectado - bloqueando write', {
            ...buildRequestContext(req, user.id),
            userId: user.id,
            baseRevision,
            currentRevision
          });
          return res.status(409).json({
            message: 'O estado foi alterado em outra aba/dispositivo. Recarregue para evitar perda de dados.',
            conflict: true,
            currentRevision
          });
        }
      }

      const saved = writeUserAppState(user.id, state, req.session?.dataEncryptionKey || '');
      if (user?.widgetToken && typeof buildWidgetSnapshot === 'function' && typeof saveWidgetSnapshot === 'function') {
        try {
          const snapshot = buildWidgetSnapshot(user.id, state);
          saveWidgetSnapshot(user.id, snapshot);
        } catch (snapshotError) {
          console.error('[widget-snapshot] Erro ao gerar snapshot:', snapshotError?.message || String(snapshotError));
        }
      }
      
      console.log('[app-state] ✅ Salvamento bem-sucedido', {
        userId: user.id,
        updatedAt: saved.updatedAt
      });

      if (DEBUG_APP_STATE) {
        console.log('[app-state][put-ok]', {
          ...buildRequestContext(req, user.id),
          userId: user.id,
          baseRevision,
          updatedAt: saved.updatedAt
        });
      }
      return res.json({ ok: true, updatedAt: saved.updatedAt });
    } catch (error) {
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
    if (hasUserAppState(user.id)) {
      return res.json({ ok: true, migrated: false });
    }
    try {
      writeUserAppState(user.id, state, req.session?.dataEncryptionKey || '');
      return res.json({ ok: true, migrated: true });
    } catch (error) {
      return res.status(400).json({
        message: error?.message || 'Falha ao migrar estado.'
      });
    }
  });
}

module.exports = { registerAppStateRoutes };
