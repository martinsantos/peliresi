import { test } from 'node:test';
// Release-specific tests use exact schema fixtures declared at the end of this file.
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import { compatible,proxyFor,safeArchiveEntries,inventory,activateWithRollback,loopbackIndex,
  digest,codeDigest,capturePrepared,assertPrepared,withPrepared,
  REVIEWED_REVISION,REVIEWED_BACKEND_REVISION,REVIEWED_FILES,REVIEWED_MIGRATION,
  assertReviewedHashes,migrations,assertAcknowledgement,assertMigrationPending,migrationTransaction,
  nativeLinks,backedActivation,migrationOutcome } from './publisher.ts';

function schemaManifest(): any {return {format:3,databaseMigrations:[{name:REVIEWED_MIGRATION.name,sha256:REVIEWED_MIGRATION.sha256}],schemaSha256:REVIEWED_MIGRATION.afterSchema};}
function put(file: string,text: string): void {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function fakePrisma(root: string,value: string,schema: string): void {
  put(path.join(root,'client/package.json'),JSON.stringify({main:'index.js'}));
  put(path.join(root,'client/index.js'),"module.exports=require('.prisma/client');");
  put(path.join(root,'generated/index.js'),`module.exports=${JSON.stringify(value)};`);
  put(path.join(root,'generated/default.js'),"module.exports=require('./index');");
  put(path.join(root,'generated/schema.prisma'),schema);
  put(path.join(root,'generated/libquery_engine-debian-openssl-3.0.x.so.node'),'synthetic engine, not loaded');
}
function schemaFixture(): {root:string;current:string;candidate:string} {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sitrep-schema-'));
  const current=path.join(root,'current'),candidate=path.join(root,'candidate');
  for(const folder of [current,candidate])for(const file of ['package.json','package-lock.json'])put(path.join(folder,file),'{}');
  put(path.join(current,'prisma/schema.prisma'),BEFORE_SCHEMA);
  put(path.join(candidate,'prisma/schema.prisma'),AFTER_SCHEMA);
  put(path.join(candidate,'prisma/migrations',REVIEWED_MIGRATION.name,'migration.sql'),MIGRATION_SQL);
  fakePrisma(path.join(candidate,'runtime-prisma'),'new-client',AFTER_SCHEMA);
  return {root,current,candidate};
}
test('baseline admits only verified component identities and every pinned file hash',()=>{
  const release={webSource:REVIEWED_REVISION,appSource:REVIEWED_REVISION,backendSource:REVIEWED_BACKEND_REVISION,manualSource:REVIEWED_BACKEND_REVISION};
  assert.equal(Object.keys(REVIEWED_FILES.backend).length,442);
  assert.equal(Object.keys(REVIEWED_FILES.frontend).length,869);
  assertReviewedHashes(release,REVIEWED_FILES.backend,REVIEWED_FILES.frontend);
  for(const component of Object.keys(release))assert.throws(()=>assertReviewedHashes({...release,[component]:'8'.repeat(40)},REVIEWED_FILES.backend,REVIEWED_FILES.frontend));
  for(const group of ['backend','frontend'] as const) {
    const key=Object.keys(REVIEWED_FILES[group])[0];
    const changed={...REVIEWED_FILES[group],[key]:'0'.repeat(64)};
    assert.throws(()=>assertReviewedHashes(release,group==='backend'?changed:REVIEWED_FILES.backend,group==='frontend'?changed:REVIEWED_FILES.frontend));
    delete changed[key];
    assert.throws(()=>assertReviewedHashes(release,group==='backend'?changed:REVIEWED_FILES.backend,group==='frontend'?changed:REVIEWED_FILES.frontend));
  }
  assert.throws(()=>assertReviewedHashes(release,{...REVIEWED_FILES.backend,'dist/extra.js':'0'.repeat(64)},REVIEWED_FILES.frontend));
});
test('schema change accepts only the reviewed SQL/schema pair and candidate generated client',()=>{
  assert.equal(digest(BEFORE_SCHEMA),REVIEWED_MIGRATION.beforeSchema);
  assert.equal(digest(AFTER_SCHEMA),REVIEWED_MIGRATION.afterSchema);
  assert.equal(digest(MIGRATION_SQL),REVIEWED_MIGRATION.sha256);
  const f=schemaFixture();compatible(f.candidate,f.current,schemaManifest());
  assert.throws(()=>compatible(f.candidate,f.current),/Separate dependency/);
  for(const file of ['package.json','package-lock.json','prisma/schema.prisma',
    'prisma/migrations/'+REVIEWED_MIGRATION.name+'/migration.sql','runtime-prisma/generated/schema.prisma']) {
    const original=fs.readFileSync(path.join(f.candidate,file));
    fs.appendFileSync(path.join(f.candidate,file),'tamper');
    assert.throws(()=>compatible(f.candidate,f.current,schemaManifest()));fs.writeFileSync(path.join(f.candidate,file),original);
  }
  fs.unlinkSync(path.join(f.candidate,'runtime-prisma/generated/libquery_engine-debian-openssl-3.0.x.so.node'));
  assert.throws(()=>compatible(f.candidate,f.current,schemaManifest()));
});
test('unknown, duplicated, traversing and mismatched migration declarations fail closed',()=>{
  for(const list of [[],[{name:'../other',sha256:REVIEWED_MIGRATION.sha256}],
    [{name:REVIEWED_MIGRATION.name,sha256:'0'.repeat(64)}],
    [...schemaManifest().databaseMigrations,...schemaManifest().databaseMigrations],true,null]) {
    assert.throws(()=>migrations({...schemaManifest(),databaseMigrations:list}));
  }
  assert.throws(()=>migrations({...schemaManifest(),schemaSha256:'0'.repeat(64)}));
  assert.throws(()=>migrations({...schemaManifest(),format:2}));
});
test('schema and ordinary publications require different acknowledgements',()=>{
  assertAcknowledgement(schemaManifest(),'SITREP-HOSTINGER-SCHEMA');
  assertAcknowledgement({databaseMigrations:false},'SITREP-HOSTINGER');
  for(const ack of ['', 'SITREP-HOSTINGER','other'])assert.throws(()=>assertAcknowledgement(schemaManifest(),ack));
  assert.throws(()=>assertAcknowledgement({databaseMigrations:false},'SITREP-HOSTINGER-SCHEMA'));
});
test('prepare rejects existing table, any migration history row, unknown metadata or missing privileges',()=>{
  const state={usesPrismaMigrations:true,tableExists:false,migrationExists:false,canCreate:true,canReference:true,canRecordMigration:true};
  assertMigrationPending(state);assertMigrationPending({...state,usesPrismaMigrations:false});
  for(const patch of [{tableExists:true},{migrationExists:true},{canCreate:false},{canReference:false},{canRecordMigration:false},{usesPrismaMigrations:null}])assert.throws(()=>assertMigrationPending({...state,...patch}));
});
test('transaction includes exact additive SQL and Prisma history atomically without an embedded commit',()=>{
  for(const history of [true,false]) {
    const sql=migrationTransaction(MIGRATION_SQL,history);
    assert.ok(sql.includes(MIGRATION_SQL));assert.match(sql,/SET LOCAL search_path TO public/);
    assert.match(sql,/Table already exists/);assert.match(sql,/Migration history changed/);
    assert.doesNotMatch(sql,/^\s*(COMMIT|ROLLBACK|DROP|DELETE|UPDATE)\b/im);
    assert.equal(sql.includes('INSERT INTO public._prisma_migrations'),history);
    if(history) {assert.ok(sql.includes(REVIEWED_MIGRATION.sha256));assert.match(sql,/applied_steps_count/);}
  }
  assert.throws(()=>migrationTransaction(MIGRATION_SQL+'COMMIT;',true));
});
test('private Prisma resolves the candidate client without modifying active dependencies',()=>{
  const f=schemaFixture();const active=path.join(f.current,'node_modules');
  fs.mkdirSync(path.join(active,'@prisma'),{recursive:true});fs.mkdirSync(path.join(active,'.prisma'),{recursive:true});
  fakePrisma(path.join(f.root,'old-prisma'),'old-client',BEFORE_SCHEMA);
  fs.cpSync(path.join(f.root,'old-prisma/client'),path.join(active,'@prisma/client'),{recursive:true});
  fs.cpSync(path.join(f.root,'old-prisma/generated'),path.join(active,'.prisma/client'),{recursive:true});
  put(path.join(active,'other/index.js'),'module.exports="shared";');
  for(const name of ['data','uploads'])fs.mkdirSync(path.join(f.current,name));
  const before=inventory(f.current);
  nativeLinks(f.candidate,f.current,true);
  assert.deepEqual(inventory(f.current),before);
  const requireCandidate=createRequire(path.join(f.candidate,'dist/index.js'));
  assert.equal(requireCandidate('@prisma/client'),'new-client');
  const requireActive=createRequire(path.join(f.current,'dist/index.js'));
  assert.equal(requireActive('@prisma/client'),'old-client');
  assert.equal(requireCandidate('other'),'shared');
  assert.equal(fs.lstatSync(path.join(f.candidate,'node_modules')).isSymbolicLink(),false);
  assert.equal(fs.lstatSync(path.join(f.candidate,'node_modules/.prisma/client')).isSymbolicLink(),false);
});
test('backup failure prevents migration and activation; migration failure prevents restart',async()=>{
  for(const fail of ['backup','migration']) {
    const calls:string[]=[];
    await assert.rejects(backedActivation(()=>{calls.push('backup');if(fail==='backup')throw new Error('backup failed');},
      ()=>{calls.push('migration');throw new Error('transaction rolled back');},async()=>{calls.push('restart');},
      async()=>{calls.push('verify');},async()=>{calls.push('rollback-code');}));
    assert.deepEqual(calls,fail==='backup'?['backup']:['backup','migration','rollback-code']);
  }
});
test('backup precedes transaction and restart; failed health retains the table and backup evidence',async()=>{
  for(const fail of [false,true]) {
    const calls:string[]=[];let table=false,active='old',outcome:any;
    const attempt=backedActivation(()=>{calls.push('backup');},()=>{calls.push('migration');table=true;},
      async()=>{calls.push('restart');active='new';},async()=>{calls.push('verify');if(fail)throw new Error('health');},
      async()=>{calls.push('rollback');active='old';outcome=migrationOutcome(true,true,schemaManifest().databaseMigrations,'/isolated/backup');});
    if(fail)await assert.rejects(attempt);else await attempt;
    assert.deepEqual(calls,fail?['backup','migration','restart','verify','rollback']:['backup','migration','restart','verify']);
    assert.equal(table,true);assert.equal(active,fail?'old':'new');
    if(fail) {assert.equal(outcome.databaseMigrationKept,true);assert.equal(outcome.databaseRestored,false);assert.equal(outcome.databaseBackup,'/isolated/backup/database.dump');assert.deepEqual(outcome.migrations,schemaManifest().databaseMigrations);}
  }
  assert.equal(migrationOutcome(true,false,schemaManifest().databaseMigrations,'/backup').databaseMigrationOutcomeUnconfirmed,true);
});
test('named listener binding retains preview verification and rejects unfamiliar shapes',()=>{
  const named="const listen = () => {\n    if (HOST)\n        app.listen(PORT, HOST, onListening);\n    else\n        app.listen(PORT, onListening);\n};";
  const source=named+'\nverifySyntheticPreviewDatabase().then(listen);';
  const result=loopbackIndex(source);assert.match(result,/app.listen\(PORT, '127.0.0.1', onListening\)/);
  assert.ok(result.includes('verifySyntheticPreviewDatabase().then(listen);'));assert.equal(loopbackIndex(result),result);
  assert.throws(()=>loopbackIndex(named.replace('HOST, onListening','HOST, anotherCallback')));
});
test('explicit packaging seals SQL and generated client; never discovers migrations implicitly',()=>{
  const f=schemaFixture(),source=path.join(f.root,'source');fs.mkdirSync(source);
  fs.cpSync(f.candidate,path.join(source,'backend'),{recursive:true});
  const backend=path.join(source,'backend');
  fs.mkdirSync(path.join(backend,'node_modules/@prisma'),{recursive:true});fs.mkdirSync(path.join(backend,'node_modules/.prisma'),{recursive:true});
  fs.cpSync(path.join(backend,'runtime-prisma/client'),path.join(backend,'node_modules/@prisma/client'),{recursive:true});
  fs.cpSync(path.join(backend,'runtime-prisma/generated'),path.join(backend,'node_modules/.prisma/client'),{recursive:true});
  put(path.join(backend,'dist/index.js'),'app.listen(PORT, () => {');
  put(path.join(source,'frontend/dist/index.html'),'web');put(path.join(source,'frontend/dist-app/app.html'),'app');
  const build=(output:string,names:string[]=[])=>execFileSync(process.execPath,['--experimental-strip-types',new URL('./package.ts',import.meta.url).pathname,source,path.join(f.root,output),'a'.repeat(40),...names],{stdio:'pipe'});
  build('explicit',[REVIEWED_MIGRATION.name]);const manifest=JSON.parse(fs.readFileSync(path.join(f.root,'explicit/release.json'),'utf8'));
  assert.deepEqual(manifest.databaseMigrations,schemaManifest().databaseMigrations);
  assert.equal(manifest.schemaSha256,REVIEWED_MIGRATION.afterSchema);
  assert.ok(manifest.files['backend/runtime-prisma/generated/index.js']);
  assert.ok(manifest.files['backend/prisma/migrations/'+REVIEWED_MIGRATION.name+'/migration.sql']);
  assert.equal(Object.keys(manifest.files).some(name=>name.includes('/node_modules/')),false);
  build('implicit');const ordinary=JSON.parse(fs.readFileSync(path.join(f.root,'implicit/release.json'),'utf8'));
  assert.equal(ordinary.databaseMigrations,false);
  assert.equal(Object.keys(ordinary.files).some(name=>name.includes('/migrations/') || name.includes('/runtime-prisma/')),false);
  assert.throws(()=>build('unknown',['another-migration']));
  put(path.join(backend,'node_modules/.prisma/client/schema.prisma'),'wrong generated schema');
  assert.throws(()=>build('wrong-client',[REVIEWED_MIGRATION.name]));
});

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

function preparedFixture(schema=false): any {
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'sitrep-prepared-'));const source=path.join(base,'source');
  function put(file: string,content: string): void {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);}
  for(const file of ['backend/package.json','backend/package-lock.json','backend/prisma/schema.prisma'])put(path.join(source,file),'unchanged fixture');
  if(schema) {
    for(const file of ['package.json','package-lock.json'])put(path.join(source,'backend',file),'{}');
    put(path.join(source,'backend/prisma/schema.prisma'),AFTER_SCHEMA);
    put(path.join(source,'backend/prisma/migrations',REVIEWED_MIGRATION.name,'migration.sql'),MIGRATION_SQL);
    fakePrisma(path.join(base,'generated'),'new-client',AFTER_SCHEMA);
    fs.mkdirSync(path.join(source,'backend/node_modules/@prisma'),{recursive:true});
    fs.mkdirSync(path.join(source,'backend/node_modules/.prisma'),{recursive:true});
    fs.cpSync(path.join(base,'generated/client'),path.join(source,'backend/node_modules/@prisma/client'),{recursive:true});
    fs.cpSync(path.join(base,'generated/generated'),path.join(source,'backend/node_modules/.prisma/client'),{recursive:true});
  }
  put(path.join(source,'backend/dist/index.js'),'new application\napp.listen(PORT, () => {\n');
  put(path.join(source,'frontend/dist/index.html'),'new index');put(path.join(source,'frontend/dist/assets/new.js'),'new asset');
  put(path.join(source,'frontend/dist-app/app.html'),'new app');
  const packageRoot=path.join(base,'built');const commit='a'.repeat(40);const preparedRun='1-1';
  execFileSync(process.execPath,['--experimental-strip-types',new URL('./package.ts',import.meta.url).pathname,source,packageRoot,commit,...(schema?[REVIEWED_MIGRATION.name]:[])],{stdio:'pipe'});
  const bundle=digest(fs.readFileSync(path.join(packageRoot,'release.tar.gz')));
  const incoming=path.join(base,'incoming',preparedRun);fs.mkdirSync(incoming,{recursive:true});
  for(const file of ['release.tar.gz','release.json'])fs.copyFileSync(path.join(packageRoot,file),path.join(incoming,file));
  const root=path.join(base,'staged',`${commit}-${bundle}`);fs.mkdirSync(root,{recursive:true});
  fs.cpSync(path.join(packageRoot,'tree'),path.join(root,'package'),{recursive:true});
  const oldBackend=path.join(base,'current/backend');fs.cpSync(path.join(source,'backend'),oldBackend,{recursive:true});
  put(path.join(oldBackend,'dist/index.js'),"old application\napp.listen(PORT, '127.0.0.1', () => {\n");
  for(const name of ['node_modules','data','uploads'])fs.mkdirSync(path.join(oldBackend,name),{recursive:true});
  if(schema)put(path.join(oldBackend,'prisma/schema.prisma'),BEFORE_SCHEMA);
  const oldFrontend=path.join(base,'current/frontend');put(path.join(oldFrontend,'index.html'),'old index');
  put(path.join(oldFrontend,'app/app.html'),'old app');put(path.join(oldFrontend,'assets/old.js'),'old asset');
  const original=`server { root ${oldFrontend}; location /app/ { alias ${oldFrontend}/app/; } location /api { proxy_pass http://127.0.0.1:3002; } }`;
  const before={revision:'b'.repeat(40),backend:oldBackend,frontend:oldFrontend,codeDigest:codeDigest(oldBackend),
    frontendDigest:digest(JSON.stringify(inventory(oldFrontend))),proxyHash:digest(original)};
  const destination=path.join(base,'releases',`${commit}-${preparedRun}`);fs.mkdirSync(destination,{recursive:true});
  const backend=path.join(destination,'backend');fs.cpSync(path.join(root,'package/backend'),backend,{recursive:true});
  put(path.join(backend,'dist/index.js'),loopbackIndex(fs.readFileSync(path.join(backend,'dist/index.js'),'utf8')));
  nativeLinks(backend,oldBackend,schema);
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

