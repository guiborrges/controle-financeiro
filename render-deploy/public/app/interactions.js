function onMonthMetricDragStart(event, key) {
  dragMonthMetricKey = key;
  const card = event.currentTarget;
  if (card) card.classList.add('dragging');
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
  }
}

function onMonthMetricDragEnd() {
  dragMonthMetricKey = '';
  document.querySelectorAll('#mesMetrics .metric-card').forEach(card => {
    card.classList.remove('dragging', 'drag-target');
  });
}

function onMonthMetricDragOver(event) {
  event.preventDefault();
  const card = event.currentTarget;
  if (!card || !dragMonthMetricKey || card.dataset.metricKey === dragMonthMetricKey) return;
  card.classList.add('drag-target');
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
}

function onMonthMetricDragLeave(event) {
  const card = event.currentTarget;
  if (card) card.classList.remove('drag-target');
}

function onMonthMetricDrop(event, targetKey) {
  event.preventDefault();
  const fromKey = dragMonthMetricKey || (event.dataTransfer ? event.dataTransfer.getData('text/plain') : '');
  if (!fromKey || !targetKey || fromKey === targetKey) return;
  const next = monthMetricOrder.filter(key => key !== fromKey);
  const targetIndex = next.indexOf(targetKey);
  next.splice(targetIndex, 0, fromKey);
  monthMetricOrder = sanitizeMonthMetricOrder(next);
  saveMonthMetricOrder();
  saveUIState();
  renderMes();
}

function resetDraggableModalPosition(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (!dialog) return;
  dialog.style.position = '';
  dialog.style.left = '';
  dialog.style.top = '';
  dialog.style.margin = '';
  requestAnimationFrame(() => {
    const rect = dialog.getBoundingClientRect();
    dialog.style.position = 'absolute';
    dialog.style.left = `${Math.max(16, (window.innerWidth - rect.width) / 2)}px`;
    dialog.style.top = `${Math.max(16, (window.innerHeight - rect.height) / 2)}px`;
    dialog.style.margin = '0';
  });
}

function startModalDrag(event, dialogId) {
  if (event.target.closest('button')) return;
  const dialog = document.getElementById(dialogId);
  if (!dialog) return;
  const rect = dialog.getBoundingClientRect();
  modalDragState = {
    dialogId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  };
  dialog.classList.add('dragging');
  event.preventDefault();
}

function moveDraggedModal(event) {
  if (!modalDragState) return;
  const dialog = document.getElementById(modalDragState.dialogId);
  if (!dialog) return;
  const maxLeft = Math.max(16, window.innerWidth - dialog.offsetWidth - 16);
  const maxTop = Math.max(16, window.innerHeight - dialog.offsetHeight - 16);
  const left = Math.min(Math.max(16, event.clientX - modalDragState.offsetX), maxLeft);
  const top = Math.min(Math.max(16, event.clientY - modalDragState.offsetY), maxTop);
  dialog.style.left = `${left}px`;
  dialog.style.top = `${top}px`;
}

function stopModalDrag() {
  if (!modalDragState) return;
  const dialog = document.getElementById(modalDragState.dialogId);
  if (dialog) dialog.classList.remove('dragging');
  modalDragState = null;
}

function openModal(id) {
  const el = document.getElementById(id);
  el.classList.add('open');
  if (id === 'modalVar') resetDraggableModalPosition('modalVarDialog');
}

function closeModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('open');
  if (id === 'modalVar') stopModalDrag();
}

function showAppStatus(message, title = 'Aviso', tone = 'error') {
  const box = document.getElementById('appStatus');
  const titleEl = document.getElementById('appStatusTitle');
  const msgEl = document.getElementById('appStatusMessage');
  const iconEl = document.getElementById('appStatusIcon');
  if (!box || !titleEl || !msgEl || !iconEl) return;
  box.classList.add('open');
  box.classList.toggle('ok', tone === 'ok');
  titleEl.textContent = title;
  msgEl.textContent = message;
  iconEl.textContent = tone === 'ok' ? 'OK' : '!';
}

