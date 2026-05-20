(function initMobileV2InternetBanking(global) {
  'use strict';

  function ensureWorkspace() {
    let mount = document.getElementById('mobileV2InternetBankingMount');
    if (mount) return mount;
    const host = document.getElementById('mobileV2OutflowFormSheetBody');
    if (!host) return null;
    mount = document.createElement('div');
    mount.id = 'mobileV2InternetBankingMount';
    mount.className = 'mobile-v2-banking-mount';
    host.appendChild(mount);
    return mount;
  }

  async function open() {
    const hasRenderer = typeof global.renderInternetBankingPage === 'function';
    if (!hasRenderer) {
      global.MobileV2OutflowForm?.openInlineSheet?.({
        title: 'Internet Banking',
        subtitle: 'Pré-visualização indisponível',
        body: '<div class="m2-empty">Não foi possível abrir os dados do Internet Banking agora.</div>'
      });
      return;
    }

    global.MobileV2OutflowForm?.openInlineSheet?.({
      title: 'Internet Banking',
      subtitle: 'Mostrando somente lançamentos pendentes',
      body: '<div id="mobileV2InternetBankingMount" class="mobile-v2-banking-mount"><div class="m2-empty">Carregando dados...</div></div>'
    });

    try {
      const mount = ensureWorkspace();
      if (!mount) return;
      await global.renderInternetBankingPage(true, 'mobileV2InternetBankingMount');
    } catch (error) {
      const mount = ensureWorkspace();
      if (mount) {
        mount.innerHTML = `<div class="m2-empty">Falha ao carregar Internet Banking: ${String(error?.message || 'erro desconhecido')}</div>`;
      }
    }
  }

  global.MobileV2InternetBanking = {
    open
  };
})(window);

