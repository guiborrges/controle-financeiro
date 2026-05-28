bindGlobalInteractions();
runStartupSelfCheck();

function clearBootstrapRetryAction() {
  const existing = document.getElementById('appStatusRetryAction');
  if (existing) existing.remove();
}

function showBootstrapFatalError(error) {
  showAppStatus(
    `${error?.message || 'Falha ao iniciar o sistema.'}\nRecarregue a pagina. Se o erro continuar, use o backup local salvo no navegador.`,
    'Erro de inicializacao',
    'error'
  );
  const statusCopy = document.querySelector('#appStatus .app-status-copy');
  if (!statusCopy) return;
  clearBootstrapRetryAction();
  const action = document.createElement('button');
  action.id = 'appStatusRetryAction';
  action.type = 'button';
  action.className = 'btn btn-primary';
  action.style.marginTop = '8px';
  action.style.padding = '6px 10px';
  action.style.fontSize = '12px';
  action.textContent = 'Tentar novamente';
  action.addEventListener('click', () => window.location.reload());
  statusCopy.appendChild(action);
}

(async () => {
  try {
    await initializeServerStorage({ allowPartial: false });
    clearBootstrapRetryAction();
    init();
    if (window.MobileV2?.isEnabled?.()) {
      window.MobileV2.apply?.();
      window.MobileV2.refresh?.();
      window.setTimeout(() => window.MobileV2?.refresh?.(), 500);
      window.setTimeout(() => window.MobileV2?.refresh?.(), 1800);
    }
  } catch (error) {
    showBootstrapFatalError(error);
    return;
  }
})();
