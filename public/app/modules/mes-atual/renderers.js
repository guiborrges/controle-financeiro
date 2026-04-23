function renderUnifiedOutflowTagFilterOptions(month, selectedValue) {
  const options = getUnifiedOutflowTagFilterOptions(month);
  if (!options.length) return '<option value="">Tag</option>';
  return ['<option value="">Tag: todas</option>']
    .concat(options.map(tag => `<option value="${escapeHtml(tag)}" ${tag === selectedValue ? 'selected' : ''}>Tag: ${escapeHtml(tag)}</option>`))
    .join('');
}

function renderUnifiedOutflowFilterOptions(month, selectedValue) {
  const options = getUnifiedOutflowFilterOptions(month);
  const standalone = options
    .filter(option => option.value === 'expense')
    .map(option => `<option value="${option.value}" ${option.value === selectedValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
    .join('');

  const groups = new Map();
  options
    .filter(option => option.value !== 'expense')
    .forEach(option => {
      const group = option.group || 'Outros';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(option);
    });

  const grouped = Array.from(groups.entries()).map(([group, groupedOptions]) => (
    `<optgroup label="${escapeHtml(group)}">${groupedOptions.map(option => `<option value="${option.value}" ${option.value === selectedValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</optgroup>`
  )).join('');

  return `${standalone}${grouped}`;
}

function renderUnifiedSummaryCard(label, value, note = '', tone = '') {
  return `<div class="unified-summary-item"><div class="unified-summary-label">${escapeHtml(label)}</div><div class="unified-summary-value ${tone}">${escapeHtml(value)}</div>${note ? `<div class="unified-summary-note">${escapeHtml(note)}</div>` : ''}</div>`;
}

function renderUnifiedSortLabel(month, field, label) {
  const sort = getUnifiedOutflowSort(month);
  if (sort.field !== field) return label;
  return `${label}${sort.direction === 'asc' ? ' ▲' : ' ▼'}`;
}
