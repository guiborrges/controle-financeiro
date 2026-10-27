'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium, devices } = require('playwright');
const { measure } = require('./audit-responsive');

const root=path.resolve(__dirname,'..');
const output=process.env.MEUFIN_AUDIT_OUTPUT || path.join(root,'docs/auditoria-responsividade/evidencias');
const result={startedAt:new Date().toISOString(),scope:'real local Express, isolated synthetic storage, SMTP disabled',checks:[],errors:[],screens:[]};
function save(){fs.writeFileSync(path.join(output,'resultados-fluxos.json'),JSON.stringify(result,null,2));}
async function main(){
  fs.mkdirSync(output,{recursive:true});
  const storage=fs.mkdtempSync(path.join(os.tmpdir(),'meufin-responsive-audit-'));
  const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  const env={...process.env};
  if(fs.existsSync(path.join(root,'.env'))) for(const line of fs.readFileSync(path.join(root,'.env'),'utf8').split(/\r?\n/)){
    const key=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];if(key)env[key]='';
  }
  Object.assign(env,{NODE_ENV:'test',PORT:String(port),FIN_STORAGE_DIR:storage,FIN_STATE_BACKEND:'json',
    FIN_SESSION_SECRET:'synthetic-responsive-audit-session-secret',FIN_PASSWORD_RECOVERY_SECRET:'synthetic-responsive-audit-recovery-secret',
    FIN_REMEMBER_TOKEN_SECRET:'synthetic-responsive-audit-remember-secret',SMTP_HOST:'',SMTP_USER:'',SMTP_PASS:'',
    TELEGRAM_BOT_TOKEN:'',ORACLE_DB_USER:'',PLUGGY_API_KEY:'',PLUGGY_CLIENT_ID:'',PLUGGY_CLIENT_SECRET:''});
  const child=spawn(process.execPath,['server.js'],{cwd:root,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  let logs='';child.stdout.on('data',x=>{logs+=x;});child.stderr.on('data',x=>{logs+=x;});
  const origin=`http://127.0.0.1:${port}`;
  let browser;
  const check=async(name,fn,method='UI')=>{
    try{const details=await fn();result.checks.push({name,status:'passed',method,details});console.log(`PASS ${name}`);}
    catch(error){result.checks.push({name,status:'failed',method,error:error.message});console.log(`FAIL ${name}: ${error.message.slice(0,180)}`);}
    save();
  };
  const shot=async(page,name)=>{const file=`flow-${name}.png`;await page.screenshot({path:path.join(output,file),animations:'disabled'});result.screens.push(file);return file;};
  const expect=(value,message)=>{if(!value)throw Error(message);};
  try{
    let ready=false;
    for(let i=0;i<80;i++){await new Promise(r=>setTimeout(r,200));try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}}
    if(!ready)throw Error('Local server unavailable: '+logs.slice(-800));
    browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const newPage=async(mobile=false)=>{
      const context=await browser.newContext(mobile?{...devices['Pixel 7'],viewport:{width:390,height:844}}:{viewport:{width:1280,height:720}});
      await context.route('**/*',route=>{
        const url=route.request().url();
        if(url.startsWith(origin))return route.continue();
        if(url.includes('chart.umd.js'))return route.fulfill({body:fs.readFileSync(path.join(root,'tmp/m01-preview/vendor/chart.umd.js')),contentType:'application/javascript'});
        if(url.includes('fuse.min.js'))return route.fulfill({body:fs.readFileSync(path.join(root,'tmp/m01-preview/vendor/fuse.min.js')),contentType:'application/javascript'});
        return route.abort();
      });
      const page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',error=>result.errors.push(error.message));
      await page.addInitScript(()=>document.addEventListener('appReady',()=>{window.__auditAppReady=true;},{once:true}));
      page.on('response',response=>{if(response.status()>=400&&response.url().startsWith(origin)){(result.httpErrors||=[]).push({status:response.status(),path:new URL(response.url()).pathname});}});
      page.on('dialog',dialog=>dialog.accept());
      await page.goto(origin+'/login');return page;
    };
    const password='Synthetic-Audit-2026!';
    const changed='Synthetic-Audit-Changed-2026!';
    const resetPassword='Synthetic-Audit-Reset-2026!';
    const emails=['responsive-a@example.invalid','responsive-b@example.invalid'];
    const fillRegister=async(page,index)=>{
      for(const [id,value] of Object.entries({registerFullName:`Pessoa Ficticia Responsiva ${index}`,registerEmail:emails[index],
        registerPhone:'(11) 99999-8888',registerBirthDate:'01/01/1990',registerPassword:password,registerPasswordHint:'Somente teste'}))await page.locator('#'+id).fill(value);
    };
    const login=async(page,email,secret)=>{
      await page.goto(origin+'/login');await page.locator('#emailInput').fill(email);await page.locator('#passwordInput').fill(secret);
      await page.locator('#rememberMeInput').check();await page.locator('#loginForm button[type=submit]').click();
      await page.waitForURL('**/app',{timeout:20000});await page.waitForFunction(()=>typeof getCurrentMonth==='function'&&!!getCurrentMonth());
    };
    const logout=async page=>page.evaluate(async()=>{const session=await fetch('/api/auth/session').then(r=>r.json());const r=await fetch('/api/auth/logout',{method:'POST',headers:{'X-CSRF-Token':session.csrfToken||currentSession.csrfToken,'Content-Type':'application/json'},body:'{}'});return r.status;});
    const desktop=await newPage();
    await check('register required fields',async()=>{
      await desktop.locator('#registerToggle').click();await desktop.locator('#registerForm button[type=submit]').click();
      expect((await desktop.locator('#registerError').textContent()).length>0,'No validation message');
    });
    await check('register invalid email and short password',async()=>{
      await fillRegister(desktop,0);await desktop.locator('#registerEmail').fill('invalid');await desktop.locator('#registerForm button[type=submit]').click();
      const emailError=await desktop.locator('#registerError').textContent();expect(emailError.length>0,'Missing email error');
      await desktop.locator('#registerEmail').fill(emails[0]);await desktop.locator('#registerPassword').fill('123');
      await desktop.locator('#registerForm button[type=submit]').click();expect((await desktop.locator('#registerError').textContent()).length>0,'Missing password error');
      return {emailError};
    });
    await check('register Desktop through real server',async()=>{
      await fillRegister(desktop,0);await desktop.locator('#registerForm button[type=submit]').click();
      await desktop.waitForURL('**/app',{timeout:20000});await desktop.waitForFunction(()=>typeof getCurrentMonth==='function'&&!!getCurrentMonth());
      expect(await desktop.evaluate(()=>getAllFinanceMonths().every(m=>!(m.outflows||[]).length)),'New account inherited financial rows');
      return {evidence:await shot(desktop,'first-access-desktop'),geometry:await measure(desktop)};
    });
    if(!desktop.url().endsWith('/app')){
      result.blocked='Authenticated scenarios blocked by local registration/session failure';
      result.serverErrorKinds=[...new Set((logs.match(/EPERM|EACCES|ENOENT|session-file-store|Error: [^\r\n]+/g)||[]))];return;
    }
    const mobile=await newPage(true);
    await check('register Mobile through real server',async()=>{
      await mobile.locator('#registerToggle').click();await fillRegister(mobile,1);await mobile.locator('#registerForm button[type=submit]').click();
      await mobile.waitForURL('**/app',{timeout:20000});await mobile.waitForFunction(()=>!!window.MobileV2?.isEnabled?.());
      return {evidence:await shot(mobile,'first-access-mobile'),geometry:await measure(mobile)};
    });
    await check('Desktop page refresh keeps session',async()=>{await desktop.reload();await desktop.waitForFunction(()=>typeof getCurrentMonth==='function'&&!!getCurrentMonth());expect(desktop.url().endsWith('/app'),'Session lost');});
    const checkRemember=(secret=resetPassword)=>check('remember cookie restores a removed session cookie',async()=>{
      await logout(desktop);await login(desktop,emails[0],secret);
      const cookies=await desktop.context().cookies();expect(cookies.some(c=>c.name==='fin.remember'),'Remember cookie absent');
      await desktop.context().clearCookies({name:'fin.sid'});
      const staleWrite=await desktop.evaluate(async()=>{
        const r=await fetch('/api/backups/auto-exit',{method:'POST',headers:getCsrfHeaders({'Content-Type':'application/json'}),body:'{}'});
        return r.status;
      });
      expect(staleWrite===401,`Old-page write restored a competing session: ${staleWrite}`);
      expect(!(await desktop.context().cookies()).some(c=>c.name==='fin.sid'),'Old-page write minted a session cookie');
      await desktop.reload();
      await desktop.waitForFunction(()=>typeof getCurrentMonth==='function'&&!!getCurrentMonth());expect(desktop.url().endsWith('/app'),'Remember did not restore session');
      return {cookieValuesRedacted:true};
    },'UI login + isolated cookie removal');
    if(process.env.MEUFIN_AUDIT_REMEMBER_FIRST==='1')await checkRemember(password);
    await check('profile form saves and survives reload',async()=>{
      await desktop.evaluate(()=>nav('perfil'));await desktop.locator('#profileDisplayName').fill('Pessoa Auditada');
      await desktop.locator('button[onclick="saveProfile()"]').click();
      await desktop.waitForFunction(()=>document.body.textContent.includes('Dados atualizados com sucesso.'));
      await desktop.reload();await desktop.waitForFunction(()=>typeof nav==='function');await desktop.evaluate(()=>nav('perfil'));
      await desktop.waitForFunction(()=>document.getElementById('profileDisplayName')?.value==='Pessoa Auditada');
      await desktop.waitForFunction(()=>window.__auditAppReady===true);
    });
    await check('create income through actual form and persistence',async()=>{
      await desktop.evaluate(()=>{nav('mes');openAddItem('renda');});
      await desktop.locator('#fi_nome').fill('Salario de auditoria');await desktop.locator('#fi_valor').fill('5000');
      await desktop.locator('#fi_recebimento').fill('10/11/26');await desktop.locator('#modalItem button[onclick="saveItem()"]').click();
      await desktop.locator('#modalItem').waitFor({state:'hidden'});await desktop.waitForTimeout(700);
      const incomeSaved=await desktop.evaluate(()=>flushServerStorage(true));
      expect(incomeSaved, 'Income not persisted: '+JSON.stringify(await desktop.evaluate(()=>({conflict:storageWriteConflictDetected,pending:storageSyncPending,dirty:[...storageDirtyKeys],recoveryDirty:pendingRecoverySnapshot?.dirtyKeys,status:document.getElementById('appStatusMessage')?.textContent}))));
      await desktop.reload();await desktop.waitForFunction(()=>typeof getCurrentMonth==='function'&&!!getCurrentMonth());
      expect(await desktop.evaluate(()=>getCurrentMonth().renda.some(r=>r.fonte==='Salario de auditoria'&&r.valor===5000)),'Income missing after reload');
    });
    await check('create, edit and cancel actual expense form',async()=>{
      await desktop.evaluate(()=>{nav('mes');openUnifiedOutflowModal();});
      await desktop.locator('#unifiedOutflowDescription').fill('Compra responsiva ficticia');await desktop.locator('#unifiedOutflowAmount').fill('123.45');
      await desktop.locator('#unifiedOutflowDate').fill('23/10/26');await desktop.locator('#unifiedOutflowCategory').selectOption({index:1});
      await desktop.locator('#unifiedOutflowOutput').selectOption('method:pix');await desktop.locator('#unifiedOutflowSubmitBtn').click();
      await desktop.waitForFunction(()=>getCurrentMonth().outflows.some(x=>x.description==='Compra responsiva ficticia'));
      await desktop.evaluate(()=>flushServerStorage(true));
      const id=await desktop.evaluate(()=>getCurrentMonth().outflows.find(x=>x.description==='Compra responsiva ficticia').id);
      await desktop.evaluate(id=>openUnifiedOutflowModal(id),id);await desktop.locator('#unifiedOutflowAmount').fill('150.55');
      await desktop.locator('#unifiedOutflowSubmitBtn').click();await desktop.locator('#modalUnifiedOutflow').waitFor({state:'hidden'});
      await desktop.evaluate(id=>openUnifiedOutflowModal(id),id);await desktop.locator('#unifiedOutflowAmount').fill('999');
      await desktop.evaluate(()=>closeUnifiedOutflowModal());expect(await desktop.evaluate(id=>getCurrentMonth().outflows.find(x=>x.id===id).amount,id)===150.55,'Cancel changed amount');
      await desktop.reload();await desktop.waitForFunction(()=>typeof getCurrentMonth==='function'&&!!getCurrentMonth());
      expect(await desktop.evaluate(id=>getCurrentMonth().outflows.find(x=>x.id===id)?.amount,id)===150.55,'Edit did not persist');
      return {amount:150.55};
    });
    await check('two synthetic accounts remain isolated after reload',async()=>{
      if(!mobile.url().endsWith('/app'))throw Error('Mobile signup not available');
      await mobile.reload();await mobile.waitForFunction(()=>typeof getCurrentMonth==='function'&&!!getCurrentMonth());
      expect(await mobile.evaluate(()=>getAllFinanceMonths().every(m=>!(m.outflows||[]).length)),'Other user received records');
    });
    await check('theme persists after reload',async()=>{
      await desktop.evaluate(()=>toggleThemePreference(true));await desktop.reload();
      await desktop.waitForFunction(()=>document.documentElement.getAttribute('data-theme')==='dark'&&typeof getBackupSessionUserId==='function'&&!!currentSession?.csrfToken);return {evidence:await shot(desktop,'theme-persistence')};
    });
    await check('manual backup real route',async()=>{
      const response=await desktop.evaluate(async()=>{const r=await fetch('/api/backups/manual',{method:'POST',headers:getCsrfHeaders({'Content-Type':'application/json'}),body:JSON.stringify({note:'Auditoria ficticia responsiva'})});return {status:r.status,body:await r.json()};});
      expect(response.status===200,JSON.stringify(response));return {status:response.status,hasBackup:!!response.body};
    },'API authenticated browser session');
    await check('restore synthetic backup via actual file input and reload',async()=>{
      const snapshot=await desktop.evaluate(()=>({format:'fin_backup_v2',userId:getBackupSessionUserId(),appState:buildBackupStateSnapshotFromRuntime()}));
      await desktop.evaluate(async()=>{getCurrentMonth().renda[0].valor=777;await save(true);});
      await desktop.locator('#importInput').setInputFiles({name:'synthetic-audit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(snapshot))});
      await desktop.waitForFunction(()=>getCurrentMonth().renda.some(r=>r.valor===5000));await desktop.evaluate(()=>flushServerStorage(true));
      await desktop.reload();await desktop.waitForFunction(()=>typeof getCurrentMonth==='function'&&!!getCurrentMonth());
      expect(await desktop.evaluate(()=>getCurrentMonth().renda.some(r=>r.valor===5000)),'Restored income missing');
    },'UI file input + real isolated persistence');
    await check('second tab stale revision is rejected',async()=>{
      const second=await desktop.context().newPage();await second.goto(origin+'/app');await second.waitForFunction(()=>typeof getCurrentMonth==='function'&&!!getCurrentMonth());
      await desktop.evaluate(async()=>{getCurrentMonth().obs='Alteracao ficticia de auditoria';await save(true);});
      const status=await second.evaluate(async()=>{const r=await fetch('/api/app-state',{method:'PUT',headers:getCsrfHeaders({'Content-Type':'application/json'}),body:JSON.stringify({state:serverStorageCache,baseRevision:serverStateRevision})});return r.status;});
      expect(status===409,`Expected 409, received ${status}`);await second.close();return {status};
    },'API authenticated browser session');
    await check('change password and login again',async()=>{
      const response=await desktop.evaluate(async({old,next})=>{const r=await fetch('/api/profile/change-password',{method:'POST',headers:getCsrfHeaders({'Content-Type':'application/json'}),body:JSON.stringify({currentPassword:old,newPassword:next,confirmPassword:next})});return {status:r.status,body:await r.json()};},{old:password,next:changed});
      expect(response.status===200,JSON.stringify(response));await logout(desktop);await login(desktop,emails[0],changed);
    },'API password change + UI login');
    await check('logout and wrong login',async()=>{
      expect(await logout(desktop)===200,'Logout failed');await desktop.goto(origin+'/login');
      await desktop.locator('#emailInput').fill(emails[0]);await desktop.locator('#passwordInput').fill('invalid-password');
      await desktop.locator('#loginForm button[type=submit]').click();await desktop.locator('#loginError').filter({hasText:/inv/i}).waitFor();
    });
    await check('duplicate signup is rejected',async()=>{
      await desktop.locator('#registerToggle').click();await fillRegister(desktop,0);await desktop.locator('#registerForm button[type=submit]').click();
      await desktop.waitForFunction(()=>!!document.getElementById('registerError').textContent);await shot(desktop,'duplicate-signup');await desktop.locator('#registerClose').click();
    });
    await check('invalid recovery token is rejected',async()=>{
      await desktop.locator('#forgotToggle').click();await desktop.locator('#forgotEmailInput').fill(emails[0]);
      await desktop.locator('#resetTokenInput').fill('invalid-token');await desktop.locator('#resetPasswordInput').fill(resetPassword);
      await desktop.locator('#resetConfirmPasswordInput').fill(resetPassword);await desktop.locator('#resetPasswordButton').click();
      await desktop.waitForFunction(()=>/invalido|expirado/i.test(document.getElementById('forgotFeedback').textContent));
    });
    await check('local recovery request and reset without external email',async()=>{
      await desktop.locator('#sendResetEmailButton').click();
      for(let i=0;i<40&&!/resetToken=|token=/.test(logs);i++)await new Promise(r=>setTimeout(r,100));
      const link=logs.match(/http[^\s'"<>]+(?:resetToken|token)=[^\s'"<>]+/)?.[0];
      if(!link)throw Error('No local recovery transport captured');
      const parsed=new URL(link);const token=parsed.searchParams.get('resetToken')||parsed.searchParams.get('token');
      expect(!!token,'Token missing from local transport');
      await desktop.locator('#resetTokenInput').fill(token);await desktop.locator('#resetPasswordButton').click();
      await desktop.waitForFunction(()=>/redefinida|alterada|sucesso/i.test(document.getElementById('forgotFeedback').textContent));
      await login(desktop,emails[0],resetPassword);return {transport:'local server output, SMTP disabled',tokenRedacted:true};
    });
    for(const [page,name] of [[desktop,'desktop'],[mobile,'mobile']]) {
      await check(`real ${name} screen and resize preserve data`,async()=>{
        if(!page.url().endsWith('/app'))throw Error('No authenticated session');
        const before=await page.evaluate(()=>JSON.stringify(getAllFinanceMonths().map(m=>({id:m.id,renda:m.renda,outflows:m.outflows}))));
        for(const width of [1280,900,768,640,390,320,1280])await page.setViewportSize({width,height:720});
        const after=await page.evaluate(()=>JSON.stringify(getAllFinanceMonths().map(m=>({id:m.id,renda:m.renda,outflows:m.outflows}))));
        expect(before===after,'Financial data changed on resize');return {dataUnchanged:true};
      });
    }
    result.noExternalEmail=true;result.syntheticAccounts=2;
    if(process.env.MEUFIN_AUDIT_REMEMBER_FIRST!=='1')await checkRemember();
  } finally {
    if(browser)await browser.close();child.kill();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));
    result.completedAt=new Date().toISOString();save();
  }
  console.log(JSON.stringify({passed:result.checks.filter(x=>x.status==='passed').length,failed:result.checks.filter(x=>x.status==='failed').length}));
  if(result.blocked||result.fatal||result.checks.some(x=>x.status==='failed')||result.errors.length)process.exitCode=1;
}
if(require.main===module)main().catch(error=>{result.fatal=error.message;save();console.error(error.message);process.exitCode=1;});
