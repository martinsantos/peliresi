import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys, root } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out='/work/sitrep/.qa-actor-receipt-20261030';
assert.equal(process.env.QA_ARTIFACTS,out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
const fixture=JSON.parse(readFileSync(path.join(out,'fixture.json'),'utf8'));
assert.equal(fixture.synthetic,true);assert.match(fixture.owner,/@night-qa\.invalid$/);assert.match(fixture.outsider,/@night-qa\.invalid$/);
const processes=JSON.parse(readFileSync(path.join(out,'processes.json'),'utf8'));
assert.deepEqual(processes.map((p:{file:string})=>p.file).sort(),['runtime.ts','server.ts']);
const uploads='/work/sitrep/.qa-operational-ui-current2026103070/uploads';
for(const {pid} of processes){
 const env=Object.fromEntries(readFileSync(`/proc/${pid}/environ`,'utf8').split('\0').filter(Boolean).map(line=>[line.slice(0,line.indexOf('=')),line.slice(line.indexOf('=')+1)]));
 assertCloudEnvironment(env);assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'),'proposal_operations_20261021');
 assert.equal(env.QA_COMPAT_BACKEND,'actor-receipt-438e5b02');assert.equal(env.QA_WEB_BUILD,`${out}/web-final2`);assert.equal(env.QA_APP_BUILD,`${out}/app-final2`);
 assert.equal(env.UPLOADS_DIR,uploads);assert.equal(env.TRAINING_DATABASE_URL,'');assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
 assert.equal(env.DISABLE_EMAILS,'true');assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED,'false');assert.equal(env.EMAIL_NOTIFICATION_FAMILIES,'');assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED,'false');
 for(const key of externalKeys)assert.equal(env[key],'');
}
const before=JSON.parse(readFileSync(path.join(out,'before.json'),'utf8')).stats, after=JSON.parse(readFileSync(path.join(out,'after.json'),'utf8')).stats;
assert.equal(before.unexpected,2);assert.equal(before.expected,0);assert.equal(after.expected,14);assert.equal(after.unexpected,0);assert.equal(after.skipped,0);
const preference=JSON.parse(readFileSync(path.join(out,'preference.json'),'utf8')).stats;
assert.equal(preference.expected,4);assert.equal(preference.unexpected,0);assert.equal(preference.skipped,0);
const unit=JSON.parse(readFileSync(path.join(out,'unit-final-welcome.json'),'utf8'));assert.equal(unit.numFailedTests,0);assert.equal(unit.numPendingTests,0);assert.equal(unit.numPassedTests,unit.numTotalTests);
const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');const manual=readFileSync('/work/sitrep/docs/manual/help-data.js');
const served=await fetch('http://127.0.0.1:4177/manual/help-data.js');assert.equal(served.status,200);assert.equal(digest(Buffer.from(await served.arrayBuffer())),digest(manual));
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
try{
 const owner=await db.usuario.findUniqueOrThrow({where:{email:fixture.owner}}), docs=[] as any[];
 assert.equal(owner.preferenciaEnlaces,'AUTO');
 for(const type of ['generador','transportista','operador']){
  const item=fixture.created[type], actor=await db[type].findUniqueOrThrow({where:{id:item.actorId}});
  assert.equal(actor.usuarioId,owner.id);assert.equal(actor.activo,true);
  const doc=await db.documento.findUniqueOrThrow({where:{id:item.document}});assert.equal(doc[`${type}Id`],actor.id);
  assert.equal(doc.tipo,'COMPROBANTE_PAGO');assert.equal(doc.nombre,item.documentName);assert.equal(doc.analisis.duplicado,true);docs.push(doc);
  const notice=await db.notificacion.findUniqueOrThrow({where:{id:item.notice}}),data=JSON.parse(notice.datos);
  assert.equal(notice.usuarioId,owner.id);assert.equal(data.actorTipo,type);assert.equal(data.actorId,actor.id);assert.equal(data.documentoId,doc.id);
 }
 assert.ok(docs.every(doc=>doc.sha256===docs[0].sha256));
 const extra=await db.documento.findMany({where:{tipo:'COMPROBANTE_PAGO',OR:[
  {generadorId:fixture.created.generador.actorId,nombre:{startsWith:'QA-generador-'}},
  {transportistaId:fixture.created.transportista.actorId,nombre:{startsWith:'QA-transportista-'}},
  {operadorId:fixture.created.operador.actorId,nombre:{startsWith:'QA-operador-'}},
 ]}});
 const files=Array.from(new Set(extra.map((doc:any)=>{
  const resolved=realpathSync(doc.path);assert.ok(resolved.startsWith(realpathSync(uploads)+path.sep));assert.ok(existsSync(resolved));return path.relative(root,resolved);
 })));
 assert.ok(files.length>=5);assert.ok(files.every(file=>!file.startsWith('..')&&!path.isAbsolute(file)));
 execFileSync('tar',['-C',root,'-czf',path.join(out,'synthetic-uploads.tar.gz'),'--',...files]);
 const {TRAINING_LOGINS}=backendRequire(path.join(path.dirname(qaBackendEntry()),'lib/trainingDirectLogin.js'));assert.equal(TRAINING_LOGINS.length,4);
 for(const {email} of TRAINING_LOGINS){assert.match(email,/@capacitacion\.invalid$/);const response=await fetch('http://127.0.0.1:4177/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.25.89.1'},body:JSON.stringify({email,password:'expired-qa-probe'})});assert.equal(response.status,403);}
 assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
 const result={synthetic:true,production:false,actorNotices:docs.length,uploadedFilesPreserved:files.length,beforeBrowserFailures:2,afterBrowserPasses:14,preferenceBrowserPasses:4,unitPassed:unit.numPassedTests,capClosed:true,emailAttempts:0,emailsSent:0,pushEnabled:false,manualSha256:digest(manual)};
 writeFileSync(path.join(out,'audit.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await db.$disconnect();}
