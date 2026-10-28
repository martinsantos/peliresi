import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {execFileSync} from 'node:child_process';
import { compatible,proxyFor,safeArchiveEntries,inventory,activateWithRollback,loopbackIndex,
  digest,codeDigest,capturePrepared,assertPrepared,withPrepared } from './publisher.ts';

test('legacy publication jobs stay unconditionally retired while build/test jobs remain',()=>{
  const workflow=fs.readFileSync(new URL('../../../.github/workflows/deploy-production.yml',import.meta.url),'utf8');
  for(const job of ['deploy-frontend','deploy-backend']) {
    const block=workflow.split(`\n  ${job}:\n`)[1].split(/\n(?=  [a-z-]+:\n)/)[0];
    assert.match(block,/if: \$\{\{ false \}\}/);
  }
  for(const job of ['validate-backend','validate-frontend','validate-blockchain'])assert.match(workflow,new RegExp(`  ${job}:`));
});
test('Hostinger activation has no push event, no candidate default and explicit manual guards',()=>{
  const workflow=fs.readFileSync(new URL('../../../.github/workflows/hostinger-publication.yml',import.meta.url),'utf8');
  assert.doesNotMatch(workflow,/^  push:/m);
  assert.match(workflow,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/ACKNOWLEDGEMENT.*SITREP-HOSTINGER/);
  assert.match(workflow,/secrets\.HOSTINGER_MIGRATION_KEY/);
  assert.doesNotMatch(workflow,/secrets\.VPS_|23\.105\.176\.45/);
  assert.match(workflow,/release_commit:\n        type: string\n        required: false\n        description:/);
  assert.match(workflow,/default: preflight/);
  assert.match(workflow,/--input-type=module - preflight \$EXPECTED_ACTIVE/);
});
test('archive traversal, links and special files are rejected before extraction',()=>{
  safeArchiveEntries(['./backend/dist/index.js','./frontend/'],['-rw-r--r-- file','drwxr-xr-x directory']);
  for(const name of ['/etc/passwd','./../outside','./backend/../../outside','bad\nname'])assert.throws(()=>safeArchiveEntries([name],[]));
  for(const mode of ['lrwxrwxrwx link','hrw-r--r-- hardlink','crw------- device'])assert.throws(()=>safeArchiveEntries(['file'],[mode]));
});
test('only the already deployed loopback binding patch is permitted',()=>{
  const original='before\napp.listen(PORT, () => {\nafter';
  const expected="before\napp.listen(PORT, '127.0.0.1', () => {\nafter";
  assert.equal(loopbackIndex(original),expected);assert.equal(loopbackIndex(expected),expected);
  assert.throws(()=>loopbackIndex('different listen contract'));
  assert.throws(()=>loopbackIndex(original+'\n'+original));
});
test('schema and dependency drift require separate review',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sitrep-publisher-'));
  const dirs=['current','candidate'].map(name=>path.join(root,name));
  for(const folder of dirs) {fs.mkdirSync(path.join(folder,'prisma'),{recursive:true});for(const file of ['package.json','package-lock.json','prisma/schema.prisma'])fs.writeFileSync(path.join(folder,file),'same');}
  compatible(dirs[1],dirs[0]);fs.writeFileSync(path.join(dirs[1],'prisma/schema.prisma'),'different');
  assert.throws(()=>compatible(dirs[1],dirs[0]),/Separate dependency\/schema review/);
});
test('only SITREP static root changes in the complete ingress configuration',()=>{
  const original='server { root /old; location /app/ { alias /old/app/; } location /api { proxy_pass http://127.0.0.1:3002; } }';
  const updated=proxyFor(original,'/old','/new');
  assert.equal(updated.replaceAll('/new','/old'),original);
  assert.throws(()=>proxyFor('unrelated','/old','/new'));
});
test('failure after switching restores previous code without changing session configuration',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sitrep-rollback-'));
  const config=path.join(root,'environment');fs.writeFileSync(config,'private-session-fixture');
  let active='old';let restored=false;
  await assert.rejects(activateWithRollback(async()=>{active='new';},async()=>{throw new Error('injected public health failure');},async()=>{active='old';restored=true;}));
  assert.equal(active,'old');assert.equal(restored,true);assert.equal(fs.readFileSync(config,'utf8'),'private-session-fixture');
});
test('fingerprints retain exact file content and reject symlink imports',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sitrep-files-'));fs.writeFileSync(path.join(root,'file'),'one');
  const before=inventory(root);fs.writeFileSync(path.join(root,'file'),'two');assert.notDeepEqual(inventory(root),before);
  fs.writeFileSync(path.join(root,'__proto__'),'ordinary file');assert.equal(Object.hasOwn(inventory(root),'__proto__'),true);
  fs.symlinkSync('file',path.join(root,'link'));assert.throws(()=>inventory(root),/cannot contain links/);
});
test('packaging freezes web/app/manual and excludes runtime private files',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sitrep-package-'));const source=path.join(root,'source');
  for(const file of ['backend/dist/index.js','backend/package.json','backend/package-lock.json','backend/prisma/schema.prisma',
    'frontend/dist/index.html','frontend/dist/assets/main.js','frontend/dist-app/app.html','docs/manual/index.html','docs/screenshots/desktop/example.png']) {
    fs.mkdirSync(path.dirname(path.join(source,file)),{recursive:true});fs.writeFileSync(path.join(source,file),'fixture');
  }
  const builder=new URL('./package.ts',import.meta.url);const output=path.join(root,'bundle');
  execFileSync(process.execPath,['--experimental-strip-types',builder.pathname,source,output,'a'.repeat(40)],{stdio:'pipe'});
  const manifest=JSON.parse(fs.readFileSync(path.join(output,'release.json'),'utf8'));
  assert.equal(manifest.commit,'a'.repeat(40));assert.equal(manifest.databaseMigrations,false);
  assert.equal(manifest.format,2);
  assert.equal(execFileSync('tar',['-xOzf',path.join(output,'release.tar.gz'),'./.sitrep-release.json'],{encoding:'utf8'}).trim(),fs.readFileSync(path.join(output,'release.json'),'utf8').trim());
  assert.ok(manifest.files['frontend/app/app.html']);assert.ok(manifest.files['frontend/manual/screenshots/desktop/example.png']);
  fs.writeFileSync(path.join(source,'frontend/dist/.env'),'forbidden-synthetic-fixture');
  assert.throws(()=>execFileSync(process.execPath,['--experimental-strip-types',builder.pathname,source,path.join(root,'rejected'),'b'.repeat(40)],{stdio:'pipe'}));
});

