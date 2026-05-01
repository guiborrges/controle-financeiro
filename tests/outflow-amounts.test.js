const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadOutflowAmounts() {
  const filePath = path.resolve(__dirname, '../public/app/modules/shared/outflow-amounts.js');
  const code = fs.readFileSync(filePath, 'utf8');
  const context = { window: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: filePath });
  return context.window.OutflowAmounts;
}

test('getEffectiveOutflowAmount uses only owner share for shared expense', () => {
  const mod = loadOutflowAmounts();
  const outflow = {
    amount: 200,
    sharedExpense: true,
    sharedParticipants: [
      { isOwner: true, amount: 80 },
      { isOwner: false, amount: 120 }
    ]
  };
  assert.equal(mod.getEffectiveOutflowAmount(outflow), 80);
});

test('getEffectiveOutflowAmount keeps normal amount for non-shared outflow', () => {
  const mod = loadOutflowAmounts();
  assert.equal(mod.getEffectiveOutflowAmount({ amount: 157.39 }), 157.39);
});

