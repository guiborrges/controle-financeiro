(function initMobileV2InternetBanking(global) {
  'use strict';

  const MOBILE_STATE = {
    view: 'credit',
    collapsed: {}
  };
  let importBusy = false;
  let openingRevision = 0;

  function feedback(message, error = false) {
    const node = ensureShell().querySelector('[data-mib-feedback]');
    node.textContent = message;
    node.hidden = !message;
    node.setAttribute('role', error ? 'alert' : 'status');
  }

  function setImportBusy(value) {
    importBusy = value;
    const mount = ensureWorkspace();
    mount.setAttribute('aria-busy', String(value));
    mount.querySelectorAll('button, input, select').forEach(node => { node.disabled = value; });
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
    if (typeof global.MonthSelectionCatalog?.toVisualCategorySymbol === 'function') {
      return global.MonthSelectionCatalog.toVisualCategorySymbol(rawSymbol || '', categoryName || '', global);
    }
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
        (global.getMonthCategoryOptions(month?.id || month, global, { includeFallbackBase: false }) || []).forEach(pushEntry);
      } catch {}
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
        <p data-mib-feedback role="status" hidden></p>
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
    openingRevision++;
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
            <select class="mib-select mobile-banking-field" data-field="category" aria-label="Categoria">
              ${categoryOptions(row.category)}
            </select>
            <select class="mib-select mobile-banking-field" data-field="tag" aria-label="Tag">
              ${tagOptions(row.tag)}
            </select>
          </div>
        </div>
      ` : `
        <div class="mib-item-fields">
          <input class="mib-description-input mobile-banking-field" data-field="description" type="text" value="${escapeHtml(row.description || '')}" aria-label="Descrição do lançamento">
          <select class="mib-select mobile-banking-field" data-field="movementType" aria-label="Tipo de movimento">
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
          ${row.reviewReason ? `<div class="mib-item-fields"><small>${escapeHtml(row.reviewReason)}</small></div>` : ''}
          ${row.duplicateReason ? `<div class="mib-item-fields"><small>${escapeHtml(row.duplicateReason)}</small>
            <select class="mib-select mobile-banking-field" data-field="duplicateDecision" aria-label="Revisao de possivel duplicata">
              <option value="">Revisar antes de importar</option>
              <option value="new" ${row.duplicateDecision === 'new' ? 'selected' : ''}>Importar como nova</option>
            </select></div>` : ''}
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
        <button type="button" class="mib-group-header" data-action="toggle" aria-expanded="${!isCollapsed}">
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
      <p class="mib-destination">Mês de destino: ${escapeHtml(getCurrentMonth()?.nome || '')}</p>
      <div class="period-selector" style="padding:0 0 10px">
        <button type="button" class="period-btn ${MOBILE_STATE.view === 'bank' ? 'active' : ''}" data-action="view-bank">Conta corrente</button>
        <button type="button" class="period-btn ${MOBILE_STATE.view === 'credit' ? 'active' : ''}" data-action="view-credit">Cart\u00e3o</button>
      </div>
      <p class="m2-subtitle" style="padding:0 4px 8px">\u00daltima atualiza\u00e7\u00e3o: ${escapeHtml(loadedAt)}</p>
      ${groups.length ? groups.map(renderGroup).join('') : '<div class="m2-empty">Sem pend\u00eancias para revis\u00e3o.</div>'}
    `;
    bindEvents(snapshot);
    if (importBusy) setImportBusy(true);
  }

  async function refresh(forceReload = false) {
    const revision = openingRevision;
    const mount = ensureWorkspace();
    if (!mount) return;
    mount.innerHTML = '<div class="m2-empty">Carregando dados...</div>';
    const snapshot = await global.PluggyBanking.getMobileSnapshot(!!forceReload);
    if (revision !== openingRevision) return;
    renderSnapshot(snapshot);
  }

  async function refreshAfterSave(message) {
    feedback(message);
    try {
      await refresh(false);
    } catch {
      feedback(`${message} Não foi possível atualizar a lista. Feche e abra novamente para conferir.`, true);
    }
  }

  async function reconcileReopenedImport(result, revision) {
    if (revision === openingRevision) return false;
    const visible = !ensureShell().hidden;
    if (visible && (result?.status === 'saved' || result?.savedCount)) {
      try { await refresh(false); }
      catch { renderLoadError(); }
    }
    return true;
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
        if (importBusy) return;
        setImportBusy(true);
        feedback('Salvando lançamentos...');
        const revision = openingRevision;
        try {
          const result = await global.PluggyBanking.addAll(accountId);
          if (await reconcileReopenedImport(result, revision)) return;
          if (result?.status !== 'saved') {
            if (result?.savedCount) await refresh(false);
            feedback(`${Number(result?.savedCount || 0)} lançamento(s) confirmado(s). Salvamento não confirmado para os demais itens. Confira as pendências antes de tentar novamente.`, true);
            return;
          }
          await refreshAfterSave('Lançamentos adicionados com sucesso.');
          global.triggerHapticFeedback?.('successStrong');
        } catch (error) {
          global.triggerHapticFeedback?.('error');
          global.showAppStatus?.(error?.message || 'Não foi possível adicionar os lançamentos.', 'Internet Banking', 'error');
          feedback('Não foi possível confirmar os lançamentos. Tente novamente.', true);
        } finally {
          setImportBusy(false);
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
          if (importBusy) return;
          setImportBusy(true);
          feedback('Salvando lançamento...');
          const revision = openingRevision;
          try {
            const result = await global.PluggyBanking.addOne(accountId, txId);
            if (await reconcileReopenedImport(result, revision)) return;
            if (result?.status !== 'saved') {
              feedback('Salvamento não confirmado. Confira a pendência antes de tentar novamente.', true);
              return;
            }
            await refreshAfterSave('Lançamento adicionado com sucesso.');
            global.triggerHapticFeedback?.('confirm');
          } catch (error) {
            global.triggerHapticFeedback?.('error');
            global.showAppStatus?.(error?.message || 'Não foi possível adicionar o lançamento.', 'Internet Banking', 'error');
            feedback('Não foi possível confirmar o lançamento. Tente novamente.', true);
          } finally {
            setImportBusy(false);
          }
        });
        rowNode.querySelector('[data-action="x"]')?.addEventListener('click', async () => {
          if (importBusy) return;
          const revision = openingRevision;
          setImportBusy(true); feedback('Ignorando lançamento...');
          try {
            await global.PluggyBanking.dismiss(accountId, txId);
            if (revision !== openingRevision) {
              if (!ensureShell().hidden) await refresh(false);
              return;
            }
            await refreshAfterSave('Lançamento ignorado da revisão.');
          } catch {
            if (revision === openingRevision) feedback('Não foi possível ignorar o lançamento. Tente novamente.', true);
            global.triggerHapticFeedback?.('error');
          } finally { setImportBusy(false); }
        });
      });
    });
  }

  async function open() {
    if (global.MobileV2?.isEnabled?.() !== true) return;
    const revision = ++openingRevision;
    showShell('Verificando conexão...');
    feedback('');
    ensureWorkspace().innerHTML = '<div class="m2-empty">Carregando Internet Banking...</div>';
    let connected = true;
    try {
      const response = await fetch('/api/pluggy/connection', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error('Connection unavailable');
      connected = response.ok && payload?.connected === true;
    } catch {
      if (revision !== openingRevision) return;
      renderLoadError();
      return;
    }
    if (revision !== openingRevision) return;
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
      if (mount && revision === openingRevision) renderLoadError();
    }
  }

  function renderLoadError() {
    const mount = ensureWorkspace();
    mount.innerHTML = '<div class="m2-empty" role="alert">Não foi possível carregar o Internet Banking.</div><button type="button" class="mib-btn-add-all" data-mib-retry>Tentar novamente</button>';
    mount.querySelector('[data-mib-retry]').addEventListener('click', open);
  }

  global.MobileV2InternetBanking = {
    open,
    close,
    refresh
  };
})(window);