function preparedFixture(): any {
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'sitrep-prepared-'));const source=path.join(base,'source');
  function put(file: string,content: string): void {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);}
  for(const file of ['backend/package.json','backend/package-lock.json','backend/prisma/schema.prisma'])put(path.join(source,file),'unchanged fixture');
  put(path.join(source,'backend/dist/index.js'),'new application\napp.listen(PORT, () => {\n');
  put(path.join(source,'frontend/dist/index.html'),'new index');put(path.join(source,'frontend/dist/assets/new.js'),'new asset');
  put(path.join(source,'frontend/dist-app/app.html'),'new app');
  const packageRoot=path.join(base,'built');const commit='a'.repeat(40);const preparedRun='1-1';
  execFileSync(process.execPath,['--experimental-strip-types',new URL('./package.ts',import.meta.url).pathname,source,packageRoot,commit],{stdio:'pipe'});
  const bundle=digest(fs.readFileSync(path.join(packageRoot,'release.tar.gz')));
  const incoming=path.join(base,'incoming',preparedRun);fs.mkdirSync(incoming,{recursive:true});
  for(const file of ['release.tar.gz','release.json'])fs.copyFileSync(path.join(packageRoot,file),path.join(incoming,file));
  const root=path.join(base,'staged',`${commit}-${bundle}`);fs.mkdirSync(root,{recursive:true});
  fs.cpSync(path.join(packageRoot,'tree'),path.join(root,'package'),{recursive:true});
  const oldBackend=path.join(base,'current/backend');fs.cpSync(path.join(source,'backend'),oldBackend,{recursive:true});
  put(path.join(oldBackend,'dist/index.js'),"old application\napp.listen(PORT, '127.0.0.1', () => {\n");
  for(const name of ['node_modules','data','uploads'])fs.mkdirSync(path.join(oldBackend,name));
  const oldFrontend=path.join(base,'current/frontend');put(path.join(oldFrontend,'index.html'),'old index');
  put(path.join(oldFrontend,'app/app.html'),'old app');put(path.join(oldFrontend,'assets/old.js'),'old asset');
  const original=`server { root ${oldFrontend}; location /app/ { alias ${oldFrontend}/app/; } location /api { proxy_pass http://127.0.0.1:3002; } }`;
  const before={revision:'b'.repeat(40),backend:oldBackend,frontend:oldFrontend,codeDigest:codeDigest(oldBackend),
    frontendDigest:digest(JSON.stringify(inventory(oldFrontend))),proxyHash:digest(original)};
  const destination=path.join(base,'releases',`${commit}-${preparedRun}`);fs.mkdirSync(destination,{recursive:true});
  const backend=path.join(destination,'backend');fs.cpSync(path.join(root,'package/backend'),backend,{recursive:true});
  put(path.join(backend,'dist/index.js'),loopbackIndex(fs.readFileSync(path.join(backend,'dist/index.js'),'utf8')));
  for(const name of ['node_modules','data','uploads'])fs.symlinkSync(fs.realpathSync(path.join(oldBackend,name)),path.join(backend,name),'dir');
  const frontend=path.join(destination,'frontend');fs.cpSync(oldFrontend,frontend,{recursive:true});
  fs.cpSync(path.join(root,'package/frontend'),frontend,{recursive:true});
  const rollback=path.join(destination,'rollback-frontend');fs.cpSync(frontend,rollback,{recursive:true});fs.cpSync(oldFrontend,rollback,{recursive:true});
  put(path.join(rollback,'release.json'),JSON.stringify({commit:before.revision})+'\n');
  put(path.join(root,'candidate.conf'),proxyFor(original,oldFrontend,frontend));
  put(path.join(root,'rollback.conf'),proxyFor(original,oldFrontend,rollback));
  const ready:any={commit,bundle,preparedRun,before,backend,frontend,rollback,destination};
  ready.artifacts=capturePrepared(ready,root);
  return {base,ready,root,bundle,original};
}

