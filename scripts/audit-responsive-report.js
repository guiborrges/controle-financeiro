'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const folder=path.resolve('docs/auditoria-responsividade');
const ev=process.env.MEUFIN_AUDIT_OUTPUT || path.join(folder,'evidencias');
const r=JSON.parse(fs.readFileSync(path.join(ev,'resultados-visuais.json')));
const extra=JSON.parse(fs.readFileSync(path.join(ev,'resultados-complementares.json')));
const flow=JSON.parse(fs.readFileSync(path.join(ev,'resultados-fluxos.json')));
const sizes=new Map();
for(const x of r.matrix){const k=`${x.input}|${x.width}|${x.height}`;if(!sizes.has(k))sizes.set(k,[]);sizes.get(k).push(x);}
let md='# Matriz de resolucoes e ambientes\n\n';
md+='Referencia: `'+r.commit+'`. Resultados locais sinteticos, nao homologacao da conta online.\n\n';
md+='## Navegadores\n\n| Navegador | Versao executada | Amostra principal |\n|---|---|---:|\n';
for(const b of r.browsers)md+=`| ${b.engine} | ${b.version||b.status} | ${r.matrix.filter(x=>x.engine===b.engine).length} medicoes |\n`;
md+='\nChrome teve Dashboard, Mes, Patrimonio e Historico; demais engines, subconjunto do Dashboard. Ambos os temas. WebKit Windows nao e Safari macOS/iOS. UA/toque sao emulacao, nao aparelho fisico.\n\n';
md+='## Viewports CSS efetivamente medidas\n\n| Entrada | Largura | Altura | Registros | Engines | Overflow do documento nessa amostra |\n|---|---:|---:|---:|---|---|\n';
for(const values of sizes.values()){const x=values[0];md+=`| ${x.input} | ${x.width} | ${x.height} | ${values.length} | ${[...new Set(values.map(v=>v.engine))].join(', ')} | ${values.some(v=>v.overflow)?'Sim, consultar JSON':'Nao detectado; nao e aprovacao funcional'} |\n`;}
md+='\nA mesma pagina foi reutilizada entre tamanhos na matriz: a ordem importa. Nao sao todas cargas novas. Algumas larguras em toque podem refletir expansao da viewport por conteudo; a tabela usa `innerWidth` observado, e as configuracoes solicitadas estao no script.\n\n';
md+='## Rodadas adicionais\n\n';
md+=`- Matriz principal: ${r.matrix.length} medicoes, ${r.transitions.length} transicoes com navegacao/render, ${r.extremes.length} extremos.\n`;
md+=`- Complementar: ${extra.resize.length} transicoes sem nav entre tamanhos, ${extra.dialogs.length} aberturas, ${extra.periods.length} filtros, ${extra.extremes.length} extremos verificados apos splash, ${extra.zoom.length} fatores de zoom real.\n`;
md+=`- Fluxos locais finais: ${flow.checks.filter(x=>x.status==='passed').length} checks passaram; ${flow.checks.filter(x=>x.status==='failed').length} falharam. Conferir status por linha; sequencia exploratoria remember preservada separadamente.\n`;
md+='\n## Limites da matriz\n\nSem baseline visual aprovado. Sem aparelhos fisicos, Safari real, teclado virtual real, leitor de tela ou PWA instalado. Janela dividida/barra lateral do navegador foram representadas por reducao de area CSS, nao pelo acionamento da interface nativa do Windows. Dobravavel foi representado por viewports intermediarias e orientacoes, sem emulacao de hinge/segmentos. Fontes remotas bloqueadas.\n';
fs.writeFileSync(path.join(folder,process.env.MEUFIN_AUDIT_OUTPUT?'16-matriz-validacao.md':'02-matriz-de-resolucoes.md'),md);
const checks=[];
function check(name,fn){try{const details=fn();checks.push({name,status:'passed',details});}catch(e){checks.push({name,status:'failed',error:e.message});}}
check('normal fixture monthly totals in matrix',()=>{for(const x of r.matrix)assert.deepEqual(x.totals,[5500,1400,3700]);return {records:r.matrix.length};});
check('normal Desktop line series equal independent fixture constants',()=>{let count=0;for(const x of r.matrix){const c=x.canvases.find(c=>c.id==='lineChart');if(!c)continue;for(const d of c.datasets){const expected={resultSimple:3700,totalGastos:1400,totalGanhos:5500}[d.seriesKey];assert.notEqual(expected,undefined);for(const value of d.data)assert.equal(value,expected);count++;}}return {series:count};});
check('Mobile period totals include goals',()=>{for(const x of extra.periods){assert.equal(x.error,undefined);const n=x.period==='custom'?12:Number(x.period);const fmt=v=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2}).format(v);for(const v of [5500*n,1400*n,3700*n])assert.ok(x.text.includes(fmt(v)),x.period+': '+v);}return {periods:extra.periods.length};});
check('real zoom factors match requested',()=>{assert.equal(extra.zoom.length,5);for(const x of extra.zoom)assert.ok(Math.abs(x.actual-x.factor)<.001);return {factors:extra.zoom.map(x=>x.factor)};});
check('visual fixtures and JavaScript errors',()=>{assert.equal(r.fixtureUnchanged,true);assert.equal(r.fixtureWrites,0);assert.equal(r.errors.length,0);assert.equal(extra.errors.length,0);});
if(process.env.MEUFIN_AUDIT_OUTPUT){
 check('corrected matrix, continuous resize and real zoom stay within viewport',()=>{for(const record of [...r.matrix,...extra.resize,...extra.zoom])assert.equal(record.overflow,false,`${record.width} ${record.screen||''}`);});
 check('Mobile transition follows the layout breakpoint in both directions',()=>{for(const record of extra.resize.filter(x=>x.touch))assert.equal(record.mobile,record.width<=900);});
 check('real functional checks pass after remember restoration',()=>{assert.equal(flow.checks.length,21);assert.ok(flow.checks.every(x=>x.status==='passed'));assert.equal(flow.errors.length,0);});
}
fs.writeFileSync(path.join(ev,'verificacao-dados.json'),JSON.stringify({checks,knownLayoutFailures:r.matrix.filter(x=>x.overflow).map(x=>({engine:x.engine,screen:x.screen,width:x.width,theme:x.theme})),notFullFinancialCertification:true},null,2));
const files=fs.readdirSync(ev).filter(f=>!f.endsWith('manifesto.json')).sort().map(file=>{const b=fs.readFileSync(path.join(ev,file));return {file,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});
fs.writeFileSync(path.join(ev,'manifesto.json'),JSON.stringify({commit:r.commit,files},null,2));
console.log(JSON.stringify({checks,files:files.length,bytes:files.reduce((a,x)=>a+x.bytes,0)}));
if(checks.some(x=>x.status==='failed'))process.exitCode=1;
