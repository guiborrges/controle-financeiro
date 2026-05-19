(function initMobileV2Patrimonio(global) {
  'use strict';

  function formatMoney(value) {
    if (typeof global.fmt === 'function') return global.fmt(Number(value || 0));
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function render(target) {
    if (!target) return;
    const accounts = Array.isArray(global.patrimonioAccounts) ? global.patrimonioAccounts : [];
    const movements = Array.isArray(global.patrimonioMovements) ? global.patrimonioMovements : [];
    const total = accounts.reduce((sum, acc) => sum + Number(acc?.balance || acc?.saldoAtual || acc?.initialBalance || 0), 0);
    const recent = [...movements].slice(-5).reverse();

    target.innerHTML = `
      <div class="m2-header">
        <div>
          <h2 class="m2-title">Patrimônio</h2>
          <p class="m2-subtitle">Visão consolidada das contas</p>
        </div>
        <div class="m2-header-actions">
          <button class="m2-icon-btn" type="button" onclick="toggleNotificationsPopover(event)">${global.SystemIcons?.render ? global.SystemIcons.render('notification') : '🔔'}</button>
          <button class="m2-icon-btn" type="button" onclick="MobileV2PerfilSheet.open()">${global.SystemIcons?.render ? global.SystemIcons.render('user') : '👤'}</button>
        </div>
      </div>

      <section class="hero-result-card" style="background:linear-gradient(135deg,#1f6f4a 0%,#245a4a 100%)">
        <div class="hero-result-label">Total patrimonial</div>
        <div class="hero-result-value">${formatMoney(total)}</div>
      </section>

      <section class="m2-card">
        <h3 class="m2-card-title">Contas</h3>
        ${accounts.length ? accounts.map((acc) => {
          const name = String(acc?.name || acc?.nome || 'Conta');
          const value = Number(acc?.balance || acc?.saldoAtual || acc?.initialBalance || 0);
          const icon = acc?.icon || acc?.symbol || '🏦';
          return `
            <article class="m2-recent-item">
              <span class="m2-icon-pill">${icon}</span>
              <span><p class="m2-row-title">${global.escapeHtml ? global.escapeHtml(name) : name}</p></span>
              <span class="m2-row-amount ${value >= 0 ? 'positive' : 'negative'}">${formatMoney(value)}</span>
            </article>
          `;
        }).join('') : '<p style="color:var(--text3);font-size:12px">Nenhuma conta patrimonial cadastrada.</p>'}
        <button class="m2-chip-btn" type="button" onclick="openPatrimonioAccountModal?.()">+ Nova conta</button>
      </section>

      <section class="m2-card">
        <h3 class="m2-card-title">Movimentações recentes</h3>
        ${recent.length ? recent.map((mv) => {
          const type = String(mv?.type || 'aporte');
          const desc = String(mv?.description || mv?.descricao || type);
          const val = Number(mv?.value || mv?.valor || 0);
          const date = String(mv?.date || mv?.data || '');
          return `
            <article class="m2-recent-item">
              <span class="m2-icon-pill">${type === 'retirada' ? '↘' : '↗'}</span>
              <span>
                <p class="m2-row-title">${global.escapeHtml ? global.escapeHtml(desc) : desc}</p>
                <span class="m2-row-meta">${global.escapeHtml ? global.escapeHtml(date) : date}</span>
              </span>
              <span class="m2-row-amount ${type === 'retirada' ? 'negative' : 'positive'}">${formatMoney(Math.abs(val))}</span>
            </article>
          `;
        }).join('') : '<p style="color:var(--text3);font-size:12px">Sem movimentações recentes.</p>'}
      </section>
    `;
  }

  global.MobileV2Patrimonio = { render };
})(window);
