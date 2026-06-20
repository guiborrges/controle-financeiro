(function initMobileV2OutflowForm(global) {
  'use strict';
  const { escapeHtml } = global.MobileV2Data;

  const MODE_LABEL = {
    launch: 'Lançamento',
    renda: 'Renda',
    recurring: 'Lançamento recorrente',
    installment: 'Lançamento parcelado',
    shared: 'Lançamento compartilhado'
  };

  function formatDateDefault() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function toNativeDateValue(rawValue) {
    const value = String(rawValue || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (!match) return formatDateDefault();
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
  }

  function parseMoneyInput(rawValue) {
    const normalized = String(rawValue || '').trim();
    if (!normalized) return 0;
    const cleaned = normalized.replace(/[^0-9.,]/g, '');
    if (!cleaned) return 0;
    const hasComma = cleaned.includes(',');
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (hasComma && lastDot > lastComma) {
      return Number.parseFloat(cleaned.replace(/,/g, '')) || 0;
    }
    return Number.parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }

  function bindMoneyMask() {
    const amountInput = document.getElementById('mobileV2OutflowAmount');
    if (!amountInput || amountInput.dataset.maskBound === '1') return;
    amountInput.dataset.maskBound = '1';
    amountInput.addEventListener('input', (event) => {
      const target = event.target;
      if (!target) return;
      let value = String(target.value || '').replace(/[^0-9.,]/g, '');
      const firstSeparator = value.search(/[.,]/);
      if (firstSeparator >= 0) {
        const head = value.slice(0, firstSeparator + 1);
        const tail = value.slice(firstSeparator + 1).replace(/[.,]/g, '');
        value = head + tail;
      }
      target.value = value;
    });
  }

  function getCurrentMonth() {
    return typeof global.getCurrentMonth === 'function' ? global.getCurrentMonth() : null;
  }

  function resolveCategories(month) {
    if (typeof global.getMonthCategoryOptions === 'function') {
      try {
        const options = global.getMonthCategoryOptions(month?.id, global) || [];
        if (Array.isArray(options) && options.length) {
          return options.map((entry) => {
            if (entry && typeof entry === 'object') {
              return {
                value: String(entry.value || entry.id || entry.name || ''),
                label: String(entry.label || entry.name || entry.value || ''),
                icon: String(entry.icon || entry.symbol || '')
              };
            }
            return { value: String(entry), label: String(entry), icon: '' };
          }).filter((entry) => entry.value && entry.label);
        }
      } catch {}
    }

    const fallback = [];
    const monthCategories = month?.categorias && typeof month.categorias === 'object'
      ? Object.keys(month.categorias)
      : [];

    monthCategories.forEach((category) => {
      const resolved = String(global.resolveCategoryName ? global.resolveCategoryName(category) : category).trim();
      if (!resolved) return;
      if (fallback.some((entry) => entry.value === resolved)) return;
      fallback.push({
        value: resolved,
        label: resolved,
        icon: typeof global.getCategoryEmoji === 'function' ? global.getCategoryEmoji(resolved) : ''
      });
    });

    if (!fallback.length) {
      ['ALIMENTAÇÃO', 'MERCADO', 'MORADIA', 'TRANSPORTE', 'SAÚDE', 'LAZER', 'OUTROS'].forEach((entry) => {
        fallback.push({ value: entry, label: entry, icon: typeof global.getCategoryEmoji === 'function' ? global.getCategoryEmoji(entry) : '' });
      });
    }

    return fallback;
  }

  function resolveOutputOptions(month) {
    const options = [
      { value: 'method:pix', label: 'Pix' },
      { value: 'method:debito', label: 'Débito' },
      { value: 'method:dinheiro', label: 'Dinheiro' },
      { value: 'method:boleto', label: 'Boleto' }
    ];
    const cards = Array.isArray(month?.outflowCards) ? month.outflowCards : [];
    cards.forEach((card) => {
      const cardId = String(card?.id || '').trim();
      if (!cardId) return;
      options.push({ value: `card:${cardId}`, label: String(card?.name || 'Cartão') });
    });
    return options;
  }

  function ensureSheet() {
    if (global.MobileV2?.isEnabled?.() !== true) return null;
    let root = document.getElementById('mobileV2OutflowSheet');
    if (root) return root;

    root = document.createElement('div');
    root.id = 'mobileV2OutflowSheet';
    root.className = 'bottom-sheet';
    root.innerHTML = `
      <button class="bottom-sheet-scrim" type="button" aria-label="Fechar"></button>
      <div class="bottom-sheet-panel form-sheet" role="dialog" aria-modal="true" aria-label="Formulário de lançamento">
        <div class="bottom-sheet-grip"></div>
        <div id="mobileV2OutflowFormBody"></div>
      </div>
    `;

    document.body.appendChild(root);
    root.querySelector('.bottom-sheet-scrim')?.addEventListener('click', close);
    const panel = root.querySelector('.bottom-sheet-panel');
    let dragStartY = 0;
    let dragCurrentY = 0;
    panel?.addEventListener('touchstart', (event) => {
      dragStartY = Number(event.touches?.[0]?.clientY || 0);
      dragCurrentY = dragStartY;
    }, { passive: true });
    panel?.addEventListener('touchmove', (event) => {
      dragCurrentY = Number(event.touches?.[0]?.clientY || dragStartY);
    }, { passive: true });
    panel?.addEventListener('touchend', () => {
      if ((dragCurrentY - dragStartY) > 88) close();
    });
    root.setAttribute('hidden', 'hidden');
    root.style.display = 'none';

    return root;
  }

  function renderForm(mode) {
    const month = getCurrentMonth();
    const categories = resolveCategories(month);
    const outputs = resolveOutputOptions(month);
    const body = document.getElementById('mobileV2OutflowFormBody');
    if (!body) return;

    const optionsHtml = categories.map((entry) => {
      const icon = entry.icon ? `${escapeHtml(entry.icon)} ` : '';
      return `<option value="${escapeHtml(entry.value)}">${icon}${escapeHtml(entry.label)}</option>`;
    }).join('');

    const showInstallments = mode === 'installment';
    const showShared = mode === 'shared';
    const showRecurring = mode === 'recurring';
    body.innerHTML = `
      <div class="m2-sheet-head-inline">
        <button type="button" class="m2-chip-btn" id="mobileV2OutflowBack">&lt; Tipo</button>
        <h3 class="form-title">${MODE_LABEL[mode] || 'Lançamento'}</h3>
      </div>

      <div class="form-field">
        <label class="form-label" for="mobileV2OutflowDescription">Descrição</label>
        <input id="mobileV2OutflowDescription" class="form-input" type="text" placeholder="Ex: Mercado, aluguel">
      </div>

      <div class="form-row-2">
        <div class="form-field" style="margin:0">
          <label class="form-label" for="mobileV2OutflowAmount">Valor</label>
          <input id="mobileV2OutflowAmount" class="form-input form-input-value" type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="0,00">
        </div>
        <div class="form-field" style="margin:0">
          <label class="form-label" for="mobileV2OutflowDate">Data</label>
          <input id="mobileV2OutflowDate" class="form-input m2-native-date" type="date" value="${formatDateDefault()}">
        </div>
      </div>

      <div class="form-field">
        <label class="form-label" for="mobileV2OutflowCategory">Categoria</label>
        <select id="mobileV2OutflowCategory" class="form-input">
          <option value="">Categoria</option>
          ${optionsHtml}
        </select>
      </div>

      <div class="form-field">
        <label class="form-label" for="mobileV2OutflowOutput">Saída</label>
        <select id="mobileV2OutflowOutput" class="form-input">
          ${outputs.map((entry) => `<option value="${escapeHtml(entry.value)}">${escapeHtml(entry.label)}</option>`).join('')}
        </select>
      </div>

      <input id="mobileV2RecurringToggle" type="checkbox" ${showRecurring ? 'checked' : ''} hidden>

      <div class="form-row-2" ${showInstallments ? '' : 'style="display:none"'}>
        <div class="form-field" style="margin:0">
          <label class="form-label" for="mobileV2InstallmentsCount">Parcelas</label>
          <input id="mobileV2InstallmentsCount" class="form-input" type="number" min="2" max="120" value="2">
        </div>
        <div class="form-field" style="margin:0">
          <label class="form-label" for="mobileV2InstallmentsEntry">Entrada</label>
          <select id="mobileV2InstallmentsEntry" class="form-input">
            <option value="0">Sem entrada</option>
            <option value="1">Com entrada</option>
          </select>
        </div>
      </div>

      <div class="form-row-2" ${showShared ? '' : 'style="display:none"'}>
        <div class="form-field" style="margin:0">
          <label class="form-label" for="mobileV2SharedPeopleCount">Pessoas</label>
          <input id="mobileV2SharedPeopleCount" class="form-input" type="number" min="2" max="20" value="2">
        </div>
        <div class="form-field" style="margin:0">
          <label class="form-label" for="mobileV2SharedMode">Divisão</label>
          <select id="mobileV2SharedMode" class="form-input">
            <option value="equal">Igual</option>
            <option value="manual">Manual</option>
          </select>
        </div>
      </div>

      <div id="mobileV2SharedPeopleList" class="m2-shared-people" ${showShared ? '' : 'style="display:none"'}></div>

      <label class="form-check-row" ${showRecurring ? 'style="display:none"' : ''}>
        <input id="mobileV2PlanningToggle" type="checkbox" ${showRecurring ? 'checked' : ''}>
        <span class="form-check-label">Aparecer no planejamento do mês</span>
      </label>

      <div class="form-actions">
        <button class="btn-cancel" type="button" id="mobileV2OutflowCancel">Cancelar</button>
        <button class="btn-submit" type="button" id="mobileV2OutflowSubmit">Adicionar</button>
      </div>
    `;

    body.querySelector('#mobileV2OutflowBack')?.addEventListener('click', () => {
      close();
      global.MobileV2AddSheet?.open?.();
    });
    body.querySelector('#mobileV2OutflowCancel')?.addEventListener('click', close);
    body.querySelector('#mobileV2OutflowSubmit')?.addEventListener('click', () => submitForm(mode));
    if (showShared) {
      ['mobileV2SharedPeopleCount', 'mobileV2SharedMode', 'mobileV2OutflowAmount'].forEach((id) => {
        body.querySelector(`#${id}`)?.addEventListener('input', renderMobileSharedPeople);
        body.querySelector(`#${id}`)?.addEventListener('change', renderMobileSharedPeople);
      });
      renderMobileSharedPeople();
    }
    bindMoneyMask();
  }

  function getMobileOwnerName() {
    return String(document.getElementById('sessionUserName')?.textContent || 'Você').trim() || 'Você';
  }

  function renderMobileSharedPeople() {
    const mount = document.getElementById('mobileV2SharedPeopleList');
    if (!mount) return;
    const count = Math.max(2, Math.min(20, Number(document.getElementById('mobileV2SharedPeopleCount')?.value || 2) || 2));
    const mode = document.getElementById('mobileV2SharedMode')?.value === 'manual' ? 'manual' : 'equal';
    const total = parseMoneyInput(document.getElementById('mobileV2OutflowAmount')?.value || '');
    const previous = Array.from(mount.querySelectorAll('[data-mobile-shared-row]')).map((row) => ({
      name: row.querySelector('[data-mobile-shared-name]')?.value || '',
      amount: parseMoneyInput(row.querySelector('[data-mobile-shared-amount]')?.value || '')
    }));
    const equalValue = count > 0 ? total / count : 0;
    mount.innerHTML = `
      <div class="m2-shared-summary">
        <span>Total do usuário: <strong id="mobileV2SharedOwnerTotal">${(mode === 'equal' ? equalValue : Number(previous[0]?.amount || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
        <span>Total de terceiros: <strong id="mobileV2SharedOthersTotal">${Math.max(0, total - (mode === 'equal' ? equalValue : Number(previous[0]?.amount || 0))).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
      </div>
      ${Array.from({ length: count }, (_, index) => {
        const isOwner = index === 0;
        const amount = mode === 'equal' ? equalValue : Number(previous[index]?.amount || 0);
        return `
          <div class="m2-shared-row" data-mobile-shared-row>
            <label>${isOwner ? 'Proprietário' : `Pessoa ${index}`}
              <input class="form-input" data-mobile-shared-name ${isOwner ? 'readonly' : ''} value="${escapeHtml(isOwner ? getMobileOwnerName() : previous[index]?.name || '')}" placeholder="Nome">
            </label>
            <label>Valor
              <input class="form-input" data-mobile-shared-amount type="text" inputmode="decimal" ${mode === 'equal' ? 'readonly' : ''} value="${amount.toFixed(2).replace('.', ',')}">
            </label>
          </div>`;
      }).join('')}
    `;
    mount.querySelectorAll('[data-mobile-shared-amount]').forEach((input) => {
      input.addEventListener('input', updateMobileSharedSummary);
    });
  }

  function updateMobileSharedSummary() {
    const values = Array.from(document.querySelectorAll('#mobileV2SharedPeopleList [data-mobile-shared-amount]'))
      .map((input) => parseMoneyInput(input.value));
    const owner = Number(values[0] || 0);
    const others = values.slice(1).reduce((sum, value) => sum + Number(value || 0), 0);
    const formatter = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const ownerNode = document.getElementById('mobileV2SharedOwnerTotal');
    const othersNode = document.getElementById('mobileV2SharedOthersTotal');
    if (ownerNode) ownerNode.textContent = formatter(owner);
    if (othersNode) othersNode.textContent = formatter(others);
  }

  function collectMobileSharedParticipants() {
    return Array.from(document.querySelectorAll('#mobileV2SharedPeopleList [data-mobile-shared-row]')).map((row, index) => ({
      isOwner: index === 0,
      name: String(row.querySelector('[data-mobile-shared-name]')?.value || '').trim(),
      amount: parseMoneyInput(row.querySelector('[data-mobile-shared-amount]')?.value || ''),
      paid: false
    }));
  }

  function applyToUnifiedModal(mode, payload) {
    if (typeof global.openUnifiedOutflowModal !== 'function' || typeof global.saveUnifiedOutflow !== 'function') {
      throw new Error('Fluxo de lançamento indisponível no momento.');
    }

    global.openUnifiedOutflowModal(payload.editId || '', {});

    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = value;
      try {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch {}
    };

    setValue('unifiedOutflowDescription', payload.description);
    setValue('unifiedOutflowAmount', String(payload.amount));
    setValue('unifiedOutflowDate', payload.date);
    setValue('unifiedOutflowCategory', payload.category);

    const outputSelect = document.getElementById('unifiedOutflowOutput');
    if (outputSelect) {
      const preferredOutput = String(payload.output || '').trim();
      const preferredOption = preferredOutput ? outputSelect.querySelector(`option[value="${preferredOutput}"]`) : null;
      const firstMethod = outputSelect.querySelector('option[value^="method:"]')?.value || 'method:debito';
      outputSelect.value = preferredOption ? preferredOutput : firstMethod;
      outputSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const recurringToggle = document.getElementById('unifiedOutflowRecurringToggle');
    const installmentsToggle = document.getElementById('unifiedOutflowInstallmentsToggle');
    const sharedToggle = document.getElementById('unifiedOutflowSharedToggle');
    const planningToggle = document.getElementById('unifiedOutflowPlanningToggle');
    const incomeToggle = document.getElementById('unifiedOutflowIncomeToggle');

    if (recurringToggle) recurringToggle.checked = mode === 'recurring';
    if (installmentsToggle) installmentsToggle.checked = mode === 'installment';
    if (sharedToggle) sharedToggle.checked = mode === 'shared';
    if (planningToggle) planningToggle.checked = payload.planning || mode === 'recurring';
    if (incomeToggle) incomeToggle.checked = mode === 'renda';

    if (typeof global.toggleUnifiedOutflowInstallments === 'function') {
      global.toggleUnifiedOutflowInstallments();
    } else if (typeof global.handleUnifiedOutflowTypeChange === 'function') {
      global.handleUnifiedOutflowTypeChange();
    }

    if (mode === 'installment') {
      setValue('unifiedOutflowInstallmentsCount', String(payload.installmentsCount));
    }

    if (mode === 'shared') {
      setValue('unifiedOutflowSharedPeopleCount', String(payload.sharedPeopleCount));
      setValue('unifiedOutflowSharedMode', payload.sharedMode);
      if (typeof global.toggleUnifiedOutflowShared === 'function') {
        global.toggleUnifiedOutflowShared();
      }
      if (typeof global.renderUnifiedOutflowSharedPeople === 'function') {
        global.renderUnifiedOutflowSharedPeople();
      }
      const participantRows = Array.from(document.querySelectorAll('#unifiedOutflowSharedPeopleList .form-row'));
      (payload.sharedParticipants || []).forEach((participant, index) => {
        const row = participantRows[index];
        if (!row) return;
        const nameInput = row.querySelector('.unified-shared-name');
        const amountInput = row.querySelector('.unified-shared-amount');
        if (nameInput && !participant.isOwner) nameInput.value = participant.name || '';
        if (amountInput) amountInput.value = String(participant.amount || 0);
      });
    }

    global.saveUnifiedOutflow();
    const month = getCurrentMonth();
    return (month?.outflows || []).find((item) => !payload.beforeIds?.has?.(String(item?.id || '')))?.id || '';
  }

  function submitForm(mode) {
    const description = String(document.getElementById('mobileV2OutflowDescription')?.value || '').trim();
    const category = String(document.getElementById('mobileV2OutflowCategory')?.value || '').trim();
    const amount = parseMoneyInput(document.getElementById('mobileV2OutflowAmount')?.value || '');
    const date = String(document.getElementById('mobileV2OutflowDate')?.value || '').trim();
    const planning = document.getElementById('mobileV2PlanningToggle')?.checked === true;

    if (!description || !category || !(amount > 0) || !date) {
      if (typeof global.showAppStatus === 'function') global.showAppStatus('Preencha descrição, categoria, valor e data.', 'error');
      else global.alert?.('Preencha descrição, categoria, valor e data.');
      return;
    }

    const payload = {
      editId: String(document.getElementById('mobileV2OutflowSheet')?.getAttribute('data-mobile-v2-edit-id') || ''),
      description,
      category,
      amount,
      date,
      output: String(document.getElementById('mobileV2OutflowOutput')?.value || 'method:debito'),
      planning,
      installmentsCount: Math.max(2, Number(document.getElementById('mobileV2InstallmentsCount')?.value || 2) || 2),
      sharedPeopleCount: Math.max(2, Number(document.getElementById('mobileV2SharedPeopleCount')?.value || 2) || 2),
      sharedMode: document.getElementById('mobileV2SharedMode')?.value === 'manual' ? 'manual' : 'equal',
      sharedParticipants: mode === 'shared' ? collectMobileSharedParticipants() : [],
      beforeIds: new Set((getCurrentMonth()?.outflows || []).map((item) => String(item?.id || '')))
    };

    try {
      const createdId = applyToUnifiedModal(mode, payload);
      close();
      global.MobileV2?.setTab?.('mes');
      global.MobileV2?.refresh?.();
      global.MobileV2Enhancements?.notifyDataChanged?.('outflow-save');
      global.triggerHapticFeedback?.('light');
      if (!payload.editId && createdId && typeof global.openUnifiedOutflowModal === 'function') {
        global.setTimeout(() => global.openUnifiedOutflowModal(createdId), 140);
      }
      if (typeof global.showToast === 'function') global.showToast(payload.editId ? 'Lançamento atualizado.' : 'Lançamento salvo.');
      else if (typeof global.showAppStatus === 'function') global.showAppStatus(payload.editId ? 'Lançamento atualizado.' : 'Lançamento salvo.', 'success');
    } catch (error) {
      if (typeof global.showAppStatus === 'function') global.showAppStatus(error?.message || 'Não foi possível adicionar o lançamento.', 'error');
      else global.alert?.(error?.message || 'Não foi possível adicionar o lançamento.');
    }
  }

  function openInlineSheet({ title, subtitle, body, showBack = false, backLabel = 'Voltar', onBack = null, closeLabel = 'Fechar' }) {
    global.MobileV2?.closeFabMenu?.({ instant: true });
    const sheet = ensureSheet();
    sheet?.classList.remove('m2-banking-sheet');
    const mount = document.getElementById('mobileV2OutflowFormBody');
    if (!mount) return;
    const headerAction = showBack
      ? `<button type="button" class="m2-chip-btn" id="mobileV2OutflowBack">&lt; ${escapeHtml(String(backLabel || 'Voltar'))}</button>`
      : `<button type="button" class="m2-icon-btn m2-inline-close-btn" id="mobileV2OutflowClose" aria-label="${escapeHtml(String(closeLabel || 'Fechar'))}">✕</button>`;
    mount.innerHTML = `
      <div class="m2-sheet-head-inline">
        ${headerAction}
        <h3 class="form-title">${escapeHtml(String(title || 'Detalhes'))}</h3>
      </div>
      ${subtitle ? `<p class="m2-sheet-subtitle">${escapeHtml(String(subtitle))}</p>` : ''}
      <div class="mobile-v2-inline-sheet-body">${String(body || '')}</div>
    `;
    mount.querySelector('#mobileV2OutflowBack')?.addEventListener('click', () => {
      if (typeof onBack === 'function') {
        onBack();
        return;
      }
      close();
    });
    mount.querySelector('#mobileV2OutflowClose')?.addEventListener('click', () => {
      close();
    });
    sheet.classList.add('open');
    sheet.style.display = '';
    sheet.removeAttribute('hidden');
    document.body.classList.add('mobile-v2-sheet-open');
  }

  function openIncomePicker() {
    openInlineSheet({
      title: 'Tipo de renda',
      subtitle: 'Escolha como deseja registrar a entrada',
      body: `
        <div class="m2-choose-grid">
          <button type="button" class="m2-choose-card" id="mobileV2IncomeFixed">
            <strong>Renda fixa</strong>
            <span>Salário, pró-labore ou aluguel</span>
          </button>
          <button type="button" class="m2-choose-card" id="mobileV2IncomeExtra">
            <strong>Renda extra</strong>
            <span>Freelance, comissão ou venda</span>
          </button>
        </div>
      `
    });

    document.getElementById('mobileV2IncomeFixed')?.addEventListener('click', () => open('renda'));
    document.getElementById('mobileV2IncomeExtra')?.addEventListener('click', () => open('renda'));
  }

  function open(mode = 'launch') {
    if (global.MobileV2?.isEnabled?.() !== true) return;
    global.MobileV2?.closeFabMenu?.({ instant: true });
    const sheet = ensureSheet();
    if (!sheet) return;
    sheet.setAttribute('data-mobile-v2-mode', mode);
    sheet.removeAttribute('data-mobile-v2-edit-id');
    renderForm(mode);
    sheet.style.display = '';
    sheet.removeAttribute('hidden');
    sheet.classList.add('open');
    document.body.classList.add('mobile-v2-sheet-open');
  }

  function openEdit(item) {
    const source = item && typeof item === 'object' ? item : null;
    global.MobileV2?.closeFabMenu?.({ instant: true });
    if (!source) return open('launch');
    const sheet = ensureSheet();
    sheet.setAttribute('data-mobile-v2-mode', 'launch');
    sheet.setAttribute('data-mobile-v2-edit-id', String(source.id || ''));
    renderForm('launch');
    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = value == null ? '' : String(value);
      try {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch {}
    };
    setValue('mobileV2OutflowDescription', source.description || source.nome || '');
    setValue('mobileV2OutflowAmount', Math.abs(Number(source.amount || source.valor || 0)) || '');
    setValue('mobileV2OutflowDate', toNativeDateValue(source.date || source.data || ''));
    setValue('mobileV2OutflowCategory', source.category || source.categoria || '');
    if (source.outputKind === 'card' && source.outputRef) {
      setValue('mobileV2OutflowOutput', `card:${source.outputRef}`);
    } else if (source.outputMethod) {
      setValue('mobileV2OutflowOutput', `method:${source.outputMethod}`);
    }
    const planning = document.getElementById('mobileV2PlanningToggle');
    if (planning) planning.checked = source.showInMonthPlanning === true || String(source.type || '').toLowerCase() === 'expense';
    const submit = document.getElementById('mobileV2OutflowSubmit');
    if (submit) submit.textContent = 'Salvar';
    const title = document.querySelector('#mobileV2OutflowFormBody .form-title');
    if (title) title.textContent = 'Editar lançamento';
    sheet.style.display = '';
    sheet.removeAttribute('hidden');
    sheet.classList.add('open');
    document.body.classList.add('mobile-v2-sheet-open');
  }

  function close() {
    const sheet = document.getElementById('mobileV2OutflowSheet');
    if (!sheet) return;
    sheet.classList.remove('open');
    sheet.setAttribute('hidden', 'hidden');
    sheet.style.display = 'none';
    sheet.classList.remove('m2-banking-sheet');
    document.body.classList.remove('mobile-v2-sheet-open');
    global.requestAnimationFrame?.(() => global.MobileV2?.refresh?.());
  }

  global.MobileV2OutflowForm = {
    ensureSheet,
    open,
    openEdit,
    close,
    closeInlineSheet: close,
    openInlineSheet,
    openIncomePicker
  };
})(window);

