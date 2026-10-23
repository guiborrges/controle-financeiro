'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');
const { createBrowserFixtureServer } = require('../tests/helpers/refactor-browser-server');

const financeSnapshot = page => page.evaluate(() => JSON.stringify(getAllFinanceMonths().map(month => ({
  id: month.id, outflows: month.outflows, renda: month.renda, projetos: month.projetos,
  financialGoals: month.financialGoals, cardBills: month.cardBills
}))));

async function finishCharts(page) {
  await page.evaluate(() => {
    document.querySelectorAll('canvas').forEach(canvas => {
      const chart = window.Chart?.getChart(canvas);
      if (chart) { chart.stop(); chart.update('none'); }
    });
  });
}

async function assertMonthlyCatalogSelects(page, categoryId, tagId) {
  const result = await page.evaluate(({ categoryId, tagId }) => {
    const values = id => Array.from(document.getElementById(id).options)
      .map(option => option.value).filter(value => value && value !== 'nova');
    const month = getCurrentMonth();
    return {
      categories: values(categoryId),
      expectedCategories: getMonthCategoryOptions(month, window, { includeFallbackBase: false }).map(entry => entry.value),
      tags: values(tagId), expectedTags: getMonthTagOptions(month, window)
    };
  }, { categoryId, tagId });
  assert.deepEqual(result.categories, result.expectedCategories);
  assert.deepEqual(result.tags, result.expectedTags);
}

