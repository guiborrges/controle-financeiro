const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('node:child_process');

const PORT = Number(process.env.E2E_PORT || 3360);
const BASE_URL = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitServer(baseUrl, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/login-config`);
      if (response.ok) return true;
    } catch {}
    await sleep(200);
  }
  return false;
}

function createSeedState() {
  const now = new Date();
  const monthNames = [
    'JANEIRO',
    'FEVEREIRO',
    'MARÇO',
    'ABRIL',
    'MAIO',
    'JUNHO',
    'JULHO',
    'AGOSTO',
    'SETEMBRO',
    'OUTUBRO',
    'NOVEMBRO',
    'DEZEMBRO'
  ];
  const monthName = monthNames[now.getMonth()];
  const year = now.getFullYear();
  const monthSlug = String(monthName)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const monthId = `${monthSlug}_${year}`;

  return {
    finStateSchemaVersion: '3',
    finData: [
      {
        id: monthId,
        nome: `${monthName} ${year}`,
        despesas: [],
        renda: [],
        financialGoals: [],
        projetos: [],
        patrimonioTransfers: [],
        outflows: [],
        outflowCards: [
          {
            id: 'card_xp_e2e',
            name: 'XP',
            institution: 'XP',
            visualId: 'institution:xp',
            closingDay: 2,
            paymentDay: 10,
            description: 'Cartão XP E2E'
          }
        ],
        cardBills: [],
        categorias: {
          ALIMENTAÇÃO: 0,
          TRANSPORTE: 0,
          OUTROS: 0
        },
        gastosVar: [],
        dailyCategorySeeds: ['ALIMENTAÇÃO', 'TRANSPORTE', 'OUTROS'],
        dailyGoals: {},
        dailyGoalTarget: null,
        dailyGoalManualCats: [],
        obs: ''
      }
    ],
    finMetas: {},
    finEsoData: [],
    finTitles: null,
    finUIState: null,
    finCategoryRenameMap: {},
    finExpenseCategoryRules: {},
    finExpenseNameRenameMap: {},
    finExpensePaymentDateRules: {},
    finIncomeNameRenameMap: {},
    finDashSeriesColors: {},
    finCategoryColors: {},
    finCategoryEmojis: {
      ALIMENTAÇÃO: '🍽️',
      TRANSPORTE: '🚗',
      OUTROS: '📦'
    },
    finMonthSectionColors: {},
    finMonthSectionCollapsed: {},
    finMonthCopyPreferences: {},
    finDataMigrationVersion: '',
    finResultMode: ''
  };
}

function seedUser(storageRoot) {
  process.env.FIN_STORAGE_DIR = storageRoot;
  const { createUser, findUserByEmail } = require('../server/user-store');
  const { hashPassword } = require('../server/password');
  const { deriveDataKey } = require('../server/data-crypto');
  const { writeUserAppState } = require('../server/app-state-store');

  const email = 'e2e.import@local.test';
  const password = '1234';
  let user = findUserByEmail(email);
  if (!user) {
    user = createUser({
      email,
      phone: '11999999999',
      fullName: 'E2E Import User',
      displayName: 'E2E Import User',
      birthDate: '01/01/1990',
      passwordHint: 'hint',
      passwordHash: hashPassword(password),
      permissions: { canAccessESO: false }
    });
  }
  const encryptionKey = deriveDataKey(password, user.encryptionSalt).toString('base64');
  writeUserAppState(user.id, createSeedState(), encryptionKey);
  return { email, password };
}

async function launchBrowser() {
  const { chromium } = require('playwright');
  try {
    return await chromium.launch({ headless: true, channel: 'msedge' });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function runE2E(baseUrl, credentials) {
  const browser = await launchBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  const now = new Date();
  const dd = String(1).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const payload = {
    format: 'finance_import_v1',
    version: 1,
    items: [
      {
        date: `${dd}/${mm}/${yy}`,
        description: 'E2E IMPORT FLOW',
        amount: 45.67,
        card_name: 'XP',
        category: 'ALIMENTAÇÃO',
        confidence: 0.95,
        needs_review: false,
        tag: null
      }
    ]
  };

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#emailInput', credentials.email);
    await page.fill('#passwordInput', credentials.password);
    await page.click('button.login-submit');
    await page.waitForURL(/\/app/, { timeout: 20000 });

    await page.click('.nav-item[data-page="mes"]');
    await page.waitForTimeout(700);
    await page.click('button:has-text("Adicionar por fatura")');
    await page.fill('#billImportRawText', JSON.stringify(payload, null, 2));
    await page.click('button:has-text("Validar texto colado")');
    await page.waitForSelector('#modalBillImportReview.open', { timeout: 10000 });

    const importButton = page.locator('#billImportApplyBtn');
    await importButton.waitFor({ timeout: 10000 });
    const disabled = await importButton.isDisabled();
    if (disabled) {
      throw new Error('Botão de importar permaneceu desabilitado no fluxo E2E.');
    }

    await importButton.click();
    await page.waitForSelector('#appStatus.open', { timeout: 10000 });
    const statusMessage = await page.locator('#appStatusMessage').innerText();
    if (!String(statusMessage || '').toLowerCase().includes('gastos adicionados ao sistema')) {
      throw new Error(`Mensagem final inesperada: ${statusMessage}`);
    }

    await page.waitForTimeout(500);
    const reviewOpen = await page.locator('#modalBillImportReview').evaluate(node => node.classList.contains('open'));
    if (reviewOpen) throw new Error('Modal de revisão não fechou após importação.');

    const importedCount = await page.evaluate(() => {
      const month = typeof window.getCurrentMonth === 'function' ? window.getCurrentMonth() : null;
      const outflows = Array.isArray(month?.outflows) ? month.outflows : [];
      return outflows.filter(item => String(item?.description || '').includes('E2E IMPORT FLOW')).length;
    });
    if (importedCount < 1) {
      throw new Error('Lançamento E2E não foi persistido no mês atual.');
    }

    return { ok: true, importedCount };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  const tempStorage = fs.mkdtempSync(path.join(os.tmpdir(), 'fin-e2e-import-'));
  const credentials = seedUser(tempStorage);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      FIN_STORAGE_DIR: tempStorage,
      FIN_DISABLE_RATE_LIMIT: '1',
      NODE_ENV: 'test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderrBuffer = '';
  server.stderr.on('data', chunk => {
    stderrBuffer += String(chunk || '');
  });

  try {
    const ready = await waitServer(BASE_URL, 25000);
    if (!ready) throw new Error(`Servidor não subiu a tempo. stderr=${stderrBuffer.slice(-500)}`);
    const result = await runE2E(BASE_URL, credentials);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    server.kill('SIGTERM');
    await sleep(300);
    try {
      fs.rmSync(tempStorage, { recursive: true, force: true });
    } catch {}
  }
}

main().catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
