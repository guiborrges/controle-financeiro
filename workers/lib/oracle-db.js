'use strict';

const oracledb = require('oracledb');

let poolPromise = null;

function getDbConfig() {
  const walletLocation = String(process.env.ORACLE_DB_WALLET_LOCATION || '').trim();
  const walletPassword = String(process.env.ORACLE_DB_WALLET_PASSWORD || '').trim();
  const configDir = String(process.env.ORACLE_DB_CONFIG_DIR || '').trim();
  const connectString = String(process.env.ORACLE_DB_CONNECT_STRING || '').trim();
  const base = {
    user: String(process.env.ORACLE_DB_USER || '').trim(),
    password: String(process.env.ORACLE_DB_PASSWORD || '').trim(),
    connectString,
    poolMin: Number(process.env.ORACLE_DB_POOL_MIN || 1),
    poolMax: Number(process.env.ORACLE_DB_POOL_MAX || 4),
    poolIncrement: Number(process.env.ORACLE_DB_POOL_INCREMENT || 1)
  };
  if (configDir) base.configDir = configDir;
  if (walletLocation) base.walletLocation = walletLocation;
  if (walletPassword) base.walletPassword = walletPassword;
  return base;
}

async function ensurePool() {
  if (poolPromise) return poolPromise;
  const config = getDbConfig();
  if (!config.user || !config.password || !config.connectString) {
    throw new Error('Oracle DB nao configurado. Defina ORACLE_DB_USER, ORACLE_DB_PASSWORD e ORACLE_DB_CONNECT_STRING.');
  }
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  poolPromise = oracledb.createPool(config);
  return poolPromise;
}

async function withConnection(fn) {
  const pool = await ensurePool();
  const conn = await pool.getConnection();
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}

async function closePool() {
  if (!poolPromise) return;
  const pool = await poolPromise;
  await pool.close(0);
  poolPromise = null;
}

module.exports = {
  withConnection,
  closePool
};
