const CATEGORY_EDITOR_EMOJI_OPTIONS_GRID = [
  '🏷️','🍽️','🚗','💊','🎬','🛍️','📱','🏠','🎓','🐶','🧾','🎁','💼','🛡️','📈','💳','🏦','📦','🎯','✈️',
  '🧠','💡','🍔','☕','🍕','🥗','🛒','🚕','🚌','⚽','🅿️','🏥','🧪','🧴','🎮','🎵','📚','🏋️','🧘','🏖️',
  '🧳','🏨','🎟️','🎉','👶','🐱','🐾','🏡','🔧','🧰','🧺','💰','💵','💸','📓','📝','🌐','🔒','🧱','🧑‍💻',
  '📸','🎨','🏐','🏐','🎾','🚴','🧑‍🍳','🪙','🪪','🧷'
];

let expandedCategoryEditorGroups = {};
let expandedTagEditorGroups = {};
let categoryEditorEntriesCache = { key: '', entries: [] };
let categoryEditorEditStateV2 = { category: '', emoji: '🏷️' };
let categoryEditorDeleteStateV2 = { category: '' };

CATEGORY_EDITOR_EMOJI_OPTIONS_GRID.push(
  '🛠️','🪴','🧹','🧽','🧯','🔌','🛜','🏪','🏢','🏭','🏗️','🚇','🚆','🛵','⛽','🛞','🛣️','🚘','🏍️','🛻',
  '📺','🖥️','⌚','🧮','🗂️','📅','📤','📥','📊','📉','🩺','🩹','⚕️','🍼','🧒','👶','🍎','🥛','🥐','🍣',
  '🌽','🧃','🍞','🥩','🧀','🫒','🧇','🍝','🍱','🪥','🪒','🧼','🧻','🪠','🚿','🛁','🧊','🌳','🪵','🌱',
  '🌸','🧳','🗺️','🪙','🏛️','🏫','🧑‍💻','🧑‍🏫','🧑‍🔧','🧑‍⚕️','🧑‍🌾','🧑‍🚒','🧑‍⚖️','🧑‍🎓','🏁','🏅','⚙️'
);

function categoryEditorSafeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function clearCategoryEditorCacheV2() {
  categoryEditorEntriesCache = { key: '', entries: [] };
}

function categoryEditorEscapedValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getCategoryEditorEntriesCacheKey() {
  const months = Array.isArray(data) ? data : [];
  let outflowCount = 0;
  let outflowTotalCents = 0;
  months.forEach(month => {
    (month?.outflows || []).forEach(item => {
      outflowCount += 1;
      outflowTotalCents += Math.round(Number(item?.amount || 0) * 100);
    });
  });
  const renameKeys = Object.keys(categoryRenameMap || {}).sort().join(',');
  const renameValues = Object.values(categoryRenameMap || {}).sort().join(',');
  const emojiKeys = Object.keys(categoryEmojiOverrides || {}).sort().join(',');
  return `${months.length}|${outflowCount}|${outflowTotalCents}|${renameKeys}|${renameValues}|${emojiKeys}`;
}

function getRealCategoryEntries() {
  const cacheKey = getCategoryEditorEntriesCacheKey();
  if (categoryEditorEntriesCache.key === cacheKey) return categoryEditorEntriesCache.entries;
  const map = new Map();
  const ensureCategory = category => {
    const resolved = resolveCategoryName(category || 'OUTROS');
    if (!resolved) return '';
    if (typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(resolved)) return '';
    if (!map.has(resolved)) map.set(resolved, []);
    return resolved;
  };

  (typeof getAllUserCategoryCandidates === 'function' ? getAllUserCategoryCandidates() : []).forEach(ensureCategory);
  (data || []).forEach(month => {
    (month?.outflows || []).forEach(item => {
      const category = ensureCategory(item?.category || 'OUTROS');
      if (!category) return;
      map.get(category).push({
        monthId: month.id,
        monthName: month.nome,
        itemId: item.id,
        item
      });
    });
  });

  const entries = Array.from(map.entries())
    .map(([category, launches]) => ({
      category,
      launches,
      total: launches.reduce((acc, launch) => acc + Number(launch?.item?.amount || 0), 0)
    }))
    .sort((a, b) => a.category.localeCompare(b.category, 'pt-BR'));
  categoryEditorEntriesCache = { key: cacheKey, entries };
  return entries;
}

