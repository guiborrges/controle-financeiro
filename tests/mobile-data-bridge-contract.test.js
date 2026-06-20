const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appDir = path.join(__dirname, '..', 'public', 'app');
const initialModules = ['home-screen.js', 'mes-atual-mobile.js', 'patrimonio-mobile.js', 'historico-mobile.js', 'outflow-form-mobile.js'];
const modules = [...initialModules, 'calendario-mobile.js'];

test('mobile data bridge loads before every screen module', () => {
  const index = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
  const bridgeIndex = index.indexOf('/app-assets/modules/mobile-v2/data-bridge.js');
  assert.notEqual(bridgeIndex, -1);
  for (const moduleName of initialModules) {
    assert.equal(index.indexOf(`/app-assets/modules/mobile-v2/${moduleName}`) > bridgeIndex, true, `${moduleName} must load after data-bridge.js`);
  }
  const shellIndex = index.indexOf('/app-assets/mobile-v2.js');
  assert.equal(shellIndex > bridgeIndex, true);
  const shell = fs.readFileSync(path.join(appDir, 'mobile-v2.js'), 'utf8');
  assert.match(shell, /modules\/mobile-v2\/calendario-mobile\.js/);
});

test('mobile screens consume bridge helpers instead of redefining finance formatters', () => {
  for (const moduleName of modules) {
    const source = fs.readFileSync(path.join(appDir, 'modules', 'mobile-v2', moduleName), 'utf8');
    assert.match(source, /global\.MobileV2Data/);
    assert.doesNotMatch(source, /function\s+(?:escapeHtml|formatMoney|getCategorySymbol|getMonthMetrics|getOutflowRows|getEffectiveOutflowAmount)\s*\(/);
  }
});
