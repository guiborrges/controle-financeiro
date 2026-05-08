'use strict';

const { withConnection } = require('../../../workers/lib/oracle-db');

function getAllowedUserIds() {
  return String(process.env.PLUGGY_ALLOWED_USER_IDS || '')
    .split(',')
    .map(value => String(value || '').trim().toLowerCase())
    .filter(Boolean);
}

function getAllowedUsernames() {
  return String(process.env.PLUGGY_ALLOWED_USERNAMES || '')
    .split(',')
    .map(value => String(value || '').trim().toLowerCase())
    .filter(Boolean);
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function isUserAllowed(user) {
  if (!user) return false;
  const id = normalize(user.id);
  const username = normalize(user.username);
  const displayName = normalize(user.displayName);
  const fullName = normalize(user.fullName || user.displayName);

  const allowedUserIds = getAllowedUserIds();
  const allowedUsernames = getAllowedUsernames();

  if (allowedUserIds.length && id && allowedUserIds.includes(id)) return true;
  if (allowedUsernames.length) {
    if (username && allowedUsernames.includes(username)) return true;
    if (displayName && allowedUsernames.includes(displayName)) return true;
    if (fullName && allowedUsernames.includes(fullName)) return true;
  }

  return username === 'guilherme' || fullName.includes('guilherme silva borges');
}

function resolveTenantUserId(user) {
  if (!user || typeof user !== 'object') return '';
  return String(
    user.id
    || user.username
    || user.email
    || user.displayName
    || ''
  ).trim();
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
  let raw = {};
  try {
    raw = row.RAW_JSON ? JSON.parse(String(row.RAW_JSON)) : {};
  } catch (_) {
    raw = {};
  }
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
    updatedAt: row.UPDATED_AT ? new Date(row.UPDATED_AT).toISOString() : null,
    category: String(raw?.category || raw?.categoryName || ''),
    type: String(raw?.type || ''),
    status: String(raw?.status || ''),
    operationType: String(raw?.operationType || ''),
    descriptionRaw: String(raw?.descriptionRaw || ''),
    creditCardMetadata: raw?.creditCardMetadata && typeof raw.creditCardMetadata === 'object'
      ? raw.creditCardMetadata
      : null
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
  const safeLimit = Math.max(1, Number(limit || 300));
  return withConnection(async conn => {
    const rs = await conn.execute(
      `
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
  raw_json,
  updated_at
FROM transacoes_pluggy
WHERE tenant_user_id = :tenant_user_id
ORDER BY transaction_date DESC NULLS LAST, updated_at DESC
FETCH FIRST ${safeLimit} ROWS ONLY
`,
      {
        tenant_user_id: tenantUserId
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
  const loadConnectionSummaryFn = typeof deps.loadConnectionSummary === 'function'
    ? deps.loadConnectionSummary
    : loadConnectionSummary;
  const loadTransactionsFn = typeof deps.loadTransactions === 'function'
    ? deps.loadTransactions
    : loadTransactions;

  app.get('/api/pluggy/connection', noStore, requireAuth, async (req, res) => {
    try {
      const user = getAuthenticatedUser(req);
      if (!isUserAllowed(user)) {
        return res.status(403).json({ message: 'Conexao de internet banking indisponivel para este usuario.' });
      }
      const tenantUserId = resolveTenantUserId(user);
      if (!tenantUserId) {
        return res.status(401).json({ message: 'Sessao invalida para internet banking.' });
      }
      const connections = await loadConnectionSummaryFn(tenantUserId);
      return res.json({
        connected: connections.length > 0,
        tenantUserId,
        connectionsCount: connections.length
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Falha ao verificar conexao do internet banking.',
        details: error?.message || String(error)
      });
    }
  });

  app.get('/api/pluggy/preview', noStore, requireAuth, async (req, res) => {
    try {
      const user = getAuthenticatedUser(req);
      if (!isUserAllowed(user)) {
        return res.status(403).json({ message: 'Pre-visualizacao de internet banking indisponivel para este usuario.' });
      }
      const tenantUserId = resolveTenantUserId(user);
      if (!tenantUserId) {
        return res.status(401).json({ message: 'Sessao invalida para internet banking.' });
      }
      const limit = Number(req.query?.limit || 300);
      const [connections, transactions] = await Promise.all([
        loadConnectionSummaryFn(tenantUserId),
        loadTransactionsFn(tenantUserId, limit)
      ]);
      const latestUpdatedAt = transactions[0]?.updatedAt || connections[0]?.updatedAt || null;
      return res.json({
        connected: connections.length > 0,
        tenantUserId,
        latestUpdatedAt,
        connections,
        transactions
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Falha ao carregar pre-visualizacao do internet banking.',
        details: error?.message || String(error)
      });
    }
  });

  app.get('/api/pluggy/transactions', noStore, requireAuth, async (req, res) => {
    try {
      const user = getAuthenticatedUser(req);
      if (!isUserAllowed(user)) {
        return res.status(403).json({ message: 'Internet banking indisponivel para este usuario.' });
      }

      const tenantUserId = resolveTenantUserId(user);
      if (!tenantUserId) {
        return res.status(401).json({ message: 'Sessao invalida para internet banking.' });
      }

      const limit = Number(req.query?.limit || 1200);
      const [connections, transactions] = await Promise.all([
        loadConnectionSummaryFn(tenantUserId),
        loadTransactionsFn(tenantUserId, limit)
      ]);

      const byAccount = new Map();
      transactions.forEach(tx => {
        const accountId = String(tx.accountId || tx.itemId || 'sem-conta');
        if (!byAccount.has(accountId)) {
          byAccount.set(accountId, {
            accountId,
            accountName: String(tx.accountName || tx.itemId || 'Conta sem nome'),
            accountType: String(tx.accountType || '').toUpperCase() === 'CREDIT' ? 'CREDIT' : 'BANK',
            transactions: []
          });
        }
        byAccount.get(accountId).transactions.push(tx);
      });

      return res.json({
        connected: connections.length > 0,
        tenantUserId,
        latestUpdatedAt: transactions[0]?.updatedAt || connections[0]?.updatedAt || null,
        accounts: Array.from(byAccount.values())
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Falha ao carregar transacoes do internet banking.',
        details: error?.message || String(error)
      });
    }
  });
}

module.exports = {
  registerPluggyPreviewRoutes,
  resolveTenantUserId
};
