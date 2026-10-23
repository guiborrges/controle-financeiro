'use strict';

const fs = require('node:fs');
const { nativeTransactionId, stagingIdentity } = require('../server/import-identity');

function inventory(rows) {
  const counts = { total: rows.length, canonical: 0, legacy: 0, missingIdentity: 0, ambiguousGroups: 0 };
  const groups = new Map();
  for (const row of rows) {
    let raw = row.raw || row.RAW_JSON || row.raw_json || {};
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = {}; } }
    const account = row.PLUGGY_ACCOUNT_ID || row.pluggy_account_id || row.accountId;
    const tenant = row.TENANT_USER_ID || row.tenant_user_id || row.tenantId;
    const key = stagingIdentity(raw, account, tenant);
    if (!key || !nativeTransactionId(raw)) { counts.missingIdentity++; continue; }
    if (String(row.EXTERNAL_TRANSACTION_ID || row.external_transaction_id) === key) counts.canonical++;
    else counts.legacy++;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  counts.ambiguousGroups = [...groups.values()].filter(count => count > 1).length;
  return counts;
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) throw new Error('Uso: node scripts/audit-import-identities.js export-staging.json (somente leitura)');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = Array.isArray(value) ? value : value.rows;
  if (!Array.isArray(rows)) throw new Error('O arquivo deve conter um array de linhas ou { rows: [...] }.');
  console.log(JSON.stringify(inventory(rows), null, 2));
}

module.exports = { inventory };
