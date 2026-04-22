const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadMesAtualUtilsContext() {
  const filePath = path.resolve(__dirname, '../public/app/modules/mes-atual/utils.js');
  const code = fs.readFileSync(filePath, 'utf8');
  const context = {
    MONTH_METRIC_TITLE_STORAGE_KEY_MAP: {},
    GUILHERME_REQUIRED_CARDS: [],
    resolveCategoryName: (value) => String(value || '').trim().toUpperCase()
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: filePath });
  return context;
}

test('isUnifiedDirectMethodSpend only accepts spend rows for pix/dinheiro/debito', () => {
  const { isUnifiedDirectMethodSpend } = loadMesAtualUtilsContext();
  assert.equal(
    isUnifiedDirectMethodSpend({ type: 'spend', outputKind: 'method', outputMethod: 'pix' }),
    true
  );
  assert.equal(
    isUnifiedDirectMethodSpend({ type: 'fixed', outputKind: 'method', outputMethod: 'pix' }),
    false
  );
  assert.equal(
    isUnifiedDirectMethodSpend({ type: 'spend', outputKind: 'method', outputMethod: 'boleto' }),
    false
  );
});

