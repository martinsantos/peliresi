import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as https from 'node:https';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type Json = Record<string, any>;
export const INITIAL_REVISION = '8fb6277ecabaace83671a9dfb251147a43c9ccbf';
const ROOT = '/srv/umsa-sitrep-publisher';
const BACKEND = '/srv/umsa-clean-apps/sitrep-backend';
const FRONTEND = '/srv/umsa-clean-proxy/static/sitrep';
const PROXY = '/srv/umsa-migration/sitrep-public-ingress/40607817805-1/nginx.conf';
const DROPIN = '/etc/systemd/system/umsa-clean-sitrep-backend.service.d/zz-hostinger-publisher.conf';
const SERVICE = 'umsa-clean-sitrep-backend';
const INGRESS = 'umsa-sitrep-ingress';
const ENVIRONMENT = ['/srv/umsa-migration/clean-sitrep-backend.environment', '/srv/umsa-migration/sitrep-live.environment'];
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const SECRET_KEYS = ['DATABASE_URL','JWT_SECRET','JWT_REFRESH_SECRET','DOCUMENT_HMAC_SECRET','INSPECTION_TRACE_SECRET','CERTIFICATE_ED25519_PRIVATE_KEY','UPLOADS_DIR','LEGACY_UPLOADS_DIR'];

export function digest(data: string | Buffer): string { return crypto.createHash('sha256').update(data).digest('hex'); }
function hash(file: string): string { return digest(fs.readFileSync(file)); }
function read(file: string): Json { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function run(command: string, args: string[]): string {
  try { return execFileSync(command, args, { encoding:'utf8', timeout:120000, stdio:['ignore','pipe','pipe'] }).trim(); }
  catch { throw new Error(`Required operation failed: ${command} ${args[0] || ''}; preserve private release evidence`); }
}
function ordinary(file: string): void {
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== 0 || info.nlink!==1) throw new Error('Unexpected managed file identity');
}
function atomic(file: string, data: Buffer | string, expected: string | null): void {
  if (expected === null ? fs.existsSync(file) : !fs.existsSync(file) || hash(file) !== expected) throw new Error('Concurrent managed file change');
  const temporary = `${file}.sitrep-${process.pid}`;
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}
function save(file: string, data: Json): void { atomic(file, JSON.stringify(data,null,2)+'\n', fs.existsSync(file) ? hash(file) : null); }
function directory(folder: string, mode=0o700): void {
  if (fs.existsSync(folder)) {
    const info=fs.lstatSync(folder);
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid!==0 || (info.mode&0o777)!==mode) throw new Error('Unexpected publisher directory');
  } else { fs.mkdirSync(folder,{recursive:true,mode}); fs.chmodSync(folder,mode); }
}

