(function initOutflowCommands(global) {
  'use strict';

  function collectShared(baseAmount, input, { getOwnerDisplayName, getUnifiedSharedComputedValues, fmt }) {
    const enabled = input.enabled === true;
    if (!enabled) {
      return {
        enabled: false,
        ownerShare: Math.max(0, Number(baseAmount || 0) || 0),
        othersShare: 0,
        participants: [],
        mode: 'equal'
      };
    }
    const mode = input.mode === 'manual' ? 'manual' : 'equal';
    const peopleCount = Math.max(1, Math.min(20, Number(input.peopleCount || 1) || 1));
    const effectiveCount = peopleCount <= 1 ? 2 : peopleCount;
    const totalAmount = Math.max(0, Number(baseAmount || 0) || 0);
    const rows = input.participants || [];
    const participants = [];
    for (let i = 0; i < effectiveCount; i += 1) {
      const role = i === 0 ? 'owner' : 'other';
      const name = String(rows[i]?.name || '').trim();
      let value = Math.max(0, Number(rows[i]?.amount || 0) || 0);
      if (peopleCount <= 1) {
        value = role === 'owner' ? 0 : totalAmount;
      }
      if (mode === 'equal') {
        if (peopleCount <= 1) value = role === 'owner' ? 0 : totalAmount;
        else value = totalAmount / effectiveCount;
      }
      participants.push({
        id: `sp_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        isOwner: role === 'owner',
        name: role === 'owner' ? getOwnerDisplayName() : name,
        amount: value,
        paid: false
      });
    }
    if (mode === 'manual') {
      const manualTotal = participants.reduce((acc, participant) => acc + Number(participant.amount || 0), 0);
      if (Math.abs(manualTotal - totalAmount) > 0.01) {
        throw new Error(`A divisão manual precisa somar ${fmt(totalAmount)}.`);
      }
    }
    const computed = getUnifiedSharedComputedValues(totalAmount, peopleCount, mode, participants);
    return {
      enabled: true,
      ownerShare: computed.ownerShare,
      othersShare: computed.othersShare,
      participants,
      mode
    };
  }

  function saveDraft(draft, context) {
    const { month, editId: editingUnifiedOutflowId = '', options = {}, collectShared, ImportIdentity,
      ensureUnifiedOutflowPilotMonth,
      normalizeUnifiedOutflowType,
      resolveCategoryName,
      isNonRealCategoryLabel,
      parseUnifiedOutflowOutputValue,
      resolveUnifiedExpenseDateInput,
      normalizeUnifiedOutflowSpendDateInput,
      normalizeUnifiedOutflowItem,
      shouldAutoPayUnifiedOutflow,
      getOwnerDisplayName,
      getRecurringChangedFields,
      recordHistoryState,
      getUnifiedOutflowTags,
      markUnifiedOutflowSelectionVisibleFromMonth,
      clearRecurringSeriesStopFromMonth,
      updateContinuousCalendarRule,
      canPropagateRecurringFromMonth,
      markRecurringSeriesStopFromMonth,
      stopContinuousCalendarRule,
      getMonthSortValue,
      syncUnifiedOutflowLegacyData,
      applyRecurringForwardChanges,
      isContinuousCalendarEnabled,
      addMonthsToMonthObject,
      getMonthIdFromParts,
      MONTH_INDEX,
      cloneUnifiedOutflowForMonth,
      getMonthDateFromMonthObject,
      syncUnifiedCardBillForecastAmounts,
      save,
      openRecurringChangeScopeModal,
      alert,
      data } = context;
    ensureUnifiedOutflowPilotMonth(month);
    const previousItem = editingUnifiedOutflowId
      ? (month.outflows || []).find(entry => entry.id === editingUnifiedOutflowId) || null
      : null;
    const description = String(draft.description || '').trim();
    const requestedType = normalizeUnifiedOutflowType(draft.requestedType || 'launch');
    let category = draft.category;
    if (category === 'nova') category = String(draft.newCategory || '').trim();
    category = resolveCategoryName(category || 'OUTROS');
    if (typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(category)) {
      category = 'OUTROS';
    }
    let tag = draft.tag;
    if (tag === 'nova') tag = String(draft.newTag || '').trim();
    const amount = Number(draft.amount || 0);
    const output = parseUnifiedOutflowOutputValue(draft.outputValue || '');
    const recurringToggleChecked = draft.recurringToggleChecked;
    const planningToggleChecked = draft.planningToggleChecked === true;
    const isPlanningLaunch = recurringToggleChecked || planningToggleChecked;
    const type = output.outputKind === 'card'
      ? 'spend'
      : (requestedType === 'spend' || requestedType === 'expense'
        ? requestedType
        : (isPlanningLaunch ? 'expense' : 'spend'));
    const recurringSpend = false;
    const expenseRecurring = recurringToggleChecked;
    const rawDateValue = draft.rawDateValue || '';
    const usesBillingDay = isPlanningLaunch;
    let resolvedExpenseDate = '';
    if (usesBillingDay) {
      const date = resolveUnifiedExpenseDateInput(rawDateValue, month);
      if (!date) {
        alert('Informe a data da cobrança como dia (1 a 31) ou data completa (dd/mm/aa).');
        return { status: 'invalid' };
      }
      resolvedExpenseDate = date;
    }
    const date = usesBillingDay
      ? resolvedExpenseDate
      : normalizeUnifiedOutflowSpendDateInput(rawDateValue, month);
    if (!date) {
      alert('Informe uma data valida para o lancamento.');
      return { status: 'invalid' };
    }
    const status = usesBillingDay ? 'planned' : 'done';
    const isInstallment = draft.isInstallment;
    const installmentsTotal = isInstallment ? Math.max(2, Number(draft.installmentsCount || 2)) : 1;
    if (!description || !category || !(amount > 0)) {
      alert('Preencha descrição, categoria e valor corretamente.');
      return { status: 'invalid' };
    }
    let sharedState = {
      enabled: false,
      ownerShare: amount,
      othersShare: 0,
      participants: [],
      mode: 'equal'
    };
    try {
      sharedState = collectShared(amount);
    } catch (error) {
      alert(error?.message || 'Não foi possível validar a divisão do gasto compartilhado.');
      return { status: 'invalid' };
    }
    let baseItem = normalizeUnifiedOutflowItem({
      ...(ImportIdentity?.provenance(previousItem) || {}),
      id: editingUnifiedOutflowId || '',
      description,
      type,
      category,
      tag,
      amount: sharedState.enabled ? sharedState.ownerShare : amount,
      ...output,
      date,
      recurringSpend,
      expenseRecurring,
      status,
      paid: editingUnifiedOutflowId
        ? ((month.outflows || []).find(entry => entry.id === editingUnifiedOutflowId)?.paid === true)
        : shouldAutoPayUnifiedOutflow({ ...output, date }),
      installmentsTotal,
      installmentIndex: editingUnifiedOutflowId ? ((month.outflows || []).find(entry => entry.id === editingUnifiedOutflowId)?.installmentIndex || 1) : 1,
      installmentsGroupId: editingUnifiedOutflowId ? ((month.outflows || []).find(entry => entry.id === editingUnifiedOutflowId)?.installmentsGroupId || '') : (installmentsTotal > 1 ? `inst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` : ''),
      recurringGroupId: (expenseRecurring || recurringSpend) && installmentsTotal <= 1
        ? (editingUnifiedOutflowId ? ((month.outflows || []).find(entry => entry.id === editingUnifiedOutflowId)?.recurringGroupId || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`) : `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`)
        : '',
      sharedExpense: sharedState.enabled,
      sharedSplitMode: sharedState.mode,
      sharedOriginalAmount: amount,
      sharedOwnerName: getOwnerDisplayName(),
      sharedOthersAmount: sharedState.othersShare,
      sharedParticipants: sharedState.participants,
      showInMonthPlanning: recurringToggleChecked ? true : planningToggleChecked
    });
    if (options.preserveSemantics && previousItem) {
      baseItem = {
        ...previousItem, description, category, tag, date, ...output,
        amount: baseItem.amount,
        showInMonthPlanning: baseItem.showInMonthPlanning,
        sharedOriginalAmount: sharedState.enabled ? baseItem.sharedOriginalAmount : previousItem.sharedOriginalAmount,
        sharedOthersAmount: sharedState.enabled ? baseItem.sharedOthersAmount : previousItem.sharedOthersAmount,
        sharedParticipants: sharedState.enabled ? sharedState.participants.map((participant, index) => ({
          ...previousItem.sharedParticipants?.[index],
          amount: participant.amount
        })) : previousItem.sharedParticipants
      };
    }
    const existingIndex = (month.outflows || []).findIndex(entry => entry.id === baseItem.id);
    const previousSeriesKey = previousItem?.installmentsGroupId || previousItem?.recurringGroupId || '';
    const recurrenceDisabled = Boolean(previousSeriesKey) && !baseItem.installmentsGroupId
      && !baseItem.recurringGroupId;
    const seriesKey = baseItem.installmentsGroupId || baseItem.recurringGroupId || previousSeriesKey;
    const changedFields = previousItem ? getRecurringChangedFields(previousItem, baseItem) : [];

    const persistOutflowSave = async (applyForward) => {
      recordHistoryState();
      const isNewCategory = draft.category === 'nova';
      const isNewTag = tag && !getUnifiedOutflowTags().some(existing => existing.toLocaleLowerCase('pt-BR') === tag.toLocaleLowerCase('pt-BR'));
      markUnifiedOutflowSelectionVisibleFromMonth(month, isNewCategory ? category : '', isNewTag ? tag : '');
      if (existingIndex >= 0) month.outflows[existingIndex] = baseItem;
      else month.outflows.push(baseItem);
      if (seriesKey && !recurrenceDisabled) clearRecurringSeriesStopFromMonth(month, seriesKey);
      if (!editingUnifiedOutflowId && seriesKey && typeof updateContinuousCalendarRule === 'function') updateContinuousCalendarRule(month, 'outflows', baseItem);

      if (editingUnifiedOutflowId && seriesKey && applyForward && (recurrenceDisabled || changedFields.length) && canPropagateRecurringFromMonth(month)) {
        if (recurrenceDisabled) {
          markRecurringSeriesStopFromMonth(month, seriesKey);
          const stopped = typeof stopContinuousCalendarRule === 'function'
            && stopContinuousCalendarRule(month, 'outflows', seriesKey);
          if (!stopped) {
            data.forEach(otherMonth => {
              if (getMonthSortValue(otherMonth) <= getMonthSortValue(month)) return;
              ensureUnifiedOutflowPilotMonth(otherMonth);
              otherMonth.outflows = (otherMonth.outflows || []).filter(item =>
                (item.installmentsGroupId || item.recurringGroupId || '') !== seriesKey);
              syncUnifiedOutflowLegacyData(otherMonth);
            });
          }
        } else {
          applyRecurringForwardChanges(month, seriesKey, baseItem, changedFields, previousItem || baseItem);
        }
      }

      if (!editingUnifiedOutflowId && installmentsTotal > 1 && !(typeof isContinuousCalendarEnabled === 'function' && isContinuousCalendarEnabled())) {
        for (let offset = 1; offset < installmentsTotal; offset += 1) {
          const futureDate = addMonthsToMonthObject(month, offset);
          const futureId = getMonthIdFromParts(Object.keys(MONTH_INDEX)[futureDate.getMonth()], futureDate.getFullYear());
          const futureMonth = data.find(entry => entry.id === futureId);
          if (!futureMonth) continue;
          ensureUnifiedOutflowPilotMonth(futureMonth);
          futureMonth.outflows.push(cloneUnifiedOutflowForMonth({ ...baseItem, installmentIndex: offset }, futureDate, month));
        }
      }
      if (!editingUnifiedOutflowId && (expenseRecurring || recurringSpend) && installmentsTotal <= 1 && !(typeof isContinuousCalendarEnabled === 'function' && isContinuousCalendarEnabled())) {
        const currentSort = getMonthSortValue(month);
        data.forEach(otherMonth => {
          if (getMonthSortValue(otherMonth) <= currentSort) return;
          ensureUnifiedOutflowPilotMonth(otherMonth);
          const futureDate = getMonthDateFromMonthObject(otherMonth);
          otherMonth.outflows.push(cloneUnifiedOutflowForMonth(baseItem, futureDate, month));
          syncUnifiedCardBillForecastAmounts(otherMonth);
          syncUnifiedOutflowLegacyData(otherMonth);
        });
      }

      syncUnifiedCardBillForecastAmounts(month);
      syncUnifiedOutflowLegacyData(month);
      const persistence = save(true);
      context.onChanged?.();
      const confirmed = await persistence === true;
      if (!confirmed) {
        context.onPending?.(baseItem);
        return { status: 'pending', id: baseItem.id };
      }
      context.onSaved?.(baseItem);
      return { status: 'saved', id: baseItem.id };
    };

    if (editingUnifiedOutflowId && seriesKey && (recurrenceDisabled || changedFields.length) && canPropagateRecurringFromMonth(month)) {
      return new Promise((resolve, reject) => {
        openRecurringChangeScopeModal({
          onThisMonth: () => persistOutflowSave(false).then(resolve, reject),
          onForward: () => persistOutflowSave(true).then(resolve, reject),
          onCancel: () => resolve({ status: 'cancelled' })
        });
      });
    }

    return persistOutflowSave(false);
  }

  function deleteDraft(month, outflowId, applyForward, context) {
    const { recordHistoryState, canPropagateRecurringFromMonth, markRecurringSeriesStopFromMonth,
      stopContinuousCalendarRule, getMonthSortValue, data, isContinuousCalendarEnabled,
      ensureUnifiedOutflowPilotMonth, syncUnifiedOutflowLegacyData } = context;
    const target = (month.outflows || []).find(entry => entry.id === outflowId);
    if (!target) return;
    const seriesKey = target.installmentsGroupId || target.recurringGroupId || '';
      recordHistoryState();
      month.outflows = (month.outflows || []).filter(entry => entry.id !== outflowId);
      if (seriesKey && applyForward && canPropagateRecurringFromMonth(month)) {
        markRecurringSeriesStopFromMonth(month, seriesKey);
        if (typeof stopContinuousCalendarRule === 'function') stopContinuousCalendarRule(month, 'outflows', seriesKey);
        const currentSort = getMonthSortValue(month);
        data.forEach(otherMonth => {
          if (otherMonth.id === month.id || getMonthSortValue(otherMonth) < currentSort) return;
          if (typeof isContinuousCalendarEnabled === 'function' && isContinuousCalendarEnabled()) return;
          ensureUnifiedOutflowPilotMonth(otherMonth);
          otherMonth.outflows = (otherMonth.outflows || []).filter(entry => (entry.installmentsGroupId || entry.recurringGroupId || '') !== seriesKey);
          syncUnifiedOutflowLegacyData(otherMonth);
        });
      }
      syncUnifiedOutflowLegacyData(month);
    return { status: 'deleted', id: outflowId };
  }

  function fromMobile(mode, payload, month, predicates) {
    const previous = (month.outflows || []).find(item => item.id === payload.editId) || null;
    const installment = previous ? predicates.isUnifiedInstallmentLaunch(previous) : mode === 'installment';
    const recurring = !installment && (previous ? predicates.isUnifiedRecurringLaunch(previous) : mode === 'recurring');
    const shared = previous ? predicates.isUnifiedSharedLaunch(previous) : mode === 'shared';
    const peopleCount = previous
      ? Math.max(1, Math.min(20, previous.sharedParticipants?.length || 2))
      : payload.sharedPeopleCount;
    const sharedMode = previous ? previous.sharedSplitMode : payload.sharedMode;
    const participants = (previous?.sharedParticipants || payload.sharedParticipants || []).map(row => ({ ...row }));
    // Editing the old Desktop form recomputed the final manual share after amount changes.
    if (previous && sharedMode === 'manual' && participants.length > 1) {
      participants.at(-1).amount = Math.max(0, Number((payload.amount - participants.slice(0, -1)
        .reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0)), 0)).toFixed(2)));
    }
    const availableOutputs = ['method:boleto', 'method:dinheiro', 'method:pix', 'method:debito',
      ...(month.outflowCards || []).map(card => `card:${card.id}`)];
    const requestedOutput = String(payload.output || '').trim();
    return {
      description: payload.description, requestedType: 'launch', category: payload.category,
      tag: payload.tag || '', amount: payload.amount, rawDateValue: payload.date,
      outputValue: availableOutputs.includes(requestedOutput) ? requestedOutput : 'method:boleto',
      recurringToggleChecked: recurring, planningToggleChecked: !!payload.planning || recurring,
      isInstallment: installment, installmentsCount: previous ? previous.installmentsTotal : payload.installmentsCount,
      sharedInput: { enabled: shared, mode: sharedMode, peopleCount, participants }
    };
  }

  const api = { saveDraft, deleteDraft, collectShared, fromMobile };
  global.MesAtualOutflowCommands = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
