(function (global) {
  'use strict';

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeComparableText(value) {
    return normalizeText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getAllCardsFromUserData(data) {
    const byName = new Map();
    const byId = new Map();
    const bySyntheticId = new Map();
    const normalizeSyntheticCardId = (name) => {
      const base = normalizeComparableText(name).replace(/\s+/g, '_');
      if (!base) return '';
      return `legacy_card_${base}`;
    };
    const registerAlias = (alias, normalizedCard) => {
      const key = normalizeComparableText(alias);
      if (!key) return;
      if (!byName.has(key)) byName.set(key, normalizedCard);
    };
    const registerCard = (card, monthId = '') => {
      const id = normalizeText(card?.id);
      const name = normalizeText(card?.name || card?.nome || '');
      if (!name) return null;
      const key = normalizeComparableText(name);
      const syntheticId = normalizeSyntheticCardId(name);
      const normalized = {
        id: id || syntheticId,
        name,
        institution: normalizeText(card?.institution || card?.bank || ''),
        closingDay: Number(card?.closingDay || 0) || null,
        paymentDay: Number(card?.paymentDay || 0) || null,
        description: normalizeText(card?.description || ''),
        visualId: normalizeText(card?.visualId || ''),
        firstSeenMonthId: normalizeText(monthId || '')
      };
      if (id && !byId.has(id)) byId.set(id, normalized);
      if (syntheticId && !bySyntheticId.has(syntheticId)) bySyntheticId.set(syntheticId, normalized);
      if (!byName.has(key)) byName.set(key, normalized);
      registerAlias(name, normalized);
      registerAlias(normalized.institution, normalized);
      const visualRaw = normalizeText(normalized.visualId || '').replace(/^institution:/i, '');
      registerAlias(visualRaw, normalized);
      const firstToken = name.split(/\s+/)[0] || '';
      registerAlias(firstToken, normalized);
      return normalized;
    };
    (Array.isArray(data) ? data : []).forEach(month => {
      (month?.outflowCards || []).forEach(card => {
        registerCard(card, month?.id || '');
      });

      // Backward-safe fallback: if card structure is missing but bills exist,
      // recover card names from legacy "despesas" rows tagged as cartao.
      (month?.despesas || []).forEach(expense => {
        const category = normalizeComparableText(expense?.categoria || '');
        if (!category.includes('cartao')) return;
        const name = normalizeText(expense?.nome || '');
        if (!name) return;
        registerCard({
          id: normalizeSyntheticCardId(name),
          name
        }, month?.id || '');
      });

      (month?.cardBills || []).forEach(bill => {
        const billCardId = normalizeText(bill?.cardId || bill?.id || '');
        if (!billCardId) return;
        const existing = byId.get(billCardId) || bySyntheticId.get(billCardId);
        if (existing) {
          if (!existing.firstSeenMonthId) existing.firstSeenMonthId = normalizeText(month?.id || '');
          return;
        }
        registerCard({
          id: billCardId,
          name: normalizeText(bill?.description || billCardId).replace(/^cart[aã]o\s*/i, '') || billCardId
        }, month?.id || '');
      });
    });
    return {
      list: Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      byId,
      byName,
      bySyntheticId
    };
  }

  function getAllCategoriesFromUserData(data) {
    const categorySet = new Set();
    const fallbackDefaults = Array.isArray(global.SYSTEM_DEFAULT_CATEGORY_PRESETS)
      ? global.SYSTEM_DEFAULT_CATEGORY_PRESETS
      : [];

    fallbackDefaults.forEach(item => {
      const name = normalizeText(item?.name || '');
      if (name) categorySet.add(global.resolveCategoryName ? global.resolveCategoryName(name) : name.toUpperCase());
    });

    (Array.isArray(data) ? data : []).forEach(month => {
      Object.keys(month?.categorias || {}).forEach(cat => {
        const normalized = global.resolveCategoryName ? global.resolveCategoryName(cat) : normalizeText(cat).toUpperCase();
        if (normalized) categorySet.add(normalized);
      });
      (month?.outflows || []).forEach(item => {
        const normalized = global.resolveCategoryName ? global.resolveCategoryName(item?.category || 'OUTROS') : normalizeText(item?.category || 'OUTROS').toUpperCase();
        if (normalized) categorySet.add(normalized);
      });
      (month?.gastosVar || []).forEach(item => {
        const normalized = global.resolveCategoryName ? global.resolveCategoryName(item?.categoria || 'OUTROS') : normalizeText(item?.categoria || 'OUTROS').toUpperCase();
        if (normalized) categorySet.add(normalized);
      });
      (month?.despesas || []).forEach(item => {
        const normalized = global.resolveCategoryName ? global.resolveCategoryName(item?.categoria || 'OUTROS') : normalizeText(item?.categoria || 'OUTROS').toUpperCase();
        if (normalized) categorySet.add(normalized);
      });
    });

    const emojiByCategory = new Map();
    fallbackDefaults.forEach(item => {
      const name = global.resolveCategoryName ? global.resolveCategoryName(item?.name || '') : normalizeText(item?.name || '').toUpperCase();
      const emoji = normalizeText(item?.emoji || '');
      if (name && emoji && !emojiByCategory.has(name)) emojiByCategory.set(name, emoji);
    });

    const overrides = global.categoryEmojiOverrides && typeof global.categoryEmojiOverrides === 'object'
      ? global.categoryEmojiOverrides
      : {};
    Object.entries(overrides).forEach(([key, value]) => {
      const normalized = global.resolveCategoryName ? global.resolveCategoryName(key) : normalizeText(key).toUpperCase();
      const emoji = normalizeText(value || '');
      if (normalized && emoji) emojiByCategory.set(normalized, emoji);
    });

    const list = Array.from(categorySet)
      .map(name => ({ name, emoji: emojiByCategory.get(name) || '' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    const byNormalized = new Map();
    list.forEach(item => byNormalized.set(normalizeComparableText(item.name), item.name));

    return {
      list,
      byNormalized
    };
  }

  function getAllTagsFromUserData(data) {
    const tags = new Set();
    (Array.isArray(data) ? data : []).forEach(month => {
      (month?.outflows || []).forEach(item => {
        const tag = normalizeText(item?.tag || item?.tagId || item?.marca || '');
        if (tag) tags.add(tag);
      });
      (month?.gastosVar || []).forEach(item => {
        const tag = normalizeText(item?.tag || item?.tagId || item?.marca || '');
        if (tag) tags.add(tag);
      });
      (month?.calendarEvents || []).forEach(item => {
        const tag = normalizeText(item?.tagId || item?.tag || '');
        if (tag) tags.add(tag);
      });
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function buildImportContext(data, session) {
    const cards = getAllCardsFromUserData(data);
    const categories = getAllCategoriesFromUserData(data);
    const tags = getAllTagsFromUserData(data);
    return {
      context_format: 'finance_import_context_v1',
      generated_at: new Date().toISOString(),
      user: {
        id: normalizeText(session?.id || ''),
        username: normalizeText(session?.username || ''),
        display_name: normalizeText(session?.displayName || ''),
        full_name: normalizeText(session?.fullName || '')
      },
      cards: cards.list.map(card => ({
        id: card.id,
        name: card.name,
        institution: card.institution || null,
        closing_day: card.closingDay,
        payment_day: card.paymentDay
      })),
      categories: categories.list.map(category => ({
        name: category.name,
        emoji: category.emoji || null
      })),
      tags_reference_only: tags,
      system_rules: [
        'A IA é apenas pré-processadora. O sistema é a verdade final.',
        'Não criar novas categorias.',
        'Não criar, não sugerir e não preencher tags (tag deve ficar nula).',
        'Formato de data preferido: DD/MM/AA. Se vier AA/MM/DD, o sistema converte automaticamente.',
        'Não importar valor total da fatura como transação.',
        'Ignorar ressarcimentos/estornos/reembolsos do cartão.',
        'Importar apenas transações individuais.',
        'Se houver dúvida de categoria, usar category = null e needs_review = true.',
        'Manter data original da compra quando disponível.',
        'Não inventar dados ausentes.'
      ],
      expected_output: {
        format: 'finance_import_v1',
        version: 1,
        required_item_fields: ['date', 'description', 'amount', 'card_name|card_id', 'category', 'needs_review', 'confidence', 'tag'],
        field_rules: {
          tag: 'must be null',
          category: 'must belong to provided categories or null',
          suggested_categories: 'optional list of up to 3 existing categories'
        }
      }
    };
  }

  function buildExternalAiPrompt(contextFileName) {
    const fileName = normalizeText(contextFileName || 'finance_import_context.json');
    return [
      'TAREFA OBRIGATÓRIA: devolver APENAS JSON válido no formato solicitado.',
      `Use obrigatoriamente o arquivo de contexto "${fileName}" como regra de negócio.`,
      '',
      'FORMATO DE RESPOSTA OBRIGATÓRIO:',
      '1) Responda SOMENTE com um bloco de código ```json ... ```.',
      '2) Não escreva introdução, explicação, comentários ou texto antes/depois do JSON.',
      '3) O conteúdo do bloco deve ser parseável por JSON.parse sem ajustes manuais.',
      '4) Não responda em texto corrido; entregue somente JSON.',
      '',
      'Regras obrigatórias:',
      '- output format: finance_import_v1',
      '- version: 1',
      '- use datas preferencialmente em DD/MM/AA (o sistema aceita AA/MM/DD e converte)',
      '- não criar categorias novas',
      '- usar somente categorias já existentes no contexto',
      '- NÃO preencher tag (tag deve ser null)',
      '- não criar/sugerir tags',
      '- não incluir total da fatura como compra',
      '- ignorar ressarcimentos/estornos/reembolsos do cartão',
      '- incluir apenas transações',
      '- quando categoria for incerta: category = null, needs_review = true',
      '- pode usar suggested_categories com até 3 categorias existentes',
      '',
      'Campos por item:',
      '- date',
      '- description',
      '- amount',
      '- card_name (ou card_id)',
      '- category (string existente ou null)',
      '- suggested_categories (opcional)',
      '- confidence (0 a 1)',
      '- needs_review (boolean)',
      '- tag (sempre null)',
      '- warnings (opcional)',
      '- source_excerpt (opcional)',
      '',
      'Resposta final:',
      '- retornar somente um bloco ```json```',
      '- sem texto adicional fora do bloco',
      '- se faltar dado, use null em vez de inventar'
    ].join('\n');
  }

  function downloadJsonFile(payload, filename) {
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  const api = {
    normalizeText,
    normalizeComparableText,
    getAllCardsFromUserData,
    getAllCategoriesFromUserData,
    getAllTagsFromUserData,
    buildImportContext,
    buildExternalAiPrompt,
    downloadJsonFile
  };

  global.BillImportUtils = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