// Exact 6bc08a7c schema fixture, gzip/base64 for size; its SHA is asserted below.
const BEFORE_SCHEMA=gunzipSync(Buffer.from("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",'base64')).toString();
const AFTER_SCHEMA=BEFORE_SCHEMA.replace("model Usuario {\n","model InspectionStaffRole {\n  usuarioId String @id\n  role String @default(\"ADMIN_INSPECCIONES\")\n  activo Boolean @default(true)\n  asignadoPorId String\n  updatedAt DateTime @default(now()) @db.Timestamp(3)\n  usuario Usuario @relation(\"InspectionManagementMember\", fields: [usuarioId], references: [id], onDelete: Restrict)\n  asignadoPor Usuario @relation(\"InspectionManagementGrantor\", fields: [asignadoPorId], references: [id], onDelete: Restrict)\n  @@map(\"inspection_staff_roles\")\n}\n\nmodel Usuario {\n  inspectionManagementRole InspectionStaffRole? @relation(\"InspectionManagementMember\")\n  inspectionManagementGrants InspectionStaffRole[] @relation(\"InspectionManagementGrantor\")\n");
const MIGRATION_SQL="CREATE TABLE \"inspection_staff_roles\" (\n  \"usuarioId\" TEXT PRIMARY KEY REFERENCES \"usuarios\"(\"id\") ON DELETE RESTRICT,\n  \"role\" TEXT NOT NULL DEFAULT 'ADMIN_INSPECCIONES' CHECK (\"role\" = 'ADMIN_INSPECCIONES'),\n  \"activo\" BOOLEAN NOT NULL DEFAULT true,\n  \"asignadoPorId\" TEXT NOT NULL REFERENCES \"usuarios\"(\"id\") ON DELETE RESTRICT,\n  \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP\n);\n";

test('prepared migration payload seals private generated code and SQL through activation',()=>{
  const f=preparedFixture(true);let calls=0;
  withPrepared(f.ready,f.root,f.bundle,f.original,()=>{calls++;});assert.equal(calls,1);
  for(const file of ['node_modules/.prisma/client/index.js','node_modules/@prisma/client/index.js',
    'runtime-prisma/generated/index.js','prisma/migrations/'+REVIEWED_MIGRATION.name+'/migration.sql']) {
    const candidate=preparedFixture(true);fs.appendFileSync(path.join(candidate.ready.backend,file),'tampered');
    candidate.ready.artifacts=capturePrepared(candidate.ready,candidate.root);
    assert.throws(()=>withPrepared(candidate.ready,candidate.root,candidate.bundle,candidate.original,()=>{calls++;}));
  }
  assert.equal(calls,1);
});
