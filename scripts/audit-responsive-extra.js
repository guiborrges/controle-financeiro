'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {chromium,devices}=require('playwright');
const {createBrowserFixtureServer}=require('../tests/helpers/refactor-browser-server');
const {richState,measure}=require('./audit-responsive');
const out=process.env.MEUFIN_AUDIT_OUTPUT || path.resolve('docs/auditoria-responsividade/evidencias');
const result={resize:[],dialogs:[],periods:[],zoom:[],extremes:[],errors:[]};
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const assets=new Map([['/fixture-assets/chart.js',fs.readFileSync('tmp/m01-preview/vendor/chart.umd.js')],['/fixture-assets/fuse.js',fs.readFileSync('tmp/m01-preview/vendor/fuse.min.js')]]);
 const fixture=await createBrowserFixtureServer(assets);
 const browser=await chromium.launch({headless:true});
 result.browser=browser.version();
 const settle=async p=>{await p.waitForTimeout(250);await p.evaluate(()=>document.querySelectorAll('canvas').forEach(c=>window.Chart?.getChart(c)?.stop()));};
 async function configure(context){await context.route('**/*',async r=>{
  if(new URL(r.request().url()).origin!==fixture.origin)return r.abort();
  if(new URL(r.request().url()).pathname==='/api/app/bootstrap'){const response=await r.fetch();const data=await response.json();data.appState=richState();return r.fulfill({json:data});}
  return r.continue();
 });}
 async function open(touch,width,height){const context=await browser.newContext({viewport:{width,height},...(touch?{userAgent:devices['Pixel 7'].userAgent,hasTouch:true,isMobile:true,deviceScaleFactor:2}:{})});await configure(context);const p=await context.newPage();p.setDefaultTimeout(4000);await p.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));p.on('pageerror',e=>result.errors.push(e.message));await p.goto(fixture.link('a'));await p.waitForFunction(()=>typeof getAllFinanceMonths==='function'&&getAllFinanceMonths().length>=36);await p.locator('#mobileV2Splash').waitFor({state:'hidden',timeout:5000}).catch(()=>{});await p.evaluate(()=>{currentMonthId='outubro_2026';nav('dashboard');});await settle(p);return p;}
 async function capture(p,name){await p.locator('#mobileV2Splash').waitFor({state:'hidden',timeout:5000}).catch(()=>{});await p.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});return name+'.png';}
 try{
  for(const touch of [false,true]){
   const p=await open(touch,1920,1080);
   for(const width of [1920,1600,1440,1280,1024,900,768,600,430,375,320,430,768,1024,1280,1920]){await p.setViewportSize({width,height:900});await settle(p);result.resize.push({touch,...await measure(p),...(width===375?{evidence:await capture(p,'continuous-'+touch+'-375')}:{})});}
   await p.context().close();
  }
  for(const touch of [false,true]){
   const p=await open(touch,touch?390:1280,touch?844:500);
   if(touch){await p.evaluate(()=>MobileV2.setTab('dashboard'));await settle(p);result.freshMobile={...await measure(p),evidence:await capture(p,'fresh-mobile-390')};
    for(const period of ['1','3','6','12','custom']){try{await p.locator(`[data-m2-period="${period}"]`).click();await settle(p);if(period==='custom'){await p.locator('select[id^="dashPeriodStart_"]').first().selectOption('24');await p.locator('select[id$="_end"]').selectOption('35');await p.getByRole('button',{name:'Aplicar período',exact:true}).click();await settle(p);}result.periods.push({period,text:await p.locator('.hero-card').innerText(),...await measure(p),evidence:await capture(p,'period-'+period)});}catch(e){result.periods.push({period,error:e.message});}}
   }
   const actions=touch?[['lancamento','MobileV2OutflowForm.open("launch")'],['perfil','MobileV2PerfilSheet.open()'],['editar-perfil','MobileV2PerfilSheet.openProfileEditor()'],['calendario','MobileV2.setTab("calendario")']]:[['lancamento','openUnifiedOutflowModal()'],['editar','openUnifiedOutflowModal(getCurrentMonth().outflows[0].id)'],['cartao','openUnifiedCardModal()'],['renda','openAddItem("renda")'],['extra','openAddItem("projeto")'],['meta','openAddItem("financialGoal")'],['categorias','openCategoryEditorModal()'],['perfil','nav("perfil")'],['preferencias','openPreferences()'],['calendario','openFinanceCalendarModal()'],['importacao','openBillImportModal()'],['busca','UniversalSearch.open()']];
   for(const [name,action]of actions){try{
    await p.evaluate(()=>{document.querySelectorAll('.modal-bg.open').forEach(e=>e.classList.remove('open'));document.querySelectorAll('.m2-sheet.open').forEach(e=>e.classList.remove('open'));});
    await p.evaluate(action);await settle(p);
    const controls=await p.evaluate(()=>[...document.querySelectorAll('.modal-bg.open button,.modal-bg.open input,.modal-bg.open select')].filter(e=>e.getBoundingClientRect().width).map(e=>({text:(e.textContent||e.getAttribute('aria-label')||e.id).trim().slice(0,65),y:e.getBoundingClientRect().y,bottom:e.getBoundingClientRect().bottom})));
    const evidence=await capture(p,'extra-'+touch+'-'+name);
    const reachability=await p.evaluate(()=>{const roots=[...document.querySelectorAll('.modal-bg.open .modal')];return roots.map(root=>{for(const e of [root,...root.querySelectorAll('*')]){if(e.scrollHeight>e.clientHeight&&/auto|scroll/.test(getComputedStyle(e).overflowY))e.scrollTop=e.scrollHeight;}const buttons=[...root.querySelectorAll('button')].filter(e=>/Salvar|Fechar|Cancelar/.test(e.textContent));return buttons.map(e=>{e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {text:e.textContent.trim(),top:r.top,bottom:r.bottom,reachable:r.top>=0&&r.bottom<=innerHeight};});});});
    await p.keyboard.press('Tab');const first=await p.evaluate(()=>document.activeElement?.id||document.activeElement?.tagName);
    await p.keyboard.press('Escape');await settle(p);
    result.dialogs.push({touch,name,controls,reachability,firstFocus:first,...await measure(p),evidence});
   }catch(e){result.dialogs.push({touch,name,error:e.message});}}
   await p.context().close();
  }
  const history=await open(false,320,900);await history.evaluate(()=>nav('historico'));await settle(history);result.history={...await measure(history),evidence:await capture(history,'history-320')};await history.context().close();
  for(const kind of ['empty','single','many'])for(const touch of [false,true]){
   const p=await open(touch,touch?320:1366,touch?568:768);
   await p.route('**/api/app/bootstrap',async route=>{const response=await route.fetch();const data=await response.json();data.appState=richState(kind);return route.fulfill({json:data});});
   await p.reload();await p.waitForFunction(()=>typeof getAllFinanceMonths==='function'&&getAllFinanceMonths().length>=36);await p.locator('#mobileV2Splash').waitFor({state:'hidden',timeout:5000}).catch(()=>{});
   await p.evaluate(()=>{currentMonthId='outubro_2026';if(window.MobileV2?.isEnabled())MobileV2.setTab('dashboard');else nav('dashboard');});
   for(const dark of [false,true]){await p.evaluate(d=>toggleThemePreference(d),dark);await settle(p);result.extremes.push({kind,touch,dark,...await measure(p),text:await p.locator(touch?'.hero-card':'#dashboard').innerText().catch(()=>''),evidence:await capture(p,'verified-extreme-'+kind+'-'+touch+'-'+dark)});}
   await p.context().close();
  }
  const extension=fs.mkdtempSync(path.join(os.tmpdir(),'meufin-zoom-extension-'));
  fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify({manifest_version:3,name:'Isolated audit zoom',version:'1.0',permissions:['tabs'],background:{service_worker:'worker.js'}}));
  fs.writeFileSync(path.join(extension,'worker.js'),'chrome.runtime.onInstalled.addListener(()=>{});');
  let zoomContext;
  try{zoomContext=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'meufin-zoom-profile-')),{channel:'chromium',headless:true,ignoreDefaultArgs:['--disable-extensions'],viewport:{width:1280,height:720},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});await configure(zoomContext);
   const worker=zoomContext.serviceWorkers()[0]||await zoomContext.waitForEvent('serviceworker',{timeout:8000});
   const p=await zoomContext.newPage();await p.goto(fixture.link('a'));await p.waitForFunction(()=>typeof getAllFinanceMonths==='function'&&getAllFinanceMonths().length>=36);await p.evaluate(()=>nav('dashboard'));await settle(p);
   for(const factor of [.8,1,1.25,1.5,2]){const actual=await worker.evaluate(async({factor,url})=>{const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url===url);await chrome.tabs.setZoom(tab.id,factor);return chrome.tabs.getZoom(tab.id);},{factor,url:p.url()});await settle(p);result.zoom.push({factor,actual,...await measure(p),evidence:await capture(p,'zoom-'+factor)});}
  }catch(e){result.zoomError=e.message;}finally{await zoomContext?.close();}
 }finally{await browser.close();await fixture.close();fs.writeFileSync(path.join(out,'resultados-complementares.json'),JSON.stringify(result,null,2));}
 console.log(JSON.stringify({resize:result.resize.length,dialogs:result.dialogs.length,periods:result.periods.length,zoom:result.zoom.length,zoomError:result.zoomError,errors:result.errors}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