function hideAppStatus() {
  const box = document.getElementById('appStatus');
  if (!box) return;
  box.classList.remove('open', 'ok');
}

function bindRuntimeErrorHandling() {
  window.addEventListener('error', event => {
    const message = event?.error?.message || event?.message || 'Ocorreu um erro inesperado.';
    showAppStatus(
      `${message}\nRecarregue a pagina. Se continuar, use o backup local antes de importar ou editar de novo.`,
      'Erro no app',
      'error'
    );
  });
  window.addEventListener('unhandledrejection', event => {
    const reason = event?.reason;
    const message = typeof reason === 'string'
      ? reason
      : reason?.message || 'Uma operacao falhou antes de terminar.';
    showAppStatus(
      `${message}\nA interface tentou continuar, mas vale recarregar a pagina.`,
      'Falha de execucao',
      'error'
    );
  });
}

function runStartupSelfCheck() {
  const requiredIds = ['page-dashboard', 'page-mes', 'monthSelect', 'dashMetrics', 'dashboardWidgets'];
  const missing = requiredIds.filter(id => !document.getElementById(id));
  if (missing.length) {
    showAppStatus(
      `Faltam elementos importantes da interface: ${missing.join(', ')}.`,
      'Interface incompleta',
      'error'
    );
    return false;
  }
  return true;
}

function bindGlobalInteractions() {
  bindRuntimeErrorHandling();
  window.addEventListener('beforeunload', () => {
    saveUIState();
    flushServerStorage(true);
  });
  window.addEventListener('scroll', saveUIState, { passive: true });
  document.addEventListener('click', e => {
    if (!dashSeriesPickerOpen) return;
    const wrap = document.getElementById('dashSeriesControls');
    if (wrap && !wrap.contains(e.target)) {
      dashSeriesPickerOpen = false;
      renderDashSeriesControls();
    }
  });
  document.addEventListener('click', e => {
    if (!dashSeriesColorPicker.open) return;
    const picker = document.querySelector('[data-dash-color-picker="true"]');
    if (picker && picker.contains(e.target)) return;
    closeDashSeriesColorPicker();
  });
  document.addEventListener('click', e => {
    if (!categoryColorPicker.open) return;
    const picker = document.querySelector('[data-cat-color-picker="true"]');
    if (picker && picker.contains(e.target)) return;
    closeCategoryColorPicker();
  });
  document.addEventListener('click', e => {
    if (!monthSectionColorPicker.open) return;
    const picker = document.querySelector('[data-month-section-color-picker="true"]');
    if (picker && picker.contains(e.target)) return;
    if (e.target.closest('.btn-subtle-color')) return;
    closeMonthSectionColorPicker();
  });
  window.addEventListener('keydown', e => {
    const key = (e.key || '').toLowerCase();
    const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'z';
    const isRedo = ((e.ctrlKey || e.metaKey) && key === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'z');
    if (!isUndo && !isRedo) return;
    const activePageId = document.querySelector('.page.active')?.id;
    if (activePageId !== 'page-mes') return;
    e.preventDefault();
    if (isUndo) undoLastChange();
    if (isRedo) redoLastChange();
  });
  document.querySelectorAll('.modal-bg').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target !== el) return;
      if (el.id === 'modalVar') return;
      el.classList.remove('open');
    });
  });
  document.addEventListener('mousemove', moveDraggedModal);
  document.addEventListener('mouseup', stopModalDrag);
  document.addEventListener('mousemove', moveDashboardWidgetDrag);
  document.addEventListener('mouseup', stopDashboardWidgetDrag);
  document.addEventListener('mousemove', moveDashboardWidgetResize);
  document.addEventListener('mouseup', stopDashboardWidgetResize);
}

function openEditMonth() {
  alert('Edite os dados diretamente nas tabelas com duplo clique sobre o campo desejado.');
}
