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
  assert.match(source, /Segurança', 'security'/);
  assert.match(source, /Restaurar ou importar', 'restore'/);
  assert.match(source, /toggleRow\('Modo noturno'/);
  assert.match(source, /Widget para iPhone', 'widget'/);
  assert.match(source, /async function openProfileEditor/);
  assert.match(source, /function openSecurity/);
  assert.match(source, /function openRestoreImport/);
  assert.match(source, /compressAvatar/);
  assert.match(source, /avatarDataUrl/);
  assert.match(source, /async function openWidget/);
  assert.doesNotMatch(source, /data-close-perfil[^>]*bottom-sheet-scrim/);
  assert.doesNotMatch(source, /Categorias e tags/);
});

test('mobile outflow save closes without reopening the second edit screen and accepts flexible dates', () => {
  const source = read('modules', 'mobile-v2', 'outflow-form-mobile.js');
  assert.match(source, /function resolveMobileDate\(rawValue\)/);
  assert.match(source, /simpleDayMonthOffset:\s*1/);
  assert.match(source, /placeholder="10 ou 10\/05\/26"/);
  assert.match(source, /global\.saveUnifiedOutflow\(\)/);
  assert.match(source, /global\.closeUnifiedOutflowModal\(\)/);
  assert.doesNotMatch(source, /openUnifiedOutflowModal\(createdId/);
});

test('mobile month swipe navigation is disabled while pull refresh remains active', () => {
  const source = read('mobile-v2-enhancements.js');
  assert.match(source, /function attachPullToRefresh\(\)/);
  assert.match(source, /function attachMonthSwipe\(\)/);
  assert.match(source, /Intencionalmente desativado/);
  assert.doesNotMatch(source, /api\?\.prevMonth\?\.\(\)/);
  assert.doesNotMatch(source, /api\?\.nextMonth\?\.\(\)/);
});

test('mobile category charts do not inject artificial Outras buckets', () => {
  const home = read('modules', 'mobile-v2', 'home-screen.js');
  const mes = read('modules', 'mobile-v2', 'mes-atual-mobile.js');
  assert.match(home, /return ordered\.map\(\(\[name, value\]\)/);
  assert.match(mes, /const slices = rows\.map/);
  assert.doesNotMatch(home, /name:\s*'Outras'/);
  assert.doesNotMatch(mes, /name:\s*'Outras'/);
});

test('onboarding X persists full dismissal without erasing completed tasks', () => {
  const source = read('modules', 'mobile-v2', 'onboarding.js');
  assert.match(source, /function dismissOnboarding\(\)/);
  assert.match(source, /suppressed: true/);
  assert.match(source, /dismissedAt: Date\.now\(\)/);
  assert.doesNotMatch(source, /seenCompleted:\s*\{\}/);
});
