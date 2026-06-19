const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} deve existir`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Não foi possível extrair ${name}`);
}

test('normalizeMonth ignora mês ausente durante bootstrap', () => {
  const filePath = path.resolve(__dirname, '../public/app/core.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractFunction(source, 'normalizeMonth'), context, { filename: filePath });
  assert.equal(context.normalizeMonth(undefined), null);
  assert.equal(context.normalizeMonth(null), null);
});

test('renderMes encerra antes de normalizar sem mês carregado', () => {
  const filePath = path.resolve(__dirname, '../public/app/mes-atual.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const title = { textContent: '' };
  const context = {
    getCurrentMonth: () => undefined,
    document: { getElementById: () => title }
  };
  vm.createContext(context);
  vm.runInContext(extractFunction(source, 'renderMes'), context, { filename: filePath });
  assert.doesNotThrow(() => context.renderMes());
  assert.equal(title.textContent, 'Carregando mês...');
});
