function registerProfileRoutes(app, deps) {
  const {
    noStore,
    requireAuth,
    requireCsrf,
    ensureCsrfToken,
    getAuthenticatedUser,
    buildPrivateProfile,
    createUserBackup,
    toClientBackupMeta,
    updateUser,
    syncUserAppStateLocation,
    isValidEmail,
    isValidBrazilPhone,
    verifyPassword,
    deriveDataKey,
    readUserAppState,
    hashPassword,
    writeUserAppState,
    getClientCryptoConfig,
    archiveDeletedUserAppState,
    deleteUserAppState,
    deleteUser,
    consumeOperationToken
  } = deps;

  app.get('/api/profile', noStore, requireAuth, (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
    }
    res.json(buildPrivateProfile(user));
  });

  app.post('/api/backups/manual', noStore, requireAuth, requireCsrf, (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Sessao expirada ou inexistente.' });
    }
    const operationToken = String(req.get('X-Operation-Token') || '').trim();
    const tokenResult = typeof consumeOperationToken === 'function'
      ? consumeOperationToken('backups:manual', user.id, operationToken)
      : { accepted: true, duplicate: false };
    if (!tokenResult.accepted) {
      return res.status(409).json({ message: 'Operacao duplicada detectada. Aguarde para tentar novamente.', duplicate: true });
    }
    try {
      const backup = createUserBackup(user.id, {
        type: 'manual',
        note: String(req.body?.note || '').trim()
      });
      return res.json({ ok: true, backup: toClientBackupMeta(backup) });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'Nao foi possivel criar o backup.' });
    }
  });

  app.post('/api/backups/auto-exit', noStore, requireAuth, (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Sessao expirada ou inexistente.' });
    }
    const expectedCsrf = ensureCsrfToken(req);
    const receivedCsrf = String(
      req.get('X-CSRF-Token')
      || req.body?.csrfToken
      || ''
    ).trim();
    if (!receivedCsrf || receivedCsrf !== expectedCsrf) {
      return res.status(403).json({ message: 'Token CSRF invalido.' });
    }

    const minIntervalMs = Math.max(5_000, Number(process.env.FIN_AUTO_EXIT_BACKUP_MIN_MS || 60_000) || 60_000);
    const lastAutoExitAtMs = Date.parse(String(user?.backupStats?.lastAutoExitBackupAt || ''));
    const nowMs = Date.now();
    if (Number.isFinite(lastAutoExitAtMs) && (nowMs - lastAutoExitAtMs) < minIntervalMs) {
      return res.json({ ok: true, skipped: true, reason: 'cooldown' });
    }

    try {
      const reason = String(req.body?.reason || 'auto-exit').trim().slice(0, 64) || 'auto-exit';
      const backup = createUserBackup(user.id, {
        type: 'automatic',
        note: `Backup automático de saída (${reason}).`
      });
      updateUser(user.id, {
        backupStats: {
          ...(user?.backupStats || {}),
          lastAutoExitBackupAt: new Date(nowMs).toISOString()
        }
      });
      return res.json({ ok: true, backup: toClientBackupMeta(backup) });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'Nao foi possivel criar backup automatico de saida.' });
    }
  });

  app.put('/api/profile', noStore, requireAuth, (req, res) => {
    if (!req.get('X-CSRF-Token') || req.get('X-CSRF-Token') !== ensureCsrfToken(req)) {
      return res.status(403).json({ message: 'Token CSRF inválido.' });
    }
    try {
      const user = getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
      }
      const nextProfile = {
        displayName: String(req.body?.displayName || '').trim() || user.displayName,
        fullName: String(req.body?.fullName || '').trim(),
        birthDate: String(req.body?.birthDate || '').trim(),
        phone: String(req.body?.phone || '').trim(),
        email: String(req.body?.email || '').trim(),
        passwordHint: String(req.body?.passwordHint || '').trim()
      };
      const isKeepingLegacyLoginValue = nextProfile.email === (user.email || '');
      if (!isKeepingLegacyLoginValue && !isValidEmail(nextProfile.email)) {
        return res.status(400).json({ message: 'Digite um e-mail válido.' });
      }
      if (nextProfile.phone && !isValidBrazilPhone(nextProfile.phone)) {
        return res.status(400).json({ message: 'Digite um celular brasileiro válido.' });
      }
      const nextUser = updateUser(user.id, nextProfile);
      syncUserAppStateLocation(nextUser.id);
      if (req.session?.user) {
        req.session.user.displayName = nextUser.displayName;
        req.session.user.fullName = nextUser.fullName || nextUser.displayName;
        req.session.user.legacyRecurrenceBackfillRestricted = !!nextUser.legacyRecurrenceBackfillRestricted;
      }
      res.json({
        ok: true,
        profile: buildPrivateProfile(nextUser)
      });
    } catch (error) {
      if (error?.message) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
  });

  app.post('/api/profile/change-password', noStore, requireAuth, requireCsrf, (req, res) => {
    const { currentPassword = '', newPassword = '', confirmPassword = '' } = req.body || {};
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
    }

    const operationToken = String(req.get('X-Operation-Token') || '').trim();
    const tokenResult = typeof consumeOperationToken === 'function'
      ? consumeOperationToken('profile:change-password', user.id, operationToken)
      : { accepted: true, duplicate: false };
    if (!tokenResult.accepted) {
      return res.status(409).json({ message: 'Operacao duplicada detectada. Aguarde para tentar novamente.', duplicate: true });
    }

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(401).json({ message: 'Senha atual incorreta.' });
    }
    if (String(newPassword).length < deps.MIN_USER_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `A nova senha precisa ter pelo menos ${deps.MIN_USER_PASSWORD_LENGTH} caracteres.` });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'A confirmação da senha nao confere.' });
    }

    try {
      const currentEncryptionKey = req.session?.dataEncryptionKey || deriveDataKey(currentPassword, user.encryptionSalt).toString('base64');
      const currentState = readUserAppState(user.id, currentEncryptionKey);
      const nextUser = updateUser(user.id, {
        passwordHash: hashPassword(newPassword),
        rememberTokens: []
      });
      const nextEncryptionKey = deriveDataKey(newPassword, nextUser.encryptionSalt).toString('base64');
      writeUserAppState(user.id, currentState?.state || {}, nextEncryptionKey);
      req.session.dataEncryptionKey = nextEncryptionKey;
      return res.json({ ok: true, crypto: getClientCryptoConfig(nextUser) });
    } catch (error) {
      return res.status(500).json({ message: 'Não foi possível recriptografar os dados com a nova senha.' });
    }
  });

  app.post('/api/profile/delete-account', noStore, requireAuth, requireCsrf, (req, res, next) => {
    const { password = '' } = req.body || {};
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Sessão expirada ou inexistente.' });
    }
    const operationToken = String(req.get('X-Operation-Token') || '').trim();
    const tokenResult = typeof consumeOperationToken === 'function'
      ? consumeOperationToken('profile:delete-account', user.id, operationToken)
      : { accepted: true, duplicate: false };
    if (!tokenResult.accepted) {
      return res.status(409).json({ message: 'Operacao duplicada detectada. Aguarde para tentar novamente.', duplicate: true });
    }

    if (!password || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Senha incorreta.' });
    }

    try {
      archiveDeletedUserAppState(user);
      deleteUserAppState(user.id);
      deleteUser(user.id);
    } catch (error) {
      return next(error);
    }

    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie('fin.sid');
      return res.json({ ok: true });
    });
  });
}

module.exports = { registerProfileRoutes };
