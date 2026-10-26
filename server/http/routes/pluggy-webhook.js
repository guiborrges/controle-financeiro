'use strict';

const { withConnection } = require('../../../workers/lib/oracle-db');
const staging = require('../../repositories/pluggy-staging');
const { ensureTransactionsTable } = staging;
const { createSerialQueue } = require('../../jobs/serial-queue');
const { positiveLimit } = require('../../integrations/deadline');
const { stagingIdentity, resolveStagingKey } = require('../../import-identity');

const DEFAULT_TENANT_USER_ID = String(process.env.PLUGGY_TENANT_USER_ID || 'guilherme').trim();
const WEBHOOK_SECRET = String(process.env.PLUGGY_WEBHOOK_SECRET || '').trim();
const REQUIRE_WEBHOOK_SECRET = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.PLUGGY_WEBHOOK_REQUIRE_SECRET || 'false').trim().toLowerCase()
);

async function upsertConnection(item, tenantUserId) {
  await withConnection(async conn => {
    await staging.ensureConnectionsTable(conn, { includeStatusIndex: false });
    await staging.upsertConnection(conn,
      {
        tenant_user_id: String(tenantUserId || DEFAULT_TENANT_USER_ID),
        pluggy_item_id: String(item?.id || '').trim(),
        provider_name: String(item?.connector?.name || item?.institution?.name || '').slice(0, 256),
        status: String(item?.status || '').slice(0, 64),
        raw_json: JSON.stringify(item || {})
      }
    );
    await conn.commit();
  });
}

function toTimestamp(value) {
  const ms = Date.parse(String(value || ''));
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isCreditCardTransaction(tx) {
  const category = String(tx?.category || tx?.categoryName || '').toUpperCase();
  const type = String(tx?.type || tx?.nature || '').toUpperCase();
  const accountType = String(tx?.accountType || tx?.account?.type || '').toUpperCase();
  const description = String(tx?.description || '').toUpperCase();
  return category.includes('CART')
    || accountType.includes('CREDIT')
    || type.includes('CREDIT_CARD')
    || description.includes('CARTAO');
}

function normalizeExternalTransactionId(tx, tenantId = DEFAULT_TENANT_USER_ID) {
  return stagingIdentity(tx, String(tx?.accountId || tx?.account?.id || '').trim(), tenantId);
}

function normalizeTransactionsFromWebhook(payload) {
  const data = payload?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.transactions)) return data.transactions;
  if (Array.isArray(payload?.transactions)) return payload.transactions;
  if (data && typeof data === 'object') return [data];
  return [];
}

function resolveTenantUserId(payload) {
  const candidates = [
    payload?.clientUserId,
    payload?.data?.clientUserId,
    payload?.item?.clientUserId,
    payload?.data?.item?.clientUserId,
    payload?.userId,
    payload?.data?.userId,
    payload?.tenantUserId,
    payload?.data?.tenantUserId
  ];
  const hit = candidates.find(value => String(value || '').trim());
  return String(hit || DEFAULT_TENANT_USER_ID).trim();
}

async function upsertTransactions(transactions, tenantUserId) {
  if (!Array.isArray(transactions) || !transactions.length) return { inserted: 0, skipped: 0 };
  let inserted = 0;
  let skipped = 0;
  await withConnection(async conn => {
    await ensureTransactionsTable(conn);
    for (const tx of transactions) {
      const itemId = String(tx?.itemId || tx?.item?.id || tx?.account?.itemId || '').trim();
      const accountId = String(tx?.accountId || tx?.account?.id || '').trim();
      const identity = await resolveStagingKey(conn, tx, accountId, tenantUserId);
      if (!identity.key) {
        skipped += 1;
        console.warn(`[pluggy-webhook] transacao nao aplicada: identidade ${identity.status}`);
        continue;
      }
      const accountName = String(tx?.account?.name || tx?.accountName || '').trim();
      const accountType = String(tx?.accountType || tx?.account?.type || '').trim();
      const recordType = isCreditCardTransaction(tx) ? 'CARTAO_CREDITO' : 'CONTA_CORRENTE';

      await staging.upsertTransaction(conn,
        {
          tenant_user_id: String(tenantUserId || DEFAULT_TENANT_USER_ID),
          pluggy_item_id: itemId || null,
          pluggy_account_id: accountId || null,
          external_transaction_id: identity.key,
          record_type: recordType,
          transaction_date: toTimestamp(tx?.date || tx?.paymentDate || tx?.createdAt),
          description: String(tx?.description || 'Transacao Pluggy').slice(0, 512),
          amount: toNumber(tx?.amount),
          currency_code: String(tx?.currencyCode || tx?.currency || 'BRL').slice(0, 8),
          account_name: accountName.slice(0, 256),
          account_type: accountType.slice(0, 64),
          raw_json: JSON.stringify(tx || {})
        }, { includeBalance: false }
      );
      inserted += 1;
    }
    await conn.commit();
  });
  return { inserted, skipped };
}

