'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium, firefox, webkit, devices } = require('playwright');
const { createBrowserFixtureServer } = require('../tests/helpers/refactor-browser-server');
const { smokeState, monthAt } = require('../tests/helpers/refactor-fixtures');

const root = path.resolve(__dirname, '..');
const output = process.env.MEUFIN_AUDIT_OUTPUT || path.join(root, 'docs/auditoria-responsividade/evidencias');
const results = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(),
  startedAt: new Date().toISOString(), scope: 'local read-only fixture, synthetic data', browsers: [], matrix: [],
  transitions: [], modals: [], extremes: [], errors: [], requestsBlocked: [], screenshots: [] };
const ua = devices['Pixel 7'].userAgent;
const tabletUa = devices['iPad Pro 11'].userAgent;
const desktopSizes = [[1024,768],[1280,720],[1366,768],[1440,900],[1536,864],[1920,1080],[2560,1440],[3440,1440],
  [1280,600],[1280,500],[960,1080],[768,900],[640,900],[430,1000],[320,900],[1920,500]];
const phoneSizes = [[320,568],[360,640],[375,667],[390,844],[393,873],[412,915],[430,932],[480,960]];
const tabletSizes = [[600,960],[768,1024],[820,1180],[1024,1366],[853,1280]];
const viewportMatrix = [
  ...desktopSizes.map(([width,height])=>({ width,height,input:'mouse' })),
  ...phoneSizes.flatMap(([width,height])=>[{width,height,input:'touch'},{width:height,height:width,input:'touch'}]),
  ...tabletSizes.flatMap(([width,height])=>[{width,height,input:'tablet'},{width:height,height:width,input:'tablet'}])
];

function richState(kind = 'normal') {
  const state = smokeState('a');
  const months = [];
  for (let index=0;index<36;index++) {
    const date = new Date(2023,10+index,1);
    const month = monthAt(date.getFullYear(),date.getMonth());
    month.renda = [{ fonte:'Renda ficticia de auditoria',valor:5000,paid:true,recurringFixed:false }];
    month.projetos = [{ nome:'Extra ficticio',valor:500,paid:false }];
    month.financialGoals = [{ id:`goal-${index}`,nome:'Reserva ficticia',valor:400 }];
    month.outflowCards = [{ id:'audit-card',name:'Cartao ficticio',closingDay:2,paymentDay:10 }];
    month.cardBills = [{ id:`bill-${index}`,cardId:'audit-card',amount:300,manualAmountSet:true,paid:false }];
    month.outflows = Array.from({length:12},(_,n)=>({ id:`o-${index}-${n}`,description:`Compra ficticia ${n}`,
      type:n===0?'expense':'spend',category:`CATEGORIA ${n}`,amount:50+n*10,date:`${String(n+1).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getFullYear()).slice(-2)}`,
      outputKind:n===11?'card':'method',outputRef:n===11?'audit-card':'',outputMethod:n===0?'boleto':'pix',paid:n%2===0,status:'done' }));
    month.dailyGoals = { 'CATEGORIA 1': 200 };
    months.push(month);
  }
  state.finData=months;
  state.finPatrimonioAccounts=[{id:'audit-account',nome:'Conta ficticia',tipo:'Reserva'}];
  state.finPatrimonioMovements=[{id:'audit-movement',type:'aporte',accountId:'audit-account',value:1000,date:'2026-10-10',description:'Aporte ficticio'}];
  const last=months.at(-1);
  if(kind==='empty') for(const month of months) { month.outflows=[];month.cardBills=[];month.outflowCards=[];month.renda=[];month.projetos=[];month.financialGoals=[];month.dailyGoals={}; }
  if(kind==='single') for(const month of months) { month.outflows=month.outflows.slice(0,1);month.outflowCards=[];month.cardBills=[]; }
  if(kind==='many') {
    last.outflows=Array.from({length:300},(_,n)=>({ ...last.outflows[n%12],id:`many-${n}`,
      description:`Descricao extensa de uma movimentacao ficticia para auditoria numero ${n}`,
      category:`CATEGORIA EXTENSA DE AUDITORIA ${n%40}`,amount:n===0?999999999.99:0.01+n }));
    last.renda[0].valor=1;
  }
  return state;
}

