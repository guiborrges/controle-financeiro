(function initImportIdentity(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ImportIdentity = api;
})(typeof window !== 'undefined' ? window : globalThis, function buildImportIdentity() {
  'use strict';
  const text = value => String(value ?? '').trim();

  function create({ tenantId, provider, accountId, externalId, quality = 'native' } = {}) {
    const parts = [tenantId, provider, accountId, externalId].map(text);
    if (parts.some(value => !value)) return null;
    return { version: 1, tenantId: parts[0], provider: parts[1], accountId: parts[2],
      externalId: parts[3], quality: quality === 'native' ? 'native' : 'source-row',
      key: `fi1:${JSON.stringify(parts)}` };
  }

  function read(item) {
    if (item?.importIdentity?.version != null && item.importIdentity.version !== 1) return null;
    return item?.importIdentity ? create(item.importIdentity) : null;
  }

  function provenance(item) {
    const result = {};
    const identity = read(item);
    if (identity) result.importIdentity = identity;
    for (const field of ['ibImportKey', 'internetBankingImportKey', 'pluggyTransactionId',
      'sourceAccountName', 'ibAccountNameOriginal', 'sourceImportId', 'sourceRowId', 'sourceDirection', 'sourceDescription']) {
      if (item?.[field] != null) result[field] = text(item[field]);
    }
    return result;
  }

  function signature(item) {
    return JSON.stringify([text(item.context), text(item.date), Math.round(Number(item.amount || 0) * 100),
      text(item.direction), text(item.description).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ')]);
  }

  function createMatcher(rows, describe = value => value) {
    const entries = (rows || []).map((row, index) => ({ row, index, value: describe(row) }));
    const consumed = new Set();
    return incoming => {
      const identity = incoming.identity;
      const exact = identity && entries.find(entry => entry.value.identity?.key === identity.key);
      if (exact) {
        consumed.add(exact.index);
        return { kind: 'exact', candidate: exact.row, reason: 'Mesmo identificador de origem nesta conta.' };
      }
      const candidate = entries.find(entry => {
        if (consumed.has(entry.index)) return false;
        const prior = entry.value.identity;
        if (identity?.quality === 'native' && prior?.quality === 'native' && identity.key !== prior.key) return false;
        return signature(entry.value) === signature(incoming);
      });
      if (!candidate) return { kind: 'new', reason: '' };
      consumed.add(candidate.index);
      return { kind: 'candidate', candidate: candidate.row,
        reason: 'Mesmo valor, data e descricao; a origem nao confirma se e a mesma compra.' };
    };
  }

  return { create, read, provenance, signature, createMatcher };
});