async function vendorAssets() {
  const assets = new Map();
  for (const [name, url] of [
    ['chart', 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'],
    ['fuse', 'https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.0.0/fuse.min.js']
  ]) {
    const dir = process.env.MEUFIN_SMOKE_VENDOR_DIR;
    let bytes;
    if (dir) bytes = fs.readFileSync(path.join(dir, name === 'chart' ? 'chart.umd.js' : 'fuse.min.js'));
    else {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`Biblioteca publica indisponivel: ${name} HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    assets.set(`/fixture-assets/${name}.js`, bytes);
  }
  return assets;
}

async function main() {
  console.log('Fixture sintetica: preparando servidor local e bibliotecas.');
  const fixture = await createBrowserFixtureServer(await vendorAssets());
  let browser;
  const checks = [];
  const errors = [];
  const check = (name, fn) => fn().then(() => { checks.push(name); console.log(`PASS ${name}`); });
  try {
    const chrome = process.env.MEUFIN_TEST_CHROME || (process.platform === 'win32'
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
    browser = await chromium.launch({ headless: true, timeout: 15000, ...(chrome ? { executablePath: chrome } : {}) });
    console.log('Navegador isolado iniciado.');
    const open = async (tenant, mobile = false) => {
      const context = await browser.newContext(mobile ? { ...devices['Pixel 7'] } : { viewport: { width: 1440, height: 1000 } });
      await context.route('**/*', route => new URL(route.request().url()).origin === fixture.origin ? route.continue() : route.abort());
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-23T12:00:00Z'));
      await page.goto(fixture.link(tenant), { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (mobile) await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
      else await page.locator('.nav-item[data-page="dashboard"]').click();
      await page.waitForFunction(() => getAllFinanceMonths().length === 4, null, { timeout: 8000 });
      return page;
    };
    const desktop = await open('a');
    await check('desktop totals and fixture-only months', async () => {
      assert.deepEqual(await desktop.evaluate(() => {
        const month = getAllFinanceMonths().find(value => value.id === 'outubro_2026');
        const totals = getTotals(month);
        return [getAllFinanceMonths().length, totals.totalGastos, totals.rendaTotal, totals.resultadoMes];
      }), [4, 100, 1000, 890]);
      assert.equal(await desktop.locator('#dashMetrics .metric-card').count(), 3);
      assert.equal(await desktop.locator('#financialDrilldown').count(), 0);
    });
    await check('desktop actual year/month controls and category basis', async () => {
      await desktop.locator('#page-dashboard').getByText('Filtros', { exact: true }).click();
      await desktop.locator('#periodType').selectOption('year');
      await desktop.locator('#periodYear').selectOption('2025');
      assert.match(await desktop.locator('#dashSub').textContent(), /2025/);
      assert.doesNotMatch(await desktop.locator('#dashSub').textContent(), /2026/);
      await desktop.locator('#periodType').selectOption('month');
      await desktop.locator('#periodMonth').selectOption('outubro_2026');
      assert.match(await desktop.locator('#dashSub').textContent(), /OUTUBRO 2026/);
      await desktop.getByRole('combobox', { name: 'Base das categorias' }).selectOption('consumption');
      assert.equal(await desktop.getByRole('combobox', { name: 'Base das categorias' }).inputValue(), 'consumption');
    });
    await check('desktop navigation, charts and history', async () => {
      await desktop.locator('.nav-item[data-page="mes"]').click();
      assert.equal(await desktop.locator('#page-mes').evaluate(node => node.classList.contains('active')), true);
      await desktop.locator('.nav-item[data-page="historico"]').click();
      assert.equal(await desktop.locator('#page-historico tbody tr').count(), 1);
      assert.match(await desktop.locator('#page-historico tbody').textContent(), /OUTUBRO 2026/);
      await desktop.locator('.nav-item[data-page="dashboard"]').click();
      await finishCharts(desktop);
      assert.deepEqual(await desktop.locator('#lineChart').evaluate(canvas => {
        const chart = Chart.getChart(canvas);
        return chart.data.datasets.find(dataset => dataset.seriesKey === 'totalGastos').data;
      }), [100]);
    });
    await check('desktop cancelled draft leaves financial records unchanged', async () => {
      await desktop.locator('.nav-item[data-page="mes"]').click();
      const before = await financeSnapshot(desktop);
      await desktop.locator('#page-mes button[onclick="openUnifiedOutflowModal()"]').click();
      await assertMonthlyCatalogSelects(desktop, 'unifiedOutflowCategory', 'unifiedOutflowTag');
      await desktop.locator('#unifiedOutflowDescription').fill('Rascunho ficticio cancelado');
      await desktop.locator('#unifiedOutflowAmount').fill('123.45');
      await desktop.locator('#modalUnifiedOutflow').getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(await financeSnapshot(desktop), before);
      await desktop.locator('.nav-item[data-page="dashboard"]').click();
    });
    const mobile = await open('a', true);
    await check('mobile shares desktop financial totals and respects viewport', async () => {
      assert.deepEqual(await mobile.evaluate(() => {
        const metrics = MobileV2Data.getMonthMetrics(getAllFinanceMonths().find(value => value.id === 'outubro_2026'));
        return [metrics.renda, metrics.lancamentos, metrics.resultado];
      }), [1000, 100, 890]);
      assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await mobile.getByRole('button', { name: 'Hist\u00f3rico', exact: true }).click();
      assert.ok((await mobile.locator('.m2-history-row-plain').count()) >= 4);
      await mobile.getByRole('button', { name: 'Dashboard', exact: true }).click();
      assert.equal(await mobile.locator('#mobileV2LineChart').evaluate(canvas => canvas.width > 0 && canvas.height > 0), true);
    });
    await check('mobile edit sheet cancellation preserves original financial metadata', async () => {
      await mobile.evaluate(() => MobileV2.setTab('mes'));
      const before = await financeSnapshot(mobile);
      await mobile.locator('#mobileV2Screen-mes [data-action="edit"]:visible').first().click();
      await mobile.locator('#mobileV2OutflowSheet').waitFor({ state: 'visible' });
      await assertMonthlyCatalogSelects(mobile, 'mobileV2OutflowCategory', 'mobileV2OutflowTag');
      await mobile.locator('#mobileV2OutflowDescription').fill('Edicao ficticia cancelada');
      await mobile.locator('#mobileV2OutflowAmount').fill('456,78');
      await mobile.locator('#mobileV2OutflowCancel').click();
      await mobile.locator('#mobileV2OutflowSheet').waitFor({ state: 'hidden' });
      assert.equal(await financeSnapshot(mobile), before);
    });
    const second = await open('b');
    await check('second fictional account stays isolated through reload', async () => {
      assert.equal(await second.evaluate(() => getTotals(getAllFinanceMonths().find(value => value.id === 'outubro_2026')).resultadoMes), 1780);
      await desktop.reload();
      await desktop.locator('.nav-item[data-page="dashboard"]').click();
      assert.equal(await desktop.evaluate(() => getTotals(getAllFinanceMonths().find(value => value.id === 'outubro_2026')).resultadoMes), 890);
      assert.equal(await desktop.evaluate(() => currentSession.id), 'synthetic-a');
      assert.equal(await second.evaluate(() => currentSession.id), 'synthetic-b');
    });
    await check('primary profile keeps five indicators without hydrating bundled personal history', async () => {
      const primary = await open('primary');
      assert.equal(await primary.locator('#dashMetrics .metric-card').count(), 5);
      assert.deepEqual(await primary.evaluate(() => getAllFinanceMonths().map(month => month.id)),
        ['setembro_2025', 'outubro_2025', 'setembro_2026', 'outubro_2026']);
      assert.equal(await primary.evaluate(() => getTotals(getAllFinanceMonths().find(month => month.id === 'outubro_2026')).resultadoMes), 890);
      assert.equal(await primary.locator('#financialDrilldown').count(), 0);
    });
    await check('Desktop command creates, edits and deletes through real forms with synthetic persistence', async () => {
      const page = await open('a');
      await page.evaluate(() => { save = async () => true; });
      await page.locator('.nav-item[data-page="mes"]').click();
      const before = await financeSnapshot(page);
      await page.locator('#page-mes button[onclick="openUnifiedOutflowModal()"]').click();
      await page.locator('#unifiedOutflowDescription').fill('3C Desktop fixture');
      await page.locator('#unifiedOutflowAmount').fill('123.45');
      await page.locator('#unifiedOutflowDate').fill('23/10/26');
      await page.locator('#unifiedOutflowCategory').selectOption({ index: 1 });
      await page.locator('#unifiedOutflowOutput').selectOption('method:debito');
      await page.locator('#unifiedOutflowSubmitBtn').click();
      await page.waitForFunction(() => getCurrentMonth().outflows.some(item => item.description === '3C Desktop fixture'));
      const item = await page.evaluate(() => getCurrentMonth().outflows.find(item => item.description === '3C Desktop fixture'));
      assert.equal(item.amount, 123.45);
      assert.equal(item.paid, true);
      await page.evaluate(id => openUnifiedOutflowModal(id), item.id);
      await page.locator('#unifiedOutflowAmount').fill('125.55');
      await page.locator('#unifiedOutflowSubmitBtn').click();
      await page.waitForFunction(id => getCurrentMonth().outflows.find(item => item.id === id)?.amount === 125.55, item.id);
      await page.evaluate(id => { closeUnifiedOutflowModal(); deleteUnifiedOutflow(id); }, item.id);
      await page.locator('#modalYesNoQuestion button[onclick="resolveYesNoQuestion(true)"]').click();
      assert.equal(await financeSnapshot(page), before);
      await page.context().close();
    });
    await check('Mobile command retries pending save without duplication and edits without Desktop form', async () => {
      const page = await open('a', true);
      await page.evaluate(() => {
        openUnifiedOutflowModal = () => { throw new Error('Hidden Desktop form must not open'); };
        MobileV2OutflowForm.open('launch');
      });
      await page.locator('#mobileV2OutflowDescription').fill('3C Mobile fixture');
      await page.locator('#mobileV2OutflowAmount').fill('13,45');
      await page.locator('#mobileV2OutflowDate').click();
      await page.locator('#mobileV2DatePickerSheet [data-date-part="day"]').selectOption('23');
      await page.locator('#mobileV2DatePickerSheet [data-date-part="month"]').selectOption('10');
      await page.locator('#mobileV2DatePickerSheet [data-date-part="year"]').selectOption('2026');
      await page.locator('#mobileV2DatePickerSheet [data-date-picker-apply]').click();
      await page.locator('#mobileV2OutflowCategory').selectOption({ index: 1 });
      await page.locator('#mobileV2OutflowOutput').selectOption('method:debito');
      await page.locator('#mobileV2OutflowSubmit').click();
      await page.getByRole('button', { name: 'Tentar salvar novamente', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => getCurrentMonth().outflows.filter(item => item.description === '3C Mobile fixture').length), 1);
      await page.evaluate(() => { flushServerStorage = async () => true; save = async () => true; });
      await page.getByRole('button', { name: 'Tentar salvar novamente', exact: true }).click();
      await page.locator('#mobileV2OutflowSheet').waitFor({ state: 'hidden' });
      const item = await page.evaluate(() => getCurrentMonth().outflows.find(item => item.description === '3C Mobile fixture'));
      assert.equal(item.amount, 13.45);
      assert.equal(item.paid, true);
      await page.evaluate(id => MobileV2OutflowForm.openEdit(getCurrentMonth().outflows.find(item => item.id === id)), item.id);
      await page.locator('#mobileV2OutflowAmount').fill('14,55');
      await page.locator('#mobileV2OutflowSubmit').click();
      await page.locator('#mobileV2OutflowSheet').waitFor({ state: 'hidden' });
      const rows = await page.evaluate(() => getCurrentMonth().outflows.filter(item => item.description === '3C Mobile fixture'));
      assert.equal(rows.length, 1, JSON.stringify(await page.evaluate(() => ({
        current: getCurrentMonth().id, rows: getAllFinanceMonths().map(month => ({ id: month.id,
          rows: month.outflows.map(row => ({ id: row.id, description: row.description, amount: row.amount })) }))
      }))));
      assert.equal(rows[0].id, item.id);
      assert.equal(rows[0].amount, 14.55);
      assert.equal(rows[0].paid, true);
      await page.context().close();
    });
    assert.deepEqual(errors, []);
    assert.equal(fixture.unchanged(), true);
    assert.equal(fixture.requests.writes, 0);
    if (process.env.MEUFIN_SMOKE_OUTPUT_DIR) {
      fs.mkdirSync(process.env.MEUFIN_SMOKE_OUTPUT_DIR, { recursive: true });
      await finishCharts(desktop);
      await desktop.screenshot({ path: path.join(process.env.MEUFIN_SMOKE_OUTPUT_DIR, 'desktop.png') });
      await mobile.screenshot({ path: path.join(process.env.MEUFIN_SMOKE_OUTPUT_DIR, 'mobile.png') });
    }
    console.log(JSON.stringify({ passed: checks.length, pageErrors: errors.length, fixtureUnchanged: true,
      writes: fixture.requests.writes, blockedWrites: fixture.requests.blockedWrites }));
  } finally {
    if (browser) await browser.close();
    await fixture.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
