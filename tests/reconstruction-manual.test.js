const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { parseManual, extractSnapshot, BEGIN, END } = require('../scripts/reconstruct-from-manual');

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function file(name, text) {
  const bytes = Buffer.from(text);
  return { path: name, bytes: bytes.length, sha256: hash(bytes), base64: bytes.toString('base64') };
}
function manual(files) {
  const packed = zlib.gzipSync(Buffer.from(JSON.stringify({ files })));
  return `${BEGIN}\n\`\`\`json\n${JSON.stringify({ format: 'meufin-reconstruction-v1', sha256: hash(packed), gzipBase64: packed.toString('base64') })}\n\`\`\`\n${END}`;
}
test('manual reconstructs text and binary resources without a repository', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meufin-manual-'));
  try {
    const bundle = parseManual(manual([file('server/example.js', 'module.exports = 42;'), file('public/icon.bin', '\u0000\u0001')]));
    assert.equal(extractSnapshot(bundle, root), 2);
    assert.equal(require(path.join(root, 'server/example.js')), 42);
    assert.deepEqual(fs.readFileSync(path.join(root, 'public/icon.bin')), Buffer.from([0, 1]));
    assert.throws(() => extractSnapshot(bundle, root), /vazio/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('manual validates outer integrity and each file before extraction', () => {
  const good = manual([file('ok.js', '42')]);
  assert.throws(() => parseManual(good.replace(/"sha256":"[^"]+"/, '"sha256":"broken"')), /corrompido/);
  assert.throws(() => parseManual(manual([{ ...file('ok.js', '42'), bytes: 100 }])), /corrompido/);
});
test('manual rejects duplicate and escaping paths', () => {
  for (const name of ['../escape', '/absolute', 'C:/drive', 'a\\b', 'a/../b', 'a//b']) {
    assert.throws(() => parseManual(manual([file(name, '42')])), /Caminho/);
  }
  assert.throws(() => parseManual(manual([file('a', '1'), file('a', '2')])), /repetido/);
});
test('manual rejects a missing or unknown format', () => {
  assert.throws(() => parseManual('nothing'), /ausente/);
  assert.throws(() => parseManual(manual([file('a', '1')]).replace('meufin-reconstruction-v1', 'unknown')), /desconhecido/);
});

test('manual worked example matches commitments, consumption and cash in the real engine', () => {
  const financial = require('../public/app/modules/shared/financial-query');
  const month = {
    id: 'outubro_2026',
    renda: [{ fonte: 'Salario ficticio', valor: 5000, paid: true }],
    projetos: [{ nome: 'Extra ficticio', valor: 500, paid: false }],
    financialGoals: [{ nome: 'Reserva ficticia', valor: 400 }],
    outflowCards: [{ id: 'c', name: 'Cartao ficticio' }],
    cardBills: [{ id: 'bill', cardId: 'c', amount: 800, manualAmountSet: true }],
    outflows: [
      { id: 'rent', type: 'expense', description: 'Aluguel', category: 'MORADIA', outputKind: 'method', outputMethod: 'boleto', amount: 1000 },
      { id: 'food', type: 'spend', category: 'ALIMENTACAO', outputKind: 'method', outputMethod: 'pix', amount: 200, paid: true },
      { id: 'sub', type: 'spend', category: 'ASSINATURAS', outputKind: 'card', outputRef: 'c', amount: 50 },
      { id: 'purchase', type: 'spend', category: 'COMPRAS', outputKind: 'card', outputRef: 'c', amount: 300 }
    ]
  };
  for (const [basis, expected] of [['commitments', [550000, 200000, 40000, 310000]],
    ['consumption', [550000, 155000, 40000, 355000]], ['cash', [500000, 20000, 0, 480000]]]) {
    const query = financial.query(month, { basis });
    assert.deepEqual([query.incomeCents, query.expenseCents, query.reserveCents, query.resultCents], expected);
  }
  const totals = financial.totals(month);
  assert.equal(totals.totalFixas, 1800);
  assert.equal(totals.totalVar, 200);
  assert.equal(totals.availableForVariableSpending, 3300);
});

test('manual distinguishes explicit zero bill and zero owner share from a missing value', () => {
  const amounts = require('../public/app/modules/shared/outflow-amounts');
  assert.equal(amounts.getEffectiveCardBillAmount({ amount: 0, manualAmountSet: true, forecastAmount: 90 }), 0);
  assert.equal(amounts.getEffectiveCardBillAmount({ amount: 0, source: 'forecast', forecastAmount: 90 }), 90);
  assert.equal(amounts.getEffectiveOutflowAmount({ sharedExpense: true, amount: 120,
    sharedParticipants: [{ isOwner: true, amount: 0 }] }), 0);
});
