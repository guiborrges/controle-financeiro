'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium,devices}=require('playwright');
const {createBrowserFixtureServer}=require('../tests/helpers/refactor-browser-server');
const {richState}=require('./audit-responsive');

async function main(){
 const vendor=process.env.MEUFIN_SMOKE_VENDOR_DIR||path.resolve('tmp/m01-preview/vendor');
 const fixture=await createBrowserFixtureServer(new Map([['/fixture-assets/chart.js',fs.readFileSync(path.join(vendor,'chart.umd.js'))],['/fixture-assets/fuse.js',fs.readFileSync(path.join(vendor,'fuse.min.js'))]]));
 const browser=await chromium.launch({headless:true});
 let passed=0;
 const check=async(name,fn)=>{await fn();console.log('PASS '+name);passed++;};
 const errors=[];
 async function open(touch,kind='normal'){
  const context=await browser.newContext({viewport:{width:1920,height:1080},...(touch?{userAgent:devices['Pixel 7'].userAgent,hasTouch:true,isMobile:true,deviceScaleFactor:2}:{})});
  await context.route('**/*',async route=>{if(new URL(route.request().url()).origin!==fixture.origin)return route.abort();
   if(new URL(route.request().url()).pathname==='/api/app/bootstrap'){const response=await route.fetch();const data=await response.json();data.appState=richState(kind);return route.fulfill({json:data});}return route.continue();});
  await context.addInitScript(()=>{
   window.__responsiveResizeCount=0;
   window.__responsiveResizeSamples=[];
   window.addEventListener('resize',()=>{window.__responsiveResizeCount++;window.__responsiveResizeSamples.push({inner:innerWidth,client:document.documentElement.clientWidth,candidate:window.__isMobileV2Candidate?.()});});
   document.addEventListener('appReady',()=>{window.__responsiveReady=true;},{once:true});
   window.__axisClips=[];
   const draw=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...args){
    if(this.canvas.id==='mobileV2LineChart'){
     const w=this.measureText(text).width;
     const left=x-(this.textAlign==='right'?w:this.textAlign==='center'?w/2:0);
     if(left<-.5)window.__axisClips.push({text,left});
    }
    return draw.call(this,text,x,y,...args);
   };
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));
  await page.goto(fixture.link('a'));await page.waitForFunction(()=>window.__responsiveReady===true);
  await page.evaluate(()=>{currentMonthId='outubro_2026';nav('dashboard');});return page;
 }
 const settle=async p=>{await p.waitForTimeout(400);};
 try{
  const p=await open(false);
  const layout=await p.evaluate(()=>JSON.stringify(dashboardWidgetLayout));
  const finance=await p.evaluate(()=>JSON.stringify(getAllFinanceMonths()));
  await check('Dashboard organization is explicit and preserves saved positions when toggled',async()=>{
   assert.equal(await p.locator('#dashCustomizeBtn').getAttribute('aria-pressed'),'false');
   assert.equal(await p.locator('.dashboard-widget-grip').first().isVisible(),false);
   await p.locator('#dashCustomizeBtn').click();await settle(p);
   assert.equal(await p.locator('#dashboardWidgets').evaluate(e=>e.classList.contains('is-organizing')),true);
   assert.equal(await p.locator('.dashboard-widget-grip').first().isVisible(),true);
   await p.locator('#dashCustomizeBtn').click();await settle(p);
   assert.equal(await p.evaluate(()=>JSON.stringify(dashboardWidgetLayout)),layout);
   assert.equal(await p.evaluate(()=>JSON.stringify(getAllFinanceMonths())),finance);
   const position=await p.evaluate(()=>{
    dashboardWidgetLayout.gvsr.h+=40;applyDashboardResponsiveLayout();
    return {custom:document.getElementById('dashboardWidgets').classList.contains('is-custom-layout'),
     height:document.querySelector('[data-widget-key="gvsr"]').getBoundingClientRect().height};
   });
   assert.equal(position.custom,true);
   await p.locator('#dashCustomizeBtn').click();await p.locator('#dashCustomizeBtn').click();await settle(p);
   assert.equal(await p.locator('[data-widget-key="gvsr"]').evaluate(e=>e.getBoundingClientRect().height),position.height);
   await p.evaluate(value=>{dashboardWidgetLayout=JSON.parse(value);applyDashboardResponsiveLayout();},layout);
  });
  await check('Category ranking retains full values and optional pie renders when expanded',async()=>{
   assert.ok(await p.locator('.category-ranking .category-bar').count()>0);
   assert.match(await p.locator('.category-ranking').innerText(),/R\$/);
   const details=p.locator('.category-pie-details');
   assert.equal(await details.evaluate(e=>e.open),false);
   await details.locator('summary').click();await settle(p);
   assert.equal(await p.locator('#catPieChart').isVisible(),true);
   assert.equal(await p.locator('#catPieChart').evaluate(c=>{
    const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    return pixels.some((v,i)=>i%4===3&&v>0);
   }),true);
   await details.locator('summary').click();
  });
  await check('loaded Dashboard fits intermediate widths and restores without changing saved layout or finance',async()=>{
   for(const width of [1280,1024,900,768,640,320,640,1024,1920]){
    await p.setViewportSize({width,height:900});await settle(p);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,`overflow ${width}`);
    assert.equal(await p.evaluate(()=>[...document.querySelectorAll('.dashboard-widget')].every(e=>{const r=e.getBoundingClientRect();return r.right<=innerWidth+1&&r.left>=0;})),true,`widget outside ${width}`);
   }
   assert.equal(await p.evaluate(()=>JSON.stringify(dashboardWidgetLayout)),layout);
   assert.equal(await p.evaluate(()=>JSON.stringify(getAllFinanceMonths())),finance);
  });
  await check('Desktop chart tables expose the same labels and values and expand with keyboard',async()=>{
   for(const id of ['lineChart','resultChart','catPieChart']){
    const rows=await p.evaluate(id=>{
     const canvas=document.getElementById(id),chart=Chart.getChart(canvas);
     const details=document.getElementById(canvas.getAttribute('aria-describedby'));
     return {expected:chart.data.labels.length,actual:details.querySelectorAll('tbody tr').length,role:canvas.getAttribute('role')};
    },id);
    assert.equal(rows.role,'img');assert.equal(rows.actual,rows.expected);
   }
   const summary=p.locator('#lineChart-data summary');await summary.focus();await p.keyboard.press('Enter');
   assert.equal(await p.locator('#lineChart-data').evaluate(e=>e.open),true);
  });
  await check('dark pie legend uses the current theme token',async()=>{
   await p.evaluate(()=>toggleThemePreference(true));await settle(p);
   assert.equal(await p.evaluate(()=>Chart.getChart(document.getElementById('catPieChart')).options.plugins.legend.labels.color),await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--text2').trim()));
  });
  await check('History insight cards fit at 320 CSS pixels',async()=>{
   await p.setViewportSize({width:320,height:900});await p.evaluate(()=>nav('historico'));await settle(p);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
  });
  await check('Month keeps inclusion separate from paid and recent copying starts collapsed',async()=>{
   await p.setViewportSize({width:1920,height:1080});
   await p.evaluate(()=>nav('mes'));await settle(p);
   assert.ok(await p.locator('input[aria-label="Incluir no total do mês"]').count()>0);
   assert.ok(await p.locator('.unified-paid-toggle').count()>0);
   await p.evaluate(()=>openUnifiedOutflowModal());
   const recent=p.locator('details.unified-outflow-recent-wrap');
   assert.equal(await recent.evaluate(e=>e.open),false);
   await recent.locator('summary').click();
   assert.equal(await recent.evaluate(e=>e.open),true);
   await p.evaluate(()=>closeModal('modalUnifiedOutflow'));
  });
  await check('Month picker follows both themes, fits narrow screens and selects months',async()=>{
   fs.mkdirSync(path.resolve('output/month-picker-validation'),{recursive:true});
   for(const dark of [false,true]){
    await p.evaluate(dark=>toggleThemePreference(dark),dark);
    for(const width of [1920,320]){
     await p.setViewportSize({width,height:900});await settle(p);
     await p.evaluate(()=>openMonthCalendar());await settle(p);
     const colors=await p.locator('.month-calendar-card').evaluate(e=>{
      const sample=document.createElement('div');sample.style.background='var(--surface)';e.append(sample);
      const expected=getComputedStyle(sample).backgroundColor;sample.remove();
      const r=e.getBoundingClientRect();return {actual:getComputedStyle(e).backgroundColor,expected,left:r.left,right:r.right,width:innerWidth};
     });
     assert.equal(colors.actual,colors.expected);
     assert.ok(colors.left>=0&&colors.right<=colors.width);
     await p.screenshot({path:path.resolve(`output/month-picker-validation/${dark?'dark':'light'}-${width}.png`)});
     await p.locator('.month-calendar-cell').first().click();await settle(p);
     assert.match(await p.locator('#monthPickerLabel').innerText(),/JANEIRO/);
    }
   }
  });
  await p.context().close();
  const mobile=await open(true,'many');
  await check('Mobile loads after first entering its breakpoint and returns to Desktop',async()=>{
   for(const [width,expected]of [[900,true],[390,true],[1024,false],[320,true]]){
    await mobile.setViewportSize({width,height:844});
    try { await mobile.waitForFunction(expected=>!!window.MobileV2?.isEnabled?.()===expected,expected); }
    catch(error){ throw new Error(`${width}: ${JSON.stringify(await mobile.evaluate(()=>({width:innerWidth,mobile:window.MobileV2?.isEnabled?.(),candidate:window.__isMobileV2Candidate?.(),samples:window.__responsiveResizeSamples,resizeCount:window.__responsiveResizeCount,errors:document.getElementById('appStatusMessage')?.textContent,scripts:[...document.scripts].filter(s=>s.src.includes('mobile-v2')).length})))}`,{cause:error}); }
    await settle(mobile);
   }
  });
  await mobile.evaluate(()=>MobileV2.setTab('dashboard'));await settle(mobile);
  await mobile.locator('#mobileV2Splash').waitFor({state:'hidden',timeout:5000});
  await check('Mobile renders full extreme axis labels and DPR-scaled canvases',async()=>{
   const data=await mobile.evaluate(()=>({clips:window.__axisClips,canvases:[...document.querySelectorAll('#mobileV2LineChart,#mobileV2PieChart')].map(c=>({w:c.width,css:c.offsetWidth}))}));
   assert.deepEqual(data.clips,[]);
   for(const canvas of data.canvases)assert.ok(canvas.w>=canvas.css*1.9);
  });
  await check('Mobile line and category tables include financial values',async()=>{
   assert.equal(await mobile.locator('#mobile-line-data tbody tr').count(),6);
   assert.ok(await mobile.locator('#mobile-pie-data tbody tr').count()>0);
   await mobile.locator('#mobile-line-data summary').click();
   assert.match(await mobile.locator('#mobile-line-data').innerText(),/Resultado após metas/);
  });
  await check('Mobile ranking is one column and calendar keeps values in accessible day labels',async()=>{
   assert.equal(await mobile.locator('.pie-legend.category-ranking').evaluate(e=>getComputedStyle(e).gridTemplateColumns.trim().split(/\s+/).length),1);
   const pie=mobile.locator('#mobileV2Root .category-pie-details');
   await pie.locator('summary').click();await settle(mobile);
   assert.equal(await mobile.locator('#mobileV2PieChart').evaluate(c=>{
    const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    return c.offsetWidth>0&&pixels.some((v,i)=>i%4===3&&v>0);
   }),true);
   await mobile.evaluate(()=>MobileV2.setTab('calendario'));await settle(mobile);
   assert.equal(await mobile.locator('.cal-day-total').count(),0);
   assert.ok(await mobile.locator('.cal-day[aria-label*="em saídas"]').count()>0);
   assert.equal(await mobile.locator('.cal-day[aria-pressed="true"]').count(),1);
   const otherDay=mobile.locator('.cal-day[aria-pressed="false"]').first();
   const day=await otherDay.getAttribute('data-cal-day');
   await otherDay.click();
   assert.equal(await mobile.locator(`.cal-day[data-cal-day="${day}"]`).getAttribute('aria-pressed'),'true');
  });
  await mobile.context().close();
  assert.deepEqual(errors,[]);assert.equal(fixture.unchanged(),true);assert.equal(fixture.requests.writes,0);
  console.log(JSON.stringify({passed,pageErrors:errors.length,fixtureUnchanged:fixture.unchanged()}));
 }finally{await browser.close();await fixture.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
