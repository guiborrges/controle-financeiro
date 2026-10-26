'use strict';

const oracledb = require('oracledb');
const { positiveLimit } = require('../../server/integrations/deadline');

function createOracleAccess(driver, env = process.env) {
  let poolPromise = null;
  function getDbConfig() {
    const base = {
      user: String(env.ORACLE_DB_USER || '').trim(),
      password: String(env.ORACLE_DB_PASSWORD || '').trim(),
      connectString: String(env.ORACLE_DB_CONNECT_STRING || '').trim(),
      poolMin: Number(env.ORACLE_DB_POOL_MIN || 1),
      poolMax: Number(env.ORACLE_DB_POOL_MAX || 4),
      poolIncrement: Number(env.ORACLE_DB_POOL_INCREMENT || 1),
      queueTimeout: positiveLimit(env.ORACLE_DB_QUEUE_TIMEOUT_MS, 30000),
      queueMax: positiveLimit(env.ORACLE_DB_QUEUE_MAX, 100)
    };
    for (const [setting, key] of [['configDir', 'ORACLE_DB_CONFIG_DIR'], ['walletLocation', 'ORACLE_DB_WALLET_LOCATION'], ['walletPassword', 'ORACLE_DB_WALLET_PASSWORD']]) {
      const value = String(env[key] || '').trim();
      if (value) base[setting] = value;
    }
    return base;
  }

  function ensurePool() {
    if (poolPromise) return poolPromise;
    const config = getDbConfig();
    if (!config.user || !config.password || !config.connectString) {
      throw new Error('Oracle DB nao configurado. Defina ORACLE_DB_USER, ORACLE_DB_PASSWORD e ORACLE_DB_CONNECT_STRING.');
    }
    driver.outFormat = driver.OUT_FORMAT_OBJECT;
    const attempt = Promise.resolve().then(() => driver.createPool(config));
    poolPromise = attempt;
    attempt.catch(() => { if (poolPromise === attempt) poolPromise = null; });
    return attempt;
  }

  async function withConnection(fn) {
    const pool = await ensurePool();
    const conn = await pool.getConnection();
    let failed = false;
    try {
      conn.callTimeout = positiveLimit(env.ORACLE_DB_CALL_TIMEOUT_MS, 45000);
      return await fn(conn);
    } catch (error) {
      failed = true;
      try { await conn.rollback?.(); } catch {}
      throw error;
    } finally {
      try { await conn.close(); } catch (error) { if (!failed) throw error; }
    }
  }

  async function closePool() {
    if (!poolPromise) return;
    const attempt = poolPromise;
    try { const pool = await attempt; await pool.close(0); }
    finally { if (poolPromise === attempt) poolPromise = null; }
  }
  return { withConnection, closePool };
}

module.exports = { ...createOracleAccess(oracledb), createOracleAccess };
