(function initMobileV2OutflowForm(global) {
  'use strict';

  const MODE_LABEL = {
    launch: 'Gasto',
    renda: 'Renda',
    recurring: 'Gasto Recorrente',
    installment: 'Gasto Parcelado',
    shared: 'Gasto Compartilhado'
  };

  function formatDateDefault() {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getFullYear()).slice(-2)}`;
  }

  function getCurrentMonth() {
    return typeof global.getCurrentMonth === 'function' ? global.getCurrentMonth() : null;
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
      { value: 'method:credito', label: 'Crédito' }
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
          <input id="mobileV2OutflowAmount" class="form-input form-input-value" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00">
        </div>
        <div class="form-field" style="margin:0">
          <label class="form-label" for="mobileV2OutflowDate">Data</label>
          <input id="mobileV2OutflowDate" class="form-input" type="text" inputmode="numeric" placeholder="dd/mm/aa" value="${formatDateDefault()}">
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

      <label class="form-check-row" ${showRecurring ? '' : 'style="display:none"'}>
        <input id="mobileV2RecurringToggle" type="checkbox" checked>
        <span class="form-check-label">Marcar como recorrente mensal</span>
      </label>

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

      <label class="form-check-row">
        <input id="mobileV2PlanningToggle" type="checkbox">
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
    }

    global.saveUnifiedOutflow();
  }

  function submitForm(mode) {
    const description = String(document.getElementById('mobileV2OutflowDescription')?.value || '').trim();
    const category = String(document.getElementById('mobileV2OutflowCategory')?.value || '').trim();
    const amount = Number(document.getElementById('mobileV2OutflowAmount')?.value || 0);
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
      sharedMode: document.getElementById('mobileV2SharedMode')?.value === 'manual' ? 'manual' : 'equal'
    };

    try {
      applyToUnifiedModal(mode, payload);
      close();
      global.MobileV2?.setTab?.('mes');
      global.MobileV2?.refresh?.();
      global.MobileV2Enhancements?.notifyDataChanged?.('outflow-save');
      global.MobileV2Enhancements?.haptic?.('light');
      if (typeof global.showToast === 'function') global.showToast(payload.editId ? 'Lançamento atualizado.' : 'Lançamento salvo.');
      else if (typeof global.showAppStatus === 'function') global.showAppStatus(payload.editId ? 'Lançamento atualizado.' : 'Lançamento salvo.', 'success');
    } catch (error) {
      if (typeof global.showAppStatus === 'function') global.showAppStatus(error?.message || 'Não foi possível adicionar o lançamento.', 'error');
      else global.alert?.(error?.message || 'Não foi possível adicionar o lançamento.');
    }
  }

  function openInlineSheet({ title, subtitle, body }) {
    const sheet = ensureSheet();
    const mount = document.getElementById('mobileV2OutflowFormBody');
    if (!mount) return;
    mount.innerHTML = `
      <div class="m2-sheet-head-inline">
        <button type="button" class="m2-chip-btn" id="mobileV2OutflowBack">&lt; Voltar</button>
        <h3 class="form-title">${escapeHtml(String(title || 'Detalhes'))}</h3>
      </div>
      ${subtitle ? `<p class="m2-sheet-subtitle">${escapeHtml(String(subtitle))}</p>` : ''}
      <div class="mobile-v2-inline-sheet-body">${String(body || '')}</div>
    `;
    mount.querySelector('#mobileV2OutflowBack')?.addEventListener('click', () => {
      close();
      global.MobileV2AddSheet?.open?.();
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
    setValue('mobileV2OutflowDate', source.date || source.data || '');
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
    sheet.classList.add('open');
    document.body.classList.add('mobile-v2-sheet-open');
  }

  function close() {
    const sheet = document.getElementById('mobileV2OutflowSheet');
    if (!sheet) return;
    sheet.classList.remove('open');
    sheet.setAttribute('hidden', 'hidden');
    sheet.style.display = 'none';
    document.body.classList.remove('mobile-v2-sheet-open');
  }

  global.MobileV2OutflowForm = {
    ensureSheet,
    open,
    openEdit,
    close,
    openInlineSheet,
    openIncomePicker
  };
})(window);

