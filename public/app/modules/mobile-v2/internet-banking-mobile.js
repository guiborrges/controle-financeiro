(function initMobileV2InternetBanking(global) {
  'use strict';

  const MOBILE_STATE = {
    view: 'credit',
    collapsed: {}
  };

  function injectMibStyles() {
    if (document.getElementById('mib-styles')) return;
    const style = document.createElement('style');
    style.id = 'mib-styles';
    style.textContent = `
      .mib-group {
        background: var(--surface-strong, #fff);
        border: 1px solid color-mix(in srgb, var(--border, #e5e7eb) 82%, transparent);
        border-radius: 20px;
        margin: 0 0 12px;
        overflow: hidden;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.58), 0 14px 30px rgba(15, 23, 42, 0.06);
      }
      .mib-group-header {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 11px;
        padding: 13px 14px 12px;
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: left;
        -webkit-tap-highlight-color: transparent;
      }
      .mib-group-header:active { background: var(--surface2, #f3f4f6); }
      .mib-group-header-left {
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 0;
      }
      .mib-group-chevron {
        flex-shrink: 0;
        color: var(--text3, #9ca3af);
        transition: transform 0.2s;
      }
      .mib-group-chevron--open { transform: rotate(90deg); }
      .mib-group-name {
        display: block;
        font-size: 14px;
        font-weight: 800;
        color: var(--text1, #111827);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 172px;
        letter-spacing: -0.02em;
      }
      .mib-group-origin {
        display: block;
        font-size: 10px;
        color: var(--text3, #9ca3af);
        margin-top: 3px;
        text-transform: uppercase;
        letter-spacing: .055em;
      }
      .mib-group-summary {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        flex-shrink: 0;
      }
      .mib-group-count {
        font-size: 10px;
        color: var(--accent, #2471a3);
        font-weight: 800;
        letter-spacing: .055em;
        text-transform: uppercase;
      }
      .mib-group-total {
        font-size: 15px;
        font-weight: 800;
        color: var(--text1, #111827);
        margin-top: 2px;
        letter-spacing: -0.02em;
      }
      .mib-group-body { border-top: 1px solid var(--border, #e5e7eb); }
      .mib-group-actions { padding: 10px 14px 6px; }
      .mib-btn-add-all {
        height: 34px;
        padding: 0 14px;
        border-radius: 17px;
        border: 1px solid color-mix(in srgb, var(--border, #e5e7eb) 78%, transparent);
        background: color-mix(in srgb, var(--surface-strong, #fff) 92%, transparent);
        font-size: 11px;
        font-weight: 800;
        color: var(--text2, #374151);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.55);
      }
      .mib-btn-add-all:active { background: var(--surface2, #f3f4f6); }
      .mib-item { border-top: 1px solid var(--border, #e5e7eb); }
      .mib-item-main {
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 12px 14px 10px;
        min-height: 56px;
      }
      .mib-item-icon {
        width: 34px;
        height: 34px;
        border-radius: 11px;
        background: color-mix(in srgb, var(--surface2, #f3f4f6) 82%, var(--surface-strong, #fff));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        flex-shrink: 0;
        color: var(--text2, #374151);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.62);
      }
      .mib-item-icon--placeholder { color: var(--text3, #9ca3af); }
      .mib-item-body { flex: 1; min-width: 0; }
      .mib-item-name {
        display: block;
        font-size: 13px;
        font-weight: 800;
        color: var(--text1, #111827);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        letter-spacing: -0.01em;
      }
      .mib-item-meta {
        display: block;
        font-size: 10px;
        color: var(--text3, #9ca3af);
        margin-top: 3px;
        letter-spacing: .05em;
        text-transform: uppercase;
        line-height: 1.2;
      }
      .mib-item-cat { color: var(--accent, #2471a3); font-weight: 700; }
      .mib-item-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        flex-shrink: 0;
      }
      .mib-item-amount {
        font-size: 15px;
        font-weight: 800;
        color: var(--red, #e74c3c);
        letter-spacing: -0.02em;
      }
      .mib-item-actions { display: flex; gap: 6px; }
      .mib-btn-ok, .mib-btn-dismiss {
        width: 31px;
        height: 31px;
        border-radius: 11px;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.45);
      }
      .mib-btn-ok { background: #eafaf1; color: #1e8449; }
      .mib-btn-ok:active { background: #d5f5e3; }
      .mib-btn-dismiss { background: #fdedec; color: #c0392b; }
      .mib-btn-dismiss:active { background: #fadbd8; }
      .mib-item-fields { padding: 0 14px 12px 59px; }
      .mib-field-pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .mib-select {
        width: 100%;
        height: 36px;
        border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--border, #e5e7eb) 86%, transparent);
        background: color-mix(in srgb, var(--surface-strong, #fff) 96%, transparent);
        font-size: 11px;
        color: var(--text1, #111827);
        padding: 0 10px;
        appearance: auto;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.56);
      }
      .m2-empty {
        padding: 24px 16px;
        text-align: center;
        font-size: 13px;
        color: var(--text3, #9ca3af);
      }
      .m2-subtitle { font-size: 12px; color: var(--text3, #9ca3af); }
    `;
    document.head.appendChild(style);
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

  function money(value) {
    if (global.MobileV2Data?.formatMoney) return global.MobileV2Data.formatMoney(value);
    if (typeof global.fmt === 'function') return global.fmt(Number(value || 0));
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function getCurrentMonth() {
    if (typeof global.getCurrentMonthData === 'function') return global.getCurrentMonthData();
    if (typeof global.getCurrentMonth === 'function') return global.getCurrentMonth();
    return null;
  }

  function stripCategoryName(value) {
    if (typeof global.PluggyBanking?.stripLegacyCategoryIconPrefix === 'function') {
      return global.PluggyBanking.stripLegacyCategoryIconPrefix(value);
    }
    return String(value || '')
      .replace(/^(food|phone|shopping|education|card|fun|market|home|tag|health|transport|car|service)\s+/i, '')
      .trim();
  }

  function categorySymbol(rawSymbol, categoryName) {
    if (typeof global.PluggyBanking?.toVisualCategorySymbol === 'function') {
      return global.PluggyBanking.toVisualCategorySymbol(rawSymbol || '', categoryName || '');
    }
    if (typeof global.getCategoryEmoji === 'function') return global.getCategoryEmoji(categoryName || '') || '';
    return rawSymbol || '';
  }

  function normalizeCategoryEntry(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      const name = stripCategoryName(entry);
      return name ? { name, symbol: categorySymbol('', name) } : null;
    }
    const name = stripCategoryName(entry.name || entry.label || entry.value || entry.id || '');
    if (!name) return null;
    return {
      name,
      symbol: categorySymbol(entry.symbol || entry.emoji || entry.icon || '', name)
    };
  }

  function getMobileCategoryEntries() {
    const month = getCurrentMonth();
    const entries = [];
    const seen = new Set();
    const pushEntry = (entry) => {
      const normalized = normalizeCategoryEntry(entry);
      if (!normalized?.name) return;
      const key = normalized.name.toLocaleLowerCase('pt-BR');
      if (seen.has(key)) return;
      seen.add(key);
      entries.push(normalized);
    };

    if (typeof global.getMonthCategoryOptions === 'function') {
      try {
        (global.getMonthCategoryOptions(month?.id, global) || []).forEach(pushEntry);
      } catch {}
    }

    if (!entries.length && typeof global.getSelectableCategoryEntriesForMonth === 'function') {
      try {
        (global.getSelectableCategoryEntriesForMonth(month, { includeFallbackBase: false }) || []).forEach(pushEntry);
      } catch {}
    }

    if (!entries.length && global.BillImportUtils?.getAllCategoriesFromUserData) {
      try {
        (global.BillImportUtils.getAllCategoriesFromUserData(global.data || [])?.list || []).forEach(pushEntry);
      } catch {}
    }

    if (!entries.length && month?.categorias && typeof month.categorias === 'object') {
      Object.keys(month.categorias).forEach(pushEntry);
    }

    if (!entries.length) {
      ['ALIMENTAÇÃO', 'MERCADO', 'MORADIA', 'TRANSPORTE', 'SAÚDE', 'LAZER', 'OUTROS'].forEach(pushEntry);
    }

    return entries;
  }

  function hasUsableCategoryOptions(html) {
    const wrap = document.createElement('select');
    wrap.innerHTML = String(html || '');
    return Array.from(wrap.options || []).some((option) => String(option.value || '').trim());
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
    if (typeof global.PluggyBanking?.getCategoryOptionsHtml === 'function') {
      const html = global.PluggyBanking.getCategoryOptionsHtml(current);
      if (hasUsableCategoryOptions(html)) return html;
    }
    const selected = stripCategoryName(current || '');
    const options = getMobileCategoryEntries();
    const selectedKey = selected.toLocaleLowerCase('pt-BR');
    const hasSelected = selected && options.some((entry) => entry.name.toLocaleLowerCase('pt-BR') === selectedKey);
    const rows = options.map((entry) => {
      const label = entry.symbol ? `${entry.symbol} ${entry.name}` : entry.name;
      return `<option value="${escapeHtml(entry.name)}" ${entry.name.toLocaleLowerCase('pt-BR') === selectedKey ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    });
    if (selected && !hasSelected) {
      rows.unshift(`<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`);
    }
    return `<option value="" ${selected ? '' : 'selected'}>Categoria</option>${rows.join('')}`;
  }

  function tagOptions(current) {
    if (typeof global.PluggyBanking?.getTagOptionsHtml === 'function') {
      return global.PluggyBanking.getTagOptionsHtml(current);
    }
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
    return (group.rows || []).map((row) => {
      const catIcon = global.MobileV2Data?.categoryIcon
        ? global.MobileV2Data.categoryIcon(row.category || '')
        : (typeof global.getCategoryIcon === 'function' ? escapeHtml(global.getCategoryIcon(row.category || '')) : '');
      const iconHtml = catIcon
        ? `<div class="mib-item-icon" aria-hidden="true">${catIcon}</div>`
        : `<div class="mib-item-icon mib-item-icon--placeholder" aria-hidden="true">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <rect x="2" y="5" width="20" height="14" rx="2"></rect>
               <line x1="2" y1="10" x2="22" y2="10"></line>
             </svg>
           </div>`;
      const catLabel = row.category || '';
      const fields = isCredit ? `
        <div class="mib-item-fields">
          <div class="mib-field-pair">
            <select class="mib-select mobile-banking-select" data-field="category">
              ${categoryOptions(row.category)}
            </select>
            <select class="mib-select mobile-banking-select" data-field="tag">
              ${tagOptions(row.tag)}
            </select>
          </div>
        </div>
      ` : `
        <div class="mib-item-fields">
          <select class="mib-select mobile-banking-select" data-field="movementType">
            <option value="aporte" ${row.movementType === 'aporte' ? 'selected' : ''}>Aporte</option>
            <option value="retirada" ${row.movementType === 'retirada' ? 'selected' : ''}>Retirada</option>
          </select>
        </div>
      `;

      return `
        <article class="mib-item mobile-banking-row" data-account-id="${escapeHtml(group.accountId)}" data-tx-id="${escapeHtml(row.id)}">
          <div class="mib-item-main">
            ${iconHtml}
            <div class="mib-item-body">
              <span class="mib-item-name">${escapeHtml(row.description || 'Lan\u00e7amento')}</span>
              <span class="mib-item-meta">
                ${escapeHtml(row.date || '--')}${row.time ? ` \u00b7 ${escapeHtml(row.time)}` : ''}${catLabel ? ` \u00b7 <span class="mib-item-cat">${escapeHtml(catLabel)}</span>` : ''}
              </span>
            </div>
            <div class="mib-item-right">
              <span class="mib-item-amount">${escapeHtml(money(row.amount || 0))}</span>
              <div class="mib-item-actions">
                <button type="button" class="mib-btn-ok" data-action="ok" title="Adicionar" aria-label="Adicionar lan\u00e7amento">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </button>
                <button type="button" class="mib-btn-dismiss" data-action="x" title="Ignorar" aria-label="Ignorar lan\u00e7amento">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          ${fields}
        </article>
      `;
    }).join('');
  }

  function renderGroup(group) {
    const isCollapsed = MOBILE_STATE.collapsed[group.accountId] !== false;
    const originLabel = group.linkedLabel && group.linkedLabel !== 'Sem v\u00ednculo'
      ? group.linkedLabel
      : (group.originName || group.accountName || '');

    return `
      <section class="mib-group mobile-banking-group" data-group-id="${escapeHtml(group.accountId)}">
        <button type="button" class="mib-group-header" data-action="toggle">
          <div class="mib-group-header-left">
            <svg class="mib-group-chevron ${isCollapsed ? '' : 'mib-group-chevron--open'}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <div>
              <span class="mib-group-name">${escapeHtml(group.accountName || 'Conta')}</span>
              ${originLabel ? `<span class="mib-group-origin">${escapeHtml(originLabel)}</span>` : ''}
            </div>
          </div>
          <div class="mib-group-summary">
            <span class="mib-group-count">${group.pendingCount} pendente${group.pendingCount !== 1 ? 's' : ''}</span>
            <span class="mib-group-total">${escapeHtml(money(group.totalPending || 0))}</span>
          </div>
        </button>
        ${isCollapsed ? '' : `
          <div class="mib-group-body">
            <div class="mib-group-actions">
              <button type="button" class="mib-btn-add-all" data-action="all">Adicionar todos (${group.pendingCount})</button>
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
        <button type="button" class="period-btn ${MOBILE_STATE.view === 'credit' ? 'active' : ''}" data-action="view-credit">Cart\u00e3o</button>
      </div>
      <p class="m2-subtitle" style="padding:0 4px 8px">\u00daltima atualiza\u00e7\u00e3o: ${escapeHtml(loadedAt)}</p>
      ${groups.length ? groups.map(renderGroup).join('') : '<div class="m2-empty">Sem pend\u00eancias para revis\u00e3o.</div>'}
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
    injectMibStyles();
    if (global.MobileV2?.isEnabled?.() !== true) return;
    if (!global.PluggyBanking?.getMobileSnapshot) {
      global.MobileV2OutflowForm?.openInlineSheet?.({
        title: 'Internet Banking',
        subtitle: 'Pr\u00e9-visualiza\u00e7\u00e3o indispon\u00edvel',
        body: '<div class="m2-empty">N\u00e3o foi poss\u00edvel abrir os dados do Internet Banking agora.</div>'
      });
      return;
    }
    global.MobileV2OutflowForm?.openInlineSheet?.({
      title: 'Internet Banking',
      subtitle: 'Mostrando somente lan\u00e7amentos pendentes',
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
