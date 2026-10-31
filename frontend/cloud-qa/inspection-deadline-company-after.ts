import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';

await assertCloudDatabase();
const out='/work/sitrep/.qa-inspection-deadline-company-20261030';
assert.equal(process.env.QA_ARTIFACTS,out);assert.equal(process.env.QA_COMPAT_BACKEND,'inspection-deadline-company-after');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.ENTERPRISE_ENABLED,'true');assert.equal(process.env.DISABLE_EMAILS,'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
const before=JSON.parse(readFileSync(path.join(out,'reproduction-before1.json'),'utf8'));
const original=JSON.parse(readFileSync(path.join(out,'fixture-before1.json'),'utf8'));
assert.equal(before.representativeNotices,0);assert.match(original.email,/@night-qa\.invalid$/);
const dist=path.join(root,'backend/dist-qa-psip-deadline-company-20261030');
const db=backendRequire(path.join(dist,'lib/prisma.js')).default;
const {buildInspectionExchangeDigests}=backendRequire(path.join(dist,'services/inspectionExchange.service.js'));
const {ejecutarCatalogo}=backendRequire(path.join(dist,'jobs/alertCatalogue.job.js'));
let passed=false;
try{
 const rule=await db.reglaAlerta.findUniqueOrThrow({where:{id:before.ruleId}});
 assert.ok(!rule.activa&&rule.nombre.startsWith('QA vencimiento representante'));
 const now=new Date(), records:any[]=[];
 for(const item of before.records)records.push({...item,surface:'web-desktop'});
 for(const surface of ['web-responsive','app'])for(const item of before.records){
  const activity=await db.empresaActividad.findUniqueOrThrow({where:{id:item.activityId}}),company=await db.empresa.findUniqueOrThrow({where:{id:item.companyId}});
  assert.match(company.razonSocial,/^QA Empresa /);assert.ok(activity.activa&&activity.rol===item.role);
  const key=item.role.toLowerCase() as 'generador'|'transportista'|'operador';
  const actor=await db[key].findUniqueOrThrow({where:{id:activity.actorId}});assert.match(actor.email,/@night-qa\.invalid$/);
  const id=randomUUID(),inspection=await db.inspeccion.create({data:{numero:'QA-DEADLINE-REP-'+id,tipoActor:item.role,
   [`${key}Id`]:actor.id,inspectorId:original.adminId,estado:'NOTIFICADA',observaciones:'QA artificial: aviso de plazo vencido.'}});
  const createdAt=new Date(now.getTime()-7_200_000),deadline=new Date(now.getTime()-3_600_000);
  const fields={inspeccionId:inspection.id,secuencia:1,tipo:'REQUERIMIENTO',parte:'AUTORIDAD',destinatario:'INSPECCIONADO',
   asunto:'QA requerimiento vencido',cuerpo:'QA aviso artificial de plazo vencido.',plazoRespuestaAt:deadline,
   canal:'PORTAL_SITREP',versionExpediente:2,autorId:original.adminId,createdAt};
  const entry=await db.intercambioInspeccion.create({data:{...fields,...buildInspectionExchangeDigests({...fields,adjuntos:[]},null),hashAnterior:null}});
  await db.inspeccion.update({where:{id:inspection.id},data:{version:2}});
  records.push({surface,role:item.role,inspectionId:inspection.id,requirementId:entry.id,companyId:company.id,activityId:activity.id,ownerId:actor.usuarioId});
 }
 assert.equal(records.length,9);
 const ruleDelegate=db.reglaAlerta,requestDelegate=db.intercambioInspeccion;
 const findRules=ruleDelegate.findMany.bind(ruleDelegate),findRequests=requestDelegate.findMany.bind(requestDelegate);
 ruleDelegate.findMany=(args:any)=>findRules({...args,where:{AND:[args.where,{id:rule.id}]}});
 requestDelegate.findMany=(args:any)=>findRequests({...args,where:{AND:[args.where,{id:{in:records.map(r=>r.requirementId)}}]}});
 await db.reglaAlerta.update({where:{id:rule.id},data:{activa:true}});
 assert.equal((await ruleDelegate.findMany({where:{activa:true}})).length,1);
 assert.equal(await ejecutarCatalogo(now),18);
 const cases=await db.alertaGenerada.findMany({where:{reglaId:rule.id}});assert.equal(cases.length,9);
 for(const item of records){
  const found=cases.find((c:any)=>JSON.parse(c.datos).entidadId===item.requirementId);assert.ok(found);
  const rows=await db.notificacion.findMany({where:{datos:{contains:found.id}}});
  assert.deepEqual(rows.map((n:any)=>n.usuarioId).sort(),[item.ownerId,original.memberId].sort());
  const notice=rows.find((n:any)=>n.usuarioId===original.memberId),metadata=JSON.parse(notice.datos);
  assert.equal(metadata.tipo,'psip_vencimiento_empresa');assert.ok(!JSON.stringify(notice).includes(item.inspectionId));
  item.caseId=found.id;item.noticeId=notice.id;
 }
 await db.notificacion.update({where:{id:records[0].noticeId},data:{leida:true,fechaLeida:now}});
 assert.equal(await ejecutarCatalogo(new Date(now.getTime()+1000)),18);
 assert.equal(await db.alertaGenerada.count({where:{reglaId:rule.id}}),9);
 for(const item of records){
  const rows=await db.notificacion.findMany({where:{datos:{contains:item.caseId}}});assert.equal(rows.length,2);
 }
 assert.equal((await db.notificacion.findUniqueOrThrow({where:{id:records[0].noticeId}})).leida,true);
 assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
 const groups=Object.fromEntries(['web-desktop','web-responsive','app'].map(surface=>[surface,records.filter(r=>r.surface===surface)]));
 writeFileSync(path.join(out,'fixture.json'),JSON.stringify({synthetic:true,email:original.email,memberId:original.memberId,ruleId:rule.id,cases:groups},null,2),{flag:'wx',mode:0o600});
 writeFileSync(path.join(out,'job-proof.json'),JSON.stringify({synthetic:true,production:false,cases:9,owners:9,representatives:9,
  repeatedWithoutDuplicates:true,readStatePreserved:true,emailAttempts:0,emailSent:0},null,2),{flag:'wx',mode:0o600});
 passed=true;console.log('PASS barrido acotado: nueve titulares y nueve representantes, sin duplicados ni correos.');
}finally{
 if(!passed)await db.reglaAlerta.update({where:{id:before.ruleId},data:{activa:false}});
 await db.$disconnect();
}
