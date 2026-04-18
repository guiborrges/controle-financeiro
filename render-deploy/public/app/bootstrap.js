bindGlobalInteractions();
runStartupSelfCheck();
(async () => {
  try {
    await initializeServerStorage();
    init();
  } catch (error) {
  showAppStatus(
    `${error?.message || 'Falha ao iniciar o sistema.'}\nRecarregue a pagina. Se o erro continuar, use o backup local salvo no navegador.`,
    'Erro de inicializacao',
    'error'
  );
    throw error;
  }
})();
