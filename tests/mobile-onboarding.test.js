const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appDir = path.join(__dirname, '..', 'public', 'app');
const source = fs.readFileSync(path.join(appDir, 'modules', 'mobile-v2', 'onboarding.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');

function loadOnboarding({ months = [], accounts = [], connected = false } = {}) {
  const listeners = {};
  const document = {
    readyState: 'loading',
    documentElement: { classList: { contains() { return false; } } },
    addEventListener(name, handler) { listeners[name] = handler; },
    querySelector(selector) {
      if (selector === '.muplug-connection-badge.is-connected' && connected) return {};
      return null;
    },
    getElementById() { return null; },
    createElement() { throw new Error('UI should not be created while mobile mode is disabled'); }
  };
  const window = {
    document,
    MobileV2: { isEnabled() { return false; } },
    MobileV2Data: {
      getMonths() { return months; },
      getPatrimonioData() { return { accounts }; }
    },
    patrimonioAccounts: accounts,
    localStorage: { getItem() { return null; }, setItem() {} },
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(source, { window, document, console, setTimeout, clearTimeout });
  return window.MobileV2Onboarding;
}

test('onboarding derives every checklist step from canonical app data', () => {
  const onboarding = loadOnboarding({
    accounts: [{ id: 'account-1' }],
    connected: true,
    months: [{
      outflowCards: [{ id: 'card-1' }],
      renda: [{ fonte: 'Salário', valor: 1000 }],
      outflows: [{ id: 'launch-1', amount: 10 }],
      dailyGoals: { MERCADO: 500 }
    }]
  });
  const snapshot = onboarding.getCompletionSnapshot();
  assert.equal(snapshot.count, 6);
  assert.equal(snapshot.total, 6);
  assert.equal(snapshot.allDone, true);
  assert.deepEqual({ ...snapshot.completed }, {
    account: true,
    card: true,
    income: true,
    outflow: true,
    goals: true,
    banking: true
  });
});

test('empty financial data keeps onboarding steps incomplete', () => {
  const snapshot = loadOnboarding().getCompletionSnapshot();
  assert.equal(snapshot.count, 0);
  assert.equal(snapshot.allDone, false);
  assert.ok(Object.values(snapshot.completed).every((value) => value === false));
});

test('mobile onboarding loads after the shared data bridge and before mobile screens', () => {
  const bridge = indexSource.indexOf('/app-assets/modules/mobile-v2/data-bridge.js');
  const onboarding = indexSource.indexOf('/app-assets/modules/mobile-v2/onboarding.js');
  const firstScreen = indexSource.indexOf('/app-assets/modules/mobile-v2/add-sheet.js');
  assert.ok(bridge >= 0 && onboarding > bridge && firstScreen > onboarding);
});
