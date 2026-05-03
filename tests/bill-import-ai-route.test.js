const test = require('node:test');
const assert = require('node:assert/strict');

const { registerBillImportAiRoutes } = require('../server/http/routes/bill-import-ai');

function createMockApp() {
  const routes = new Map();
  return {
    routes,
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers[handlers.length - 1]);
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

function createDeps() {
  return {
    noStore: (_req, _res, next) => next?.(),
    requireAuth: (_req, _res, next) => next?.(),
    requireCsrf: (_req, _res, next) => next?.()
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

