import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {execFileSync} from 'node:child_process';
import { compatible,proxyFor,safeArchiveEntries,inventory,activateWithRollback,loopbackIndex } from './publisher.ts';

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
  assert.ok(manifest.files['frontend/app/app.html']);assert.ok(manifest.files['frontend/manual/screenshots/desktop/example.png']);
  fs.writeFileSync(path.join(source,'frontend/dist/.env'),'forbidden-synthetic-fixture');
  assert.throws(()=>execFileSync(process.execPath,['--experimental-strip-types',builder.pathname,source,path.join(root,'rejected'),'b'.repeat(40)],{stdio:'pipe'}));
});
