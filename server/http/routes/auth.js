function registerAuthRoutes(app, deps) {
  const {
    noStore,
    requireAuth,
    requireCsrf,
    createRateLimit,
    rateLimitState,
    getLoginConfig,
    hasDeveloperPassword,
    getAuthenticatedUser,
    ensureCsrfToken,
    findUserByEmail,
    verifyPassword,
    registerUserLogin,
    findUserById,
    deriveDataKey,
    issueRememberMeToken,
    setRememberMeCookie,
    clearRememberMeCookie,
    buildPublicProfile,
    createUser,
    writeUserAppState,
    buildFreshUserAppState,
    hashPassword,
    normalizeBirthDate,
    isValidEmail,
    isValidBrazilPhone,
    getClientCryptoConfig,
    parseCookies,
    REMEMBER_COOKIE_NAME,
    revokeRememberMeToken,
    crypto
  } = deps;

  function hashResetToken(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
  }

  function pruneResetTokens(tokens) {
    const now = Date.now();
    return (Array.isArray(tokens) ? tokens : []).filter(token => {
      if (!token || typeof token !== 'object') return false;
      if (token.usedAt) return false;
      const expiresAtMs = Date.parse(String(token.expiresAt || ''));
      return Number.isFinite(expiresAtMs) && expiresAtMs > now && token.tokenHash;
    });
  }

  function buildPasswordResetLink(req, email, token) {
    const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
    const proto = forwardedProto || req.protocol || 'http';
    const host = req.get('host');
    if (!host) return '';
    const url = new URL('/login', `${proto}://${host}`);
    url.searchParams.set('resetEmail', String(email || ''));
    url.searchParams.set('resetToken', String(token || ''));
    return url.toString();
  }

  app.get('/api/auth/login-config', noStore, (req, res) => {
    res.json({
      ...getLoginConfig(),
      developerConfigured: hasDeveloperPassword()
    });
  });

  app.get('/api/auth/session', noStore, (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!req.session?.authenticated || !user) {
      return res.status(401).json({ authenticated: false });
    }
    return res.json({
      authenticated: true,
      id: user.id,
      username: user.username,
      email: user.email || '',
      displayName: user.displayName,
      fullName: user.fullName || user.displayName,
      legacyRecurrenceBackfillRestricted: !!user.legacyRecurrenceBackfillRestricted,
      csrfToken: ensureCsrfToken(req),
      permissions: {
        canAccessESO: !!user.permissions?.canAccessESO
      }
    });
  });

  app.post('/api/auth/password-hint', noStore, createRateLimit(rateLimitState, { keyPrefix: 'hint', maxAttempts: 10 }), (req, res) => {
    const { email = '', birthDate = '' } = req.body || {};
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'E-mail ou data de nascimento incorretos.' });
    }
    if (!user.birthDate) {
      return res.status(400).json({ message: 'Nenhuma data de nascimento foi cadastrada ainda.' });
    }
    if (normalizeBirthDate(birthDate) !== normalizeBirthDate(user.birthDate)) {
      return res.status(401).json({ message: 'E-mail ou data de nascimento incorretos.' });
    }
    return res.json({
      hint: user.passwordHint || 'Nenhuma dica foi cadastrada.'
    });
  });

  app.post('/api/auth/password-reset/request', noStore, createRateLimit(rateLimitState, { keyPrefix: 'password-reset-request', maxAttempts: 6 }), async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const genericMessage = 'Se o e-mail existir, enviamos instrucoes de recuperacao.';
    if (!email || !isValidEmail(email)) {
      return res.json({ ok: true, message: genericMessage });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.json({ ok: true, message: genericMessage });
    }

    const rawToken = crypto.randomBytes(24).toString('base64url');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + (Number(process.env.FIN_PASSWORD_RESET_TTL_MINUTES || 30) * 60 * 1000)).toISOString();
    const nextTokens = pruneResetTokens(user.passwordResetTokens);
    nextTokens.push({
      tokenHash,
      expiresAt,
      createdAt: new Date().toISOString(),
      ip: String(req.ip || '')
    });
    const trimmedTokens = nextTokens.slice(-5);
    deps.updateUser(user.id, { passwordResetTokens: trimmedTokens });

    const resetLink = buildPasswordResetLink(req, email, rawToken);
    if (typeof deps.sendPasswordResetEmail === 'function') {
      try {
        await deps.sendPasswordResetEmail({
          email,
          displayName: user.displayName || user.fullName || user.username || 'usuario',
          token: rawToken,
          resetLink,
          expiresAt
        });
      } catch (error) {
        console.error('[auth] falha ao enviar e-mail de reset:', error?.message || error);
      }
    }

    return res.json({ ok: true, message: genericMessage });
  });

  app.post('/api/auth/password-reset/confirm', noStore, createRateLimit(rateLimitState, { keyPrefix: 'password-reset-confirm', maxAttempts: 8 }), (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (!email || !token || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Preencha e-mail, codigo e nova senha.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Digite um e-mail valido.' });
    }
    if (newPassword.length < deps.MIN_USER_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `A nova senha precisa ter pelo menos ${deps.MIN_USER_PASSWORD_LENGTH} caracteres.` });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'A confirmacao da senha nao confere.' });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Token invalido ou expirado.' });
    }

    const tokenHash = hashResetToken(token);
    const availableTokens = pruneResetTokens(user.passwordResetTokens);
    const matchedToken = availableTokens.find(item => item.tokenHash === tokenHash);
    if (!matchedToken) {
      return res.status(400).json({ message: 'Token invalido ou expirado.' });
    }

    if (!user.recoveryWrappedKey || typeof deps.unwrapRecoveryEncryptionKey !== 'function') {
      return res.status(409).json({
        message: 'Recuperacao de senha indisponivel para esta conta no momento. Entre com a senha atual e altere no perfil.'
      });
    }

    try {
      const currentEncryptionKey = deps.unwrapRecoveryEncryptionKey(user.recoveryWrappedKey);
      if (!currentEncryptionKey) {
        return res.status(409).json({
          message: 'Recuperacao de senha indisponivel para esta conta no momento. Entre com a senha atual e altere no perfil.'
        });
      }
      const currentState = deps.readUserAppState(user.id, currentEncryptionKey);
      const nextPasswordHash = hashPassword(newPassword);
      const nextEncryptionKey = deriveDataKey(newPassword, user.encryptionSalt).toString('base64');
      const nextRecoveryWrappedKey = typeof deps.wrapRecoveryEncryptionKey === 'function'
        ? deps.wrapRecoveryEncryptionKey(nextEncryptionKey)
        : '';
      deps.updateUser(user.id, {
        passwordHash: nextPasswordHash,
        rememberTokens: [],
        passwordResetTokens: [],
        recoveryWrappedKey: nextRecoveryWrappedKey || user.recoveryWrappedKey
      });
      deps.writeUserAppState(user.id, currentState?.state || {}, nextEncryptionKey);
      return res.json({ ok: true, message: 'Senha redefinida com sucesso. Faça login com a nova senha.' });
    } catch (error) {
      console.error('[auth] falha ao redefinir senha:', error?.message || error);
      return res.status(500).json({ message: 'Nao foi possivel redefinir a senha agora.' });
    }
  });

  app.post('/api/auth/login', noStore, createRateLimit(rateLimitState, { keyPrefix: 'login', maxAttempts: 10 }), (req, res, next) => {
    try {
      const { email = '', password = '', rememberMe = false } = req.body || {};
      const user = findUserByEmail(email);
      const passwordOk = !!user && !!password && verifyPassword(password, user.passwordHash);

      if (!user || !passwordOk) {
        return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
      }

      req.session.regenerate(error => {
        if (error) return next(error);
        const loggedUser = registerUserLogin(user.id) || findUserById(user.id) || user;
        const encryptionKey = deriveDataKey(password, loggedUser.encryptionSalt).toString('base64');
        if (typeof deps.wrapRecoveryEncryptionKey === 'function') {
          const recoveryWrappedKey = deps.wrapRecoveryEncryptionKey(encryptionKey);
          deps.updateUser(loggedUser.id, { recoveryWrappedKey });
        }
        req.session.authenticated = true;
        req.session.dataEncryptionKey = encryptionKey;
        req.session.csrfToken = crypto.randomBytes(32).toString('base64url');
        req.session.user = {
          id: loggedUser.id,
          username: loggedUser.username,
          displayName: loggedUser.displayName,
          fullName: loggedUser.fullName || loggedUser.displayName,
          legacyRecurrenceBackfillRestricted: !!loggedUser.legacyRecurrenceBackfillRestricted,
          permissions: {
            canAccessESO: !!loggedUser.permissions?.canAccessESO
          }
        };
        if (rememberMe === true || rememberMe === 'true' || rememberMe === 1 || rememberMe === '1') {
          req.session.cookie.maxAge = deps.REMEMBER_ME_MAX_AGE_MS;
          const rememberToken = issueRememberMeToken(loggedUser, encryptionKey);
          setRememberMeCookie(res, rememberToken, deps.REMEMBER_ME_MAX_AGE_MS);
        } else {
          req.session.cookie.expires = false;
          req.session.cookie.maxAge = null;
          clearRememberMeCookie(res);
        }
        return res.json({ ok: true, crypto: getClientCryptoConfig(loggedUser) });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/register', noStore, createRateLimit(rateLimitState, { keyPrefix: 'register', maxAttempts: 5 }), (req, res, next) => {
    try {
      const {
        fullName = '',
        email = '',
        phone = '',
        birthDate = '',
        password = '',
        passwordHint = ''
      } = req.body || {};

      const cleanFullName = String(fullName).trim();
      const cleanEmail = String(email).trim();
      const cleanPhone = String(phone).trim();
      const cleanBirthDate = String(birthDate).trim();
      const cleanPassword = String(password);
      const cleanPasswordHint = String(passwordHint).trim();

      if (!cleanFullName || !cleanEmail || !cleanPhone || !cleanBirthDate || !cleanPassword) {
        return res.status(400).json({ message: 'Preencha todos os campos obrigatórios.' });
      }
      if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({ message: 'Digite um e-mail válido.' });
      }
      if (!isValidBrazilPhone(cleanPhone)) {
        return res.status(400).json({ message: 'Digite um celular brasileiro válido.' });
      }
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(cleanBirthDate)) {
        return res.status(400).json({ message: 'Digite a data de nascimento no formato dd/mm/aaaa.' });
      }
      if (cleanPassword.length < deps.MIN_USER_PASSWORD_LENGTH) {
        return res.status(400).json({ message: `A senha precisa ter pelo menos ${deps.MIN_USER_PASSWORD_LENGTH} caracteres.` });
      }

      const user = createUser({
        email: cleanEmail,
        phone: cleanPhone,
        fullName: cleanFullName,
        displayName: cleanFullName.split(/\s+/)[0] || cleanFullName,
        birthDate: cleanBirthDate,
        passwordHint: cleanPasswordHint,
        passwordHash: hashPassword(cleanPassword),
        permissions: {
          canAccessESO: false
        }
      });
      const encryptionKey = deriveDataKey(cleanPassword, user.encryptionSalt).toString('base64');
      if (typeof deps.wrapRecoveryEncryptionKey === 'function') {
        const recoveryWrappedKey = deps.wrapRecoveryEncryptionKey(encryptionKey);
        deps.updateUser(user.id, { recoveryWrappedKey });
      }
      writeUserAppState(user.id, buildFreshUserAppState(), encryptionKey);

      req.session.regenerate(error => {
        if (error) return next(error);
        req.session.authenticated = true;
        req.session.dataEncryptionKey = encryptionKey;
        req.session.csrfToken = crypto.randomBytes(32).toString('base64url');
        req.session.user = {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          fullName: user.fullName || user.displayName,
          legacyRecurrenceBackfillRestricted: !!user.legacyRecurrenceBackfillRestricted,
          permissions: {
            canAccessESO: !!user.permissions?.canAccessESO
          }
        };
        return res.status(201).json({
          ok: true,
          user: buildPublicProfile(user),
          crypto: getClientCryptoConfig(user)
        });
      });
    } catch (error) {
      if (error?.message) {
        return res.status(400).json({ message: error.message });
      }
      return next(error);
    }
  });

  app.post('/api/auth/logout', noStore, requireAuth, requireCsrf, (req, res, next) => {
    const rememberToken = parseCookies(req)[REMEMBER_COOKIE_NAME];
    const user = getAuthenticatedUser(req);
    if (user && rememberToken) {
      revokeRememberMeToken(user, rememberToken);
    }
    if (!req.session) return res.json({ ok: true });
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie('fin.sid');
      clearRememberMeCookie(res);
      return res.json({ ok: true });
    });
  });
}

module.exports = { registerAuthRoutes };

