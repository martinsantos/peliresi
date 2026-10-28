import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { inventory } from './publisher.ts';

const [source,output,commit]=process.argv.slice(2);
if(!source || !output || !/^[a-f0-9]{40}$/.test(commit))throw new Error('Explicit source/output/commit required');
if(fs.existsSync(output))throw new Error('Preserve existing package');
fs.mkdirSync(output,{recursive:true,mode:0o700});
const tree=path.join(output,'tree');fs.mkdirSync(tree);
const backend=path.join(tree,'backend');fs.mkdirSync(backend);fs.mkdirSync(path.join(backend,'prisma'));
fs.cpSync(path.join(source,'backend/dist'),path.join(backend,'dist'),{recursive:true});
for(const file of ['package.json','package-lock.json','prisma/schema.prisma'])fs.copyFileSync(path.join(source,'backend',file),path.join(backend,file));
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
fs.writeFileSync(path.join(output,'release.json'),JSON.stringify({format:2,commit,databaseMigrations:false,files},null,2)+'\n');
// The reviewed tar digest now authenticates the manifest as well as the payload.
fs.copyFileSync(path.join(output,'release.json'),path.join(tree,'.sitrep-release.json'));
execFileSync('tar',['-czf',path.join(output,'release.tar.gz'),'-C',tree,'.'],{stdio:'pipe'});
console.log(JSON.stringify({packagedCommit:commit,fileCount:Object.keys(files).length,databaseMigrations:false}));
