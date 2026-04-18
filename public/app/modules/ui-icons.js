function normalizeIconLookup(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const CATEGORY_ICON_RULES = [
  { icon: '🍽️', tone: 'expense', keywords: ['alimentacao', 'almoco', 'janta', 'cafe', 'restaurante', 'mercado', 'supermercado', 'feira', 'padaria', 'ifood', 'lanche', 'comida'] },
  { icon: '🚗', tone: 'info', keywords: ['transporte', 'uber', '99', 'combustivel', 'gasolina', 'etanol', 'diesel', 'estacionamento', 'pedagio', 'onibus', 'metro', 'carro'] },
  { icon: '💊', tone: 'expense', keywords: ['farmacia', 'remedio', 'medicamento', 'saude', 'dentista', 'medico', 'exame', 'terapia', 'hospital'] },
  { icon: '🎬', tone: 'goals', keywords: ['lazer', 'cinema', 'show', 'viagem', 'ferias', 'passeio', 'bar', 'festa', 'streaming'] },
  { icon: '🛍️', tone: 'goals', keywords: ['compra', 'compras', 'roupa', 'calcado', 'tenis', 'acessorio', 'presente', 'shopping'] },
  { icon: '📱', tone: 'info', keywords: ['internet', 'telefone', 'celular', 'whatsapp', 'chip', 'assinatura', 'netflix', 'spotify', 'prime', 'youtube'] },
  { icon: '🏠', tone: 'expense', keywords: ['aluguel', 'condominio', 'agua', 'luz', 'energia', 'gas', 'moradia', 'casa', 'iptu'] },
  { icon: '🎓', tone: 'info', keywords: ['faculdade', 'curso', 'livro', 'educacao', 'estudo', 'colegio', 'escola'] },
  { icon: '🐶', tone: 'goals', keywords: ['pet', 'veterinario', 'racao', 'animal', 'gato', 'cachorro'] },
  { icon: '🧾', tone: 'neutral', keywords: ['taxa', 'boleto', 'tarifa', 'imposto', 'cartao', 'fatura', 'juros', 'multa'] },
  { icon: '🎁', tone: 'goals', keywords: ['presente', 'social', 'aniversario', 'casamento'] },
  { icon: '💼', tone: 'income', keywords: ['salario', 'pagamento', 'renda', 'freela', 'freelance', 'servico', 'projeto', 'bonus', 'comissao'] },
  { icon: '🛡️', tone: 'wealth', keywords: ['reserva', 'emergencia', 'seguro', 'protecao'] },
  { icon: '📈', tone: 'wealth', keywords: ['investimento', 'cdi', 'tesouro', 'acao', 'acoes', 'fii', 'fundo', 'bolsa'] },
  { icon: '₿', tone: 'wealth', keywords: ['bitcoin', 'btc', 'cripto', 'ethereum', 'eth', 'solana', 'usdt'] },
  { icon: '🏦', tone: 'wealth', keywords: ['banco', 'conta corrente', 'corrente', 'poupanca', 'caixinha', 'caixa'] },
  { icon: '📦', tone: 'neutral', keywords: ['outros', 'outro', 'geral', 'diversos'] }
];

const PATRIMONIO_ICON_RULES = [
  { icon: '🏦', tone: 'wealth', keywords: ['banco', 'conta corrente', 'corrente', 'poupanca', 'caixinha', 'caixa', 'saldo'] },
  { icon: '🛡️', tone: 'wealth', keywords: ['reserva', 'emergencia', 'seguranca'] },
  { icon: '📈', tone: 'wealth', keywords: ['cdi', 'investimento', 'tesouro', 'fii', 'acao', 'acoes', 'fundo'] },
  { icon: '₿', tone: 'wealth', keywords: ['bitcoin', 'btc', 'cripto', 'ethereum', 'eth', 'solana', 'coin'] },
  { icon: '💵', tone: 'income', keywords: ['dinheiro', 'cash', 'carteira', 'especie'] },
  { icon: '🏡', tone: 'wealth', keywords: ['imovel', 'casa', 'apartamento', 'terreno'] },
  { icon: '🎯', tone: 'goals', keywords: ['meta', 'objetivo', 'viagem', 'presente'] }
];

function inferIconFromRules(label, rules, fallbackIcon = '🏷️', fallbackTone = 'neutral') {
  const normalized = normalizeIconLookup(label);
  if (!normalized) return { icon: fallbackIcon, tone: fallbackTone };
  for (const rule of rules) {
    if (rule.keywords.some(keyword => normalized.includes(normalizeIconLookup(keyword)))) {
      return { icon: rule.icon, tone: rule.tone };
    }
  }
  return { icon: fallbackIcon, tone: fallbackTone };
}

function inferCategoryVisual(label) {
  const resolved = resolveCategoryName(label || 'OUTROS');
  const override = categoryEmojiOverrides && categoryEmojiOverrides[resolved];
  if (override) {
    return { icon: String(override), tone: 'neutral' };
  }
  return inferIconFromRules(label, CATEGORY_ICON_RULES, '🏷️', 'neutral');
}

function inferPatrimonioVisual(name, type = '') {
  return inferIconFromRules(`${type} ${name}`, PATRIMONIO_ICON_RULES, '💼', 'wealth');
}

function renderSmartIconBadge(icon, tone = 'neutral', extraClass = '') {
  return `<span class="smart-icon-badge tone-${tone}${extraClass ? ` ${extraClass}` : ''}" aria-hidden="true">${icon}</span>`;
}

function renderCategoryLabel(label) {
  const visual = inferCategoryVisual(label);
  return `<span class="category-inline-label">${renderSmartIconBadge(visual.icon, visual.tone)}<span>${escapeHtml(label || 'Sem categoria')}</span></span>`;
}