function applyCategoryTransitionV2(sourceCategory, targetCategory) {
  const source = resolveCategoryName(sourceCategory || '');
  const target = resolveCategoryName(targetCategory || '');
  if (!source || !target || source === target) return false;

  (data || []).forEach(month => {
    (month?.outflows || []).forEach(item => {
      if (resolveCategoryName(item?.category || 'OUTROS') === source) item.category = target;
    });
    (month?.gastosVar || []).forEach(item => {
      if (resolveCategoryName(item?.categoria || 'OUTROS') === source) item.categoria = target;
    });
    (month?.despesas || []).forEach(item => {
      if (resolveCategoryName(item?.categoria || 'OUTROS') === source) item.categoria = target;
    });
    if (month?.dailyGoals && Object.prototype.hasOwnProperty.call(month.dailyGoals, source)) {
      month.dailyGoals[target] = Number(month.dailyGoals[target] || 0) + Number(month.dailyGoals[source] || 0);
      delete month.dailyGoals[source];
    }
    if (month?.categorias && Object.prototype.hasOwnProperty.call(month.categorias, source)) {
      month.categorias[target] = Number(month.categorias[target] || 0) + Number(month.categorias[source] || 0);
      delete month.categorias[source];
    }
    if (Array.isArray(month?.dailyCategorySeeds)) {
      month.dailyCategorySeeds = month.dailyCategorySeeds.map(cat => (
        resolveCategoryName(cat || 'OUTROS') === source ? target : resolveCategoryName(cat || 'OUTROS')
      ));
    }
    if (month?.unifiedOutflowUi?.spendCategorySelection && typeof month.unifiedOutflowUi.spendCategorySelection === 'object') {
      const selection = month.unifiedOutflowUi.spendCategorySelection;
      if (Object.prototype.hasOwnProperty.call(selection, source)) {
        if (!Object.prototype.hasOwnProperty.call(selection, target)) selection[target] = selection[source];
        delete selection[source];
      }
    }
    syncUnifiedOutflowLegacyData(month);
  });

  if (categoryEmojiOverrides[source] && !categoryEmojiOverrides[target]) {
    categoryEmojiOverrides[target] = categoryEmojiOverrides[source];
  }
  delete categoryEmojiOverrides[source];
  categoryRenameMap[source] = target;
  Object.keys(categoryRenameMap || {}).forEach(key => {
    if (categoryRenameMap[key] === source) categoryRenameMap[key] = target;
  });
  saveCategoryRenameMap();
  saveCategoryEmojis();
  return true;
}

function openCategoryEditorModal() {
  renderCategoryEditorList(getRealCategoryEntries());
  renderTagEditorList();
  openModal('modalCategoryEditor');
}

function toggleCategoryEditorGroup(category) {
  const key = resolveCategoryName(category || '');
  if (!key) return;
  expandedCategoryEditorGroups[key] = !expandedCategoryEditorGroups[key];
  renderCategoryEditorList();
}

function openCategoryEditModal(category) {
  const resolved = resolveCategoryName(category || '');
  if (!resolved) return;
  const input = document.getElementById('categoryEditNameInput');
  const grid = document.getElementById('categoryEditEmojiGrid');
  if (!input || !grid) return;
  const currentEmoji = categoryEmojiOverrides[resolved] || inferCategoryVisual(resolved).icon || '🏷️';
  categoryEditorEditStateV2 = { category: resolved, emoji: currentEmoji };
  input.value = resolved;
  renderCategoryEditEmojiGrid();
  openModal('modalCategoryEdit');
}

