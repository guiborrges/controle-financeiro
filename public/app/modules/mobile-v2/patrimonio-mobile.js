(function initMobileV2Patrimonio(global) {
  'use strict';

  function formatMoney(value) {
    if (global.MobileV2Data?.formatMoney) return global.MobileV2Data.formatMoney(value);
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
    if (global.MobileV2Data?.getPatrimonioData) {
      return global.MobileV2Data.getPatrimonioData();
    }

    if (typeof global.getPatrimonioFilteredAccounts === 'function') {
      try {
        const accounts = global.getPatrimonioFilteredAccounts();
        const movements = typeof global.getPatrimonioFilteredMovements === 'function'
          ? global.getPatrimonioFilteredMovements()
          : (Array.isArray(global.patrimonioMovements) ? global.patrimonioMovements : []);
        const metrics = typeof global.getPatrimonioMetrics === 'function'
          ? global.getPatrimonioMetrics()
          : null;
        return {
          accounts: Array.isArray(accounts) ? accounts : [],
          movements: Array.isArray(movements) ? movements : [],
          metrics
        };
      } catch (error) {
        return {
          accounts: [],
          movements: [],
          metrics: null,
          error: error?.message || 'Dados de patrimônio indisponíveis no momento.'
        };
      }
    }

    return { accounts: [], movements: [], error: 'Dados de patrimônio indisponíveis no momento.' };
  }

  function getAccountBalance(account) {
    if (Number.isFinite(Number(account?.saldo))) return Number(account.saldo);
    if (typeof global.getPatrimonioBalanceForAccount === 'function' && account?.id) {
      return Number(global.getPatrimonioBalanceForAccount(account.id) || 0);
    }
    return Number(account?.balance || account?.saldoAtual || account?.initialBalance || 0);
  }

  function renderAccountBadge(account) {
    if (typeof global.renderPatrimonioAccountBadge === 'function') {
      try {
        const visual = typeof global.inferPatrimonioVisual === 'function'
          ? global.inferPatrimonioVisual(account?.nome || account?.name, account?.tipo)
          : null;
        return global.renderPatrimonioAccountBadge(account, visual);
      } catch {}
    }
    const label = String(account?.institution || account?.icon || account?.symbol || account?.nome || account?.name || 'P').trim();
    return `<span class="m2-patr-badge">${escapeHtml(label.slice(0, 2).toUpperCase())}</span>`;
  }

  function formatDate(value) {
    if (typeof global.formatPatrimonioDate === 'function') return global.formatPatrimonioDate(value);
    return String(value || 'Sem data');
  }

  function movementAmount(movement) {
    const value = Math.abs(Number(movement?.value ?? movement?.valor ?? 0) || 0);
    const type = String(movement?.type || 'aporte');
    return type === 'retirada' ? -value : value;
  }

  function actionIcon(name, fallback) {
    if (typeof global.renderPatrimonioActionIcon === 'function') {
      const icon = global.renderPatrimonioActionIcon(name);
      if (icon) return icon;
    }
    return fallback;
  }

  function renderHeaderIcon(name, fallback) {
    return global.SystemIcons?.render ? (global.SystemIcons.render(name) || fallback) : fallback;
  }

  function render(target) {
    if (!target) return;

    const { accounts, movements, metrics, error } = resolveData();
    const total = Number(metrics?.patrimonioTotal ?? accounts.reduce((sum, account) => sum + getAccountBalance(account), 0));
    const recent = [...movements].slice(0, 8);

    target.innerHTML = `
      <header class="m2-header m2-page-header">
        <div>
          <h2 class="m2-title">Patrimônio</h2>
          <p class="m2-subtitle">Visão consolidada das contas</p>
        </div>
        <div class="m2-header-actions">
          <button class="m2-icon-btn" type="button" aria-label="Buscador universal" onclick="MobileV2.openUniversalSearch()">${renderHeaderIcon('search', '⌕')}</button>
          <button class="m2-icon-btn" type="button" aria-label="Internet Banking" onclick="MobileV2.openInternetBanking()">${renderHeaderIcon('internetBanking', '⌂')}</button>
          <button class="m2-icon-btn" type="button" aria-label="Notificações" onclick="toggleNotificationsPopover(event)">${renderHeaderIcon('notification', '◌')}</button>
          <button class="m2-icon-btn" type="button" aria-label="Perfil" onclick="MobileV2PerfilSheet.open()">${renderHeaderIcon('user', '◯')}</button>
        </div>
      </header>

      <section class="hero-card hero-card-wealth">
        <div class="hero-result-label">TOTAL PATRIMONIAL</div>
        <div class="hero-result">${formatMoney(total)}</div>
        <div class="hero-sub"><span>${error ? escapeHtml(error) : `${accounts.length} conta(s) acompanhada(s) pelo mesmo cálculo do PC`}</span></div>
      </section>

      <section class="m-list-card">
        <h3 class="m-list-title">Contas</h3>
        ${accounts.length ? `<div class="m2-patr-grid">${accounts.map((account) => {
          const name = String(account?.nome || account?.name || 'Conta');
          const type = String(account?.tipo || account?.type || '');
          const balance = getAccountBalance(account);
          const accountId = String(account?.id || '');
          return `
            <article class="m2-patr-account">
              <div class="m-item-surface static">
                ${renderAccountBadge(account)}
                <div class="m-item-info">
                  <span class="m-item-name">${escapeHtml(name)}</span>
                  ${type ? `<span class="m-item-meta">${escapeHtml(type)}</span>` : ''}
                </div>
                <span class="m-item-value ${balance >= 0 ? 'income' : ''}">${formatMoney(balance)}</span>
              </div>
              <div class="m2-patr-actions">
                <div class="m2-patr-action-row primary">
                  <button class="m2-patr-primary is-main" type="button" onclick="window.openPatrimonioMovementModal && window.openPatrimonioMovementModal({ accountId: '${accountId}', type: 'aporte' })">+</button>
                  <button class="m2-patr-primary" type="button" onclick="window.openPatrimonioMovementModal && window.openPatrimonioMovementModal({ accountId: '${accountId}', type: 'retirada' })">-</button>
                  <button class="m2-patr-primary" type="button" aria-label="Transferir" onclick="window.openPatrimonioMovementModal && window.openPatrimonioMovementModal({ accountId: '${accountId}', type: 'transferencia' })">${actionIcon('transfer', '&lt;&gt;')}</button>
                </div>
                <div class="m2-patr-action-row secondary">
                  <button type="button" onclick="window.openPatrimonioMovementModal && window.openPatrimonioMovementModal({ accountId: '${accountId}', type: 'atualizacao' })">Atualizar</button>
                  <button type="button" onclick="window.openPatrimonioAccountModal && window.openPatrimonioAccountModal('${accountId}')">Editar</button>
                  <button class="m2-patr-danger" type="button" onclick="window.deletePatrimonioAccount && window.deletePatrimonioAccount('${accountId}')">Excluir</button>
                </div>
              </div>
            </article>
          `;
        }).join('')}</div>` : '<div class="m2-empty">Nenhuma conta patrimonial cadastrada.</div>'}
        <div class="m2-list-actions">
          <button class="m2-chip-btn" type="button" onclick="window.openPatrimonioAccountModal && window.openPatrimonioAccountModal()">+ Nova conta</button>
        </div>
      </section>

      <section class="m-list-card">
        <h3 class="m-list-title">Movimentações recentes</h3>
        ${recent.length ? recent.map((movement) => {
          const type = String(movement?.type || 'aporte');
          const description = String(movement?.description || movement?.descricao || type);
          const date = String(movement?.date || movement?.data || 'Sem data');
          const accountName = String(movement?.accountName || movement?.conta || movement?.originAccountName || '').trim();
          const signedValue = movementAmount(movement);
          const icon = type === 'retirada'
            ? '-'
            : (type === 'transferencia' ? actionIcon('transfer', '&lt;&gt;') : '+');
          return `
            <article class="m-item m-item-income">
              <div class="m-item-surface static">
                <span class="m2-patr-movement-icon ${type === 'retirada' ? 'expense' : 'income'}">${icon}</span>
                <div class="m-item-info">
                  <span class="m-item-name">${escapeHtml(description)}</span>
                  <span class="m-item-meta m2-patr-movement-meta">${escapeHtml(formatDate(date))}${accountName ? ` · ${escapeHtml(accountName)}` : ''}</span>
                </div>
                <span class="m-item-value ${signedValue >= 0 ? 'income' : ''}">${formatMoney(signedValue)}</span>
                ${movement?.id ? `<button class="m2-icon-mini" type="button" onclick="window.openPatrimonioMovementModal && window.openPatrimonioMovementModal({ movementId: '${movement.id}' })" aria-label="Editar movimentação">✎</button>` : ''}
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

