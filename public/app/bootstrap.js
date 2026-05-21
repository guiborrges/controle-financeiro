bindGlobalInteractions();
runStartupSelfCheck();
(async () => {
  try {
    const bootstrap = await initializeServerStorage();
    if (bootstrap?.bootstrapFallback) {
      showAppStatus(
        `Entramos em modo de recuperacao da sessao.\n${bootstrap.bootstrapFallbackReason || 'Falha no bootstrap principal.'}`,
        'Carregamento parcial',
        'error'
      );
    }
    init();
    if (window.MobileV2?.isEnabled?.()) {
      window.MobileV2.apply?.();
      window.MobileV2.refresh?.();
      window.setTimeout(() => window.MobileV2?.refresh?.(), 500);
      window.setTimeout(() => window.MobileV2?.refresh?.(), 1800);
    }
  } catch (error) {
  showAppStatus(
    `${error?.message || 'Falha ao iniciar o sistema.'}\nRecarregue a pagina. Se o erro continuar, use o backup local salvo no navegador.`,
    'Erro de inicializacao',
    'error'
  );
    return;
  }
})();
