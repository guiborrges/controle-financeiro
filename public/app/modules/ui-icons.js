(function initSystemIcons(global) {
  'use strict';

  const ICONS = {
    dashboard: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.5Z"/><path d="M3 12.2 12 5l9 7.2"/>',
    month: '<path d="M7 3v3M17 3v3M4.5 8h15M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M8 12h3M8 16h6"/>',
    wealth: '<path d="M4 10h16M6 10V8l6-4 6 4v2M7 10v8M12 10v8M17 10v8M5 18h14v3H5z"/>',
    history: '<path d="M4 5v5h5"/><path d="M5.5 14a7 7 0 1 0 1.7-7.2L4 10"/><path d="M12 8v5l3 2"/>',
    calendar: '<path d="M7 3v3M17 3v3M5 9h14M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/>',
    help: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-.9.6-1.5 1.1-1.5 2.2"/><path d="M12 17h.01"/>',
    logout: '<path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/><path d="M15 8l4 4-4 4"/><path d="M19 12H9"/>',
    user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    food: '<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M15 3v18M15 3c3 2 4 5 2 8h-2"/>',
    car: '<path d="M5 13h14l-1.5-5h-11L5 13Z"/><path d="M6 13v5M18 13v5M7 18h2M15 18h2"/>',
    health: '<path d="M12 5v14M5 12h14"/><path d="M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/>',
    fun: '<path d="M4 17c5-1 8-5 9-10"/><path d="M6 15c4 1 8 1 12-1"/><path d="M14 7l5 2-3 5"/>',
    shopping: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    phone: '<path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M11 18h2"/>',
    home: '<path d="M4 11.5 12 5l8 6.5V20H5v-8.5Z"/><path d="M10 20v-5h4v5"/>',
    education: '<path d="M3 9l9-4 9 4-9 4-9-4Z"/><path d="M7 11v5c3 2 7 2 10 0v-5"/>',
    invoice: '<path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    gift: '<path d="M4 10h16v10H4z"/><path d="M12 10v10M4 14h16"/><path d="M8 10c-2-2 0-5 4 0M16 10c2-2 0-5-4 0"/>',
    work: '<path d="M9 7V5h6v2"/><path d="M4 8h16v11H4z"/><path d="M4 13h16"/>',
    shield: '<path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"/>',
    trend: '<path d="M4 17 9 12l4 4 7-9"/><path d="M15 7h5v5"/>',
    bitcoin: '<path d="M9 4v16M13 4v16"/><path d="M8 6h5.5a2.5 2.5 0 0 1 0 5H8h6a3 3 0 0 1 0 6H8"/>',
    bank: '<path d="M4 10h16M6 10V8l6-4 6 4v2M7 10v8M12 10v8M17 10v8M5 18h14v3H5z"/>',
    cash: '<path d="M4 7h16v10H4z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M7 10v4M17 10v4"/>',
    tag: '<path d="M4 12V5h7l9 9-6 6-10-8Z"/><path d="M8 8h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    dots: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    card: '<path d="M4 6h16v12H4z"/><path d="M4 10h16M8 15h4"/>'
  };

  const LEGACY_ICON_ALIASES = {
    '🏷️': 'tag',
    '🍽️': 'food',
    '🚗': 'car',
    '💊': 'health',
    '🎬': 'fun',
    '🛍️': 'shopping',
    '📱': 'phone',
    '🏠': 'home',
    '🎓': 'education',
    '🧾': 'invoice',
    '🎁': 'gift',
    '💼': 'work',
    '🛡️': 'shield',
    '📈': 'trend',
    '💳': 'card',
    '🏦': 'bank',
    '💵': 'cash',
    '📦': 'tag',
    '🎯': 'gift'
  };

  const CATEGORY_ICON_RULES = [
    { icon: 'food', tone: 'expense', keywords: ['alimentacao', 'almoco', 'janta', 'cafe', 'restaurante', 'mercado', 'supermercado', 'feira', 'padaria', 'ifood', 'lanche', 'comida'] },
    { icon: 'car', tone: 'info', keywords: ['transporte', 'uber', '99', 'combustivel', 'gasolina', 'etanol', 'diesel', 'estacionamento', 'pedagio', 'onibus', 'metro', 'carro'] },
    { icon: 'health', tone: 'expense', keywords: ['farmacia', 'remedio', 'medicamento', 'saude', 'dentista', 'medico', 'exame', 'terapia', 'hospital'] },
    { icon: 'fun', tone: 'goals', keywords: ['lazer', 'cinema', 'show', 'viagem', 'ferias', 'passeio', 'bar', 'festa', 'streaming'] },
    { icon: 'shopping', tone: 'goals', keywords: ['compra', 'compras', 'roupa', 'calcado', 'tenis', 'acessorio', 'presente', 'shopping'] },
    { icon: 'phone', tone: 'info', keywords: ['internet', 'telefone', 'celular', 'whatsapp', 'chip', 'assinatura', 'netflix', 'spotify', 'prime', 'youtube'] },
    { icon: 'home', tone: 'expense', keywords: ['aluguel', 'condominio', 'agua', 'luz', 'energia', 'gas', 'moradia', 'casa', 'iptu'] },
    { icon: 'education', tone: 'info', keywords: ['faculdade', 'curso', 'livro', 'educacao', 'estudo', 'colegio', 'escola'] },
    { icon: 'shield', tone: 'goals', keywords: ['pet', 'veterinario', 'racao', 'animal', 'gato', 'cachorro', 'reserva', 'seguro'] },
    { icon: 'invoice', tone: 'neutral', keywords: ['taxa', 'boleto', 'tarifa', 'imposto', 'cartao', 'fatura', 'juros', 'multa'] },
    { icon: 'gift', tone: 'goals', keywords: ['presente', 'social', 'aniversario', 'casamento'] },
    { icon: 'work', tone: 'income', keywords: ['salario', 'pagamento', 'renda', 'freela', 'freelance', 'servico', 'projeto', 'bonus', 'comissao'] },
    { icon: 'trend', tone: 'wealth', keywords: ['investimento', 'cdi', 'tesouro', 'acao', 'acoes', 'fii', 'fundo', 'bolsa'] },
    { icon: 'bitcoin', tone: 'wealth', keywords: ['bitcoin', 'btc', 'cripto', 'ethereum', 'eth', 'solana', 'usdt'] },
    { icon: 'bank', tone: 'wealth', keywords: ['banco', 'conta corrente', 'corrente', 'poupanca', 'caixinha', 'caixa'] },
    { icon: 'tag', tone: 'neutral', keywords: ['outros', 'outro', 'geral', 'diversos'] }
  ];

  const PATRIMONIO_ICON_RULES = [
    { icon: 'bank', tone: 'wealth', keywords: ['banco', 'conta corrente', 'corrente', 'poupanca', 'caixinha', 'caixa', 'saldo'] },
    { icon: 'shield', tone: 'wealth', keywords: ['reserva', 'emergencia', 'seguranca'] },
    { icon: 'trend', tone: 'wealth', keywords: ['cdi', 'investimento', 'tesouro', 'fii', 'acao', 'acoes', 'fundo'] },
    { icon: 'bitcoin', tone: 'wealth', keywords: ['bitcoin', 'btc', 'cripto', 'ethereum', 'eth', 'solana', 'coin'] },
    { icon: 'cash', tone: 'income', keywords: ['dinheiro', 'cash', 'carteira', 'especie'] },
    { icon: 'home', tone: 'wealth', keywords: ['imovel', 'casa', 'apartamento', 'terreno'] },
    { icon: 'gift', tone: 'goals', keywords: ['meta', 'objetivo', 'viagem', 'presente'] }
  ];

  // Expande biblioteca de ícones categóricos (sem rostos), mantendo consistência visual.
  Object.assign(ICONS, {
    market: ICONS.shopping,
    grocery: ICONS.shopping,
    basket: ICONS.shopping,
    cartAlt: ICONS.shopping,
    house: ICONS.home,
    rent: ICONS.home,
    utilities: ICONS.home,
    water: ICONS.home,
    electric: ICONS.home,
    gas: ICONS.home,
    mobility: ICONS.car,
    bus: ICONS.car,
    subway: ICONS.car,
    ride: ICONS.car,
    fuel: ICONS.car,
    parking: ICONS.car,
    toll: ICONS.car,
    pharmacy: ICONS.health,
    medicine: ICONS.health,
    dental: ICONS.health,
    exam: ICONS.health,
    gym: ICONS.health,
    wellbeing: ICONS.health,
    entertainment: ICONS.fun,
    travel: ICONS.fun,
    party: ICONS.fun,
    streaming: ICONS.fun,
    game: ICONS.fun,
    hobby: ICONS.fun,
    internet: ICONS.phone,
    mobile: ICONS.phone,
    telecom: ICONS.phone,
    subscription: ICONS.phone,
    school: ICONS.education,
    college: ICONS.education,
    books: ICONS.education,
    taxes: ICONS.invoice,
    bill: ICONS.invoice,
    fees: ICONS.invoice,
    penalty: ICONS.invoice,
    salary: ICONS.work,
    freelance: ICONS.work,
    commission: ICONS.work,
    bonus: ICONS.work,
    office: ICONS.work,
    pet: ICONS.shield,
    insurance: ICONS.shield,
    reserve: ICONS.shield,
    emergency: ICONS.shield,
    investment: ICONS.trend,
    stocks: ICONS.trend,
    fii: ICONS.trend,
    treasury: ICONS.trend,
    forex: ICONS.trend,
    crypto: ICONS.bitcoin,
    ethereum: ICONS.bitcoin,
    cardCredit: ICONS.card,
    cardDebit: ICONS.card,
    bankAccount: ICONS.bank,
    savings: ICONS.bank,
    wallet: ICONS.cash,
    money: ICONS.cash,
    cashflow: ICONS.cash,
    defaultTag: ICONS.tag,
    other: ICONS.tag,
    goal: ICONS.gift,
    social: ICONS.gift,
    giftcard: ICONS.gift,
    cleaning: ICONS.home,
    maintenance: ICONS.home,
    furniture: ICONS.home,
    clothing: ICONS.shopping,
    beauty: ICONS.shopping,
    kids: ICONS.gift,
    baby: ICONS.gift,
    legal: ICONS.invoice,
    accounting: ICONS.invoice,
    transfer: ICONS.bank,
    donation: ICONS.gift,
    charity: ICONS.gift,
    airport: ICONS.fun,
    hotel: ICONS.fun,
    meals: ICONS.food,
    restaurant: ICONS.food,
    coffee: ICONS.food,
    bakery: ICONS.food,
    taxesGov: ICONS.invoice,
    internetTools: ICONS.phone,
    software: ICONS.phone,
    cloud: ICONS.phone,
    hardware: ICONS.shopping,
    repairs: ICONS.work,
    services: ICONS.work,
    supplies: ICONS.shopping,
    stationery: ICONS.shopping,
    marketplace: ICONS.shopping,
    pix: ICONS.cash,
    debit: ICONS.card,
    moneyBag: ICONS.cash,
    invoiceDue: ICONS.invoice,
    recurring: ICONS.tag,
    installment: ICONS.card,
    condo: ICONS.home,
    property: ICONS.home,
    ticket: ICONS.fun,
    transportApp: ICONS.car,
    mealsOut: ICONS.food,
    supermarket: ICONS.shopping,
    homeOffice: ICONS.work,
    rentHouse: ICONS.home,
    mortgage: ICONS.home,
    taxOffice: ICONS.invoice,
    personalCare: ICONS.health,
    wellness: ICONS.health,
    petCare: ICONS.shield,
    celebrations: ICONS.gift
  });

  function escape(value) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function normalizeIconLookup(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function normalizeCategoryIconId(raw) {
    const value = String(raw || '').trim();
    if (!value) return 'tag';
    if (ICONS[value]) return value;
    if (LEGACY_ICON_ALIASES[value]) return LEGACY_ICON_ALIASES[value];
    const normalized = normalizeIconLookup(value);
    if (ICONS[normalized]) return normalized;
    return 'tag';
  }

  function renderSystemIcon(name, extraClass = '') {
    const key = normalizeCategoryIconId(name);
    const path = ICONS[key] || ICONS.tag;
    return `<svg class="system-icon${extraClass ? ` ${escape(extraClass)}` : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${path}</g></svg>`;
  }

  function inferIconFromRules(label, rules, fallbackIcon = 'tag', fallbackTone = 'neutral') {
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
    const resolved = typeof global.resolveCategoryName === 'function' ? global.resolveCategoryName(label || 'OUTROS') : String(label || 'OUTROS');
    const override = global.categoryEmojiOverrides && global.categoryEmojiOverrides[resolved];
    if (override) return { icon: normalizeCategoryIconId(override), tone: 'neutral' };
    return inferIconFromRules(resolved, CATEGORY_ICON_RULES, 'tag', 'neutral');
  }

  function inferPatrimonioVisual(name, type = '') {
    return inferIconFromRules(`${type} ${name}`, PATRIMONIO_ICON_RULES, 'work', 'wealth');
  }

  function renderSmartIconBadge(icon, tone = 'neutral', extraClass = '') {
    return `<span class="smart-icon-badge tone-${escape(tone)}${extraClass ? ` ${escape(extraClass)}` : ''}" aria-hidden="true">${renderSystemIcon(normalizeCategoryIconId(icon))}</span>`;
  }

  function renderCategoryLabel(label) {
    const visual = inferCategoryVisual(label);
    return `<span class="category-inline-label">${renderSmartIconBadge(visual.icon, visual.tone)}<span>${escape(label || 'Sem categoria')}</span></span>`;
  }

  global.SystemIcons = { render: renderSystemIcon, paths: ICONS };
  global.renderSystemIcon = renderSystemIcon;
  global.normalizeCategoryIconId = normalizeCategoryIconId;
  global.normalizeIconLookup = normalizeIconLookup;
  global.inferIconFromRules = inferIconFromRules;
  global.inferCategoryVisual = inferCategoryVisual;
  global.inferPatrimonioVisual = inferPatrimonioVisual;
  global.renderSmartIconBadge = renderSmartIconBadge;
  global.renderCategoryLabel = renderCategoryLabel;
  global.getCategoryIconChoices = function getCategoryIconChoices() {
    const list = Object.keys(ICONS);
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  };
})(window);
