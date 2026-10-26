
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
const out=process.env.QA_ARTIFACTS!, file=out+'/company-workflow-notices.json';
const fixture=JSON.parse(readFileSync(out+'/onboarding-ux-fixture.json','utf8'));
assert.match(fixture.owner,/@night-qa.invalid$/);assert.match(fixture.member,/@night-qa.invalid$/);
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
const base='http://127.0.0.1:3037/api',tokens=new Map<string,string>();
const report:any=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{checks:[]};
const save=()=>writeFileSync(file,JSON.stringify({...report,at:new Date().toISOString()},null,2));
async function token(email:string) {
 if(!tokens.has(email)){const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'OnlyLocal-NightQA-2026!'})});const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));tokens.set(email,b.data.tokens.accessToken);}return tokens.get(email)!;
}
async function call(email:string,path:string,method='GET',body?:unknown,headers={},status=200){
 const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+await token(email),'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const b=await r.json();assert.equal(r.status,status,path+': '+JSON.stringify(b));return b.data;
}
try {
 const activity=await db.empresaActividad.findFirstOrThrow({where:{empresaId:fixture.companyId,rol:'GENERADOR',activa:true}});
 let site=await db.establecimientoEmpresa.findFirst({where:{empresaId:fixture.companyId,activo:true}});
 if(!site){await call(fixture.owner,'/empresas/'+fixture.companyId+'/establecimientos','POST',{codigo:'QA-CERT-NORTE',nombre:'QA Certificados Norte',domicilio:'Domicilio artificial QA',certificados:[]},{},201);site=await db.establecimientoEmpresa.findFirstOrThrow({where:{empresaId:fixture.companyId,activo:true}});}
 const headers={'X-SITREP-Empresa':fixture.companyId,'X-SITREP-Empresa-Actividad':activity.id,'X-SITREP-Establecimiento':site.id};
 const member=await db.usuario.findUniqueOrThrow({where:{email:fixture.member}});
 const carrier=await db.transportista.findFirstOrThrow({where:{usuario:{email:'transportista@night-qa.invalid'}}});
 const operator=await db.operador.findFirstOrThrow({where:{usuario:{email:'operador@night-qa.invalid'}}});
 const vehicle=await db.vehiculo.findFirstOrThrow({where:{transportistaId:carrier.id,activo:true,vencimiento:{gt:new Date()}}});
 const driver=await db.chofer.findFirstOrThrow({where:{transportistaId:carrier.id,activo:true,vencimiento:{gt:new Date()}}});
 const waste=await db.tipoResiduo.findFirstOrThrow({where:{codigo:'Y1'}});
 const sharp=backendRequire('sharp');
 const signature='data:image/png;base64,'+(await sharp(Buffer.from('<svg width="300" height="100"><rect width="300" height="100" fill="white"/><path d="M10 70 L40 20 L80 75 L120 15 L180 80 L270 30" stroke="black" stroke-width="3" fill="none"/></svg>')).png().toBuffer()).toString('base64');
 const baseline=await db.manifiesto.findMany({where:{id:{notIn:report.manifest?[report.manifest.id]:[]}},orderBy:{id:'asc'},include:{residuos:{orderBy:{id:'asc'}}}});
 const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 const before=hash(baseline);
 if(!report.manifest){
  const m=(await call(fixture.owner,'/manifiestos','POST',{id:randomUUID(),generadorId:activity.actorId,transportistaId:carrier.id,operadorId:operator.id,modalidad:'FIJO',vehiculoId:vehicle.id,choferId:driver.id,fechaEstimadaRetiro:'2099-12-25',observaciones:'QA UX 20261026 · propuestas adendas representantes · datos artificiales',residuos:[{tipoResiduoId:waste.id,cantidad:10,unidad:'kg'}]},headers,201)).manifiesto;
  report.manifest={id:m.id,numero:m.numero};save();
  await db.manifiesto.update({where:{id:m.id},data:{isDemoData:true}});
 }
 const id=report.manifest.id;
 const m=await db.manifiesto.findUniqueOrThrow({where:{id},include:{residuos:true}});
 assert.match(m.observaciones,/^QA UX 20261026 · propuestas adendas representantes/);

 const partyNotices=await db.notificacion.findMany({where:{manifiestoId:id,usuarioId:member.id,datos:{contains:'propuesta_partes'}}});
 const creation=partyNotices.find((n:any)=>JSON.parse(n.datos).fase==='creada');
 assert.ok(creation);assert.equal(creation.titulo,'Manifiesto pendiente de tu aprobación');
 assert.equal(JSON.parse(creation.datos).accesosEmpresa[0].actividadId,activity.id);
 report.proposalNotice=creation.id;
 if(process.env.QA_WORKFLOW_MODE!=='prepare'){
  if(m.estado==='PENDIENTE_APROBACION'){
   await call(fixture.owner,'/manifiestos/'+id+'/firmar','POST',{firma:signature},headers);
   await call('transportista@night-qa.invalid','/manifiestos/'+id+'/aprobar-parte','POST',{});
   await call('operador@night-qa.invalid','/manifiestos/'+id+'/aprobar-parte','POST',{});
   await call(fixture.owner,'/manifiestos/'+id+'/iniciar-coordinacion','POST',{},headers);
   await call('transportista@night-qa.invalid','/manifiestos/'+id+'/confirmar-retiro','POST',{});
   await call('transportista@night-qa.invalid','/manifiestos/'+id+'/confirmar-entrega','POST',{});
   await call('operador@night-qa.invalid','/manifiestos/'+id+'/confirmar-recepcion','POST',{});
  }
  if(!report.adenda){
   const loaded=(await call('operador@night-qa.invalid','/manifiestos/'+id)).manifiesto;
   await call('operador@night-qa.invalid','/manifiestos/'+id+'/pesaje','POST',{residuos:[{id:loaded.residuos[0].id,cantidadRecibida:11}]});
   report.adenda=(await call('operador@night-qa.invalid','/manifiestos/'+id+'/adendas','POST',{id:randomUUID(),motivo:'QA hallazgo de representante: 11 kg recibidos frente a 10 declarados',residuos:[{corriente:'Y1',cantidad:11,unidad:'kg'}]},{},201)).adenda.id;save();
  }
  const notices=await db.notificacion.findMany({where:{manifiestoId:id,usuarioId:member.id}});
  const phases=notices.filter((n:any)=>JSON.parse(n.datos).tipo==='propuesta_partes').map((n:any)=>JSON.parse(n.datos).fase);
  for(const phase of ['creada','aprobacion-GENERADOR','aprobacion-TRANSPORTISTA','aprobada','iniciada'])assert.ok(phases.includes(phase),phase);
  const notice=notices.find((n:any)=>{const d=JSON.parse(n.datos);return d.adendaId===report.adenda&&d.evento==='CREADA';});assert.ok(notice);
  const d=JSON.parse(notice.datos);assert.equal(d.accesosEmpresa[0].actividadId,activity.id);assert.equal(d.url,'/manifiestos/'+id+'/adendas?adenda='+report.adenda);
  await call(fixture.member,'/notificaciones/'+notice.id);
  await call('generador2@night-qa.invalid','/notificaciones/'+notice.id,'GET',undefined,{},404);
  const detail=await call(fixture.member,'/manifiestos/'+id+'/adendas?adenda='+report.adenda,'GET',undefined,headers);
  assert.equal(detail.adendas[0].id,report.adenda);assert.equal(detail.adendas[0].puedeResolver,true);
  report.adendaNotice=notice.id;report.proposalPhases=phases;
  if(process.env.QA_WORKFLOW_MODE==='verify'){
   const row=await db.adendaManifiesto.findUniqueOrThrow({where:{id:report.adenda}});
   const last=row.revisiones.at(-1);assert.equal(last.autorId,member.id);assert.equal(last.decision,'OBSERVADA');
   const cross=await db.notificacion.findMany({where:{manifiestoId:id,datos:{contains:'adenda_manifiesto'}}});
   const observed=cross.filter((n:any)=>JSON.parse(n.datos).evento==='OBSERVADA');
   assert.equal(observed.length,3);assert.ok(observed.every((n:any)=>JSON.parse(n.datos).autorRol==='Generador'));
   assert.ok(observed.every((n:any)=>n.usuarioId!==member.id));assert.equal(new Set(observed.map((n:any)=>n.usuarioId)).size,3);
   report.observedByRepresentative=true;report.observationRecipients=observed.map((n:any)=>n.usuarioId);
   report.observedNotice=observed.find((n:any)=>n.usuarioId===operator.usuarioId)?.id;
  }
 }
 assert.equal(before,hash(await db.manifiesto.findMany({where:{id:{in:baseline.map((m:any)=>m.id)}},orderBy:{id:'asc'},include:{residuos:{orderBy:{id:'asc'}}}})));

 report.member=fixture.member;report.company=fixture.companyId;report.headers=headers;
 report.mode=process.env.QA_WORKFLOW_MODE;report.complete=report.observedByRepresentative===true;
 report.checks=['propuesta avisa al representante con destino y título correctos',...(report.adenda?['tres aprobaciones y coordinación notificadas','adenda creada con aviso al representante','enlace a adenda exacta','representante puede revisar','otra cuenta recibe 404']:[]),...(report.observedByRepresentative?['observación registrada por representante','tres contrapartes avisadas sin autoaviso','actividad autora Generador, no revisor designado']:[]),'manifiestos previos intactos'];
 save();console.log(JSON.stringify(report));
}finally{await db.$disconnect();}
