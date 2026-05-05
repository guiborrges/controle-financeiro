'use strict';

const crypto = require('crypto');
const { withConnection, closePool } = require('./lib/oracle-db');
const pluggy = require('./lib/pluggy-client');

const LOOP_MINUTES = Math.max(1, Number(process.env.PLUGGY_SYNC_INTERVAL_MINUTES || 10));
const DAYS_BACK = Math.max(1, Number(process.env.PLUGGY_SYNC_DAYS_BACK || 45));
const TENANT_USER_ID = String(process.env.PLUGGY_TENANT_USER_ID || 'guilherme').trim();
const FILTER_ITEM_IDS = String(process.env.PLUGGY_ITEM_IDS || '')
  .split(',')
  .map(value => String(value || '').trim())
  .filter(Boolean);

let running = false;
let timer = null;

function nowIso() {
  return new Date().toISOString();
}

function dateFromIso() {
  const ms = Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hashObject(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex');
}

function txExternalId(tx, accountId) {
  const nativeId = String(tx?.id || tx?.transactionId || tx?.providerId || '').trim();
  if (nativeId) return `tx:${nativeId}`;
  const signature = `${String(accountId || '')}|${String(tx?.date || tx?.paymentDate || '')}|${String(tx?.description || '')}|${String(tx?.amount || '')}`;
  return `txhash:${crypto.createHash('sha1').update(signature).digest('hex')}`;
}

function toTimestamp(value) {
  const ms = Date.parse(String(value || ''));
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

async function upsertRow(conn, row) {
  const sql = `
MERGE INTO transacoes_pluggy t
USING (
  SELECT
    :tenant_user_id AS tenant_user_id,
    :external_transaction_id AS external_transaction_id
  FROM dual
) src
ON (
  t.tenant_user_id = src.tenant_user_id
  AND t.external_transaction_id = src.external_transaction_id
)
WHEN MATCHED THEN UPDATE SET
  t.pluggy_item_id = :pluggy_item_id,
  t.pluggy_account_id = :pluggy_account_id,
  t.record_type = :record_type,
  t.transaction_date = :transaction_date,
  t.description = :description,
  t.amount = :amount,
  t.currency_code = :currency_code,
  t.account_name = :account_name,
  t.account_type = :account_type,
  t.balance_amount = :balance_amount,
  t.raw_json = :raw_json,
  t.updated_at = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  tenant_user_id,
  pluggy_item_id,
  pluggy_account_id,
  external_transaction_id,
  record_type,
  transaction_date,
  description,
  amount,
  currency_code,
  account_name,
  account_type,
  balance_amount,
  raw_json,
  source_system,
  created_at,
  updated_at
) VALUES (
  :tenant_user_id,
  :pluggy_item_id,
  :pluggy_account_id,
  :external_transaction_id,
  :record_type,
  :transaction_date,
  :description,
  :amount,
  :currency_code,
  :account_name,
  :account_type,
  :balance_amount,
  :raw_json,
  'PLUGGY',
  SYSTIMESTAMP,
  SYSTIMESTAMP
)`;
  await conn.execute(sql, row, { autoCommit: false });
}

async function syncOnce() {
  if (running) return;
  running = true;
  const start = Date.now();
  try {
    const items = await pluggy.listItems();
    const selectedItems = FILTER_ITEM_IDS.length
      ? items.filter(item => FILTER_ITEM_IDS.includes(String(item?.id || '')))
      : items;

    let accountsCount = 0;
    let txCount = 0;
    let balanceCount = 0;

    await withConnection(async conn => {
      for (const item of selectedItems) {
        const itemId = String(item?.id || '');
        if (!itemId) continue;
        const accounts = await pluggy.listAccounts(itemId);
        accountsCount += accounts.length;

        for (const account of accounts) {
          const accountId = String(account?.id || '');
          if (!accountId) continue;

          const transactions = await pluggy.listTransactions(accountId, dateFromIso());
          for (const tx of transactions) {
            const row = {
              tenant_user_id: TENANT_USER_ID,
              pluggy_item_id: itemId,
              pluggy_account_id: accountId,
              external_transaction_id: txExternalId(tx, accountId),
              record_type: 'TRANSACTION',
              transaction_date: toTimestamp(tx?.date || tx?.paymentDate || tx?.createdAt),
              description: String(tx?.description || tx?.merchant?.name || 'Transacao Pluggy').slice(0, 512),
              amount: toNumber(tx?.amount),
              currency_code: String(tx?.currencyCode || 'BRL').slice(0, 8),
              account_name: String(account?.name || account?.marketingName || '').slice(0, 256),
              account_type: String(account?.type || '').slice(0, 64),
              balance_amount: null,
              raw_json: JSON.stringify(tx || {})
            };
            await upsertRow(conn, row);
            txCount += 1;
          }

          const balanceValue = toNumber(account?.balance);
          if (balanceValue !== null) {
            const snapshotDate = new Date();
            const externalBalanceId = `balance:${accountId}:${snapshotDate.toISOString().slice(0, 10)}`;
            await upsertRow(conn, {
              tenant_user_id: TENANT_USER_ID,
              pluggy_item_id: itemId,
              pluggy_account_id: accountId,
              external_transaction_id: externalBalanceId,
              record_type: 'BALANCE',
              transaction_date: snapshotDate,
              description: 'Saldo sincronizado via Pluggy',
              amount: null,
              currency_code: String(account?.currencyCode || 'BRL').slice(0, 8),
              account_name: String(account?.name || account?.marketingName || '').slice(0, 256),
              account_type: String(account?.type || '').slice(0, 64),
              balance_amount: balanceValue,
              raw_json: JSON.stringify({
                account,
                snapshotHash: hashObject(account),
                syncedAt: nowIso()
              })
            });
            balanceCount += 1;
          }
        }
      }
      await conn.commit();
    });

    const elapsed = Date.now() - start;
    console.log(`[sync-pluggy] OK ${nowIso()} items=${selectedItems.length} accounts=${accountsCount} tx=${txCount} balance=${balanceCount} elapsedMs=${elapsed}`);
  } catch (error) {
    console.error(`[sync-pluggy] ERRO ${nowIso()} ${error?.message || error}`);
  } finally {
    running = false;
  }
}

function scheduleNext() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    await syncOnce();
    scheduleNext();
  }, LOOP_MINUTES * 60 * 1000);
}

async function start() {
  console.log(`[sync-pluggy] iniciando. interval=${LOOP_MINUTES}min daysBack=${DAYS_BACK} tenantUserId=${TENANT_USER_ID}`);
  await syncOnce();
  scheduleNext();
}

async function shutdown(signal) {
  console.log(`[sync-pluggy] encerrando (${signal})...`);
  clearTimeout(timer);
  await closePool().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch(error => {
  console.error('[sync-pluggy] falha fatal ao iniciar:', error?.message || error);
  process.exit(1);
});

