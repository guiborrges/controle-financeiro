(function initMobileV2InternetBanking(global) {
  'use strict';

  const MOBILE_STATE = {
    view: 'credit',
    collapsed: {}
  };

  function escapeHtml(value) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function money(value) {
    if (typeof global.fmt === 'function') return global.fmt(Number(value || 0));
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function ensureWorkspace() {
    let mount = document.getElementById('mobileV2InternetBankingMount');
    if (mount) return mount;
    const host = document.getElementById('mobileV2OutflowFormBody');
    if (!host) return null;
    mount = document.createElement('div');
    mount.id = 'mobileV2InternetBankingMount';
    mount.className = 'mobile-v2-banking-mount';
    host.appendChild(mount);
    return mount;
  }

  function categoryOptions(current) {
    const options = (typeof global.getMonthCategoryOptions === 'function'
      ? (global.getMonthCategoryOptions(global.getCurrentMonth?.()?.id, global) || [])
      : []);
    const parsed = options.map((entry) => {
      if (entry && typeof entry === 'object') {
        return {
          value: String(entry.value || entry.id || entry.name || ''),
          label: String(entry.label || entry.name || entry.value || '')
        };
      }
      return { value: String(entry || ''), label: String(entry || '') };
    }).filter((entry) => entry.value);
    const fallback = parsed.length ? parsed : [{ value: '', label: 'Categoria' }];
    const head = '<option value="">Categoria</option>';
    const body = fallback
      .map((entry) => `<option value="${escapeHtml(entry.value)}" ${entry.value === current ? 'selected' : ''}>${escapeHtml(entry.label)}</option>`)
      .join('');
    return `${head}${body}`;
  }

  function tagOptions(current) {
    const tags = typeof global.getAllTags === 'function'
      ? global.getAllTags()
      : (global.BillImportUtils?.getAllTagsFromUserData?.(global.data || []) || []);
    const safeTags = Array.isArray(tags) ? tags : [];
    return ['<option value="">Sem tag</option>']
      .concat(safeTags.map((tag) => {
        const label = String(tag?.name || tag || '');
        return `<option value="${escapeHtml(label)}" ${label === current ? 'selected' : ''}>${escapeHtml(label)}</option>`;
      }))
      .join('');
  }

  function renderRows(group) {
    const isCredit = group.accountType === 'CREDIT';
    return (group.rows || []).map((row) => `
      <article class="m2-recent-item mobile-banking-row" data-account-id="${escapeHtml(group.accountId)}" data-tx-id="${escapeHtml(row.id)}">
        <div style="flex:1;min-width:0">
          <p class="m2-row-title">${escapeHtml(row.description || 'Lancamento')}</p>
          <span class="m2-row-meta">${escapeHtml(row.date || '--')}${row.time ? ` · ${escapeHtml(row.time)}` : ''}</span>
          <div class="mobile-banking-controls">
            ${isCredit ? `
              <select class="form-input mobile-banking-select" data-field="category">
                ${categoryOptions(row.category)}
              </select>
              <select class="form-input mobile-banking-select" data-field="tag">
                ${tagOptions(row.tag)}
              </select>
            ` : `
              <select class="form-input mobile-banking-select" data-field="movementType">
                <option value="aporte" ${row.movementType === 'aporte' ? 'selected' : ''}>Aporte</option>
                <option value="retirada" ${row.movementType === 'retirada' ? 'selected' : ''}>Retirada</option>
              </select>
            `}
          </div>
        </div>
        <div style="display:grid;gap:6px;justify-items:end">
          <span class="m2-row-amount negative">${escapeHtml(money(row.amount || 0))}</span>
          <div style="display:flex;gap:6px">
            <button type="button" class="m2-icon-mini" data-action="ok" title="Adicionar" aria-label="Adicionar">✓</button>
            <button type="button" class="m2-icon-mini" data-action="x" title="Ignorar" aria-label="Ignorar">✕</button>
          </div>
        </div>
      </article>
    `).join('');
  }

  function renderGroup(group) {
    const isCollapsed = MOBILE_STATE.collapsed[group.accountId] !== false;
    return `
      <section class="m-list-card mobile-banking-group" data-group-id="${escapeHtml(group.accountId)}">
        <button type="button" class="m-list-title mobile-banking-group-head" data-action="toggle">
          <span>${isCollapsed ? '▸' : '▾'} ${escapeHtml(group.accountName || 'Conta')}</span>
          <span>${group.pendingCount} pendente(s) · ${escapeHtml(money(group.totalPending || 0))}</span>
        </button>
        <div class="card-items-note">${escapeHtml(group.linkedLabel || 'Sem vinculo')} · Origem: ${escapeHtml(group.originName || group.accountName || '')}</div>
        ${isCollapsed ? '' : `
          <div class="mobile-banking-group-body">
            <div class="m2-list-actions">
              <button type="button" class="m2-chip-btn" data-action="all">Adicionar todos</button>
            </div>
            ${renderRows(group)}
          </div>
        `}
      </section>
    `;
  }

  function renderSnapshot(snapshot) {
    const mount = ensureWorkspace();
    if (!mount) return;
    const groups = MOBILE_STATE.view === 'bank'
      ? (snapshot?.views?.bank || [])
      : (snapshot?.views?.credit || []);
    const loadedAt = snapshot?.loadedAt
      ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(snapshot.loadedAt))
      : '--';
    mount.innerHTML = `
      <div class="period-selector" style="padding:0 0 10px">
        <button type="button" class="period-btn ${MOBILE_STATE.view === 'bank' ? 'active' : ''}" data-action="view-bank">Conta corrente</button>
        <button type="button" class="period-btn ${MOBILE_STATE.view === 'credit' ? 'active' : ''}" data-action="view-credit">Cartao</button>
      </div>
      <p class="m2-subtitle" style="padding:0 4px 8px">Ultima atualizacao: ${escapeHtml(loadedAt)}</p>
      ${groups.length ? groups.map(renderGroup).join('') : '<div class="m2-empty">Sem pendencias para revisao.</div>'}
    `;
    bindEvents(snapshot);
  }

  async function refresh(forceReload = false) {
    const mount = ensureWorkspace();
    if (!mount) return;
    mount.innerHTML = '<div class="m2-empty">Carregando dados...</div>';
    const snapshot = await global.PluggyBanking.getMobileSnapshot(!!forceReload);
    renderSnapshot(snapshot);
  }

  function bindEvents(snapshot) {
    const mount = ensureWorkspace();
    if (!mount) return;
    mount.querySelector('[data-action="view-bank"]')?.addEventListener('click', () => {
      MOBILE_STATE.view = 'bank';
      renderSnapshot(snapshot);
    });
    mount.querySelector('[data-action="view-credit"]')?.addEventListener('click', () => {
      MOBILE_STATE.view = 'credit';
      renderSnapshot(snapshot);
    });
    mount.querySelectorAll('.mobile-banking-group').forEach((groupNode) => {
      const accountId = String(groupNode.getAttribute('data-group-id') || '');
      groupNode.querySelector('[data-action="toggle"]')?.addEventListener('click', () => {
        MOBILE_STATE.collapsed[accountId] = !(MOBILE_STATE.collapsed[accountId] !== false);
        renderSnapshot(snapshot);
      });
      groupNode.querySelector('[data-action="all"]')?.addEventListener('click', async () => {
        global.PluggyBanking.addAll(accountId);
        await refresh(false);
      });
      groupNode.querySelectorAll('.mobile-banking-row').forEach((rowNode) => {
        const txId = String(rowNode.getAttribute('data-tx-id') || '');
        rowNode.querySelectorAll('.mobile-banking-select').forEach((selectNode) => {
          selectNode.addEventListener('change', () => {
            const field = String(selectNode.getAttribute('data-field') || '');
            global.PluggyBanking.updateField(accountId, txId, field, selectNode.value);
          });
        });
        rowNode.querySelector('[data-action="ok"]')?.addEventListener('click', async () => {
          global.PluggyBanking.addOne(accountId, txId);
          await refresh(false);
        });
        rowNode.querySelector('[data-action="x"]')?.addEventListener('click', async () => {
          global.PluggyBanking.dismiss(accountId, txId);
          await refresh(false);
        });
      });
    });
  }

  async function open() {
    if (global.MobileV2?.isEnabled?.() !== true) return;
    if (!global.PluggyBanking?.getMobileSnapshot) {
      global.MobileV2OutflowForm?.openInlineSheet?.({
        title: 'Internet Banking',
        subtitle: 'Pre-visualizacao indisponivel',
        body: '<div class="m2-empty">Nao foi possivel abrir os dados do Internet Banking agora.</div>'
      });
      return;
    }
    global.MobileV2OutflowForm?.openInlineSheet?.({
      title: 'Internet Banking',
      subtitle: 'Mostrando somente lancamentos pendentes',
      body: '<div id="mobileV2InternetBankingMount" class="mobile-v2-banking-mount"><div class="m2-empty">Carregando dados...</div></div>'
    });
    try {
      await refresh(true);
    } catch (error) {
      const mount = ensureWorkspace();
      if (mount) mount.innerHTML = `<div class="m2-empty">Falha ao carregar Internet Banking: ${escapeHtml(String(error?.message || 'erro desconhecido'))}</div>`;
    }
  }

  global.MobileV2InternetBanking = {
    open,
    refresh
  };
})(window);
