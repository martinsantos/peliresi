import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as https from 'node:https';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type Json = Record<string, any>;
// Mixed publication audited on 2026-11-04. This identity is not a claim that the
// entire product was built from its web revision: components are recorded below.
export const REVIEWED_REVISION = '3245f36573a6b18a74d26887cdaa34e453d19d9e';
export const REVIEWED_BACKEND_REVISION = '6bc08a7c43fa35a22f32e24b35fedd440250d652';
export const REVIEWED_MIGRATION = Object.freeze({
  name:'20261103160000_inspection_management_role',
  sha256:'5ad722be27b2510ffd2dbc20b3e5aa4eaab5e5bd869b4333db0c6e96814767eb',
  beforeSchema:'124c6bf94c57f8513788e291fcba09979cadb11415e87a31dc185676a1618afc',
  afterSchema:'b0ae0578e12dc55ef6b5102f8e6c213f432308574c5ee7d887da117a7bbb9e61',
  // Prisma 5.22 formats its generated schema; verified by isolated regeneration.
  generatedSchema:'bd7a751422dfbd8169e56902dbc88e5157f303574ee75798306b35107fd664b6',
});
// Explicit exception for the reviewed security updates in PR #44. Unknown lockfiles
// still require a new publisher review; no installation ever runs on the live host.
export const REVIEWED_DEPENDENCIES = Object.freeze({
  id:'runtime-20261104',
  beforePackage:'e9974b1a330da6de922e3aafc5dfa61f0c5c292f60db2773a393bf2a6c913cf1',
  beforeLock:'b7315c794d3e77740d2f94fdd6b25c888696042a95aaf86d1916bdd202b53b52',
  afterPackage:'6f233e0965b74b5dbf415ca95f3559abbf045710f65bc302077df735055de6e1',
  afterLock:'c3809b72d9488a8fd3b1d51121284e8b6a756b80f3e51dc4af752be7aee759e8',
});
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
function run(command: string, args: string[], maxBuffer=1024**2): string {
  try { return execFileSync(command, args, { encoding:'utf8', timeout:120000, maxBuffer, stdio:['ignore','pipe','pipe'] }).trim(); }
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
    schema:hash(path.join(backend,'prisma/schema.prisma')),
    ...(fs.existsSync(path.join(backend,'runtime-dependencies'))?{privateDependencies:dependencyDigest(path.join(backend,'runtime-dependencies'))}:{}),
    ...(fs.existsSync(path.join(backend,'runtime-prisma'))?{privatePrisma:inventory(path.join(backend,'runtime-prisma'))}:{})}));
}
export function loopbackIndex(source: string): string {
  // Current application uses resolveListenHost and a named callback. Pin the
  // reviewed listener shape and bind it explicitly, preserving all startup gates.
  const named="const listen = () => {\n    if (HOST)\n        app.listen(PORT, HOST, onListening);\n    else\n        app.listen(PORT, onListening);\n};";
  const privateNamed="const listen = () => {\n    app.listen(PORT, '127.0.0.1', onListening);\n};";
  if(source.split(named).length===2 && !source.includes(privateNamed))return source.replace(named,privateNamed);
  if(source.split(privateNamed).length===2 && !source.includes(named))return source;
  const original='app.listen(PORT, () => {';
  const bound="app.listen(PORT, '127.0.0.1', () => {";
  if(source.split(bound).length===2 && !source.includes(original))return source;
  if(source.split(original).length!==2 || source.includes(bound))throw new Error('Backend binding requires separate review');
  return source.replace(original,bound);
}
export function safeArchiveEntries(entries: string[], verbose: string[]): void {
  for (const name of entries) {
    const normalized=name.replace(/^\.\//,'').replace(/\/$/,'');
    if (name.startsWith('/') || /[\\\r\n\0]/.test(name) || normalized.split('/').includes('..')) throw new Error('Unsafe archive path');
  }
  if (verbose.some(line=>line && !['-','d'].includes(line[0]))) throw new Error('Archive links or special objects are forbidden');
}
export function inspectArchive(archive: string): void {
  safeArchiveEntries(run('tar',['-tzf',archive],64*1024**2).split('\n'),run('tar',['-tvzf',archive],64*1024**2).split('\n'));
}
export function migrations(manifest: Json): Json[] {
  if (manifest.databaseMigrations===false) return [];
  const list=manifest.databaseMigrations;
  if (manifest.format!==3 || !Array.isArray(list) || list.length!==1
      || list[0]?.name!==REVIEWED_MIGRATION.name || list[0]?.sha256!==REVIEWED_MIGRATION.sha256
      || manifest.schemaSha256!==REVIEWED_MIGRATION.afterSchema) throw new Error('Unreviewed database migration');
  return list;
}
export function dependencies(manifest: Json): Json | null {
  const entry=manifest.dependencies;
  if(entry===undefined || entry===false)return null;
  if(manifest.format!==3 || !entry || entry.id!==REVIEWED_DEPENDENCIES.id
      || entry.beforePackage!==REVIEWED_DEPENDENCIES.beforePackage || entry.beforeLock!==REVIEWED_DEPENDENCIES.beforeLock
      || entry.afterPackage!==REVIEWED_DEPENDENCIES.afterPackage || entry.afterLock!==REVIEWED_DEPENDENCIES.afterLock
      || entry.platform!=='linux' || entry.arch!=='x64' || entry.node!=='20.19.6'
      || !DIGEST.test(entry.treeSha256))throw new Error('Unreviewed private dependency manifest');
  return entry;
}
export function requiredAcknowledgement(manifest: Json): string {
  return 'SITREP-HOSTINGER'+(migrations(manifest).length?'-SCHEMA':'')+(dependencies(manifest)?'-DEPS':'');
}
export function assertAcknowledgement(manifest: Json,ack: string): void {
  if(ack!==requiredAcknowledgement(manifest))throw new Error('Incorrect publication acknowledgement');
}
export function assertRuntimePlatform(manifest: Json,node=process.versions.node,platform: string=process.platform,arch: string=process.arch,openssl=process.versions.openssl): void {
  const entry=dependencies(manifest);
  if(entry && (node!==entry.node || platform!==entry.platform || arch!==entry.arch || !openssl.startsWith('3.')))throw new Error('Private dependencies require the reviewed Node/Linux/OpenSSL runtime');
}
export function assertDependencyTransition(before: Json,after: Json,manifest: Json): void {
  const entry=dependencies(manifest);
  if(!entry) {
    if(before.package!==after.package || before.lock!==after.lock)throw new Error('Separate dependency/schema review required: package.json/package-lock.json');
    return;
  }
  if(before.package!==entry.beforePackage || before.lock!==entry.beforeLock
      || after.package!==entry.afterPackage || after.lock!==entry.afterLock)throw new Error('Unreviewed dependency transition');
}
// Include executable owner bits: extraction may restrict group/other permissions,
// but cannot remove an executable or promote a data file without invalidating the seal.
export function dependencyDigest(root: string): string {
  if(fs.lstatSync(root).isSymbolicLink() || !fs.statSync(root).isDirectory())throw new Error('Private dependency root must be a directory');
  const files=inventory(root);
  if(!Object.keys(files).length)throw new Error('Empty private dependency tree');
  return digest(JSON.stringify(Object.keys(files).sort().map(name=>{
    const info=fs.lstatSync(path.join(root,name));
    if(info.nlink!==1 || (info.mode&0o6000))throw new Error('Unsafe dependency file identity');
    return [name,files[name],Boolean(info.mode&0o100)];
  })));
}
// npm's internal file links (notably .bin) are materialized inside the archive.
// External, dangling, directory links and special files never enter the payload.
export function copyDependencies(source: string,destination: string): void {
  if(fs.lstatSync(source).isSymbolicLink())throw new Error('Dependency source must not be a link');
  const root=fs.realpathSync(source);
  if(fs.existsSync(destination))throw new Error('Preserve existing private dependency tree');
  function copy(folder: string,target: string): void {
    fs.mkdirSync(target,{mode:0o755});
    for(const name of fs.readdirSync(folder).sort()) {
      const file=path.join(folder,name),out=path.join(target,name),info=fs.lstatSync(file);
      if(/[\r\n\0]/.test(name) || name==='.git' || name.startsWith('.env'))throw new Error('Unsafe dependency file');
      if(info.isDirectory())copy(file,out);
      else {
        const resolved=fs.realpathSync(file),relative=path.relative(root,resolved),actual=fs.statSync(resolved);
        if(relative==='..' || relative.startsWith('..'+path.sep) || path.isAbsolute(relative)
            || !actual.isFile() || (actual.mode&0o6000))throw new Error('Dependency link escapes or targets a non-file');
        fs.copyFileSync(resolved,out,fs.constants.COPYFILE_EXCL);fs.chmodSync(out,actual.mode&0o100?0o755:0o644);
      }
    }
  }
  copy(root,destination);dependencyDigest(destination);
}
export function assertPrivateDependencies(backend: string,manifest: Json): void {
  const entry=dependencies(manifest),root=path.join(backend,'runtime-dependencies');
  if(!entry) {
    if(fs.existsSync(root))throw new Error('Undeclared private dependencies');
    return;
  }
  if(fs.existsSync(path.join(backend,'runtime-prisma')))throw new Error('Ambiguous candidate dependency trees');
  if(dependencyDigest(root)!==entry.treeSha256)throw new Error('Private dependency tree hash mismatch');
  if(hash(path.join(backend,'package.json'))!==entry.afterPackage || hash(path.join(backend,'package-lock.json'))!==entry.afterLock)throw new Error('Candidate dependency hashes differ');
  assertPrivatePrisma(backend,hash(path.join(backend,'prisma/schema.prisma')));
}
export function compatible(candidate: string, current: string, manifest: Json={databaseMigrations:false}): void {
  assertDependencyTransition({package:hash(path.join(current,'package.json')),lock:hash(path.join(current,'package-lock.json'))},
    {package:hash(path.join(candidate,'package.json')),lock:hash(path.join(candidate,'package-lock.json'))},manifest);
  assertPrivateDependencies(candidate,manifest);
  const before=hash(path.join(current,'prisma/schema.prisma')), after=hash(path.join(candidate,'prisma/schema.prisma'));
  const list=migrations(manifest);
  if(!list.length) {
    if(before!==after)throw new Error('Separate dependency/schema review required: prisma/schema.prisma');
    if(manifest.schemaSha256 && manifest.schemaSha256!==after)throw new Error('Schema hash mismatch');
    return;
  }
  if(before!==REVIEWED_MIGRATION.beforeSchema || after!==REVIEWED_MIGRATION.afterSchema
      || after!==manifest.schemaSha256)throw new Error('Separate dependency/schema review required: prisma/schema.prisma');
  for(const migration of list)if(hash(path.join(candidate,'prisma/migrations',migration.name,'migration.sql'))!==migration.sha256)throw new Error('Migration hash mismatch');
  assertPrivatePrisma(candidate,after);
}
export function assertPrivatePrisma(backend: string,schema: string): void {
  const complete=fs.existsSync(path.join(backend,'runtime-dependencies'));
  const root=path.join(backend,complete?'runtime-dependencies/node_modules':'runtime-prisma');inventory(root);
  const client=complete?'@prisma/client':'client',generated=complete?'.prisma/client':'generated';
  const generatedSchema=hash(path.join(root,generated,'schema.prisma'));
  if(generatedSchema!==schema && !(schema===REVIEWED_MIGRATION.afterSchema && generatedSchema===REVIEWED_MIGRATION.generatedSchema))throw new Error('Generated Prisma schema differs from candidate');
  for(const file of [client+'/package.json',client+'/index.js',generated+'/index.js',generated+'/default.js',
    generated+'/libquery_engine-debian-openssl-3.0.x.so.node'])if(!fs.statSync(path.join(root,file)).isFile())throw new Error('Candidate Prisma client incomplete');
}
// Read-only catalog queries; never select application rows.
const DB_ARGS=['exec','directus-admin-database-1','psql','-X','-w','-U','umsa_restore_admin_20261027','-d','trazabilidad_rrpp','-A','-t','-v','ON_ERROR_STOP=1'];
export function assertMigrationPending(state: Json): void {
  if(typeof state.usesPrismaMigrations!=='boolean' || state.tableExists!==false || state.migrationExists!==false
      || state.canCreate!==true || state.canReference!==true || state.canRecordMigration!==true)throw new Error('Migration already present or insufficient database privileges');
}
function migrationState(): Json {
  const state=JSON.parse(run('docker',[...DB_ARGS,'-c',`SELECT json_build_object(
    'usesPrismaMigrations',to_regclass('public._prisma_migrations') IS NOT NULL,
    'tableExists',to_regclass('public.inspection_staff_roles') IS NOT NULL,
    'canCreate',has_schema_privilege(current_user,'public','CREATE'),
    'canReference',has_table_privilege(current_user,'public.usuarios','REFERENCES'))::text;`]));
  state.migrationExists=state.usesPrismaMigrations
    ? run('docker',[...DB_ARGS,'-c',`SELECT EXISTS(SELECT 1 FROM public._prisma_migrations WHERE migration_name='${REVIEWED_MIGRATION.name}');`])!=='f' : false;
  state.canRecordMigration=!state.usesPrismaMigrations || run('docker',[...DB_ARGS,'-c',"SELECT has_table_privilege(current_user,'public._prisma_migrations','INSERT');"])==='t';
  assertMigrationPending(state);return state;
}
export function migrationTransaction(sql: string,usesPrismaMigrations: boolean): string {
  if(digest(sql)!==REVIEWED_MIGRATION.sha256)throw new Error('Migration hash mismatch');
  const history=usesPrismaMigrations ? `IF EXISTS(SELECT 1 FROM public._prisma_migrations WHERE migration_name='${REVIEWED_MIGRATION.name}') THEN RAISE EXCEPTION 'Migration already recorded'; END IF;` : '';
  return `SET LOCAL search_path TO public;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
 IF to_regclass('public.inspection_staff_roles') IS NOT NULL THEN RAISE EXCEPTION 'Table already exists'; END IF;
 IF (to_regclass('public._prisma_migrations') IS NOT NULL) <> ${usesPrismaMigrations} THEN RAISE EXCEPTION 'Migration history changed'; END IF;
 ${history}
END $$;
${sql}
${usesPrismaMigrations ? `INSERT INTO public._prisma_migrations (id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES ('${crypto.randomUUID()}','${REVIEWED_MIGRATION.sha256}',CURRENT_TIMESTAMP,'${REVIEWED_MIGRATION.name}',CURRENT_TIMESTAMP,1);` : ''}
`;
}
function applyMigration(backend: string,state: Json): void {
  const sql=fs.readFileSync(path.join(backend,'prisma/migrations',REVIEWED_MIGRATION.name,'migration.sql'),'utf8');
  const result=spawnSync('docker',['exec','-i','directus-admin-database-1','psql','-X','-w','-U','umsa_restore_admin_20261027',
    '-d','trazabilidad_rrpp','-v','ON_ERROR_STOP=1','--single-transaction'],
    {input:migrationTransaction(sql,state.usesPrismaMigrations),encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:90000});
  if(result.status!==0)throw new Error('Migration did not confirm commit; retain backup and inspect metadata before retry');
}
// Used by publication and failure-injection tests: no migration or restart before a validated backup.
export async function backedActivation(backupStep:()=>void,migrateStep:()=>void,activate:()=>Promise<void>,verify:()=>Promise<void>,rollback:()=>Promise<void>): Promise<void> {
  backupStep();
  await activateWithRollback(async()=>{migrateStep();await activate();},verify,rollback);
}
export function migrationOutcome(attempted: boolean,completed: boolean,list: Json[],backupRoot: string): Json {
  return {databaseMigrated:completed,databaseMigrationKept:completed,
    databaseMigrationOutcomeUnconfirmed:attempted&&!completed,databaseRestored:false,
    migrations:attempted?list:[],databaseBackup:path.join(backupRoot,'database.dump')};
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
// File hashes from the retained 6bc08a7c backend/manual archives and 3245f365
// web/app build, matched read-only against Hostinger on 2026-11-04. Old static
// assets may remain for open tabs; they are included in the preparation snapshot.
export const REVIEWED_FILES: {backend:Record<string,string>;frontend:Record<string,string>} = {
  "backend": {
    "dist/assets/branding/gobierno-mendoza.webp": "ad6dc4eb052201b33ee7909685e9bbbddf1786185787a3adb75d00d38d474bbe",
    "dist/assets/branding/mendoza-marca-horizontal-transparente.png": "0034ba6cd9fc9bbcb2f8008ab4134d83cb4ef32434a45ee238a9aacc3b229543",
    "dist/assets/ocr/NOTICE.txt": "3a63c5fe41ac1de7d329f9bdba3fd136c6c54e98012a78889dd61c464d512f6a",
    "dist/assets/ocr/spa.traineddata": "e2c1ffdad8b30f26c45d4017a9183d3a7f9aa69e59918be4f88b126fac99ab2c",
    "dist/config/config.d.ts": "a380bad55d05728cf8bbf229f7b46ba0eece0f82b838128f205083799e1842cc",
    "dist/config/config.js": "1f28ec06cbfa8d7b1163dbbe7cc431e365862914391a6b8be4de01f2df20a1e3",
    "dist/config/listenHost.d.ts": "0cb4e76d90090128281eee94138934f67c16f891f042f757ef4fdb5a018228d2",
    "dist/config/listenHost.js": "d8e57310818b4ada364f89feca108c15cc7a4189ab74617081148ab2b05a3ecc",
    "dist/config/scheduledTaskGate.d.ts": "adf77df0bc4f035b339a9555b49d72200c4ba720e59e84636b0188480d3ec398",
    "dist/config/scheduledTaskGate.js": "08920e1cde7bba68eb763a5b82798ed2778b8a263a65c18203d7091b4cbb080e",
    "dist/config/swagger.d.ts": "792407e5f6b398d081ad7663ed659ff50af71849d7d148f6b3e9b63f69fbea96",
    "dist/config/swagger.js": "5550123d6c1c6ad4e777ce596e994ff40e8efd3ca54bddc4ea677a7168df9bb2",
    "dist/config/syntheticPreview.d.ts": "670a4d8520f59632af9a7ada0e6c1bd87ccbac629a5b2f7621de8f77386b5ec8",
    "dist/config/syntheticPreview.js": "dcf50463837a0880556ade60d7762df9940979eaaf8a82272aa12b368a5a79d6",
    "dist/contracts/SitrepRegistry.json": "068205ada9e49ddd6d60a2a6184d6e94bed8f32be54ab79fa42cb90958ec7bc7",
    "dist/controllers/actor.controller.d.ts": "9a0b8eceef8869fff5f0df51d7202db4e3fba8fe391c56182bb63ec6455a9e28",
    "dist/controllers/actor.controller.js": "9e138131a272513f6962136cbcf1288054b3757c72f80ed619bbe1338feb38ca",
    "dist/controllers/actorActivity.controller.d.ts": "11f0cca634335d074b4ca062fa41e34d48e4259d04216172aeb65b243047f704",
    "dist/controllers/actorActivity.controller.js": "30168628fefcf3af5d95ee6b6d1d936f3c341271c16352c22509298a5c2a6bd2",
    "dist/controllers/actorDirectory.controller.d.ts": "21834d45a3d3c548c91c01caeb61f353052782a87bc6dee2fc29727980333c39",
    "dist/controllers/actorDirectory.controller.js": "d31170bf9353cd117ee32a5a67eb0f0eca053995c3377e82a1b71f6c2223b665",
    "dist/controllers/actorFormDraft.controller.d.ts": "5395276c0ad9239e186bbf3ebe7129ae9755dc8d693ef39f73d2173e9be0e828",
    "dist/controllers/actorFormDraft.controller.js": "f66d916cbf37524f5c2cc4a2ba0a9a92fabf88f2e33d1774ec6905083fd4d563",
    "dist/controllers/admin.controller.d.ts": "c575015ac4dc57f8f36a0bd0b0106d58f4e54f3fa7d8e614702a3c404e892e6a",
    "dist/controllers/admin.controller.js": "7b75e211ff2fcd15d9c02b26ad5160d5685750fff65d1cefcca3e0833ea71ed3",
    "dist/controllers/analytics.controller.d.ts": "a00f4a26b3459b54d6273c21d9f48e59e539f6f568d74c7b1533b37809786d58",
    "dist/controllers/analytics.controller.js": "064669119c24f5d85de447602941a55ceec7be29f798a5022c13fa6329547eda",
    "dist/controllers/auth.controller.d.ts": "48640b8c62720ee2bb8c2f3aa7ef09d4660d37c3565f7bb0a50e3ea452e49cc8",
    "dist/controllers/auth.controller.js": "3d1036d47e6d4902e18681c6bdc0af2cc050de47660d9929dd3f2e78b0ddef35",
    "dist/controllers/blockchain.controller.d.ts": "f7e30bfa76073c89a98cc1bb0c468e672212907b82778290eca248547efb1de1",
    "dist/controllers/blockchain.controller.js": "69aaaead1ff288547489c7817ce3515f5a282d762af21be729b5e340573ad1c0",
    "dist/controllers/catalogo.controller.d.ts": "cab5dd3f1e00773dea33d4f128b27fde9ecfa21fa65efe5c3fc67e789d2d185c",
    "dist/controllers/catalogo.controller.js": "6383efe0e989b8ce7247861c799e55f152154950d1b3bc0d9a3fdf8dedd003bb",
    "dist/controllers/conciliacionExterna.controller.d.ts": "58ea8b0601a641350e1b12d6e0d7a1e63285ac9c1861ebeccec75001a341445a",
    "dist/controllers/conciliacionExterna.controller.js": "48b18533dfd5b851f5e8b1c44c17bf0f3d8c4d6ae22287d51a14aa9e305505ab",
    "dist/controllers/documentPreview.controller.d.ts": "e0722dd6a9cf004433ef11079503917411d2660f32ed6cc2ef237267bebd95d3",
    "dist/controllers/documentPreview.controller.js": "4cab90dd8dc7a3cbeb63c1eb2a093ca8321e0059cfe5aa4db017ca5d338f9665",
    "dist/controllers/documento.controller.d.ts": "00853ca350b2845afc8f85b1871914c4442f50082c7840723d0905a970640d90",
    "dist/controllers/documento.controller.js": "b0725c9fe1e285baf25d1e4893b8c7cfdc333f7e72f26b47a9baf3c2fc5434a9",
    "dist/controllers/empresa.controller.d.ts": "7ba2b2d4c1d61c85d2a91d75b832e32881d089aafe20888fe37dcd165812601a",
    "dist/controllers/empresa.controller.js": "ccc7661b1ee2cf419fee3121330fc3be6916d500279cfd14cd7072e1357dff5e",
    "dist/controllers/generador-fiscal.controller.d.ts": "8d387605ab9d42cd128e3f753a9541e5ac032fdf1e5225a6f10f0c19edcda93e",
    "dist/controllers/generador-fiscal.controller.js": "891afc417c34a8dbf7d2bae6117318a4c7e52ac3b00bb53bf1eef24b0d3ec3fc",
    "dist/controllers/inspeccion.controller.d.ts": "e69418b3ab1ded21ad5343bb34074bbbb788784d14394e99cda525855aa79d10",
    "dist/controllers/inspeccion.controller.js": "45d4de29360c872275fe69be74e1408e270e0e8d8245a987e03361790330a6ff",
    "dist/controllers/inspection-intake.controller.d.ts": "f7dc1e42644353c26d10016ee6e35e77bacf98db31f30b702da561635570f9dc",
    "dist/controllers/inspection-intake.controller.js": "984d2d31ae4673088d256d18fc034990248d6e99ce3a6e62482e72caf89801ed",
    "dist/controllers/inspectionExchange.controller.d.ts": "9d8ff0da85bc7412f4d0a73f093e054fa31d94ad104158c1ab0f418ce7a56081",
    "dist/controllers/inspectionExchange.controller.js": "b4c406c84ca1ec1f0fe5b8d01e582ec7f81cef726f8adea6ae12beb266e73c87",
    "dist/controllers/inspectionOperations.controller.d.ts": "a55d7a61afadd8759b1c96ed7f1c8c88f1a03a1495dbfac6ff38c93a4146da36",
    "dist/controllers/inspectionOperations.controller.js": "36d01fdc7e5b4999efa7e6e3abdbb260d423b89101f99c28c2cd9989eabc49a0",
    "dist/controllers/manifest-certificate.controller.d.ts": "60588e0a2ffb3a933e5198433a1541bd9715a8bc824f33c4c3fa7e50990a1964",
    "dist/controllers/manifest-certificate.controller.js": "7a6c44651d3630c99e253677fe4945390a2dc798f5606ff69fb3257d33ca8add",
    "dist/controllers/manifest-proposal.controller.d.ts": "5f3f60bed5433578f59d8116ccf979bca33ab505f7819532bcea503a27a3e0ab",
    "dist/controllers/manifest-proposal.controller.js": "fab26ff448936b6df2ec8330fbf1610e7729246fef9236801bb74d5eaa617fd7",
    "dist/controllers/manifiesto-adenda.controller.d.ts": "9c146138863a746e7372db849f48ef14629be98adbdb42817236399997a90d99",
    "dist/controllers/manifiesto-adenda.controller.js": "382ff87471331af3513f4fc9078fa16c3e6efd8196652e5dddbc1ef3bc462c1f",
    "dist/controllers/manifiesto-delivery.controller.d.ts": "b408a16ee411322954bb9112bb9a5d6c92882f726941bca9d54e2cd66bbb1b8e",
    "dist/controllers/manifiesto-delivery.controller.js": "9deb5bb555cfb32b1b494dc7abdabd715edeb30cddc412d5e6529903eab7f122",
    "dist/controllers/manifiesto-excepcional.controller.d.ts": "6e4661a320609f688a12a87ace2051cbf0c8665f9485c9524646ce98e2573555",
    "dist/controllers/manifiesto-excepcional.controller.js": "9b04d5ce1e33dd01f59633bb17d5009add564bb8acb95ade5ab90d3724e38200",
    "dist/controllers/manifiesto-gps.controller.d.ts": "b9bc386429d8dddee5c86eee8c11e1ab07ecc660b8bff079607aa8e75e4f3e97",
    "dist/controllers/manifiesto-gps.controller.js": "d85af634c3aeed50f1d28e1904e9469b28e898d9565cd52341c9518e466e48b0",
    "dist/controllers/manifiesto-incident-command.controller.d.ts": "d140a8b05476176fd69136df2eab047ee9281afba17f3efa43d5d55f7b41d81a",
    "dist/controllers/manifiesto-incident-command.controller.js": "66b6d7a9a6e6e979a622d88cced5df1bd8ad515c25ab65ae45cf98ea2004e6cf",
    "dist/controllers/manifiesto-query.controller.d.ts": "d8f4d25e191ac6c7de067c0a28b1b879a5e7da450a142c5035e1382d5c7074a4",
    "dist/controllers/manifiesto-query.controller.js": "201f9b8bef3fdd04e0fa85764d0102c035365bac7b4582249ca43f796718f749",
    "dist/controllers/manifiesto-workflow.controller.d.ts": "b66c46c5c9f711a9cb988f3a23c37e3948eb01df9160ffb90a7e4f3fdc204506",
    "dist/controllers/manifiesto-workflow.controller.js": "4612c67b3fabd31580a2a80fd63d9e010cfd31426af963c055e02ccb82227f1c",
    "dist/controllers/manifiesto.controller.d.ts": "0d84352425c3891d941777d9610000fadef66f8660d679dd12f4a7f4575c7033",
    "dist/controllers/manifiesto.controller.js": "15d4721b3d0452f2f7ade812c0f78db489821c527667284a955e853df5e4bfe3",
    "dist/controllers/monitor.controller.d.ts": "383ee9316e2b737e8a3ddbda94a0f724dd11e96786b8dcf17ce3b9e9040f8002",
    "dist/controllers/monitor.controller.js": "89664b02c7431edaca4c05cdf005ec8b54ba0c9050bbb4a846005f09956dec19",
    "dist/controllers/notification.controller.d.ts": "ff4ffcc8ca03efbbd53998de968494601e05c97b9345710c655105725fa22c66",
    "dist/controllers/notification.controller.js": "70c8319d57f4fbf42bbb4c25c11177e1568688f776738809e556e40a928668f8",
    "dist/controllers/operador-fiscal.controller.d.ts": "dd96d63833f66abf9433242a88b0e8c8853d9c755f3f7d09e3380dd7727e7608",
    "dist/controllers/operador-fiscal.controller.js": "517d5a5210617ac46d7c504dab4fc2a8c0d67da8b208473068970847f43ab291",
    "dist/controllers/pdf.controller.d.ts": "93c7864f2635cc202efa763f104b05b41d90cabee0efbf34ceb395fdf52d1649",
    "dist/controllers/pdf.controller.js": "7ec1f3537c01b70c0c5c1c4963701cfb7b2a5c9cd3a4762994d5104b38823cd1",
    "dist/controllers/push.controller.d.ts": "a6eb8f05767577a3f9fa5a253b8a4ba1bd071540ecd966607141b0e889639b4a",
    "dist/controllers/push.controller.js": "5bb753baea0d4fec23763781387c375bb77f90e25d1b4325ce5b530281ce7933",
    "dist/controllers/renovacion.controller.d.ts": "34dc9b7a33082bd83e78068d180f838c58c9af98046d5e4d3cee439e40e9b9a6",
    "dist/controllers/renovacion.controller.js": "6c904689b6b236ded6da6e4dcf87a1fe53ea8de071e5f30f1f6134b3d1d19053",
    "dist/controllers/reporte.controller.d.ts": "a5206f70d06db1ee14576d0c7b7eb497eb715d787d11ccaedf53113534cf38f3",
    "dist/controllers/reporte.controller.js": "5f128e1f377f1ddb0ce111fe7ba3353dd3ad1547def8c490477c96aaab676650",
    "dist/controllers/search.controller.d.ts": "cc972e5901fd29786a7328ce6cff96a0714d3234199913da4d2ff1b42381fce3",
    "dist/controllers/search.controller.js": "1f19dda7cddbc357d1854eb3b2e67b2d343a06c4915b5f5a6bd5fe405ef256dc",
    "dist/controllers/seguimientoExterno.controller.d.ts": "18847ca7c8921224385ff81bbfd9fed864fb5984f2635efa0f1a09ddab8f3dc3",
    "dist/controllers/seguimientoExterno.controller.js": "3ce021ac28c0e0946a1cd6435712e3ed67314239bff6f7052cea4aad52622a5d",
    "dist/controllers/solicitud.controller.d.ts": "40a1b1b3ea2d6763ccce92abcecd70729b040e47e334a765cfdaff48e70108d6",
    "dist/controllers/solicitud.controller.js": "867573a1287739d23fbe17c4ed7fa9295e9dc7972fda9cd74b37d06267ee413f",
    "dist/controllers/support.controller.d.ts": "17e601cdde62646c15020d7f0ca0c27d6e267b5c38dff912e959a1c7070b5fed",
    "dist/controllers/support.controller.js": "5a429595bf33bce4534390d293c8234fa5e4b69fea5a111522ad08a3bee61e37",
    "dist/controllers/tracking.controller.d.ts": "a32fcc8b19d0a82da42b90b31e39c398583946e3ee6d15b939843d380ef75219",
    "dist/controllers/tracking.controller.js": "938e4b87739f24712f0109812f87c4ee575c1ea6651c5b7e5e27503558bd4069",
    "dist/controllers/training-certificate.controller.d.ts": "14d634e365f238feb53dd54030d896cd4908d57d9ccea72e7b5e16e083edebc6",
    "dist/controllers/training-certificate.controller.js": "863fa956986e719f68b37af16fc1ca54e7fd969cccbadf79b6c5b80ffc8c5f00",
    "dist/controllers/training.controller.d.ts": "08fc24e4a71d03d3fdbf28849ceb678b13b7f207c58fcf629f56db209e7c31bc",
    "dist/controllers/training.controller.js": "cae26019ccecba45b8746e87770eb134cc9c02c875fce48967a8471d7406b025",
    "dist/controllers/transport-gps-session.controller.d.ts": "da49929086ef7fba1f57733d6807ccce04c31c3fb9da70e1087dd863200cb57c",
    "dist/controllers/transport-gps-session.controller.js": "9b4927f3483104494a0fc542b6acb3afa69e632571c93d1d1a3721ea43df2722",
    "dist/controllers/transport-handoff.controller.d.ts": "d945b8740df23ada9c9957d5effdd7d57c27f9d9dabb5846ddab0ad26ba22788",
    "dist/controllers/transport-handoff.controller.js": "2afa6a3a8d059a6d1a6e20574040587be7b631e540449c8d5988f65f9f008abe",
    "dist/domain/actorActivities.d.ts": "eadd426c376c355e269b3d551d5d54cc1fee82628b010449bf159f3fdf5e7d51",
    "dist/domain/actorActivities.js": "79e5e8be92c4c6cc473aa50ab3631b91cbc291e061e1a1f09c976f68694d2048",
    "dist/domain/actorFormDraft.d.ts": "3d2a044242a2907ef59d15a3ffce14f9b4ce3b685d31caaba28b0ed27f6af0a1",
    "dist/domain/actorFormDraft.js": "b490fa620739875e8e3dcab9db157382312cab304956a36f7982af07d659c4d4",
    "dist/domain/actorNumbers.d.ts": "8f41f8be6ec19334c2262d6c163b31ca04eca7dcc2a47f43d6daa3a82f54b5d9",
    "dist/domain/actorNumbers.js": "3d439a6526a8a7b6c64e24faf686836f0318c6cf5955fc72452cae223665e2f5",
    "dist/domain/addendumAuthority.d.ts": "eb1a870ae4037d0260cfcf094e2b2875c189ba747e255866982d0d71c9f320c4",
    "dist/domain/addendumAuthority.js": "75065d95ea648ed568d37366bb4153a97eaf4df4e7620648dc11d0802f2d9b74",
    "dist/domain/certificateFindings.d.ts": "cda7b3d78db53da7b66bde8e4da12997daf7cd05351a5a44fd5cd7acc65b4380",
    "dist/domain/certificateFindings.js": "6b4ea52642bb0ff105a2fd090a7525af036e6dd1b0e35b29192ae45fa22895da",
    "dist/domain/conciliacionExterna.d.ts": "eae516b8cf789c1f9e06b6a4dcfa9a5130f1b7c22e52d98377ff20f1947d83ff",
    "dist/domain/conciliacionExterna.js": "ee2b8772b82b75a17c87eadfa515c6ab2be6b7df442b28d55444a4ccb998fb90",
    "dist/domain/electricityReading.d.ts": "d3a549af6f1732ab1782dda3fc4d09a345df03abc02fea914142e7df4501a784",
    "dist/domain/electricityReading.js": "4d419137dc98942960aea177dd5ad72d61af61706e381f7f6171d7187fe12164",
    "dist/domain/empresa.d.ts": "312554db4e2dac86f5daf708e297f85eb7586bbe3a52d8cd7b4328c6a4d7c493",
    "dist/domain/empresa.js": "115d898a5e34e5e95cbd1830190010c9bfcf2493381c6ac8c8ba32d5314cf007",
    "dist/domain/gpsNumericEquality.d.ts": "45a6123df7d1f1daf441158c90e9a8300ad49d539a3a0ab3f025a0a122fe827a",
    "dist/domain/gpsNumericEquality.js": "9ece50a2b74e672e96ffa111cdc50c452d1d788f64daad0f38a6f45951426c57",
    "dist/domain/inspectionEvidence.d.ts": "d7e24aa633634a597f5862b47d563d9091b9c2a9d7061dc2846b1cd0036d74a4",
    "dist/domain/inspectionEvidence.js": "e31798e328487ea40ef98204efbe768cfe774351339a3fb15b87eaf859573e1d",
    "dist/domain/inspectionIntake.d.ts": "0115f5aab5e913f0e47ece4f4d9e73b669466c74630eb67b264b86a82545a244",
    "dist/domain/inspectionIntake.js": "29d04baac8373348c730c61823d5ab7f982c8d3628f154aa87791bf5e43c3d3d",
    "dist/domain/inspectionNoticeLabels.d.ts": "e8ecdb297220aea3701ead04b0fa0eba19ea5729d3b825d1fd0ded8a2414bcf1",
    "dist/domain/inspectionNoticeLabels.js": "22e9027c86c50b57b6354c4acdef7e4b93bc0c88a8d3b8aca10caff1741d651f",
    "dist/domain/inspectionOperations.d.ts": "67231629d138216bf21ccd4e1b7acd4316cd8b2e57ab0f586322c3cec35d2fac",
    "dist/domain/inspectionOperations.js": "7751fc5e19ff96d2843db7090ddc374b2b9caeab56592ecf7072ebf5ee496b2d",
    "dist/domain/licenseModel.d.ts": "cf6b98c25e505e29f75d641732d72ba2ec94032c81864f94e69bf62c3947650b",
    "dist/domain/licenseModel.js": "466786e4c99e0a628ef8e2a8ae67edf815e929abf83bb679e5347b1753954090",
    "dist/domain/licenseOcr.d.ts": "412cb9b6ed8fdb822fff59d772490ef714522bb030926c89bd0978ab2778b65d",
    "dist/domain/licenseOcr.js": "c87af7c6c1c8dac99cebfe3b7f233673a0a4c6723c8ca37e907c9853ba1594bd",
    "dist/domain/licenseReading.d.ts": "7ce476f392661c8a928b046e530c472771ce76e7eef0093ee06d2b8973bd564c",
    "dist/domain/licenseReading.js": "407da4351d21ab52ed2dba021ccb27eacf569dcecc53910d98867e401364083c",
    "dist/domain/manifestAgenda.d.ts": "266f4fcb2ca61890512d721b5b491fa9c729c879d204b9ac972f3ccf0630a35e",
    "dist/domain/manifestAgenda.js": "a7e5109096b85a2f9782b49486570c904b9545b51c22c81a8901878c5a6d6850",
    "dist/domain/manifestCreationIntent.d.ts": "17cd877c5b6e04fc91abcd7c7802eaf88580364536a22785d9a7c049564d4b81",
    "dist/domain/manifestCreationIntent.js": "f2bb4584d3346c62a3e7da3f569026d035fb9e78ab634ed8db191b6afb59fe52",
    "dist/domain/manifestNoticeContext.d.ts": "ae05101f6891935119a155462dc8bae38097878c7598aaac721a9a9c6a213f65",
    "dist/domain/manifestNoticeContext.js": "7c780577918e39be5e7bf3ab167f5172470a06eead6232c50d4834f047c295ff",
    "dist/domain/manifestPartyEligibility.d.ts": "aa1ac2c39c422b2f22f5f751bb75cf7d780f5420084bd23431339408bdfe6c61",
    "dist/domain/manifestPartyEligibility.js": "edfa63db67239050d4d7fafa3d4281da4cab32b5969d614aeb079df4826611cc",
    "dist/domain/manifestProposal.d.ts": "062baca52b42a234e3ca15cfc91e0bdc10b3083233cb72ab7f6ebdb2ae6fe1b5",
    "dist/domain/manifestProposal.js": "8476aa147072b0c0fffc830c3d54bb0ed5fa1b3cc4b1e4a6503f312bef15929d",
    "dist/domain/manifestReviewAuthority.d.ts": "79881955653e7ea8a5af501ed8cdc462c7c58d7385992ae6eecde6a2c8f95fd5",
    "dist/domain/manifestReviewAuthority.js": "b34f44e1507bf0461229fe9836755c428523a836520625c78d167a971a7efd79",
    "dist/domain/manifiestoAdenda.d.ts": "0f082ebf3351da05bb99c6ca3c3ad499a04778d9be7cd89af763c45cebb0f6dc",
    "dist/domain/manifiestoAdenda.js": "945390be50a6aa5f91f3735389974296c586cc753ba3d6dcc3b22b5353c12fa2",
    "dist/domain/manifiestoAdendaDocument.d.ts": "9daf6b26824ae731fa8220fc14f2fa3c3161ed7eb8b28ec862ac45fd0d06b584",
    "dist/domain/manifiestoAdendaDocument.js": "bcf1ff014cba5273477a9ce4ec4bc4b836b6ecc90651f7907a6246131cb639c8",
    "dist/domain/manifiestoExcepcional.d.ts": "f0a44cee425ad3861995a9acff729c2f9719b7511ece1ab0bb0577292c7b1f3d",
    "dist/domain/manifiestoExcepcional.js": "c02564faf108041d34692a516d5a1b53e8de27184834bffc0842f4f633cdb6a6",
    "dist/domain/manifiestoSignature.d.ts": "314261d71c7206b3b466547178247068a34e81c8f3942482647cd32845f40281",
    "dist/domain/manifiestoSignature.js": "6b8a2560e94992591d3c19a060ed13678be0eda7ce4a41cfc95b9b3039c8f2d5",
    "dist/domain/manifiestoTransportAssignment.d.ts": "342cbf4be1f7e77276d264d480b3d20e8428ac8e278c622793d17e61a6ee86f5",
    "dist/domain/manifiestoTransportAssignment.js": "c818113a9ce4f2d4d856a9dd0de51e9775d3eb93d3f3d8dec529ac0df76f83fb",
    "dist/domain/manifiestoWorkflow.d.ts": "00369e8a7bef11b19277c978baf33889439ecb049777c8c7b6784e96b000c910",
    "dist/domain/manifiestoWorkflow.js": "ffffec573d5c0bfc2fae4b4004a7bc6ac88f39a27d520f3e456caa36a8cf3799",
    "dist/domain/operationReminder.d.ts": "e449ddd4714edcfcb31521e56ff31203bd8b1027e58a7fc5ad730123cf85e3cb",
    "dist/domain/operationReminder.js": "eef5c716999189bc60cb75c03247334efc72a6a6ddad1e20ab82464406c3d059",
    "dist/domain/operatorModalities.d.ts": "284f000ce2b452ab0b6b3f2f30a0a6f88b34ceab140159c6a8683c7b4fbfef67",
    "dist/domain/operatorModalities.js": "5da57a99d3ba701c37c8184217581b6d93700118a3204a00651a06b4b7060645",
    "dist/domain/padronEmpresaPlan.d.ts": "4d5169578472c0f00944093eb310adb0defc174cb2ffddd719210426b10f3929",
    "dist/domain/padronEmpresaPlan.js": "0a03006f7a4392a4e58f954a46b69a901c86f21489ee7f6a77e45befee11a902",
    "dist/domain/partyReview.d.ts": "2bb1279718991b0d9f06f31ac5cc59831f154ef913f5afe7f04d83766d157b15",
    "dist/domain/partyReview.js": "ae123dcc371db088bc0a196bd9e9be6cfda3fb16288c88c554b296e99e4b7d52",
    "dist/domain/paymentIdentity.d.ts": "d75c1fddcfcad866c82941496ee21940a07b91b7c0de20d6a49517719c63ce38",
    "dist/domain/paymentIdentity.js": "9f1ecd2d7d0e4643ec651b8c78b73052cd61cefccccf8e934ddfacba18ece76d",
    "dist/domain/registrationActorData.d.ts": "884233ac74b58cc226fbf764408e19be5fc7f875f18da210d211e01f42aaadb3",
    "dist/domain/registrationActorData.js": "89d1b3d605f2a4cf4ad03c190aba8d072e47a44ef972d46989c358a64121b6be",
    "dist/domain/registrationFleet.d.ts": "fc859c34683b2ef362a7a0d8b24e98ca756b40e8ee59e7000432236f0317c491",
    "dist/domain/registrationFleet.js": "7f335f4a5d422525edf12eb5317826a328dba43851c6b7297dffdec25506a152",
    "dist/domain/renewalNotice.d.ts": "6d088ddcfbec1317fa64fc473c6ea72b44c149fdd73845f9973c18cc1f54c67a",
    "dist/domain/renewalNotice.js": "1e417f14afefae66d71c8e389430e3000fb1ebf2718d53308237dbf2fd97244a",
    "dist/domain/renovacionPolicy.d.ts": "fdfa700fd86c8bd55ad4216f6afef3f0c91102390632a298a5941ce35f0c46f7",
    "dist/domain/renovacionPolicy.js": "a7b0b2e393b4d350bc08b9bb8a792c2fb462e8718ca0441254365740d1cd5925",
    "dist/domain/trainingCertificate.d.ts": "bb47f1dfa436b86a889c436b6260916debd1180f22e3ba6d250474cce8848865",
    "dist/domain/trainingCertificate.js": "07b5fd3ae7152de21afa1bd1000864267102572835ccbfe0681afad0a5b649d0",
    "dist/domain/transportHandoff.d.ts": "1f901555d89bd4df144ec4282d40fdd9c565db53a690570cb467d66c8299143b",
    "dist/domain/transportHandoff.js": "ee04cf5d7509432504fef8d4f2bf602589e0671c1af4495e1eaec61eeb57220d",
    "dist/index.d.ts": "8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881",
    "dist/index.js": "e5c95a7ffbbfc4328873b80141e78b70bf1a204fad8d2ad1f167d003f2c6e30c",
    "dist/jobs/alertCatalogue.job.d.ts": "3ec494fce1668280652e85c1e7ecb1751746ca1c177c0f4c68a2a48bb82e93b0",
    "dist/jobs/alertCatalogue.job.js": "58c22578dbe6bc11cfbe0a573e970714c68792dc5b63d94deda2c077b90319e9",
    "dist/jobs/blockchain.job.d.ts": "f4d6ad2539ae3a96c865f4cfb639455ed9e044636e3ebbd59d3dc551047d548b",
    "dist/jobs/blockchain.job.js": "9c5804d21605f6f9ab152e2af72800819ab7c1c764bff610cc617c770b01bc51",
    "dist/jobs/manifestSignatureReminder.job.d.ts": "ce5e1c0adcd8f6cd75dca41ba9c2b7f59dfd08c9fa39dc6101052b39b9cb6aeb",
    "dist/jobs/manifestSignatureReminder.job.js": "567f906f98a368c8e77bedb189fce93ac768d8defd6d013274f99e912db39c6d",
    "dist/jobs/recordatorio.job.d.ts": "66f0b440188f0452697c08e9fcfbb9638f4affe8df4675d838a6db45b469023a",
    "dist/jobs/recordatorio.job.js": "7bd7e5a65365cc122793a43d960eca7536acf979025ca1920e06b3c6e4b34c68",
    "dist/jobs/seguimientoCierre.job.d.ts": "ed3ce83f5ef22485cb21253c48d6b10a05ea6c440ed7920c09c63dbb718dffe5",
    "dist/jobs/seguimientoCierre.job.js": "5f26cd15dbb076394038baff70dbbe8a1b58895120a821ae50d9e9f38c3471a4",
    "dist/jobs/transitDuration.job.d.ts": "2cdf016500a0b3e025b5036ce439547e8c24283a101c8ee1fb44cdb53fc8bc85",
    "dist/jobs/transitDuration.job.js": "c0685f0cb1d2da7e5d1e2fe1e1ebe30e8ca332c83066391370e3e65a820ac9f7",
    "dist/jobs/vencimiento.job.d.ts": "e250332ff41784cd17c44965e51f5039e984259597db9cbe08337f64db639b61",
    "dist/jobs/vencimiento.job.js": "0c999d77bee21bda264553f2cf8d7f9ce0bb4312d4e783c1d3fd6b43bcb4abd9",
    "dist/lib/manifestTraining.d.ts": "8605fb448ba7afebe5b798ef7b3e87728c61979fd933f1aa2195db3aa7b55966",
    "dist/lib/manifestTraining.js": "36fc2954f575f3e9e7cc3f9d913a6ff57a11423a6c1f191b3885fb28b88ddf4c",
    "dist/lib/prisma.d.ts": "2144a01f9eb87b2ffe7d28149bd6303273ff98cbd96903141cc979f3b712d472",
    "dist/lib/prisma.js": "0e51ccfa7bbb314b94d83f977860c73e6004116bb155d47bcf66bbdd8b4976bc",
    "dist/lib/prismaConnection.d.ts": "bd165f00ef55e4fd84b196ab6c1f94405539b252e543a50a9620efe01b00f800",
    "dist/lib/prismaConnection.js": "4474467b6f511180922f4416e9d8bec48b7d4d93559c4a3f5802372cc15ffda4",
    "dist/lib/trainingDirectLogin.d.ts": "d2b8f4c24a8413579a1315cc943223bce0303c322167bcf5820e2dac694c3cb2",
    "dist/lib/trainingDirectLogin.js": "1cc7267ed25d7a52030ca16b839f50a42619b8dc0a97d1af9c13d417b1f50aec",
    "dist/lib/trainingScope.d.ts": "7e775e56ffd795bf2faaa628f39ad1eb2070c8d100df3ecafa1c354018c9f525",
    "dist/lib/trainingScope.js": "27ab89388e9c23bb370fdd2a1b435da793dc43c8d35ac2a3770ffb08275116a2",
    "dist/middlewares/analytics.middleware.d.ts": "dfded9c21db280ffb9fdc8e5be6eb80d1f5f535dbce4660a38510a2b9af61a18",
    "dist/middlewares/analytics.middleware.js": "89305217814864e02840771444a10b778d74cf9c52fb9f78bc15e05841e5d961",
    "dist/middlewares/apiAdmission.d.ts": "60a8d1e104b571c2368f754da195ef02fc4f0d7f666d626ba7eac3b98653a2cb",
    "dist/middlewares/apiAdmission.js": "d57779599f82c3857893c19692d479ccabf2fe2431cf5975d575f09cb3faa7a5",
    "dist/middlewares/auth.middleware.d.ts": "f6d0d638221e07e2c7f4e76d98a9bfe119303dc947e4eafeb5e615f63b8ed9f5",
    "dist/middlewares/auth.middleware.js": "339114e48e26bf669f055ddfdacb310d33e19d54442f15e45003a4aca53ea01d",
    "dist/middlewares/authRateLimit.d.ts": "a34d50ff406d0311ee6ebc0106ccb81d9eaecd296f751d001bdd72744e520c31",
    "dist/middlewares/authRateLimit.js": "b05cd0cb39cb4207e12c250d03fad579c7777631600fbda31fe313d2476da1b9",
    "dist/middlewares/errorHandler.d.ts": "66b90b3cf14e7109f444b2cd01d3e88172e8d34be4d03438857449980f26a1d6",
    "dist/middlewares/errorHandler.js": "7d6ca006052be75fb2239b0d98c58615a3abd37757ad47adffa4a30f9550fb7d",
    "dist/middlewares/trainingSession.d.ts": "5499fbcce58cfd0c7eb0b543a897deb4e7c839f86b6f37c9f77e1ad394fc10b8",
    "dist/middlewares/trainingSession.js": "cdc2373e183427bd6053686d39277b66cb74cf0be38dfcdee149327c70d8f872",
    "dist/routes/actor.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/actor.routes.js": "06ceee335ea4e4886d2f977e3bc9b74f4f21de1fc98e6cbda17c91ed6afc584d",
    "dist/routes/admin.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/admin.routes.js": "ed2dce30f29606b7c39da8a68c71d86860929627770ec5570b387804b2017966",
    "dist/routes/analytics.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/analytics.routes.js": "0665b7fd2954ffc1593440d74b34b156d33caecf89a02e34c1068d246535aabf",
    "dist/routes/auth.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/auth.routes.js": "72cd3ba2511ce49d82ed2e07dc5090dab263c36b9d82f8f1430281ae84cd4008",
    "dist/routes/blockchain.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/blockchain.routes.js": "892b59c54289e9d0a1dc8f365cdc4bdbfc53d078bbd95987427b94847067391d",
    "dist/routes/catalogo.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/catalogo.routes.js": "ebb25bf24a84ebe6f18a3a1a58f2f00f263de04a88ad5c4617fd6f58f5d9cf7e",
    "dist/routes/empresa.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/empresa.routes.js": "0e50049e7b3fbe4741cad784dbf318bb71a0ee3100875bb9aed6970d81c038cf",
    "dist/routes/inspeccion.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/inspeccion.routes.js": "9fd5aaa8b0a2bf4f5ec2279aed34b704aab5d5864e736ffb8507687fe47ef9c9",
    "dist/routes/manifiesto.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/manifiesto.routes.js": "f6bfe032fd92a658890e20620c9c4b28eac36db21529d4011048cc221d27a2ff",
    "dist/routes/notification.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/notification.routes.js": "1abca9ed6a5367577deffea9030ce6fdb6fe944e6c6ef45072a50a36f8395041",
    "dist/routes/pdf.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/pdf.routes.js": "b874bb84c73db183059aaa893a8ef3bcea83a992c0d390e545d3cf5f60e7ca19",
    "dist/routes/renovacion.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/renovacion.routes.js": "afd6c7c6e91c8ef2b79b05cd5c2afb52727e99de5bd1e1e151b322b02888c3d8",
    "dist/routes/reporte.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/reporte.routes.js": "d10ac5bab904eb57c565d6f0a6e5a48451d44563438ef4ae48551807bd1196b6",
    "dist/routes/search.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/search.routes.js": "14615a8f69215438053abcb2be3b69d0f09490702d6719411b446cb897b6d7ec",
    "dist/routes/solicitud.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/solicitud.routes.js": "5e9d4c912e5f37894ddcbfb4e4548cb44ab6aed1176566e2947e0e660d5ce22e",
    "dist/routes/support.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/support.routes.js": "9a08e4329fc0af6234332d74f87b65f959804da3d6691581bdeaa1804234d0dd",
    "dist/routes/tracking.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/tracking.routes.js": "29a8aed5f1f35b34fdfe83749d346eadc4c613659174e81947fbacd0f72ec74f",
    "dist/routes/transport-handoff.routes.d.ts": "c106970ee4b686b5ebf0964ea4e0d1b2af02bdecd2d5cfeecedeb7bb5b2f404b",
    "dist/routes/transport-handoff.routes.js": "61c2d0c484f07d1b22bbe65b825a0ce588e6c5f64c5af0971cda63ffbfaa50fb",
    "dist/scripts/auditProposalImpact.d.ts": "8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881",
    "dist/scripts/auditProposalImpact.js": "f90a24796684268545d1c97c6f6e58323d39edc4eed8d754bbe92f238a88057e",
    "dist/scripts/prepareLicenseModel.d.ts": "c1549d28b2e5e6426234a7565d039344c7c24b339b0eba11857ba1afaf30340d",
    "dist/scripts/prepareLicenseModel.js": "97eb7cb5507bf1aef61b1b78220600af525edf40140be69580d6f5b75920feec",
    "dist/scripts/seedTrainingCohort.d.ts": "cfd3dfb1249bc219ad3e78559d0475db95e05ccd5773d77c022345f042e6fde7",
    "dist/scripts/seedTrainingCohort.js": "7fb112b218a7d85992dcc136ad6667bb355a73edaf966ea173909e83b181638b",
    "dist/scripts/seedTrainingParticipation.d.ts": "79d8d821cac292df9bae9f787446c07536ef6c928bb7b1b732d9adde5b8a8207",
    "dist/scripts/seedTrainingParticipation.js": "9b184bae4bcee339409f40e08c6293d6df4aeb39a86e3b418f7b4e50f0cce999",
    "dist/services/account-mail.service.d.ts": "f7684b16fc2187d68a9ee9e65a8fd24f9bf453abef6175b7796cd6819762dffa",
    "dist/services/account-mail.service.js": "73473536dcf841ac987e3a30c8830bf2ba595ada298f48252455a2e1dee9c190",
    "dist/services/actorActivities.service.d.ts": "f905ac1c21c23d248816eb555535ffb1d8d30ed915cb69403e427ca4a478820c",
    "dist/services/actorActivities.service.js": "593e08fc566ed4588509312437e6f55dbeaf00e273f2d091abab556a4efdc7a8",
    "dist/services/actorDirectoryFilters.d.ts": "f90b9f484665d4a6053f542932d240413e19574ade39d7849525f443151cde20",
    "dist/services/actorDirectoryFilters.js": "054006e2c9ef3b98e4da4c7ef61171572f3520e9c2dd92539d9ded62c879c39d",
    "dist/services/alertCataloguePolicy.service.d.ts": "32548a6fb6dfad4d0c8d0161044e959f189b3f1dc50364cb7634708fc33e9de9",
    "dist/services/alertCataloguePolicy.service.js": "218d310c386ea3eeab8a3f89a6305c4d07da65c9126a54aa3ffaa21b1e40b7df",
    "dist/services/alertFollowupPolicy.service.d.ts": "f6cdb2e4aa63186906c33ef6e6a972dac322e7708a1f0aa24e6984cfc903b62c",
    "dist/services/alertFollowupPolicy.service.js": "817eaa5b1b401a07725e54ea563c16b404d55bd16eeff584c15b7306b23626e8",
    "dist/services/alertRuleCondition.service.d.ts": "fdbfb2701c243c959a97388b26f63db391a0fd5ab1b00d9fece74fc812708303",
    "dist/services/alertRuleCondition.service.js": "305af83db45af8ee00307715a35b760d442057397e19461e52b2f1674cff4c62",
    "dist/services/apiAdmission.service.d.ts": "d06c9dc6e9fd65efd1f250a1b7236a98f79101fc5d538e40af962d697ae77d8f",
    "dist/services/apiAdmission.service.js": "9e02bd29bbc50d8c53b622662bca432ab9af1b99e6b3a9a9da22185111d08e3e",
    "dist/services/applicationNotice.service.d.ts": "acdf0f510258ba8aae9712d817e70a02e83edcca66f15ad2c75a4c7325771585",
    "dist/services/applicationNotice.service.js": "3a0dc38f9b68c7ad42c85bea55702f55dda32a61bd2fb863becb18925efe9253",
    "dist/services/blockchain.service.d.ts": "5be0764d01fe06d062c289f6aa361d822b234f16ddb7d8ff578b0a34e1e55cca",
    "dist/services/blockchain.service.js": "39a6294e3e717187d682263f06c45e8ea88ab55032f6925f48f0d30dc97949f2",
    "dist/services/certificateRecovery.service.d.ts": "022fed75121070bd52779e03974191d8f21df04fe344baf74e604879fd053b96",
    "dist/services/certificateRecovery.service.js": "919801fd3c569ca0fe2847f503fddba889a8ec2b0c73e945d296a7a84926b230",
    "dist/services/committed-manifest-push.service.d.ts": "bc84932322ea892ce734bcb02203b8155c461370d7154340f0a0dcb114a3a99b",
    "dist/services/committed-manifest-push.service.js": "095fbfa4c8b84405af6b565c5ece560470e3640c43ef2e55497e8b688a82132d",
    "dist/services/companyNotice.service.d.ts": "23bdab88176cfb4bb74da289be138dc83fc0e7833490dc912bdaa81f7a0255e5",
    "dist/services/companyNotice.service.js": "8f05fe06c09a1bed1e9627c9ac7502a12bb665aff46a95595ac5a23947e0f9aa",
    "dist/services/companyPeople.service.d.ts": "95967199610e894aa270896f67c28baa1022319a4e4bd35f82aec06e8e6f1fe1",
    "dist/services/companyPeople.service.js": "4fa94c040441eb285a0c043e88daaa442d6ebb9b7ac20eb75df0a70991a049ba",
    "dist/services/companyRegistration.service.d.ts": "7020e7cc38e6eaff844f67d853e3d400522bcee052b3f2e3b6f9337522bcce5c",
    "dist/services/companyRegistration.service.js": "87c382002693dd19fe3fb87afc9b3c57fb004f276f5b6f7087af03470fa01382",
    "dist/services/defaultAdminNotice.service.d.ts": "d9a91be17a2ae4b51683e565df30de46b493b209a9ceb0357ab2cc0685f4afa6",
    "dist/services/defaultAdminNotice.service.js": "d88fe0ca3e97c9b9698d86aa1ce5b2c614041f1216f72c8f801e8895d9e039b2",
    "dist/services/documentAnalysis.service.d.ts": "528dcb4519ad87ac6e38aa10296f2bf92699fecc604ef9d783e9acaec22cdce6",
    "dist/services/documentAnalysis.service.js": "2643f270c086dd8db1e3697b53b977fc1dc8fd1b978eb4823381b0cf8990e10d",
    "dist/services/domainEvent.service.d.ts": "b7169a9886cbd57319b1ada326da8eb7f67f54d0753d359f67caf12cf1cf2d7a",
    "dist/services/domainEvent.service.js": "8ea86433f8f2bd6f353f318847d5f5789fe6a274bd775c0ccbc0e2bd68bbfc8c",
    "dist/services/email-policy.d.ts": "e7510d26bf865c2d06ac519ed9ab533addd6f7333b7612a17cb2b681f433eac0",
    "dist/services/email-policy.js": "e3147fc4f1d6bb880243791a5f4b468370d395890b4a15d78938e4bd4a72c6ad",
    "dist/services/email-templates.d.ts": "ec6721c437ac7206098314a745bc8bb1e0abc2d3f5c77788bce530da43e35dc4",
    "dist/services/email-templates.js": "3e294d8dd32eea6952595995d0ec4e91612cf938c63659b9b7f4bd7b133e1b2c",
    "dist/services/email.service.d.ts": "de1ea51371d5834875d74271622ef927dea9c2f47b06410fe50a8d7c4ae855b1",
    "dist/services/email.service.js": "3e82b108fec0a2d149aac492bfcebd3a9c3ae87fc75ae16305cbb6c90af1e760",
    "dist/services/empresa.service.d.ts": "13d038d5a3eacddaa412c877996e3700a70d75e9cc75fbb714db9f5020c72c53",
    "dist/services/empresa.service.js": "32ffccbad31de709c83ce460a00bc09001cdbbbd53ddffa0bf09852f80ef51db",
    "dist/services/eventualNotice.service.d.ts": "be4ccc20ed890f07c681c763393f69944b15257590226544cacb8b31407120dc",
    "dist/services/eventualNotice.service.js": "6deecec33aecd951854af800c9593213bf1b390be983b66739bf44412b917719",
    "dist/services/eventualNoticeContext.service.d.ts": "3b3d14e14b4c23ef9b122745a8eb58fbe36ca6419c755b4a9efcb8162eeca994",
    "dist/services/eventualNoticeContext.service.js": "94b66b8ae7ea53e8e8e0c94eb91c4c6ade84af2f6e6c7548ff9b665354f1fe74",
    "dist/services/fiscalCompanyNotice.service.d.ts": "820b329d8230b1b26d409fea27a7a2a1ea9008674d774de8414dfdb88ae38720",
    "dist/services/fiscalCompanyNotice.service.js": "4db860f1bce6b8c803641b8dd8455bdedfe8b99459f9b71053517b99c5275c25",
    "dist/services/gpsAnomalyRecorder.service.d.ts": "06f94d4b4534864bf8cc4018efea3c3c4af2884914f7b9f785e5f9b19880b26d",
    "dist/services/gpsAnomalyRecorder.service.js": "52722d58a2d5496533da8fa243068daea06c49e71b99666d335b8db86e4d9749",
    "dist/services/gpsAnomalySampling.service.d.ts": "98841b50b6bf84b9d9c6ea0fe46f7c0424b0922a12a82f7fefe1786ec0d1db20",
    "dist/services/gpsAnomalySampling.service.js": "e4ee313c30aac001fad62a1e956e0cb0f6c78de44d3ea862c2da034a9a443671",
    "dist/services/gpsCorridor.service.d.ts": "709c90c5783119ca9c8285eed84d5f06f775256aa74d6d629fdeefe0cc27cb9a",
    "dist/services/gpsCorridor.service.js": "9b8c0ca144b4deb9c379f4b8013214df817c83bce84375cf530319961c4696e6",
    "dist/services/gpsCorridorObservation.service.d.ts": "7635b3d6f8db4edf6f9fadb13f23f0c0c49df18c8765299ff2f441a1fc80e76d",
    "dist/services/gpsCorridorObservation.service.js": "f52e5258c6cfa5b7ff02cf4c1ebdae524b7ed3b2afe11d61966d5519fb3ca541",
    "dist/services/gpsReceptionObservations.service.d.ts": "8e6ecb9d61b38eb6a9c61dcbc69059981a03fd411b2e59c468b3f4af06349e9f",
    "dist/services/gpsReceptionObservations.service.js": "26d785ef892fbb6564101bb91d87808f932b4359023cb58f2c2ac414c609c784",
    "dist/services/impersonationIdentity.service.d.ts": "69071f859ebe72bbd2bd1274a8b3f9622cb7460a690642b0e9eedcf2ce43f116",
    "dist/services/impersonationIdentity.service.js": "c2d074a4d4203e41efd5e3863c6ee65bae505a24d08a790aa8b7df9aaf633631",
    "dist/services/inspectionActPdf.service.d.ts": "ba89d182f0c614f976effe4937d4f07674289c50e03122987ee5a88f9df8e0d3",
    "dist/services/inspectionActPdf.service.js": "29429cb869fe9258a7cc74c7aacafece729ad6ed87e144102d238c93b920bb08",
    "dist/services/inspectionAgendaNotice.service.d.ts": "006a0e17cf97a960bb6bc87ed2da8a1127bdee1cf2d2b84c982446795ba7c321",
    "dist/services/inspectionAgendaNotice.service.js": "00aa7fc89caac22c6b056463ea7d900325a9a3149e00e38d96783e28c39101b3",
    "dist/services/inspectionCompanyNotice.service.d.ts": "453ba03a4b2f463dc4099a84b23c7c16a3096e847c369eadf7c2d93a7f98ad4f",
    "dist/services/inspectionCompanyNotice.service.js": "01ae3ec5fc0f63e54ffc6a39320c1309cd56539484c0bff1ed80ad760501d4b1",
    "dist/services/inspectionDeadlineCompanyNotice.service.d.ts": "fdcbeaa05c7e2f5859a07444306f2aa724aff8c792ce2a3ace2ade0954052458",
    "dist/services/inspectionDeadlineCompanyNotice.service.js": "40c19ef8498bb4e51ce3ebf27ff2aed80b2fb56b025cdf2a4f02173f6251aa75",
    "dist/services/inspectionDeadlineDirectNotice.service.d.ts": "2f37820e9ecfb822662c5d98a78e54a6466cb8831937d5bc5d4da68b1f3c5a8e",
    "dist/services/inspectionDeadlineDirectNotice.service.js": "a21cb9d88222d20e0036bba86b9696cb6759be998fe88cc289eca7fdc7a7d747",
    "dist/services/inspectionDeclaredSnapshot.service.d.ts": "93fe751eebe7e8490cbfe8b6eb3312dd8a25672d0ba13878cfac6c025200dd04",
    "dist/services/inspectionDeclaredSnapshot.service.js": "26d1b1d835f3ff89d9baeef4eaff56ef664a7ecdca31202cf82c613286716b78",
    "dist/services/inspectionDocumentIntegrity.service.d.ts": "698b959dfe728a9fe4ef10df3cd1bb19032c8987d4070a8f9b84fe251e855b3a",
    "dist/services/inspectionDocumentIntegrity.service.js": "b7d940d748f17a11e1cfe6c1efe37dda4f583cf544446364132e0fda781e93b7",
    "dist/services/inspectionEvidence.service.d.ts": "f1cc55c4c3e60dba47e7399d541d504ee57dd032c75e8712de82af4b13561bd1",
    "dist/services/inspectionEvidence.service.js": "036b64f234f5ea2583172c5c971937805fddf066cab324f841271704ab5f220c",
    "dist/services/inspectionExchange.service.d.ts": "9d3b1048d0d294d0b6ebf24a65122daa8cdc23f861959f1b206b3618d81a9a06",
    "dist/services/inspectionExchange.service.js": "2897214433ffa4adff478e4cc7ab3c989aac6bb04653d4ee3346ad680cfc85d7",
    "dist/services/inspectionExchangeNotice.service.d.ts": "0fa17598406830c99224e77cc9276cf76706cc4db5e4b0746c02e1efbd11d4a3",
    "dist/services/inspectionExchangeNotice.service.js": "a4ff4e86150259031961427086c038fc91fc09c4c2e1f1ff14e3b1b45fb53166",
    "dist/services/inspectionFieldActPdf.service.d.ts": "cf8725d0415501e4e83fed4b101d4b096b71d0e8224456dd9ae2b0b896504d23",
    "dist/services/inspectionFieldActPdf.service.js": "024334d2647687cde23b9c493cb8db1e943abdd6b3b2ec299bea087fcdb84c2c",
    "dist/services/inspectionFollowUp.service.d.ts": "5bd76b3ff30359eb5deaae1c105bfdcadfeac57b77dceacfc7ed6eb48477c98d",
    "dist/services/inspectionFollowUp.service.js": "cfd04877229b39382c885424af77270452cdfe6bd1a3402e8af921d958545374",
    "dist/services/inspectionIntake.service.d.ts": "2e7e6aff1847f85deab31608dd6ab0477e5d16df9e422865d3da941a2517d7ae",
    "dist/services/inspectionIntake.service.js": "020d95d99038a47de63f07c8163a4a2d7653eb3c8c4919154c3184eaca06d5b3",
    "dist/services/inspectionPdfBranding.service.d.ts": "e34cc6c7adf2fa4d8f3b9c912441b6d59f2cf038171a628d2bb70b5343947d04",
    "dist/services/inspectionPdfBranding.service.js": "c1fe34f376b758337eb7ed29ef40faf6cc41ab35aef8d83f10b12f4cd63ec6e4",
    "dist/services/inspectionPdfImage.service.d.ts": "aa1c865d611b7d424516d83d2770b8e6aef0c078ae155f073440a5983d916c7f",
    "dist/services/inspectionPdfImage.service.js": "144ee0f6a79f78f194ac224e3e10ee0e8216be01274d0e04384fc86882982be9",
    "dist/services/inspectionPdfLayout.service.d.ts": "5a80601aec02aac2f1d7d736adda681f277bfc4afdba5a3cc4ece00904e0a173",
    "dist/services/inspectionPdfLayout.service.js": "6667887b779bc72863a7262ffe1e2d0a766c272e00fb13107df34b60161cade8",
    "dist/services/inspectionPdfQr.service.d.ts": "b91fb17d0ab36e216cb674534af0c8a4713d5ebc32f0ef767f4edeee2054b054",
    "dist/services/inspectionPdfQr.service.js": "285dc840c4f5ba1a5e69be2d0674105f58b4db9384b27f6268d61814a8deaaae",
    "dist/services/inspectionTraceToken.service.d.ts": "a9f10fa3615aa7414a97dd2ce3cbc5a4ce50472b9c607d55b401541cdf377825",
    "dist/services/inspectionTraceToken.service.js": "20cc75481349fe4829869490263476600b2b0f26acac2f3a89801a3eea86a391",
    "dist/services/institutionalPdf.service.d.ts": "250411d86c9ddd5f27762b4a9f136874d4e629cff22b3cb06dda0e7fc7671d42",
    "dist/services/institutionalPdf.service.js": "abd3af5a529e6a9b9ff9364e9f095d604d257524480ac7ac5ca1e7cbb8606873",
    "dist/services/manifestCertificate.service.d.ts": "9e114c4eb8eab8afb616717e09f08e42b8ce72de1b1a65c227f347aff79e78df",
    "dist/services/manifestCertificate.service.js": "e5f8ce64db984d46dedb66533c772e98f8ffd315ec302567789d4aa8ced97081",
    "dist/services/manifestCompanyRecipients.service.d.ts": "2332560982ebdaff7bdee543776708ed0e046b7b6447c07b8bba92682339e751",
    "dist/services/manifestCompanyRecipients.service.js": "4692fd6bea653caf924653c37eaca0903f29f34eb179659b458a8e842458a803",
    "dist/services/manifestDeliveryNotice.service.d.ts": "60660b8245395a89de87e469f2e0c170f879db6797dbf8bb7a21a74e7c4bff03",
    "dist/services/manifestDeliveryNotice.service.js": "8e9560d46c8ed754a23efaeb602b1962c80d08d71054d5b7a9166ab1db434797",
    "dist/services/manifestIntegrity.service.d.ts": "3e8ff410e16b27c267cf320b76adf99b5f732d74c6a8388dfa593193e5bab401",
    "dist/services/manifestIntegrity.service.js": "d3a0843eca39728dca740957de0360b5d38ca98907f43bd9736d454e8b7f80e4",
    "dist/services/manifestOperationalNotice.service.d.ts": "76f1c05c973e62936dc71514380510a79bb046bd04f3e3d39de510e5252d2fe7",
    "dist/services/manifestOperationalNotice.service.js": "63cc29db3c14919d25263919498dedc3f6097c73c95af0ddfbb9737f1f8140e5",
    "dist/services/manifestPdf.service.d.ts": "20d52836fda1c6fd211e9205e5b43cf30d75d8f5bfaf5dc2f54734733718592b",
    "dist/services/manifestPdf.service.js": "395829746de6c52a6d662d1c45d1ca508bd58096b201de8467fa4538ca3af250",
    "dist/services/manifestProposal.service.d.ts": "500737b1a2ac73698f635bc94af8fba41a8358e29bc0d27ae7b9f10938482294",
    "dist/services/manifestProposal.service.js": "70dd793bc3736ae8a05edb6656e7504ae80280ebd41cc83ad0d6d00a9810ace3",
    "dist/services/manifestRuleCompanyNotice.service.d.ts": "15ca1a98b9989f8010737702eb2050d086a873cba9f3e0a1beadb37e00f54ccf",
    "dist/services/manifestRuleCompanyNotice.service.js": "5019f19ac7eef91314f4a6d4d1e6b73553020a642014f73dfcb6ea8415f678b8",
    "dist/services/manifestStateNotice.service.d.ts": "333d392ba17525b1e989a86d8f1188a01392a0be0168a13611bf5e557090c6a7",
    "dist/services/manifestStateNotice.service.js": "a1df1e1d028831c8e1b32ec22315942dba088bbd56c7566163d293755ce1c0ad",
    "dist/services/manifiestoAddendumNotice.service.d.ts": "ebd1690972bd75d2e20a32a7beb3e8c5ca9163b8bb3fa83f3a4e34cd62b18a68",
    "dist/services/manifiestoAddendumNotice.service.js": "a7441dcd8376d074c515912138d5141b52776ca0193d0f3c6fe2fcda6d494dc1",
    "dist/services/manifiestoAdendaPdf.service.d.ts": "80c1cf3f3842f3d82b998595334094c48d3ad48027ff6944382c90dfff90e66e",
    "dist/services/manifiestoAdendaPdf.service.js": "f35a1c3d92d5bfc97294eabddc9435b5322769021062d38da4ea4eaa675edc05",
    "dist/services/notification-dispatcher.service.d.ts": "6d043c5455b78ff511ae8a47d0856bcd9e8343afe3897247bcfe9cbc388ec79b",
    "dist/services/notification-dispatcher.service.js": "57db46676b8b89c322bb0c7aeca3a8082df354f42dc46382a8cc80d74306ea8a",
    "dist/services/notification-mail.service.d.ts": "9920b0f03b23c611905c52243fca1fbc44095628305a7dea6639e0bacd71d3d1",
    "dist/services/notification-mail.service.js": "71d6628a67cb1c54a4e87b431bb2d10de500297d41b8ac4a0ba9745648ed4531",
    "dist/services/paymentIdentity.service.d.ts": "f4240e718dfd83aa75834d90c70e07f7d6d02f031377dfd6a6ffbd995f4dd6a4",
    "dist/services/paymentIdentity.service.js": "882850c1fdd9fc4ab3d11d3926fb63c7b9e5e41fdc798ba6af7b7e5cddd2aef8",
    "dist/services/postFactoNotice.service.d.ts": "720059b1c2c0e79c92faf4a904c1fb49dd17d88b84484a491fe71fa5574f9c45",
    "dist/services/postFactoNotice.service.js": "23ce52691c42955f9407c0f64231fc2ed0342430ad8e3d54477cf7222348de3b",
    "dist/services/proposalImpactAudit.service.d.ts": "c1e83d92e60b1c8e56a5a6c16ef0dcd07683cb0dd2734a73e784aa1af0c8ebde",
    "dist/services/proposalImpactAudit.service.js": "e911d86d3baf380f825ab43b0cddd7001ccee5be6075e9322b80011e939b3c54",
    "dist/services/push.service.d.ts": "88f3986879660ce8bb89495455286d9292c1e05b4c5f411e71ba5e77d9bd50ec",
    "dist/services/push.service.js": "d5e6328abefe319c9a5b1a65fc3dac572a455c0cf84f9651cdb70df5016bbead",
    "dist/services/renewalCompanyRecipients.service.d.ts": "f9f2ecee6f2eb7f6e9d1a2a22653c61f3c591f0421c8629dc575492bb9ba2566",
    "dist/services/renewalCompanyRecipients.service.js": "085876839e9cbdd3760817dda015159690c27877509440cd0bf769322d1f3df8",
    "dist/services/renovacion-notification.service.d.ts": "fc6a33ced38ead36e771452df96be0cba9e4f481cbdf720d6cde3993c6bf4b31",
    "dist/services/renovacion-notification.service.js": "ba762a14ca51ceb7fe1e3bb59948807769ebea6a4ca687453051d0ed57d8676d",
    "dist/services/solicitudRequirements.service.d.ts": "f9e2c0bd35e381e5850c40a836a8808f6739d268a769e17fc29a5ba01e9d743b",
    "dist/services/solicitudRequirements.service.js": "c9fad1141a5b2f8af90662d4dbac5842f03a45115ebdd1317183a2135aeadc4b",
    "dist/services/supportAccountDeletion.service.d.ts": "75b0ef7c68784e6237c8e764e2ee4202ce061e281d5e2a0361e187067328a5d1",
    "dist/services/supportAccountDeletion.service.js": "8c1a06a10140497c289cae01aa473aee4a17007aa684490326f868fc38f32270",
    "dist/services/supportFile.service.d.ts": "5686bce62ccea5852040b103782eed652ee834b53ce66a10aea2f4eb0787b441",
    "dist/services/supportFile.service.js": "cca02a0cc933f3b061d04b32eb74bfb53e323c52c41d2dd649fc7a0bb15108dd",
    "dist/services/supportPolicy.service.d.ts": "f8646794e37d7c91faff7ec441a5fba2a1d9bd8893e70357b496c4fa35fad1f6",
    "dist/services/supportPolicy.service.js": "e6166fa3d4a5c48355e41c2c04adf6699669b31f4af78ba9103cce50a26ce11d",
    "dist/services/syntheticPreviewPdf.service.d.ts": "d1e20596b44e9ff4db1351dac57f346a067c18608f041efb5c9875a125882500",
    "dist/services/syntheticPreviewPdf.service.js": "4d44f23527ea3477887aa879826db55976e11d7a2b72f0219a81deada4e1e1d0",
    "dist/services/trainingCertificate.service.d.ts": "2f0a2a80014152a7205bdd0bbd0da49e33ddfb45e1d7e408ec24852c70ec2e64",
    "dist/services/trainingCertificate.service.js": "c9f4b1ac655155c3998f6944557d4311268ac5c48d95e16610ca24e641f3e1c7",
    "dist/services/transitDurationPolicy.service.d.ts": "bb446701fc758b82f065b7eead303b1b3ef64def3a46caf3d4efb87371d22ada",
    "dist/services/transitDurationPolicy.service.js": "7b156cbfc51704a4cd3d56ad9e5e23840a7b4bb91354d959d872c1525b021fa6",
    "dist/subscribers/alerta.subscriber.d.ts": "d3ad3a5ca3891bca3c50c8914c4467710191d1211bca7cfd0e306197f2ae7ac4",
    "dist/subscribers/alerta.subscriber.js": "cd544469d7af6ce4f0e54a86076b26ea05a49bf7da494bd9b853019285de882c",
    "dist/subscribers/eventoManifiesto.subscriber.d.ts": "d779ebdb9bd513b7fb77fc5ffcbca3a18454993997b2b4a6036b016b934f60f1",
    "dist/subscribers/eventoManifiesto.subscriber.js": "a193f19e34d0512be5f972eb7b4c7d57895ffce14b53470bfa20aa6813454caa",
    "dist/types/constants.d.ts": "454769a64dd234eaf5b2772dac3895b91cd995787dad91d0349469e6b0587b1f",
    "dist/types/constants.js": "a110c3c6ddaff8570fc3c737fe5bf829a951683b32c77c925aca2b2c66957e7a",
    "dist/utils/asyncHandler.d.ts": "72154f241927f98ae975303fba7b705501d45b90f6a76e1f62eff62f31947036",
    "dist/utils/asyncHandler.js": "274208752185770fc862e92e4ec347699abc763cc65eee465bcb80e1622216eb",
    "dist/utils/auditoria.d.ts": "f07f6d9c975cea5c19a3176e1b6df2bfc5655265a933146b0b6bfb1da9c072cc",
    "dist/utils/auditoria.js": "3ef0fc5f548057fd230e37b377496c3cf0710d07357bd82b06c990e55908ddc0",
    "dist/utils/dateRange.d.ts": "febdc45b8bdd48b30e52fca505b51d63167ec06e02e1c791a06327c2a8ffeee9",
    "dist/utils/dateRange.js": "a884e081e7b2bc7f31d676a03a4b78b705df1606c10695dc1e215afda28d8852",
    "dist/utils/generadorFiscal.d.ts": "cd28361b74bc30e41dc637bb18f2175c546cc3a0749593b767191042e8f694a3",
    "dist/utils/generadorFiscal.js": "1055ca8a979df181645bf71cdfd690ad37893e7bd49e2408a195aa17925b4531",
    "dist/utils/geo.d.ts": "251f906d6133c696ac4e96d35301e874895c9c8a9ac1876ab8896ebb78ddda47",
    "dist/utils/geo.js": "eb024e48cee3dc14dbc40615ab1a6b9522f8713966596898bb7119b0423290c2",
    "dist/utils/logger.d.ts": "2a320970cd0ab1fc683070178e729fe096ca68a0a479dcc0ac32fdfa3074d342",
    "dist/utils/logger.js": "9f5e8e9ed33980063365e20d9e29d7269e8d9ba081df5e47f93b17bb5b487700",
    "dist/utils/manifiestoIncludes.d.ts": "eb414c7da8f3340262d489e9a35435418ea3168aaa0ea56aac94b70c03633929",
    "dist/utils/manifiestoIncludes.js": "d0ac5fb6a8475fce6817e34b0f722d3f4b64b3f08a648d0b631383a385383303",
    "dist/utils/manifiestoNumber.d.ts": "d923fe766b703ef1b41edae8a1825695f74aed3086ed481a84d45768363e2c63",
    "dist/utils/manifiestoNumber.js": "3d4773d450b266df2eef9712503b2921c46d303e8945ce2f5dbb343bdf308801",
    "dist/utils/pagination.d.ts": "fcdd0a09761cd1642b23ecfe27153eadaa773eb3a1b619d69bac39b09d263568",
    "dist/utils/pagination.js": "17fbc81500d70b0af90e10ad096ceaad460c01e2567cbf4ea47d7958df9f6f30",
    "dist/utils/roleFilter.d.ts": "cb467301a2a04e3288c86ee56b481512d4e5e362a75a156cf7de45744405545b",
    "dist/utils/roleFilter.js": "e3f5e377787a682d50e9b494e99ff7c5583b7a7bddf0389329ff05fb60d60b25",
    "package-lock.json": "b7315c794d3e77740d2f94fdd6b25c888696042a95aaf86d1916bdd202b53b52",
    "package.json": "e9974b1a330da6de922e3aafc5dfa61f0c5c292f60db2773a393bf2a6c913cf1",
    "prisma/schema.prisma": "124c6bf94c57f8513788e291fcba09979cadb11415e87a31dc185676a1618afc"
  },
  "frontend": {
    ".well-known/assetlinks.json": "d82b49eea6132fb9bfbabf8a17cbf908fe8db05de9a7d81d2a5d165acb6f8b91",
    "app/.well-known/assetlinks.json": "d82b49eea6132fb9bfbabf8a17cbf908fe8db05de9a7d81d2a5d165acb6f8b91",
    "app/app.html": "0c1af161c62c78b21ec94d1f00bccb6b433033dc2fc40dab6198ab3c17e0147d",
    "app/assets/ActorActivities-BsRsj6UJ.js": "559d4355ebecb25a8e5a1d20e8a1978bbd20f71a71d6babe5fac8f738e034dbf",
    "app/assets/ActorCertificates-BecHAsCt.js": "ab1dbbfc6df7326a01e09aff8327a05cda72c46bdc10cf92385646aa71968641",
    "app/assets/ActorDocuments-Cyu_yK7W.js": "609857063e8e898e54449c920469668b39b58f50f6ab6c357312f17437ca52dc",
    "app/assets/ActorFields-Cj9IoHCO.js": "f5cb985715a854c7b0a8a5de4cc789af5fd92c624d0c39397f1dcc59a34230c4",
    "app/assets/ActorInspectionsPanel-CR3Q63jm.js": "2ce485c847f3d636c49b874db8e4684632fa7c95867ec9d774cb20ce1e8d9139",
    "app/assets/ActorRegistryLookup-uiuXvECK.js": "a89e8ad3e4f26663caa118af4846311797c50f32818dedc30c410c85075fd7e0",
    "app/assets/ActoresPage-C6k1wWjb.js": "28d168e304332f7876ed70209987269e578eff09ad896084dc87ab2c0ef0e117",
    "app/assets/AdendasManifiestoPage-BiNHpjm7.js": "61570bd6a9cec2e419fbc7e5b632601f27553efd340671eb9b93bde54722f079",
    "app/assets/AdminBlockchainPage-67aXqflM.js": "e924c558c56121727b0daaf98c730d76a5831cc4eb57d8097205b5cdaa675346",
    "app/assets/AdminGeneradoresPage-BYUP99qB.js": "879aee68c1fc2a0a59a5ec48e26e62db3d9e0c468350c1b468f54c1bbd307f29",
    "app/assets/AdminOperadoresPage-ClOL1kLy.js": "14291211863cce56a1158b65f2e8b57ea7fece4c7f289b0798b7b70e39a74e31",
    "app/assets/AdminRenovacionesPage-DghTeC3v.js": "eef5bec4ed783ff99b9b23a24a36bcb24ef305ced01a3dc8e1773fad2661bb26",
    "app/assets/AdminResiduosPage-DF-2K7LH.js": "21b1e42f27e33c5154073a9fd8a413c5733f20014be11c3a9d4e8b4a61a45b5f",
    "app/assets/AdminSolicitudesPage-Cu3nVmgs.js": "36060f57b1e0a75dbd4cdfbf85b96c4bf72cc6e2111e77eb84ff2c3a658c4a8d",
    "app/assets/AdminTratamientosPage-DGiT5pjd.js": "d4aec2375bb820a7947a8af5a83eb1c0a1280a460f224cbd1c7b7c5bf1ba5c92",
    "app/assets/AdminVehiculosPage-CoxmEQ0f.js": "deb900c990771da8ea2257f0640d4a5a0a1bdfb7d5adae32e4cff2cb78c4d50c",
    "app/assets/AdministrativeTEF-6iEtJrr7.js": "e9e026da2cd6201ed1356734597f5afd4310f3574f96adf3892409656962ad17",
    "app/assets/AdmissionTabs-CpSY8pS-.js": "49f04fce50fc091e12d3508e5821d3c06962a80e493658847e73e2d1f4ebd965",
    "app/assets/AlertasPage-YPunPy7f.js": "94cb9d791793c08282e4fc986d755150cc87e48307f25970eb3be0f3aaf422de",
    "app/assets/AuditoriaPage-D5j-alUK.js": "ee007ba0fff2a2b2869d72a172c36a28394d5b46b2e691462d501d5802d6e7b3",
    "app/assets/AyudaPage-naLXiJEh.js": "6ecb32ddb52f4caae2f8efeb721ea5d427f0e486270f2555fff6ff0f6c41be7d",
    "app/assets/BadgeV2-CeMkhHg-.js": "cad3d2fb38d5c93e539f7a55587be6a106f559570331b5a0c405ae420176c434",
    "app/assets/BajaIntensidadPage-DBa1DHvY.js": "27a6b3c742f88ef466401fe8e30ac2246a733e0ef3de8be94737c0de293da701",
    "app/assets/CRUDSummary-CcLbWlNR.js": "bca75ea958309f1c05b9f6c9c06e9fc621fb64fd45260060ac394966076f7b7b",
    "app/assets/CalculadoraTEF-1liIXB5f.js": "e754cb4e529aec20335813cd73b16b99b61ebcfdc666da42e2b9d2aac6763177",
    "app/assets/CardV2-C-5k0Hav.js": "f86dd9997e1110844aabd0ec2aee68272d575fa768f7f92339663ff5586475b4",
    "app/assets/CargaMasivaPage-ARl5oJi7.js": "bea52a68a6bb9bf8a85475a19c6e8e4ca6ab04791f0758203c5aa708baad94c2",
    "app/assets/CargasEnCursoPage-OOmX_oCF.js": "90f61097f5f9adde9cc1c4b371dd382a527ab3c77204569e09bfce96dd317b28",
    "app/assets/CategoryBarChart-CrxdoglM.js": "be81788cc2c31d9e1ae1ccc74b784f7ca246fe75da81047cda04f900e8ee7a88",
    "app/assets/CentroControlPage-CZ2OuRFs.js": "fde7320e201fbf5c0c3d682f01a24bcdc0f0dae37482be2b12b024453e6c6839",
    "app/assets/CentroControlPage-hGltqfvI.css": "b2078ab2b09aadb5330e4538b2881aef71ededa9493ec3b0cb9dfd7c02411a16",
    "app/assets/ChartLegendLabel-BMl0GguR.js": "5a114b6d0db4e44f2c206e65fefa0e412922222eaa8312ef9ed6aa7ab308f25b",
    "app/assets/ChartTooltip-DyG-RLmr.js": "de164c1869f92edb3036eea079be271443a987df91d73a68f9ad927910e7815a",
    "app/assets/CompanyRevisionDraft-jxXzQT1V.js": "33de2b8ce8d48931983a8b4706f0af9799c9f482f29e3419973425ba7d993a6d",
    "app/assets/ConfiguracionPage-Bw1X18MP.js": "c3c0f9954d4532147a80bd8ae0c219b8ef2b7ca3088cb7793a6ff8e793e28fff",
    "app/assets/DashboardPage-eRt_uQOm.js": "57f87cccec9dac23f1e9dded6ed00add43a06a99ef7e7d7d95a1e0273ac17be4",
    "app/assets/DepartamentosTab-CcucKsOC.js": "afafaeed06bb646600259d9661a78ac9a21aa1ad1ede6864ea012d8160485b2d",
    "app/assets/DocumentAnalysis-Dg-TSOrM.js": "07b0dfafe6f00c0e67b5b5f09dfb6f952d81168595eb328b1fe72d81a8921adb",
    "app/assets/DocumentUpload-CANYokbf.js": "8ff05afb50c0b6eaa6d72207782311708f7d61c1ff37ce851cc68227cf95d4cb",
    "app/assets/DraftConflictNotice-D9WKajTe.js": "621972801bcc28ca501768d565fbda0631f75cade9333ffe2dca4997a4301fae",
    "app/assets/EditarManifiestoPage-q1Hss1Bx.js": "366a60276bb7990e3ae83b77643441ec99e84c9f8337720e4cfe114e79d6ee8c",
    "app/assets/EmpresaInvitacionPage-CWLsWVzX.js": "0ee6ecc961a11b1f40f03491a7aa4981529e5c704f6c4af701fbb277ba1887d3",
    "app/assets/EmpresasPage-Dn41d4bZ.js": "dd6ed47e106b330ce6f8050344004cf48eca19b9a697f420c2c3dcbb82900059",
    "app/assets/EscanerQRPage-eL05I6C-.js": "e6f3f1b93091e724e1e442bf2f338e2b35b5958aa159ffa1e7b29b183b6c09e6",
    "app/assets/EstadisticasPage-D3R3-i1q.js": "39a182b9aabc3a6ba2aee7ad4c076dcc7b594a09c7360b7d1a8ade19470abd0d",
    "app/assets/ForgotPasswordPage-CNSbKWu4.js": "0c2a518ca902684fd137e95b71b14ae130db37ce3cd42a222efa72bd77a5b8e6",
    "app/assets/GeneradorDetallePage-B9wN3vhr.js": "27238e76abb69f95603cf0da5bad80701dc76bc465c718bd0c091aa1cb2cc015",
    "app/assets/GeneradoresTab-DSgvAd7C.js": "e2aff16218aff165dfc332bf6a4cf5149a6cddef6872fff9627bc369ea028a86",
    "app/assets/GenericCRUDPage-CDNNoFGR.js": "a74b85c78f912ea79ce3ea5b8f891da3741f8033ecb79b148c9ca63c0d7c47d4",
    "app/assets/InscripcionWizardPage-Ba1h5Oxn.js": "731eed80bceba3f7e3bbb14c255f07ddafc6d0c89980a1d34484a4ce8d5fdf87",
    "app/assets/InspeccionExpedientePage-BmK96GUT.js": "b36a4ffd9af653a35b0fcd19e402ad1459406731122c4c46c83cf864a30dcaba",
    "app/assets/InspeccionadoParticipacionPage-7vJWqUG9.js": "3aadc5bf0ecd1349b94f18dd35b9d5bc25c327d7af4883f71e36b9b88fb0e575",
    "app/assets/InspeccionesPageV2-BH1A-Pdk.js": "33d4342617b817b76336173bbe94e5d1e6d51cb4d0c2c7d2433bca7432144f81",
    "app/assets/InspectionExchangePanel-sKh6Lxsu.js": "ada9025b23fbed8c4cd9f5d0a8466bd3ed2d05ae682da0b2d14bfc6f0df308d1",
    "app/assets/InspectionMapLayer-CjDduzFo.js": "8933107f6aaba10f97b4dc47a8a4fd056d1487dd741752d73f500ad6713093dd",
    "app/assets/InspectionOperationsPanel-C2G_RdzK.js": "c956c55b2e00a51f1dfb4c5da1b9efb79e6b913af9b36ea3273eb3295b143cdb",
    "app/assets/InspectionVerificationBlock-B_KlkFYW.js": "0c5435bcabf3e144b15c1363f311d0028a6be26b401effdb18d4784884ff8e2e",
    "app/assets/KpiCard-CRkSBZbs.js": "65e59c6c24bf070d998fda4e86bb9f9968d6f11fd983317b7e7fc97c6d155be2",
    "app/assets/LandingPage-CkOspFEa.js": "1582c8d35b07c82b04b6c3192e8e1b3d4ea9b5461f49fa7a44d7bd35b37e9492",
    "app/assets/LoginPage-BKYqRPgr.js": "f9ed5ffc4f78d32f667284e74302ced22e1cfc7e313dcab7c2c3548bebe7d0fb",
    "app/assets/ManifiestoDetallePage-CG9_OXvy.js": "be7823281c476d72f581c9409262147034e78b2b063375f8652aebeb23cf46c4",
    "app/assets/ManifiestoDetallePage-fk0oVro4.css": "4a9ea55ddf95cc818c34fc292357ca9745448699680578d8dcfd836d620accca",
    "app/assets/ManifiestosPage-DqF-z3pY.js": "4689a66e3f47de5decbef6fc279c56d0150ab4011ad38b5ef3813e08d9334eba",
    "app/assets/ManifiestosTab-yBX46xfi.js": "7bb1b3b1e1029ca8387a0997a207ec7200b17d208567c3680d133bc616a9bd1e",
    "app/assets/MapLayerToggle-ZCsm8BY2.js": "a87dafbeeaaf8cff638428408d1402d2e4524abdf9c4ff215eb41453c1df82b3",
    "app/assets/MapaActoresTab-DcQZfEzR.js": "c9dbddd4698009000cc4fad6361be0f45cc8c0a45e8376c831f7527123646ad6",
    "app/assets/MiSolicitudPage-C7TezAZ2.js": "0ceca845bb7dd028da8f7b479005719df14e20b195d11fa3a9e3208569e5ed44",
    "app/assets/MonitorPosition-CxQbk6lc.js": "c381a0e4f02b5e4fcd053cbc49ababfc309c468a4759696a8156856a6853f9de",
    "app/assets/NativeSelect-DR-9lOYj.js": "7eb4022d43e63c9a77c7c4cd03cb74a51ea9a4338281accb35c6b1a39d8ec3be",
    "app/assets/NotFoundPage-Dms3_RSK.js": "dc56e74b079d819168304a93b0cdbd9397338455142c15f43fa5d0ee8e416c1a",
    "app/assets/NotificacionesPage-ih0Q_uKg.js": "27b5f1bfd5c7b33b807ba8225848418e56f19ec1cf047850bced6b71c27eb755",
    "app/assets/NuevoGeneradorPage-CKIcawEH.js": "ba3c07540ee5b7cab2ef7d7311cb9544e81e1b55a548397aed034e984b47dbbf",
    "app/assets/NuevoManifiestoPage-BjOLAwND.js": "20db9ed1a45c889f540181ee931ea350e05b2de813636a246aec568b437514fa",
    "app/assets/NuevoOperadorPage-4fkKteKp.js": "836f140f6d9a7b5720e647fb33ec50900e1d9bd37c18f92035872a1e2fc90f7b",
    "app/assets/NuevoTransportistaPage-C0QtVUNx.js": "921b413d7d49770b09243de9c8fb81c5da30bf418edcded1990a7de03eb5f973",
    "app/assets/OperadorDetallePage-zzlIWeob.js": "e18630adcff5399e85357820fd0487f78a54f123ea857ba218d903318b8a7349",
    "app/assets/OperadoresPage-Dea4cTR1.js": "6aa1fd36808ab258e500e5b1aead8ed5a46ca6a7518ce6aefebde31c3f8c268f",
    "app/assets/OperadoresTab-i-5nHOrg.js": "91f8de83305b009d69a7957bf5e119ff542005fe92bb578e7fede0f3a83745ba",
    "app/assets/OperatorFindingSummary-0Az-Q_zd.js": "cb4deaf7866424a88f219047abb80558c2046242a1e0b02a7c51d4b55054bdbd",
    "app/assets/PageToolbar-CL2BC2B0.js": "412c274dfebfc10f679cacc022ccb2039f2c3a8888c2d509641d133e62e852e4",
    "app/assets/PartyApprovalStatus-D0gLfmEY.js": "5889e0da30d793707d33a4f3644ead7b25b232f3a5a74c1d8d11c3a4bcbbc2ca",
    "app/assets/PaymentIdentityReview-9flO-mbZ.js": "0c79e75114e165fb00596146755992059a048294e3c6e26db144eb96ce0a9566",
    "app/assets/PendingGpsReceipts-CaMYtjeE.js": "610a852cb4a5a263edcd8acfdd4c6ccaab29079debb96a5eaf6d5ff13bcfa310",
    "app/assets/PerfilPage-DOBWN22L.js": "ec9e5c6bc3ef398c9fba6af39e811c13e7d200ac8051da09c94a36f7f44a2400",
    "app/assets/Polyline-BsT6klRp.js": "5ee28dfbdf8540d834443501849d611fd903e86d09cc62ad020bae5b375df2bf",
    "app/assets/QueryContent-BQj-sKQG.js": "16014bb46bf69c28b20732fa8124ca59d4a2a4baf3eed32f549ab705021ef9c6",
    "app/assets/ReclamarCuentaPage-BRA_lLkY.js": "3e854a380c16bd63d88960819525aaf4e6a89c0b33afe3283f6095aa33d23632",
    "app/assets/RecordListFilters-D1FbQeNP.js": "7f253819daa052ef9a25e1a3af2e0a8b01f8bc193fe725576cee0e8de5d0c501",
    "app/assets/RecordListToolbar-DOme5igD.js": "cd3e63ca2933f5cfa82275805605b61280d2cdecfe8810fdf51a60e49389ca00",
    "app/assets/RegistrationFleetFields-DwnBdMm2.js": "31284bf4d0fd191ef82a84171c12bc6ad40b510e116dc0d13c82f829ff375422",
    "app/assets/RegistroPage-CNembAsb.js": "0df7b906d04b53e3df2afd5e60eef29612b0cfc4e43ee4881669ec50953a5af6",
    "app/assets/RelevoGpsPage-BUv31fmD.js": "79d9297e6c37fd9cfee1d0004fa95ab4218d656c46d36d90a9e3da381a6ec870",
    "app/assets/ReportResidueBreakdown-SP11v3Lg.js": "8b9090d8e88494864f8d3dff624553df904bf84b556597e7c7fecfdd7e11717e",
    "app/assets/ReportTableControls-DD02HW9H.js": "560532a694c3090f4c02041b9816065d089e14ec6455d4fe2c794eb7cd91c088",
    "app/assets/ReportesPage-CBO1Y7_0.js": "e67b1f9d691d0a7ed0d398b4ac6bf31e0f0590bdf3c61a63f2e65a7da657a5f4",
    "app/assets/ResetPasswordPage-D5NrI2vH.js": "90500477989f6244766ba70e0651fad663485d0e8c0956798ab3e83febb828a0",
    "app/assets/SearchInput-CLH6iTvf.js": "a633473c0c919a1f28f834d08411cd3a43d9c0bccec11e6e59d03583d87f0b8c",
    "app/assets/SolicitarCambiosPage-BC9gEAzD.js": "c51637baac101e3449f9584655b925df3a15e926453b3da01c19df6e4bcbc4f7",
    "app/assets/SolicitudDetallePage-CdwBh3BQ.js": "da439710266b54e4ecbc2f0470c39872b0a178f7d647c8d390e1c917f84b5aed",
    "app/assets/SoportePage-mhzpRedq.js": "c37de09e3d6c4da19fcf9484a25a1bb4ad1f71bfbfda643cffa03a6a1112b92d",
    "app/assets/StepActividad-CtRfxUCQ.js": "4da17f24c8b87341011d3b5f4ddce8ad384c1df8024804af34d987e257ff1b64",
    "app/assets/Table-gT9uUR8n.js": "da3bf16c28f336730a10c41ed639d0af370611aba180b7b5d6b30d0a73287c4b",
    "app/assets/Tabs-BRBMJX_q.js": "17344bcb4dd85adcfd00afff40def4fee759e866fd54f442eb0c226dcd521710",
    "app/assets/TransportePerfilPage-7zm5w4nx.js": "13555aae8aa0e842aaf42313ef7d85cb028d2b8049cfaa8638fde114309cc53b",
    "app/assets/TransporteTab-te-llXhs.js": "ea2e0aa97d3cf9caa1582c31f24d0089bf40b832e2029160182c4b1440b72514",
    "app/assets/TransportistaDetallePage-CoWTV2kD.js": "65b07b8a1d1b4785cf63d7a712dfac03acc1c5e3601e2ef198f24ed2b96571ad",
    "app/assets/TransportistaTripQueue-CAQWtDW8.js": "735e2b12b9c466e528376fa03303e8001a3d0573dfe98a5abebec23968420f36",
    "app/assets/TransportistasPage-BP-wR8ap.js": "ff364ab9809621a1b87f9edb722bc83ac2be4b234d373d2ecfbc450d97a62e3a",
    "app/assets/TratadosTab-BsYFASi5.js": "f65065ff85ad2e80edaafd81c1fb19f6d55e3e40d2c939f64dca6bd0615521d4",
    "app/assets/TratamientosTab-BYAdkCGq.js": "effdd0aff9a3ff9e29993209383db43cdc90786638eec1b76d844ecd87bb360c",
    "app/assets/UserSwitcherPage-74FIk0d-.js": "365408c198bf213a28529c7b74989e14afd5bab09d45d173f7a2d26cbb9f5101",
    "app/assets/UsuariosPage-l7zeBLAf.js": "8d2b57bda42c2aee5a13ee8f8607c7f3a65f993dfc127dcb1884dac5577e87da",
    "app/assets/VerificarEmailPage-B4vMD28S.js": "76d2d93e3c778c59f5ae3c7f58cc06665cb6083f297c68b044aa23a97bd11f6d",
    "app/assets/VerificarInspeccionPage-4dTwnOXN.js": "ca82ce757955df37478b6d4b32dbca9613d0aaa1f6124539cede3f6ed2a6a86f",
    "app/assets/VerificarManifiestoPage-D5PgzPpX.js": "d29a230f6d4f9036b173ae6957c6d32a9f1d1d97400fed47f3340c9f5f9374fc",
    "app/assets/ViajeEnCursoPage-CtstseC2.js": "2f741ebea937a8130296c8ee1d46eadc206085d429039efc90735b617dfe1969",
    "app/assets/ViajeEnCursoTransportista-CVzm2nOh.js": "3c7552e16fb6e58b1a119758761b9a0be020face735214610fbaee403a59e8df",
    "app/assets/WarRoomPage-Cq5Gsf9e.js": "ba08d9773ff5ed3162bc73082f0db41fa6f6d88fec2023d1741cb2ce60768717",
    "app/assets/WarRoomPage-_EKWi41d.css": "561fe576595660fcf9415f12d03459f11790ad08a96f1eb7945512b453693411",
    "app/assets/actor-identity-r5g6Vo-V.js": "107a8d8fc609219b2a77292ffa9b2a1e61c807824d7aecd27a88061b8ad58e59",
    "app/assets/actorCalendarDate-SdcFucGH.js": "010fe6c3d0c433c13c778e8ed80a400ed81b96c57e0d5d05b4c4dddd0a685a9a",
    "app/assets/actorLocation-DrTwXHCa.js": "3217c965d0e4e5d71d79f2584f1b291c7ba80f4b2bef09d3e9e296a382f14bce",
    "app/assets/actores.service--KwlopqV.js": "6ab0debc33e17fcb66e545b06c3602d10a0aafd401edea66dd8e24a7a3dc823b",
    "app/assets/admissionReview-D6mT3cNj.js": "237000fff8bab768fe5a9e48019ed253e2000dd2cff80cb4d2d125b9e4d8ad7d",
    "app/assets/api-error-c5y6M5RV.js": "d64eab4c34e8d8ac3a9d8ac879790ead3fe0b7c41aa82122e2d8141cc0b2cbcb",
    "app/assets/appendDictatedText-aIIqSzb3.js": "be97098ff1c7c6ba75405ec598a019b2ccf764cfa62aeae814f509991bbd373b",
    "app/assets/calculoTEF-DM9w28q2.js": "fb3557fd317f407d5b1380886ae8e7bc258e6a8eecd2a566b1e6b1566703fa64",
    "app/assets/catalogo.service-Bfjq7XLU.js": "786e79ebc54c1ecfdcc90613085a1c72d3ce8cc1fb31cdf23c4487a0883aba93",
    "app/assets/chart-colors-D6XHPs6F.js": "e6cc0d0a321b5d5aea42bc44173925795f470195cdc3e8105ed27b82fb0e0208",
    "app/assets/corrientes-y-BCw6gBBf.js": "774153567321fdb3466dc8dbbdb8c3670fc979355c115b0ebafc50b0213022e3",
    "app/assets/date-presets-BrqRuezY.js": "75bdb1e7ad3514e04c1e427f2a95478f86632ae8a26d821242ae3551d429f1ff",
    "app/assets/dictationCapture.worklet-BI-PfSIB.js": "7c16f427e7c55ba275cf88df2ccc1395026280f840618fa6ebbefaad3324748a",
    "app/assets/draftConflicts-BhHfou1B.js": "98b8b6cc38329ce826ca4ff6188f15140cec021039b936788580986056b51ad9",
    "app/assets/enterprisePresentation-BJ_z-1TH.js": "5070b72e921c660f670eede81325bb03bd4cea0b064f28e0236ba2044465fff6",
    "app/assets/exportCsv-Cq7Zkuwf.js": "5745f4c11c6ccbd3523fb51ef0b9235554ca342c516ee9de511b26cad2f959ba",
    "app/assets/exportPdf-BZOupLN0.js": "4c56814603321ade0f70236ffec11245cb69cd63fc596c6af619935eb4127117",
    "app/assets/fleetGpsStorage-CP4Wo1tT.js": "bc1dc1b10524b717c74ceff3d93ce5b1ce88ec815731bccfda6278ae22545fcb",
    "app/assets/formatters-D68wppqK.js": "473c3f6e35ce37a727a603c9013454df18a676fd10997d110ac65e1d89c195b0",
    "app/assets/generador-fiscal.service-Dqw5DntA.js": "042156b3df8dc1aed203065da8b82adfd0187923f364e9b78bfafa667ab810b0",
    "app/assets/gpsFixOrder-Bpa8I0V8.js": "988ba8c58f100bd51bc725652b85cd4986868f45ce3fa0f65972cf4b2c67ef18",
    "app/assets/hooks-BmVJQ2LQ.js": "2822faeaa086f2ff3b4c6ecbdadf06e65633f89608338f7392e75102ce7a2ba0",
    "app/assets/html2canvas.esm-DXEQVQnt.js": "7b07a9ca175c614e8e7de447198d35b0d161dd50db2c63b5f7fd6ea0e1e876f2",
    "app/assets/identityCuit-B1ZM_8Nf.js": "c5e658fe4523e6c3920312bcc8a7e26fd6be343d322ec92e52b2d05d496deb8e",
    "app/assets/index-DM-kqcrO.js": "8bf823ba9ce1bb6a199376662912b409c19cf29ee6208e9ee7ff3df3b8ff582b",
    "app/assets/index.es-C69Z0LbH.js": "6e2085b604e83a6d93d41dc4a3613f280483407e53da17be98b722890f90150a",
    "app/assets/inspeccion.service-CHkYReMz.js": "cc24502319f75e119430c72ad7c9dac740868c906a65c7b00e873b5b2cc04f8c",
    "app/assets/inspectionOperations.service-X6-mgShA.js": "e8b69049dd2af7a3ec044aae2158a2382fc4cec26cff4b96f2eff5b109f07593",
    "app/assets/inspectionPresentation-DCSGQC7G.js": "191f4d6c468b9026ccd37b337b1af1f57e34c9515b6a9b801bb530a4cd90f40e",
    "app/assets/inspectionProcess-CGCy6bTH.js": "4ad915b6cb984c051fd12ed464a6bd68aaf0f9a82c53184874a756a73ea01995",
    "app/assets/jspdf.es.min-DVpDi9KZ.js": "6dd6ea0fcf767553b7479658ac5c1b7a12b1ae3019d4cfa4fba982d0764cb409",
    "app/assets/jspdf.plugin.autotable-KFqWVtFs.js": "dc0968ea38484b3310e75babe5b6dd1ce7398d313bde535581992dd007b2a5ae",
    "app/assets/leaflet-DfX8fMZM.js": "a27a20c9ebe0856ac2f654c339bedeb1fc4ea5d2b1f0fa3c8464882d891defc3",
    "app/assets/leaflet-Dgihpmma.css": "7e14f0f44c4713eb7519182d93575f59139200ca781397a493a11f1dff0ce5e1",
    "app/assets/limited-transport-gps-BZiNASwD.js": "eba0994dc83aed1e312f4dfb566534107f201f8dea70ab6b999268470a91dcd2",
    "app/assets/main-DIvMeHFO.js": "efe8809ae1659f428cc77b87b8960ce92ce09fac6489e15e5ed17621a9538376",
    "app/assets/main-i1NM-h1n.css": "e96083b0fbaa59796c34c739b1d6f913f53ccb40b54cae4303c337c802719027",
    "app/assets/manifestEventPresentation-VI226ORn.js": "86737d1c2bf2485f783f2663e344bc103e4349960b5983776ebed769dab6a0cd",
    "app/assets/manifestFeatures-joYM9aPU.js": "032e4fe0f6208c940cb904c840a33bb258cf5569838d7c9df564c0206209f674",
    "app/assets/manifestListReturn-uPrFhWhQ.js": "225cf1fb1d67f1e5c39c0ff87e895e7be5bc43312ffe048e658d106feca911ce",
    "app/assets/map-icons-C9XpsNVC.js": "58323783a8fefde6c406a91ecadd010ecafaff8e4d29c199ab5c1b0d0e27c936",
    "app/assets/mendoza-departamentos-kETgV16J.js": "26c6796c116745e831276949bdf555e459e20645fa24fbee9e9e55c9aa126e49",
    "app/assets/notificationFollowup-VdP4Nx5t.js": "83343f3e6f1b0733510dde2fda66ec65319248d35f1fab81838304d7041dcd78",
    "app/assets/purify.es-CEBYger9.js": "ba64ae392b2dd7aa911cfdcaac46cf5ae750b137a8264b958aa854cd1d76d673",
    "app/assets/registrationDocumentReview-BL_N8QGk.js": "797cadf3104cef50998fefcf98b9b8432bb3d1200ed575d5f8c87ff9085310f0",
    "app/assets/registrationDraft-DGVPIzDr.js": "912ba755a488fc6a256a8d0dad9e8960c11179c757cd0e75a71dc7cf3117efbd",
    "app/assets/renovacion.service-DhYs3ELz.js": "b2a69fcfac9658176e8c490dbdf68c4fc7f13999bf55b77ca03dca3cd939257b",
    "app/assets/reporte.service-DUmYRjVC.js": "c8da8a213b6a759ae3ba4fae328133f3b62a978acf3aca4a38c420622c0dca09",
    "app/assets/shared-PpJ1KiR9.js": "f8fd85d0be9747e04b5d8ee7d4e970fcdcab237cef5845d7b034d59ae54442ad",
    "app/assets/supportCommandStore-uh31TVnD.js": "e84d8c8df75b8eadf889b08a38ca3558ba6b0d7a5d9eb6efa2b6d63da4117225",
    "app/assets/transport-handoff.service-DJ3JxlN2.js": "ed38ace898527520d8c17d67b0fe1983c799afa1f1e9db15be9d4d42c98ab5d7",
    "app/assets/tratamientos-catalogo-B-PmgwlX.js": "092e926bcdd86b6dac369fcc2791d02bb8288f199915e8c916b6dce48b1d2159",
    "app/assets/ui-CRUwYFHg.js": "a1b466c8f984e80381167b323d3ad54bdf9ef4c27f9cf14da9b85a94cbc96ed1",
    "app/assets/useActorDetailNavigation-BK7oYew8.js": "56754d8d85ea484fa928419c4ceb5ef6e29dc0d308af81a499a0bd0966fdbd7a",
    "app/assets/useActorDocuments-BoMFBPaz.js": "d2f26ae4628102a129cdf0048b3f97ea2b562e95adf7ec1b9be04c4a7977fd58",
    "app/assets/useActorListNavigation-DOjTvUXy.js": "1d1d53646f1337172153d756e2dd6e82d719347f0f5c92c18dfd787c5db8df85",
    "app/assets/useActores-DP4BkH7d.js": "ede85fc19194dc93f45c900b63af4cef46e0742a95643122be86c0f2b5223ad3",
    "app/assets/useAdmissionContext-DOuIdxeR.js": "6d1ab24b1573d51000605f991407030ce4f7aebf86ede6af3deacce55e583e96",
    "app/assets/useAlertas-tQ3h-jHt.js": "b311390f945810590c81762061ab5d52d0a05c3789180849eedc144e20cef307",
    "app/assets/useCatalogos-Cst2Xp0Y.js": "901940939cd437559828df3eda7ce1774818e7c45cb9d40eb1a0d23a1b9ab5fe",
    "app/assets/useDashboard-BSJVSa8a.js": "774ddae84db1df307db795096ad3956ea24885af45ff00bc2aafae7090d5118c",
    "app/assets/useEnrichment-CEGB-JHg.js": "d2a42a4ac0fd2a234cb4cdadce117820c54f2048c0745df93c9aeb47ebce44da",
    "app/assets/useGeneradorFiscal-D9cTnWQA.js": "33a3dfb4fa939adc95a98a3b60337606daae604d1fac7a76162ac84c9f956f50",
    "app/assets/useGeneradores-DdvAN0I3.js": "3d4af99dd85d22e4bd16321cbe10c9a46316ee95dea33c67b5c2f46b2056f80e",
    "app/assets/useInspecciones-B05VHNJg.js": "393eddae34faff84a35aee2821d87bc853203b2982183f5ce7737711e01e2134",
    "app/assets/useInspectionDraftOwnership-BEd8VfmN.js": "3dd1b39eaacf193c50ff9a30e4a65fdd05f8611ee2c1f8b8a14702fab1494ff5",
    "app/assets/useInspectionOperations-B6bh4QBQ.js": "c679028e42aac6338cb4d4abc660a67628f90fd1edd92e0f28df220274bdc50d",
    "app/assets/useManifestDraft-DM3XmfVp.js": "0f83b3ee8d6438ae1b631a80e2cd9d08c2de5459bcf6c621e710c2e9f60c8229",
    "app/assets/useManifiestoWorkflow-Dajznkij.js": "170e4169fc77cc9a3c7e5f504fd45ef87e8b05f6a11202ad57e0982fc6f0d6e6",
    "app/assets/useManifiestos-DgPJu0-O.js": "ca2d50627978208db4d9b95c53e6d819ade779345d0a1637a57949c4843ff9a9",
    "app/assets/useOperadores-CNXUEIds.js": "96b1bc4770d4369490ba903ef43ab117d35403ffe6d071848b07d283a7ae611e",
    "app/assets/usePendingDeliveryIds-BAVNdPun.js": "a3bf197b99c2c6a23faa709c3faf91a47f7c1987952ae4556f20a5d0e040de81",
    "app/assets/useRecoverableForm-CCjWOAyg.js": "2739e281c992ea90097a78c356fefeed767e881cb88083874de4c376a23ec0be",
    "app/assets/useReportes-G0znmwJl.js": "af27427b17afc92d8b31dcbf8cb6ca32be10cee978bf9d2cd1a56cf63794d263",
    "app/assets/useScopedSearchParams-CekjtPEe.js": "bdb08f5634d1579bcbd2b044f58fc6fd5236c56390c8d4905456314fa1b82505",
    "app/assets/useSolicitudes-DhG6e5yB.js": "daf2b8e8c555a7afb6c78bc6f40045bdfb63b1b9cb6ea221acb52088f899277e",
    "app/assets/useTransportistas-DG1kGeHH.js": "79d3af1de9a92c11a7b127140cccfbdef86f01aef2c11c0d73a88be0c1fc14b2",
    "app/assets/useUsuarios-DosO705T.js": "ddde14a04e42464e704dcbcb00d2d45a7f9ad2a4ff11b824a430f66089b8a66f",
    "app/assets/vendor-NioOPywp.js": "778a09281c3951ba856f716585f80a1774221c6d1d01278d003b464fa26aa6e9",
    "app/assets/vosk-3QKIipQy.js": "76a82719e4c7160d21004a48568404be0cf237f62d06e37bd58cb90d516217af",
    "app/escudo-mendoza-blanco.webp": "f39b5f4fc002cace884b751511506eb425310045d4be1c25ea0e886508ff0fab",
    "app/escudo-mendoza-color.webp": "55f5bb395c23632d1b47a944a7a5f74b5620bdbf63151ab5a0244f11a687f02c",
    "app/favicon.svg": "b3d6493e1d94cfb066b91fbf02a0fd7fa4b3ad5be5d3ec8e67795697c00e65c6",
    "app/generate_icons.html": "25f5b4cdcfca8b412b74907a831e83dca22fda0d75081f9722fed4dc51f0b836",
    "app/icon-192.png": "c77d8c1d194658ef8f91d1030ca474b622270381a4041541e0f73937c8ee1455",
    "app/icon-192.svg": "e36ff67250d5c1057e435613fbb0a4aefef3cef454cc36f31d81246032c51a6f",
    "app/icon-512.png": "bb3a743aeb387972fb225e59e121333077d29b65d13ff43f5c14bae9e4c09c17",
    "app/icon-maskable-512.png": "ce4c8b30107eebd7887a887da6301a257c2e570aca7818a88e84f5359c1952d5",
    "app/icon.svg": "b3d6493e1d94cfb066b91fbf02a0fd7fa4b3ad5be5d3ec8e67795697c00e65c6",
    "app/index.html": "0c1af161c62c78b21ec94d1f00bccb6b433033dc2fc40dab6198ab3c17e0147d",
    "app/inspection-export-mobile.css": "10582ea383c049f3f66b26ffd6cbf0c98bfcac5b4c19a97618d2162002bdf981",
    "app/logo-mendoza.webp": "ad6dc4eb052201b33ee7909685e9bbbddf1786185787a3adb75d00d38d474bbe",
    "app/mail-sitrep-rotonda.png": "c77d8c1d194658ef8f91d1030ca474b622270381a4041541e0f73937c8ee1455",
    "app/mail-sitrep-rotonda.svg": "b3d6493e1d94cfb066b91fbf02a0fd7fa4b3ad5be5d3ec8e67795697c00e65c6",
    "app/manifest-app.json": "d3563253ddeaa818897cfdf70c242075a2b0f3af3b6f93d8a550e38fef9f8879",
    "app/manifest.json": "8b14b3af307151538418235d2dbe464cc1a430a4a11ef83efbd63522a6ed33fa",
    "app/mendoza-marca-horizontal-transparente.png": "0034ba6cd9fc9bbcb2f8008ab4134d83cb4ef32434a45ee238a9aacc3b229543",
    "app/mendoza-marca-secundaria-transparente.png": "943e4096c98dbe16b65ac587d059ff2488981619b9db7115e9e5e1dcad78db8e",
    "app/offline.html": "d43a1eee2bda762a83ab853d6cb18e3cfada1a3411c6fd6eb2bb4d8aeaf5965a",
    "app/setup.html": "88dcad26ce40dcfb269c8e88522407508f0bbb63da442e8c6d393cc054fa6404",
    "app/sitrep-mark-green.svg": "f4e7ce0fd5aa2e0b084df24c1a9d01056af432dfd4586bfff0c5cf5b9685b7d7",
    "app/sw-app.js": "b7dc18336f0afcb3858bf651b8f17b8b7514f7c24b20ca6b3bf8ecda8345d769",
    "app/sw-precache-manifest.js": "b8567f7197109490fd2a8f891f943cdbae8c9c873e65d5e698704434bcb5a158",
    "app/sw.js": "daf1014fafc280af104d00d5cb71e6595a9f3f79a854b089adb4e366c1684977",
    "app/test.html": "fc709d559b31b9b3f85785e4a529c40e119615afc906e922446d9ce7e472399b",
    "app/vite.svg": "4a748afd443918bb16591c834c401dae33e87861ab5dbad0811c3a3b4a9214fb",
    "app/voice/LICENSE-2.0.txt": "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30",
    "app/voice/NOTICE.txt": "71d1af8b1a131465ca6d5bb2b1d4ec40033ff95fe23099176da6b31fb99a38b7",
    "assets/ActorActivities-CIAKc6q8.js": "4ac3b6ba0c8b403236461db1fbf18330736162dd7a6e33b1ac2e6b83110b7115",
    "assets/ActorCertificates-B7rn0ueS.js": "e25bbc92d5f668f6c9c6bca373f5c6f9c548101ad58068594792b76240f6d68d",
    "assets/ActorDocuments-B3K9VyIO.js": "cb4c2b2cd803967b5ddbb710ffd000dfac413dc53002bc40ce7776d31ee8fcdc",
    "assets/ActorFields-w6TZI8mv.js": "721c545395d3d020778a616cf84e0517f705db392cc9b1b23df4baabb902d097",
    "assets/ActorInspectionsPanel-C4nGDnFX.js": "2cfb03859c332045d1260342b68d24d8f9d9ed98c67a358b762732ef2f0c9a7e",
    "assets/ActorRegistryLookup-CfmrYVeg.js": "97c569669bad5742e3addc099529a9625cf8a8a314606d35074e182cd5d29f91",
    "assets/ActoresPage-B210kdNp.js": "7a6242277a1bed0cd79511621cf99e64e806eb0e54684d8f669f819fdd11792a",
    "assets/AdendasManifiestoPage-BPSNnFBs.js": "9bf3811e20d8ab86057220afc00fc303a036b40f5dd51f0e73a539cc9306057b",
    "assets/AdminBlockchainPage-nIsIlkQM.js": "5cb52c3ffdffe3f3a9da38f7cf01b99642e1a4ca0f8fba1c9374339c3f0c8bfa",
    "assets/AdminGeneradoresPage-NiI12Ody.js": "4a8d4f00575b22bdbca66d58eebae5bdd5662f7be6a0fcf7096c059c358f0d03",
    "assets/AdminOperadoresPage-D8m16kuX.js": "e3510f1271995cf2f09087ca4dcb02bfce405c16ffd486edbf93bf84520182bb",
    "assets/AdminRenovacionesPage-B4pPWpkL.js": "b1ddf819261b50e54d4d3d72bb72457089c24ee18303f66283038e9c933d9cac",
    "assets/AdminResiduosPage-BziUxvEX.js": "2c9c860fd9b34b481a10b692afe1db2d84cd1f45d89df0dbe5a1291702993443",
    "assets/AdminSolicitudesPage-DG9BRLrq.js": "b199c0a396a30c5f1145c07b394362c05615be4c93d8d1c3977e100b0b0d524c",
    "assets/AdminTratamientosPage-DpxnPV8m.js": "136315e14beead497a843fff73e82d028e0bd2b46456f04619ca3b6c82de6a12",
    "assets/AdminVehiculosPage-DdfwCEmU.js": "7e23d12e7b4c0d568f5909fa9a0db72d694b9f7f80e5467e2c880869bf61305e",
    "assets/AdministrativeTEF-DtmK1oAz.js": "eadd0f6b4fb11377069c55986e51b7e247f649dff44bb624d58969c349553a70",
    "assets/AdmissionTabs-B7BP1NNK.js": "cbbfed1301b65a1b923c63c493fe87dfe2f5f6267c39ad62bb0d4f7948f98096",
    "assets/AlertasPage-yHKsGQRZ.js": "e8de12df8d2dd50780b374c30d0808f1e02a654868939ca7d79d1c43f416ab42",
    "assets/AuditoriaPage-BbCD8w7u.js": "8f2730d15cd14105289d71845ea7ad22643344a344a6dbb1cc026281c57615f6",
    "assets/AyudaPage-Bxzd2QKQ.js": "d27fd32f7cfeef8f9475122e5eb7f573359ce85adb70ccda8f9f36b2ad801cce",
    "assets/BajaIntensidadPage-wgqlyiJV.js": "f883602a51da586efcbf3d589b25edda3a7b69a4c5f54ebabbdd359101c4afbf",
    "assets/CRUDSummary-9Qno5vkW.js": "0d56771ca0bc10815895a4442b30b81e52f3eca9412c5aea9ce13a15ba30e24e",
    "assets/CalculadoraTEF-CsNEJPcU.js": "4ca7891a55e07f2cb7afa75246f1ecf7de9c64880fd2d96865d3423abec2ffe4",
    "assets/CardV2-Cdc5lg_R.js": "ca44b0405c7e1d3be55b9224023cc193c57677348fa2746d0362b570338c267c",
    "assets/CargaMasivaPage-CuyvfhTH.js": "5789dd1c554c2e713fea3254c79affe21a7b0e7beab78296f5dd34d75e6b627f",
    "assets/CargasEnCursoPage-C40FMPZb.js": "5c34414f2ee697870eb801e80cb00540fb403a7baf768f9465396cef49ad287b",
    "assets/CategoryBarChart-Do9SRc0-.js": "a2bb3500339d1a916816f6e547e35c14d77fa6310046c43b529f9e2bda9047b5",
    "assets/CentroControlPage-BxSO0d96.js": "296e18cea382019e896db1a1aebcece1afcaadc426d878399712b0daea7c2501",
    "assets/CentroControlPage-hGltqfvI.css": "b2078ab2b09aadb5330e4538b2881aef71ededa9493ec3b0cb9dfd7c02411a16",
    "assets/ChartLegendLabel-vRqtbOon.js": "4c56f7600a233a32cb9c3a8cb91afa8ea302dc671b088662cceadb76745ae358",
    "assets/ChartTooltip-B1pqft4D.js": "297c1259e204dcdd3d0754865518dc3bb401ca0a1b045c468b5cec2dc7945405",
    "assets/CompanyRevisionDraft-2IeR8vp-.js": "258f595fb998047b7e1ad5d45a499d2f18d791833da756cb30b344397c26ed8c",
    "assets/ConfiguracionPage-LT2DWTWN.js": "b63970dfea93e4f9ec68bfc1f066b4e07a94a17d9846b90b817d1823e18317d1",
    "assets/DashboardPage-CdloKCeR.js": "86f08892f5d68deca3e1f2f3dddfb13354a523464ec0bed1f26936934133526e",
    "assets/DepartamentosTab-DeXxq9V-.js": "31a4030579c5f969b4a7f5d6301e8150e1670d050dcb3a7630560e4e95bfa928",
    "assets/DocumentAnalysis-DkEzgt9B.js": "80db5621286608c05294d5204aac1177147479f175e2cfe956719d18da098728",
    "assets/DocumentUpload-lJefj6uc.js": "497b56d180f0e94d87ab6b306ebb7c862be5a13beb4216b44b6fd7863efdbe83",
    "assets/DraftConflictNotice-Dx3Af-jn.js": "7e26fbad50647dcbdb4f1e0f86ac4b3359ae029037b822b34c32223f578c8ef0",
    "assets/EditarManifiestoPage-EgtLOnfB.js": "40d0250918b6a54b87ec77d5f4901fee89a54d5d4044e7513a5094cff9a8c312",
    "assets/EmpresaInvitacionPage-Bb50c1vr.js": "1c0d51f56eeae7c733666fe07d33ab203e073d44ce5ec25c7361a1e91994036d",
    "assets/EmpresasPage-DQ2nF9rm.js": "61f700887abceb543fb65855b661b2c92573bac30d384ac2225c0daf1a7038ab",
    "assets/EscanerQRPage-DLcvWrGk.js": "709a1defd5ce185048cb419e45e84877f5bffea958a9b2ad10d9a395595618fa",
    "assets/EstadisticasPage-uqauIn-d.js": "250bce8d1552b7b2cbcdf182e5e437053692f0a53984962f721bd1f2a4ee69f3",
    "assets/ForgotPasswordPage-zfSCn5hY.js": "6eaf49dfc824abe8e779ca0b963747e62cf1700aad8909c34bd2d06e92242d13",
    "assets/GeneradorDetallePage-BxV8qh6F.js": "8e575515c93f787e5528e3d648409b060b2bec00021c2b44fc827650713bceb7",
    "assets/GeneradoresTab-CKKgNmj4.js": "0444a942a91be2d2b30536d09abed33cf9f51c3cdd5b09361db57ff1dc901f84",
    "assets/GenericCRUDPage-CUlaSv5c.js": "52581ba2074cfbc311219db1b9785ff6e895e14a37fc1e54368ea061a60f468e",
    "assets/InscripcionWizardPage-B6AG70Kh.js": "f518ffa0246e8f53ed3f47364f27746ea21a0410eec2a4e175e557038f4e875a",
    "assets/InspeccionExpedientePage-BWvSwvCR.js": "f8a24b9f7e6e216bb75ded1c04561aab3fca6363cfcc9d08a1f0762769d1f47c",
    "assets/InspeccionadoParticipacionPage-iqNtMxm6.js": "493fe2fc182901c830cd6aa13f679849dca05bb86170d67b2e58230bb49f59db",
    "assets/InspeccionesPageV2-CjKw1bJY.js": "8e1bd695411b879d9a6ebb80abe8c7b156aa7c9447f3068ad6040ac4415ce58a",
    "assets/InspectionExchangePanel-00AciXrc.js": "8560634375d4ed217e29ba2e22f5906761bd028bec97ca4bb0e941470d144c54",
    "assets/InspectionMapLayer-Ca17qj8s.js": "c596827238cb1d4e0d04e09000b2f04aff5056b342f6db3ce945078fd0af00ae",
    "assets/InspectionOperationsPanel-nLbfcjRQ.js": "0e5931f68c803feb38ca93db94f2e99670cf84bb0cad9606739c19c0a6733bce",
    "assets/InspectionVerificationBlock-svwd0AnZ.js": "8f3da56cebb51e5384c0e50dcc67bf4b1dfb0009bdbe17b7491cd3c5bce9c5b3",
    "assets/KpiCard-CLKDBMiB.js": "1fff41870a8f0a0092d0f5493ce5f6593af214f12f7c1ff2fc4da7a1d9db88fd",
    "assets/LandingPage-AEstK3m5.js": "1b89d77383271781aad1deb0d7e60a5a4473cbb53fdba899b068eb35fd265c98",
    "assets/LoginPage-dz8sSEoJ.js": "0fffd07e4d646345f1b226bb15765d070e37eb391ebde1ede9e92269ec08d5fd",
    "assets/ManifiestoDetallePage-D26SfSuF.js": "7f50d3f3be4f115d4ad174f5c33f2fe38bc6ec6ab5910f860af41d460f5b23fa",
    "assets/ManifiestoDetallePage-fk0oVro4.css": "4a9ea55ddf95cc818c34fc292357ca9745448699680578d8dcfd836d620accca",
    "assets/ManifiestosPage-D4mK0OtE.js": "38117702265db6bb56deefdecbe0b5d16f6a40114f24dc701c05f3e6070af2a5",
    "assets/ManifiestosTab-DL_uQtqs.js": "5c3c535d704a905736bb1aee1342bfd970038bc611247d43dbe9d24b2319b7cc",
    "assets/MapLayerToggle-D_eTF7mC.js": "dda305f0d2027caac29a806e597c24acf1f185c036848447786ea4df485a5590",
    "assets/MapaActoresTab-CGgqrq3z.js": "e8a2084b5abd651c62ad3f078f9d4bbd3a19200722e5e3f10fadf593a720d49e",
    "assets/MiSolicitudPage-CUBiMxuB.js": "d01c04873c15ffd56b690510694c6a111ae02be3908c13ed54bd1117e61bcd16",
    "assets/MonitorPosition-Dld4awuN.js": "021c4c0d13c42b70e37e4b2e4384ac3d4d60584152e3e34f045aa78615dd0786",
    "assets/NativeSelect-DYa3Aa-H.js": "d92a8ed1eacd6153f3b2d07c1772137fdb8de1031e5595f06ee6cd452c96fd4e",
    "assets/NotFoundPage-DnvcZKsR.js": "aa9107d4bcef1cbc539b04eef73240dc583b05974bcfd251966a3f291577bba4",
    "assets/NotificacionesPage-B4QypB_e.js": "bdc77a0b56b92761d687c26f6ed0d295fc08cea7220dc6e5a090587963241631",
    "assets/NuevoGeneradorPage-CJngM0x0.js": "87d3a139700ce954505e894527087bb1d1bfae83e72f7fbf11c5d01f47fa256e",
    "assets/NuevoManifiestoPage-C3D1aJQA.js": "1aaf1d7094e9a8c328b1ccb97de9057b1f75ace0bfeff0ef0a7ac8917f80ed27",
    "assets/NuevoOperadorPage-BqHClqZC.js": "8579c1faf5df3be3010a177ec3abbdfd4055d46238e0dd44ee4bebaee1e304dc",
    "assets/NuevoTransportistaPage-D6T6P5BH.js": "47bf5149ba87a7d3b4ccca0b9d74e367741fe05fee5c78d90fc88a027f8b6088",
    "assets/OperadorDetallePage-WvoIaIAH.js": "9ba13022e582ddce5b8b4e85e69d8a79c8010e0f8f0992904f73dcfa0359821c",
    "assets/OperadoresPage-eJszr2FP.js": "a2a8abab3e248b4d9fc6044ac5276a4a5ef6f2b9914dfd8bdd55bc65a5a9da13",
    "assets/OperadoresTab-C14Wh2l8.js": "28385037be649e5b729f623057b230c24154096144c455435a9dc07e2cfc3fc1",
    "assets/OperatorFindingSummary-CUDAOf1l.js": "83417f138fce8e713ce3bb5c6133e2ad6afa4386d1e094b6f54087363026d27f",
    "assets/PageToolbar-C1g7K9qG.js": "15a6470edc78bf8c9bad23b0e80f0871e5f717a9672ceb002e406a414dfaaf28",
    "assets/PartyApprovalStatus-DcBs5aBU.js": "297fa13561fdec16407cebdcba22b41802c4b16ee1bd54c5b288e37a5fda71a9",
    "assets/PaymentIdentityReview-BoyHbmWW.js": "d73d23a58373ce427f019c558ff0b5707c85043c209822ef91c2efcca09a541a",
    "assets/PendingGpsReceipts-DYr8rlOj.js": "25e0f6ca184528c45a6255739187bcfbe9d1a3822827f00a9ade328ecb2ac103",
    "assets/PerfilPage-C33LQuVs.js": "da7c7b3a2d5ce773884545f2d2d15693fcc380f8c00ceeda956aa2ec3b8ffe32",
    "assets/QueryContent-5CSQmpmb.js": "513dd4dba4f28a4296fd0eee1f6a1962a2af847cddac99a667566a308c50cd73",
    "assets/ReclamarCuentaPage-B22t7yPf.js": "43f5be2c40828b069dbacf1e65ca88f85acc21c61a19633703c601e31fee0dc6",
    "assets/RecordListFilters-Cw-CKSRI.js": "86567d508d7372d60234a45c7e48efb38be9618d619a83514e88d21d3b04eb9c",
    "assets/RecordListToolbar-utNhBCky.js": "2ee915d11ba80ea7185bd661123dd4c6f7d6712f2ffffaa7f46fb08bdc76db6f",
    "assets/RegistrationFleetFields-B3Bpzokx.js": "bfed3f990e11e0d217b282ed6952d65d9e6b76bc08c687c8b48da4ba2dbd7329",
    "assets/RegistroPage-BArDrrod.js": "d737402f6ddf32ec0f6d9088f9a57692d57f07a06d13f03c1c4436aa5577acec",
    "assets/RelevoGpsPage-CCcx3hu0.js": "3557416cf7386d9b964642c0f5addb047fddea82ce2df118a3b443cfbaa2f62e",
    "assets/ReportResidueBreakdown-n5jb1ge1.js": "5e64e3a8ee2f030f1b9723928a883ec6262a266b34f0c82f31f53126b3a575dd",
    "assets/ReportTableControls-BALq0b5j.js": "dbb6c61b735708f56438e7f510ea66477de7603f8e08f01c388b9ee8f1ba6450",
    "assets/ReportesPage-DtUjHwIo.js": "59d2ab47f34aea850cccdb5a0c69d220cdc90b627abf55f4379cc7a6eb676c23",
    "assets/ResetPasswordPage-BbwNNAXs.js": "d7471f2cc59cff620f622e42af25a24603f0a13383df94b5a4183aacc21faac1",
    "assets/SearchInput-DNq60i7C.js": "30c6c177a49b37a0b7ac4a9efccec7ed4fe33296af7bdea404bb5ca35fccdd85",
    "assets/SolicitarCambiosPage-OuNwbyKh.js": "eb9ec879c9dcdf4befc37a33ea11bb869cc5b5109a70daa9748ee8a47c6d8107",
    "assets/SolicitudDetallePage-B-A-gnvx.js": "f9ce45c07fa46912cec10fc0cc6217213f00db699ee012ab92e17d1f2b7e545b",
    "assets/SoportePage-D68_U7-B.js": "7f665813293a5cf2241d22901981b4cb922696c992544f7aea3fd5a09314fecc",
    "assets/StepActividad-Dd6sEIxn.js": "681f9283fe119deb754b4e26cfed2b6bae5900497296f8b025f37aa543328435",
    "assets/Table-D-tAlHaE.js": "1c0417f2f4ebe6d4b2321046f61b3e95a70c4a01d3c1a91cb9df8abc53317653",
    "assets/Tabs-UX9rtMBz.js": "cf54644034e4a1f36e5c9e59686942a973b39c1449e5be3ab0ee7ddf510b4a6e",
    "assets/TransportePerfilPage-CnaDKrwa.js": "ca7f2b54a34cada32b4541a45f9d1de5e71f9c356ee57fa7e2b986e2c3a91f2c",
    "assets/TransporteTab-D_S1ykmi.js": "2bc71c398ce2f76839df8eca4ecbda61fb5e1a5b0c3c688c2423a5f99a9e5577",
    "assets/TransportistaDetallePage-CIj2YPnm.js": "161165c6774471075a046e4d6eb1407a89cc8acb85ffd107676606ced96fb959",
    "assets/TransportistaTripQueue-DXsOVaHh.js": "746e5ab31eed08c5db896446124dac04e75620883081c6b6b729334cb228945f",
    "assets/TransportistasPage-DhXGf6Mo.js": "fe2ebfb35c96b7ad18f9b358ce9557410d52cfc936cff023eb7b6f45926a40c0",
    "assets/TratadosTab-B62I0eto.js": "f70a1bb410c9a98fbaebd31114cc027ecc5dd4bf7e438f223c6bbca1886a8515",
    "assets/TratamientosTab-XKvDfkRt.js": "2c8f2fafef02e23e1d87954c975d5ca2b61a12d612c1cd373e0ecefea59ecbb3",
    "assets/UserSwitcherPage-k73SXP34.js": "4ea7d1168a354f926d3f134ccc21e6e84980b17de61136b0137048e4550fe90b",
    "assets/UsuariosPage-4vHjAXZ0.js": "8b9b0ae5c11f0eb4992cc6ae2a5abe2be3854a6abccfbbfddca67573f467c037",
    "assets/VerificarEmailPage-DToSNPXS.js": "2094f13bfa5cdb76cda2eff71dc704895a27dda316b2470fc95d8e49cbec60d7",
    "assets/VerificarInspeccionPage-TX-j4fdK.js": "0cc5abbbdd02f53f6e89bb250e4c6e8bcf49362112289e92558ff5f2030f2a1a",
    "assets/VerificarManifiestoPage-Bj0xtwaI.js": "30f6438936d3b0c38ef7b340d5a52912de5e4f68d961867fa278a6f1e2a0cef6",
    "assets/ViajeEnCursoPage-B-u7piml.js": "305f5f033d39ced0e05ba64a267c995885ffbcbc56a195b8d052e03c1cd9091f",
    "assets/ViajeEnCursoTransportista-CYcVGPbT.js": "1349701f661a0e95059aecdc2a680bed45e56fd38215a2fabe4628d796350c0e",
    "assets/WarRoomPage-_EKWi41d.css": "561fe576595660fcf9415f12d03459f11790ad08a96f1eb7945512b453693411",
    "assets/WarRoomPage-tFOxF96d.js": "d0e47cda0f9401e815daf9976b72d8b3c0e27c90a65f9612eada594cb503cbe6",
    "assets/activity-D_D8wy8W.js": "3b75d6d4018d397ffaf1e29c3c4eb12dd20c336d8a03317daa6502ccde49e2c0",
    "assets/actor-identity-r5g6Vo-V.js": "107a8d8fc609219b2a77292ffa9b2a1e61c807824d7aecd27a88061b8ad58e59",
    "assets/actorCalendarDate-SdcFucGH.js": "010fe6c3d0c433c13c778e8ed80a400ed81b96c57e0d5d05b4c4dddd0a685a9a",
    "assets/actorLocation-Puz-741W.js": "761c9cd67e878e7c51dd3a5b185065ae08931ef275ed3335012722ca78fb01b0",
    "assets/actores.service-rO375Njy.js": "031aa9ba4abd9e61ccedbd2f6577e16776abbf15d0ab3a4dcc615d056e72d36a",
    "assets/admissionReview-D6mT3cNj.js": "237000fff8bab768fe5a9e48019ed253e2000dd2cff80cb4d2d125b9e4d8ad7d",
    "assets/api-error-Bo517iFt.js": "016ca49916a88f9f40ec67d70655656aa12519d02800196d0f12f983e6ed8704",
    "assets/appendDictatedText-mwx8gva6.js": "a901cfb9802db024b0086fe185de53428e03cfe59c869b5f7bc312f4d9d8604e",
    "assets/arrow-right-left-DG1GiXop.js": "157d44f503f6891d350c75044b845106623ccee50dada40ea30a08109cdbb3c4",
    "assets/arrow-up-HmryLGnk.js": "0eb8587e7986be9acf55d96632a77ae29a9b32e283937c3890861c475560650d",
    "assets/arrow-up-down-B4T4GRBj.js": "3366bc7a7e29320e17655832eb1930430ba1f940490e58a742e498d9511afae4",
    "assets/beaker-CQy6ID7N.js": "5e9a3ad8eba8d5bd2410ef10d3f2fb7f33ea77749911f2c62fe50ea95aa1a005",
    "assets/briefcase-DqOCgtuc.js": "a102d8645b228c11c0bc46f0953601d1087c114fbefc535a2ad292a658bd529a",
    "assets/calculoTEF-DM9w28q2.js": "fb3557fd317f407d5b1380886ae8e7bc258e6a8eecd2a566b1e6b1566703fa64",
    "assets/calendar-0tee6qoE.js": "6b60eac84fe3fd24170eab33132f4d82062b9470c4a9531c62b1878eabb5072e",
    "assets/calendar-clock-Bi2Spi3X.js": "7e47405fe89617941fbe0d5d6b395516451f0665d24af3c5f1cd07bd761d7a0c",
    "assets/calendar-days-BhEX5WF2.js": "3946a68f1e9544a7258d5fe7fdb8877cacdf977afddb00deb97cecb8317933b3",
    "assets/camera-BHJ7boy2.js": "4f3c3c7a77b534da7546ca12e06706622563a6230f346699ecbc30293053f570",
    "assets/catalogo.service-CN806Ztv.js": "2e5da132dd5c7006d6b84ec0840f8cf68ad7560a0ee29ae6cb599d0869e74a82",
    "assets/chart-colors-I3qy-xQE.js": "d7b143746bb81dd8e1a5616b0c7c35761cc12cf9f047dba7296b4ecc7eaf0df5",
    "assets/chevron-up-70ZpeMNj.js": "4cde69faf21837b1e43ed9d4639b033f963fc061b06a57058821499741dc4fd0",
    "assets/circle-play-DoWKR-hn.js": "8d5586eca365ee605931c97763079bc4c6159e83cab4f6b8beb713a2068a923f",
    "assets/circle-x-BcsVMXIu.js": "d7d27b2d4d7ed5b66ec698df9713831957e2a6d6ec3661c9942bf8507cb73b99",
    "assets/clipboard-list-DzM6qf2I.js": "100b73f7e14037ccc54e9209f2ff6a3f543f388d20d0e87f413048a48f2a5b40",
    "assets/clock-3-BO-zPxv1.js": "24a0c9800009855d4c3ac5e4d3175e2b8b3cc598c70e294f022296cc9052a570",
    "assets/copy-BO05-TwN.js": "c6fa4b7f11beb930950241fb1b4e6e5f5d8f3bbd205abbb937046cc6d0672a30",
    "assets/corrientes-y-B5iuHi2m.js": "f72c95a3d087525d077101086ae8a33dff7f930dde84645947a135713d24a376",
    "assets/crosshair-BWy_QMuP.js": "21c98d3f3b376a1b3da1d3b2c998912cbdbf95e4e3397163e5c45a4b2c7c3cf7",
    "assets/date-presets-BrqRuezY.js": "75bdb1e7ad3514e04c1e427f2a95478f86632ae8a26d821242ae3551d429f1ff",
    "assets/dictationCapture.worklet-BI-PfSIB.js": "7c16f427e7c55ba275cf88df2ccc1395026280f840618fa6ebbefaad3324748a",
    "assets/draftConflicts-BhHfou1B.js": "98b8b6cc38329ce826ca4ff6188f15140cec021039b936788580986056b51ad9",
    "assets/ellipsis-CBoduxR-.js": "649118fee753146d0d0109bfcadd4e3bc4b5cf9907744db3a79c2e9d79600170",
    "assets/enterprisePresentation-BJ_z-1TH.js": "5070b72e921c660f670eede81325bb03bd4cea0b064f28e0236ba2044465fff6",
    "assets/exportCsv-Cq7Zkuwf.js": "5745f4c11c6ccbd3523fb51ef0b9235554ca342c516ee9de511b26cad2f959ba",
    "assets/exportPdf-_kS8WShr.js": "9edb315d9ba2a8ae17a15cf1bff1be924526ba088b737a6e2e626003c0b2ea9d",
    "assets/external-link-CgfpzO-e.js": "9b52ffada84c32440b231a37073b9e4533393693cc4c7ee9533d3d7e57eeff1e",
    "assets/eye-off-BkHAfnU3.js": "66f9b44c98d60d944330566898f667b8ea0c6806845f57626071d859c68c459a",
    "assets/file-check-corner-CZiHNfwu.js": "fc1840d4292656c3bd74186b03ec869bff66dbc4d751d95128ddcb4c50b225ee",
    "assets/file-down-DCHAtL00.js": "64eff20ad59d409a63d736540aa7c2bab855197cc77f862afdba6a18f9e2e17d",
    "assets/file-question-mark-DH6a0CsW.js": "6b994529e1edf10d9933b541e44f6e397a6387ee241d51f1c6827cf969b4fa29",
    "assets/file-search-DxhzlXw1.js": "073d0408d861dc5a727b5c013d8d1cffa1cd81ebf683bac9d9c65674a430e7d2",
    "assets/flame-CyG5RgWV.js": "51ac2e7030d05db2bc5738e49a0a35bbe7445b2981a179130c91885e1960144b",
    "assets/fleetGpsStorage-fQMAjd_3.js": "5f7e71f7165c51dd30299670821c8fe1feb247801fabb4f79f30ad54bfb33bd5",
    "assets/formatters-C2Ih5zNK.js": "9a052b2c13c003e3d2670e78aa82fddb562150d294ee0023b25b64249205ef96",
    "assets/funnel-ooWr09Yr.js": "73485b21ebdadda05959deb810ba19ffdc60c5cf88dd74dbda5d5d202ea70006",
    "assets/generador-fiscal.service-SHGLnOvj.js": "d23687fcead21ba640118d76844089f339e561f32ba60b1f3a2f64022bc74eed",
    "assets/git-branch-BHSXvgBY.js": "89f91fd7d51236f28440ea9a9a4b6c2600491c2f042db83f94b03979a70d53a0",
    "assets/gpsFixOrder-Bpa8I0V8.js": "988ba8c58f100bd51bc725652b85cd4986868f45ce3fa0f65972cf4b2c67ef18",
    "assets/grid-3x3-DXPBEDL6.js": "c8570ef266fdd95d29d32bf661e91d3317b5f060393ae62a66ef6f09836218b8",
    "assets/hash-C1bJC6sI.js": "10b808f27f1876595a61b7efeb0b414d6d4f1579d5490e38b3a8fb4b276221e3",
    "assets/history-DdRZ5f7h.js": "979f0be00167e1622da06c6dd643b8abfd16571b74709387029d5a3c33e3684a",
    "assets/html2canvas.esm-DXEQVQnt.js": "7b07a9ca175c614e8e7de447198d35b0d161dd50db2c63b5f7fd6ea0e1e876f2",
    "assets/identityCuit-B1ZM_8Nf.js": "c5e658fe4523e6c3920312bcc8a7e26fd6be343d322ec92e52b2d05d496deb8e",
    "assets/index-Da2aoY8g.js": "5340973109a2429081286a62bbf3308ff4a70ce832463da3601a772f1ca907e0",
    "assets/index-i1NM-h1n.css": "e96083b0fbaa59796c34c739b1d6f913f53ccb40b54cae4303c337c802719027",
    "assets/index.es-IBzOiMT7.js": "9c00f7c24a818b5937d498bbf5e66325aca0457d09e9b761641155d2827192f6",
    "assets/inspeccion.service-DsW4KflB.js": "55270de73df0e8c6c6c50cef633c7f3e0b054362b26d4a3196bc0f416063c8dc",
    "assets/inspectionOperations.service-BaAa956-.js": "bd8036f68bd7aa01e600f032d6dbf917d3ae265f64cc9d2c47a8e0899c9db473",
    "assets/inspectionPresentation-DCSGQC7G.js": "191f4d6c468b9026ccd37b337b1af1f57e34c9515b6a9b801bb530a4cd90f40e",
    "assets/inspectionProcess-CGCy6bTH.js": "4ad915b6cb984c051fd12ed464a6bd68aaf0f9a82c53184874a756a73ea01995",
    "assets/layers-a3HWg8Z-.js": "7b510706940bb31e8c03ea07f3a2967f9614d2579df464425ffd615b13381b55",
    "assets/leaf-DCKa_wlp.js": "1a0d5f95ec6e31b91a21123c652e5e07a5fa0eb4f7f6dc9d060b76010dbca422",
    "assets/leaflet-Dgihpmma.css": "7e14f0f44c4713eb7519182d93575f59139200ca781397a493a11f1dff0ce5e1",
    "assets/limited-transport-gps-B-gv9kSH.js": "f9d6a22b3c0d579eac9ff2ac8bb69691ef373f962ebbbb065341647d0609c576",
    "assets/link-2-BsgUWFoj.js": "dccd28d2d305777254f03fc097b25580d4d2fe98a33883542cf2b36b4dc15011",
    "assets/list-Opma_7vX.js": "08ce6018d37bff54788b50d678d72c3b6398efc5fe4c69d80e51aeb844fc7df1",
    "assets/loader-circle-D_513vVO.js": "540cbbfbba4602b052e5e85d0b9419b99a22b0f52dd70db1e9c8a92a62c14b04",
    "assets/lock-DzhRKDre.js": "de58038c20babfabd98760ee5d38c73406b4eb59c58ab0679c2db92293f81f92",
    "assets/log-in-DXcIwu03.js": "78e63d35aacf868fc94ddc33a14e329bfc7ed4ac60be99d9163decf461016839",
    "assets/mail-CILg1Rli.js": "a03e588da4becaad94af6db0cd68829243a3a9b2cc048f3a50242a2d9c0c36f9",
    "assets/manifestEventPresentation-VI226ORn.js": "86737d1c2bf2485f783f2663e344bc103e4349960b5983776ebed769dab6a0cd",
    "assets/manifestFeatures-joYM9aPU.js": "032e4fe0f6208c940cb904c840a33bb258cf5569838d7c9df564c0206209f674",
    "assets/manifestListReturn-uPrFhWhQ.js": "225cf1fb1d67f1e5c39c0ff87e895e7be5bc43312ffe048e658d106feca911ce",
    "assets/map-C757oiKT.js": "5b5e8862fd05069b82ca0b3e6a5b4f342a3a28f97989f5e04974accc1218dc1c",
    "assets/map-icons-BPIYOJJt.js": "85b185b118aa551919c5cfe59cb960cc477229b61b4a1955d514ad616e378fdc",
    "assets/mendoza-departamentos-D_nrjr_J.js": "8ec82693189d738558206bb197b48e470bc79714179f9920b6386884d756a340",
    "assets/message-square-CXhVs8kt.js": "e8113c5dbff1abf5aa350132c05013934afe19572b5975571442fe3dc2201df0",
    "assets/monitor-x-pJoXSa.js": "6e59ae05fd16f8f0fc10984fd5c6b0972fea70b4c7caf8474ba0f8e972357d02",
    "assets/navigation-7lpwYptV.js": "2c2f0a6316a999bf06f3c14f48f7997b3bb73afeaac6247f982a0e6c51dc2dc2",
    "assets/notificationFollowup-VdP4Nx5t.js": "83343f3e6f1b0733510dde2fda66ec65319248d35f1fab81838304d7041dcd78",
    "assets/package-DdMuB0V6.js": "ef827c5db2cf11d17c14232e6e40cf56ed2d8cde46bfe3be9686208724c67606",
    "assets/paperclip-BpjOSRHZ.js": "808f993c911036ae2de466ed0a27a6e7f76039bdee0513e2072c4de2520f2edc",
    "assets/pause-DpTORNPR.js": "22cbeee453e8257f27c22fa24e049b29837d1572721cdeb77b4c6a5fee80975e",
    "assets/pencil-DdTs-jwX.js": "0b5519f2894b297234077c95a3f8662a5ea90ba54a482b2bed2b47df48e48b17",
    "assets/phone-CXIQbgcE.js": "237706f5b5aaef81cd544170ff1b94d6d7241eb9a9d42057e72b00ac97e5a815",
    "assets/play-CB1CK67v.js": "c1021d2ba15fb144d09e87beee99e40457ed4299fd777703a218654717e5b60b",
    "assets/plus-BtW6eYlO.js": "912522cde43c26d2f5a6711d10a915145c8e316b064b1f5582a734bfa3eccf15",
    "assets/printer-Dojfdtb_.js": "0f87ce297309f23ae609ca83a2a4d6c4bf4ed80b27f8b4349093654f1878e1d7",
    "assets/purify.es-CEBYger9.js": "ba64ae392b2dd7aa911cfdcaac46cf5ae750b137a8264b958aa854cd1d76d673",
    "assets/qr-code-B5lqvs-R.js": "194284fba7b85febe5d2f0b5d1ff3b655acf7246102487bf7d4dc615143490fe",
    "assets/registrationDocumentReview-BL_N8QGk.js": "797cadf3104cef50998fefcf98b9b8432bb3d1200ed575d5f8c87ff9085310f0",
    "assets/registrationDraft-DGVPIzDr.js": "912ba755a488fc6a256a8d0dad9e8960c11179c757cd0e75a71dc7cf3117efbd",
    "assets/renovacion.service-CqMyYYk7.js": "09a4a1d6718cf954e6d5bbea2e86658f2c4a69de761b75155d8db5ca8184543c",
    "assets/reporte.service-BpDVlBAn.js": "827ace92048f1d9d62e4469183aa16c4f15803310671da67bdb7b87b3a6db21d",
    "assets/rotate-ccw-DUDLNbZK.js": "07bb81c09fab657d249ee2699d262d97d924e0d1f7d2e9bedf83a63e8e9968f3",
    "assets/route-CW0IorsF.js": "7ed956cccaea976b442a0895c012e3ab8d430898f15688d7dc77d79ea5601243",
    "assets/save-DkN1kCb3.js": "ccad84ca0a32053d9794a4f8d3f7c0738d28d40556e6c995914bb64f3d05c86e",
    "assets/scale-DIB4s5XQ.js": "69349abc3886e228ecaa2c07181372b82c8b4d35538b82efbe91243b357609bb",
    "assets/send-qWrUrKvm.js": "5502e42b8f1d95b316e653957a8bfd1e2786d03ffdb2157466c335f712ef1109",
    "assets/shared-DhhGkn_f.js": "d32bd6fad85210d59b0bf5eb996e6e2edee251ed55d946e95da3e99f9b09e774",
    "assets/shield-alert-BSlhwV1q.js": "9041bf7460752d54e4fa5810bcc338649a67d2e3f9676fb6c340998ad9c3d51b",
    "assets/sliders-horizontal-CXvPyLCo.js": "4708d1ce109e1b34ba18609586fff743bde24c23e34c360c73425f022251bcc7",
    "assets/square-pen-D1I9VQb-.js": "a2772e31b05f1d6784f4ba5fa18a5e7a37dc6065981b45491874ced2a7ee71ba",
    "assets/supportCommandStore-uh31TVnD.js": "e84d8c8df75b8eadf889b08a38ca3558ba6b0d7a5d9eb6efa2b6d63da4117225",
    "assets/transport-handoff.service-B4neV2Nv.js": "6efc07e5e4de0a54b01048e9afd5801ef0fa7de559c4955e1026428876221337",
    "assets/trash-2-CUqAJwvr.js": "e702825bae217be0e2ea2b6137ed36019b1feded8d248dbbf722c288309a0c57",
    "assets/tratamientos-catalogo-B-PmgwlX.js": "092e926bcdd86b6dac369fcc2791d02bb8288f199915e8c916b6dce48b1d2159",
    "assets/trending-up-DD2WjvQ3.js": "511b1adec547456dac5e934821f509cc1ffc423680a61447fd23b8ee94b5003e",
    "assets/useActorDetailNavigation-2Qgo6AI2.js": "1df4248aebf0e1bfc8d4b3593576c7754f074b5ed668865368bee81f78659f9f",
    "assets/useActorDocuments-BL8lNl1z.js": "fe3c126a5c1dc803d4280b15832307fb4400d7ad4d90b7124e0088eeb3772d3c",
    "assets/useActorListNavigation-BoDLh9HR.js": "ab8f0969565679b9d3f62a4d0b513bd9f7a09c62a1c0d7868e7b2e627692624b",
    "assets/useActores-Q7X4trf9.js": "c213a4755b606ddd6b4d8e78ad63f211097003a0e408517e27b813015bd43ebe",
    "assets/useAdmissionContext-DCipHeqy.js": "b87a312b77d6a5b057c47b1ae4902e4481869d08a6cf190dd76ec9b8805de7a7",
    "assets/useAlertas-DCfciJnH.js": "ff1594fd788434cd51c9e2b79b1a98a3a1d0bdf75a49743bcb3e0a233f16d5a8",
    "assets/useCatalogos-COXv53UE.js": "79a6be71234b9c8d6c1254b2685ade71b3f2d822023f7578306297c1fd646075",
    "assets/useDashboard-DZyochUi.js": "68bfd4e78a87ae2399675cead3c0c14501354860f80c2c6bb5527afda15f871d",
    "assets/useEnrichment-CwpjM6uL.js": "101739490733e47274a28dac3967c9f5d5bb4556e94b3ac932619bb4843a6033",
    "assets/useGeneradorFiscal-Cda1brjR.js": "420dbec6d7da18f8943367356558d2d13b0631384e7eb2a931b6eb8e4b087333",
    "assets/useGeneradores-BKkuDRy9.js": "0d4939db73605c638aa84f3e90633dbedf6939ee832339d2d5de4befefb4f544",
    "assets/useInspecciones-Dco4egDy.js": "aa36b4a128807c6f9c41adeb8edd6e2970edb1ce6dfde04e11cce45586248b58",
    "assets/useInspectionDraftOwnership-DysotqCk.js": "57f973d4b31a38d6bdb857db951c94071907a773f753b25775f9005866b6df4e",
    "assets/useInspectionOperations-DwHrS-KY.js": "c1a012b4b93ca4a740d83e5733b61ab25f401c0347950b0b02fd0a910b32f323",
    "assets/useManifestDraft-Cr4I1bwg.js": "1f1af3e4255462c3f83873862bfee3c1c3d6a926e58c1558cf2fa8af08fbde55",
    "assets/useManifiestoWorkflow-BnEupwes.js": "1d39015ef1ba6129581214a1e89379f226436e4d5703a82b25af254ae6636c0f",
    "assets/useManifiestos-DFq8Kw62.js": "c687c884d2e2eac01d546c3278f83d8879d9381eb4cdf2949c5bc910128c2063",
    "assets/useOperadores-CCAzIjld.js": "00f5a7ed6f6ea5d01a5c802bb336e81227d07263bf8d237d9fedfe5dc8a985af",
    "assets/usePendingDeliveryIds-6CajHhDw.js": "901824590b2272f929ced50df065c0a1553adf76741eea5534543a9c8f9242c2",
    "assets/useRecoverableForm-BHzbNDnm.js": "7f98a9b6fdb1f24ee0535688b3080be5aafd400ff6fd4f1ed24246589045134e",
    "assets/useReportes-elMJkgKj.js": "ad804d648faf2611c92e0de2b12fa08d02feef54a9ac9132174eef28ddf54cb5",
    "assets/useScopedSearchParams-DoxHlgB7.js": "d4aa581f6fbfb9583a2e77146a9491e4307b9135fb30094a8e90a1dff171e643",
    "assets/useSolicitudes-CvesvtPR.js": "97ef811f2f029f9abe61fc66324c62a07e343374140926602ad2fc277a8386cb",
    "assets/useTransportistas-BmNA-vo4.js": "5f21bf62b11484b92ce9ea6ad0b89d5752868b3e1397c80395b2d06d93e121ff",
    "assets/useUsuarios-BD2FyCWm.js": "d235e63c1ca2e5bf0fc796eb6bcd5e41796d354763397c3b3a55bbc4da586e71",
    "assets/user-plus-BzBUyeNP.js": "e815c596c21b63894cd95aa44ad8d4dde3c076f59bf381e0eeaf2a31c9ac6765",
    "assets/vendor-charts-b7H0Nkr0.js": "6276794e63130a56adb32411b4b5262ee0f99bdede769da5720fe6dc3bcfb99a",
    "assets/vendor-maps-b6zb8Z27.js": "8e8e7a174c146f5ec590cf76926b94ce64a284c6f36166fc13ec59c2403aa15d",
    "assets/vendor-pdf-e2JWFSJK.js": "59779534bb3b1a1e6a99af4a91bb016dd4fc48902a8a1ad1c66f2e869e45f885",
    "assets/vendor-qr-0ZS6nwa3.js": "0fa7d5068ad96fe5d5808d43213f2f366f714223c88601df32e3e2df9a06735a",
    "assets/vendor-query-BdTvbpJe.js": "2c085501b61eb1d589ba628268a18e1eb4f13e8f72b89e3fc04a31328c618fcb",
    "assets/vendor-react-Gn9tXamG.js": "3e726f7f67907e6607b0a8d0bf5ca3dea134c819c0e4cb141d8618a30ed05765",
    "assets/vosk-3QKIipQy.js": "76a82719e4c7160d21004a48568404be0cf237f62d06e37bd58cb90d516217af",
    "assets/weight-DI0CnN3r.js": "bc2a0e90abc39a5f34fecbc6366de79837d30c8582fc316c53e2315fdbf5c219",
    "assets/wrench-CzR8wJzf.js": "259bb660255a12551a1d9e4f54e056399ddec447818684860a1b673dcc3eb00d",
    "escudo-mendoza-blanco.webp": "f39b5f4fc002cace884b751511506eb425310045d4be1c25ea0e886508ff0fab",
    "escudo-mendoza-color.webp": "55f5bb395c23632d1b47a944a7a5f74b5620bdbf63151ab5a0244f11a687f02c",
    "favicon.svg": "b3d6493e1d94cfb066b91fbf02a0fd7fa4b3ad5be5d3ec8e67795697c00e65c6",
    "generate_icons.html": "25f5b4cdcfca8b412b74907a831e83dca22fda0d75081f9722fed4dc51f0b836",
    "icon-192.png": "c77d8c1d194658ef8f91d1030ca474b622270381a4041541e0f73937c8ee1455",
    "icon-192.svg": "e36ff67250d5c1057e435613fbb0a4aefef3cef454cc36f31d81246032c51a6f",
    "icon-512.png": "bb3a743aeb387972fb225e59e121333077d29b65d13ff43f5c14bae9e4c09c17",
    "icon-maskable-512.png": "ce4c8b30107eebd7887a887da6301a257c2e570aca7818a88e84f5359c1952d5",
    "icon.svg": "b3d6493e1d94cfb066b91fbf02a0fd7fa4b3ad5be5d3ec8e67795697c00e65c6",
    "index.html": "db3198973fd8149d093832c43a0fb0bcd23402bcba542d7c0ca563b7419d1ee2",
    "inspection-export-mobile.css": "10582ea383c049f3f66b26ffd6cbf0c98bfcac5b4c19a97618d2162002bdf981",
    "logo-mendoza.webp": "ad6dc4eb052201b33ee7909685e9bbbddf1786185787a3adb75d00d38d474bbe",
    "mail-sitrep-rotonda.png": "c77d8c1d194658ef8f91d1030ca474b622270381a4041541e0f73937c8ee1455",
    "mail-sitrep-rotonda.svg": "b3d6493e1d94cfb066b91fbf02a0fd7fa4b3ad5be5d3ec8e67795697c00e65c6",
    "manifest-app.json": "d3563253ddeaa818897cfdf70c242075a2b0f3af3b6f93d8a550e38fef9f8879",
    "manifest.json": "8b14b3af307151538418235d2dbe464cc1a430a4a11ef83efbd63522a6ed33fa",
    "manual/MATERIAL-SYMBOLS-LICENSE.txt": "58d1e17ffe5109a7ae296caafcadfdbe6a7d176f0bc4ab01e12a689b0499d8bd",
    "manual/actor-onboarding-capture-provenance.json": "ff1716a4cb79b2d3d274c5b9048895832c9d3ac38f2d606d2d8d17bbf75e353e",
    "manual/actor-overview-provenance.json": "84f152d9c1d691b877e7449d7da902800c06f89365729ff4d3ded04acb60fb5d",
    "manual/actor-representation-capture-provenance.json": "42c32c5e15394f782020dc118436fcdb96824ad6eb51041f40f9fc1a3420623d",
    "manual/capture-provenance.json": "551d946497f2598000d3fe270bddea2241fe64580cbb61dd14b073b2a13e34d9",
    "manual/certificate-capture-provenance.json": "b5532620959025c66466ded7dee3f0c1737162fa878cf960afbb3d3b7072f4f7",
    "manual/certificate-layout-provenance.json": "a058464d06c04138cb61a354e88f293d252eb87e7037cf7926ea7563c27c32ca",
    "manual/circuit-review-capture-provenance.json": "aacba03a0ff7882c735c760c00d028fdb55302f0f043c36d43e8a4e447e00943",
    "manual/directorio.css": "750f685c23f8d46ee1bb1944b9ba7d6f778e81784052d63a2303b6a4b773370e",
    "manual/directorio.html": "942aabc16533d19ae27cbb3fce601df04d5a2cac644df87526081a18881cd267",
    "manual/directorio.js": "e4259d0929beaad3c7db3512375a814d249fa18a2a0287c286207cbefb1b5359",
    "manual/electricity-capture-provenance.json": "c25c1ba6e1b199e3bf8cc03462ef784bcbeba7f01d373f5d2ebf10a594745d98",
    "manual/fixtures/licencia-capacitacion.png": "a9d23521b4ce66231735e6410b400839dedb490fcddd8ac303dda7c6350c7ab1",
    "manual/fleet-gps-capture-provenance.json": "b913ff62872357092e95e51168b69a44b0fdb82218178440f3f4574c40513647",
    "manual/help-data.js": "4dc0cf3d237d68283885d38571dd22aaee38dc3024194a8d67b5b80912522f7d",
    "manual/image-mime-aliases-20261027.json": "e5d1db86ce9481de3f489d4c16858e56c5b3fd4ef1fbfcc401ccccd70e4d97bc",
    "manual/index.html": "e09f3a01b241f68d04a14cca888813b01e7a4f33431c15fec92d236041bb9f76",
    "manual/inspection-intake-capture-provenance.json": "e323a15fcfbd95edc6389bd70ea0ffd6f70efc975565d2a28e2c73fdbf4aca1a",
    "manual/legacy.html": "0ff369ab11b5ecaa59fb4fd7b97e73d6d683912f6d81442605e04dc1b0f78574",
    "manual/manual.css": "16fc23bd77e466a0be768530d4b90651c922d15e173e7351152bb3ff00227056",
    "manual/manual.js": "2556dd968b3651de61f01b35835e9b98215f883a915b28e44395f41869468ac9",
    "manual/material-symbols-manual.json": "3b0075f33948e215c38a51a10332abbca7c032bb8775cfad0b161b3b20781fd6",
    "manual/material-symbols-rounded-manual.woff2": "898a9fa959209eae49c1ecb05368361c008831337726ebbe8dd04c998cb6c9d2",
    "manual/ocr-capture-provenance.json": "9ff6753889ed798d4c77bcf42d09ad9ff303a6d258f2d4dc1581f3935913f755",
    "manual/psip-actor-capture-provenance.json": "785b7b0c375b485bbc5ed28bd68b6344953961e13eafdddaa2c498da17ea551d",
    "manual/psip-capture-provenance.json": "7c37b545a26f47de9a34b5aa60b0f2fe425ee43c5e49cd907694acf5aacad4eb",
    "manual/registration-capture-provenance.json": "238a92b30864559115a50719b8bce8ec4029c5c0e8ac9253f66280d1d133d055",
    "manual/screenshots/desktop/01_login.png": "06c3293fa454f11fdc3cb9fca0f4e52802c2d0eda8813e4c3187c3d1bc746e8e",
    "manual/screenshots/desktop/02_verificar_qr_publico.png": "8e09e737b340ad4f3db9a096006eb7ec2a42073ce6f3d2a278a91df6e0a6e02e",
    "manual/screenshots/desktop/03_user_switcher.png": "31513da0cb007cd9f33781305b2836cfb0f17d12f2e40db1b8db1d5380b75d18",
    "manual/screenshots/desktop/04_dashboard_admin.png": "56e4a6a97a679f5dcf0164204f2633b52dbad6eaba4a984756a27222a194c08a",
    "manual/screenshots/desktop/05_centro_control.png": "384766773035b8067d92bf3f778f1269e9e8e5f71f7823be3352a807ccf1d7fb",
    "manual/screenshots/desktop/06_centro_control_mapa_zoom.png": "64cb953b6483b800518bf22f02936a6cc81eaae3cb267d50d6edb1a2a75aeccc",
    "manual/screenshots/desktop/07_manifiestos_lista.png": "ab05a895f13d49d6fdca626a84f4eccac1f2e5fbb6b18f77183fe0751be51db7",
    "manual/screenshots/desktop/08_manifiestos_filtro_borrador.png": "3491fa9c93a8740c927ed2cc7f2e75b1a9f922f76f30147fc489396d58e317a7",
    "manual/screenshots/desktop/10_manifiestos_en_transito.png": "b38853e71c610486a44ab51cadf5b8cf6fe4b352ffd5f445469ecad98b9f2ae7",
    "manual/screenshots/desktop/12_manifiestos_tratados.png": "0ee54735f8a019d415900f06806a732147ef20e692e3b5d049ff3d487d75ed17",
    "manual/screenshots/desktop/14_nuevo_manifiesto_paso1.png": "f8e9c133310a5d106a926775367595aed7a74c7d0217e8fc347ce7f1efdadb84",
    "manual/screenshots/desktop/15_nuevo_manifiesto_paso2.png": "69811a2b844a0a49eb187dc98d24233ffd568ffaaff6e1c73a4bd1109c00b0d5",
    "manual/screenshots/desktop/16_alertas_timeline.png": "95a585f479c0baa94ddaed2cad0f135ccdacb7918557a51a0506d7081edee282",
    "manual/screenshots/desktop/17_reportes_manifiestos.png": "b56655a3eb4e7bbf0ab706de2596e281d590f9cd532c7be45967a43eee3f9012",
    "manual/screenshots/desktop/18_reportes_transporte.png": "7910c83fe099135d8fac58d7678c50b9bc62a96ad49626234956caaa13863438",
    "manual/screenshots/desktop/19_reportes_departamentos_mapa.png": "83b321f43313e2f842ef73177076e893ce0535b2e875ce07b27e01f8ab21efae",
    "manual/screenshots/desktop/20_reportes_mapa_actores.png": "658b401f6511af28add9dd0a62e2c60375637b827e95346dc18a59f2726e4ca7",
    "manual/screenshots/desktop/21_reportes_generadores.png": "59768742f005612744ed9a93c00bf272876eea480b8373c0060d0b7b52b4ff54",
    "manual/screenshots/desktop/22_reportes_operadores.png": "0a834e8386fef2974477bda046aae1dfc4bf76e953aba712fa39b17990a4db5b",
    "manual/screenshots/desktop/23_admin_usuarios.png": "abaf84e4edd27e21d8093604e0456c92ea18ef0b6ad9285a7989086075788057",
    "manual/screenshots/desktop/24_admin_usuario_crear_modal.png": "abaf84e4edd27e21d8093604e0456c92ea18ef0b6ad9285a7989086075788057",
    "manual/screenshots/desktop/25_busqueda_global_cmd_k.png": "57e1ee16fdff9fffcba12ebb82f661a5e20db80c8b93fb4f30d33bd208832585",
    "manual/screenshots/desktop/26_admin_generadores.png": "f9ce0e63eb2d2e476d0b4cca7a803839e029927a58181a48483768bb63a70757",
    "manual/screenshots/desktop/28_admin_transportistas.png": "81220d51b9a1e8c6bbead0632a0c41ef5d996403b8fe70f18b27d4ce26fcd42e",
    "manual/screenshots/desktop/31_admin_operadores.png": "f1231b42641ede2e072e49b90e6f89c24c953cc80f1c964be224d1f5a2d9edc4",
    "manual/screenshots/desktop/32_admin_catalogo_residuos.png": "a78ff34d284f97020c153cc48b509348a95bfa7722f23e8a6d36cde38fcd46dd",
    "manual/screenshots/desktop/33_admin_tratamientos_grid.png": "d97f44ad2ba43a70c9f9dd08cc6f2061b763725c7f477eeac8573149f2d7948e",
    "manual/screenshots/desktop/34_admin_vehiculos.png": "1299602d4721622e19be14e93c9cb40029a9dfc69cc60012cbe601ce90dc5e57",
    "manual/screenshots/desktop/35_admin_auditoria.png": "7b9b68554440471b497e740421fc488db3cd081ff5703ef4e9c23d7129278ca3",
    "manual/screenshots/desktop/36_carga_masiva.png": "deeadc18a5193fa7b1110ef204f6819fd9b9525357cb74eeb74481f94262ea7c",
    "manual/screenshots/desktop/37_configuracion_general.png": "d07f2fab0ce0b50b971ccc39589ed39a0f1e64a352c9a884d4f38fdbdaf55748",
    "manual/screenshots/desktop/38_configuracion_notificaciones_email.png": "4cf5702d0e26d9dad0f21ad932ae3259ce81bd43bfb1aadb03e6f6a05685f328",
    "manual/screenshots/desktop/39_mi_perfil.png": "6e48f52bbf518ac6ef26d0267438fc3ae2ce7dde4e1527666074f61ce926326a",
    "manual/screenshots/desktop/40_ayuda_workflow_faq.png": "c61654ac7dfa4ca55cb445df3781a0fb776405447f4b0ed83b4285b149e4d0a1",
    "manual/screenshots/desktop/41_dashboard_transportista.png": "f62f4c970ceeca31066f924c9910a62eca9b6a701490f8ad1e6478636320193b",
    "manual/screenshots/desktop/42_transporte_perfil_tab_viaje.png": "41467b4c21631f5f0395999752373230706acd0cbe85ce4f34c8ce3d017b2190",
    "manual/screenshots/desktop/43_transporte_perfil_tab_info.png": "6d5420ae84683e4c3418db9e4e66c5921a131dc4da052947a19d9b9ca08312e8",
    "manual/screenshots/desktop/44_transporte_perfil_historial.png": "3a8c0546be89745ba63c3b983a6b67a15f1b6ff90e203994f4687334669b62e3",
    "manual/screenshots/desktop/45_manifiestos_transportista.png": "8e7cc11ae9732c345fe0d79110d3e0dfc0e3f7e148f561cc87850efdee337dcc",
    "manual/screenshots/desktop/46_escaner_qr_desktop.png": "15bfe525b93ecc56e9d07b03f07dbf53b6e3a8eecfac4a093015e6e781de08b8",
    "manual/screenshots/desktop/47_dashboard_generador.png": "3bd425fabe6b2f719369a84c06a89a6c5ad31f1b3c61f9c5a1ff73d6bb48fad7",
    "manual/screenshots/desktop/48_manifiestos_generador.png": "31dd53b1048a8184d724383e6412e16d52d06f719d86d07356ff9ee90611b8e7",
    "manual/screenshots/desktop/49_nuevo_manifiesto_generador.png": "3b75d4319ffb10cbcc0475ab35daae6a5b1eb866b53444d7386b89124f4b868b",
    "manual/screenshots/desktop/50_dashboard_operador.png": "9af4ad3c81a5e92278f02dbacf9a531af02fd4fa33a2d93297d9ae3a1d3503b5",
    "manual/screenshots/desktop/51_manifiestos_operador.png": "1f8bdffb785798078a5cf2b4b91d94907a62c392f3f286a51f254a331917ac9c",
    "manual/screenshots/desktop/52_reportes_operador.png": "20240df621bb6270d11d822df981b259a9b9dd22486bac77ea270b6079c2de41",
    "manual/screenshots/desktop/53_blockchain_verificado.png": "727574927d87f6ad7a3c88cf27859f647dcb653693dfeccab644177a90aad2f0",
    "manual/screenshots/desktop/53_manifiesto_borrador_detalle.png": "6df28df15c9885ef73cfba5262a3daeffd9917e57d608d8ddf871d8be66d707d",
    "manual/screenshots/desktop/54_blockchain_panel_detalle.png": "94b75235d96edc5da5e724d27c1ffd45fa5872884c201839de76246aa3aac8a7",
    "manual/screenshots/desktop/54_manifiesto_aprobado_detalle.png": "5a36424e835adc14b628518b764495580adb511dc6c9f80ec658dd5823787a62",
    "manual/screenshots/desktop/55_manifiesto_entregado_detalle.png": "48cd091211834c2da797f6554a50d8ea80daa66d22f8a0c0bc940417660e4347",
    "manual/screenshots/desktop/56_manifiesto_recibido_detalle.png": "4d1a84a663d8ab6d991f3809ec2a095dcebeaa303ae601319435f4ebf65b5166",
    "manual/screenshots/desktop/57_manifiesto_tratado_detalle.png": "df88b3e44abc70cd9442e9217f28d1171f6d4562ce90f4ba3043b293ef2da7bc",
    "manual/screenshots/desktop/58_manifiesto_timeline.png": "df88b3e44abc70cd9442e9217f28d1171f6d4562ce90f4ba3043b293ef2da7bc",
    "manual/screenshots/desktop/59_reportes_exportar.png": "387ab35a21f5f6ed2c3af17435b59c78589eab2b3782767ca79416b086f3cc6e",
    "manual/screenshots/desktop/60_alertas_reglas.png": "a914e03b31f841b828ba72892ded595febe3396f659f523e48816c133809bebd",
    "manual/screenshots/desktop/61_centro_control_viajes.png": "9202bba3cab1b3b6686d2cfdba1d4b5352853fe6fc5400abe14863fc3027c9d7",
    "manual/screenshots/desktop/62_manifiesto_nuevo_paso3_residuos.png": "f778ca7f0089981e1b22764c534e362a0e5a72568d7d86c76684d09e38dd7506",
    "manual/screenshots/desktop/63_transportista_detalle_flota.png": "1a85cd4be0054e989b21fc8601acd3a828b5faf322c3c56707329af9f09c6274",
    "manual/screenshots/desktop/64_generador_detalle.png": "1f4c39a3625741defcea90f8d804df1bd4f4daf8c7379ba0f6ca382ba8ac5d45",
    "manual/screenshots/desktop/65_operador_detalle.png": "ae1dacf201bdc1b676cec608e9fb6883c74a844620431b57f5c21dbe7764b6da",
    "manual/screenshots/desktop/66_verificar_manifiesto_detalle.png": "8e09e737b340ad4f3db9a096006eb7ec2a42073ce6f3d2a278a91df6e0a6e02e",
    "manual/screenshots/desktop/67_centro_control_kpis.png": "a31cde41709e6652d48c5ec167ef2b284e7b291f034198cdb97b971e3fb864fa",
    "manual/screenshots/desktop/68_blockchain_panel_genesis.png": "9ce8a52ec3767d10fde98cc682ee92910b909f1d72e6d6419df77b1008cb9986",
    "manual/screenshots/desktop/69_blockchain_admin_registro.png": "9f9a1b747ab1afa5c21211c06cf43c8758597a1c7b57f0da84ebc398b3b7030a",
    "manual/screenshots/desktop/70_inscripcion_generador_paso1.png": "25f0d51428d837fe3de12265c54a5179d2c9aaabbc4e38869b33d090afec7c69",
    "manual/screenshots/desktop/71_inscripcion_generador_tef.png": "13c80ca08d80593e0b5edb5416e3b0dd261a1258061462f63bc1c93b5fb77c60",
    "manual/screenshots/desktop/72_inscripcion_operador_paso1.png": "62ac331232c3df8f6dcfb96b81f9dd0897109dbf604f0dbe26220bc9f75f0c5c",
    "manual/screenshots/desktop/73_inscripcion_operador_representantes.png": "8342c7a7bbaba4944c485e738f561f39def0b369bbe9c092b38005bd5d6dde7c",
    "manual/screenshots/desktop/74_inscripcion_transportista_paso1.png": "95e29c6db3dab8bcc62cec822b312f402306da3eb8665c5ffc18f396c796ba74",
    "manual/screenshots/desktop/75_inscripcion_transportista_vehiculos.png": "8e4751ef923532e48a1d0a232a6b69df8388f9d44fb781b77a5a4c08bbaf8174",
    "manual/screenshots/desktop/76_admin_solicitudes_lista.png": "1acd3afaffe99a8651c0a411c25207af8fa7c8cb2829f6abd885628d39e88665",
    "manual/screenshots/desktop/77_admin_solicitud_detalle.png": "72b7fc472b24adf3294a3bd96fecfa809f8e23368b787c33fd7db204da05e736",
    "manual/screenshots/desktop/78_nuevo_transportista_wizard.png": "b7ed39a10ccb41f1decbdd70e6960d6ad9718445a17a9134fb36155e488c21c7",
    "manual/screenshots/desktop/79_nuevo_transportista_vehiculos.png": "b3d26869f103db0b1817116993dbdd8f51d68900e6c604762d1cb1162bd0c2e7",
    "manual/screenshots/desktop/80_nuevo_transportista_choferes.png": "d4bf89a5b635e908f68a57a1bc6673204f45dac07c54685f9fa689a8f8c64988",
    "manual/screenshots/desktop/81_badge_blockchain_pill.png": "f2c38aed497c60a1ae8eeaeaf248e319104097d901dca03f390855e1feb50931",
    "manual/screenshots/desktop/82_sorting_estado.png": "392cc60015f68ff12beea7d5f602a23599fd8f426d43a4e36be6c4b544100369",
    "manual/screenshots/desktop/83_operador_representantes.png": "58b56b40f535f2fea01a99066322395f8977c71e9d13327cc312389155c5a124",
    "manual/screenshots/desktop/84_generador_actividad_rubro.png": "c611ec86f3ea05e527b60e0e6484b46c4ffbd47eff5f4144bf75aef7cbb527b9",
    "manual/screenshots/desktop/W01_pub_gen_fase1.png": "25f0d51428d837fe3de12265c54a5179d2c9aaabbc4e38869b33d090afec7c69",
    "manual/screenshots/desktop/W02_pub_gen_paso1.png": "2cff427db40d3cc6b7cd6995df9691b91add2eb261f0b92c5f72d5fcdbbd91b0",
    "manual/screenshots/desktop/W03_pub_gen_paso2.png": "6e34539f6138af85893f000b260fa7da4a015383110417050ab1a7ed9f51c78d",
    "manual/screenshots/desktop/W04_pub_gen_paso3.png": "cf2d03cae30345850e0108450871545f2ab99e7f4215c2c61aba2600cb981ff1",
    "manual/screenshots/desktop/W05_pub_gen_paso5.png": "5e539aa3cdd966e8b2b856287e12087a141b11ae840b7fe686a5411f6d78c93a",
    "manual/screenshots/desktop/W06_pub_gen_paso6.png": "1092f871d4afc777e1d7d8503bb5bf223950907ae6cdee97c2b07c0c1e73285c",
    "manual/screenshots/desktop/W07_pub_gen_paso7.png": "cf38e7ac0a748ad193ee0b62dcd1789ad7e2623ee71ddb494292a527cef59c83",
    "manual/screenshots/desktop/W08_pub_oper_paso1.png": "78a1c91fcfc00e8cdd379858c130f6cee72fabd4f9b574a547af508d4b328f5d",
    "manual/screenshots/desktop/W09_pub_oper_paso4.png": "dab21262843780a2cca08ce26d881e4dd38722b39855af53737d3c0ff75fa154",
    "manual/screenshots/desktop/W10_pub_oper_paso5.png": "dab21262843780a2cca08ce26d881e4dd38722b39855af53737d3c0ff75fa154",
    "manual/screenshots/desktop/W11_pub_oper_paso6.png": "dab21262843780a2cca08ce26d881e4dd38722b39855af53737d3c0ff75fa154",
    "manual/screenshots/desktop/W12_pub_oper_paso8.png": "73b977319db7a0a2787ba19a6d9d534ef0d66ab1adc70043fea8b89467bd77bb",
    "manual/screenshots/desktop/W13_pub_trans_paso1.png": "2f0f3338dc4ea0ce461a7113a8d79c3b9c915a6b59eba8d8d30037eb5fab6845",
    "manual/screenshots/desktop/W14_pub_trans_paso2.png": "be1670e235142ff1f2332e5675ce36849e35183828292320abdf4a17d9d277ed",
    "manual/screenshots/desktop/W15_pub_trans_paso3.png": "be1670e235142ff1f2332e5675ce36849e35183828292320abdf4a17d9d277ed",
    "manual/screenshots/desktop/W16_pub_trans_paso5.png": "9ee475c863a085922984db53311bf7f1a4334c76ab60a189efbc32f4ab010da1",
    "manual/screenshots/desktop/W17_adm_gen_paso1.png": "9902bcf1cdc8e0f211b57c2f4d9b8494d29ee2bcf64aec0eb5989370a3d92b5b",
    "manual/screenshots/desktop/W18_adm_gen_paso2.png": "9b3c5b0f4fd98ba5d164cb6ff41f98455677821f01958b4b175ddf5192186bdc",
    "manual/screenshots/desktop/W19_adm_gen_paso3.png": "1904bd5bcc66e3f31ba9a73e716de38dd8ee03cf98798cc21820957cd407aac0",
    "manual/screenshots/desktop/W20_adm_gen_paso4_tef.png": "be7814b905e088ffa574e792461f0a6f489d252fea1693bf9766829fc8c51b5e",
    "manual/screenshots/desktop/W21_adm_gen_paso4_tef_a.png": "be7814b905e088ffa574e792461f0a6f489d252fea1693bf9766829fc8c51b5e",
    "manual/screenshots/desktop/W22_adm_gen_paso5.png": "6f96ca6f71ae70851ab18c054af4786f25b388c6a77a677da8bd7f3a7b5cca12",
    "manual/screenshots/desktop/W23_adm_gen_paso6.png": "d08eff8c7e0fef70cadf2aedfe65c165078d20307eba0ff4a13f5a2accf37a11",
    "manual/screenshots/desktop/W24_adm_oper_paso1.png": "bf6ead31628154af3273e541bbecdde0dfd8e00bdb8b66890f7eee481f008aa0",
    "manual/screenshots/desktop/W25_adm_oper_paso2.png": "16872b629a078819c2d119c8bd0ae1ebe7c69989b0870aea130e036dd999ae34",
    "manual/screenshots/desktop/W26_adm_oper_paso3.png": "d108dea815224fabdb4de802b1ea209123235e3e99d7461f9b607eecbf1cd1a5",
    "manual/screenshots/desktop/W27_adm_oper_paso4.png": "b95fff5c0621c131182cb327bbb006b0c04e15167a8c5366a797c2fefdc9caea",
    "manual/screenshots/desktop/W28_adm_oper_paso5_tef.png": "49c2a2b735dbe06a2dc4ef0e4228a3d313b6594561e14441b7b10b38efbf2880",
    "manual/screenshots/desktop/W29_adm_oper_paso6.png": "e0ab9222735af61934bdb1d1be977b20cea20c167e1fe0b4c4caea358aff8835",
    "manual/screenshots/desktop/W30_adm_oper_paso7.png": "f3be6912d18a8ab91a8ed8bb632dcade56350813e043d0a027ba9f0f5629e29c",
    "manual/screenshots/desktop/W31_adm_trans_paso1.png": "7086f9e7916182edb34c4a3510a7aa60cdb7ae3b80b4ea4c8e08fa782cf39b24",
    "manual/screenshots/desktop/W32_adm_trans_paso2.png": "3188fe4ddfa936b43b6d138c167951e2e206ec4fe3aad7ba6a36a0a3d70d7b38",
    "manual/screenshots/desktop/W33_adm_trans_paso3.png": "e188f8f397698b3cd6f7b02608692db013e78af129d8018ea7b5368811e54a81",
    "manual/screenshots/desktop/W34_adm_trans_paso4.png": "c9dca58d09af0633ad4b3486d46e51e41f23d0e4615d588b45b85ae67103a908",
    "manual/screenshots/desktop/W35_adm_trans_paso5.png": "28af43c7b1ecdba9b775c1c54e73e02918e2103a3e098fd6e460381416444232",
    "manual/screenshots/desktop/W36_tef_resultado.png": "75c6ace3f9456ea021b88cc273e5106578be41fc68b9c20206c524052ccd6b67",
    "manual/screenshots/desktop/W38_tef_magnitud_d.png": "e825e2f890a98615e790164cc81305b046893ef387f387c165287e0393341203",
    "manual/screenshots/desktop/W39_tef_coef_a.png": "0a57ea9163d7b1475a6a21a0a855096050e7d71b5d62144d15ffb4b0a193b855",
    "manual/screenshots/desktop/W40_tef_coef_c.png": "0a57ea9163d7b1475a6a21a0a855096050e7d71b5d62144d15ffb4b0a193b855",
    "manual/screenshots/desktop/W41_tef_desglose.png": "0a57ea9163d7b1475a6a21a0a855096050e7d71b5d62144d15ffb4b0a193b855",
    "manual/screenshots/desktop/actor-inspection-closed-20261012.png": "10620d950e3449ef34bc50aad3291cdeb2af33e4ad1e117754643dd0ec5acb52",
    "manual/screenshots/desktop/actor-overview-20261031.png": "9033bf13c47d2537895f58586be15877afe6387e6ee7b587e91988421b290b23",
    "manual/screenshots/desktop/admin_actores.png": "0ae1574793362297ac86dd74b3f11762b920fe3d6e3537477d737b2ea59d8b78",
    "manual/screenshots/desktop/admin_dashboard.png": "e446de879798e76d5547c5d46448861f50c9ac6b422ef8903f1fbb33687ca46b",
    "manual/screenshots/desktop/admin_manifiestos.png": "3bfa638a364e119354cc80577e930812f6440b36f128752c28fc455b48446c72",
    "manual/screenshots/desktop/admin_reportes.png": "03f7e94c6199e6059aab56052268533314a1f8d753631a34c03a753bfebb72c4",
    "manual/screenshots/desktop/admin_tracking.png": "50fa267bb31e56b11185b1e47b8de730afa00b1cb1caf4833d35c7cd14248a6b",
    "manual/screenshots/desktop/alerts_expiry_qa.png": "24c41ef0f846cbad03d1164c381fcb0e5ff07a0d0d535dc77f6cc2e69ada7897",
    "manual/screenshots/desktop/alerts_requirement_qa.png": "73ed440f74248c17e67f4b2e7ad1d050829ad5fd28a4380e3cd4f7c2464c141c",
    "manual/screenshots/desktop/alerts_simulation_qa.png": "8db1550dd7edb6c3573e699647532a6f81f2dbb63b389c455a28db8a72228c41",
    "manual/screenshots/desktop/certificados-aviso-20261021.png": "2bb89fbf3c9f9a76121f1a235808d04d988948375d4b80149d2ed95e3f7a6c25",
    "manual/screenshots/desktop/desktop_actores_gestion.png": "5d64723c6f145b42820d5a41e1a8898dd99958cc3b48ef93c7938ce353f2aef2",
    "manual/screenshots/desktop/desktop_admin_actores.png": "e2bc6a5baf33da19f8017d5922df4fbd145a21546b1e4819e0c07c4c2c767023",
    "manual/screenshots/desktop/desktop_admin_alertas.png": "dc278a68028f7de01fd2b6b5e01d46d838f6b8a2f0aba9698ad84efe4a783191",
    "manual/screenshots/desktop/desktop_admin_reportes_full.png": "7b64b06f4c84a576aba320204e249013f3bcfa453739b7776e7c92bed9924648",
    "manual/screenshots/desktop/desktop_admin_reportes_mobile.png": "49e94b4af6a8fdca5f7cb498c5981e02f6f1defd4b0ffadfab13d84a4bf1d059",
    "manual/screenshots/desktop/desktop_dashboard_admin.png": "2cce4f23b4b4352e6d754b106e597eb6bfdfb86c804bd05ec4babfbe313b7f10",
    "manual/screenshots/desktop/desktop_manifiestos_lista.png": "578b3046bc434dc187a57cfb89778ad1fe5fd3c623982943382f579c9588029b",
    "manual/screenshots/desktop/desktop_manifiestos_lista_full.png": "0feccfc3a88b860b35c1139f4d0492f595f2dc9f88795354717ade15f3e30afc",
    "manual/screenshots/desktop/desktop_reportes_admin.png": "fe87ee3030f2fafc4643c3c89e843b8abf805434c424cf14f8e17b9f0f1ade29",
    "manual/screenshots/desktop/desktop_tracking_gps.png": "3fb4a7e4f4301d5a4d64cf873787847bf056dc645e62e57e7db8f7b619e3efc4",
    "manual/screenshots/desktop/entidad-conciliar-cambios-20261022.png": "aedbc0d05a7cefd63a8e86bc2ad584f425cf282c88d507f7de0f33b1f7ef6150",
    "manual/screenshots/desktop/entidad-representantes-20261022.png": "0b3211bb5dded7110fc3959844df8a1d29f5d0dff5796f6cb2743f5375e37d94",
    "manual/screenshots/desktop/fleet-gps-20261019.png": "16d0440e3cd80b22baa7ee16db0eb3a4e1c4358c6570ca6dae1ec7577a4f4f28",
    "manual/screenshots/desktop/inspection_checklist_qa.png": "7718eda7b735e4f715d2dcd0c092f2e92cc54e5cbc7a3f2a2d42d342ed799833",
    "manual/screenshots/desktop/inspection_comparison_qa.png": "907ad26dd80b30245904e5a97bda43daa4ccde71110fbde7c1d36f4dedd40e9c",
    "manual/screenshots/desktop/inspection_report_qa.png": "86f0fc17c50a679c07e531faf8b333dfe595b1ed124865ff669032eb14d71332",
    "manual/screenshots/desktop/psip-cierre-20261020.png": "991d2d4b56bc57a51b49427fad7731ef6765669b3d1beafda2718e34ba735905",
    "manual/screenshots/desktop/psip-etapas-20261020.png": "b223c3c8087cd5fb5102fa48f5ed616080b76c3f95e2ae64bf6b7e32f2ea1ea9",
    "manual/screenshots/desktop/psip-hallazgo-cola-20261020.png": "4dd1771f2900f5067329a8cdfaddb97dbe535093e715aa57088ad1e3f7b2a632",
    "manual/screenshots/desktop/registration-draft-20261012.png": "bbaf30f78fbff71322c2ce5d793541a1ad7715c64f42a249dabfb62b7dc68334",
    "manual/screenshots/desktop/support-actions-20261012.png": "1a17680adf1bde8478360e1a573c32da560f3fd22418be50af9a689d2284b963",
    "manual/screenshots/desktop/support-answer-20261012.png": "d680f8829b1b039b48a049978c8c5e981fafe0b20801d87cdcb6909491085702",
    "manual/screenshots/desktop/support-assigned-20261012.png": "8c4a97a9848371d8e4a55cb65a1f4a195c3ec02a08e05501d64575ffc799951b",
    "manual/screenshots/desktop/support-triage-20261012.png": "42aaee198b3518da0de3b0388b6580bd2c68e57d7a630e53b2a3e1580c58952b",
    "manual/screenshots/desktop/support-unsent-recovered-20261026.jpg": "134302c04bf380a7ed1f2624478a09e46d324ec9fed750fc1524ca0d4b638806",
    "manual/screenshots/desktop/training-addendum-20261018.png": "7be0ab2faa662a896f0ccac36794ad918abc0a03a59ae87633c3d8adfd76ed03",
    "manual/screenshots/desktop/training-eventual-20261018.png": "d7c22c2f4e707a480cba733d86ed065d235d3eda53517f9cadae7e94d36abe3d",
    "manual/screenshots/desktop/training-fleet-20261018.png": "f8915bc6c25ca492bc012484dd564d840eab6d9ccf6cd36c076f5bdfb2c872ff",
    "manual/screenshots/desktop/training-manifest-20261012.png": "368f0a5d1619b4b4aa34f100e0a6c9cdc18557feb52e14682e410241d763c485",
    "manual/screenshots/desktop/training-selector-20261012.png": "5adeb9d1bdd96de56ea3e5a9091ef54fd84787cf97d081aad71b654f02a65cdf",
    "manual/screenshots/desktop/transport-handoff-20261019.png": "55f94ad5ccd5d3e0ae6418884ae67c82032e51aec9a77f5db430ab80850f2845",
    "manual/screenshots/escudo-mendoza-blanco.webp": "f39b5f4fc002cace884b751511506eb425310045d4be1c25ea0e886508ff0fab",
    "manual/screenshots/escudo-mendoza-color.webp": "4cde9ad98a3b2b5a85e9d73714af105fa92b5c157c983d4f840efad3b77df682",
    "manual/screenshots/logo-mendoza.webp": "ad6dc4eb052201b33ee7909685e9bbbddf1786185787a3adb75d00d38d474bbe",
    "manual/screenshots/mobile/M01_login_mobile.png": "77c7c3e3c1793ad689bb4cda5143fa726955abd2de63e5119725e75a96bceea7",
    "manual/screenshots/mobile/M02_dashboard_admin_mobile.png": "7c90f3a050fd1dc8368835ddb3cc39987b7d1e555c54e84963c54ed64aab9769",
    "manual/screenshots/mobile/M03_alertas_mobile.png": "575b73f0dbe32608eb957b24324d0fadbd2836b76926b0f8f1fe8d812ae37b04",
    "manual/screenshots/mobile/M04_reportes_mobile.png": "6ab5a60b18874c9b0d57121d1a23d0c7058d9e1745bb2ed4e854ee6c4f012847",
    "manual/screenshots/mobile/M05_usuarios_mobile.png": "859494eceb541b9e53812a06cae4769351e4430fec97f93675305d47b448ada3",
    "manual/screenshots/mobile/M06_dashboard_generador_mobile.png": "627bfb54cca1b9b90769e803cbd6b28ad914f77d84554c031099e1cf1911c93a",
    "manual/screenshots/mobile/M07_manifiestos_generador_mobile.png": "152651eab70b7647b9ded772c9905c6120a555b5354b30e8855fc60cf20260f8",
    "manual/screenshots/mobile/M09_nuevo_manifiesto_paso1_mobile.png": "8d553db580ff039f21473f05af3656da368fad49bb0fb2955b30cda590e95190",
    "manual/screenshots/mobile/M10_dashboard_transportista_mobile.png": "57c349bb22c885b4fc19f3ca72dfe992d5113a0fbb729e4d3162a122102dd93a",
    "manual/screenshots/mobile/M11_transporte_perfil_viaje_mobile.png": "55d18497bc19f50f059af5241f8d636b62fda0f3099bac77ffc4122262b7eea6",
    "manual/screenshots/mobile/M12_transporte_perfil_info_mobile.png": "6a34ffd189333158d27d23e9e636ab32b47443edfd57bb948323ed74cfca8634",
    "manual/screenshots/mobile/M13_manifiestos_transportista_mobile.png": "fd250f038396f13f5ef701ce7aadc5b7c37f53d8688444d99d4e6fcf4599cb2e",
    "manual/screenshots/mobile/M15_escaner_qr_mobile.png": "3b8a9a7ca7093d0c1ecd2117ac4f63635eb17c3e4f68cc6f6d5f7a00674acbdb",
    "manual/screenshots/mobile/M16_configuracion_mobile.png": "db461faaff48dba78124a1994214b8738a898f2367923d95958398ecf7705711",
    "manual/screenshots/mobile/M17_dashboard_operador_mobile.png": "52795c8b6aebc372b12326b847805929c4f2ae488c3fa904910ea541b51c3716",
    "manual/screenshots/mobile/M18_manifiestos_operador_mobile.png": "7b70b7d84851a3eaec197fb186ea869295746ad322729884b372acd2e50c1d46",
    "manual/screenshots/mobile/M20_reportes_operador_mobile.png": "67d4adfc53284668963789db289465ba9b255f22694d5c5959df630e4b906cf2",
    "manual/screenshots/mobile/M21_tomar_viaje_mobile.png": "def056f259ca3e712aa852a44791c872639c0e6f4f846602d71ead1aef341edd",
    "manual/screenshots/mobile/M22_viaje_gps_activo_mobile.png": "c7faa6bd7f0eb4cb43f305d08d8cedb2ff6495a4c8aa313317582bde32fdd408",
    "manual/screenshots/mobile/M23_manifiesto_entregado_operador_mobile.png": "ba20ebb78278847f50de9c7758db32cb16179c31321a9008747ffa5044643b22",
    "manual/screenshots/mobile/M24_pesaje_modal_mobile.png": "ba20ebb78278847f50de9c7758db32cb16179c31321a9008747ffa5044643b22",
    "manual/screenshots/mobile/M25_manifiesto_detalle_generador_mobile.png": "8ee95a8294e3b81bdfa576734bb30e8e4d95b3e2b1aa565d5a4d8b50e7d3f2d1",
    "manual/screenshots/mobile/M26_blockchain_panel_genesis_mobile.png": "af5d9f5263e41c89f73aa721438c9d22e159db522f1025b799555042bf7ab4d6",
    "manual/screenshots/mobile/M27_blockchain_admin_registro_mobile.png": "7f80e864e37cc803c9d933db223ba503498c5a989ef9ab98a5c45012bd5a9dfb",
    "manual/screenshots/mobile/W42_mob_gen_paso1.png": "12e794af37388a524f0a555c75ec514e768d20a53ecb0e240b2b9de82ab512be",
    "manual/screenshots/mobile/W43_mob_gen_tef.png": "7c96e594b669b61e00e53b14e3693fb1fe4378ed196b073dbc37ecb04889ee00",
    "manual/screenshots/mobile/W44_mob_oper_representantes.png": "6bf66af30e5ca38679a79d4ebd1a2da9d51a36b9715934d8809bc4fc75d7df0c",
    "manual/screenshots/mobile/W45_mob_trans_vehiculos.png": "53663065b26e36edadfc2e67c3d3eccf6f81b1b2ca8a15fa3725e3cff1aedcc4",
    "manual/screenshots/mobile/W46_mob_inscripcion_fase1.png": "4ececa7872538044836dbf114afc7fde909bc7856f605c5eae5b89e8c4952ea2",
    "manual/screenshots/mobile/actor-documents-synchronized-20261025.jpg": "c1a6852cc862c09951731fa14d9a0311b6b85f8336753031637ab70005732bf7",
    "manual/screenshots/mobile/actor-documents-synchronized-20261025.png": "c1a6852cc862c09951731fa14d9a0311b6b85f8336753031637ab70005732bf7",
    "manual/screenshots/mobile/actor-fiscal-summary-20261025.jpg": "9f268921d68e0d2d12ede84c8719445c2b2331e1c86efc5fbaba9b38d29b6808",
    "manual/screenshots/mobile/actor-fiscal-summary-20261025.png": "9f268921d68e0d2d12ede84c8719445c2b2331e1c86efc5fbaba9b38d29b6808",
    "manual/screenshots/mobile/actor-inspection-20261012.png": "5baac2854068faf7e84bba7dcae9d2e12a09bad96582a2550861792b30cf094f",
    "manual/screenshots/mobile/actor-own-help-20261025.jpg": "8b549bc16de9bbac4eecf1913674c5426b533273820c6b1107d77bc263066abf",
    "manual/screenshots/mobile/actor-own-help-20261025.png": "8b549bc16de9bbac4eecf1913674c5426b533273820c6b1107d77bc263066abf",
    "manual/screenshots/mobile/adenda-informe-hallazgo-20261020.png": "3f4c50c0e69e83b70c718bd861d679adf4dd213381cf7d77a8c95578f3643e9d",
    "manual/screenshots/mobile/admission-electricity-20261025.jpg": "82d550036b7fbd0396bb44b5aea0e17ad051d8d7d2e9753b5fe1a866b9206c1d",
    "manual/screenshots/mobile/admission-electricity-20261025.png": "82d550036b7fbd0396bb44b5aea0e17ad051d8d7d2e9753b5fe1a866b9206c1d",
    "manual/screenshots/mobile/admission-list-20261025.jpg": "45d75064f291ef40dff2e374b13fdc11c23b22560b41bfe52ac400f237f400a7",
    "manual/screenshots/mobile/admission-list-20261025.png": "45d75064f291ef40dff2e374b13fdc11c23b22560b41bfe52ac400f237f400a7",
    "manual/screenshots/mobile/alerts_inspector_origin_qa.png": "9904cbc3d01bb9f84b241dc331648912fa4e9f6bdd7108a5f45b53f4b8609534",
    "manual/screenshots/mobile/alerts_owner_calendar_qa.png": "0da7429f01288690d940c406586b13df81ef018cf94fd71dac10b395f301b39b",
    "manual/screenshots/mobile/alerts_owner_notice_qa.png": "55da837d62184ae073bfe73dd5fd4bea27ce6d6692faa907312a2945a47a9dd4",
    "manual/screenshots/mobile/alerts_resolved_case_qa.png": "05d3b7d427f854ffff075f62643eaa7aec0a9b668d84ec5dc5989914ea1ec077",
    "manual/screenshots/mobile/application-decision-draft-20261025.jpg": "d706f9c2222da2ca479d11105eca838b1997a2ec6b2abe989d467e9e68a2849a",
    "manual/screenshots/mobile/application-decision-draft-20261025.png": "d706f9c2222da2ca479d11105eca838b1997a2ec6b2abe989d467e9e68a2849a",
    "manual/screenshots/mobile/application-observed-20261025.jpg": "150d7c5194d1907d999744a375311fc5f660171fc3d6750331d805161f7835c5",
    "manual/screenshots/mobile/application-observed-20261025.png": "150d7c5194d1907d999744a375311fc5f660171fc3d6750331d805161f7835c5",
    "manual/screenshots/mobile/certificados-recibidos-20261021.png": "0e8a71fc2a8049a0e5ae9b185006963404a71b18678ca8edf639333de0526e9b",
    "manual/screenshots/mobile/certificate-draft-20261026.jpg": "4ae22853c13dd7065123158ead2e52ac1b94b3c82a294b63b201b2fd415177c3",
    "manual/screenshots/mobile/certificate-draft-20261026.png": "4ae22853c13dd7065123158ead2e52ac1b94b3c82a294b63b201b2fd415177c3",
    "manual/screenshots/mobile/certificate-list-20261030.png": "45e77bc641c707b7ff418d8ed79e068e9ecdadc6c6bfbfad99cfba65ebe2f8d7",
    "manual/screenshots/mobile/certificate-recovery-20261026.jpg": "b129d53171b51e1a6a684fed5ec78202e24716a3077927bb8979468e22ade92e",
    "manual/screenshots/mobile/certificate-recovery-20261026.png": "b129d53171b51e1a6a684fed5ec78202e24716a3077927bb8979468e22ade92e",
    "manual/screenshots/mobile/certificate-recovery-compact-20261030.png": "4453d512f66ef1712962146d2fd9444d7b3ec92eecbb352e4e12687a82cf8db5",
    "manual/screenshots/mobile/certificate-recovery-list-20261030.png": "f8d97b33d8bef1aa799ec9093415c6ace67114fb1f874fe8cc58111e48e8878a",
    "manual/screenshots/mobile/circuit-eventual-approvals-20261020.png": "9985746dd0880fa2bd95f1219d74e1f6fb88350e15fc1c020447366b884e02c6",
    "manual/screenshots/mobile/circuit-eventual-review-20261020.png": "854dacc06d143c0d44e9c9a4002ad022f03c2b97d555d781281fb235871f80f2",
    "manual/screenshots/mobile/circuit-user-edit-20261020.png": "ddf1c806f0ac8bcd205dc70693ed0ad0ca1112291eff079b6a910ce0208e2bd8",
    "manual/screenshots/mobile/circuit-user-inactive-20261020.png": "8cfc7e7153d8997321b921bf1ff31d310b287e4cddc478bffd8cdcc7bd9c5e0f",
    "manual/screenshots/mobile/company-certificate-context-20261026.jpg": "1a561840f0726a39e50f94b944b3ccbbd63261453cd10d1a672dd32971acf9e4",
    "manual/screenshots/mobile/company-context-compact-20261025.jpg": "21f36e31de0cfea5e651a9b38a47bac2dbc7612b2d9a6c8d1375713b829cb64f",
    "manual/screenshots/mobile/company-context-compact-20261025.png": "21f36e31de0cfea5e651a9b38a47bac2dbc7612b2d9a6c8d1375713b829cb64f",
    "manual/screenshots/mobile/company-draft-recovered-20261025.png": "0ac9dfbcb837aad27d0e95d878babd71ec40497c9f6a1a216d1b3dddf72b4b16",
    "manual/screenshots/mobile/company-notice-context-20261025.jpg": "3c2eef15d7e3a8855b861d1590ce6faa6048e7d79293e3beba45ad56891501de",
    "manual/screenshots/mobile/company-notice-context-20261025.png": "3c2eef15d7e3a8855b861d1590ce6faa6048e7d79293e3beba45ad56891501de",
    "manual/screenshots/mobile/company-workflow-context-20261026.jpg": "d0c39518bf06378511a5a59af4e52f2da3ff501791cd35921a3f6441a06cf22c",
    "manual/screenshots/mobile/company-workflow-context-20261026.png": "d0c39518bf06378511a5a59af4e52f2da3ff501791cd35921a3f6441a06cf22c",
    "manual/screenshots/mobile/context-search-20261026.jpg": "937468f0e7bc9dfa94da40cae22d377d39e677b7aaa4fa6fc1d6f7057823e21d",
    "manual/screenshots/mobile/context-search-20261026.png": "937468f0e7bc9dfa94da40cae22d377d39e677b7aaa4fa6fc1d6f7057823e21d",
    "manual/screenshots/mobile/device-notifications-20261019.png": "52e41c8f0584c332256c80e70345de5e5299e37c8673d20e685e60b5787f7e3a",
    "manual/screenshots/mobile/fleet-gps-20261019.png": "1993aa34b44e614a706928141ab79d099f971d7f047fdbba22988e1fad3a6c0e",
    "manual/screenshots/mobile/form-conflict-20261025.jpg": "83bf141bf4a7116922afa5fcac1cf943ff10168abec90f9e05abac191f8ae7a3",
    "manual/screenshots/mobile/form-conflict-20261025.png": "83bf141bf4a7116922afa5fcac1cf943ff10168abec90f9e05abac191f8ae7a3",
    "manual/screenshots/mobile/form-residuos-20261025.jpg": "10ec82508dde10dd17cdddc48a411f4834cefc58b369cc3325926105efb20c85",
    "manual/screenshots/mobile/form-residuos-20261025.png": "10ec82508dde10dd17cdddc48a411f4834cefc58b369cc3325926105efb20c85",
    "manual/screenshots/mobile/form-retry-20261025.jpg": "00174f6df7ee54ab131f0173c5ad8e8e6f82a593ed5fce57589f62988205ee0b",
    "manual/screenshots/mobile/form-retry-20261025.png": "00174f6df7ee54ab131f0173c5ad8e8e6f82a593ed5fce57589f62988205ee0b",
    "manual/screenshots/mobile/generator-rejected-history-20261027.jpg": "7b1259e52607f1c836958ef078e378047d577faeebb363243348bb08eac7cfb9",
    "manual/screenshots/mobile/generator-rejected-history-20261027.png": "7b1259e52607f1c836958ef078e378047d577faeebb363243348bb08eac7cfb9",
    "manual/screenshots/mobile/inspection-agenda-20261025.jpg": "549bfe2515c4a61dc001f26f0c7efa9a9d6058e89a500273a43fcb369f1df39a",
    "manual/screenshots/mobile/inspection-agenda-20261025.png": "549bfe2515c4a61dc001f26f0c7efa9a9d6058e89a500273a43fcb369f1df39a",
    "manual/screenshots/mobile/inspection-field-context-20261025.jpg": "86f28579b2c7df1265dd42fea60a0999554a71a7c450cbfc806da5b224f26455",
    "manual/screenshots/mobile/inspection-field-context-20261025.png": "86f28579b2c7df1265dd42fea60a0999554a71a7c450cbfc806da5b224f26455",
    "manual/screenshots/mobile/inspection_evidence_qa.png": "fa54e68249822081b63556f89e9000924c54cd04000a52b993ffc90ab871bdbb",
    "manual/screenshots/mobile/inspection_wizard_qa.png": "52de0c702641650be16d8f58269dac6144010fd12dccf92e87cc6f62fffbea42",
    "manual/screenshots/mobile/invitation-acceptance-recovery-20261026.jpg": "321a0e0ec4132a26ad18fa7c8237a72ecd30653bc10f53b3eb32ec9f074c6af4",
    "manual/screenshots/mobile/invitation-acceptance-recovery-20261026.png": "321a0e0ec4132a26ad18fa7c8237a72ecd30653bc10f53b3eb32ec9f074c6af4",
    "manual/screenshots/mobile/mobile_demoapp_selector.png": "067f92220cc8b718791a8f414fc01f8dd7dda820d2f12620d814fc441e203be6",
    "manual/screenshots/mobile/mobile_generador.png": "a8dc0e67ec0fdd66b28f7c96691bdab4cb59f6b4041824f721eca8c76e5d738e",
    "manual/screenshots/mobile/mobile_generador_crear_manifiesto.png": "86c7efba907f1c76bd288a8a7b6ab997b2f7dc2b97ba04a00a98383f5bf2e271",
    "manual/screenshots/mobile/mobile_generador_dashboard.png": "3001e200ad2cdce6762ecfae9b0cdc9e9c96a1499f2d82f14b64409df54f52c1",
    "manual/screenshots/mobile/mobile_generador_historial.png": "d444a4b2f55e7f447c71262d5dfccd72f98fbdc87c23f5443518fcc6253eae98",
    "manual/screenshots/mobile/mobile_generador_nuevo_manifiesto.png": "6f2391bf562ac4941be76470ec58192a23f7a4a6349f68c3ddcc7fc5cd9c25f0",
    "manual/screenshots/mobile/mobile_operador.png": "fa6631ecd0d5ce8bb97549074e41740ddc5f3d051142ec49c507c95afa4300e9",
    "manual/screenshots/mobile/mobile_operador_entrantes.png": "47ea6e2504e2b68448d0d9b8b026a9896c1fe5b91d854d5d58b44d2903a6979d",
    "manual/screenshots/mobile/mobile_operador_escaneo_qr.png": "625b8529fd7d528217089ad9fd0d73ef3e34593c976b4a0ff972459aab2b1d97",
    "manual/screenshots/mobile/mobile_operador_home.png": "8a6fc321b3f1ff197ee6231d6ae760c6bf80c9a2eac50533e0f3434f10b2ab96",
    "manual/screenshots/mobile/mobile_operador_pesaje.png": "e63e5cddea54d9a105f3f18b9812676bcb6711ee79745f9517d35566ae39ddfd",
    "manual/screenshots/mobile/mobile_operador_recepcion.png": "703bd2f91582d1e7046f332b113b5fe4f528111af2fee949a5fdc35a6bf89ea0",
    "manual/screenshots/mobile/mobile_transportista_dashboard.png": "a0a67e1fc1b74f6029681f9047c93c570fe7dce14dce1528d2ced067dada44f3",
    "manual/screenshots/mobile/mobile_transportista_home.png": "f1f86875dd0d9c3b756625fe0674a61b2310a13043cdfe45d76c2b5ddae8abb1",
    "manual/screenshots/mobile/mobile_transportista_manifiesto_detalle.png": "955074406cac93d56771df0df7dde85de7e00fe0378ff824eb5d29eff628f58c",
    "manual/screenshots/mobile/mobile_transportista_manifiestos.png": "2d7a597342033c2eefcfa19cdfb4148346d9b20c2cf317c4e77a69ad49dc0cca",
    "manual/screenshots/mobile/mobile_transportista_qr.png": "ebc663c0dbb9e88d90e969924f004b6ad53da4c7beaf2d1b2e60604d463763fe",
    "manual/screenshots/mobile/mobile_transportista_ruta.png": "08a3eedf673db07916068e76f43529b0a3ff942a5de49abea47f7f2820808f11",
    "manual/screenshots/mobile/mobile_transportista_viaje.png": "6aa551bd37cbc282528f070f5e43aa92e664fa7ee6343ce69248d2720c12d92e",
    "manual/screenshots/mobile/notice-inbox-20261025.jpg": "aa6e6ccefafc6cd78e15b1d64e784b082a16aa0c27debaf2379323f6fe897559",
    "manual/screenshots/mobile/notice-inbox-20261025.png": "aa6e6ccefafc6cd78e15b1d64e784b082a16aa0c27debaf2379323f6fe897559",
    "manual/screenshots/mobile/padrones-ayuda-alta-20261024.jpg": "9d84e487dd71566f961fcf3a907ce38076168539cebd47264039cc3254c7b411",
    "manual/screenshots/mobile/payment-decision-20261025.jpg": "fd4aa82ac365699d1d977d8a71aff00e2ce92074d0ebef1f89d0a00ca12a48e7",
    "manual/screenshots/mobile/payment-draft-recovered-20261026.jpg": "ad601bd96a89648c6dec8fbf69e4c58f747951d1f8023cb7cc7f04702ec566b6",
    "manual/screenshots/mobile/payment-reading-choice-20261026.jpg": "65908768fb9ad29e0b4b3eeb250724adafecaf752eba31fe099b3c9d4be0697b",
    "manual/screenshots/mobile/profile-change-recovered-20261026.jpg": "db9371fa2f8a665b874db79774b072b4479cfde7125fc36de23ad54a339289ec",
    "manual/screenshots/mobile/profile-change-recovered-20261026.png": "db9371fa2f8a665b874db79774b072b4479cfde7125fc36de23ad54a339289ec",
    "manual/screenshots/mobile/psip-activity-notice-20261025.png": "a1ec843a848f88cf2c8fc0bba9d9204cb97ac223d5b63b669083548a11bbe8d5",
    "manual/screenshots/mobile/psip-actor-decision-20261025.jpg": "419c53e92f426faba02b87b6692dccab500c0d380281b1b7aec17c1bac59a89c",
    "manual/screenshots/mobile/psip-actor-notice-20261025.jpg": "a1ec843a848f88cf2c8fc0bba9d9204cb97ac223d5b63b669083548a11bbe8d5",
    "manual/screenshots/mobile/psip-actor-pending-20261025.jpg": "61433e6690c320ec0867c7da1253d4eb42b4dad36bc372a843f9cbb09060bece",
    "manual/screenshots/mobile/psip-responder-20261020.png": "b110a06cf12bec06eff6049488ace4a1a009663f9b1f58dea574e4cd7ec136bc",
    "manual/screenshots/mobile/registration-confirmed-20261025.jpg": "9cc7b241e6049c696b738ee4303ef11d76680c2b7406e4f4d79ef0bf12b4e33b",
    "manual/screenshots/mobile/registration-confirmed-20261025.png": "9cc7b241e6049c696b738ee4303ef11d76680c2b7406e4f4d79ef0bf12b4e33b",
    "manual/screenshots/mobile/registration-keyboard-focus-20261025.jpg": "5d6c0208d1f831942d72a443c1d746164017dc66d0c58036402b83cc3a063e3b",
    "manual/screenshots/mobile/registration-observed-20261012.png": "852a8ed295c85b5273b388bc50d6f79868f75ceab2dc39e4e202289180b8b6cf",
    "manual/screenshots/mobile/registration-observed-20261020.png": "ad90581602eeae56567fc8a1d6da6680cf49bae8b1b20994413caa68c62e6b30",
    "manual/screenshots/mobile/registration-ocr-20261012.png": "af68991047daec525a6dde8679cdde813bddbd3c736721320eb729a9889bcbb0",
    "manual/screenshots/mobile/registration-orientation-20261025.jpg": "a184af89b313f19fdff0259f81d813faf6a81f622a54e3d793c64bdab50ab485",
    "manual/screenshots/mobile/registration-orientation-20261025.png": "a184af89b313f19fdff0259f81d813faf6a81f622a54e3d793c64bdab50ab485",
    "manual/screenshots/mobile/registration-trial-20261012.png": "cfdb52d67ba6e54a3f827f605b3ad9e3e46ca2ef60d732aae7ce8b05d714028a",
    "manual/screenshots/mobile/renewal-result-20261025.jpg": "ccc0a6cde7af74468f95375f65788481b2d1d743130272fd34690c42d53eec29",
    "manual/screenshots/mobile/renewal-result-20261025.png": "ccc0a6cde7af74468f95375f65788481b2d1d743130272fd34690c42d53eec29",
    "manual/screenshots/mobile/renewal-review-20261025.jpg": "90da4cafdf055d4f38efe16eff33d65f4ea31d33c3edfc082c541e244332b20e",
    "manual/screenshots/mobile/renewal-review-20261025.png": "90da4cafdf055d4f38efe16eff33d65f4ea31d33c3edfc082c541e244332b20e",
    "manual/screenshots/mobile/report-type-selector-20261025.jpg": "ca7dec7db56a54701917afa9c21e974d7d6fcdfc60bd44dea47b3fe606a36fdd",
    "manual/screenshots/mobile/report-type-selector-20261025.png": "ca7dec7db56a54701917afa9c21e974d7d6fcdfc60bd44dea47b3fe606a36fdd",
    "manual/screenshots/mobile/role-padron-generadores-20261024.jpg": "a86697e3c2797b3a370a695b3127b2080616dc34f051d3b67de9162d9e8bd27e",
    "manual/screenshots/mobile/role-padron-generadores-20261024.png": "a86697e3c2797b3a370a695b3127b2080616dc34f051d3b67de9162d9e8bd27e",
    "manual/screenshots/mobile/support-audience-20261025.jpg": "d3adcfcdf6dd65efd8839ed7ea67ad5ef5f08059e128e60b7bf8c7d4f88c8e5d",
    "manual/screenshots/mobile/support-command-recovered-20261025.jpg": "2f5f877e825ac34a239cf03d4e86f0769139530d38962056a4b2a73d70e16920",
    "manual/screenshots/mobile/support-created-20261012.png": "a863833a9b772d7ef0308c0a6cac64d22778a3f59bdab65b87b2ea168382fc1c",
    "manual/screenshots/mobile/support-file-recovery-20261026.jpg": "e4f6c497b84cb7dc20e82b1b0393d298fc34b3da00ede30e130b65ce238c6e7d",
    "manual/screenshots/mobile/support-report-20261012.png": "85accf2fc6ebf87f35035e2d903b810304fe077e384e5920f8c31ce21455f89f",
    "manual/screenshots/mobile/tef-declaration-change-20261025.jpg": "f45d024d12963a63a57c65c6e912cbc2e1cf14542e9258b857825476c5172434",
    "manual/screenshots/mobile/tef-review-pending-20261026.jpg": "2c952d444f711e8e7f3ec7a28b5536f4c4b1a8b9ef924409597243fc1f55d938",
    "manual/screenshots/mobile/tef-review-pending-20261026.png": "2c952d444f711e8e7f3ec7a28b5536f4c4b1a8b9ef924409597243fc1f55d938",
    "manual/screenshots/mobile/training-inspection-20261012.png": "c6f094c753dcbd712a5c5d5219e8929c74f38fdeea3000406e29346459424e9a",
    "manual/screenshots/mobile/transport-handoff-c3-20261019.png": "71dc392ffa205cea3c0bc6fb070701cf609d3bfd924464e3e32750b4d84fc5aa",
    "manual/screenshots/mobile/transport-handoff-gps-20261019.png": "923765686e74642e371b9937e11bd7d83d48891285709928e5c0c3cd1526a368",
    "manual/screenshots/mobile/workspace-home-20261024.jpg": "8904604d72f97ddbb29a3381c3e7338c6fe9c8dc72e4162c7eb05f7af50e9409",
    "manual/screenshots/mobile/workspace-home-20261024.png": "8904604d72f97ddbb29a3381c3e7338c6fe9c8dc72e4162c7eb05f7af50e9409",
    "manual/screenshots/mobile/workspace-list-20261024.jpg": "6d373b70bac6c6c4ed9bcdb421baae69114da502d17b2f07e0f5897ab696c61a",
    "manual/screenshots/mobile/workspace-list-20261024.png": "6d373b70bac6c6c4ed9bcdb421baae69114da502d17b2f07e0f5897ab696c61a",
    "manual/search.html": "4e5dac9bb1be0d2bb671497be3e072d399bebcbfe1b861af326e7b2d0f9d5b24",
    "manual/sitrep-mark.svg": "b3d6493e1d94cfb066b91fbf02a0fd7fa4b3ad5be5d3ec8e67795697c00e65c6",
    "manual/training-20261018-capture-provenance.json": "11907453630ee534d1e0a0e28901124446c2a657c3f6c979c4bec1d6cd384c82",
    "manual/training-capture-provenance.json": "2868d77ee9cfd7a7665aeab43f335810e8193e87ac630542122366abcd254349",
    "manual/transport-handoff-capture-provenance.json": "454a8493eba9de9bce1976a5803763294a7629cae29c978d82a0e7114ad08a93",
    "manual/tutorial.html": "ea90449360ad5029bf904232c0b81368a13b4bc74a61f48506603a6e42a40e46",
    "manual/workspace-capture-provenance.json": "e737f89ed4d76bcc835ee58919d294a7f93cb9d2090617ca1df7368ad53f755a",
    "mendoza-marca-horizontal-transparente.png": "0034ba6cd9fc9bbcb2f8008ab4134d83cb4ef32434a45ee238a9aacc3b229543",
    "mendoza-marca-secundaria-transparente.png": "943e4096c98dbe16b65ac587d059ff2488981619b9db7115e9e5e1dcad78db8e",
    "offline.html": "d43a1eee2bda762a83ab853d6cb18e3cfada1a3411c6fd6eb2bb4d8aeaf5965a",
    "setup.html": "88dcad26ce40dcfb269c8e88522407508f0bbb63da442e8c6d393cc054fa6404",
    "sitrep-mark-green.svg": "f4e7ce0fd5aa2e0b084df24c1a9d01056af432dfd4586bfff0c5cf5b9685b7d7",
    "sw-app.js": "dacc8707f453cb601f2d886c9fe2f846a38802c19316468494240e2045612ca8",
    "sw.js": "daf1014fafc280af104d00d5cb71e6595a9f3f79a854b089adb4e366c1684977",
    "test.html": "fc709d559b31b9b3f85785e4a529c40e119615afc906e922446d9ce7e472399b",
    "vite.svg": "4a748afd443918bb16591c834c401dae33e87861ab5dbad0811c3a3b4a9214fb",
    "voice/LICENSE-2.0.txt": "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30",
    "voice/NOTICE.txt": "71d1af8b1a131465ca6d5bb2b1d4ec40033ff95fe23099176da6b31fb99a38b7"
  }
};
export function assertReviewedHashes(release: Json,backend: Record<string,string>,frontend: Record<string,string>): void {
  if(release.webSource!==REVIEWED_REVISION || release.appSource!==REVIEWED_REVISION
      || release.backendSource!==REVIEWED_BACKEND_REVISION || release.manualSource!==REVIEWED_BACKEND_REVISION)throw new Error('Unreviewed component identities');
  if(JSON.stringify(Object.keys(backend).sort())!==JSON.stringify(Object.keys(REVIEWED_FILES.backend).sort()))throw new Error('Unreviewed backend file set');
  for(const [actual,expected] of [[backend,REVIEWED_FILES.backend],[frontend,REVIEWED_FILES.frontend]]) {
    for(const [name,value] of Object.entries(expected))if(actual[name]!==value)throw new Error('Reviewed baseline file mismatch');
  }
}
export function reviewedCompositionMatches(backend: string,frontend: string): boolean {
  const backendFiles: Record<string,string>=Object.fromEntries(Object.entries(inventory(path.join(backend,'dist'))).map(([name,entry])=>['dist/'+name,(entry as Json).sha256]));
  for(const name of ['package.json','package-lock.json','prisma/schema.prisma']) {ordinary(path.join(backend,name));backendFiles[name]=hash(path.join(backend,name));}
  const frontendFiles: Record<string,string>={};
  // inventory rejects links, including parent-directory links; historical static
  // assets remain allowed for open tabs and are frozen by the prepare snapshot.
  for(const [name,entry] of Object.entries(inventory(frontend)))frontendFiles[name]=(entry as Json).sha256;
  try { assertReviewedHashes(read(path.join(frontend,'release.json')),backendFiles,frontendFiles);return true; }
  catch {return false;}
}

export function current(): Json {
  if (os.hostname()!=='srv2101069.hstgr.cloud' || process.getuid?.()!==0
      || fs.readFileSync('/srv/umsa-migration/.target','utf8').trim()!=='179.198.115.115'
      || !fs.existsSync('/srv/umsa-migration/production.active')) throw new Error('Only authoritative Hostinger is allowed');
  const statePath=path.join(ROOT,'state.json');
  let state: Json;
  if (fs.existsSync(statePath)) state=read(statePath);
  else {
    if(reviewedCompositionMatches(BACKEND,FRONTEND)) {
      state={revision:REVIEWED_REVISION,backend:BACKEND,frontend:FRONTEND,
        components:{web:REVIEWED_REVISION,app:REVIEWED_REVISION,backend:REVIEWED_BACKEND_REVISION,manual:REVIEWED_BACKEND_REVISION}};
    } else throw new Error('Initial deployed code differs from the reviewed composition');
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
const RUNTIME_LINKS=Object.freeze(['node_modules','data','uploads']);
export function nativeLinks(backend: string,currentBackend: string,privatePrisma=false,privateDependencies=false): void {
  if(privateDependencies) {
    dependencyDigest(path.join(backend,'runtime-dependencies'));
    fs.symlinkSync(path.join(backend,'runtime-dependencies/node_modules'),path.join(backend,'node_modules'),'dir');
    for(const name of ['data','uploads'])fs.symlinkSync(fs.realpathSync(path.join(currentBackend,name)),path.join(backend,name),'dir');
    return;
  }
  for(const name of privatePrisma?['data','uploads']:RUNTIME_LINKS)fs.symlinkSync(fs.realpathSync(path.join(currentBackend,name)),path.join(backend,name),'dir');
  if(!privatePrisma)return;
  const modules=path.join(backend,'node_modules'),active=path.join(currentBackend,'node_modules');
  fs.mkdirSync(modules);fs.mkdirSync(path.join(modules,'@prisma'));fs.mkdirSync(path.join(modules,'.prisma'));
  for(const name of fs.readdirSync(active))if(!['@prisma','.prisma'].includes(name))fs.symlinkSync(fs.realpathSync(path.join(active,name)),path.join(modules,name));
  for(const name of fs.readdirSync(path.join(active,'@prisma')))if(name!=='client')fs.symlinkSync(fs.realpathSync(path.join(active,'@prisma',name)),path.join(modules,'@prisma',name));
  fs.cpSync(path.join(backend,'runtime-prisma/client'),path.join(modules,'@prisma/client'),{recursive:true});
  fs.cpSync(path.join(backend,'runtime-prisma/generated'),path.join(modules,'.prisma/client'),{recursive:true});
}
function runtimeLinks(backend: string): string[] {
  if(fs.lstatSync(path.join(backend,'node_modules')).isSymbolicLink())return [...RUNTIME_LINKS];
  const result=['data','uploads'];
  for(const name of fs.readdirSync(path.join(backend,'node_modules')).sort())if(!['@prisma','.prisma'].includes(name))result.push('node_modules/'+name);
  for(const name of fs.readdirSync(path.join(backend,'node_modules/@prisma')).sort())if(name!=='client')result.push('node_modules/@prisma/'+name);
  return result;
}
function fileMapHash(files: Json): string {
  return digest(JSON.stringify(Object.keys(files).sort().map(name=>[name,files[name]])));
}
function linkEvidence(backend: string): Json {
  const links: Json={};
  for(const name of runtimeLinks(backend)) {
    const file=path.join(backend,name);const link=fs.lstatSync(file);
    if(!link.isSymbolicLink())throw new Error('Preserved runtime link was replaced');
    const target=fs.statSync(file);
    if(RUNTIME_LINKS.includes(name) && !target.isDirectory())throw new Error('Preserved runtime link target is not a directory');
    links[name]={target:fs.readlinkSync(file),resolved:fs.realpathSync(file),
      linkDevice:link.dev,linkInode:link.ino,linkMode:link.mode,linkOwner:link.uid,
      targetDevice:target.dev,targetInode:target.ino};
  }
  return links;
}
function rollbackRelease(before: Json): string {
  const file=path.join(before.frontend,'release.json');
  return JSON.stringify({...(fs.existsSync(file)?read(file):{}),commit:before.revision,...(before.components?{components:before.components}:{})})+'\n';
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
  const sealed=run('tar',['-xOzf',archive,'./.sitrep-release.json'],64*1024**2);
  if(fs.readFileSync(manifestFile,'utf8').trim()!==sealed
      || fs.readFileSync(path.join(extracted,'.sitrep-release.json'),'utf8').trim()!==sealed)throw new Error('Sealed release manifest changed');
  const manifest=JSON.parse(sealed);
  if(![2,3].includes(manifest.format) || manifest.commit!==commit)throw new Error('Unsupported sealed release manifest');
  migrations(manifest);dependencies(manifest);
  assertPrivateDependencies(path.join(extracted,'backend'),manifest);
  const files=inventory(extracted);delete files['.sitrep-release.json'];
  if(fileMapHash(files)!==fileMapHash(manifest.files))throw new Error('Reviewed source payload changed after preparation');
  return manifest;
}
export function capturePrepared(ready: Json,root: string): Json {
  return {version:1,backendCodeDigest:codeDigest(ready.backend),
    backendInventory:fileMapHash(inventory(ready.backend,runtimeLinks(ready.backend))),
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
  if(migrations(manifest).length && !dependencies(manifest)) {
    for(const [name,entry] of Object.entries(manifest.files)) {
      if(name.startsWith('backend/runtime-prisma/client/'))expectedBackend['node_modules/@prisma/client/'+name.slice('backend/runtime-prisma/client/'.length)]=entry;
      if(name.startsWith('backend/runtime-prisma/generated/'))expectedBackend['node_modules/.prisma/client/'+name.slice('backend/runtime-prisma/generated/'.length)]=entry;
    }
  }
  compatible(ready.backend,ready.before.backend,manifest);
  const normalized=loopbackIndex(fs.readFileSync(path.join(locations.extracted,'backend/dist/index.js'),'utf8'));
  expectedBackend['dist/index.js']={sha256:digest(normalized),bytes:Buffer.byteLength(normalized)};
  const expectedRollback: Json=Object.assign(Object.create(null),expectedFrontend,inventory(ready.before.frontend));
  const oldRelease=rollbackRelease(ready.before);
  expectedRollback['release.json']={sha256:digest(oldRelease),bytes:Buffer.byteLength(oldRelease)};
  if(fileMapHash(inventory(ready.backend,runtimeLinks(ready.backend)))!==fileMapHash(expectedBackend)
      || fileMapHash(inventory(ready.frontend))!==fileMapHash(expectedFrontend)
      || fileMapHash(inventory(ready.rollback))!==fileMapHash(expectedRollback))throw new Error('Prepared payload differs from the reviewed bundle and baseline');
  const expectedLinks=migrations(manifest).length && !dependencies(manifest)?['data','uploads',...fs.readdirSync(path.join(ready.before.backend,'node_modules')).filter(name=>!['@prisma','.prisma'].includes(name)).map(name=>'node_modules/'+name),...fs.readdirSync(path.join(ready.before.backend,'node_modules/@prisma')).filter(name=>name!=='client').map(name=>'node_modules/@prisma/'+name)]:RUNTIME_LINKS;
  if(JSON.stringify([...runtimeLinks(ready.backend)].sort())!==JSON.stringify([...expectedLinks].sort()))throw new Error('Prepared dependency overlay changed');
  for(const name of expectedLinks) {
    const target=dependencies(manifest) && name==='node_modules'?path.join(ready.backend,'runtime-dependencies/node_modules'):fs.realpathSync(path.join(ready.before.backend,name));
    if(fs.readlinkSync(path.join(ready.backend,name))!==target)throw new Error('Prepared runtime link target changed');
  }
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
  if (![2,3].includes(manifest.format) || manifest.commit!==commit) throw new Error('Unexpected release manifest');
  assertRuntimePlatform(manifest);
  inspectArchive(archive);
  directory(ROOT,0o755); directory(path.join(ROOT,'staged')); directory(path.join(ROOT,'releases'),0o755);
  const root=path.join(ROOT,'staged',`${commit}-${bundle}`);
  if (fs.existsSync(root)) throw new Error('Preserve existing staged release');
  directory(root); const extracted=path.join(root,'package');directory(extracted);
  run('tar',['-xzf',archive,'-C',extracted,'--no-same-owner','--no-same-permissions']);
  sealedManifest(archive,path.join(incoming,'release.json'),extracted,commit,bundle);
  compatible(path.join(extracted,'backend'),before.backend,manifest);
  const database=migrations(manifest).length ? migrationState() : null;
  const stat=fs.statfsSync(ROOT); const sourceBytes=Object.values(inventory(before.frontend)).reduce((n:any,item:any)=>n+item.bytes,0);
  const candidateBytes=Object.entries(manifest.files).filter(([name])=>name.startsWith('backend/')).reduce((total,[_name,item])=>total+Number((item as Json).bytes),0);
  if (Number(stat.bavail)*Number(stat.bsize)<3*1024**3+3*Number(sourceBytes)+2*candidateBytes+2*fs.statSync(archive).size) throw new Error('Insufficient release/backup capacity');
  const destination=path.join(ROOT,'releases',`${commit}-${id}`);directory(destination,0o755);
  const backend=path.join(destination,'backend');fs.cpSync(path.join(extracted,'backend'),backend,{recursive:true});
  fs.writeFileSync(path.join(backend,'dist/index.js'),loopbackIndex(fs.readFileSync(path.join(backend,'dist/index.js'),'utf8')));
  nativeLinks(backend,before.backend,Boolean(database),Boolean(dependencies(manifest)));
  const frontend=path.join(destination,'frontend');fs.cpSync(before.frontend,frontend,{recursive:true});fs.cpSync(path.join(extracted,'frontend'),frontend,{recursive:true});
  const rollback=path.join(destination,'rollback-frontend');fs.cpSync(frontend,rollback,{recursive:true});fs.cpSync(before.frontend,rollback,{recursive:true});
  fs.writeFileSync(path.join(rollback,'release.json'),rollbackRelease(before));
  chmodTree(frontend);chmodTree(rollback);
  const original=fs.readFileSync(PROXY,'utf8');
  const candidate=proxyFor(original,before.frontend,frontend); const rollbackProxy=proxyFor(original,before.frontend,rollback);
  fs.writeFileSync(path.join(root,'candidate.conf'),candidate);fs.writeFileSync(path.join(root,'rollback.conf'),rollbackProxy);
  run('/usr/sbin/nginx',['-t','-c',path.join(root,'candidate.conf')]);run('/usr/sbin/nginx',['-t','-c',path.join(root,'rollback.conf')]);
  const ready: Json={commit,bundle,database,manifest,preparedRun:id,controller:hash(fileURLToPath(import.meta.url)),before,backend,frontend,rollback,destination};
  ready.artifacts=capturePrepared(ready,root);
  assertPrepared(ready,root,bundle,original);
  save(path.join(root,'ready.json'),ready);
  return {preparedCommit:commit,bundleSha256:bundle,expectedActiveRevision:expected,activation:false,dependenciesUnchanged:!dependencies(manifest),dependencies:dependencies(manifest),schemaAndDependenciesUnchanged:!database&&!dependencies(manifest),databaseMigrations:manifest.databaseMigrations,database,requiredAcknowledgement:requiredAcknowledgement(manifest)};
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
async function publish(commit: string,expected: string,bundle: string,id: string,ack: string): Promise<Json> {
  const root=path.join(ROOT,'staged',`${commit}-${bundle}`);const ready=read(path.join(root,'ready.json'));
  if (ready.commit!==commit || ready.bundle!==bundle || ready.controller!==hash(fileURLToPath(import.meta.url)) || ready.before.revision!==expected) throw new Error('Reviewed preparation/controller changed');
  const manifest=read(path.join(root,'package/.sitrep-release.json'));
  assertAcknowledgement(manifest,ack);assertRuntimePlatform(manifest);
  const list=migrations(manifest);
  sameCurrent(ready.before,current());
  const originalProxy=fs.readFileSync(PROXY);const beforeProxy=originalProxy.toString();
  const backupRoot=path.join(ROOT,'backups',id);
  const oldDropin=fs.existsSync(DROPIN)?fs.readFileSync(DROPIN):null;
  const candidate=fs.readFileSync(path.join(root,'candidate.conf'));const rollbackProxy=fs.readFileSync(path.join(root,'rollback.conf'));
  const override=`[Service]\nWorkingDirectory=${ready.backend}\nExecStart=\nExecStart=/usr/bin/node ${ready.backend}/dist/index.js\n`;
  let backendChanged=false;let proxyChanged=false;let migrationAttempted=false;let databaseMigrated=false;
  await backedActivation(()=>withPrepared(ready,root,bundle,beforeProxy,()=>backup(backupRoot,ready.before)),()=>{
    sameCurrent(ready.before,current());
    assertPrepared(ready,root,bundle,beforeProxy);
    if(list.length) {
      const state=migrationState();
      if(JSON.stringify(state)!==JSON.stringify(ready.database))throw new Error('Migration metadata changed since prepare');
      migrationAttempted=true;
      applyMigration(ready.backend,state);databaseMigrated=true;
      save(path.join(backupRoot,'migration.complete.json'),migrationOutcome(true,true,list,backupRoot));
    }
  },async()=>{
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
    save(path.join(backupRoot,'publication.complete.json'),{commit,bundle,...migrationOutcome(migrationAttempted,databaseMigrated,list,backupRoot),environmentPreserved:true,dependencies:dependencies(manifest)});
  },async()=>{
    // Record database outcome even if code rollback itself subsequently fails.
    save(path.join(backupRoot,'rollback.json'),{applicationCodeRestored:false,...migrationOutcome(migrationAttempted,databaseMigrated,list,backupRoot)});
    if (proxyChanged) { atomic(PROXY,rollbackProxy,digest(candidate));run('/usr/sbin/nginx',['-t','-c',PROXY]);run('systemctl',['reload',INGRESS]); }
    if (backendChanged) {
      if(hash(DROPIN)!==digest(override))throw new Error('Concurrent service override change; preserve evidence');
      if(oldDropin)atomic(DROPIN,oldDropin,digest(override));else fs.unlinkSync(DROPIN);
      run('systemctl',['daemon-reload']);run('systemctl',['restart',SERVICE]);
      await waitBackend();
    }
    if(proxyChanged)await checkPublic(ready.rollback,expected);
    if(proxyChanged) save(path.join(ROOT,'state.json'),{revision:expected,backend:ready.before.backend,frontend:ready.rollback,
      codeDigest:ready.before.codeDigest,frontendDigest:digest(JSON.stringify(inventory(ready.rollback))),proxyHash:hash(PROXY),...(ready.before.components?{components:ready.before.components}:{}),rollback:true});
    save(path.join(backupRoot,'rollback.json'),{applicationCodeRestored:true,...migrationOutcome(migrationAttempted,databaseMigrated,list,backupRoot),uploadsAndSessionConfigurationPreserved:true});
  });
  return {publishedCommit:commit,...migrationOutcome(migrationAttempted,databaseMigrated,list,backupRoot),environmentPreserved:true,uploadsPreserved:true,backupRecorded:true};
}
async function main(): Promise<void> {
  const [operation,commit,expected,bundle,id,ack]=process.argv.slice(2);
  if(operation==='preflight') {
    if(!SHA.test(commit) || expected || bundle || id || ack)throw new Error('Read-only preflight requires only the active revision');
    const state=current();
    if(state.revision!==commit)throw new Error('Unexpected active runtime revision');
    await waitBackend();
    console.log(JSON.stringify({readOnly:true,activeRevision:state.revision,components:state.components,verifiedRuntimeCodeAndLoopbackBinding:true,
      verifiedStaticPackages:true,databaseAndUploadsContractVerified:true,health:'ok',applicationStarted:false,candidateSelected:false}));
    return;
  }
  if (!['prepare','publish'].includes(operation) || !SHA.test(commit) || !SHA.test(expected) || !DIGEST.test(bundle) || !/^[0-9]+-[0-9]+$/.test(id)) throw new Error('Invalid explicit release identity');
  process.umask(0o077);
  console.log(JSON.stringify(operation==='prepare'?stage(commit,expected,bundle,id):await publish(commit,expected,bundle,id,ack)));
}
if (process.argv[1] && (process.argv[1]==='-' || path.resolve(process.argv[1])===fileURLToPath(import.meta.url))) main().catch(()=>{console.error('SITREP publication/preflight failed; preserve private evidence and review the runtime contract.');process.exitCode=1;});
