(function initMesAtualModals(global) {
  'use strict';

  function getUnifiedOutflowDraftStorageKey(monthId = '', fallback = {}) {
    const userId = String(global.__APP_BOOTSTRAP__?.session?.id || 'anonymous').trim() || 'anonymous';
    const safeMonthId = String(
      monthId || fallback.currentMonthId || fallback.currentMonth?.id || 'sem_mes'
    ).trim() || 'sem_mes';
    return `finUnifiedOutflowDraft::${userId}::${safeMonthId}`;
  }

  function readUnifiedOutflowDraft(month, fallback = {}) {
    try {
      const raw = localStorage.getItem(
        getUnifiedOutflowDraftStorageKey(month?.id || '', fallback)
      );
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveUnifiedOutflowDraft(month, draft, fallback = {}) {
    try {
      localStorage.setItem(
        getUnifiedOutflowDraftStorageKey(month?.id || '', fallback),
        JSON.stringify(draft || {})
      );
    } catch {}
  }

  function clearUnifiedOutflowDraft(month, fallback = {}) {
    try {
      localStorage.removeItem(
        getUnifiedOutflowDraftStorageKey(month?.id || '', fallback)
      );
    } catch {}
  }

  function buildUnifiedOutflowDraftFromForm(month, deps = {}) {
    const safeMonth = month || deps.getCurrentMonth?.();
    const description = String(document.getElementById('unifiedOutflowDescription')?.value || '').trim();
    const type = document.getElementById('unifiedOutflowType')?.value === 'spend' ? 'spend' : 'fixed';
    const category = String(document.getElementById('unifiedOutflowCategory')?.value || '');
    const newCategory = String(document.getElementById('unifiedOutflowNewCategory')?.value || '').trim();
    const amount = String(document.getElementById('unifiedOutflowAmount')?.value || '').trim();
    const outputValue = String(document.getElementById('unifiedOutflowOutput')?.value || 'method:debito').trim();
    const date = String(document.getElementById('unifiedOutflowDate')?.value || '').trim();
    const recurringToggle = document.getElementById('unifiedOutflowRecurringToggle')?.checked === true;
    const installmentsToggle = document.getElementById('unifiedOutflowInstallmentsToggle')?.checked === true;
    const installmentsCount = String(document.getElementById('unifiedOutflowInstallmentsCount')?.value || '2').trim();
    const tag = String(document.getElementById('unifiedOutflowTag')?.value || '');
    const newTag = String(document.getElementById('unifiedOutflowNewTagInline')?.value || '').trim();
    const sharedToggle = document.getElementById('unifiedOutflowSharedToggle')?.checked === true;
    const sharedPeopleCount = String(document.getElementById('unifiedOutflowSharedPeopleCount')?.value || '2').trim();
    const sharedMode = document.getElementById('unifiedOutflowSharedMode')?.value === 'manual' ? 'manual' : 'equal';
    const sharedParticipants = deps.readSharedParticipantsFromDOM?.() || [];

    return {
      monthId: safeMonth?.id || '',
      description,
      type,
      category,
      newCategory,
      amount,
      outputValue,
      date,
      recurringToggle,
      installmentsToggle,
      installmentsCount,
      tag,
      newTag,
      sharedToggle,
      sharedPeopleCount,
      sharedMode,
      sharedParticipants,
      updatedAt: Date.now()
    };
  }

  function applyUnifiedOutflowDraftToForm(month, draft, deps = {}) {
    if (!draft || typeof draft !== 'object') return false;
    const descriptionInput = document.getElementById('unifiedOutflowDescription');
    if (descriptionInput) descriptionInput.value = String(draft.description || '');
    document.getElementById('unifiedOutflowType').value = draft.type === 'spend' ? 'spend' : 'fixed';
    deps.populateCategoryOptions?.(month, String(draft.category || deps.resolveDefaultCategory?.('COMPRAS') || ''));
    document.getElementById('unifiedOutflowNewCategory').value = String(draft.newCategory || '');
    deps.toggleNewCategory?.();
    document.getElementById('unifiedOutflowAmount').value = String(draft.amount || '');
    const outputEl = document.getElementById('unifiedOutflowOutput');
    if (outputEl) outputEl.innerHTML = deps.getOutputOptions?.(month, String(draft.outputValue || 'method:debito')) || '';
    document.getElementById('unifiedOutflowDate').value = String(draft.date || '');
    document.getElementById('unifiedOutflowRecurringToggle').checked = draft.recurringToggle === true;
    document.getElementById('unifiedOutflowInstallmentsToggle').checked = draft.installmentsToggle === true;
    document.getElementById('unifiedOutflowInstallmentsCount').value = String(draft.installmentsCount || '2');
    deps.populateTagOptions?.(String(draft.tag || ''));
    document.getElementById('unifiedOutflowNewTagInline').value = String(draft.newTag || '');
    deps.toggleNewTag?.();
    const sharedToggle = document.getElementById('unifiedOutflowSharedToggle');
    const sharedCount = document.getElementById('unifiedOutflowSharedPeopleCount');
    const sharedMode = document.getElementById('unifiedOutflowSharedMode');
    if (sharedToggle) sharedToggle.checked = draft.sharedToggle === true;
    if (sharedCount) sharedCount.value = String(draft.sharedPeopleCount || '2');
    if (sharedMode) sharedMode.value = draft.sharedMode === 'manual' ? 'manual' : 'equal';
    deps.toggleInstallments?.();
    deps.handleTypeChange?.();
    if (sharedToggle?.checked) deps.renderSharedPeople?.(Array.isArray(draft.sharedParticipants) ? draft.sharedParticipants : []);
    deps.renderDescriptionSuggestions?.(descriptionInput?.value || '');
    return true;
  }

  global.MesAtualModals = {
    getUnifiedOutflowDraftStorageKey,
    readUnifiedOutflowDraft,
    saveUnifiedOutflowDraft,
    clearUnifiedOutflowDraft,
    buildUnifiedOutflowDraftFromForm,
    applyUnifiedOutflowDraftToForm
  };
})(window);