async function measure(page) {
  return page.evaluate(()=>{
    const round=n=>Math.round(n*10)/10;
    const visible=node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return r.width>1&&r.height>1&&s.visibility!=='hidden'&&s.display!=='none';};
    const rect=node=>{const r=node.getBoundingClientRect();return {x:round(r.x),y:round(r.y),w:round(r.width),h:round(r.height),right:round(r.right),bottom:round(r.bottom)};};
    const intentional=node=>{for(let p=node.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p),r=p.getBoundingClientRect();if(/auto|scroll/.test(s.overflowX)&&p.scrollWidth>p.clientWidth&&r.left>=-1&&r.right<=innerWidth+1)return true;}return false;};
    const offenders=[...document.querySelectorAll('body *')].filter(visible).filter(node=>{
      const r=node.getBoundingClientRect();return r.right>innerWidth+2&&r.left<innerWidth&&!intentional(node);
    }).slice(0,15).map(node=>({tag:node.tagName,id:node.id,cls:String(node.className).slice(0,90),text:(node.textContent||'').trim().slice(0,70),rect:rect(node)}));
    const canvases=[...document.querySelectorAll('canvas')].filter(visible).map(canvas=>{
      const chart=window.Chart?.getChart(canvas);
      const sample=document.createElement('canvas');sample.width=64;sample.height=64;
      let pixels=0;try{const ctx=sample.getContext('2d');ctx.drawImage(canvas,0,0,64,64);const data=ctx.getImageData(0,0,64,64).data;for(let i=3;i<data.length;i+=4)if(data[i])pixels++;}catch{}
      return {id:canvas.id,rect:rect(canvas),parent:rect(canvas.parentElement),bitmap:[canvas.width,canvas.height],pixels,
        datasets:chart?.data?.datasets?.map(d=>({label:d.label,data:d.data,seriesKey:d.seriesKey})),labels:chart?.data?.labels,
        color:chart?.options?.plugins?.legend?.labels?.color || window.Chart?.defaults?.color};
    });
    const smallTargets=[...document.querySelectorAll('button,input[type=checkbox]')].filter(visible).filter(node=>{const r=node.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&(r.width<24||r.height<24);}).slice(0,15).map(node=>({id:node.id,text:(node.textContent||node.getAttribute('aria-label')||'').trim().slice(0,50),rect:rect(node)}));
    const clippedValues=[...document.querySelectorAll('.mc-value,.metric-value,.m2-home-value,.m-item-value')].filter(visible).filter(node=>node.scrollWidth>node.clientWidth+2).map(node=>({text:node.textContent,rect:rect(node),scrollWidth:node.scrollWidth}));
    const main=document.querySelector('.main');
    return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scale:visualViewport?.scale,
      mobile:!!window.MobileV2?.isEnabled?.(),theme:document.documentElement.getAttribute('data-theme'),
      documentWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth+2,
      bodyScroll:{top:scrollY,height:document.documentElement.scrollHeight},main:main?rect(main):null,
      offenders,canvases,smallTargets,clippedValues,
      totals:typeof getCurrentMonth==='function'?(()=>{const t=getTotals(getCurrentMonth());return [t.rendaTotal,t.totalGastos,t.resultadoMes];})():null};
  });
}

async function settle(page) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.waitForTimeout(70);
  await page.evaluate(()=>document.querySelectorAll('canvas').forEach(canvas=>{const chart=window.Chart?.getChart(canvas);if(chart){chart.stop();chart.update('none');}}));
}
function flush() { fs.writeFileSync(path.join(output,'resultados-visuais.json'),JSON.stringify(results,null,2)); }
async function capture(page,name) {
  const file=`${name.replace(/[^a-z0-9_-]/gi,'-')}.png`;
  await page.screenshot({path:path.join(output,file),fullPage:false,animations:'disabled',timeout:12000});
  results.screenshots.push(file);return file;
}

