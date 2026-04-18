function registerDeveloperRoutes(app, deps) {
  const {
    noStore,
    requireDeveloper,
    requireCsrf,
    createRateLimit,
    rateLimitState,
    hasDeveloperPassword,
    verifyDeveloperAccess,
    changeDeveloperPassword,
    getDeveloperSessionPayload,
    ensureCsrfToken,
    crypto,
    listDeveloperUsers,
    findUserById,
    getUserDataIntegrity,
    listUserBackups,
    getUserBackupLogs,
    toClientBackupMeta,
    revalidateBackup,
    restoreUserBackup
  } = deps;

  app.get('/api/developer/session', noStore, (req, res) => {
    if (!req.session?.developerAuthenticated) {
      return res.status(401).json({ authenticated: false });
    }
    return res.json(getDeveloperSessionPayload(req));
  });

  app.post('/api/developer/login', noStore, createRateLimit(rateLimitState, { keyPrefix: 'developer-login', maxAttempts: 8 }), (req, res, next) => {
    try {
      const { password = '' } = req.body || {};
      if (!hasDeveloperPassword()) {
        return res.status(503).json({ message: 'A senha do desenvolvedor ainda nao foi configurada.' });
      }
      if (!verifyDeveloperAccess(password)) {
        return res.status(401).json({ message: 'Senha do desenvolvedor invalida.' });
      }
      req.session.regenerate(error => {
        if (error) return next(error);
        req.session.developerAuthenticated = true;
        req.session.csrfToken = crypto.randomBytes(32).toString('base64url');
        return res.json({ ok: true, session: getDeveloperSessionPayload(req) });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/developer/logout', noStore, requireDeveloper, requireCsrf, (req, res, next) => {
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie('fin.sid');
      return res.json({ ok: true });
    });
  });

  app.post('/api/developer/change-password', noStore, requireDeveloper, requireCsrf, (req, res) => {
    const { currentPassword = '', newPassword = '', confirmPassword = '' } = req.body || {};
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Preencha todos os campos da senha do desenvolvedor.' });
    }
    if (String(newPassword).length < deps.MIN_DEVELOPER_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `A nova senha do desenvolvedor precisa ter pelo menos ${deps.MIN_DEVELOPER_PASSWORD_LENGTH} caracteres.` });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'A confirmacao da nova senha nao confere.' });
    }
    try {
      changeDeveloperPassword(String(currentPassword), String(newPassword));
      return res.json({ ok: true });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'Nao foi possivel alterar a senha do desenvolvedor.' });
    }
  });

  app.get('/api/developer/users', noStore, requireDeveloper, (req, res) => {
    const users = listDeveloperUsers();
    const metrics = {
      totalUsers: users.length,
      activeRecently: users.filter(user => {
        const lastUsed = Date.parse(user.lastUsedAt || '');
        return lastUsed && (Date.now() - lastUsed) <= (1000 * 60 * 60 * 24 * 7);
      }).length,
      usersWithErrors: users.filter(user => user.dataStatus === 'corrupted').length,
      usersWithAlerts: users.filter(user => user.dataStatus === 'alert').length,
      totalBackups: users.reduce((sum, user) => sum + Number(user.backupCount || 0), 0)
    };
    return res.json({ users, metrics });
  });

  app.get('/api/developer/users/:userId/backups', noStore, requireDeveloper, (req, res) => {
    const user = findUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }
    return res.json({
      user: {
        id: user.id,
        fullName: user.fullName || user.displayName || user.username,
        username: user.username,
        email: user.email || '',
        phone: user.phone || '',
        createdAt: user.createdAt || '',
        lastUsedAt: user.lastUsedAt || '',
        lastLoginAt: user.lastLoginAt || '',
        loginCount: Number(user.loginCount || 0),
        lastRestoreAt: user.lastRestoreAt || ''
      },
      dataStatus: getUserDataIntegrity(user.id),
      backups: listUserBackups(user.id).map(toClientBackupMeta),
      logs: getUserBackupLogs(user.id)
    });
  });

  app.post('/api/developer/users/:userId/backups/:backupId/revalidate', noStore, requireDeveloper, requireCsrf, (req, res) => {
    try {
      const result = revalidateBackup(req.params.userId, req.params.backupId);
      return res.json({ ok: true, integrity: result });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'Nao foi possivel revalidar o backup.' });
    }
  });

  app.post('/api/developer/users/:userId/backups/:backupId/restore', noStore, requireDeveloper, requireCsrf, (req, res) => {
    try {
      const result = restoreUserBackup(req.params.userId, req.params.backupId);
      return res.json({ ok: true, restoredAt: result.restoredAt });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'Nao foi possivel restaurar o backup.' });
    }
  });

  app.get('/api/developer/report', noStore, requireDeveloper, (req, res) => {
    const users = listDeveloperUsers();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-tecnico-${new Date().toISOString().slice(0, 10)}.json"`);
    return res.send(JSON.stringify({
      generatedAt: new Date().toISOString(),
      metrics: {
        totalUsers: users.length,
        activeRecently: users.filter(user => {
          const lastUsed = Date.parse(user.lastUsedAt || '');
          return lastUsed && (Date.now() - lastUsed) <= (1000 * 60 * 60 * 24 * 7);
        }).length,
        usersWithErrors: users.filter(user => user.dataStatus === 'corrupted').length,
        usersWithAlerts: users.filter(user => user.dataStatus === 'alert').length,
        totalBackups: users.reduce((sum, user) => sum + Number(user.backupCount || 0), 0)
      },
      users
    }, null, 2));
  });
}

module.exports = { registerDeveloperRoutes };

