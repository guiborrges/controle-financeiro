let continuousCalendarModel = null;
let continuousCalendarSession = null;

function renameContinuousCalendarSelection(kind, source, target) {
  if (!isContinuousCalendarEnabled()) return;
  window.ContinuousCalendar.renameSelection(continuousCalendarModel, kind, source, target,
    kind === 'category' ? resolveCategoryName : undefined);
}

function openRecurrenceInspector() {
  const previousFocus = document.activeElement;
  let dialog = document.getElementById('recurrenceInspector');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'recurrenceInspector';
    dialog.style.cssText = 'width:min(720px,calc(100% - 24px));max-height:85dvh;margin:auto;padding:20px;border:1px solid #ced6db;border-radius:8px;background:#fff;color:#202a30;box-sizing:border-box;overflow:auto';
    dialog.setAttribute('aria-labelledby', 'recurrenceInspectorTitle');
    document.body.appendChild(dialog);
  }
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const month = getCurrentMonth();
  const options = getContinuousCalendarOptions();
  const entries = isContinuousCalendarEnabled()
    ? window.ContinuousCalendar.inspect(continuousCalendarModel, month, data, options) : [];
  const monthLabel = id => options.month(id)?.nome || id;
  const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  dialog.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><h2 id="recurrenceInspectorTitle" style="font-size:20px;margin:0">Recorrencias</h2><button type="button" class="btn" aria-label="Fechar recorrencias" autofocus>Fechar</button></div>
    <p>Somente consulta. A partir de ${escape(month.nome)}; proximas 3 ocorrencias em ate 36 meses.</p>
    ${entries.length ? entries.map(entry => {
      const payload = entry.payload;
      const title = payload.description || payload.fonte || payload.descricao || payload.nome || 'Recorrencia';
      return `<section style="border-top:1px solid #dce2e5;padding:16px 0;overflow-wrap:anywhere"><h3 style="margin:0 0 8px;font-size:16px">${escape(title)}</h3>
        <div>Origem: ${escape(monthLabel(entry.sourceMonth))} | ${entry.collection === 'renda' ? 'Renda fixa' : entry.collection === 'projetos' ? 'Entrada extra' : 'Saida'}${entry.stopped ? ' | Interrompida' : ''}</div>
        <details><summary>Vigencia e alteracoes</summary><ul>${entry.versions.map(version => `<li>${escape(options.monthAtOrdinal(version.from)?.nome)}: ${version.stopped ? 'Interrompida' : 'Inicio ou alteracao'}</li>`).join('')}</ul></details>
        <ul style="padding-left:20px">${entry.occurrences.map(({ month: target, item, exception }) => {
          const card = (data.find(value => value.id === target.id)?.outflowCards || window.ContinuousCalendar.project(continuousCalendarModel, target, options).outflowCards || []).find(value => value.id === item.outputRef);
          const date = item.date || item.dataRecebimento || '';
          return `<li style="margin:8px 0">${escape(target.nome)}: ${escape(date)} - ${escape(money(item.amount ?? item.valor))}${item.outputKind === 'card' ? ` | Cartao: ${escape(card?.name || item.outputRef)}` : ''}${exception ? ` | ${exception === 'paid' ? 'Ja pago (excecao do mes)' : 'Alterado somente neste mes'}` : ''}</li>`;
        }).join('') || '<li>Sem ocorrencias previstas neste intervalo.</li>'}</ul>
        ${entry.exceptions.filter(value => value.kind === 'removed').map(value => `<div>Removida somente em ${escape(monthLabel(value.month))}.</div>`).join('')}
      </section>`;
    }).join('') : '<p>Nenhuma regra de recorrencia disponivel.</p>'}`;
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.onclose = () => previousFocus?.focus();
  if (!dialog.open) dialog.showModal();
}

function isContinuousCalendarEnabled() {
  return continuousCalendarModel?.version === window.ContinuousCalendar?.VERSION && !!continuousCalendarSession;
}

function getContinuousCalendarOptions() {
  const monthNames = Object.keys(MONTH_INDEX);
  const fromId = id => {
    const [, year] = String(id || '').split('_');
    const index = monthNames.findIndex(value => getMonthIdFromParts(value, year) === id);
    return { id, nome: `${monthNames[Math.max(0, index)]} ${year}` };
  };
  return {
    start: getRealCurrentMonthSortValue(),
    sort: getMonthSortValue,
    month: fromId,
    monthAtOrdinal: ordinal => Number.isFinite(ordinal) ? fromId(getMonthIdFromParts(monthNames[ordinal % 12], Math.floor(ordinal / 12))) : null,
    blank: month => buildBlankMonth(getMonthDateFromMonthObject(month)),
    projectSettings: (payload, month, source) => {
      payload.outflowCards = (payload.outflowCards || []).map(card => ({
        ...card,
        closingDate: getUnifiedCardDateForMonth(card.closingDate, source, month),
        paymentDate: getUnifiedCardDateForMonth(card.paymentDate, source, month)
      }));
    },
    normalize: month => {
      normalizeMonth(month);
      ensureUnifiedOutflowPilotMonth(month);
      if (month.selectionVisibility?.version >= 2) {
        (month.outflows || []).forEach(item => {
          if (item.category) month.selectionVisibility.categories[item.category] = true;
          const tag = String(item.tag || '').trim().toLocaleLowerCase('pt-BR');
          if (tag) month.selectionVisibility.tags[tag] = true;
        });
      }
      recalcTotals(month);
    },
    occurrence: (collection, payload, month, source, offset) => {
      if (collection === 'renda') {
        return window.MesAtualIncomeRecurrence.cloneRecurringIncome({
          ...payload, dataRecebimento: /[\/-]/.test(String(payload.dataRecebimento || ''))
            ? getUnifiedCardDateForMonth(payload.dataRecebimento, source, month)
            : getRecurringIncomeReceiveDay(payload.dataRecebimento)
        }, payload.recurringGroupId || getIncomeRecurringGroupId(payload));
      }
      if (collection === 'projetos') {
        return cloneProjetoRecurringForMonth(payload, getMonthDateFromMonthObject(month), Number(payload.recurringInstallmentIndex || 1) + offset);
      }
      const result = cloneUnifiedOutflowForMonth(payload, getMonthDateFromMonthObject(month), source);
      result.installmentIndex = Number(payload.installmentIndex || 1) + offset;
      if (Number(payload.installmentsTotal || 1) <= 1) result.installmentIndex = 1;
      result.paid = false;
      result.status = 'planned';
      result.sharedParticipants = (result.sharedParticipants || []).map(person => ({ ...person, paid: false }));
      return result;
    }
  };
}

function restoreContinuousCalendar(model, months) {
  continuousCalendarModel = model?.version === window.ContinuousCalendar.VERSION ? model : null;
  continuousCalendarSession = null;
  if (!continuousCalendarModel) return months;
  continuousCalendarSession = window.ContinuousCalendar.createSession(continuousCalendarModel, getContinuousCalendarOptions());
  const hydrated = months.map(month => continuousCalendarSession.hydrate(month));
  return hydrated;
}

function ensureContinuousCalendarWindow() {
  if (!isContinuousCalendarEnabled()) return;
  const now = new Date();
  const year = now.getFullYear();
  for (let targetYear = year; targetYear <= year + 1; targetYear += 1) {
    Object.keys(MONTH_INDEX).forEach(monthName => {
      const id = getMonthIdFromParts(monthName, targetYear);
      if (data.some(month => month.id === id)) return;
      const month = buildBlankMonth(new Date(targetYear, MONTH_INDEX[monthName], 1));
      data.push(continuousCalendarSession.virtual(month));
    });
  }
  sortDataChronologically();
}

function serializeContinuousCalendarMonths() {
  return isContinuousCalendarEnabled() ? continuousCalendarSession.serialize(data) : data;
}

function updateContinuousCalendarRule(month, collection, item) {
  if (!isContinuousCalendarEnabled()) return false;
  continuousCalendarSession.upsert(data, month, collection, item);
  return true;
}

function stopContinuousCalendarRule(month, collection, key) {
  if (!isContinuousCalendarEnabled()) return false;
  continuousCalendarSession.stop(data, month, collection, key);
  return true;
}

function updateContinuousCalendarCards(month, cardId = '') {
  if (!isContinuousCalendarEnabled()) return false;
  window.ContinuousCalendar.updateCards(continuousCalendarModel, month, getContinuousCalendarOptions(), cardId);
  return true;
}

function changeContinuousCalendarCard(month, cardId, targetCardId = '') {
  if (!isContinuousCalendarEnabled()) return false;
  window.ContinuousCalendar.changeCard(continuousCalendarModel, month, cardId, targetCardId, getContinuousCalendarOptions());
  return true;
}

async function migrateToContinuousCalendar() {
  if (isContinuousCalendarEnabled() && continuousCalendarModel.recurrenceRevision >= window.ContinuousCalendar.RECURRENCE_REVISION && continuousCalendarModel.cardOutputRevision >= 1) return;
  try {
    const response = await fetch('/api/backups/manual', {
      method: 'POST', credentials: 'same-origin',
      headers: getCsrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify({ note: 'Antes da migracao ou reparo de recorrencias do calendario continuo' })
    });
    if (!response.ok) throw new Error(`Backup indisponivel (${response.status})`);
    data.forEach(month => { normalizeMonth(month); ensureUnifiedOutflowPilotMonth(month); });
    const existing = isContinuousCalendarEnabled();
    const storedMonths = existing ? serializeContinuousCalendarMonths() : data;
    const model = existing
      ? JSON.parse(JSON.stringify(continuousCalendarModel))
      : window.ContinuousCalendar.createModel(data, getContinuousCalendarOptions());
    if (existing) window.ContinuousCalendar.repairRecurringRules(model, data, getContinuousCalendarOptions());
    window.ContinuousCalendar.repairLegacyCardOutputs(JSON.parse(JSON.stringify(model)), storedMonths, getContinuousCalendarOptions());
    window.ContinuousCalendar.repairLegacyCardOutputs(model, data, getContinuousCalendarOptions());
    data = restoreContinuousCalendar(model, storedMonths);
    ensureContinuousCalendarWindow();
    save(true);
    buildMonthSelect();
    renderAll();
    if (window.MobileV2?.isEnabled?.()) window.MobileV2.refresh();
  } catch (error) {
    console.error('[calendar] Migracao pendente:', error?.message || error);
    if (typeof showAppStatus === 'function') showAppStatus('Nao foi possivel preparar o calendario. Recarregue para tentar novamente.', 'Calendario', 'error');
  }
}