function renderCategoryEditEmojiGrid() {
  const grid = document.getElementById('categoryEditEmojiGrid');
  if (!grid) return;
  const selected = categoryEditorEditStateV2.emoji;
  grid.innerHTML = CATEGORY_EDITOR_EMOJI_OPTIONS_GRID.map(emoji => (
    `<button type="button" class="category-emoji-choice ${emoji === selected ? 'is-selected' : ''}" onclick="selectCategoryEditEmoji('${emoji}')">${emoji}</button>`
  )).join('');
}

function selectCategoryEditEmoji(emoji) {
  categoryEditorEditStateV2.emoji = String(emoji || '').trim() || '🏷️';
  renderCategoryEditEmojiGrid();
}

function closeCategoryEditModal() {
  closeModal('modalCategoryEdit');
}

function saveCategoryEditModal() {
  const source = resolveCategoryName(categoryEditorEditStateV2.category || '');
  const input = document.getElementById('categoryEditNameInput');
  const nextName = resolveCategoryName(input?.value || '');
  const nextEmoji = String(categoryEditorEditStateV2.emoji || '').trim() || '🏷️';
  if (!source || !nextName) {
    alert('Informe um nome válido para a categoria.');
    return;
  }
  if (typeof isNonRealCategoryLabel === 'function' && isNonRealCategoryLabel(nextName)) {
    alert('Esse nome representa forma de saída e não pode ser usado como categoria.');
    return;
  }

  recordHistoryState();
  let finalCategory = source;
  if (nextName !== source) {
    applyCategoryTransitionV2(source, nextName);
    finalCategory = nextName;
  }
  categoryEmojiOverrides[finalCategory] = nextEmoji;
  if (source !== finalCategory) delete categoryEmojiOverrides[source];
  saveCategoryRenameMap();
  saveCategoryEmojis();
  clearCategoryEditorCacheV2();
  save(true);
  closeCategoryEditModal();
  renderCategoryEditorList();
  renderTagEditorList();
  if (activePage === 'mes') renderMes();
  if (activePage === 'dashboard') renderDashboard();
}

function openCategoryDeleteModal(category) {
  const source = resolveCategoryName(category || '');
  if (!source) return;
  const entries = getRealCategoryEntries();
  const targetSelect = document.getElementById('categoryDeleteTargetSelect');
  const copy = document.getElementById('categoryDeleteCopy');
  if (!targetSelect || !copy) return;
  const targets = entries.map(entry => entry.category).filter(entryCategory => entryCategory !== source);
  if (!targets.length) {
    alert('Você precisa ter pelo menos outra categoria para transferir os lançamentos.');
    return;
  }
  categoryEditorDeleteStateV2 = { category: source };
  copy.textContent = `Todos os lançamentos de "${source}" serão transferidos para a categoria escolhida.`;
  targetSelect.innerHTML = targets.map(target => {
    const icon = typeof inferCategoryVisual === 'function'
      ? String(inferCategoryVisual(target)?.icon || '🏷️')
      : '🏷️';
    return `<option value="${escapeHtml(target)}">${escapeHtml(`${icon} ${target}`)}</option>`;
  }).join('');
  openModal('modalCategoryDelete');
}

function closeCategoryDeleteModal() {
  closeModal('modalCategoryDelete');
}

function confirmCategoryDeleteTransfer() {
  const source = resolveCategoryName(categoryEditorDeleteStateV2.category || '');
  const target = resolveCategoryName(document.getElementById('categoryDeleteTargetSelect')?.value || '');
  if (!source || !target || source === target) {
    alert('Selecione uma categoria de destino válida.');
    return;
  }
  recordHistoryState();
  applyCategoryTransitionV2(source, target);
  delete categoryEmojiOverrides[source];
  saveCategoryRenameMap();
  saveCategoryEmojis();
  clearCategoryEditorCacheV2();
  save(true);
  closeCategoryDeleteModal();
  renderCategoryEditorList();
  renderTagEditorList();
  if (activePage === 'mes') renderMes();
  if (activePage === 'dashboard') renderDashboard();
}

