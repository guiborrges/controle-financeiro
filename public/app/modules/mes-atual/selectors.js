function getUnifiedOutflowSort(month) {
  const field = String(month?.unifiedOutflowUi?.sortField || '').trim();
  const direction = month?.unifiedOutflowUi?.sortDirection === 'asc' ? 'asc' : 'desc';
  return { field, direction };
}

function getUnifiedOutflowSearchValue(month) {
  const value = String(month?.unifiedOutflowUi?.allSearch || '').trim();
  return value;
}

function getUnifiedOutflowFilterOptions(month) {
  const options = [
    { value: 'expense', label: 'Resumo', group: 'Compromissos' },
    { value: 'all', label: 'Todos', group: 'Visão geral' },
    { value: 'spend', label: 'Gastos', group: 'Consumo' },
    { value: 'method:boleto', label: 'Boleto', group: 'Meios de saída' },
    { value: 'method:dinheiro', label: 'Dinheiro', group: 'Meios de saída' },
    { value: 'method:pix', label: 'Pix', group: 'Meios de saída' },
    { value: 'method:debito', label: 'Débito', group: 'Meios de saída' }
  ];
  (month?.outflowCards || []).forEach(card => options.push({ value: `card:${card.id}`, label: `Cartão • ${card.name}`, group: 'Cartões' }));
  return options;
}

function getUnifiedOutflowTagFilterOptions(month) {
  const tags = new Set();
  (month?.outflows || []).forEach(item => {
    const tag = String(item?.tag || '').trim();
    if (tag) tags.add(tag);
  });
  return Array.from(tags).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
