'use strict';

const crypto = require('crypto');
const { withConnection, closePool } = require('./lib/oracle-db');
const pluggy = require('./lib/pluggy-client');
const staging = require('../server/repositories/pluggy-staging');
const { ensureConnectionsTable, upsertTransaction: upsertRow } = staging;
const { stagingIdentity, resolveStagingKey } = require('../server/import-identity');

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

function txExternalId(tx, accountId, tenantId = TENANT_USER_ID) {
  return stagingIdentity(tx, accountId, tenantId);
}

function toTimestamp(value) {
  const ms = Date.parse(String(value || ''));
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

async function upsertConnection(conn, item) {
  await staging.upsertConnection(conn, {
    tenant_user_id: TENANT_USER_ID,
    pluggy_item_id: String(item?.id || '').trim(),
    provider_name: String(item?.connector?.name || item?.institution?.name || '').slice(0, 256),
    status: String(item?.status || '').slice(0, 64),
    raw_json: JSON.stringify(item || {})
  }, { autoCommit: false });
}

async function loadPersistedItemIds(conn) {
  const rs = await conn.execute(
    `SELECT pluggy_item_id FROM conexoes_bancarias WHERE tenant_user_id = :tenant_user_id`,
    { tenant_user_id: TENANT_USER_ID }
  );
  return (rs.rows || [])
    .map(row => String(row.PLUGGY_ITEM_ID || '').trim())
    .filter(Boolean);
}

async function discoverAndPersistItemIds(conn) {
  const items = await pluggy.listItems();
  const ids = [];
  for (const item of items) {
    const id = String(item?.id || '').trim();
    if (!id) continue;
    await upsertConnection(conn, item);
    ids.push(id);
  }
  return ids;
}

async function syncOnce() {
  if (running) return;
  running = true;
  const start = Date.now();
  try {
    let accountsCount = 0;
    let txCount = 0;
    let identitySkipped = 0;
    let balanceCount = 0;
    let selectedItemIds = [];
    let discoverySource = 'env';

    await withConnection(async conn => {
      await ensureConnectionsTable(conn);
      if (FILTER_ITEM_IDS.length) {
        selectedItemIds = [...FILTER_ITEM_IDS];
      } else {
        try {
          selectedItemIds = await discoverAndPersistItemIds(conn);
          discoverySource = 'pluggy';
        } catch (error) {
          selectedItemIds = await loadPersistedItemIds(conn);
          discoverySource = 'persisted';
          console.warn(`[sync-pluggy] auto-discovery falhou (${error?.message || error}), usando conexoes persistidas.`);
        }
      }

      if (!selectedItemIds.length) {
        console.warn('[sync-pluggy] nenhum itemId disponivel para sincronizacao.');
        await conn.commit();
        return;
      }

      for (const itemId of selectedItemIds) {
        const accounts = await pluggy.listAccounts(itemId);
        accountsCount += accounts.length;

        for (const account of accounts) {
          const accountId = String(account?.id || '');
          if (!accountId) continue;

          const transactions = await pluggy.listTransactions(accountId, dateFromIso());
          for (const tx of transactions) {
            const identity = await resolveStagingKey(conn, tx, accountId, TENANT_USER_ID);
            if (!identity.key) {
              identitySkipped++;
              console.warn(`[sync-pluggy] transacao nao aplicada: identidade ${identity.status}`);
              continue;
            }
            const row = {
              tenant_user_id: TENANT_USER_ID,
              pluggy_item_id: itemId,
              pluggy_account_id: accountId,
              external_transaction_id: identity.key,
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
    console.log(`[sync-pluggy] OK ${nowIso()} source=${discoverySource} items=${selectedItemIds.length} accounts=${accountsCount} tx=${txCount} identitySkipped=${identitySkipped} balance=${balanceCount} elapsedMs=${elapsed}`);
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

if (require.main === module) start().catch(error => {
  console.error('[sync-pluggy] falha fatal ao iniciar:', error?.message || error);
  process.exit(1);
});

module.exports = { txExternalId, syncOnce };