test('prepared integrity admits only the sealed normalized payload and preserved runtime links',()=>{
  const fixture=preparedFixture();let backups=0;
  withPrepared(fixture.ready,fixture.root,fixture.bundle,fixture.original,()=>{backups++;});
  assert.equal(backups,1);
});

test('post-prepare artifact tampering cannot reach backup or restart',async(t)=>{
  const mutations:Record<string,(f:any)=>void>={
    'normalized backend':f=>fs.appendFileSync(path.join(f.ready.backend,'dist/index.js'),'tampered'),
    'extra backend environment':f=>fs.writeFileSync(path.join(f.ready.backend,'.env'),'synthetic tamper'),
    'frontend':f=>fs.appendFileSync(path.join(f.ready.frontend,'index.html'),'tampered'),
    'rollback frontend':f=>fs.appendFileSync(path.join(f.ready.rollback,'index.html'),'tampered'),
    'candidate proxy':f=>fs.appendFileSync(path.join(f.root,'candidate.conf'),'tampered'),
    'rollback proxy':f=>fs.appendFileSync(path.join(f.root,'rollback.conf'),'tampered'),
    'reviewed bundle':f=>fs.appendFileSync(path.join(f.base,'incoming/1-1/release.tar.gz'),'tampered'),
    'external manifest':f=>fs.appendFileSync(path.join(f.base,'incoming/1-1/release.json'),'tampered'),
    'extracted source':f=>fs.appendFileSync(path.join(f.root,'package/backend/dist/index.js'),'tampered'),
  };
  for(const name of ['node_modules','data','uploads'])mutations[`runtime link ${name}`]=f=>{
    fs.renameSync(path.join(f.ready.backend,name),path.join(f.base,`retained-${name}-link`));
    const other=path.join(f.base,`other-${name}`);fs.mkdirSync(other);fs.symlinkSync(other,path.join(f.ready.backend,name),'dir');
  };
  for(const [name,mutate] of Object.entries(mutations))await t.test(name,()=>{
    const f=preparedFixture();mutate(f);const calls={backup:0,restart:0};
    assert.throws(()=>withPrepared(f.ready,f.root,f.bundle,f.original,()=>{calls.backup++;calls.restart++;}));
    assert.deepEqual(calls,{backup:0,restart:0});
  });
});

test('the activation gate rejects changes made while the database backup was running',()=>{
  const f=preparedFixture();let backups=0;let restarts=0;
  withPrepared(f.ready,f.root,f.bundle,f.original,()=>{backups++;fs.appendFileSync(path.join(f.ready.frontend,'index.html'),'changed during backup');});
  assert.throws(()=>withPrepared(f.ready,f.root,f.bundle,f.original,()=>{restarts++;}));
  assert.equal(backups,1);assert.equal(restarts,0);
});

test('rewriting snapshot checksums cannot bless code or configs that differ from the reviewed bundle',()=>{
  for(const target of ['backend','frontend','proxy','link']) {
    const f=preparedFixture();
    if(target==='backend')fs.appendFileSync(path.join(f.ready.backend,'dist/index.js'),'forged payload');
    else if(target==='frontend')fs.appendFileSync(path.join(f.ready.frontend,'index.html'),'forged payload');
    else if(target==='proxy')fs.appendFileSync(path.join(f.root,'candidate.conf'),'forged config');
    else {
      fs.renameSync(path.join(f.ready.backend,'data'),path.join(f.base,'retained-data-link'));
      const other=path.join(f.base,'other-data');fs.mkdirSync(other);fs.symlinkSync(other,path.join(f.ready.backend,'data'),'dir');
    }
    f.ready.artifacts=capturePrepared(f.ready,f.root);let restarted=false;
    assert.throws(()=>withPrepared(f.ready,f.root,f.bundle,f.original,()=>{restarted=true;}));
    assert.equal(restarted,false);
  }
});
