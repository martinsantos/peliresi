import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase,backendRequire,root } from './safety.ts';
await assertCloudDatabase();
const out='/work/sitrep/.qa-inspection-deadline-company-20261030';
assert.equal(process.env.QA_ARTIFACTS,out);assert.equal(process.env.QA_COMPAT_BACKEND,'inspection-deadline-company-after');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.ACTOR_MULTIROLE_ENABLED,'true');assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const original=JSON.parse(readFileSync('/work/sitrep/.qa-product-ux-20261023/multirol-draft-20261024/multirol-fixture.json','utf8'));
assert.equal(original.email,'draft-multirole-20261024@night-qa.invalid');
const dist=path.join(root,'backend/dist-qa-psip-deadline-company-20261030-v3');
const db=backendRequire(path.join(dist,'lib/prisma.js')).default,{ejecutarCatalogo}=backendRequire(path.join(dist,'jobs/alertCatalogue.job.js'));
const {buildInspectionExchangeDigests}=backendRequire(path.join(dist,'services/inspectionExchange.service.js'));
let rule:any,done=false;
try{
 const user=await db.usuario.findUniqueOrThrow({where:{id:original.userId}}),actor=await db.operador.findUniqueOrThrow({where:{id:original.actors.OPERADOR}});
 const admin=await db.usuario.findUniqueOrThrow({where:{email:'admin@night-qa.invalid'}});
 assert.equal(user.email,original.email);assert.equal(user.rol,'GENERADOR');assert.ok(user.activo&&user.emailVerified&&actor.activo&&actor.usuarioId===user.id);
 const now=new Date(),records:any[]=[];
 for(const surface of ['web-desktop','app']){
  const id=randomUUID(),inspection=await db.inspeccion.create({data:{numero:'QA-DEADLINE-MULTI-'+id,tipoActor:'OPERADOR',operadorId:actor.id,
   inspectorId:admin.id,estado:'NOTIFICADA',observaciones:'QA actividad secundaria aprobada.'}});
  const createdAt=new Date(now.getTime()-7_200_000),deadline=new Date(now.getTime()-3_600_000);
  const fields={inspeccionId:inspection.id,secuencia:1,tipo:'REQUERIMIENTO',parte:'AUTORIDAD',destinatario:'INSPECCIONADO',
   asunto:'QA vencimiento multirrol',cuerpo:'QA artificial para verificar la actividad correcta.',plazoRespuestaAt:deadline,
   canal:'PORTAL_SITREP',versionExpediente:2,autorId:admin.id,createdAt};
  const entry=await db.intercambioInspeccion.create({data:{...fields,...buildInspectionExchangeDigests({...fields,adjuntos:[]},null),hashAnterior:null}});
  await db.inspeccion.update({where:{id:inspection.id},data:{version:2}});
  records.push({surface,inspectionId:inspection.id,requirementId:entry.id});
 }
 rule=await db.reglaAlerta.create({data:{nombre:'QA vencimiento multirrol '+randomUUID(),descripcion:'Regla artificial de actividad secundaria.',
  evento:'TIEMPO_EXCESIVO',condicion:'{"tipo":"requerimiento_inspeccion"}',destinatarios:'["INSPECCIONADO"]',activa:true,creadoPorId:admin.id}});
 const rules=db.reglaAlerta,requests=db.intercambioInspeccion,findRules=rules.findMany.bind(rules),findRequests=requests.findMany.bind(requests);
 rules.findMany=(args:any)=>findRules({...args,where:{AND:[args.where,{id:rule.id}]}});
 requests.findMany=(args:any)=>findRequests({...args,where:{AND:[args.where,{id:{in:records.map(r=>r.requirementId)}}]}});
 await ejecutarCatalogo(now);
 const cases=await db.alertaGenerada.findMany({where:{reglaId:rule.id}});assert.equal(cases.length,2);
 for(const item of records){
  const alert=cases.find((c:any)=>JSON.parse(c.datos).entidadId===item.requirementId);assert.ok(alert);
  const notices=await db.notificacion.findMany({where:{usuarioId:user.id,datos:{contains:alert.id}}});assert.equal(notices.length,1);
  const data=JSON.parse(notices[0].datos);assert.equal(data.tipoActor,'OPERADOR');assert.equal(data.destino,'participacion');
  item.caseId=alert.id;item.noticeId=notices[0].id;item.title=notices[0].titulo;
 }
 writeFileSync(path.join(out,'fixture-multirole.json'),JSON.stringify({synthetic:true,email:user.email,ruleId:rule.id,
  cases:Object.fromEntries(records.map(item=>[item.surface,item]))},null,2),{flag:'wx',mode:0o600});
 done=true;console.log('Preparados dos vencimientos de actividad secundaria artificial.');
}finally{if(rule&&!done)await db.reglaAlerta.update({where:{id:rule.id},data:{activa:false}});await db.$disconnect();}
