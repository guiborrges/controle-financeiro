'use strict';

const identity = require('./import-identity');

function planInvoiceImport(data, items, userId, jobId, normalizeDate) {
  const matcher = identity.createMatcher(data.flatMap(month => month.outflows || []), row => ({
    identity: identity.read(row), context: row.outputKind === 'card' ? String(row.outputRef) : '',
    date: normalizeDate(row.date), amount: Number(row.amount || 0),
    direction: row.sourceDirection || 'debit', description: row.sourceDescription || row.description
  }));
  const result = new Map();
  items.forEach((item, index) => {
    if (!item) return;
    const cardId = String(item.cardId || item.card || item.card_id || '').trim();
    const rowId = String(item.sourceRowId ?? item.sourceIndex ?? index);
    const source = identity.create({ tenantId: userId, provider: 'invoice', accountId: cardId,
      externalId: `${jobId}:${rowId}`, quality: 'source-row' });
    const match = matcher({ identity: source, context: cardId, date: normalizeDate(item.date),
      amount: Number(item.amount || 0), direction: item.sourceDirection || 'debit', description: item.sourceDescription || item.description });
    const creditDescription = /\b(estorno|reembolso|ressarcimento|chargeback|devolucao)\b/i.test(String(item.sourceDescription || item.description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    if (item.include !== false && (item.creditAdjustment || creditDescription || item.sourceDirection === 'credit' || Number(item.amount) < 0)) {
      throw Object.assign(new Error('Credito ou estorno requer revisao e nao pode virar despesa.'), { reviewRequired: true });
    }
    if (item.include !== false && match.kind === 'candidate' && item.duplicateDecision !== 'new') {
      throw Object.assign(new Error('Possivel duplicata: confirme Importar como nova ou desmarque o item.'), { reviewRequired: true });
    }
    result.set(item, { identity: source, rowId, match });
  });
  return result;
}

module.exports = { planInvoiceImport };
