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

