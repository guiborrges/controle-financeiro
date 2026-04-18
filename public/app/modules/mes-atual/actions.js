function setUnifiedOutflowFilter(value) {
  const month = getCurrentMonth();
  if (!month) return;
  ensureUnifiedOutflowPilotMonth(month);
  month.unifiedOutflowUi.filter = String(value || 'all');
  saveUIState();
  preserveCurrentScroll(() => renderMes());
}

function setUnifiedOutflowTagFilter(value) {
  const month = getCurrentMonth();
  if (!month) return;
  ensureUnifiedOutflowPilotMonth(month);
  month.unifiedOutflowUi.tagFilter = String(value || '').trim();
  saveUIState();
  preserveCurrentScroll(() => renderMes());
}

function setUnifiedOutflowSearch(value) {
  const month = getCurrentMonth();
  if (!month) return;
  ensureUnifiedOutflowPilotMonth(month);
  month.unifiedOutflowUi.allSearch = String(value || '');
  saveUIState();
  preserveCurrentScroll(() => renderMes());
}

function toggleUnifiedOutflowCategory(category) {
  const key = `${getUnifiedOutflowPilotKey(getCurrentMonth())}::${category}`;
  unifiedOutflowExpandedCategories[key] = !unifiedOutflowExpandedCategories[key];
  renderUnifiedMonthPilot(getCurrentMonth());
}

function toggleUnifiedSpendCategorySelection(category, checked) {
  const month = getCurrentMonth();
  if (!month) return;
  ensureUnifiedOutflowPilotMonth(month);
  const normalized = resolveCategoryName(category || 'OUTROS');
  const state = ensureUnifiedSpendCategorySelectionState(month, [normalized]);
  state[normalized] = checked === true;
  month.unifiedOutflowUi.spendCategorySelection = state;
  saveUIState();
  preserveCurrentScroll(() => renderMes());
}

function setUnifiedOutflowSort(field) {
  const month = getCurrentMonth();
  if (!month) return;
  ensureUnifiedOutflowPilotMonth(month);
  const current = getUnifiedOutflowSort(month);
  if (current.field === field) {
    month.unifiedOutflowUi.sortDirection = current.direction === 'asc' ? 'desc' : 'asc';
  } else {
    month.unifiedOutflowUi.sortField = field;
    month.unifiedOutflowUi.sortDirection = field === 'descricao' || field === 'categoria' || field === 'tipo' || field === 'saida' ? 'asc' : 'desc';
  }
  saveUIState();
  renderUnifiedMonthPilot(month);
}

function ensureMonthSectionOrder() {
  const page = document.getElementById('page-mes');
  if (!page) return;
  const config = getMonthSectionConfig();
  monthSectionOrder = sanitizeMonthSectionOrder(monthSectionOrder);
  monthSectionOrder
    .map(key => config.find(item => item.key === key)?.id)
    .map(id => document.getElementById(id))
    .filter(Boolean)
    .forEach(node => page.appendChild(node));
  ensureMonthSectionDragHandles();
}

function getMonthSectionConfig() {
  return [
    { id: 'section-renda', key: 'renda' },
    { id: 'section-goals', key: 'goals' },
    { id: 'section-despesas', key: 'despesas' },
    { id: 'section-daily', key: 'daily' },
    { id: 'section-projetos', key: 'projetos' },
    { id: 'section-reembolsos', key: 'reembolsos' },
    { id: 'section-observacoes', key: 'observacoes' }
  ];
}

function ensureMonthSectionDragHandles() {
  getMonthSectionConfig().forEach(({ id, key }) => {
    const section = document.getElementById(id);
    const head = section?.querySelector('.section-head');
    const actions = head?.querySelector('.section-actions') || head?.lastElementChild;
    if (!section || !head || !actions) return;
    section.dataset.sectionKey = key;
    section.addEventListener('dragover', onMonthSectionDragOver);
    section.addEventListener('dragleave', onMonthSectionDragLeave);
    section.addEventListener('drop', onMonthSectionDrop);
    if (actions.querySelector('.month-section-drag-handle')) return;
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'btn btn-ghost btn-subtle-color month-section-drag-handle';
    handle.title = 'Arrastar bloco';
    handle.setAttribute('aria-label', 'Arrastar bloco');
    handle.setAttribute('draggable', 'true');
    handle.innerHTML = '<span></span><span></span>';
    handle.addEventListener('dragstart', event => onMonthSectionDragStart(event, key));
    handle.addEventListener('dragend', onMonthSectionDragEnd);
    actions.insertBefore(handle, actions.firstChild);
  });
}