function getEventType(payload) {
  return String(
    payload?.event ||
    payload?.eventType ||
    payload?.type ||
    payload?.name ||
    ''
  ).trim().toLowerCase();
}

function getItem(payload) {
  return payload?.item || payload?.data?.item || payload?.data || payload;
}

function registerPluggyWebhookRoutes(app, deps = {}) {
  const queue = createSerialQueue({
    maxPendingPerKey: positiveLimit(process.env.PLUGGY_WEBHOOK_MAX_PENDING_PER_USER, 20),
    maxPending: positiveLimit(process.env.PLUGGY_WEBHOOK_MAX_PENDING_TOTAL, 100)
  });
  const batchLimit = positiveLimit(process.env.PLUGGY_WEBHOOK_MAX_TRANSACTIONS, 1000);
  const noStore = typeof deps.noStore === 'function' ? deps.noStore : ((_, __, next) => next());
  const webhookSecret = String((deps.webhookSecret ?? WEBHOOK_SECRET) || '').trim();
  const requireWebhookSecret = typeof deps.requireWebhookSecret === 'boolean'
    ? deps.requireWebhookSecret
    : REQUIRE_WEBHOOK_SECRET;
  const upsertConnectionFn = typeof deps.upsertConnection === 'function' ? deps.upsertConnection : upsertConnection;
  const upsertTransactionsFn = typeof deps.upsertTransactions === 'function' ? deps.upsertTransactions : upsertTransactions;
  const resolveTenantUserIdFn = typeof deps.resolveTenantUserId === 'function' ? deps.resolveTenantUserId : resolveTenantUserId;

  app.post('/api/pluggy/webhook', noStore, async (req, res) => {
    try {
      const provided = String(req.headers['x-pluggy-webhook-secret'] || '').trim();
      if (requireWebhookSecret) {
        if (!webhookSecret) {
          return res.status(503).json({ message: 'Webhook Pluggy desabilitado: PLUGGY_WEBHOOK_SECRET nao configurado.' });
        }
        if (!provided || provided !== webhookSecret) {
          return res.status(401).json({ message: 'Webhook Pluggy nao autorizado.' });
        }
      } else if (provided && webhookSecret && provided !== webhookSecret) {
        return res.status(401).json({ message: 'Webhook Pluggy nao autorizado.' });
      }

      const payload = req.body || {};
      const tenantUserId = String(resolveTenantUserIdFn(payload) || DEFAULT_TENANT_USER_ID).trim();
      const eventType = getEventType(payload);
      const item = getItem(payload);
      console.log(`[pluggy-webhook] recebido eventType=${eventType || 'unknown'} tenant=${tenantUserId}`);

      const isItemCreated = eventType === 'item/created' || eventType === 'item.created';
      const isItemUpdated = eventType === 'item/updated' || eventType === 'item.updated';
      const isItemLoginSucceeded = eventType === 'item/login_succeeded' || eventType === 'item.login_succeeded';
      const isTransactionsCreated = eventType === 'transactions/created' || eventType === 'transactions.created';
      const isTransactionsUpdated = eventType === 'transactions/updated' || eventType === 'transactions.updated';
      const isTransactionsEvent = isTransactionsCreated || isTransactionsUpdated;

      if (isItemCreated || isItemUpdated || isItemLoginSucceeded) {
        const itemId = String(item?.id || '').trim();
        if (!itemId) {
          console.warn('[pluggy-webhook] item event sem item.id');
          return res.status(400).json({ message: 'Webhook Pluggy sem item.id.' });
        }
        await queue.enqueue(tenantUserId, () => upsertConnectionFn(item, tenantUserId));
        console.log(`[pluggy-webhook] item event processado eventType=${eventType} itemId=${itemId}`);
        return res.status(200).json({ ok: true, eventType, itemId });
      }

      if (isTransactionsEvent) {
        const transactions = normalizeTransactionsFromWebhook(payload);
        if (transactions.length > batchLimit) {
          return res.status(413).json({ message: 'Lote de transacoes Pluggy excede o limite permitido.' });
        }
        const result = await queue.enqueue(tenantUserId, () => upsertTransactionsFn(transactions, tenantUserId));
        console.log(`[pluggy-webhook] transactions event processado eventType=${eventType} count=${transactions.length} inserted=${result.inserted} skipped=${result.skipped}`);
        return res.status(200).json({ ok: true, eventType, ...result });
      }

      console.log(`[pluggy-webhook] evento ignorado eventType=${eventType || 'unknown'}`);
      return res.status(200).json({ ok: true, ignored: true, eventType: eventType || null });
    } catch (error) {
      if (error.code === 'INTEGRATION_BUSY') {
        return res.status(503).json({ message: 'Fila Pluggy ocupada. Tente novamente em instantes.' });
      }
      console.error('[pluggy-webhook] erro:', error?.message || error);
      return res.status(500).json({ message: 'Falha ao processar webhook Pluggy.' });
    }
  });
}

module.exports = {
  registerPluggyWebhookRoutes,
  resolveTenantUserId,
  normalizeTransactionsFromWebhook,
  getEventType,
  getItem,
  normalizeExternalTransactionId
};
