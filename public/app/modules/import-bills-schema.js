(function (global) {
  'use strict';

  const FORMAT_NAME = 'finance_import_v1';
  const FORMAT_VERSION = 1;

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeComparableText(value) {
    return normalizeText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function normalizeDescriptionComparable(value) {
    return normalizeComparableText(value).replace(/\s+/g, '');
  }

  function parseAmount(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    const raw = String(value || '').trim();
    if (!raw) return NaN;
    const normalized = raw.includes(',')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function normalizeImportDateWithMeta(raw, fallbackYear = new Date().getFullYear(), options = {}) {
    const txt = normalizeText(raw);
    if (!txt) return { date: '', inferredYear: false, interpretedAsUS: false };
    const toShortYear = (value) => String(Number(value || 0)).slice(-2).padStart(2, '0');
    const isValidDayMonth = (day, month) => Number(day) >= 1 && Number(day) <= 31 && Number(month) >= 1 && Number(month) <= 12;
    const preferredYear = Number(options?.preferredYear || fallbackYear || 0);
    const preferredYearShort = Number(String(preferredYear || 0).slice(-2));

    // Suporte explícito para entrada com ano no início (AA/MM/DD ou AAAA/MM/DD).
    const yearFirstMatch = txt.match(/^(\d{2,4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (yearFirstMatch) {
      const yearRawText = String(yearFirstMatch[1] || '');
      const yearRawNumber = Number(yearRawText || 0);
      const month = Number(yearFirstMatch[2] || 0);
      const day = Number(yearFirstMatch[3] || 0);
      const firstLooksLikeYear = yearRawText.length === 4
        || (yearRawText.length === 2 && preferredYearShort > 0 && yearRawNumber === preferredYearShort);
      if (firstLooksLikeYear && isValidDayMonth(day, month)) {
        return {
          date: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${toShortYear(yearRawNumber)}`,
          inferredYear: false,
          interpretedAsUS: false
        };
      }
    }
    const extractedBr = txt.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (extractedBr) {
      const first = Number(extractedBr[1] || 0);
      const second = Number(extractedBr[2] || 0);
      const yRaw = Number(extractedBr[3] || 0);
      if (yRaw) {
        if (isValidDayMonth(first, second)) {
          return {
            date: `${String(first).padStart(2, '0')}/${String(second).padStart(2, '0')}/${toShortYear(yRaw)}`,
            inferredYear: false,
            interpretedAsUS: false
          };
        }
        // fallback para formato americano MM/DD
        if (isValidDayMonth(second, first)) {
          return {
            date: `${String(second).padStart(2, '0')}/${String(first).padStart(2, '0')}/${toShortYear(yRaw)}`,
            inferredYear: false,
            interpretedAsUS: true
          };
        }
      }
    }
    const extractedBrNoYear = txt.match(/(\d{1,2})[\/\-](\d{1,2})(?![\/\-]\d)/);
    if (extractedBrNoYear) {
      const d = Number(extractedBrNoYear[1] || 0);
      const m = Number(extractedBrNoYear[2] || 0);
      if (isValidDayMonth(d, m)) {
        const yy = toShortYear(Number(fallbackYear || new Date().getFullYear()));
        return { date: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${yy}`, inferredYear: true, interpretedAsUS: false };
      }
    }
    const extractedIso = txt.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (extractedIso) {
      const year = Number(extractedIso[1] || 0);
      const month = Number(extractedIso[2] || 0);
      const day = Number(extractedIso[3] || 0);
      if (year && month && day) {
        return { date: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).slice(-2)}`, inferredYear: false, interpretedAsUS: false };
      }
    }
    if (global.DateUtils?.normalizeVarDate) {
      const normalized = global.DateUtils.normalizeVarDate(txt);
      if (normalized) return { date: normalized, inferredYear: false, interpretedAsUS: false };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
      const [year, month, day] = txt.split('-').map(Number);
      if (year && month && day) {
        return { date: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).slice(-2)}`, inferredYear: false, interpretedAsUS: false };
      }
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) {
      const [day, month, year] = txt.split('/').map(Number);
      if (day && month && year) {
        return { date: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).slice(-2)}`, inferredYear: false, interpretedAsUS: false };
      }
    }
    if (/^\d{2}\/\d{2}\/\d{2}$/.test(txt)) return { date: txt, inferredYear: false, interpretedAsUS: false };
    return { date: '', inferredYear: false, interpretedAsUS: false };
  }

  function normalizeImportDate(raw) {
    return normalizeImportDateWithMeta(raw).date;
  }

  function getMonthIdFromDate(normalizedDate) {
    const value = normalizeImportDate(normalizedDate);
    if (!value) return '';
    const parts = value.split('/');
    const month = Number(parts[1] || 0);
    const yy = Number(parts[2] || 0);
    const year = 2000 + yy;
    const monthIndex = month - 1;
    const monthName = Object.keys(global.MONTH_INDEX || {}).find(key => Number(global.MONTH_INDEX[key]) === monthIndex)
      || ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'][monthIndex];
    if (!monthName || !year) return '';
    if (typeof global.getMonthIdFromParts === 'function') {
      return global.getMonthIdFromParts(monthName, year);
    }
    const slug = String(monthName)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return `${slug}_${year}`;
  }

  function parseMonthReferenceToId(rawValue) {
    const raw = normalizeText(rawValue);
    if (!raw) return '';
    const normalizedRaw = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    const monthRef = normalizedRaw.match(/^(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|march|april|may|june|july|august|september|october|november|december)[\s\-_]*(\d{4})$/i);
    if (monthRef) {
      const monthMap = {
        janeiro: 'JANEIRO',
        fevereiro: 'FEVEREIRO',
        marco: 'MARÇO',
        abril: 'ABRIL',
        maio: 'MAIO',
        junho: 'JUNHO',
        julho: 'JULHO',
        agosto: 'AGOSTO',
        setembro: 'SETEMBRO',
        outubro: 'OUTUBRO',
        novembro: 'NOVEMBRO',
        dezembro: 'DEZEMBRO',
        january: 'JANEIRO',
        february: 'FEVEREIRO',
        march: 'MARÇO',
        april: 'ABRIL',
        may: 'MAIO',
        june: 'JUNHO',
        july: 'JULHO',
        august: 'AGOSTO',
        september: 'SETEMBRO',
        october: 'OUTUBRO',
        november: 'NOVEMBRO',
        december: 'DEZEMBRO'
      };
      const monthName = monthMap[String(monthRef[1] || '').toLowerCase()] || '';
      const year = Number(monthRef[2] || 0);
      if (monthName && year && typeof global.getMonthIdFromParts === 'function') {
        return global.getMonthIdFromParts(monthName, year);
      }
    }

    const numericRef = normalizedRaw.match(/^(\d{1,2})[\/\-_](\d{4})$/);
    if (numericRef) {
      const month = Number(numericRef[1] || 0);
      const year = Number(numericRef[2] || 0);
      if (month >= 1 && month <= 12) {
        return getMonthIdFromDate(`01/${String(month).padStart(2, '0')}/${String(year).slice(-2)}`);
      }
    }

    const isoRef = normalizedRaw.match(/^(\d{4})[\/\-_](\d{1,2})$/);
    if (isoRef) {
      const year = Number(isoRef[1] || 0);
      const month = Number(isoRef[2] || 0);
      if (month >= 1 && month <= 12) {
        return getMonthIdFromDate(`01/${String(month).padStart(2, '0')}/${String(year).slice(-2)}`);
      }
    }
    return '';
  }

  function buildPayloadCardHints(payload, cardIndex) {
    const hints = new Set();
    if (!payload || typeof payload !== 'object') return hints;
    const keys = ['card', 'card_name', 'cardName', 'cartao', 'cartão', 'institution', 'bank', 'header', 'title'];
    keys.forEach(key => {
      const value = normalizeText(payload?.[key]);
      if (value) hints.add(value);
    });
    const cardsIdentified = Array.isArray(payload?.cards_identified) ? payload.cards_identified : [];
    cardsIdentified.forEach(value => {
      const txt = normalizeText(value);
      if (txt) hints.add(txt);
    });
    const resolved = Array.from(hints)
      .map(value => cardIndex.byName.get(normalizeComparableText(value)))
      .filter(Boolean);
    if (!resolved.length) {
      const haystack = normalizeComparableText(JSON.stringify({
        title: payload?.title || '',
        header: payload?.header || '',
        statement: payload?.statement || '',
        card: payload?.card || '',
        card_name: payload?.card_name || '',
        institution: payload?.institution || '',
        bank: payload?.bank || ''
      }));
      if (haystack) {
        Array.from(cardIndex.byName.values()).forEach(card => {
          const key = normalizeComparableText(card?.name || '');
          if (key && haystack.includes(key)) {
            resolved.push(card);
          }
        });
      }
    }
    const unique = [];
    const seen = new Set();
    resolved.forEach(card => {
      const key = String(card?.id || card?.name || '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      unique.push(card);
    });
    return unique;
  }

  function inferCardFromText(rawItem, cardIndex, fallbackCards = []) {
    const fields = [
      rawItem?.description,
      rawItem?.source_excerpt,
      rawItem?.source,
      rawItem?.card_hint,
      rawItem?.header,
      rawItem?.statement,
      rawItem?.notes
    ]
      .map(normalizeText)
      .filter(Boolean);
    const combined = normalizeComparableText(fields.join(' '));
    if (combined) {
      const cards = Array.from(cardIndex.byName.values());
      for (let i = 0; i < cards.length; i += 1) {
        const card = cards[i];
        const name = normalizeComparableText(card?.name || '');
        if (name && combined.includes(name)) return card;
      }
    }
    if (fallbackCards.length === 1) return fallbackCards[0];
    return null;
  }

  function flattenPayloadItems(payload) {
    const out = [];
    if (!payload || typeof payload !== 'object') return out;
    if (Array.isArray(payload.items)) {
      payload.items.forEach((item, index) => {
        out.push({
          ...item,
          card_name: normalizeText(item?.card_name || item?.cardName || item?.card || item?.cartao || item?.cartão || item?.institution || ''),
          __source: { type: 'items', index }
        });
      });
    }
    if (Array.isArray(payload.transactions)) {
      payload.transactions.forEach((item, index) => {
        out.push({
          ...item,
          card_name: normalizeText(item?.card_name || item?.cardName || item?.card || item?.cartao || item?.cartão || item?.institution || ''),
          __source: { type: 'transactions', index }
        });
      });
    }
    if (Array.isArray(payload.cards)) {
      payload.cards.forEach((cardBlock, cardIndex) => {
        const cardName = normalizeText(cardBlock?.card_name || cardBlock?.name || '');
        const cardId = normalizeText(cardBlock?.card_id || cardBlock?.id || '');
        const months = Array.isArray(cardBlock?.months) ? cardBlock.months : [];
        months.forEach((monthBlock, monthIndex) => {
          const monthId = normalizeText(monthBlock?.month_id || monthBlock?.month || '');
          const transactions = Array.isArray(monthBlock?.transactions) ? monthBlock.transactions : [];
          transactions.forEach((item, txIndex) => {
            out.push({
              ...item,
              card_name: normalizeText(item?.card_name || cardName),
              card_id: normalizeText(item?.card_id || cardId),
              month_id: normalizeText(item?.month_id || monthId),
              __source: {
                type: 'cards.months.transactions',
                cardIndex,
                monthIndex,
                txIndex
              }
            });
          });
        });
      });
    }
    return out;
  }

  function buildMonthIndex(data) {
    const index = new Map();
    (Array.isArray(data) ? data : []).forEach(month => {
      const monthId = String(month?.id || '').trim();
      if (monthId) index.set(monthId, month);
    });
    return index;
  }

  function normalizeMonthIdForCompare(value) {
    return normalizeText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }

  function getMonthYearFromNormalizedDate(value) {
    const normalized = normalizeImportDate(value);
    const match = String(normalized || '').match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (!match) return null;
    const month = Number(match[2] || 0);
    const year = 2000 + Number(match[3] || 0);
    if (!month || month < 1 || month > 12 || !year) return null;
    return { month, year };
  }

  function getMonthYearFromMonthObject(month) {
    if (!month || typeof month !== 'object') return null;
    const byHelper = typeof global.getMonthDateFromMonthObject === 'function'
      ? global.getMonthDateFromMonthObject(month)
      : null;
    if (byHelper instanceof Date && !Number.isNaN(byHelper.getTime())) {
      return {
        month: byHelper.getMonth() + 1,
        year: byHelper.getFullYear()
      };
    }
    const id = normalizeText(month?.id || '');
    if (!id) return null;
    const idYear = Number(String(id).match(/_(20\d{2})$/)?.[1] || 0);
    const slug = String(id).split('_')[0] || '';
    const monthBySlug = Object.keys(global.MONTH_INDEX || {}).find(key => {
      return normalizeMonthIdForCompare(key) === normalizeMonthIdForCompare(slug);
    });
    const monthIdx = monthBySlug ? Number(global.MONTH_INDEX[monthBySlug]) : NaN;
    if (idYear && !Number.isNaN(monthIdx)) {
      return {
        month: monthIdx + 1,
        year: idYear
      };
    }
    const nome = normalizeText(month?.nome || '');
    const nomeMatch = nome.match(/^([A-Za-zÀ-ÿ]+)\s+(20\d{2})$/);
    if (!nomeMatch) return null;
    const monthToken = String(nomeMatch[1] || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const yearFromName = Number(nomeMatch[2] || 0);
    const monthByName = Object.keys(global.MONTH_INDEX || {}).find(key => {
      return normalizeMonthIdForCompare(key) === normalizeMonthIdForCompare(monthToken);
    });
    const monthIdxByName = monthByName ? Number(global.MONTH_INDEX[monthByName]) : NaN;
    if (!yearFromName || Number.isNaN(monthIdxByName)) return null;
    return {
      month: monthIdxByName + 1,
      year: yearFromName
    };
  }

  function resolveMonthIdAgainstExisting(monthMap, monthId, normalizedDate) {
    const direct = normalizeText(monthId || '');
    if (direct && monthMap.has(direct)) return direct;

    const directComparable = normalizeMonthIdForCompare(direct);
    if (directComparable) {
      const byComparableId = Array.from(monthMap.keys()).find(existingId => {
        return normalizeMonthIdForCompare(existingId) === directComparable;
      });
      if (byComparableId) return byComparableId;
    }

    const target = getMonthYearFromNormalizedDate(normalizedDate);
    if (!target) return '';
    const byMonthYear = Array.from(monthMap.entries()).find(([, month]) => {
      const monthRef = getMonthYearFromMonthObject(month);
      return !!monthRef && monthRef.month === target.month && monthRef.year === target.year;
    });
    return byMonthYear?.[0] || '';
  }

  function resolveCard(item, cardIndex) {
    const cardIdRaw = normalizeText(item?.card_id);
    const cardNameRaw = normalizeText(item?.card_name);
    if (cardIdRaw && cardIndex.byId.has(cardIdRaw)) return cardIndex.byId.get(cardIdRaw);
    if (cardIdRaw && cardIndex.bySyntheticId?.has(cardIdRaw)) return cardIndex.bySyntheticId.get(cardIdRaw);
    if (cardNameRaw) {
      const byName = cardIndex.byName.get(normalizeComparableText(cardNameRaw));
      if (byName) return byName;
      const normalizedRaw = normalizeComparableText(cardNameRaw);
      const maybeByContains = Array.from(cardIndex.byName.values()).find(card => {
        const normalizedName = normalizeComparableText(card?.name || '');
        if (!normalizedName) return false;
        return normalizedRaw.includes(normalizedName) || normalizedName.includes(normalizedRaw);
      });
      if (maybeByContains) return maybeByContains;
    }
    const institutionRaw = normalizeText(item?.institution || item?.bank || item?.issuer || item?.header || item?.title);
    if (institutionRaw) {
      const byInstitution = cardIndex.byName.get(normalizeComparableText(institutionRaw));
      if (byInstitution) return byInstitution;
    }
    return null;
  }

  function resolveCategory(item, categoryIndex) {
    const categoryRaw = normalizeText(item?.category);
    if (!categoryRaw) return '';
    const normalized = normalizeComparableText(categoryRaw);
    return categoryIndex.byNormalized.get(normalized) || '';
  }

  function isLikelyCardBillEntry(description) {
    const txt = normalizeComparableText(description);
    if (!txt) return false;
    return txt.includes('fatura')
      || txt.includes('total do cartao')
      || txt.includes('total cartao')
      || txt.includes('pagamento da fatura');
  }

  function isReimbursementLikeEntry(description) {
    const txt = normalizeComparableText(description);
    if (!txt) return false;
    return txt.includes('estorno')
      || txt.includes('ressarcimento')
      || txt.includes('reembolso')
      || txt.includes('chargeback')
      || txt.includes('devolucao')
      || txt.includes('devolução')
      || txt.includes('credito da fatura')
      || txt.includes('credito fatura')
      || txt.includes('ajuste a credito')
      || txt.includes('ajuste de credito');
  }

  function detectDuplicate(item, monthMap) {
    const month = monthMap.get(item.monthId);
    if (!month) return false;
    const sameCardOutflows = (month.outflows || []).filter(outflow => outflow?.outputKind === 'card' && outflow?.outputRef === item.cardId);
    const targetAmount = Number(item.amount || 0);
    const targetDesc = normalizeDescriptionComparable(item.description);
    const targetDate = normalizeImportDate(item.date);
    return sameCardOutflows.some(outflow => {
      const amountMatch = Math.abs(Number(outflow?.amount || 0) - targetAmount) < 0.01;
      if (!amountMatch) return false;
      const outDate = normalizeImportDate(outflow?.date || '');
      const sameDate = outDate && targetDate ? outDate === targetDate : true;
      const outDesc = normalizeDescriptionComparable(outflow?.description || '');
      const sameDesc = targetDesc && outDesc ? outDesc.includes(targetDesc) || targetDesc.includes(outDesc) : true;
      return sameDate && sameDesc;
    });
  }

  function determineStatus(item) {
    if (item.errors.length) return 'error';
    if (item.needsReview) return 'needs_review';
    if (item.warnings.length) return 'warning';
    return 'valid';
  }

  function validatePayload(payload, context) {
    const formatErrors = [];
    const warnings = [];
    if (!payload || typeof payload !== 'object') {
      formatErrors.push('Arquivo inválido: conteúdo não é um objeto JSON.');
      return { formatErrors, warnings, items: [], summary: { total: 0, valid: 0, warning: 0, needs_review: 0, error: 0 } };
    }

    const format = normalizeText(payload.format);
    const version = Number(payload.version || payload.format_version || 0);
    if (format !== FORMAT_NAME) {
      formatErrors.push(`Formato inválido: esperado "${FORMAT_NAME}".`);
    }
    if (version !== FORMAT_VERSION) {
      formatErrors.push(`Versão inválida: esperado "${FORMAT_VERSION}".`);
    }

    const flatItems = flattenPayloadItems(payload);
    if (!flatItems.length) {
      formatErrors.push('Nenhum lançamento encontrado no arquivo.');
    }

    const monthMap = buildMonthIndex(context?.data);
    const currentYearFallback = (() => {
      const id = String(global.currentMonthId || '').trim();
      const byId = id.match(/_(20\d{2})$/);
      return byId ? Number(byId[1] || new Date().getFullYear()) : new Date().getFullYear();
    })();
    const payloadDefaultCardName = normalizeText(
      payload?.card_name
      || payload?.cardName
      || payload?.card
      || payload?.cartao
      || payload?.cartão
      || payload?.institution
      || payload?.bank
      || payload?.title
      || payload?.header
      || ''
    );
    const payloadDefaultMonth = normalizeText(
      payload?.month_id
      || payload?.monthId
      || payload?.month
      || payload?.competence_month
      || payload?.competencia
      || ''
    );
    const payloadMonthReferenceId = parseMonthReferenceToId(
      normalizeText(payload?.statement_month || payload?.invoice_month || payload?.month_label || payloadDefaultMonth || '')
    );
    const getYearFromMonthId = (monthId) => {
      const match = String(monthId || '').match(/_(20\d{2})$/);
      return match ? Number(match[1] || 0) : 0;
    };
    const alignDateYearToMonthReference = (normalizedDate, monthId) => {
      const dateMatch = String(normalizedDate || '').match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
      if (!dateMatch) return normalizedDate;
      const targetYear = getYearFromMonthId(monthId);
      if (!targetYear) return normalizedDate;
      const currentYear = 2000 + Number(dateMatch[3] || 0);
      if (currentYear === targetYear) return normalizedDate;
      return `${dateMatch[1]}/${dateMatch[2]}/${String(targetYear).slice(-2)}`;
    };

    const ignoredItems = [];
    const payloadCardHints = buildPayloadCardHints(payload, context.cardIndex);
    const items = flatItems.map((rawItem, index) => {
      const monthIdFromFieldRaw = normalizeText(
        rawItem?.month_id
        || rawItem?.monthId
        || rawItem?.month
        || rawItem?.competence_month
        || rawItem?.competencia
        || payloadDefaultMonth
      );
      let monthIdFromField = parseMonthReferenceToId(monthIdFromFieldRaw);
      if (!monthIdFromField && /_20\d{2}$/.test(monthIdFromFieldRaw)) {
        monthIdFromField = monthIdFromFieldRaw;
      }
      const yearHintFromMonth = getYearFromMonthId(monthIdFromField || payloadMonthReferenceId || '');
      const dateMeta = normalizeImportDateWithMeta(rawItem?.date, currentYearFallback, {
        preferredYear: yearHintFromMonth || currentYearFallback
      });
      const date = dateMeta.date;
      const description = normalizeText(rawItem?.description);
      if (isReimbursementLikeEntry(description)) {
        ignoredItems.push({
          index,
          description
        });
        return null;
      }
      const amount = parseAmount(rawItem?.amount);
      let monthId = monthIdFromField
        || getMonthIdFromDate(date)
        || payloadMonthReferenceId
        || normalizeText(global.currentMonthId || '');
      const matchedMonthId = resolveMonthIdAgainstExisting(monthMap, monthId, date);
      if (matchedMonthId) monthId = matchedMonthId;
      const rawItemWithPayloadContext = {
        ...rawItem,
        card_name: normalizeText(rawItem?.card_name || payloadDefaultCardName),
        institution: normalizeText(rawItem?.institution || rawItem?.bank || payload?.institution || payload?.bank || ''),
        header: normalizeText(rawItem?.header || payload?.header || payload?.title || '')
      };
      const card = resolveCard(rawItemWithPayloadContext, context.cardIndex)
        || inferCardFromText(rawItemWithPayloadContext, context.cardIndex, payloadCardHints);
      const categoryRaw = normalizeText(rawItem?.category);
      const category = resolveCategory(rawItem, context.categoryIndex);
      const confidence = Number(rawItem?.confidence);
      const suggestions = Array.isArray(rawItem?.suggested_categories)
        ? rawItem.suggested_categories
            .map(item => context.categoryIndex.byNormalized.get(normalizeComparableText(item)))
            .filter(Boolean)
            .slice(0, 3)
        : [];
      const itemWarnings = [];
      const itemErrors = [];
      let needsReview = rawItem?.needs_review === true;

      if (!date) itemErrors.push('Data inválida ou ausente.');
      if (!description) itemErrors.push('Descrição ausente.');
      if (!Number.isFinite(amount) || amount <= 0) itemErrors.push('Valor inválido.');
      if (!monthId) itemErrors.push('Mês não identificado.');
      if (!card) {
        itemErrors.push('Cartão não identificado ou inexistente no contexto.');
      }
      if (categoryRaw && !category) {
        itemErrors.push('Categoria fora da lista existente.');
      } else if (!category) {
        needsReview = true;
        itemWarnings.push('Categoria ausente ou fora da lista existente.');
      }
      if (isLikelyCardBillEntry(description)) {
        needsReview = true;
        itemWarnings.push('Item parece total de fatura e não compra individual.');
      }
      if (dateMeta.inferredYear) {
        itemWarnings.push(`Ano não detectado na data; assumido ${currentYearFallback}.`);
      }
      const dateAlignedToMonth = alignDateYearToMonthReference(date, monthId);
      if (dateMeta.interpretedAsUS) itemWarnings.push('Data interpretada no padrÃ£o americano (MM/DD). Revise se necessÃ¡rio.');
      if (dateAlignedToMonth && dateAlignedToMonth !== date && (monthIdFromField || payloadMonthReferenceId)) itemWarnings.push(`Ano ajustado para ${getYearFromMonthId(monthId)} com base no mÃªs de referÃªncia.`);
      if (detectDuplicate({ monthId, cardId: card?.id || '', date: dateAlignedToMonth || date, description, amount }, monthMap)) {
        itemWarnings.push('Possível lançamento duplicado com dados já existentes.');
      }
      if (Number.isFinite(confidence) && confidence < 0.55) {
        needsReview = true;
        itemWarnings.push('Baixa confiança de interpretação da IA.');
      }
      if (rawItem?.tag !== null && rawItem?.tag !== undefined && String(rawItem.tag).trim() !== '') {
        itemWarnings.push('Tag enviada pela IA foi descartada (tag deve vir vazia).');
      }
      if (monthId && !resolveMonthIdAgainstExisting(monthMap, monthId, dateAlignedToMonth || date)) {
        itemWarnings.push('Mês ainda não existe no sistema e será criado na importação.');
      }

      const normalizedItem = {
        id: `bill_import_item_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
        sourceIndex: index,
        include: true,
        date: dateAlignedToMonth || date,
        description,
        amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0,
        monthId,
        cardId: card?.id || '',
        cardName: card?.name || normalizeText(rawItem?.card_name),
        category: category || '',
        suggestedCategories: suggestions,
        tag: '',
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
        needsReview,
        warnings: [...itemWarnings, ...(Array.isArray(rawItem?.warnings) ? rawItem.warnings.map(normalizeText).filter(Boolean) : [])],
        aiWarnings: Array.isArray(rawItem?.warnings) ? rawItem.warnings.map(normalizeText).filter(Boolean) : [],
        errors: itemErrors,
        sourceExcerpt: normalizeText(rawItem?.source_excerpt || ''),
        rawSource: rawItem.__source || null
      };
      normalizedItem.status = determineStatus(normalizedItem);
      return normalizedItem;
    }).filter(Boolean);

    if (ignoredItems.length) {
      warnings.push(`${ignoredItems.length} lançamento(s) de ressarcimento/estorno foram ignorados automaticamente.`);
    }

    const summary = items.reduce((acc, item) => {
      acc.total += 1;
      acc[item.status] += 1;
      return acc;
    }, { total: 0, valid: 0, warning: 0, needs_review: 0, error: 0 });

    return {
      formatErrors,
      warnings,
      items,
      ignoredItems,
      ignoredCount: ignoredItems.length,
      summary
    };
  }

  const api = {
    FORMAT_NAME,
    FORMAT_VERSION,
    normalizeImportDateWithMeta,
    normalizeImportDate,
    parseAmount,
    flattenPayloadItems,
    validatePayload,
    normalizeComparableText,
    getMonthIdFromDate,
    parseMonthReferenceToId
  };

  global.BillImportSchema = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