export function inventory(root: string, preservedLinks: string[] = []): Json {
  const files: Json = Object.create(null);
  function visit(folder: string): void {
    for (const name of fs.readdirSync(folder).sort()) {
      const file=path.join(folder,name); const info=fs.lstatSync(file);
      if (info.isSymbolicLink()) {
        if(preservedLinks.includes(path.relative(root,file)))continue;
        throw new Error('Release archives cannot contain links');
      }
      if (info.isDirectory()) visit(file);
      else if (info.isFile()) files[path.relative(root,file)]={sha256:hash(file),bytes:info.size};
      else throw new Error('Unexpected release object');
    }
  }
  visit(root); return files;
}
export function codeDigest(backend: string): string {
  return digest(JSON.stringify({dist:inventory(path.join(backend,'dist')),
    package:hash(path.join(backend,'package.json')),lock:hash(path.join(backend,'package-lock.json')),
    schema:hash(path.join(backend,'prisma/schema.prisma'))}));
}
export function loopbackIndex(source: string): string {
  const original='app.listen(PORT, () => {';
  const bound="app.listen(PORT, '127.0.0.1', () => {";
  if(source.split(bound).length===2 && !source.includes(original))return source;
  if(source.split(original).length!==2 || source.includes(bound))throw new Error('Backend binding requires separate review');
  return source.replace(original,bound);
}
function initialCodeMatches(actual: string,trusted: string): boolean {
  const expected=inventory(path.join(trusted,'dist'));
  const index=loopbackIndex(fs.readFileSync(path.join(trusted,'dist/index.js'),'utf8'));
  expected['index.js']={sha256:digest(index),bytes:Buffer.byteLength(index)};
  return digest(JSON.stringify(inventory(path.join(actual,'dist'))))===digest(JSON.stringify(expected))
    && ['package.json','package-lock.json','prisma/schema.prisma'].every(file=>hash(path.join(actual,file))===hash(path.join(trusted,file)));
}
function initialStaticMatches(actual: string,trusted: string): boolean {
  for(const [folder,prefix] of [['web',''],['app','app']]) {
    for(const [name,info] of Object.entries(inventory(path.join(trusted,folder)))) {
      const file=path.join(actual,prefix,name);
      if(!fs.existsSync(file) || !fs.lstatSync(file).isFile() || hash(file)!==(info as Json).sha256)return false;
    }
  }
  return true;
}
export function safeArchiveEntries(entries: string[], verbose: string[]): void {
  for (const name of entries) {
    const normalized=name.replace(/^\.\//,'').replace(/\/$/,'');
    if (name.startsWith('/') || /[\\\r\n\0]/.test(name) || normalized.split('/').includes('..')) throw new Error('Unsafe archive path');
  }
  if (verbose.some(line=>line && !['-','d'].includes(line[0]))) throw new Error('Archive links or special objects are forbidden');
}
export function compatible(candidate: string, current: string): void {
  for (const file of ['package.json','package-lock.json','prisma/schema.prisma']) {
    if (hash(path.join(candidate,file))!==hash(path.join(current,file))) throw new Error(`Separate dependency/schema review required: ${file}`);
  }
}
export function proxyFor(original: string, from: string, to: string): string {
  if (!original.includes(`root ${from};`) || !original.includes(`alias ${from}/app/;`)) throw new Error('Ambiguous SITREP static roots');
  return original.split(from).join(to);
}
function environment(): Json {
  const pid=run('systemctl',['show',SERVICE,'-p','MainPID','--value']);
  if (!/^[1-9][0-9]*$/.test(pid)) throw new Error('Active SITREP backend required');
  const values: Json={};
  for (const item of fs.readFileSync(`/proc/${pid}/environ`,'utf8').split('\0')) {
    const offset=item.indexOf('='); if (offset>0) values[item.slice(0,offset)]=item.slice(offset+1);
  }
  const db=new URL(values.DATABASE_URL);
  if (db.pathname!=='/trazabilidad_rrpp' || !['localhost','127.0.0.1'].includes(db.hostname)
      || values.PORT!=='3002' || values.UPLOADS_DIR!=='/var/lib/sitrep-uploads') throw new Error('Unexpected active database/uploads/port contract');
  return {pid,secretFingerprint:digest(JSON.stringify(SECRET_KEYS.map(k=>[k,values[k] || ''])))};
}
export function current(): Json {
  if (os.hostname()!=='srv2101069.hstgr.cloud' || process.getuid?.()!==0
      || fs.readFileSync('/srv/umsa-migration/.target','utf8').trim()!=='179.198.115.115'
      || !fs.existsSync('/srv/umsa-migration/production.active')) throw new Error('Only authoritative Hostinger is allowed');
  const statePath=path.join(ROOT,'state.json');
  let state: Json;
  if (fs.existsSync(statePath)) state=read(statePath);
  else {
    const trusted=fs.readFileSync('/srv/umsa-migration/trusted-sitrep','utf8').trim();
    if (trusted!==`/srv/umsa-migration/trusted/sitrep-${INITIAL_REVISION}`
        || read(path.join(trusted,'application/provenance.json')).source_revision!==INITIAL_REVISION
        || !initialCodeMatches(BACKEND,path.join(trusted,'application/backend'))
        || !initialStaticMatches(FRONTEND,path.join(trusted,'application'))) throw new Error('Initial deployed code differs from verified runtime');
    state={revision:INITIAL_REVISION,backend:BACKEND,frontend:FRONTEND};
  }
  for (const file of [PROXY,...ENVIRONMENT]) ordinary(file);
  if(fs.existsSync(DROPIN))ordinary(DROPIN);
  const serviceCommand=run('systemctl',['show',SERVICE,'-p','ExecStart','--value']);
  if(!serviceCommand.includes(`${state.backend}/dist/index.js`))throw new Error('Unexpected active backend command');
  const unitFiles=run('systemctl',['show',SERVICE,'-p','DropInPaths','--value']).split(/\s+/).filter(Boolean);
  for(const file of unitFiles)ordinary(file);
  const processState=environment();
  const snapshot={...state,codeDigest:codeDigest(state.backend),frontendDigest:digest(JSON.stringify(inventory(state.frontend))),
    proxyHash:hash(PROXY),environment:ENVIRONMENT.map(file=>[file,hash(file)]),
    dropin:fs.existsSync(DROPIN)?hash(DROPIN):null,
    baseUnit:hash('/etc/systemd/system/umsa-clean-sitrep-backend.service'),
    liveOverride:hash('/etc/systemd/system/umsa-clean-sitrep-backend.service.d/umsa-sitrep-live.conf'),
    unitFiles:unitFiles.map(file=>[file,hash(file)]),
    secretFingerprint:processState.secretFingerprint};
  if (state.codeDigest && (state.codeDigest!==snapshot.codeDigest || state.frontendDigest!==snapshot.frontendDigest || state.proxyHash!==snapshot.proxyHash)) throw new Error('Published code or proxy changed outside the reviewed publisher');
  return snapshot;
}
function sameCurrent(left: Json,right: Json): void {
  if (digest(JSON.stringify(left))!==digest(JSON.stringify(right))) throw new Error('Runtime changed after preparation; prepare again');
}
function chmodTree(root: string): void {
  fs.chmodSync(root,0o755);
  for (const name of fs.readdirSync(root)) {
    const file=path.join(root,name); const info=fs.lstatSync(file);
    if (info.isDirectory()) chmodTree(file); else if (info.isFile()) fs.chmodSync(file,0o644); else throw new Error('Unexpected static release link');
  }
}
function nativeLinks(backend: string,currentBackend: string): void {
  for (const name of ['node_modules','data','uploads']) fs.symlinkSync(fs.realpathSync(path.join(currentBackend,name)),path.join(backend,name),'dir');
}
const RUNTIME_LINKS=['node_modules','data','uploads'];
function fileMapHash(files: Json): string {
  return digest(JSON.stringify(Object.keys(files).sort().map(name=>[name,files[name]])));
}
function linkEvidence(backend: string): Json {
  const links: Json={};
  for(const name of RUNTIME_LINKS) {
    const file=path.join(backend,name);const link=fs.lstatSync(file);
    if(!link.isSymbolicLink())throw new Error('Preserved runtime link was replaced');
    const target=fs.statSync(file);
    if(!target.isDirectory())throw new Error('Preserved runtime link target is not a directory');
    links[name]={target:fs.readlinkSync(file),resolved:fs.realpathSync(file),
      linkDevice:link.dev,linkInode:link.ino,linkMode:link.mode,linkOwner:link.uid,
      targetDevice:target.dev,targetInode:target.ino};
  }
  return links;
}
function preparedPaths(ready: Json,root: string,bundle: string): Json {
  if(!SHA.test(ready.commit) || ready.bundle!==bundle || !DIGEST.test(bundle)
      || !/^[0-9]+-[0-9]+$/.test(ready.preparedRun)
      || path.basename(root)!==`${ready.commit}-${bundle}` || path.basename(path.dirname(root))!=='staged')throw new Error('Prepared release identity changed');
  const publisherRoot=path.dirname(path.dirname(root));
  const destination=path.join(publisherRoot,'releases',`${ready.commit}-${ready.preparedRun}`);
  if(ready.destination!==destination || ready.backend!==path.join(destination,'backend')
      || ready.frontend!==path.join(destination,'frontend') || ready.rollback!==path.join(destination,'rollback-frontend'))throw new Error('Prepared release location changed');
  return {archive:path.join(publisherRoot,'incoming',ready.preparedRun,'release.tar.gz'),
    manifest:path.join(publisherRoot,'incoming',ready.preparedRun,'release.json'),extracted:path.join(root,'package')};
}
function sealedManifest(archive: string,manifestFile: string,extracted: string,commit: string,bundle: string): Json {
  if(!fs.lstatSync(archive).isFile() || fs.lstatSync(archive).isSymbolicLink() || hash(archive)!==bundle)throw new Error('Reviewed bundle changed after preparation');
  const sealed=run('tar',['-xOzf',archive,'./.sitrep-release.json']);
  if(fs.readFileSync(manifestFile,'utf8').trim()!==sealed
      || fs.readFileSync(path.join(extracted,'.sitrep-release.json'),'utf8').trim()!==sealed)throw new Error('Sealed release manifest changed');
  const manifest=JSON.parse(sealed);
  if(manifest.format!==2 || manifest.commit!==commit || manifest.databaseMigrations!==false)throw new Error('Unsupported sealed release manifest');
  const files=inventory(extracted);delete files['.sitrep-release.json'];
  if(fileMapHash(files)!==fileMapHash(manifest.files))throw new Error('Reviewed source payload changed after preparation');
  return manifest;
}
export function capturePrepared(ready: Json,root: string): Json {
  return {version:1,backendCodeDigest:codeDigest(ready.backend),
    backendInventory:fileMapHash(inventory(ready.backend,RUNTIME_LINKS)),
    frontendInventory:fileMapHash(inventory(ready.frontend)),rollbackInventory:fileMapHash(inventory(ready.rollback)),
    candidateConfig:hash(path.join(root,'candidate.conf')),rollbackConfig:hash(path.join(root,'rollback.conf')),
    runtimeLinks:linkEvidence(ready.backend)};
}
export function assertPrepared(ready: Json,root: string,bundle: string,beforeProxy: string): void {
  const locations=preparedPaths(ready,root,bundle);
  const manifest=sealedManifest(locations.archive,locations.manifest,locations.extracted,ready.commit,bundle);
  if(!ready.artifacts || ready.artifacts.version!==1
      || digest(JSON.stringify(capturePrepared(ready,root)))!==digest(JSON.stringify(ready.artifacts)))throw new Error('Prepared artifact integrity check failed');
  if(codeDigest(ready.before.backend)!==ready.before.codeDigest
      || digest(JSON.stringify(inventory(ready.before.frontend)))!==ready.before.frontendDigest
      || digest(beforeProxy)!==ready.before.proxyHash)throw new Error('Reviewed rollback baseline changed');
  const expectedBackend: Json=Object.create(null);
  const expectedFrontend: Json=Object.assign(Object.create(null),inventory(ready.before.frontend));
  for(const [name,entry] of Object.entries(manifest.files)) {
    if(name.startsWith('backend/'))expectedBackend[name.slice(8)]=entry;
    else if(name.startsWith('frontend/'))expectedFrontend[name.slice(9)]=entry;
    else throw new Error('Unexpected release payload scope');
  }
  const normalized=loopbackIndex(fs.readFileSync(path.join(locations.extracted,'backend/dist/index.js'),'utf8'));
  expectedBackend['dist/index.js']={sha256:digest(normalized),bytes:Buffer.byteLength(normalized)};
  const expectedRollback: Json=Object.assign(Object.create(null),expectedFrontend,inventory(ready.before.frontend));
  const oldRelease=JSON.stringify({commit:ready.before.revision})+'\n';
  expectedRollback['release.json']={sha256:digest(oldRelease),bytes:Buffer.byteLength(oldRelease)};
  if(fileMapHash(inventory(ready.backend,RUNTIME_LINKS))!==fileMapHash(expectedBackend)
      || fileMapHash(inventory(ready.frontend))!==fileMapHash(expectedFrontend)
      || fileMapHash(inventory(ready.rollback))!==fileMapHash(expectedRollback))throw new Error('Prepared payload differs from the reviewed bundle and baseline');
  for(const name of RUNTIME_LINKS)if(fs.readlinkSync(path.join(ready.backend,name))!==fs.realpathSync(path.join(ready.before.backend,name)))throw new Error('Prepared runtime link target changed');
  if(fs.readFileSync(path.join(root,'candidate.conf'),'utf8')!==proxyFor(beforeProxy,ready.before.frontend,ready.frontend)
      || fs.readFileSync(path.join(root,'rollback.conf'),'utf8')!==proxyFor(beforeProxy,ready.before.frontend,ready.rollback))throw new Error('Prepared proxy differs from the reviewed root-only change');
}
export function withPrepared<T>(ready: Json,root: string,bundle: string,beforeProxy: string,operation:()=>T): T {
  assertPrepared(ready,root,bundle,beforeProxy);return operation();
}
function request(urlPath: string): Promise<{status:number,body:Buffer,type:string}> {
  return new Promise((resolve,reject)=>{
    const req=https.get({hostname:'179.198.115.115',servername:'sitrep.ultimamilla.com.ar',port:443,
      path:urlPath,headers:{Host:'sitrep.ultimamilla.com.ar'},timeout:10000},response=>{
      const chunks: Buffer[]=[]; let size=0;
      response.on('data',chunk=>{size+=chunk.length;if(size>20*1024*1024)req.destroy(new Error('Response limit'));else chunks.push(chunk);});
      response.on('error',error=>{clearTimeout(deadline);reject(error);});
      response.on('aborted',()=>req.destroy(new Error('Incomplete public response')));
      response.on('end',()=>{clearTimeout(deadline);resolve({status:response.statusCode || 0,body:Buffer.concat(chunks),type:String(response.headers['content-type'] || '')});});
    });
    const deadline=setTimeout(()=>req.destroy(new Error('Public probe total deadline exceeded')),15000);
    req.on('timeout',()=>req.destroy(new Error('Health timeout')));req.on('error',error=>{clearTimeout(deadline);reject(error);});
  });
}
export async function checkPublic(frontend: string, revision: string): Promise<void> {
  const health=await request('/api/health'); const data=JSON.parse(health.body.toString());
  if (health.status!==200 || data.status!=='ok' || data.db!=='connected') throw new Error('Public database health failed');
  const release=await request('/release.json');
  if (release.status!==200 || JSON.parse(release.body.toString()).commit!==revision) throw new Error('Public release identity failed');
  for (const [url,file] of [['/','index.html'],['/app/','app/app.html']]) {
    const response=await request(url);
    if (response.status!==200 || digest(response.body)!==hash(path.join(frontend,file))) throw new Error('Public frontend identity failed');
    const assets=[...response.body.toString().matchAll(/(?:src|href)=["'](\/(?:app\/)?assets\/[^"'?#]+)["']/g)].map(match=>match[1]);
    if (!assets.length) throw new Error('Frontend assets missing');
    for (const asset of assets) {
      const result=await request(asset);
      if (result.status!==200 || result.type.includes('text/html') || digest(result.body)!==hash(path.join(frontend,asset.slice(1)))) throw new Error('Public frontend asset failed');
    }
  }
}
function stage(commit: string,expected: string,bundle: string,id: string): Json {
  const before=current(); if (before.revision!==expected) throw new Error('Unexpected active revision');
  const incoming=path.join(ROOT,'incoming',id); const archive=path.join(incoming,'release.tar.gz');
  if (hash(archive)!==bundle) throw new Error('Transport digest mismatch');
  const manifest=read(path.join(incoming,'release.json'));
  if (manifest.format!==2 || manifest.commit!==commit || manifest.databaseMigrations!==false) throw new Error('Unexpected release manifest');
  safeArchiveEntries(run('tar',['-tzf',archive]).split('\n'),run('tar',['-tvzf',archive]).split('\n'));
  directory(ROOT,0o755); directory(path.join(ROOT,'staged')); directory(path.join(ROOT,'releases'),0o755);
  const root=path.join(ROOT,'staged',`${commit}-${bundle}`);
  if (fs.existsSync(root)) throw new Error('Preserve existing staged release');
  directory(root); const extracted=path.join(root,'package');directory(extracted);
  run('tar',['-xzf',archive,'-C',extracted,'--no-same-owner','--no-same-permissions']);
  sealedManifest(archive,path.join(incoming,'release.json'),extracted,commit,bundle);
  compatible(path.join(extracted,'backend'),before.backend);
  const stat=fs.statfsSync(ROOT); const sourceBytes=Object.values(inventory(before.frontend)).reduce((n:any,item:any)=>n+item.bytes,0);
  if (Number(stat.bavail)*Number(stat.bsize)<3*1024**3+3*Number(sourceBytes)+2*fs.statSync(archive).size) throw new Error('Insufficient release/backup capacity');
  const destination=path.join(ROOT,'releases',`${commit}-${id}`);directory(destination,0o755);
  const backend=path.join(destination,'backend');fs.cpSync(path.join(extracted,'backend'),backend,{recursive:true});
  fs.writeFileSync(path.join(backend,'dist/index.js'),loopbackIndex(fs.readFileSync(path.join(backend,'dist/index.js'),'utf8')));
  nativeLinks(backend,before.backend);
  const frontend=path.join(destination,'frontend');fs.cpSync(before.frontend,frontend,{recursive:true});fs.cpSync(path.join(extracted,'frontend'),frontend,{recursive:true});
  const rollback=path.join(destination,'rollback-frontend');fs.cpSync(frontend,rollback,{recursive:true});fs.cpSync(before.frontend,rollback,{recursive:true});
  fs.writeFileSync(path.join(rollback,'release.json'),JSON.stringify({commit:before.revision})+'\n');
  chmodTree(frontend);chmodTree(rollback);
  const original=fs.readFileSync(PROXY,'utf8');
  const candidate=proxyFor(original,before.frontend,frontend); const rollbackProxy=proxyFor(original,before.frontend,rollback);
  fs.writeFileSync(path.join(root,'candidate.conf'),candidate);fs.writeFileSync(path.join(root,'rollback.conf'),rollbackProxy);
  run('/usr/sbin/nginx',['-t','-c',path.join(root,'candidate.conf')]);run('/usr/sbin/nginx',['-t','-c',path.join(root,'rollback.conf')]);
  const ready: Json={commit,bundle,preparedRun:id,controller:hash(fileURLToPath(import.meta.url)),before,backend,frontend,rollback,destination};
  ready.artifacts=capturePrepared(ready,root);
  assertPrepared(ready,root,bundle,original);
  save(path.join(root,'ready.json'),ready);
  return {preparedCommit:commit,bundleSha256:bundle,expectedActiveRevision:expected,activation:false,schemaAndDependenciesUnchanged:true};
}
function backup(root: string,before: Json): void {
  directory(root);const file=path.join(root,'database.dump');const fd=fs.openSync(file,'wx',0o600);
  let result;
  try { result=spawnSync('docker',['exec','directus-admin-database-1','pg_dump','-w','-U','umsa_restore_admin_20261027','-d','trazabilidad_rrpp','-Fc'],{stdio:['ignore',fd,'pipe'],timeout:180000});fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  if (result.status!==0 || fs.statSync(file).size===0) throw new Error('Fresh database backup failed');
  const input=fs.openSync(file,'r');
  try {
    const validation=spawnSync('docker',['exec','-i','directus-admin-database-1','pg_restore','--file=/dev/null'],
      {stdio:[input,'ignore','pipe'],timeout:180000});
    if(validation.status!==0)throw new Error('Fresh backup archive validation failed');
  } finally {fs.closeSync(input);}
  fs.copyFileSync(PROXY,path.join(root,'nginx.before'));
  if (fs.existsSync(DROPIN)) fs.copyFileSync(DROPIN,path.join(root,'dropin.before'));
  for (const [index,file] of ENVIRONMENT.entries()) fs.copyFileSync(file,path.join(root,`environment-${index}.credentials.env`));
  save(path.join(root,'backup.json'),{databaseSha256:hash(file),bytes:fs.statSync(file).size,before,restoreDatabaseAutomatically:false});
}
export async function activateWithRollback(apply:()=>Promise<void>,verify:()=>Promise<void>,rollback:()=>Promise<void>): Promise<void> {
  try { await apply(); await verify(); } catch (error) { await rollback(); throw error; }
}
async function waitBackend(): Promise<void> {
  for(let attempt=0;attempt<30;attempt++) {
    try {const response=await fetch('http://127.0.0.1:3002/api/health',{signal:AbortSignal.timeout(2000)});const data=await response.json();if(response.ok && data.status==='ok' && data.db==='connected')return;}
    catch {/* Wait only for this explicitly restarted service. */}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error('SITREP backend did not become healthy');
}
async function publish(commit: string,expected: string,bundle: string,id: string): Promise<Json> {
  const root=path.join(ROOT,'staged',`${commit}-${bundle}`);const ready=read(path.join(root,'ready.json'));
  if (ready.commit!==commit || ready.bundle!==bundle || ready.controller!==hash(fileURLToPath(import.meta.url)) || ready.before.revision!==expected) throw new Error('Reviewed preparation/controller changed');
  sameCurrent(ready.before,current());
  const originalProxy=fs.readFileSync(PROXY);const beforeProxy=originalProxy.toString();
  const backupRoot=path.join(ROOT,'backups',id);
  withPrepared(ready,root,bundle,beforeProxy,()=>backup(backupRoot,ready.before));
  sameCurrent(ready.before,current());
  const oldDropin=fs.existsSync(DROPIN)?fs.readFileSync(DROPIN):null;
  const candidate=fs.readFileSync(path.join(root,'candidate.conf'));const rollbackProxy=fs.readFileSync(path.join(root,'rollback.conf'));
  const override=`[Service]\nWorkingDirectory=${ready.backend}\nExecStart=\nExecStart=/usr/bin/node ${ready.backend}/dist/index.js\n`;
  let backendChanged=false;let proxyChanged=false;
  await activateWithRollback(async()=>{
    withPrepared(ready,root,bundle,beforeProxy,()=>{
      atomic(DROPIN,override,ready.before.dropin);backendChanged=true;
      run('systemctl',['daemon-reload']);run('systemctl',['restart',SERVICE]);
    });
    await waitBackend();
    assertPrepared(ready,root,bundle,beforeProxy);
    if (!run('systemctl',['show',SERVICE,'-p','ExecStart','--value']).includes(`${ready.backend}/dist/index.js`)) throw new Error('Unexpected backend executable');
    atomic(PROXY,candidate,ready.before.proxyHash);proxyChanged=true;
    run('/usr/sbin/nginx',['-t','-c',PROXY]);run('systemctl',['reload',INGRESS]);
  },async()=>{
    assertPrepared(ready,root,bundle,beforeProxy);
    if (environment().secretFingerprint!==ready.before.secretFingerprint || ENVIRONMENT.some((file,index)=>hash(file)!==ready.before.environment[index][1])) throw new Error('Runtime secrets or environment changed');
    await checkPublic(ready.frontend,commit);
    const state={revision:commit,backend:ready.backend,frontend:ready.frontend,codeDigest:codeDigest(ready.backend),
      frontendDigest:digest(JSON.stringify(inventory(ready.frontend))),proxyHash:hash(PROXY),bundle};
    save(path.join(ROOT,'state.json'),state);
    save(path.join(backupRoot,'publication.complete.json'),{commit,bundle,databaseMigrated:false,environmentPreserved:true});
  },async()=>{
    if (proxyChanged) { atomic(PROXY,rollbackProxy,digest(candidate));run('/usr/sbin/nginx',['-t','-c',PROXY]);run('systemctl',['reload',INGRESS]); }
    if (backendChanged) {
      if(hash(DROPIN)!==digest(override))throw new Error('Concurrent service override change; preserve evidence');
      if(oldDropin)atomic(DROPIN,oldDropin,digest(override));else fs.unlinkSync(DROPIN);
      run('systemctl',['daemon-reload']);run('systemctl',['restart',SERVICE]);
      await waitBackend();
    }
    if(proxyChanged)await checkPublic(ready.rollback,expected);
    if(proxyChanged) save(path.join(ROOT,'state.json'),{revision:expected,backend:ready.before.backend,frontend:ready.rollback,
      codeDigest:ready.before.codeDigest,frontendDigest:digest(JSON.stringify(inventory(ready.rollback))),proxyHash:hash(PROXY),rollback:true});
    save(path.join(backupRoot,'rollback.json'),{applicationCodeRestored:true,databaseRestored:false,uploadsAndSessionConfigurationPreserved:true});
  });
  return {publishedCommit:commit,databaseMigrated:false,environmentPreserved:true,uploadsPreserved:true,backupRecorded:true};
}
async function main(): Promise<void> {
  const [operation,commit,expected,bundle,id]=process.argv.slice(2);
  if(operation==='preflight') {
    if(!SHA.test(commit) || expected || bundle || id)throw new Error('Read-only preflight requires only the active revision');
    const state=current();
    if(state.revision!==commit)throw new Error('Unexpected active runtime revision');
    await waitBackend();
    console.log(JSON.stringify({readOnly:true,activeRevision:state.revision,verifiedRuntimeCodeAndLoopbackBinding:true,
      verifiedStaticPackages:true,databaseAndUploadsContractVerified:true,health:'ok',applicationStarted:false,candidateSelected:false}));
    return;
  }
  if (!['prepare','publish'].includes(operation) || !SHA.test(commit) || !SHA.test(expected) || !DIGEST.test(bundle) || !/^[0-9]+-[0-9]+$/.test(id)) throw new Error('Invalid explicit release identity');
  process.umask(0o077);
  console.log(JSON.stringify(operation==='prepare'?stage(commit,expected,bundle,id):await publish(commit,expected,bundle,id)));
}
if (process.argv[1] && (process.argv[1]==='-' || path.resolve(process.argv[1])===fileURLToPath(import.meta.url))) main().catch(()=>{console.error('SITREP publication/preflight failed; preserve private evidence and review the runtime contract.');process.exitCode=1;});
