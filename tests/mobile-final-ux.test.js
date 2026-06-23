const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appDir = path.join(__dirname, '..', 'public', 'app');
const read = (...parts) => fs.readFileSync(path.join(appDir, ...parts), 'utf8');

test('internet banking mobile uses a dedicated tall shell closed explicitly by X', () => {
  const source = read('modules', 'mobile-v2', 'internet-banking-mobile.js');
  assert.match(source, /id = 'mobileV2InternetBankingSheet'/);
  assert.match(source, /data-mib-close/);
  assert.match(source, /height:min\(94dvh,900px\)/);
  assert.doesNotMatch(source, /openInlineSheet\?\.\(\{\s*title: 'Internet Banking'/);
});

test('internet banking edits final description while Pluggy memory keeps original description', () => {
  const mobile = read('modules', 'mobile-v2', 'internet-banking-mobile.js');
  const canonical = read('pluggy-banking.js');
  assert.match(mobile, /data-field="description"/);
  assert.match(mobile, /data-field="category"/);
  assert.match(mobile, /data-field="tag"/);
  assert.match(canonical, /_ui\.originalDescription \|\| row\.descriptionRaw/);
});

test('month mobile exposes direct-method tabs only from real month rows and sorts by date', () => {
  const source = read('modules', 'mobile-v2', 'mes-atual-mobile.js');
  assert.match(source, /function getDirectMethodTabs\(month\)/);
  assert.match(source, /outputKind \|\| ''\)\.toLowerCase\(\) === 'method'/);
  assert.match(source, /function sortViewsByDateDesc\(rows\)/);
  assert.match(source, /Acompanhe seu planejamento m\u00eas a m\u00eas/);
});

test('calendar mobile keeps daily chart and selected-day details visible', () => {
  const source = read('modules', 'mobile-v2', 'calendario-mobile.js');
  assert.match(source, /renderDailyChart\(dayMap, selectedDay\)/);
  assert.match(source, /renderSelectedDay\(month, selectedDay, dayMap\)/);
  assert.doesNotMatch(source, /> Gr\u00e1fico di\u00e1rio<\/button>/);
});

test('mobile settings separates profile, preferences, integrations and widget', () => {
  const source = read('modules', 'mobile-v2', 'perfil-mobile.js');
  assert.match(source, /<h2>Ajustes<\/h2>/);
  assert.match(source, /Editar perfil', 'edit-profile'/);
  assert.match(source, /Widget para iPhone', 'widget'/);
  assert.match(source, /async function openProfileEditor/);
  assert.match(source, /compressAvatar/);
  assert.match(source, /avatarDataUrl/);
  assert.match(source, /async function openWidget/);
  assert.doesNotMatch(source, /Categorias e tags/);
});

test('onboarding X persists full dismissal without erasing completed tasks', () => {
  const source = read('modules', 'mobile-v2', 'onboarding.js');
  assert.match(source, /function dismissOnboarding\(\)/);
  assert.match(source, /suppressed: true/);
  assert.match(source, /dismissedAt: Date\.now\(\)/);
  assert.doesNotMatch(source, /seenCompleted:\s*\{\}/);
});
