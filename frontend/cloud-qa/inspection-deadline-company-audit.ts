import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase,assertCloudEnvironment,backendRequire,externalKeys,root } from './safety.ts';

await assertCloudDatabase();
const out='/work/sitrep/.qa-inspection-deadline-company-20261030';
assert.equal(process.env.QA_ARTIFACTS,out);assert.equal(process.env.QA_COMPAT_BACKEND,'inspection-deadline-company-after');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
const read=(name:string)=>JSON.parse(readFileSync(path.join(out,name),'utf8'));
const visual=process.env.QA_INSPECTION_DEADLINE_AUDIT==='visual-2';
for(const proc of read('processes.json')){
 const env=Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`,'utf8').split('\0').filter(Boolean)
  .map(entry=>[entry.slice(0,entry.indexOf('=')),entry.slice(entry.indexOf('=')+1)]));
 assertCloudEnvironment(env);assert.equal(env.QA_COMPAT_BACKEND,'inspection-deadline-company-after');
 assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'),'proposal_operations_20261021');
 assert.equal(env.TRAINING_DATABASE_URL,'');assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
 assert.equal(env.DISABLE_EMAILS,'true');assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
 assert.equal(env.EMAIL_NOTIFICATION_FAMILIES,'');assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED,'false');
 for(const key of externalKeys)assert.equal(env[key],'');
}
const reports:Array<[string,number]>=visual?[['browser-visual-2.json',3]]:[['browser-desktop-1.json',1],['browser-mobile-1.json',2]];
for(const [name,count] of reports){
 const report=read(name);assert.equal(report.stats.expected,count);assert.equal(report.stats.unexpected,0);
 assert.equal(report.stats.skipped,0);assert.equal(report.stats.flaky,0);assert.deepEqual(report.errors,[]);
}
const dist=path.join(root,'backend/dist-qa-psip-deadline-company-20261030-v2');
const {TRAINING_LOGINS}=backendRequire(path.join(dist,'lib/trainingDirectLogin.js'));
for(const {email} of TRAINING_LOGINS){
 assert.match(email,/@capacitacion\.invalid$/);
 const response=await fetch('http://127.0.0.1:4177/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.11.85.99'},
  body:JSON.stringify({email,password:'expired-qa-probe'})});assert.equal(response.status,403);
}
const db=backendRequire(path.join(dist,'lib/prisma.js')).default,{ejecutarCatalogo}=backendRequire(path.join(dist,'jobs/alertCatalogue.job.js'));
const fixture=read(visual?'fixture-visual.json':'fixture.json'),records=Object.values(fixture.cases).flat() as any[];assert.equal(records.length,9);
try{
 const rule=await db.reglaAlerta.findUniqueOrThrow({where:{id:fixture.ruleId}});assert.ok(rule.activa&&rule.nombre.startsWith(visual?'QA vencimiento visual':'QA vencimiento representante'));
 const cases=await db.alertaGenerada.findMany({where:{reglaId:rule.id}});assert.equal(cases.length,9);
 const sourceFacts=new Map(cases.map((item:any)=>[item.id,item.datos]));
 for(const item of records){
  const inspection=await db.inspeccion.findUniqueOrThrow({where:{id:item.inspectionId}});assert.match(inspection.numero,/^QA-DEADLINE-(?:REP|VISUAL)-/);
  const exchanges=await db.intercambioInspeccion.findMany({where:{inspeccionId:item.inspectionId},orderBy:{secuencia:'asc'}});
  assert.deepEqual(exchanges.map((entry:any)=>entry.tipo),['REQUERIMIENTO','RESPUESTA']);
  const notices=await db.notificacion.findMany({where:{datos:{contains:item.caseId}}});assert.equal(notices.length,2);
  const rep=notices.find((notice:any)=>notice.usuarioId===fixture.memberId);assert.ok(rep);
  assert.equal(JSON.parse(rep.datos).tipo,'psip_vencimiento_empresa');assert.ok(!JSON.stringify(rep).includes(inspection.numero));
 }
 const rules=db.reglaAlerta,requests=db.intercambioInspeccion,findRules=rules.findMany.bind(rules),findRequests=requests.findMany.bind(requests);
 rules.findMany=(args:any)=>findRules({...args,where:{AND:[args.where,{id:rule.id}]}});
 requests.findMany=(args:any)=>findRequests({...args,where:{AND:[args.where,{id:{in:records.map(r=>r.requirementId)}}]}});
 assert.equal(await ejecutarCatalogo(new Date()),0);
 const resolved=await db.alertaGenerada.findMany({where:{reglaId:rule.id}});assert.equal(resolved.length,9);
 assert.ok(resolved.every((item:any)=>item.estado==='RESUELTA'&&item.datos===sourceFacts.get(item.id)&&item.notas.includes('No certifica subsanación')));
 assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
 await db.reglaAlerta.update({where:{id:rule.id},data:{activa:false}});
 writeFileSync(path.join(out,visual?'audit-visual-2.json':'audit.json'),JSON.stringify({synthetic:true,production:false,roles:['GENERADOR','TRANSPORTISTA','OPERADOR'],
  cases:9,responses:9,resolvedAfterRecheck:9,duplicateNotices:0,capClosed:true,emailAttempts:0,emailSent:0,pushEnabled:false,qaRuleDeactivated:true},null,2),{flag:'wx',mode:0o600});
 console.log('PASS auditoría: nueve respuestas, nueve alertas resueltas, sin duplicados ni correo.');
}finally{await db.$disconnect();}
