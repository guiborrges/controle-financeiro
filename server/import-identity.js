'use strict';

const crypto = require('node:crypto');
const identity = require('../public/app/modules/shared/import-identity');

function nativeTransactionId(tx) {
  const value = [tx?.id, tx?.transactionId, tx?.providerId].find(item => String(item ?? '').trim());
  return String(value ?? '').trim();
}

function stagingIdentity(tx, accountId, tenantId) {
  const source = identity.create({ tenantId, provider: 'pluggy', accountId, externalId: nativeTransactionId(tx) });
  return source ? `txv1:${crypto.createHash('sha256').update(source.key).digest('hex')}` : '';
}

// Reuse one unambiguous legacy key in place. Never merge or delete historic rows.
async function resolveStagingKey(conn, tx, accountId, tenantId) {
  const canonical = stagingIdentity(tx, accountId, tenantId);
  if (!canonical) return { status: 'missing', key: '' };
  const native = nativeTransactionId(tx);
  const result = await conn.execute(`SELECT external_transaction_id FROM transacoes_pluggy
    WHERE tenant_user_id = :tenant AND pluggy_account_id = :account
    AND external_transaction_id IN (:canonical, :native, :legacy)`,
  { tenant: tenantId, account: accountId, canonical, native, legacy: `tx:${native}` });
  const rows = result?.rows || [];
  if (rows.length > 1) return { status: 'ambiguous', key: '' };
  return { status: rows.length ? 'legacy-or-existing' : 'new',
    key: rows.length ? String(rows[0].EXTERNAL_TRANSACTION_ID || rows[0][0]) : canonical };
}

module.exports = { ...identity, nativeTransactionId, stagingIdentity, resolveStagingKey };
