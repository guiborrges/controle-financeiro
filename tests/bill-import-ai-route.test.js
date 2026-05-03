const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { registerBillImportAiRoutes } = require('../server/http/routes/bill-import-ai');

function createMockApp() {
  const routes = new Map();
  return {
    routes,
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers[handlers.length - 1]);
    },
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers[handlers.length - 1]);
    }
  };
}

function createMockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    }
  };
}

function createDeps(extra = {}) {
  return {
    noStore: (_req, _res, next) => next?.(),
    requireAuth: (_req, _res, next) => next?.(),
    requireCsrf: (_req, _res, next) => next?.(),
    getAuthenticatedUser: () => ({ id: 'u1' }),
    readUserAppState: () => ({ state: { data: [] }, updatedAt: new Date().toISOString() }),
    writeUserAppState: (_id, state) => ({ state, updatedAt: new Date().toISOString() }),
    USERS_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'bill-import-test-')),
    ...extra
  };
}

test('bill import ai route rejects when provider is not oracle', async () => {
  process.env.BILL_IMPORT_AI_PROVIDER = 'manual';
  process.env.ORACLE_AI_ENDPOINT = '';
  const app = createMockApp();
  registerBillImportAiRoutes(app, createDeps());
  const handler = app.routes.get('POST /api/bill-import/parse');
  const req = { body: { contentBase64: 'YWJj' } };
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(String(res.payload?.message || ''), /provider/i);
});

test('bill import ai route returns parsed payload from oracle endpoint', async () => {
  process.env.BILL_IMPORT_AI_PROVIDER = 'oracle';
  process.env.ORACLE_AI_ENDPOINT = 'https://oracle.local/mock';
  process.env.ORACLE_AI_API_KEY = 'token';
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ format: 'finance_import_v1', items: [] })
  });
  try {
    const app = createMockApp();
    registerBillImportAiRoutes(app, createDeps());
    const handler = app.routes.get('POST /api/bill-import/parse');
    const req = { body: { contentBase64: 'YWJj', fileName: 'fatura.pdf', mimeType: 'application/pdf', context: {} } };
    const res = createMockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload?.ok, true);
    assert.equal(res.payload?.provider, 'oracle');
    assert.equal(res.payload?.payload?.format, 'finance_import_v1');
  } finally {
    global.fetch = originalFetch;
  }
});

test('bill import ai route parses CSV locally when oracle endpoint is empty', async () => {
  process.env.BILL_IMPORT_AI_PROVIDER = 'oracle';
  process.env.ORACLE_AI_ENDPOINT = '';
  const app = createMockApp();
  registerBillImportAiRoutes(app, createDeps());
  const handler = app.routes.get('POST /api/bill-import/parse');
  const csv = 'Data;Estabelecimento;Portador;Valor;Parcela\n01/04/2026;SUPERMERCADO;GUILHERME;R$ 100,50;-\n';
  const req = {
    body: {
      contentBase64: Buffer.from(csv, 'utf8').toString('base64'),
      fileName: 'fatura.csv',
      mimeType: 'text/csv',
      context: {}
    }
  };
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.provider, 'oracle-local-csv');
  assert.equal(res.payload?.payload?.version, '1');
  assert.equal(res.payload?.payload?.items?.length, 1);
  assert.equal(res.payload?.payload?.items?.[0]?.description, 'SUPERMERCADO');
});

test('bill import ai route parses PDF locally via OCI CLI when oracle endpoint is empty', async () => {
  process.env.BILL_IMPORT_AI_PROVIDER = 'oracle';
  process.env.ORACLE_AI_ENDPOINT = '';
  const childProcess = require('child_process');
  const originalExec = childProcess.execFileSync;
  childProcess.execFileSync = () => JSON.stringify({
    data: {
      pages: [{ lines: [{ text: '01/04/2026 SUPERMERCADO R$ 100,50' }] }]
    }
  });
  try {
    const app = createMockApp();
    registerBillImportAiRoutes(app, createDeps());
    const handler = app.routes.get('POST /api/bill-import/parse');
    const req = {
      body: {
        contentBase64: Buffer.from('%PDF-1.7 mock', 'utf8').toString('base64'),
        fileName: 'fatura.pdf',
        mimeType: 'application/pdf',
        context: {}
      }
    };
    const res = createMockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload?.provider, 'oracle-local-oci-pdf');
    assert.equal(res.payload?.payload?.version, '1');
    assert.equal(res.payload?.payload?.items?.length, 1);
    assert.equal(res.payload?.payload?.items?.[0]?.description, 'SUPERMERCADO');
  } finally {
    childProcess.execFileSync = originalExec;
  }
});

