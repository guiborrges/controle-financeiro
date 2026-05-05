'use strict';

const { withConnection } = require('../../../workers/lib/oracle-db');

const TENANT_USER_ID = String(process.env.PLUGGY_TENANT_USER_ID || 'guilherme').trim();
const ALLOWED_USER_IDS = String(process.env.PLUGGY_ALLOWED_USER_IDS || '')
  .split(',')
  .map(value => String(value || '').trim().toLowerCase())
  .filter(Boolean);
const ALLOWED_USERNAMES = String(process.env.PLUGGY_ALLOWED_USERNAMES || '')
  .split(',')
  .map(value => String(value || '').trim().toLowerCase())
  .filter(Boolean);

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function isUserAllowed(user) {
  if (!user) return false;
  const id = normalize(user.id);
  const username = normalize(user.username);
  const displayName = normalize(user.displayName);
  const fullName = normalize(user.fullName || user.displayName);

  if (ALLOWED_USER_IDS.length && id && ALLOWED_USER_IDS.includes(id)) return true;
  if (ALLOWED_USERNAMES.length) {
    if (username && ALLOWED_USERNAMES.includes(username)) return true;
    if (displayName && ALLOWED_USERNAMES.includes(displayName)) return true;
    if (fullName && ALLOWED_USERNAMES.includes(fullName)) return true;
  }

  return username === 'guilherme' || fullName.includes('guilherme silva borges');
}

function mapConnectionRow(row = {}) {
  return {
    pluggyItemId: String(row.PLUGGY_ITEM_ID || ''),
    providerName: String(row.PROVIDER_NAME || ''),
    status: String(row.STATUS || ''),
    updatedAt: row.UPDATED_AT ? new Date(row.UPDATED_AT).toISOString() : null
  };
}

function mapTransactionRow(row = {}) {
  return {
    id: String(row.EXTERNAL_TRANSACTION_ID || ''),
    itemId: String(row.PLUGGY_ITEM_ID || ''),
    accountId: String(row.PLUGGY_ACCOUNT_ID || ''),
    recordType: String(row.RECORD_TYPE || ''),
    date: row.TRANSACTION_DATE ? new Date(row.TRANSACTION_DATE).toISOString() : null,
    description: String(row.DESCRIPTION || ''),
    amount: Number(row.AMOUNT || 0),
    currencyCode: String(row.CURRENCY_CODE || 'BRL'),
    accountName: String(row.ACCOUNT_NAME || ''),
    accountType: String(row.ACCOUNT_TYPE || ''),
    balanceAmount: row.BALANCE_AMOUNT == null ? null : Number(row.BALANCE_AMOUNT),
    updatedAt: row.UPDATED_AT ? new Date(row.UPDATED_AT).toISOString() : null
  };
}

async function loadConnectionSummary(tenantUserId) {
  return withConnection(async conn => {
    const rs = await conn.execute(
      `
SELECT pluggy_item_id, provider_name, status, updated_at
  FROM conexoes_bancarias
 WHERE tenant_user_id = :tenant_user_id
 ORDER BY updated_at DESC
`,
      { tenant_user_id: tenantUserId }
    );
    const rows = Array.isArray(rs?.rows) ? rs.rows : [];
    return rows.map(mapConnectionRow);
  });
}

async function loadTransactions(tenantUserId, limit = 300) {
  return withConnection(async conn => {
    const rs = await conn.execute(
      `
SELECT * FROM (
  SELECT
    external_transaction_id,
    pluggy_item_id,
    pluggy_account_id,
    record_type,
    transaction_date,
    description,
    amount,
    currency_code,
    account_name,
    account_type,
    balance_amount,
    updated_at
  FROM transacoes_pluggy
  WHERE tenant_user_id = :tenant_user_id
  ORDER BY transaction_date DESC NULLS LAST, updated_at DESC
)
WHERE ROWNUM <= :row_limit
`,
      {
        tenant_user_id: tenantUserId,
        row_limit: Math.max(1, Number(limit || 300))
      }
    );
    const rows = Array.isArray(rs?.rows) ? rs.rows : [];
    return rows.map(mapTransactionRow);
  });
}

function registerPluggyPreviewRoutes(app, deps = {}) {
  const noStore = typeof deps.noStore === 'function' ? deps.noStore : ((_, __, next) => next());
  const requireAuth = typeof deps.requireAuth === 'function' ? deps.requireAuth : ((_, __, next) => next());
  const getAuthenticatedUser = typeof deps.getAuthenticatedUser === 'function'
    ? deps.getAuthenticatedUser
    : () => null;

  app.get('/api/pluggy/connection', noStore, requireAuth, async (req, res) => {
    try {
      const user = getAuthenticatedUser(req);
      if (!isUserAllowed(user)) {
        return res.status(403).json({ message: 'Conexão de internet banking indisponível para este usuário.' });
      }
      const connections = await loadConnectionSummary(TENANT_USER_ID);
      return res.json({
        connected: connections.length > 0,
        tenantUserId: TENANT_USER_ID,
        connectionsCount: connections.length
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Falha ao verificar conexão do internet banking.',
        details: error?.message || String(error)
      });
    }
  });

  app.get('/api/pluggy/preview', noStore, requireAuth, async (req, res) => {
    try {
      const user = getAuthenticatedUser(req);
      if (!isUserAllowed(user)) {
        return res.status(403).json({ message: 'Pré-visualização de internet banking indisponível para este usuário.' });
      }
      const limit = Number(req.query?.limit || 300);
      const [connections, transactions] = await Promise.all([
        loadConnectionSummary(TENANT_USER_ID),
        loadTransactions(TENANT_USER_ID, limit)
      ]);
      const latestUpdatedAt = transactions[0]?.updatedAt || connections[0]?.updatedAt || null;
      return res.json({
        connected: connections.length > 0,
        tenantUserId: TENANT_USER_ID,
        latestUpdatedAt,
        connections,
        transactions
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Falha ao carregar pré-visualização do internet banking.',
        details: error?.message || String(error)
      });
    }
  });
}

module.exports = {
  registerPluggyPreviewRoutes
};

