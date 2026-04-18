const test = require('node:test');
const assert = require('node:assert/strict');

const BillImportSchema = require('../public/app/modules/import-bills-schema.js');

function normalizeComparableText(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildContext() {
  const card = {
    id: 'card_xp',
    name: 'XP'
  };
  return {
    data: [
      {
        id: 'abril_2026',
        outflows: [
          {
            outputKind: 'card',
            outputRef: 'card_xp',
            date: '10/04/26',
            amount: 25.9,
            description: 'Padaria'
          }
        ]
      }
    ],
    cardIndex: {
      byId: new Map([[card.id, card]]),
      byName: new Map([[normalizeComparableText(card.name), card]])
    },
    categoryIndex: {
      byNormalized: new Map([
        [normalizeComparableText('ALIMENTAÇÃO'), 'ALIMENTAÇÃO'],
        [normalizeComparableText('TRANSPORTE'), 'TRANSPORTE']
      ])
    }
  };
}

test('accepts finance_import_v1 payload with valid item', () => {
  const payload = {
    format: 'finance_import_v1',
    version: 1,
    items: [
      {
        date: '11/04/26',
        description: 'Mercado',
        amount: 120.35,
        card_id: 'card_xp',
        month_id: 'abril_2026',
        category: 'ALIMENTAÇÃO',
        confidence: 0.88,
        needs_review: false,
        tag: null
      }
    ]
  };
  const result = BillImportSchema.validatePayload(payload, buildContext());
  assert.equal(result.formatErrors.length, 0);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].status, 'valid');
});

test('marks category outside context as error', () => {
  const payload = {
    format: 'finance_import_v1',
    version: 1,
    items: [
      {
        date: '11/04/26',
        description: 'Taxi',
        amount: 40,
        card_name: 'XP',
        month_id: 'abril_2026',
        category: 'CATEGORIA NOVA',
        confidence: 0.9,
        tag: null
      }
    ]
  };
  const result = BillImportSchema.validatePayload(payload, buildContext());
  assert.equal(result.items[0].status, 'error');
  assert.ok(result.items[0].errors.some(error => error.includes('Categoria fora da lista')));
});

test('flags likely duplicate launch as warning', () => {
  const payload = {
    format: 'finance_import_v1',
    version: 1,
    items: [
      {
        date: '10/04/26',
        description: 'Padaria',
        amount: 25.9,
        card_id: 'card_xp',
        month_id: 'abril_2026',
        category: 'ALIMENTAÇÃO',
        confidence: 0.84,
        tag: null
      }
    ]
  };
  const result = BillImportSchema.validatePayload(payload, buildContext());
  assert.equal(result.items[0].status, 'warning');
  assert.ok(result.items[0].warnings.some(warning => warning.includes('duplicado')));
});

test('ignores reimbursement and imports only expenses', () => {
  const payload = {
    format: 'finance_import_v1',
    version: 1,
    items: [
      {
        date: '11/04/26',
        description: 'Estorno compra mercado',
        amount: 120.35,
        card_id: 'card_xp',
        month_id: 'abril_2026',
        category: 'ALIMENTAÇÃO',
        confidence: 0.91,
        tag: null
      },
      {
        date: '12/04/26',
        description: 'Mercado',
        amount: 80,
        card_id: 'card_xp',
        month_id: 'abril_2026',
        category: 'ALIMENTAÇÃO',
        confidence: 0.88,
        tag: null
      }
    ]
  };
  const result = BillImportSchema.validatePayload(payload, buildContext());
  assert.equal(result.items.length, 1);
  assert.equal(result.ignoredCount, 1);
  assert.equal(result.items[0].description, 'Mercado');
});

test('infers month id from date when month_id is missing', () => {
  const payload = {
    format: 'finance_import_v1',
    version: 1,
    items: [
      {
        date: '01/04/26',
        description: 'Supermercado',
        amount: 50,
        card_id: 'card_xp',
        category: 'ALIMENTAÇÃO',
        confidence: 0.92,
        tag: null
      }
    ]
  };
  const result = BillImportSchema.validatePayload(payload, buildContext());
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].monthId, 'abril_2026');
  assert.equal(result.items[0].status, 'valid');
});

test('infers card from payload header when transaction row has no card field', () => {
  const payload = {
    format: 'finance_import_v1',
    version: 1,
    cards_identified: ['XP'],
    items: [
      {
        date: '02/04/26',
        description: 'Farmácia',
        amount: 35,
        month_id: 'abril_2026',
        category: 'ALIMENTAÇÃO',
        confidence: 0.83,
        tag: null
      }
    ]
  };
  const result = BillImportSchema.validatePayload(payload, buildContext());
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].cardId, 'card_xp');
  assert.equal(result.items[0].status, 'valid');
});

test('assumes current year when date has no year and marks warning', () => {
  global.currentMonthId = 'abril_2026';
  const payload = {
    format: 'finance_import_v1',
    version: 1,
    items: [
      {
        date: '03/04',
        description: 'Mercado sem ano',
        amount: 44.9,
        card_name: 'XP',
        category: 'ALIMENTAÃ‡ÃƒO',
        confidence: 0.8,
        tag: null
      }
    ]
  };
  const result = BillImportSchema.validatePayload(payload, buildContext());
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].date, '03/04/26');
  assert.equal(result.items[0].monthId, 'abril_2026');
  assert.ok(result.items[0].warnings.some(warning => warning.toLowerCase().includes('ano')));
  delete global.currentMonthId;
});

test('infers card by institution text when card_name is missing', () => {
  const payload = {
    format: 'finance_import_v1',
    version: 1,
    institution: 'XP',
    items: [
      {
        date: '05/04/26',
        description: 'Corrida',
        amount: 19.9,
        month_id: 'abril_2026',
        category: 'TRANSPORTE',
        confidence: 0.89,
        tag: null
      }
    ]
  };
  const result = BillImportSchema.validatePayload(payload, buildContext());
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].cardId, 'card_xp');
  assert.equal(result.items[0].status, 'valid');
});

test('accepts year-first date format (AA/MM/DD) and normalizes to DD/MM/AA', () => {
  const payload = {
    format: 'finance_import_v1',
    version: 1,
    items: [
      {
        date: '26/04/01',
        description: 'Super ZE',
        amount: 35.96,
        card_name: 'XP',
        category: 'ALIMENTAÇÃO',
        confidence: 0.9,
        tag: null
      }
    ]
  };
  const result = BillImportSchema.validatePayload(payload, buildContext());
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].date, '01/04/26');
  assert.equal(result.items[0].monthId, 'abril_2026');
  assert.equal(result.items[0].status, 'valid');
});
