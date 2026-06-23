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
      .mib-shell { position:fixed; inset:0; z-index:760; display:flex; align-items:flex-end; background:rgba(15,23,42,.34); }
      .mib-shell[hidden] { display:none !important; }
      .mib-shell-panel { width:100%; height:min(94dvh,900px); display:flex; flex-direction:column; overflow:hidden; border-radius:24px 24px 0 0; background:var(--bg,#f4f7fb); padding-bottom:env(safe-area-inset-bottom,0px); }
      .mib-shell-header { min-height:66px; display:grid; grid-template-columns:44px minmax(0,1fr) 44px; align-items:center; gap:10px; flex:0 0 auto; padding:10px 16px 8px; border-bottom:1px solid var(--border,#e5e7eb); background:color-mix(in srgb,var(--bg,#f4f7fb) 94%,transparent); backdrop-filter:blur(14px); }
      .mib-shell-close { width:40px; height:40px; display:grid; place-items:center; border:1px solid var(--border,#e5e7eb); border-radius:14px; background:var(--surface-strong,#fff); color:var(--text1,#111827); font-size:22px; }
      .mib-shell-heading { min-width:0; text-align:center; }
      .mib-shell-title { display:block; font-size:18px; font-weight:800; letter-spacing:-.025em; }
      .mib-shell-subtitle { display:block; margin-top:2px; color:var(--text3,#9ca3af); font-size:10px; }
      .mib-shell-content { min-height:0; flex:1 1 auto; overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; padding:12px 12px 24px; }
      .mib-description-input { width:100%; height:36px; border:1px solid color-mix(in srgb,var(--border,#e5e7eb) 86%,transparent); border-radius:12px; background:var(--surface-strong,#fff); color:var(--text1,#111827); padding:0 10px; font-size:13px; font-weight:700; }
      .mib-item-fields { display:grid; gap:8px; }
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

  function ensureShell() {
    let shell = document.getElementById('mobileV2InternetBankingSheet');
    if (shell) return shell;
    shell = document.createElement('div');
    shell.id = 'mobileV2InternetBankingSheet';
    shell.className = 'mib-shell';
    shell.setAttribute('hidden', 'hidden');
    shell.innerHTML = `
      <section class="mib-shell-panel" role="dialog" aria-modal="true" aria-labelledby="mobileV2InternetBankingTitle">
        <header class="mib-shell-header">
          <button class="mib-shell-close" type="button" aria-label="Fechar Internet Banking" data-mib-close>&times;</button>
          <div class="mib-shell-heading"><strong class="mib-shell-title" id="mobileV2InternetBankingTitle">Internet Banking</strong><span class="mib-shell-subtitle" id="mobileV2InternetBankingSubtitle">Somente lançamentos pendentes</span></div>
          <span aria-hidden="true"></span>
        </header>
        <div class="mib-shell-content" id="mobileV2InternetBankingMount"></div>
      </section>`;
    shell.querySelector('[data-mib-close]')?.addEventListener('click', close);
    document.body.appendChild(shell);
    return shell;
  }

  function showShell(subtitle = 'Somente lançamentos pendentes') {
    const shell = ensureShell();
    const subtitleNode = shell.querySelector('#mobileV2InternetBankingSubtitle');
    if (subtitleNode) subtitleNode.textContent = subtitle;
    shell.style.display = '';
    shell.removeAttribute('hidden');
    document.body.classList.add('mobile-v2-sheet-open');
    global.triggerHapticFeedback?.('light');
    return shell;
  }

  function close() {
    const shell = document.getElementById('mobileV2InternetBankingSheet');
    if (!shell) return;
    shell.setAttribute('hidden', 'hidden');
    document.body.classList.remove('mobile-v2-sheet-open');
    global.triggerHapticFeedback?.('light');
    global.MobileV2?.refresh?.();
  }

  function ensureWorkspace() {
    let mount = document.getElementById('mobileV2InternetBankingMount');
    if (mount) return mount;
    const host = ensureShell()?.querySelector('.mib-shell-content');
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
          <input class="mib-description-input mobile-banking-field" data-field="description" type="text" value="${escapeHtml(row.description || '')}" aria-label="Descrição do lançamento">
          <div class="mib-field-pair">
            <select class="mib-select mobile-banking-field" data-field="category">
              ${categoryOptions(row.category)}
            </select>
            <select class="mib-select mobile-banking-field" data-field="tag">
              ${tagOptions(row.tag)}
            </select>
          </div>
        </div>
      ` : `
        <div class="mib-item-fields">
          <input class="mib-description-input mobile-banking-field" data-field="description" type="text" value="${escapeHtml(row.description || '')}" aria-label="Descrição do lançamento">
          <select class="mib-select mobile-banking-field" data-field="movementType">
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
        try {
          await global.PluggyBanking.addAll(accountId);
          await refresh(false);
          global.triggerHapticFeedback?.('successStrong');
        } catch (error) {
          global.triggerHapticFeedback?.('error');
          global.showAppStatus?.(error?.message || 'Não foi possível adicionar os lançamentos.', 'Internet Banking', 'error');
        }
      });
      groupNode.querySelectorAll('.mobile-banking-row').forEach((rowNode) => {
        const txId = String(rowNode.getAttribute('data-tx-id') || '');
        rowNode.querySelectorAll('.mobile-banking-field').forEach((fieldNode) => {
          fieldNode.addEventListener('change', () => {
            const field = String(fieldNode.getAttribute('data-field') || '');
            global.PluggyBanking.updateField(accountId, txId, field, fieldNode.value);
          });
        });
        rowNode.querySelector('[data-action="ok"]')?.addEventListener('click', async () => {
          try {
            await global.PluggyBanking.addOne(accountId, txId);
            await refresh(false);
            global.triggerHapticFeedback?.('confirm');
          } catch (error) {
            global.triggerHapticFeedback?.('error');
            global.showAppStatus?.(error?.message || 'Não foi possível adicionar o lançamento.', 'Internet Banking', 'error');
          }
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
    showShell('Verificando conexão...');
    ensureWorkspace().innerHTML = '<div class="m2-empty">Carregando Internet Banking...</div>';
    let connected = true;
    try {
      const response = await fetch('/api/pluggy/connection', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      const payload = await response.json().catch(() => ({}));
      connected = response.ok && payload?.connected === true;
    } catch {
      connected = false;
    }
    if (!connected) {
      showShell('Conecte suas instituições para importar movimentações');
      ensureWorkspace().innerHTML = '<div class="m2-empty m2-empty-rich"><button type="button" class="m2-chip-btn positive" id="mobileV2ConnectBanking">Conectar Internet Banking</button></div>';
      requestAnimationFrame(() => {
        document.getElementById('mobileV2ConnectBanking')?.addEventListener('click', () => {
          close();
          if (typeof global.openInternetBankingHub === 'function') global.openInternetBankingHub();
        });
      });
      return;
    }
    if (!global.PluggyBanking?.getMobileSnapshot) {
      showShell('Pr\u00e9-visualiza\u00e7\u00e3o indispon\u00edvel');
      ensureWorkspace().innerHTML = '<div class="m2-empty">N\u00e3o foi poss\u00edvel abrir os dados do Internet Banking agora.</div>';
      return;
    }
    showShell('Mostrando somente lan\u00e7amentos pendentes');
    ensureWorkspace().innerHTML = '<div class="m2-empty">Carregando dados...</div>';
    try {
      await refresh(true);
    } catch (error) {
      global.triggerHapticFeedback?.('error');
      const mount = ensureWorkspace();
      if (mount) mount.innerHTML = `<div class="m2-empty">Falha ao carregar Internet Banking: ${escapeHtml(String(error?.message || 'erro desconhecido'))}</div>`;
    }
  }

  global.MobileV2InternetBanking = {
    open,
    close,
    refresh
  };
})(window);
