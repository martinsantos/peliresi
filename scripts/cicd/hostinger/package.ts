import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { inventory,digest,REVIEWED_MIGRATION,migrations,assertPrivatePrisma } from './publisher.ts';

const [source,output,commit,declaredMigrations]=process.argv.slice(2);
if(!source || !output || !/^[a-f0-9]{40}$/.test(commit))throw new Error('Explicit source/output/commit required');
const names=declaredMigrations?declaredMigrations.split(','):[];
if(names.length && (names.length!==1 || names[0]!==REVIEWED_MIGRATION.name))throw new Error('Only the explicitly reviewed migration can be packaged');
if(fs.existsSync(output))throw new Error('Preserve existing package');
fs.mkdirSync(output,{recursive:true,mode:0o700});
const tree=path.join(output,'tree');fs.mkdirSync(tree);
const backend=path.join(tree,'backend');fs.mkdirSync(backend);fs.mkdirSync(path.join(backend,'prisma'));
fs.cpSync(path.join(source,'backend/dist'),path.join(backend,'dist'),{recursive:true});
for(const file of ['package.json','package-lock.json','prisma/schema.prisma'])fs.copyFileSync(path.join(source,'backend',file),path.join(backend,file));
const schemaSha256=digest(fs.readFileSync(path.join(backend,'prisma/schema.prisma')));
const databaseMigrations=names.length ? names.map(name=>{
  const relative=path.join('prisma/migrations',name,'migration.sql');
  const file=path.join(source,'backend',relative);const sha256=digest(fs.readFileSync(file));
  fs.mkdirSync(path.dirname(path.join(backend,relative)),{recursive:true});fs.copyFileSync(file,path.join(backend,relative));
  return {name,sha256};
}) : false;
const metadata={format:databaseMigrations?3:2,commit,databaseMigrations,schemaSha256};
migrations(metadata);
if(databaseMigrations) {
  const prisma=path.join(backend,'runtime-prisma');fs.mkdirSync(prisma);
  // CI generated this client with the candidate schema; the active server is never used to generate it.
  fs.cpSync(path.join(source,'backend/node_modules/@prisma/client'),path.join(prisma,'client'),{recursive:true});
  fs.cpSync(path.join(source,'backend/node_modules/.prisma/client'),path.join(prisma,'generated'),{recursive:true});
  assertPrivatePrisma(backend,schemaSha256);
}
fs.cpSync(path.join(source,'frontend/dist'),path.join(tree,'frontend'),{recursive:true});
fs.cpSync(path.join(source,'frontend/dist-app'),path.join(tree,'frontend/app'),{recursive:true});
if(fs.existsSync(path.join(source,'docs/manual'))) {
  fs.cpSync(path.join(source,'docs/manual'),path.join(tree,'frontend/manual'),{recursive:true});
  for(const name of ['desktop','mobile'])if(fs.existsSync(path.join(source,'docs/screenshots',name)))
    fs.cpSync(path.join(source,'docs/screenshots',name),path.join(tree,'frontend/manual/screenshots',name),{recursive:true});
}
for(const file of ['backend/dist/index.js','frontend/index.html','frontend/app/app.html'])if(!fs.statSync(path.join(tree,file)).isFile())throw new Error('Required artifact absent');
fs.writeFileSync(path.join(tree,'frontend/release.json'),JSON.stringify({commit})+'\n');
const files=inventory(tree);
for(const name of Object.keys(files)) {
  if(/(^|\/)(?:\.env[^/]*|\.git|node_modules|uploads|data)(\/|$)/.test(name) || /[\r\n\0]/.test(name))throw new Error('Private/runtime path cannot be packaged');
}
fs.writeFileSync(path.join(output,'release.json'),JSON.stringify({...metadata,files},null,2)+'\n');
// The reviewed tar digest now authenticates the manifest as well as the payload.
fs.copyFileSync(path.join(output,'release.json'),path.join(tree,'.sitrep-release.json'));
execFileSync('tar',['-czf',path.join(output,'release.tar.gz'),'-C',tree,'.'],{stdio:'pipe'});
console.log(JSON.stringify({packagedCommit:commit,fileCount:Object.keys(files).length,databaseMigrations,schemaSha256}));
