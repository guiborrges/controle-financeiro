'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appRoot = path.resolve(__dirname, '../../public/app');
const monthNames = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const labels = monthNames.map(name => name.toUpperCase());
labels[2] = 'MAR\u00c7O';

function monthAt(year, index) {
  return { id: `${monthNames[index]}_${year}`, nome: `${labels[index]} ${year}`,
    despesas: [], gastosVar: [], outflows: [], outflowCards: [], cardBills: [],
    renda: [], projetos: [], financialGoals: [], categorias: {}, dailyGoals: {} };
}

function financialMonth(year = 2026, index = 9) {
  return { ...monthAt(year, index),
    outflowCards: [{ id: 'card-a', name: 'Cartao ficticio', closingDay: 31, paymentDay: 10 }],
    cardBills: [{ id: 'bill-a', cardId: 'card-a', amount: 250, paid: false, source: 'manual' }],
    outflows: [
      { id: 'rent', type: 'expense', category: 'CASA', amount: 1200, paid: true, outputKind: 'method', outputMethod: 'boleto' },
      { id: 'food', type: 'spend', category: 'MERCADO', amount: 45.67, paid: true, outputKind: 'method', outputMethod: 'debito' },
      { id: 'shared', type: 'spend', category: 'LAZER', amount: 100, sharedExpense: true,
        sharedOriginalAmount: 100, sharedOthersAmount: 60, sharedParticipants: [
          { id: 'owner', name: 'Titular ficticio', isOwner: true, amount: 40, paid: false },
          { id: 'guest', name: 'Participante ficticio', amount: 60, paid: true }], paid: false },
      { id: 'purchase', type: 'spend', category: 'MERCADO', amount: 200, outputKind: 'card', outputRef: 'card-a', countsInPrimaryTotals: false },
      { id: 'subscription', type: 'spend', category: 'SERVICOS', amount: 30, outputKind: 'card', outputRef: 'card-a', recurringSpend: true, countsInPrimaryTotals: false },
      { id: 'excluded', type: 'spend', category: 'OUTROS', amount: 999, includeInTotals: false },
      { id: 'transfer', type: 'transfer', category: 'OUTROS', amount: 800 },
      { id: 'refund', type: 'refund', category: 'OUTROS', amount: 50 }
    ],
    renda: [{ id: 'salary', fonte: 'Renda ficticia', valor: 3000, paid: true, recurringFixed: false },
      { id: 'excluded-income', fonte: 'Renda excluida', valor: 999, includeInTotals: false }],
    projetos: [{ id: 'project', descricao: 'Projeto ficticio', valor: 250, paid: false }],
    financialGoals: [{ id: 'reserve', descricao: 'Reserva ficticia', valor: 100 },
      { id: 'excluded-goal', valor: 999, includeInTotals: false }],
    dailyGoals: { MERCADO: 500 } };
}

function browserSandbox(extra = {}) {
  const sandbox = { console, data: [], despSelectionState: {}, currentSession: null,
    categoryRenameMap: {}, categoryEmojiOverrides: {}, expenseCategoryRules: {},
    document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; } },
    addEventListener() {}, ensureProjetos() {},
    resolveCategoryName: value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase(),
    getCategoryEmoji: () => '\u25cf',
    ...extra };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  loadBrowser(sandbox, ['modules/shared/month-selection-catalog.js', 'modules/shared/dates.js', 'modules/shared/outflow-amounts.js',
    'modules/shared/financial-query.js', 'modules/shared/dashboard-rules.js',
    'core.js', 'modules/mes-atual/cards.js', 'modules/mobile-v2/data-bridge.js']);
  return sandbox;
}

function loadBrowser(sandbox, files) {
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(appRoot, file), 'utf8'), sandbox, { filename: file });
}

function smokeState(tenant = 'a') {
  const value = tenant === 'a' ? 100 : 200;
  const months = [monthAt(2025, 8), monthAt(2025, 9), monthAt(2026, 8), monthAt(2026, 9)];
  months.forEach((month, index) => {
    month.outflows = [{ id: `${tenant}-expense-${index}`, description: `Despesa ficticia ${tenant}`,
      type: 'spend', amount: value, category: 'MERCADO', date: `05/${month.id.startsWith('setembro') ? '09' : '10'}/${month.nome.slice(-2)}`,
      outputKind: 'method', outputMethod: 'pix', paid: true, showInMonthPlanning: true }];
    month.renda = [{ fonte: `Renda ficticia ${tenant}`, valor: value * 10, paid: true, recurringFixed: false }];
    month.financialGoals = [{ id: `${tenant}-goal`, descricao: 'Reserva ficticia', valor: value / 10 }];
    month.dailyGoals = { MERCADO: value * 2 };
  });
  return { finStateSchemaVersion: '3', finMigrationVersion: '999', finData: months,
    finMetas: {}, finEsoData: [], finPatrimonioAccounts: [], finPatrimonioMovements: [],
    finUIState: { activePage: 'dashboard', currentMonthId: 'outubro_2026',
      periodFilter: { type: 'year', year: '2026', month: 'outubro_2026' } } };
}

module.exports = { appRoot, monthNames, monthAt, financialMonth, browserSandbox, loadBrowser, smokeState };