function onMonthSectionDragStart(event, key) {
  dragMonthSectionKey = key;
  const section = event.currentTarget?.closest('.section');
  if (section) section.classList.add('dragging-section');
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
  }
}

function onMonthSectionDragEnd() {
  dragMonthSectionKey = '';
  document.querySelectorAll('#page-mes .section').forEach(section => {
    section.classList.remove('drag-target', 'dragging-section');
  });
}

function onMonthSectionDragOver(event) {
  event.preventDefault();
  const section = event.currentTarget;
  const targetKey = section?.dataset?.sectionKey;
  if (!targetKey || !dragMonthSectionKey || targetKey === dragMonthSectionKey) return;
  section.classList.add('drag-target');
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
}

function onMonthSectionDragLeave(event) {
  const section = event.currentTarget;
  if (section) section.classList.remove('drag-target');
}

function onMonthSectionDrop(event) {
  event.preventDefault();
  const targetKey = event.currentTarget?.dataset?.sectionKey;
  const fromKey = dragMonthSectionKey || (event.dataTransfer ? event.dataTransfer.getData('text/plain') : '');
  if (!fromKey || !targetKey || fromKey === targetKey) return;
  recordHistoryState();
  const next = monthSectionOrder.filter(key => key !== fromKey);
  const targetIndex = next.indexOf(targetKey);
  next.splice(targetIndex, 0, fromKey);
  monthSectionOrder = sanitizeMonthSectionOrder(next);
  saveMonthSectionOrder();
  saveUIState();
  renderMes();
}

function getMonthSectionCollapseState() {
  return Storage.getJSON(STORAGE_KEYS.monthSectionCollapsed, {}) || {};
}

function isMonthSectionCollapsed(key) {
  const state = getMonthSectionCollapseState();
  return state[key] === true;
}

function toggleMonthSectionCollapse(key) {
  const state = getMonthSectionCollapseState();
  recordHistoryState();
  state[key] = !state[key];
  Storage.setJSON(STORAGE_KEYS.monthSectionCollapsed, state);
  saveUIState();
  flushServerStorage(true);
  renderMes();
}

function applyMonthSectionCollapseStates() {
  [
    { id: 'section-despesas', key: 'despesas' },
    { id: 'section-daily', key: 'daily' },
    { id: 'section-renda', key: 'renda' },
    { id: 'section-goals', key: 'goals' },
    { id: 'section-projetos', key: 'projetos' },
    { id: 'section-reembolsos', key: 'reembolsos' },
    { id: 'section-observacoes', key: 'observacoes' }
  ].forEach(({ id, key }) => {
    const section = document.getElementById(id);
    const toggle = document.getElementById(`toggle-section-${key}`);
    if (!section || !toggle) return;
    const collapsed = isMonthSectionCollapsed(key);
    section.classList.toggle('is-collapsed', collapsed);
    toggle.textContent = collapsed ? '+' : '−';
    toggle.title = collapsed ? 'Maximizar quadro' : 'Minimizar quadro';
  });
}

function setRendaSort(field) {
  if (rendaSort.field === field) {
    rendaSort.direction = rendaSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    rendaSort = { field, direction: 'asc' };
  }
  preserveCurrentScroll(() => renderMes());
}

function setProjSort(field) {
  if (projSort.field === field) {
    projSort.direction = projSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    projSort = { field, direction: 'asc' };
  }
  preserveCurrentScroll(() => renderMes());
}

function setDespSort(field) {
  if (despSort.field === field) {
    despSort.direction = despSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    despSort = { field, direction: 'asc' };
  }
  preserveCurrentScroll(() => renderMes());
}

function setDespCategoriaFiltro(cat) {
  despCategoriaFiltro = cat || 'TODAS';
  preserveCurrentScroll(() => renderMes());
}
