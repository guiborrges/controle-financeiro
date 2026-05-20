(function initMobileV2Patrimonio(global) {
  'use strict';

  function formatMoney(value) {
    if (typeof global.fmt === 'function') return global.fmt(Number(value || 0));
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function escapeHtml(value) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveData() {
    const accounts = Array.isArray(global.patrimonioAccounts) ? global.patrimonioAccounts : [];
    const movements = Array.isArray(global.patrimonioMovements) ? global.patrimonioMovements : [];
    if (accounts.length || movements.length) return { accounts, movements };

    if (typeof global.getPatrimonioData === 'function') {
      try {
        const data = global.getPatrimonioData();
        return {
          accounts: Array.isArray(data?.accounts) ? data.accounts : [],
          movements: Array.isArray(data?.movements) ? data.movements : [],
          error: String(data?.error || '')
        };
      } catch {}
    }

    return { accounts: [], movements: [], error: 'Dados de patrimônio indisponíveis no momento.' };
  }

  function getAccountBalance(account) {
    return Number(account?.balance || account?.saldoAtual || account?.initialBalance || 0);
  }

  function render(target) {
    if (!target) return;

    const { accounts, movements, error } = resolveData();
    const total = accounts.reduce((sum, account) => sum + getAccountBalance(account), 0);
    const recent = [...movements].slice(-5).reverse();

    target.innerHTML = `
      <header class="m2-header m2-page-header">
        <div>
          <h2 class="m2-title">Patrimônio</h2>
          <p class="m2-subtitle">Visão consolidada das contas</p>
        </div>
        <div class="m2-header-actions">
          <button class="m2-icon-btn" type="button" aria-label="Internet Banking" onclick="MobileV2InternetBanking.open()">${global.MobileV2BottomNav?.ICONS?.calendario || ''}</button>
          <button class="m2-icon-btn" type="button" aria-label="Notificações" onclick="toggleNotificationsPopover(event)">${global.SystemIcons?.render ? global.SystemIcons.render('notification') : ''}</button>
          <button class="m2-icon-btn" type="button" aria-label="Perfil" onclick="MobileV2PerfilSheet.open()">${global.SystemIcons?.render ? global.SystemIcons.render('user') : ''}</button>
        </div>
      </header>

      <section class="hero-card hero-card-wealth">
        <div class="hero-result-label">TOTAL PATRIMONIAL</div>
        <div class="hero-result">${formatMoney(total)}</div>
        <div class="hero-sub"><span>${error ? escapeHtml(error) : `${accounts.length} conta(s) acompanhada(s)`}</span></div>
      </section>

      <section class="m-list-card">
        <h3 class="m-list-title">Contas</h3>
        ${accounts.length ? accounts.map((account) => {
          const name = String(account?.name || account?.nome || 'Conta');
          const icon = String(account?.icon || account?.symbol || '🏦');
          const balance = getAccountBalance(account);
          return `
            <article class="m-item m-item-income">
              <div class="m-item-surface static">
                <div class="m-item-info">
                  <span class="m-item-name">${escapeHtml(icon)} ${escapeHtml(name)}</span>
                </div>
                <span class="m-item-value ${balance >= 0 ? 'income' : ''}">${formatMoney(balance)}</span>
              </div>
            </article>
          `;
        }).join('') : '<div class="m2-empty">Nenhuma conta patrimonial cadastrada.</div>'}
        <div class="m2-list-actions">
          <button class="m2-chip-btn" type="button" onclick="openPatrimonioAccountModal?.()">+ Nova conta</button>
        </div>
      </section>

      <section class="m-list-card">
        <h3 class="m-list-title">Movimentações recentes</h3>
        ${recent.length ? recent.map((movement) => {
          const type = String(movement?.type || 'aporte');
          const description = String(movement?.description || movement?.descricao || type);
          const date = String(movement?.date || movement?.data || 'Sem data');
          const value = Math.abs(Number(movement?.value || movement?.valor || 0));
          const icon = type === 'retirada' ? '↗' : (type === 'transferencia' ? '⇄' : '↘');
          return `
            <article class="m-item m-item-income">
              <div class="m-item-surface static">
                <div class="m-item-info">
                  <span class="m-item-name">${escapeHtml(icon)} ${escapeHtml(description)}</span>
                  <span class="m-item-meta">${escapeHtml(date)}</span>
                </div>
                <span class="m-item-value ${type === 'retirada' ? '' : 'income'}">${formatMoney(value)}</span>
              </div>
            </article>
          `;
        }).join('') : '<div class="m2-empty">Sem movimentações recentes.</div>'}
      </section>
    `;
  }

  function refreshIfVisible() {
    if (!global.MobileV2?.isEnabled?.()) return;
    const screen = document.getElementById('mobileV2Screen-patrimonio');
    if (!screen || !screen.classList.contains('active')) return;
    render(screen);
  }

  global.MobileV2Patrimonio = {
    render,
    refreshIfVisible
  };

  document.addEventListener('appStateUpdated', refreshIfVisible);
  document.addEventListener('dataLoaded', refreshIfVisible);
})(window);

