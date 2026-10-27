'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, firefox, webkit, devices } = require('playwright');
const { createBrowserFixtureServer } = require('../tests/helpers/refactor-browser-server');
const { richState } = require('./audit-responsive');

async function main() {
  const vendor = process.env.MEUFIN_SMOKE_VENDOR_DIR || path.resolve('tmp/m01-preview/vendor');
  const fixture = await createBrowserFixtureServer(new Map([
    ['/fixture-assets/chart.js', fs.readFileSync(path.join(vendor, 'chart.umd.js'))],
    ['/fixture-assets/fuse.js', fs.readFileSync(path.join(vendor, 'fuse.min.js'))]
  ]));
  const engine = process.env.MEUFIN_DESIGN_ENGINE || 'chromium';
  const browserType = { chromium, firefox, webkit }[engine];
  if (!browserType) throw new Error('Unknown design-test browser: ' + engine);
  const browser = await browserType.launch();
  const failures = [], errors = [];
  let passed = 0;
  async function check(name, run) {
    try { await run(); passed++; console.log('PASS ' + name); }
    catch (error) { failures.push({ name, message: error.message }); console.log('FAIL ' + name + ': ' + error.message); }
  }
  async function open(kind) {
    const options = { ...devices['Pixel 7'], viewport: { width: 320, height: 844 } };
    if (engine === 'firefox') delete options.isMobile;
    const context = await browser.newContext(options);
    await context.addInitScript(() => document.addEventListener('appReady', () => { window.__designReady = true; }, { once: true }));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== fixture.origin) return route.abort();
      if (url.pathname === '/api/app/bootstrap') {
        const payload = await (await route.fetch()).json(); payload.appState = richState(kind);
        if (kind === 'normal') payload.appState.finData.at(-1).outflows[3].description = 'Supermercado de teste';
        return route.fulfill({ json: payload });
      }
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-27T12:00:00Z'));
    await page.goto(fixture.link('a')); await page.waitForFunction(() => window.__designReady);
    await page.locator('#mobileV2Splash').waitFor({ state: 'hidden' });
    await page.evaluate(() => { currentMonthId = 'outubro_2026'; MobileV2.setTab('mes'); });
    return page;
  }
  try {
    const p = await open('normal');
    const before = await p.evaluate(() => JSON.stringify(getAllFinanceMonths()));
    await check('320px heading does not intersect actions', async () => {
      assert.equal(await p.evaluate(() => {
        const title = document.querySelector('.mobile-v2-screen.active .m2-title');
        const actions = document.querySelector('.mobile-v2-screen.active .m2-header-actions');
        const range = document.createRange(); range.selectNodeContents(title);
        const a = range.getBoundingClientRect(), b = actions.getBoundingClientRect();
        return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
      }), false);
    });
    await check('mobile category bars have real geometry', async () => {
      await p.evaluate(() => MobileV2.setTab('dashboard'));
      assert.equal(await p.locator('#mobileV2Root .category-bar').first().evaluate(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height >= 4), true);
    });
    await check('dashboard exposes exact period and accessible selection', async () => {
      assert.match(await p.locator('.m2-period-context').innerText(), /2026/);
      assert.equal(await p.locator('[data-m2-period="6"]').getAttribute('aria-pressed'), 'true');
    });
    await check('category goals start with list and optional distribution', async () => {
      await p.evaluate(() => { MobileV2MesAtual.setSubtab('gastos-metas'); MobileV2.setTab('mes'); });
      assert.equal(await p.locator('.gm-summary-card').evaluate(e => e.tagName === 'DETAILS' && !e.open), true);
      assert.equal(await p.locator('.gm-name').first().evaluate(e => e.scrollWidth <= e.clientWidth + 1), true);
    });
    await check('income rows leave usable room for names and values', async () => {
      await p.locator('[data-m2-subtab="renda"]').click();
      assert.ok(await p.locator('.m-item-income .m-item-info').first().evaluate(e => e.clientWidth) >= 120);
      assert.equal(await p.locator('[data-m2-subtab="renda"]').evaluate(e => {
        const r=e.getBoundingClientRect(), parent=e.parentElement.getBoundingClientRect();
        return r.left >= parent.left - 1 && r.right <= parent.right + 1;
      }), true);
      assert.equal(await p.locator('.m2-method-tabs').isVisible(), false);
    });
    await check('monthly search tolerates text typos but keeps method and exact amount', async () => {
      await p.locator('[data-m2-subtab="todos"]').click();
      await p.locator('#mobileV2AllSearch').fill('supermercdo');
      assert.equal(await p.locator('.m2-tab-panel.active .m-item:not([hidden])').count(), 1);
      assert.match(await p.locator('.m2-tab-panel.active .m-item:not([hidden])').innerText(), /Supermercado de teste/);
      await p.locator('[data-m2-subtab="method:pix"]').click();
      await p.locator('#mobileV2AllSearch').fill('01/10/26');
      assert.equal(await p.locator('.m2-tab-panel.active .m-item:not([hidden])').count(), 0);
      await p.locator('#mobileV2AllSearch').fill('90,00');
      assert.equal(await p.locator('.m2-tab-panel.active .m-item:not([hidden])').count(), 1);
      await p.locator('#mobileV2AllSearch').fill('');
    });
    await check('dialog cycles focus, closes with Escape and restores invoker', async () => {
      await p.locator('#mobileV2Fab').focus();
      await p.evaluate(() => MobileV2OutflowForm.open('launch')); await p.waitForTimeout(120);
      await p.locator('#mobileV2OutflowSubmit').focus(); await p.keyboard.press('Tab');
      assert.equal(await p.evaluate(() => !!document.activeElement.closest('#mobileV2OutflowSheet')), true);
      await p.keyboard.press('Escape'); await p.waitForTimeout(120);
      assert.equal(await p.locator('#mobileV2OutflowSheet').isVisible(), false);
      assert.equal(await p.evaluate(() => document.activeElement.id), 'mobileV2Fab');
    });
    await p.evaluate(() => MobileV2OutflowForm.closeInlineSheet());
    await check('recurrence confirmation can take focus above the edit sheet', async () => {
      await p.evaluate(() => {
        MobileV2OutflowForm.open('launch');
        openRecurringChangeScopeModal({ onThisMonth: () => {}, onForward: () => {}, onCancel: () => {} });
      });
      await p.waitForTimeout(150);
      assert.equal(await p.locator('#modalRecurringChangeScope').evaluate(e => !!e.closest('[inert]')), false);
      await p.locator('#modalRecurringChangeScope button').first().click();
      await p.evaluate(() => MobileV2OutflowForm.closeInlineSheet());
    });
    await p.evaluate(() => { resolveRecurringChangeScope('cancel'); MobileV2OutflowForm.closeInlineSheet(); });
    await check('validation errors are announced inside the active dialog', async () => {
      await p.evaluate(() => { MobileV2OutflowForm.open('launch'); showAppStatus('Valor inválido de teste', 'Confira os dados'); });
      await p.waitForTimeout(150);
      assert.match(await p.locator('#mobileV2OutflowSheet [data-mobile-dialog-status]').innerText({ timeout: 1000 }), /Valor inválido/);
      await p.evaluate(() => { hideAppStatus(); MobileV2OutflowForm.closeInlineSheet(); });
    });
    await p.evaluate(() => { hideAppStatus(); MobileV2OutflowForm.closeInlineSheet(); });
    await check('Escape does not silently discard a changed draft', async () => {
      await p.evaluate(() => MobileV2OutflowForm.open('launch'));
      await p.locator('#mobileV2OutflowDescription').fill('Rascunho de teste');
      let asked = false;
      const reject = async dialog => { asked = true; await dialog.dismiss(); };
      p.on('dialog', reject); await p.keyboard.press('Escape'); await p.waitForTimeout(120);
      p.off('dialog', reject);
      assert.equal(asked, true);
      assert.equal(await p.locator('#mobileV2OutflowDescription').inputValue(), 'Rascunho de teste');
      asked = false;
      p.on('dialog', reject); await p.locator('#mobileV2OutflowBack').click(); p.off('dialog', reject);
      assert.equal(asked, true);
      assert.equal(await p.locator('#mobileV2OutflowDescription').inputValue(), 'Rascunho de teste');
      await p.locator('#mobileV2OutflowCancel').click();
    });
    await check('profile exposes a modal and a semantic theme switch', async () => {
      await p.evaluate(() => MobileV2PerfilSheet.open()); await p.waitForTimeout(120);
      assert.equal(await p.locator('#mobileV2PerfilSheet .bottom-sheet-panel').getAttribute('role'), 'dialog');
      assert.equal(await p.locator('[data-profile-action="toggle-theme"]').getAttribute('role'), 'switch');
      await p.keyboard.press('Escape');
    });
    await p.evaluate(() => MobileV2PerfilSheet.close());
    await check('dark selected navigation text meets normal-text contrast', async () => {
      await p.evaluate(() => toggleThemePreference(true));
      await p.waitForTimeout(300);
      const ratio = await p.locator('.bottom-nav-item.active').evaluate(e => {
        const rgb = color => color.match(/[\d.]+/g).slice(0,3).map(Number);
        const luminance = color => rgb(color).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum,v,i) => sum + v * [.2126,.7152,.0722][i], 0);
        const s = getComputedStyle(e), a = luminance(s.color), b = luminance(s.backgroundColor);
        return (Math.max(a,b) + .05) / (Math.min(a,b) + .05);
      });
      assert.ok(ratio >= 4.5, String(ratio));
    });
    await check('history groups every existing month by year', async () => {
      await p.evaluate(() => MobileV2.setTab('historico'));
      assert.ok(await p.locator('.m2-history-year').count() >= 3);
      assert.equal(await p.locator('.m2-history-row-plain').count(), 36);
    });
    await check('wealth keeps secondary destructive actions in a closed menu', async () => {
      await p.evaluate(() => MobileV2.setTab('patrimonio'));
      assert.equal(await p.locator('.m2-patr-account details').count(), 1);
      assert.equal(await p.locator('.m2-patr-account details').evaluate(e => e.open), false);
    });
    await check('layout-only interactions preserve financial state', async () => {
      assert.equal(await p.evaluate(() => JSON.stringify(getAllFinanceMonths())), before);
    });
    await check('recurring mobile edit supports cancelling scope then confirmed save', async () => {
      await p.evaluate(() => {
        MobileV2.setTab('mes'); save = async () => true;
        const month = getCurrentMonth();
        const item = normalizeUnifiedOutflowItem({ id: 'design-recurring', description: 'Recorrente ficticio',
          amount: 30, category: month.outflows[0].category, date: '23/10/26', type: 'expense',
          outputKind: 'method', outputMethod: 'boleto', expenseRecurring: true, recurringGroupId: 'design-rec-group' });
        month.outflows.push(item); MobileV2OutflowForm.openEdit(item);
      });
      await p.locator('#mobileV2OutflowAmount').fill('40,00');
      await p.locator('#mobileV2OutflowSubmit').click();
      await p.locator('#modalRecurringChangeScope').waitFor({ state: 'visible' });
      await p.locator('#modalRecurringChangeScope').getByRole('button', { name: 'Cancelar', exact: true }).click();
      await p.waitForFunction(() => !document.getElementById('mobileV2OutflowSubmit').disabled);
      assert.equal(await p.evaluate(() => getCurrentMonth().outflows.find(item => item.id === 'design-recurring').amount), 30);
      await p.locator('#mobileV2OutflowSubmit').click();
      await p.locator('#modalRecurringChangeScope').getByRole('button', { name: 'Alterar apenas este mês', exact: true }).click();
      await p.locator('#mobileV2OutflowSheet').waitFor({ state: 'hidden' });
      assert.equal(await p.evaluate(() => getCurrentMonth().outflows.find(item => item.id === 'design-recurring').amount), 40);
    });
    await p.context().close();
    const extreme = await open('many');
    await check('extreme monthly values fit their own metric', async () => {
      assert.equal(await extreme.locator('.m2-mini-value').evaluateAll(els => els.every(e => e.scrollWidth <= e.clientWidth + 1)), true);
    });
    await check('search brings a far virtual-list match to the beginning', async () => {
      await extreme.locator('[data-m2-subtab="todos"]').click();
      await extreme.locator('#mobileV2AllSearch').fill('999999999.99');
      assert.equal(await extreme.locator('#mobileV2AllList [data-outflow-id="many-0"]').isVisible(), true);
      assert.ok(await extreme.locator('#mobileV2AllList [data-outflow-id="many-0"]').evaluate(e => e.getBoundingClientRect().top - e.parentElement.getBoundingClientRect().top) < 10);
      await extreme.locator('#mobileV2AllSearch').fill('');
      assert.equal(await extreme.locator('#mobileV2AllList .m-item:not([hidden])').count(), 300);
      assert.ok(await extreme.locator('.m2-virtual-spacer').evaluate(e => e.offsetHeight) >= 300 * 112);
    });
    await extreme.context().close();
    const empty = await open('empty');
    await empty.evaluate(() => MobileV2.setTab('dashboard'));
    await check('empty dashboard explains absence of movements instead of an arbitrary chart', async () => {
      assert.equal(await empty.locator('#mobileV2LineChart').getAttribute('hidden'), '');
      assert.match(await empty.locator('#mobileV2Screen-dashboard').innerText(), /Sem movimentações/);
    });
    await empty.context().close();
    assert.deepEqual(errors, []); assert.equal(fixture.unchanged(), true);
    console.log(JSON.stringify({ engine, passed, failures, pageErrors: errors, fixtureUnchanged: fixture.unchanged() }));
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); await fixture.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
