function registerPageRoutes(app, deps) {
  const {
    noStore,
    requireAuth,
    requireDeveloper,
    loginHtmlPath,
    appHtmlPath,
    developerHtmlPath
  } = deps;

  app.get('/', noStore, (req, res) => {
    if (req.session?.developerAuthenticated) return res.redirect('/developer');
    res.redirect(req.session?.authenticated ? '/app' : '/login');
  });

  app.get('/login', noStore, (req, res) => {
    if (req.session?.developerAuthenticated) {
      return res.redirect('/developer');
    }
    if (req.session?.authenticated) {
      return res.redirect('/app');
    }
    return res.sendFile(loginHtmlPath);
  });

  app.get('/app', noStore, requireAuth, (req, res) => {
    res.sendFile(appHtmlPath);
  });

  app.get('/developer', noStore, requireDeveloper, (req, res) => {
    res.sendFile(developerHtmlPath);
  });
}

module.exports = { registerPageRoutes };