test('invoice job upload + status + result works for CSV', async () => {
  process.env.BILL_IMPORT_AI_PROVIDER = 'oracle';
  process.env.ORACLE_AI_ENDPOINT = '';
  const app = createMockApp();
  registerBillImportAiRoutes(app, createDeps());
  const upload = app.routes.get('POST /api/invoice/upload');
  const status = app.routes.get('GET /api/invoice/status');
  const result = app.routes.get('GET /api/invoice/result/:jobId');

  const csv = 'Data;Estabelecimento;Portador;Valor;Parcela\n01/04/2026;SUPERMERCADO;GUILHERME;R$ 100,50;-\n';
  const uploadReq = {
    body: {
      fileName: 'fatura.csv',
      mimeType: 'text/csv',
      contentBase64: Buffer.from(csv, 'utf8').toString('base64'),
      context: {}
    }
  };
  const uploadRes = createMockRes();
  await upload(uploadReq, uploadRes);
  assert.equal(uploadRes.statusCode, 200);
  assert.equal(uploadRes.payload?.ok, true);
  const jobId = uploadRes.payload?.jobId;
  assert.ok(jobId);

  await new Promise(resolve => setTimeout(resolve, 25));

  const statusRes = createMockRes();
  await status({}, statusRes);
  assert.equal(statusRes.statusCode, 200);
  assert.equal(Array.isArray(statusRes.payload?.jobs), true);
  assert.equal(statusRes.payload.jobs.length > 0, true);

  const resultRes = createMockRes();
  await result({ params: { jobId } }, resultRes);
  assert.equal(resultRes.statusCode, 200);
  assert.equal(resultRes.payload?.ok, true);
  assert.equal(resultRes.payload?.result?.format, 'finance_import_v1');
});

test('invoice import endpoint marks job as imported', async () => {
  process.env.BILL_IMPORT_AI_PROVIDER = 'oracle';
  process.env.ORACLE_AI_ENDPOINT = '';
  const currentState = {
    data: [{ id: 'abril_2026', outflows: [], outflowCards: [{ id: 'card_xp', name: 'XP' }] }]
  };
  const app = createMockApp();
  registerBillImportAiRoutes(app, createDeps({
    readUserAppState: () => ({ state: currentState, updatedAt: new Date().toISOString() }),
    writeUserAppState: (_id, state) => {
      currentState.data = state.data;
      return { updatedAt: new Date().toISOString() };
    }
  }));
  const upload = app.routes.get('POST /api/invoice/upload');
  const importRoute = app.routes.get('POST /api/invoice/import');
  const status = app.routes.get('GET /api/invoice/status');

  const csv = 'Data;Estabelecimento;Portador;Valor;Parcela\n01/04/2026;SUPERMERCADO;GUILHERME;R$ 100,50;-\n';
  const uploadRes = createMockRes();
  await upload({ body: { fileName: 'fatura.csv', mimeType: 'text/csv', contentBase64: Buffer.from(csv, 'utf8').toString('base64'), context: {} } }, uploadRes);
  const jobId = uploadRes.payload?.jobId;
  await new Promise(resolve => setTimeout(resolve, 25));

  const importRes = createMockRes();
  await importRoute({ body: { jobId } , session: {}}, importRes);
  assert.equal(importRes.statusCode, 200);
  assert.equal(importRes.payload?.ok, true);

  const statusRes = createMockRes();
  await status({}, statusRes);
  const importedJob = statusRes.payload?.jobs?.find(job => job.id === jobId);
  assert.equal(importedJob?.status, 'imported');
});

