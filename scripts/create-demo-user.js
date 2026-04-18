const fs = require('fs');
const path = require('path');

const { hashPassword } = require('../server/password');
const { deriveDataKey } = require('../server/data-crypto');
const {
  readUsersStore,
  writeUsersStore,
  createUser
} = require('../server/user-store');
const {
  writeUserAppState,
  deleteUserAppState,
  buildFreshUserAppState
} = require('../server/app-state-store');
const { resolveStoragePath } = require('../server/paths');

const DEMO_ID = 'teste';
const DEMO_PASSWORD = 'teste';
const DEMO_FULL_NAME = 'teste';
const DEMO_EMAIL = 'teste';
const DEMO_PHONE = '(11) 11111-1111';
const DEMO_BIRTH_DATE = '11/11/2011';

const MONTH_NAMES = [
  'JANEIRO',
  'FEVEREIRO',
  'MARCO',
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

function normalizeMonthId(monthName, year) {
  return `${monthName.toLowerCase()}_${year}`;
}

function toMonthLabel(monthName, year) {
  const pretty = monthName === 'MARCO' ? 'MARCO' : monthName;
  return `${pretty} ${year}`;
}

function roundMoney(value) {
  return Number(Number(value).toFixed(2));
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function makeDate(day, monthIndex, year) {
  return `${pad2(day)}/${pad2(monthIndex + 1)}/${String(year).slice(-2)}`;
}

function aggregateCategories(month) {
  const totals = {};
  (month.despesas || []).forEach(item => {
    const key = item.categoria || 'OUTROS';
    totals[key] = roundMoney((totals[key] || 0) + Number(item.valor || 0));
  });
  (month.gastosVar || []).forEach(item => {
    const key = item.categoria || 'OUTROS';
    totals[key] = roundMoney((totals[key] || 0) + Number(item.valor || 0));
  });
  return totals;
}

function buildMonth(year, monthIndex, order) {
  const monthName = MONTH_NAMES[monthIndex];
  const nome = toMonthLabel(monthName, year);
  const id = normalizeMonthId(monthName, year);
  const baseExpense = 111.11 + (order * 7.5);
  const baseIncome = 777.77 + (order * 15.25);
  const categories = ['MERCADO', 'TRANSPORTE', 'LAZER', 'ASSINATURAS', 'SAUDE', 'COMIDA'];

  const despesas = [
    { nome: 'ALUGUEL', valor: roundMoney(baseExpense + 600), categoria: 'DESPESA FIXA', pago: order % 2 === 0, data: makeDate(5, monthIndex, year) },
    { nome: 'ENERGIA', valor: roundMoney(baseExpense + 120), categoria: 'DESPESA FIXA', pago: true, data: makeDate(7, monthIndex, year) },
    { nome: 'AGUA', valor: roundMoney(baseExpense + 80), categoria: 'DESPESA FIXA', pago: true, data: makeDate(8, monthIndex, year) },
    { nome: 'INTERNET', valor: roundMoney(baseExpense + 90), categoria: 'DESPESA FIXA', pago: order % 3 !== 0, data: makeDate(10, monthIndex, year) },
    { nome: 'SEGURO', valor: roundMoney(baseExpense + 130), categoria: 'DESPESA FIXA', pago: order % 4 !== 0, data: makeDate(11, monthIndex, year) },
    { nome: 'CARTAO A', valor: roundMoney(baseExpense + 210), categoria: 'DESPESA VARIAVEL', pago: order % 2 !== 0, data: makeDate(12, monthIndex, year) },
    { nome: 'CARTAO B', valor: roundMoney(baseExpense + 260), categoria: 'DESPESA VARIAVEL', pago: false, data: makeDate(13, monthIndex, year) },
    { nome: 'ASSINATURA', valor: roundMoney(baseExpense + 50), categoria: 'DESPESA VARIAVEL', pago: true, data: makeDate(15, monthIndex, year) },
    { nome: 'MERCADO', valor: roundMoney(baseExpense + 175), categoria: 'DESPESA VARIAVEL', pago: order % 5 !== 0, data: makeDate(18, monthIndex, year) },
    { nome: 'LAZER', valor: roundMoney(baseExpense + 95), categoria: 'DESPESA VARIAVEL', pago: order % 3 === 0, data: makeDate(20, monthIndex, year) }
  ];

  const renda = [
    { fonte: 'SALARIO', valor: roundMoney(baseIncome + 2500) },
    { fonte: 'BONUS', valor: roundMoney(baseIncome + 444.44) },
    { fonte: 'PIX', valor: roundMoney(baseIncome + 222.22) },
    { fonte: 'REEMBOLSO', valor: roundMoney(baseIncome + 111.11) }
  ];

  const projetos = [
    { nome: 'RENDA EXTRA A', valor: roundMoney(333.33 + (order * 8)) },
    { nome: 'RENDA EXTRA B', valor: roundMoney(444.44 + (order * 6)) },
    { nome: 'RENDA EXTRA C', valor: roundMoney(555.55 + (order * 4)) },
    { nome: 'RENDA EXTRA D', valor: roundMoney(222.22 + (order * 5)) }
  ];

  const gastosVar = [];
  categories.forEach((category, categoryIndex) => {
    gastosVar.push({
      titulo: `${category} 01`,
      valor: roundMoney(20 + (categoryIndex * 11.11) + order),
      data: makeDate(2 + categoryIndex, monthIndex, year),
      categoria: category,
      incluirNoTotal: true
    });
    gastosVar.push({
      titulo: `${category} 02`,
      valor: roundMoney(30 + (categoryIndex * 9.99) + (order * 0.5)),
      data: makeDate(16 + categoryIndex, monthIndex, year),
      categoria: category,
      incluirNoTotal: true
    });
  });

  const totalFixas = despesas.reduce((sum, item) => sum + item.valor, 0);
  const totalRendaBase = renda.reduce((sum, item) => sum + item.valor, 0);
  const totalProjetos = projetos.reduce((sum, item) => sum + item.valor, 0);

  const month = {
    id,
    nome,
    despesas,
    renda,
    projetos,
    gastosVar,
    dailyCategorySeeds: categories.slice(),
    dailyGoals: {
      MERCADO: roundMoney(350 + (order * 4)),
      TRANSPORTE: roundMoney(180 + (order * 3)),
      LAZER: roundMoney(160 + (order * 2)),
      ASSINATURAS: roundMoney(120 + order),
      SAUDE: roundMoney(140 + (order * 1.5)),
      COMIDA: roundMoney(260 + (order * 2.5))
    },
    obs: [
      `MES DEMO ${nome}.`,
      'DADOS TOTALMENTE FICTICIOS PARA APRESENTACAO.',
      'VALORES REPETIDOS DE PROPOSITO PARA FICAR VISIVEL QUE E TESTE.',
      'PODE EDITAR, APAGAR, DUPLICAR E BRINCAR A VONTADE.'
    ].join(' '),
    total_gastos: roundMoney(totalFixas),
    total_renda: roundMoney(totalRendaBase),
    resultado: roundMoney(totalRendaBase + totalProjetos - totalFixas),
    categorias: {}
  };

  month.categorias = aggregateCategories(month);
  month._catOrig = { ...month.categorias };
  return month;
}

function buildDemoMonths() {
  const months = [];
  let order = 0;
  for (let year = 2025; year <= 2026; year += 1) {
    const startMonth = year === 2025 ? 0 : 0;
    const endMonth = year === 2026 ? 7 : 11;
    for (let monthIndex = startMonth; monthIndex <= endMonth; monthIndex += 1) {
      months.push(buildMonth(year, monthIndex, order));
      order += 1;
    }
  }
  return months;
}

function buildDemoState() {
  const state = buildFreshUserAppState();
  state.finData = buildDemoMonths();
  state.finMetas = {
    MERCADO: 950,
    TRANSPORTE: 420,
    LAZER: 360,
    ASSINATURAS: 210,
    SAUDE: 320,
    COMIDA: 690
  };
  state.finTitles = {
    despesas: 'Despesas',
    renda: 'Renda',
    projetos: 'Renda extra',
    gastos: 'Gastos diarios',
    observacoes: 'Observacoes do mes'
  };
  state.finCategoryColors = {
    MERCADO: '#DCEFD9',
    TRANSPORTE: '#D9E8F7',
    LAZER: '#F9E6CC',
    ASSINATURAS: '#E5DCF8',
    SAUDE: '#F7DADA',
    COMIDA: '#F6EDC9'
  };
  state.finDashSeriesColors = {
    resultadoMes: '#1f4c8f',
    gastosTotais: '#d45555',
    rendaTotal: '#2d8a57'
  };
  state.finResultMode = 'simples';
  state.finMesMetricOrder = ['despesas', 'gastos', 'renda', 'projetos', 'observacoes'];
  return state;
}

function sanitizeDemoString(value) {
  return String(value || '')
    .replace(/\s+FALSO\b/gi, '')
    .replace(/\s+FALSA\b/gi, '')
    .replace(/\bFALSO\b/gi, '')
    .replace(/\bFALSA\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function sanitizeDemoState(value) {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeDemoState(item));
  }
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? sanitizeDemoString(value) : value;
  }

  const next = {};
  Object.entries(value).forEach(([key, entryValue]) => {
    if (
      typeof entryValue === 'string' &&
      ['nome', 'fonte', 'titulo', 'obs', 'displayName', 'fullName', 'passwordHint'].includes(key)
    ) {
      next[key] = sanitizeDemoString(entryValue);
      return;
    }
    next[key] = sanitizeDemoState(entryValue);
  });
  return next;
}

function removeExistingDemoArtifacts() {
  deleteUserAppState(DEMO_ID);

  const backupRoot = resolveStoragePath('data', 'user-backups');
  if (fs.existsSync(backupRoot)) {
    fs.readdirSync(backupRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.endsWith(`__${DEMO_ID}`))
      .forEach(entry => {
        try {
          fs.rmSync(path.join(backupRoot, entry.name), { recursive: true, force: true });
        } catch {}
      });
  }
}

function ensureDemoUser() {
  const store = readUsersStore();
  let user = store.users.find(item => item.id === DEMO_ID) || null;

  if (!user) {
    user = createUser({
      id: DEMO_ID,
      username: DEMO_ID,
      displayName: DEMO_FULL_NAME,
      fullName: DEMO_FULL_NAME,
      birthDate: DEMO_BIRTH_DATE,
      phone: DEMO_PHONE,
      email: DEMO_EMAIL,
      passwordHint: 'Conta de demonstração',
      passwordHash: hashPassword(DEMO_PASSWORD),
      permissions: { canAccessESO: false },
      loginCount: 14,
      lastLoginAt: '2026-04-03T20:45:00.000Z',
      lastUsedAt: '2026-04-03T20:47:00.000Z',
      backupStats: {
        lastBackupAt: '',
        lastBackupType: '',
        loginsSinceBackup: 0
      }
    });
  }

  const nextStore = readUsersStore();
  const index = nextStore.users.findIndex(item => item.id === DEMO_ID);
  if (index < 0) {
    throw new Error('Nao foi possivel localizar o usuario demo apos a criacao.');
  }

  const current = nextStore.users[index];
  nextStore.users[index] = {
    ...current,
    username: DEMO_ID,
    displayName: DEMO_FULL_NAME,
    fullName: DEMO_FULL_NAME,
    birthDate: DEMO_BIRTH_DATE,
    phone: DEMO_PHONE,
    email: DEMO_EMAIL,
    passwordHint: 'Conta de demonstração',
    passwordHash: hashPassword(DEMO_PASSWORD),
    loginCount: 14,
    lastLoginAt: '2026-04-03T20:45:00.000Z',
    lastUsedAt: '2026-04-03T20:47:00.000Z',
    lastRestoreAt: '',
    backupStats: {
      lastBackupAt: '',
      lastBackupType: '',
      loginsSinceBackup: 0
    },
    permissions: {
      canAccessESO: false
    },
    createdAt: '2026-01-15T12:00:00.000Z',
    updatedAt: new Date().toISOString()
  };
  writeUsersStore(nextStore);
  return nextStore.users[index];
}

function main() {
  removeExistingDemoArtifacts();
  const user = ensureDemoUser();
  const state = sanitizeDemoState(buildDemoState());
  const encryptionKey = deriveDataKey(DEMO_PASSWORD, user.encryptionSalt).toString('base64');
  writeUserAppState(user.id, state, encryptionKey);

  process.stdout.write([
    'Usuario demo criado com sucesso.',
    `id: ${user.id}`,
    `login: ${user.email}`,
    `senha: ${DEMO_PASSWORD}`,
    `meses: ${state.finData.length}`
  ].join('\n'));
}

main();
