import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out='/work/sitrep/.qa-inspection-deadline-company-20261030';
assert.equal(process.env.QA_ARTIFACTS,out);assert.equal(process.env.QA_COMPAT_BACKEND,'inspection-deadline-company-after');
const ts=backendRequire('typescript'),source='/work/sitrep/backend/src',baseline='/work/sitrep/backend/dist-qa-psip-company-20261030-v2';
const output='/work/sitrep/backend/dist-qa-psip-deadline-company-20261030-v3';
assert.ok(existsSync(path.join(baseline,'index.js')));assert.ok(!existsSync(output));
const modules=['services/inspectionCompanyNotice.service','services/inspectionDeadlineCompanyNotice.service','services/companyNotice.service',
 'services/notification-mail.service','jobs/alertCatalogue.job'];
const digest=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
const controller=digest(path.join(baseline,'controllers/notification.controller.js'));
cpSync(baseline,output,{recursive:true,errorOnExist:true});
const changed=[];
for(const name of modules){
 const input=path.join(source,name+'.ts'),target=path.join(output,name+'.js');
 const compiled=ts.transpileModule(readFileSync(input,'utf8'),{fileName:input,reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}});
 assert.deepEqual(compiled.diagnostics,[]);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,compiled.outputText);
 changed.push({module:name,sourceSha256:digest(input),outputSha256:digest(target)});
}
function walk(dir:string,prefix=''):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()
 ?walk(path.join(dir,entry.name),path.join(prefix,entry.name)):[path.join(prefix,entry.name)]);}
const allow=new Set(modules.map(name=>name+'.js')),other=walk(baseline).filter(name=>!allow.has(name));
for(const name of other)assert.equal(digest(path.join(baseline,name)),digest(path.join(output,name)),name);
assert.equal(digest(path.join(output,'controllers/notification.controller.js')),controller);
writeFileSync(path.join(out,'build-proof-v3.json'),JSON.stringify({baseline,output,changed,untouchedFiles:other.length,
 notificationControllerSha256:controller,controllerSourceCopied:false,production:false},null,2)+'\n',{flag:'wx',mode:0o600});
console.log(`Compilación aislada: ${changed.length} módulos; ${other.length} archivos de base verificados.`);
