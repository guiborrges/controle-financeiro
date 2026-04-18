function getMonthMetricTitleStorageKey(metricKey) {
  return MONTH_METRIC_TITLE_STORAGE_KEY_MAP[metricKey] || '';
}

function getUnifiedOutflowTypeLabel(item) {
  if (!item) return 'Gasto';
  if (item.recurringSpend === true) return 'Gasto recorrente';
  return item.type === 'fixed' ? 'Despesa fixa' : 'Gasto';
}

function normalizeLegacyLookup(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function getLegacyExpenseSemanticCategory(name) {
  const lookup = normalizeLegacyLookup(name);
  if (!lookup) return 'OUTROS';
  if (lookup === 'DAS') return 'IMPOSTO';
  if (lookup.includes('PARCELA APARTAMENTO')) return 'FINANCIAMENTO';
  if (lookup.includes('ALUGUEL')) return 'CASA';
  if (lookup.includes('CONDOMINIO') || lookup.includes('IPTU') || lookup === 'AGUA' || lookup === 'ÁGUA' || lookup.includes('ENERGIA') || lookup === 'GAS' || lookup === 'GÁS') return 'CASA';
  if (lookup.includes('INTERNET') || lookup.includes('CELULAR') || lookup.includes('TELEFONE')) return 'ASSINATURAS';
  if (lookup.includes('SEGURO')) return 'PROTEÇÃO';
  if (lookup.includes('ACADEMIA')) return 'SAÚDE';
  if (lookup.includes('RESERVA')) return 'RESERVA';
  if (lookup.includes('CARTAO') || lookup.includes('CARTÃO')) return 'CARTÃO DE CRÉDITO';
  return resolveCategoryName(name || 'OUTROS');
}

function getGuilhermeRequiredCardSpecFromName(name) {
  const lookup = normalizeLegacyLookup(name);
  if (!lookup) return null;
  if (lookup === 'XP') return GUILHERME_REQUIRED_CARDS[0];
  if (lookup === 'NUBANK') return GUILHERME_REQUIRED_CARDS[1];
  if (lookup === 'INTER' || lookup === 'BANCO INTER') return GUILHERME_REQUIRED_CARDS[2];
  return null;
}

function isLikelyBlankLegacyDescription(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  const lookup = normalizeLegacyLookup(text);
  return lookup === 'GASTO' || lookup === 'ASSINATURAS' || lookup === 'OUTROS';
}