function openCategoryEditorLaunch(monthId, outflowId) {
  const month = (data || []).find(entry => entry.id === monthId);
  if (!month) return;
  closeModal('modalCategoryEditor');
  nav('mes');
  selectMonth(month.id);
  requestAnimationFrame(() => {
    openUnifiedOutflowModal(outflowId, { fromCategoryEditor: true });
  });
}

function getRealTagEntries() {
  const map = new Map();
  (data || []).forEach(month => {
    (month?.outflows || []).forEach(item => {
      const tag = String(item?.tag || '').trim();
      if (!tag) return;
      if (!map.has(tag)) map.set(tag, { tag, launches: 0, total: 0, items: [] });
      const entry = map.get(tag);
      entry.launches += 1;
      entry.total += Number(item?.amount || 0);
      entry.items.push({
        monthId: month.id,
        monthName: month.nome,
        itemId: item.id,
        item
      });
    });
  });
  return Array.from(map.values()).sort((a, b) => a.tag.localeCompare(b.tag, 'pt-BR'));
}

function applyTagRename(sourceTag, targetTag) {
  const source = String(sourceTag || '').trim();
  const target = String(targetTag || '').trim();
  if (!source || !target || source === target) return false;
  (data || []).forEach(month => {
    (month?.outflows || []).forEach(item => {
      if (String(item?.tag || '').trim().toLocaleLowerCase('pt-BR') === source.toLocaleLowerCase('pt-BR')) {
        item.tag = target;
      }
    });
  });
  return true;
}

function applyTagDelete(sourceTag) {
  const source = String(sourceTag || '').trim();
  if (!source) return false;
  (data || []).forEach(month => {
    (month?.outflows || []).forEach(item => {
      if (String(item?.tag || '').trim().toLocaleLowerCase('pt-BR') === source.toLocaleLowerCase('pt-BR')) {
        item.tag = '';
      }
    });
  });
  return true;
}

function editTagFromEditor(tag) {
  const source = categoryEditorSafeText(tag);
  if (!source) return;
  const next = categoryEditorSafeText(prompt('Novo nome da tag:', source));
  if (!next || next === source) return;
  recordHistoryState();
  if (!applyTagRename(source, next)) {
    undoStack.pop();
    return;
  }
  save(true);
  renderTagEditorList();
  if (activePage === 'mes') renderMes();
  if (activePage === 'dashboard') renderDashboard();
}

function deleteTagFromEditor(tag) {
  const source = categoryEditorSafeText(tag);
  if (!source) return;
  if (!confirm(`Remover a tag "${source}" de todos os lançamentos do usuário?`)) return;
  recordHistoryState();
  if (!applyTagDelete(source)) {
    undoStack.pop();
    return;
  }
  save(true);
  renderTagEditorList();
  if (activePage === 'mes') renderMes();
  if (activePage === 'dashboard') renderDashboard();
}

function toggleTagEditorGroup(tag) {
  const key = categoryEditorSafeText(tag);
  if (!key) return;
  expandedTagEditorGroups[key] = !expandedTagEditorGroups[key];
  renderTagEditorList();
}

