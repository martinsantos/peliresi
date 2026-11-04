import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase,backendRequire,root } from './safety.ts';
await assertCloudDatabase();
const out='/work/sitrep/.qa-inspection-deadline-company-20261030';
assert.equal(process.env.QA_ARTIFACTS,out);assert.equal(process.env.QA_COMPAT_BACKEND,'inspection-deadline-company-after');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.ENTERPRISE_ENABLED,'true');assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const prior=JSON.parse(readFileSync(path.join(out,'fixture.json'),'utf8')),old=JSON.parse(readFileSync(path.join(out,'fixture-before1.json'),'utf8'));
assert.match(prior.email,/@night-qa\.invalid$/);
const dist=path.join(root,'backend/dist-qa-psip-deadline-company-20261030-v2');
const db=backendRequire(path.join(dist,'lib/prisma.js')).default,{ejecutarCatalogo}=backendRequire(path.join(dist,'jobs/alertCatalogue.job.js'));
const {buildInspectionExchangeDigests}=backendRequire(path.join(dist,'services/inspectionExchange.service.js'));
let rule:any,done=false;
try{
 const now=new Date(),records:any[]=[];
 for(const surface of ['web-desktop','web-responsive','app'])for(const template of prior.cases['web-desktop']){
  const activity=await db.empresaActividad.findUniqueOrThrow({where:{id:template.activityId}}),company=await db.empresa.findUniqueOrThrow({where:{id:template.companyId}});
  assert.match(company.razonSocial,/^QA Empresa /);assert.ok(activity.activa&&activity.rol===template.role);
  const key=template.role.toLowerCase() as 'generador'|'transportista'|'operador',actor=await db[key].findUniqueOrThrow({where:{id:activity.actorId}});
  assert.match(actor.email,/@night-qa\.invalid$/);
  const id=randomUUID(),inspection=await db.inspeccion.create({data:{numero:'QA-DEADLINE-VISUAL-'+id,tipoActor:template.role,
   [`${key}Id`]:actor.id,inspectorId:old.adminId,estado:'NOTIFICADA',observaciones:'QA visual de requerimiento vencido.'}});
  const createdAt=new Date(now.getTime()-7_200_000),deadline=new Date(now.getTime()-3_600_000);
  const fields={inspeccionId:inspection.id,secuencia:1,tipo:'REQUERIMIENTO',parte:'AUTORIDAD',destinatario:'INSPECCIONADO',
   asunto:'QA requerimiento vencido',cuerpo:'QA aviso artificial para comprobar la pantalla ya cargada.',plazoRespuestaAt:deadline,
   canal:'PORTAL_SITREP',versionExpediente:2,autorId:old.adminId,createdAt};
  const entry=await db.intercambioInspeccion.create({data:{...fields,...buildInspectionExchangeDigests({...fields,adjuntos:[]},null),hashAnterior:null}});
  await db.inspeccion.update({where:{id:inspection.id},data:{version:2}});
  records.push({surface,role:template.role,inspectionId:inspection.id,requirementId:entry.id,companyId:company.id,activityId:activity.id,ownerId:actor.usuarioId});
 }
 rule=await db.reglaAlerta.create({data:{nombre:'QA vencimiento visual '+randomUUID(),descripcion:'Regla sintética para captura visual.',
  evento:'TIEMPO_EXCESIVO',condicion:'{"tipo":"requerimiento_inspeccion"}',destinatarios:'["INSPECCIONADO"]',activa:true,creadoPorId:old.adminId}});
 const rules=db.reglaAlerta,requests=db.intercambioInspeccion,findRules=rules.findMany.bind(rules),findRequests=requests.findMany.bind(requests);
 rules.findMany=(args:any)=>findRules({...args,where:{AND:[args.where,{id:rule.id}]}});
 requests.findMany=(args:any)=>findRequests({...args,where:{AND:[args.where,{id:{in:records.map(r=>r.requirementId)}}]}});
 assert.equal(await ejecutarCatalogo(now),18);
 const cases=await db.alertaGenerada.findMany({where:{reglaId:rule.id}});assert.equal(cases.length,9);
 for(const item of records){
  const found=cases.find((c:any)=>JSON.parse(c.datos).entidadId===item.requirementId);assert.ok(found);
  const rows=await db.notificacion.findMany({where:{datos:{contains:found.id}}});
  assert.deepEqual(rows.map((n:any)=>n.usuarioId).sort(),[item.ownerId,prior.memberId].sort());
  item.caseId=found.id;item.noticeId=rows.find((n:any)=>n.usuarioId===prior.memberId).id;
 }
 const groups=Object.fromEntries(['web-desktop','web-responsive','app'].map(surface=>[surface,records.filter(r=>r.surface===surface)]));
 writeFileSync(path.join(out,'fixture-visual.json'),JSON.stringify({synthetic:true,email:prior.email,memberId:prior.memberId,ruleId:rule.id,cases:groups},null,2),{flag:'wx',mode:0o600});
 done=true;console.log('Preparados nueve casos artificiales nuevos para capturas después de cargar.');
}finally{if(rule&&!done)await db.reglaAlerta.update({where:{id:rule.id},data:{activa:false}});await db.$disconnect();}
