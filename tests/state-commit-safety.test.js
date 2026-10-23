const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function isolated(t, script) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meufin-commit-'));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + 'meufin-commit-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, FIN_STORAGE_DIR: root }, encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

for (const encrypted of [false, true]) {
  test(`terminated writer preserves ${encrypted ? 'encrypted' : 'plain'} state and next commit prunes orphan generations`, t => {
    isolated(t, `
      const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
      const store=require('./server/app-state-store');
      const key=${encrypted} ? Buffer.alloc(32,8).toString('base64') : '';
      const before={finStateSchemaVersion:'3',finData:[{id:'janeiro_2026',renda:[{valor:123}]}]};
      store.writeUserAppState('synthetic',before,key);
      const file=store.getUserDataPath('synthetic');
      const crashed=spawnSync(process.execPath,['-e',
        'const fs=require("fs"),s=require("./server/app-state-store"),file=s.getUserDataPath("synthetic"),rename=fs.renameSync;fs.renameSync=(a,b)=>{if(b===file)process.exit(73);return rename(a,b)};s.writeUserAppState("synthetic",{finData:[{id:"future"}]},process.argv[1]);',key],
        {env:process.env,encoding:'utf8'});
      assert.equal(crashed.status,73);
      store.clearUserAppStateCache('synthetic');
      assert.deepEqual(store.readUserAppState('synthetic',key).state,before);
      const next={...before,finData:[{id:'fevereiro_2026',renda:[{valor:456}]}]};
      for(let i=0;i<8;i++)store.writeUserAppState('synthetic',next,key);
      const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
      const parts=path.join(path.dirname(file),'state-parts');
      assert.equal(fs.readdirSync(parts).filter(name=>name.endsWith('.json')).length,Object.keys(manifest.parts).length);
      const months=JSON.parse(fs.readFileSync(path.join(parts,manifest.parts.months.file),'utf8'));
      assert.equal(fs.readdirSync(path.join(parts,'months')).length,months.chunkCount);
      assert.deepEqual(store.readUserAppState('synthetic',key).state,next);
    `);
  });

  test(`legacy fixed filenames remain readable and can be saved safely: ${encrypted ? 'encrypted' : 'plain'}`, t => {
    isolated(t, `
      const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
      const store=require('./server/app-state-store');
      const key=${encrypted} ? Buffer.alloc(32,8).toString('base64') : '';
      const state={finStateSchemaVersion:'3',finData:[{id:'janeiro_2026',renda:[{valor:123}]}]};
      store.writeUserAppState('synthetic',state,key);
      const file=store.getUserDataPath('synthetic'),parts=path.join(path.dirname(file),'state-parts');
      const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
      for(const [name,meta] of Object.entries(manifest.parts)){
        const oldFile=path.join(parts,meta.file),nextFile=path.join(parts,name+'.json');
        if(name==='months'){
          const month=JSON.parse(fs.readFileSync(oldFile,'utf8'));
          for(const chunk of month.chunks){fs.renameSync(path.join(parts,'months',chunk.file),path.join(parts,'months',chunk.id+'.json'));chunk.file=chunk.id+'.json';}
          fs.writeFileSync(oldFile,JSON.stringify(month));
        }
        fs.renameSync(oldFile,nextFile);meta.file=name+'.json';
      }
      delete manifest.generation;
      fs.writeFileSync(file,JSON.stringify(manifest));
      store.clearUserAppStateCache('synthetic');
      assert.deepEqual(store.readUserAppState('synthetic',key).state,state);
      store.writeUserAppState('synthetic',state,key);
      assert.deepEqual(store.readUserAppState('synthetic',key).state,state);
    `);
  });
}

for (const encrypted of [false, true]) {
  for (const fault of ['chunk', 'part', 'manifest', 'windows', 'oversize', 'write', 'fsync', 'corruption']) {
    test(`failed ${fault} commit keeps previous ${encrypted ? 'encrypted' : 'plain'} state readable after restart`, t => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meufin-commit-'));
      t.after(() => {
        const resolved = fs.realpathSync(root);
        assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + 'meufin-commit-'));
        fs.rmSync(resolved, { recursive: true, force: true });
      });
      const script = `
        const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
        const { spawnSync } = require('node:child_process');
        const store = require('./server/app-state-store');
        const key = ${encrypted} ? Buffer.alloc(32, 8).toString('base64') : '';
        const before = { finStateSchemaVersion: '3', finData: [
          { id: 'janeiro_2025', nome: 'JANEIRO 2025', renda: [{ valor: 123 }] },
          { id: 'janeiro_2026', nome: 'JANEIRO 2026', renda: [{ valor: 456 }] }
        ], finPatrimonioAccounts: [{ id: 'synthetic', saldo: 789 }] };
        store.writeUserAppState('synthetic', before, key);
        const file = store.getUserDataPath('synthetic');
        const manifestBefore = fs.readFileSync(file, 'utf8');
        const next = JSON.parse(JSON.stringify(before)); next.finData[0].renda[0].valor = 999;
        const fault = ${JSON.stringify(fault)};
        if (fault === 'oversize') next.padding = 'x'.repeat(16 * 1024 * 1024);
        const rename = fs.renameSync;
        const write = fs.writeFileSync;
        const fsync = fs.fsyncSync;
        if (fault === 'write') fs.writeFileSync = () => { throw new Error('synthetic write fault'); };
        if (fault === 'corruption') fs.writeFileSync = (fd) => write(fd, '{}');
        if (fault === 'fsync') fs.fsyncSync = () => { throw new Error('synthetic fsync fault'); };
        let chunks = 0;
        fs.renameSync = (from, to) => {
          const target = String(to);
          const chunk = target.includes(path.sep + 'months' + path.sep) && target.endsWith('.json');
          const blocked = (fault === 'chunk' && chunk && ++chunks === 2)
            || (fault === 'part' && path.basename(target).startsWith('patrimonio'))
            || (['manifest', 'windows'].includes(fault) && target === file);
          if (blocked) throw Object.assign(new Error('synthetic disk fault'), { code: fault === 'windows' ? 'EPERM' : 'EIO' });
          return rename(from, to);
        };
        assert.throws(() => store.writeUserAppState('synthetic', next, key));
        fs.renameSync = rename;
        fs.writeFileSync = write;
        fs.fsyncSync = fsync;
        assert.equal(fs.readFileSync(file, 'utf8'), manifestBefore);
        const child = spawnSync(process.execPath, ['-e',
          'const s=require("./server/app-state-store");console.log(JSON.stringify(s.readUserAppState("synthetic",process.argv[1]).state))', key],
          { env: process.env, encoding: 'utf8' });
        assert.equal(child.status, 0, child.stderr);
        assert.deepEqual(JSON.parse(child.stdout), before);
      `;
      const result = spawnSync(process.execPath, ['-e', script], {
        cwd: path.resolve(__dirname, '..'), env: { ...process.env, FIN_STORAGE_DIR: root }, encoding: 'utf8', maxBuffer: 1024 * 1024
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
    });
  }
}
