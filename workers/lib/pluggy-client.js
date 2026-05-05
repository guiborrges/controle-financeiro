'use strict';

const DEFAULT_BASE_URL = 'https://api.pluggy.ai';

function baseUrl() {
  return String(process.env.PLUGGY_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
}

let cachedApiKey = '';
let cachedApiKeyExpireAt = 0;

async function requestJson(pathname, options = {}) {
  const endpoint = `${baseUrl()}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  const response = await fetch(endpoint, options);
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (_) {
    parsed = null;
  }
  if (!response.ok) {
    const message = parsed?.message || text || `Pluggy HTTP ${response.status}`;
    throw new Error(message);
  }
  return parsed;
}

async function resolveApiKey() {
  const staticApiKey = String(process.env.PLUGGY_API_KEY || process.env.MUPLUG_API_KEY || '').trim();
  if (staticApiKey) return staticApiKey;
  if (cachedApiKey && Date.now() < cachedApiKeyExpireAt) return cachedApiKey;

  const clientId = String(process.env.PLUGGY_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.PLUGGY_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    throw new Error('Credenciais Pluggy ausentes. Configure PLUGGY_API_KEY ou PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET.');
  }
  const auth = await requestJson('/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ clientId, clientSecret })
  });
  const apiKey = String(auth?.apiKey || '').trim();
  if (!apiKey) throw new Error('Pluggy nao retornou apiKey no /auth.');
  cachedApiKey = apiKey;
  cachedApiKeyExpireAt = Date.now() + 9 * 60 * 1000;
  return apiKey;
}

async function get(pathname) {
  const key = await resolveApiKey();
  return requestJson(pathname, {
    method: 'GET',
    headers: { Accept: 'application/json', 'X-API-KEY': key }
  });
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function listItems() {
  const payload = await get('/items');
  return asArray(payload);
}

async function listAccounts(itemId) {
  const payload = await get(`/accounts?itemId=${encodeURIComponent(String(itemId || ''))}`);
  return asArray(payload);
}

async function listTransactions(accountId, dateFromIso) {
  const query = new URLSearchParams();
  query.set('accountId', String(accountId || ''));
  if (dateFromIso) query.set('from', dateFromIso);
  const payload = await get(`/transactions?${query.toString()}`);
  return asArray(payload);
}

module.exports = {
  listItems,
  listAccounts,
  listTransactions
};