function renderTagEditorList() {
  const container = document.getElementById('tagEditorList');
  if (!container) return;
  const entries = getRealTagEntries();
  if (!entries.length) {
    container.innerHTML = '<div class="text-muted" style="font-size:13px">Nenhuma tag cadastrada.</div>';
    return;
  }
  container.innerHTML = entries.map(entry => {
    const escapedTag = categoryEditorEscapedValue(entry.tag);
    const expanded = !!expandedTagEditorGroups[entry.tag];
    const launchesHtml = expanded
      ? `<table class="fin-table" style="margin-top:8px"><thead><tr><th>Mês</th><th>Descrição</th><th>Data</th><th>Valor</th><th></th></tr></thead><tbody>${(entry.items || []).map(launch => `
          <tr>
            <td>${escapeHtml(launch.monthName)}</td>
            <td>${escapeHtml(launch.item?.description || '—')}</td>
            <td>${escapeHtml(launch.item?.date || '—')}</td>
            <td class="amount amount-neg">${fmt(Number(launch.item?.amount || 0))}</td>
            <td><button class="btn btn-ghost" style="padding:4px 10px;font-size:12px" onclick="openCategoryEditorLaunch('${launch.monthId}','${launch.itemId}')">Editar lançamento</button></td>
          </tr>
        `).join('')}</tbody></table>`
      : '';
    return `
      <div class="category-editor-group" style="margin-bottom:8px">
        <div class="category-editor-group-head">
          <div class="category-editor-group-title" title="${escapeHtml(entry.tag)}">${escapeHtml(entry.tag)}</div>
          <div class="category-editor-meta">${entry.launches} lançamentos · ${fmt(entry.total)}</div>
          <div class="category-editor-inline-actions">
            <button class="btn-icon" title="Editar tag" onclick="editTagFromEditor('${escapedTag}')">✎</button>
            <button class="btn-icon" title="Excluir tag" onclick="deleteTagFromEditor('${escapedTag}')">✕</button>
            <button class="btn btn-ghost category-editor-toggle" type="button" onclick="toggleTagEditorGroup('${escapedTag}')">${expanded ? 'Ocultar lançamentos' : 'Ver lançamentos'}</button>
          </div>
        </div>
        ${expanded ? `<div class="category-editor-group-body">${launchesHtml}</div>` : ''}
      </div>
    `;
  }).join('');
}

function renderCategoryEditorList(entries = null) {
  const container = document.getElementById('categoryEditorList');
  if (!container) return;
  const safeEntries = Array.isArray(entries) ? entries : getRealCategoryEntries();
  if (!safeEntries.length) {
    container.innerHTML = '<div class="text-muted" style="font-size:13px">Nenhuma categoria real encontrada.</div>';
    return;
  }
  container.innerHTML = safeEntries.map(entry => {
    const escapedCategory = categoryEditorEscapedValue(entry.category);
    const expanded = !!expandedCategoryEditorGroups[entry.category];
    const launchesHtml = expanded
      ? `<table class="fin-table" style="margin-top:8px"><thead><tr><th>Mês</th><th>Descrição</th><th>Data</th><th>Valor</th><th></th></tr></thead><tbody>${entry.launches.map(launch => `
          <tr>
            <td>${escapeHtml(launch.monthName)}</td>
            <td>${escapeHtml(launch.item?.description || '—')}</td>
            <td>${escapeHtml(launch.item?.date || '—')}</td>
            <td class="amount amount-neg">${fmt(Number(launch.item?.amount || 0))}</td>
            <td><button class="btn btn-ghost" style="padding:4px 10px;font-size:12px" onclick="openCategoryEditorLaunch('${launch.monthId}','${launch.itemId}')">Editar lançamento</button></td>
          </tr>
        `).join('')}</tbody></table>`
      : '';
    return `
      <div class="category-editor-group">
        <div class="category-editor-group-head">
          <div class="category-editor-group-title" title="${escapeHtml(entry.category)}">${renderCategoryLabel(entry.category)}</div>
          <div class="category-editor-meta">${entry.launches.length} lançamentos · ${fmt(entry.total)}</div>
          <div class="category-editor-inline-actions">
            <button class="btn-icon" title="Editar categoria" onclick="openCategoryEditModal('${escapedCategory}')">✎</button>
            <button class="btn-icon" title="Excluir categoria" onclick="openCategoryDeleteModal('${escapedCategory}')">✕</button>
            <button class="btn btn-ghost category-editor-toggle" type="button" onclick="toggleCategoryEditorGroup('${escapedCategory}')">${expanded ? 'Ocultar lançamentos' : 'Ver lançamentos'}</button>
          </div>
        </div>
        ${expanded ? `<div class="category-editor-group-body">${launchesHtml}</div>` : ''}
      </div>
    `;
  }).join('');
}
