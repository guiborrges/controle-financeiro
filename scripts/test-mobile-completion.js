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
  const browser = await ({ chromium, firefox, webkit })[engine].launch();
  const failures = [], errors = [];
  let activePage = null;
  let passed = 0;
  async function check(name, run) {
    try {
      await run(); passed++; console.log('PASS ' + name);
      if (process.env.MEUFIN_DESIGN_OUTPUT && activePage && !activePage.isClosed()) {
        fs.mkdirSync(process.env.MEUFIN_DESIGN_OUTPUT, { recursive: true });
        await activePage.screenshot({ path: path.join(process.env.MEUFIN_DESIGN_OUTPUT, engine + '-' + name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png'), fullPage: true });
      }
    }
    catch (error) { failures.push({ name, message: error.message }); console.log('FAIL ' + name + ': ' + error.message); }
  }
  async function open(kind = 'normal') {
    const options = { ...devices['Pixel 7'], viewport: { width: 320, height: 720 } };
    if (engine === 'firefox') delete options.isMobile;
    const context = await browser.newContext(options);
    await context.addInitScript(() => document.addEventListener('appReady', () => { window.__ready = true; }, { once: true }));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== fixture.origin) return route.abort();
      if (url.pathname === '/api/app/bootstrap') {
        const payload = await (await route.fetch()).json();
        payload.appState = richState(kind);
        if (kind !== 'empty') {
          const month = payload.appState.finData.at(-1);
          month.outflows[1].tag = 'Trabalho';
          month.outflows[0].date = '27/10/26'; month.outflows[0].paid = false;
          for (const [index, amount, paid] of [[2, 40, false], [3, 20, true]]) {
            Object.assign(month.outflows[index], { sharedExpense: true, sharedOriginalAmount: 100,
              sharedOthersAmount: amount, sharedParticipants: [
                { isOwner: true, name: 'Titular de teste', amount: 100 - amount },
                { name: 'Pessoa de teste', amount, paid }
              ] });
          }
          if (kind === 'extreme') {
            month.renda[0].fonte = 'RENDA DE TESTE '.repeat(12); month.renda[0].valor = 999999999.99;
            month.projetos[0].nome = 'EXTRADETESTE'.repeat(18);
            month.outflows[1].description = 'LancamentoExtenso'.repeat(18); month.outflows[1].amount = 999999999.99;
            month.outflows[2].sharedParticipants[1].name = 'ParticipanteExtenso'.repeat(15);
            month.cardBills[0].amount = 999999999.99;
          }
        }
        return route.fulfill({ json: payload });
      }
      return route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(4000);
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-27T12:00:00Z'));
    await page.goto(fixture.link('a')); await page.waitForFunction(() => window.__ready);
    await page.locator('#mobileV2Splash').waitFor({ state: 'hidden' });
    await page.evaluate(() => { currentMonthId = 'outubro_2026'; MobileV2.setTab('mes'); });
    activePage = page;
    return page;
  }
  try {
    const p = await open();
    await p.evaluate(() => {
      currentMonthId = 'setembro_2026'; MobileV2.refresh();
      currentMonthId = 'outubro_2026'; MobileV2.refresh();
    });
    const before = await p.evaluate(() => JSON.stringify(getAllFinanceMonths()));
    await check('header action menu aligns icons and keeps every label inside its row', async () => {
      const menu = p.locator('.mobile-v2-screen.active .m2-header-menu');
      await menu.locator('summary').click();
      const rows = await menu.locator('.m2-icon-btn').evaluateAll(nodes => nodes.filter(node => node.tagName === 'BUTTON').map(node => {
        const r = node.getBoundingClientRect(), icon = node.querySelector('svg').getBoundingClientRect(), label = node.querySelector('.m2-header-menu-label').getBoundingClientRect();
        return { left: icon.left, inside: label.left >= r.left && label.right <= r.right + 1, height: r.height };
      }));
      assert.equal(rows.length, 3); assert.ok(rows.every(row => row.inside && row.height >= 44));
      assert.ok(Math.max(...rows.map(row => row.left)) - Math.min(...rows.map(row => row.left)) <= 1);
      if (process.env.MEUFIN_DESIGN_OUTPUT) {
        fs.mkdirSync(process.env.MEUFIN_DESIGN_OUTPUT, { recursive: true });
        await p.screenshot({ path: path.join(process.env.MEUFIN_DESIGN_OUTPUT, engine + '-header-menu-open.png') });
      }
      await menu.locator('summary').click();
    });
    await check('expanded add menu stays inside the viewport after scrolling and keeps its close button centered', async () => {
      await p.evaluate(() => window.scrollTo(0, 600));
      await p.locator('#mobileV2Fab').click();
      await p.waitForTimeout(300);
      const boxes = await p.locator('[data-m2-fab-action]').evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: innerWidth, height: innerHeight };
      }));
      assert.ok(boxes.every(r => r.left >= -1 && r.right <= r.width + 1 && r.top >= 0 && r.bottom <= r.height), JSON.stringify(boxes));
      const fab = await p.locator('#mobileV2Fab').evaluate(node => {
        const r = node.getBoundingClientRect(); return { center: r.left + r.width / 2, viewport: document.documentElement.clientWidth / 2 };
      });
      assert.ok(Math.abs(fab.center - fab.viewport) <= 1, JSON.stringify(fab));
      if (process.env.MEUFIN_DESIGN_OUTPUT) {
        fs.mkdirSync(process.env.MEUFIN_DESIGN_OUTPUT, { recursive: true });
        await p.screenshot({ path: path.join(process.env.MEUFIN_DESIGN_OUTPUT, engine + '-add-menu-open.png') });
      }
      await p.locator('#mobileV2Fab').click();
      await p.evaluate(() => window.scrollTo(0, 0));
    });
    await p.evaluate(() => { MobileV2.closeFabMenu({ instant: true }); document.querySelectorAll('.m2-header-menu').forEach(menu => { menu.open = false; }); window.scrollTo(0, 0); });
    await check('tag and search stay inside method and retain independent month state', async () => {
      await p.locator('[data-m2-subtab="todos"]').click();
      await p.locator('#mobileV2TagFilter').selectOption('Trabalho');
      assert.equal(await p.locator('.m2-tab-panel.active .m-item:not([hidden])').count(), 1);
      await p.locator('#mobileV2AllSearch').fill('60,00');
      await p.locator('[data-m2-subtab="method:pix"]').click();
      assert.equal(await p.locator('.m2-tab-panel.active .m-item:not([hidden])').count(), 1);
      await p.evaluate(() => { currentMonthId = 'setembro_2026'; MobileV2.refresh(); });
      assert.equal(await p.locator('#mobileV2AllSearch').inputValue(), '');
      assert.equal(await p.locator('#mobileV2TagFilter').inputValue(), '');
      await p.evaluate(() => { currentMonthId = 'outubro_2026'; MobileV2.refresh(); });
      assert.equal(await p.locator('#mobileV2AllSearch').inputValue(), '60,00');
      assert.equal(await p.locator('#mobileV2TagFilter').inputValue(), 'Trabalho');
      await p.locator('[data-clear-month-filters]').click();
      assert.equal(await p.locator('#mobileV2AllSearch').inputValue(), '');
      assert.equal(await p.locator('#mobileV2TagFilter').inputValue(), '');
    });
    await p.evaluate(() => { currentMonthId = 'outubro_2026'; MobileV2.setTab('mes'); });
    await check('reimbursements distinguish pending and received without adding revenue', async () => {
      await p.locator('[data-m2-subtab="reembolsos"]').click();
      assert.match(await p.locator('[data-reimbursement-pending]').innerText(), /40,00/);
      assert.match(await p.locator('[data-reimbursement-received]').innerText(), /20,00/);
      await p.locator('[data-reimbursement-key] summary').click();
      assert.equal(await p.locator('details[data-reimbursement-key]').evaluate(node => node.open), true);
      assert.equal(await p.locator('details[data-reimbursement-key] .m-item').first().isVisible(), true);
      assert.match(await p.locator('[data-reimbursement-key] .m-item-meta').allTextContents().then(x => x.join(' ')), /Recebido/);
    });
    await check('income shows expected received and outstanding with canonical total', async () => {
      await p.locator('[data-m2-subtab="renda"]').click();
      assert.match(await p.locator('[data-income-summary]').innerText(), /5\.500,00[\s\S]*5\.000,00[\s\S]*500,00/);
    });
    await check('secondary sheets contain focus and restore the invoker on Escape', async () => {
      for (const api of ['MobileV2FiltersSheet', 'MobileV2AddSheet', 'MobileV2PerfilSheet']) {
        await p.locator('#mobileV2Fab').focus();
        await p.evaluate(key => window[key].open(), api);
        await p.waitForFunction(() => !!document.activeElement.closest('[role="dialog"]'));
        await p.keyboard.press('Shift+Tab');
        assert.equal(await p.evaluate(() => !!document.activeElement.closest('[role="dialog"]')), true);
        await p.keyboard.press('Escape');
        await p.waitForFunction(() => !document.querySelector('.bottom-sheet.open:not([hidden])'));
      }
    });
    await check('universal search contains keyboard focus and restores its mobile invoker', async () => {
      await p.waitForFunction(() => !document.getElementById('mobileV2Root').closest('[inert]'));
      const invoker = p.locator('.mobile-v2-screen.active [aria-label="Buscador universal"]');
      await invoker.focus();
      await p.evaluate(() => MobileV2.openUniversalSearch());
      await p.locator('#usSearchInput').waitFor();
      await p.waitForFunction(() => !!document.getElementById('mobileV2Root').closest('[inert]'));
      assert.equal(await p.locator('#mobileV2Root').evaluate(node => !!node.closest('[inert]')), true);
      await p.keyboard.press('Escape');
      await p.locator('#modalUniversalSearch').waitFor({ state: 'hidden' });
      await p.waitForFunction(() => document.activeElement.getAttribute('aria-label') === 'Buscador universal');
      assert.equal(await invoker.evaluate(node => node === document.activeElement), true);
    });
    await check('nested date picker returns focus to the parent editor', async () => {
      await p.evaluate(() => {
        MobileV2OutflowForm.open('launch');
        MobileV2DatePicker.bindToInput('mobileV2OutflowDate');
      });
      await p.locator('#mobileV2OutflowDate').click();
      await p.locator('#mobileV2DatePickerSheet').waitFor();
      await p.keyboard.press('Escape');
      await p.locator('#mobileV2DatePickerSheet').waitFor({ state: 'hidden' });
      await p.waitForFunction(() => !!document.activeElement.closest('#mobileV2OutflowSheet'));
      assert.equal(await p.locator('#mobileV2OutflowSheet').isVisible(), true);
      assert.equal(await p.evaluate(() => !!document.activeElement.closest('#mobileV2OutflowSheet')), true);
      await p.locator('#mobileV2OutflowCancel').click();
    });
    await check('form groups essential data and keeps actions reachable in short landscape', async () => {
      await p.setViewportSize({ width: 640, height: 360 });
      await p.evaluate(() => MobileV2OutflowForm.open('installment'));
      assert.equal(await p.locator('#mobileV2OutflowFormBody fieldset').count(), 2);
      await p.locator('#mobileV2OutflowSubmit').scrollIntoViewIfNeeded();
      assert.equal(await p.locator('#mobileV2OutflowSubmit').evaluate(el => {
        const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight;
      }), true);
      await p.locator('#mobileV2OutflowCancel').click();
      await p.setViewportSize({ width: 320, height: 720 });
    });
    await p.evaluate(() => MobileV2OutflowForm.closeInlineSheet());
    await check('notification popover has a close control and keyboard return', async () => {
      await p.evaluate(() => MobileV2.setTab('mes'));
      await p.waitForTimeout(150);
      await p.evaluate(() => {
        MobileV2.setTab('mes');
        const button = document.querySelector('#mobileV2Screen-mes .top-bell-btn');
        button.closest('details')?.setAttribute('open', '');
        MesAtualNotifications.toggleNotificationsPopover({ currentTarget: button, preventDefault() {}, stopPropagation() {} });
      });
      assert.equal(await p.locator('.top-notifications.is-open .top-bell-btn').getAttribute('aria-expanded'), 'true');
      assert.match(await p.locator('.top-notifications.is-open [data-notification-popover]').innerText(), /Compra ficticia 0/);
      await p.locator('.top-notifications.is-open [data-close-notifications]').focus();
      await p.evaluate(() => MesAtualNotifications.renderNotificationBells());
      assert.equal(await p.evaluate(() => document.activeElement.matches('[data-close-notifications]')), true);
      await p.keyboard.press('Escape');
      assert.equal(await p.locator('.top-notifications.is-open').count(), 0);
      assert.equal(await p.evaluate(() => document.activeElement.matches('.top-bell-btn')), true);
    });
    await check('onboarding can be interrupted and reopened without an old close timer', async () => {
      await p.emulateMedia({ reducedMotion: 'reduce' });
      await p.evaluate(() => MobileV2Onboarding.openWelcome());
      await p.locator('[data-onboarding-later]').click();
      await p.evaluate(() => MobileV2Onboarding.openWelcome());
      await p.waitForTimeout(300);
      assert.equal(await p.locator('#mobileV2OnboardingLayer').isVisible(), true);
      assert.equal(await p.locator('.m2-onboarding-scrim').evaluate(el => getComputedStyle(el).backdropFilter), 'none');
      await p.keyboard.press('Escape');
      await p.locator('#mobileV2OnboardingLayer').waitFor({ state: 'hidden' });
    });
    await p.evaluate(() => document.getElementById('mobileV2OnboardingLayer')?.setAttribute('hidden', ''));
    await check('profile failure is announced and retains the draft for retry', async () => {
      await p.route('**/api/profile', route => route.fulfill({ status: 503, json: { message: 'Falha sintetica recuperavel' } }));
      await p.evaluate(() => { MobileV2PerfilSheet.open(); MobileV2PerfilSheet.openProfileEditor(); });
      await p.locator('[data-m2-profile="displayName"]').fill('Nome de teste');
      await p.locator('[data-save-profile]').click();
      const status = p.locator('#mobileV2PerfilSheet .m2-settings-status');
      await status.filter({ hasText: 'Falha sintetica' }).waitFor();
      assert.equal(await status.getAttribute('role'), 'alert');
      assert.equal(await p.locator('[data-m2-profile="displayName"]').inputValue(), 'Nome de teste');
      await p.evaluate(() => MobileV2PerfilSheet.close());
    });
    await check('UI-only scenarios preserve the financial snapshot', async () => {
      const after = await p.evaluate(() => JSON.stringify(getAllFinanceMonths()));
      function difference(a, b, at = '') {
        if (JSON.stringify(a) === JSON.stringify(b)) return '';
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return `${at}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`;
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
          const found = difference(a[key], b[key], at + '.' + key); if (found) return found;
        }
        return at;
      }
      assert.ok(after === before, difference(JSON.parse(before), JSON.parse(after)));
    });
    await check('dashboard image export uses theme tokens and exact unabridged values', async () => {
      await p.evaluate(async () => {
        MobileV2.setTab('dashboard'); toggleThemePreference(true);
        window.__exportText = [];
        const original = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
          if (this.canvas.width === 1080) window.__exportText.push({ text: String(text), color: this.fillStyle, font: this.font });
          return original.call(this, text, ...args);
        };
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
        Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} });
        try { await MobileV2HomeScreen.shareDashboardSnapshot(); }
        finally { CanvasRenderingContext2D.prototype.fillText = original; }
      });
      const palette = await p.evaluate(() => ({ text: getComputedStyle(document.documentElement).getPropertyValue('--text').trim().toLowerCase(), rows: window.__exportText }));
      assert.equal(palette.rows.find(row => row.text === 'Renda').color, palette.text);
      assert.ok(palette.rows.some(row => /R\$.*\d,\d{2}/.test(row.text)));
      assert.ok(palette.rows.every(row => /Inter/.test(row.font)));
    });
    await check('reduced motion does not queue interpolated chart frames', async () => {
      await p.emulateMedia({ reducedMotion: 'reduce' });
      const queued = await p.evaluate(() => {
        const original = window.requestAnimationFrame; let count = 0;
        window.requestAnimationFrame = callback => { if (String(callback).includes('interpolateSeries')) count++; return original(callback); };
        try { MobileV2HomeScreen.render(document.getElementById('mobileV2Screen-dashboard')); }
        finally { window.requestAnimationFrame = original; }
        return count;
      });
      assert.equal(queued, 0);
    });
    await check('toast labels are literal text and an action can only run once', async () => {
      await p.evaluate(() => {
        window.__toastActions = 0;
        MobileV2Enhancements.showToast('Teste de aviso', { actionLabel: '<b>Repetir</b>', onAction: () => window.__toastActions++ });
      });
      const action = p.locator('.mobile-v2-toast-action').last();
      assert.equal(await action.innerText(), '<b>Repetir</b>');
      await action.evaluate(button => { button.click(); button.click(); });
      assert.equal(await p.evaluate(() => window.__toastActions), 1);
    });
    await check('primary mobile surfaces keep readable type and comfortable controls', async () => {
      const violations = [];
      for (const tab of ['dashboard', 'mes', 'patrimonio', 'historico', 'calendario']) {
        await p.evaluate(key => MobileV2.setTab(key), tab);
        violations.push(...await p.locator('.mobile-v2-screen.active').evaluate((root, key) => {
          const controls = [...root.querySelectorAll('button, select, summary')].filter(el => {
            if (!el.getClientRects().length || el.closest('[hidden], details:not([open]) > :not(summary)')) return false;
            if (el.matches('.cal-day, [data-chart-day]')) return false;
            const r = el.getBoundingClientRect(); return r.width < 43 || r.height < 43;
          }).map(el => key + ':' + (el.className || el.id) + ':' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height));
          const type = [...root.querySelectorAll('h2,h3,p,span,small,label,dt,dd,strong')].filter(el => {
            if (!el.getClientRects().length || ![...el.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) return false;
            const css = getComputedStyle(el);
            return parseFloat(css.fontSize) < 11 || parseFloat(css.letterSpacing) < 0;
          }).map(el => key + ':type:' + el.className + ':' + getComputedStyle(el).fontSize + ':' + getComputedStyle(el).letterSpacing);
          return [...controls, ...type];
        }, tab));
      }
      assert.deepEqual(violations, []);
    });
    await check('wealth accounts are rows rather than nested cards', async () => {
      await p.evaluate(() => MobileV2.setTab('patrimonio'));
      assert.equal(await p.locator('.m2-patr-account').evaluate(node => !!node.closest('.m-list-card')), false);
    });
    await p.evaluate(() => import('/app-assets/modules/mobile-v2/internet-banking-mobile.js'));
    await p.route('**/api/pluggy/connection', route => route.fulfill({ json: { connected: true } }));
    await p.evaluate(() => {
      window.__originalBanking = PluggyBanking;
      const group = { accountId: 'completion-test', accountName: 'Conta sintetica', accountType: 'CREDIT', pendingCount: 2, totalPending: 30,
        rows: [{ id: 'batch-a', description: 'Primeiro', category: 'LAZER', amount: 10 }, { id: 'batch-b', description: 'Segundo', category: 'LAZER', amount: 20 }] };
      window.__completionSnapshot = { views: { credit: [group], bank: [] } };
      window.PluggyBanking = {
        getMobileSnapshot: async () => window.__completionSnapshot,
        addAll: async () => { group.rows.shift(); group.pendingCount = 1; group.totalPending = 20; return { status: 'pending', savedCount: 1 }; },
        dismiss: () => { throw new Error('Descarte indisponivel'); }, updateField() {}
      };
    });
    await check('partial banking batch names confirmed count and retains pending rows', async () => {
      await p.evaluate(() => MobileV2InternetBanking.open());
      await p.locator('.mib-group-header').click();
      await p.locator('[data-action="all"]').click();
      await p.waitForFunction(() => !document.querySelector('[data-action="all"]').disabled);
      assert.match(await p.locator('[data-mib-feedback]').innerText(), /1.*confirmado/i);
      assert.equal(await p.locator('.mobile-banking-row').count(), 1);
    });
    await check('failed banking dismissal is recoverable and keeps the pending item', async () => {
      await p.locator('.mib-btn-dismiss').click();
      assert.match(await p.locator('[data-mib-feedback]').innerText(), /Não foi possível ignorar/i);
      assert.equal(await p.locator('.mobile-banking-row').count(), 1);
      await p.waitForFunction(() => !document.querySelector('.mib-btn-dismiss').disabled);
    });
    await check('banking successful dismissal refreshes the list without claiming a financial save', async () => {
      await p.evaluate(() => { PluggyBanking.dismiss = () => { window.__completionSnapshot.views.credit = []; }; });
      await p.locator('.mib-btn-dismiss').click();
      await p.locator('.mobile-banking-row').waitFor({ state: 'detached' });
      assert.match(await p.locator('[data-mib-feedback]').innerText(), /ignorado/i);
      await p.evaluate(() => { MobileV2InternetBanking.close(); PluggyBanking = window.__originalBanking; });
    });
    await p.context().close();
    const edit = await open();
    await check('goal editor keeps a pending save open and closes only after retry confirmation', async () => {
      await edit.evaluate(() => {
        window.__saveConfirmed = false; window.__saveCalls = 0;
        save = async () => { window.__saveCalls++; return window.__saveConfirmed; };
        flushServerStorage = async () => window.__saveConfirmed;
      });
      await edit.locator('[data-m2-subtab="gastos-metas"]').click();
      await edit.locator('[data-action="edit-goal"]').first().click();
      await edit.locator('input[id^="mobileMoneyEditor_"]').fill('123,45');
      await edit.getByRole('button', { name: 'Salvar meta', exact: true }).click();
      assert.equal(await edit.locator('#mobileV2OutflowSheet').isVisible(), true);
      assert.match(await edit.locator('[data-money-status]').innerText(), /não confirmado/i);
      await edit.evaluate(() => { window.__saveConfirmed = true; });
      await edit.getByRole('button', { name: 'Tentar salvar novamente', exact: true }).click();
      await edit.locator('#mobileV2OutflowSheet').waitFor({ state: 'hidden' });
      assert.equal(await edit.evaluate(() => window.__saveCalls), 1);
    });
    await edit.evaluate(() => MobileV2OutflowForm.closeInlineSheet());
    await check('card bill editor follows the same confirmed-save contract', async () => {
      await edit.evaluate(() => {
        getCurrentMonth().outflows[11].showInMonthPlanning = true;
        MobileV2MesAtual.invalidateCache(); window.__saveConfirmed = false; save = async () => window.__saveConfirmed;
        MobileV2.refresh();
      });
      await edit.locator('[data-m2-subtab="planejamento"]').click();
      await edit.locator('[data-action="edit-card-bill"]').click();
      await edit.locator('input[id^="mobileMoneyEditor_"]').fill('340,00');
      await edit.getByRole('button', { name: 'Salvar fatura', exact: true }).click();
      assert.equal(await edit.locator('#mobileV2OutflowSheet').isVisible(), true);
      await edit.evaluate(() => { window.__saveConfirmed = true; });
      await edit.getByRole('button', { name: 'Tentar salvar novamente', exact: true }).click();
      await edit.locator('#mobileV2OutflowSheet').waitFor({ state: 'hidden' });
      assert.equal(await edit.evaluate(() => getCurrentMonth().cardBills[0].amount), 340);
    });
    await edit.context().close();
    const extreme = await open('extreme');
    await check('long names and extreme money remain inside every monthly list at phone widths', async () => {
      for (const width of [320, 390, 480]) {
        await extreme.setViewportSize({ width, height: 844 });
        for (const tab of ['todos', 'renda', 'reembolsos']) {
          await extreme.locator(`[data-m2-subtab="${tab}"]`).click();
          if (tab === 'reembolsos') await extreme.locator('[data-reimbursement-key] summary').first().click();
          assert.equal(await extreme.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
          assert.equal(await extreme.locator('.m2-tab-panel.active .m-item-value').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1)), true);
        }
      }
    });
    await extreme.context().close();
    const empty = await open('empty');
    await check('empty month presents one contextual state instead of stacking empty cards', async () => {
      assert.equal(await empty.locator('.m2-tab-panel.active .m2-empty').count(), 1);
    });
    await empty.context().close();
    assert.deepEqual(errors, []); assert.equal(fixture.unchanged(), true);
    console.log(JSON.stringify({ engine, passed, failures, errors, fixtureUnchanged: fixture.unchanged() }));
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); await fixture.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