async function main() {
  fs.mkdirSync(output,{recursive:true});
  const assets=new Map([
    ['/fixture-assets/chart.js',fs.readFileSync(path.join(root,'tmp/m01-preview/vendor/chart.umd.js'))],
    ['/fixture-assets/fuse.js',fs.readFileSync(path.join(root,'tmp/m01-preview/vendor/fuse.min.js'))]
  ]);
  const fixture=await createBrowserFixtureServer(assets);
  const definitions=[['chrome',chromium,{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}],
    ['edge',chromium,{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}],['firefox',firefox,{}],['webkit',webkit,{}]];
  if(process.env.MEUFIN_AUDIT_ENGINES) definitions.splice(0,definitions.length,...definitions.filter(x=>process.env.MEUFIN_AUDIT_ENGINES.split(',').includes(x[0])));
  try {
    for(const [engine,type,options] of definitions) {
      let browser;
      try { browser=await type.launch({headless:true,timeout:20000,...options}); }
      catch(error){results.browsers.push({engine,status:'unavailable',message:error.message});flush();continue;}
      results.browsers.push({engine,status:'executed',version:browser.version(),emulated:true});
      const contexts=[];
      try {
        const open=async(input='mouse',kind='normal',viewport={width:1440,height:900})=>{
          const context=await browser.newContext({viewport,hasTouch:input!=='mouse',deviceScaleFactor:input==='mouse'?1:2,
            ...(input!=='mouse'?{userAgent:input==='tablet'?tabletUa:ua,...(engine!=='firefox'?{isMobile:true}:{})}:{})});
          contexts.push(context);
          await context.route('**/*',async route=>{
            if(new URL(route.request().url()).origin!==fixture.origin){results.requestsBlocked.push(route.request().url());return route.abort();}
            if(new URL(route.request().url()).pathname==='/api/app/bootstrap') {
              const response=await route.fetch();const payload=await response.json();
              payload.appState=richState(kind);payload.permissions={canAccessESO:true};payload.session.permissions=payload.permissions;
              return route.fulfill({json:payload});
            }
            return route.continue();
          });
          const page=await context.newPage();page.setDefaultTimeout(6500);
          page.on('pageerror',error=>results.errors.push({engine,input,message:error.message}));
          await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));
          await page.goto(fixture.link('a'),{waitUntil:'domcontentloaded',timeout:20000});
          await page.waitForFunction(()=>typeof getAllFinanceMonths==='function'&&getAllFinanceMonths().length>=36);
          await page.locator('#mobileV2Splash').waitFor({state:'hidden',timeout:5000}).catch(()=>{});
          await page.evaluate(()=>{currentMonthId='outubro_2026';});
          return page;
        };
        const navigate=async(page,name)=>{
          await page.evaluate(name=>{
            if(window.MobileV2?.isEnabled?.()) MobileV2.setTab(name==='historico'?'historico':name);
            else if(name==='calendario') openFinanceCalendarModal();
            else nav(name);
          },name);await settle(page);
        };
        const sizes=engine==='chrome'?viewportMatrix:viewportMatrix.filter(v=>
          (v.input==='mouse'&&[320,640,768,1024,1280,1920].includes(v.width)&&v.height!==500)
          ||(v.input==='touch'&&[320,390,844].includes(v.width))||(v.input==='tablet'&&[768,1024,1180].includes(v.width)));
        for(const input of ['mouse','touch','tablet']) {
          const relevant=sizes.filter(v=>v.input===input);if(!relevant.length)continue;
          const page=await open(input,'normal',relevant[0]);
          for(const size of relevant) {
            await page.setViewportSize({width:size.width,height:size.height});
            await settle(page);
            for(const theme of ['light','dark']) {
              await page.evaluate(theme=>toggleThemePreference(theme==='dark'),theme);
              for(const screen of engine==='chrome'?['dashboard','mes','patrimonio','historico']:['dashboard']) {
                try {
                  await navigate(page,screen);
                  const measured=await measure(page);
                  const row={engine,input,screen,theme,viewport:[size.width,size.height],...measured};
                  if(screen==='dashboard'&&([320,640,768,1280,1920,3440].includes(size.width)||size.width===1024&&input==='tablet')
                    &&(engine==='chrome'||measured.overflow)) row.evidence=await capture(page,`${engine}-${input}-${size.width}x${size.height}-${theme}-${screen}`);
                  results.matrix.push(row);
                }catch(error){results.matrix.push({engine,input,screen,theme,viewport:[size.width,size.height],executionError:error.message});}
              }
            }
            if(results.matrix.length%32===0)console.log(`${engine}: ${results.matrix.length} medicoes.`);
            flush();
          }
          await page.context().close();
        }
        if(engine==='chrome') {
          for(const input of ['mouse','touch']) {
            const page=await open(input,'normal',{width:1920,height:1080});
            for(const width of [1920,1600,1440,1280,1024,901,900,899,768,600,430,375,320,375,430,600,768,900,901,1024,1280,1920]) {
              await page.setViewportSize({width,height:900});
              await navigate(page,'dashboard');
              results.transitions.push({input,...await measure(page)});
            }
            results.screenshots.push(await capture(page,`resize-roundtrip-${input}`));
            await page.context().close();
          }
          for(const kind of ['empty','single','many']) {
            for(const input of ['mouse','touch']) {
              const page=await open(input,kind,input==='mouse'?{width:1280,height:720}:{width:320,height:568});
              for(const theme of ['light','dark']) {
                await page.evaluate(theme=>toggleThemePreference(theme==='dark'),theme);await navigate(page,'dashboard');
                results.extremes.push({kind,input,theme,...await measure(page),evidence:await capture(page,`extreme-${kind}-${input}-${theme}`)});
              }
              await page.context().close();
            }
          }
          const page=await open('mouse','normal',{width:1280,height:500});
          const modalActions=[['lancamento','openUnifiedOutflowModal()'],['editar-lancamento','openUnifiedOutflowModal(getCurrentMonth().outflows[0].id)'],
            ['cartao','openUnifiedCardModal()'],['renda','openAddItem("renda")'],['extra','openAddItem("projeto")'],
            ['meta','openAddItem("financialGoal")'],['categorias','openCategoryEditorModal()'],['perfil','nav("perfil")'],
            ['preferencias','openPreferences()'],['calendario','openFinanceCalendarModal()'],['importacao','openBillImportModal()'],
            ['busca','UniversalSearch.open()']];
          await navigate(page,'mes');
          for(const [name,action] of modalActions) {
            try {
              await page.evaluate(()=>document.querySelectorAll('.modal-bg.open').forEach(el=>el.classList.remove('open')));
              await page.evaluate(action);await settle(page);
              const visible=await page.locator('.modal-bg.open').count();
              results.modals.push({name,action,visible,...await measure(page),evidence:await capture(page,`modal-1280x500-${name}`)});
            }catch(error){results.modals.push({name,action,executionError:error.message});}
          }
          await page.context().close();
        }
      } finally { for(const context of contexts)await context.close().catch(()=>{});await browser.close(); }
      flush();
    }
    results.fixtureUnchanged=fixture.unchanged();results.fixtureWrites=fixture.requests.writes;
  } finally { await fixture.close();results.completedAt=new Date().toISOString();flush(); }
  console.log(JSON.stringify({browsers:results.browsers,matrix:results.matrix.length,overflow:results.matrix.filter(x=>x.overflow).length,
    transitions:results.transitions.length,modals:results.modals.length,errors:results.errors.length}));
}

if(require.main===module) main().catch(error=>{results.fatal=error.stack;flush();console.error(error);process.exitCode=1;});
module.exports={richState,measure};
