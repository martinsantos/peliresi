
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
const out=process.env.QA_ARTIFACTS!, file=out+'/company-certificates-http.json';
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
 const treatment=await db.tratamientoAutorizado.findFirstOrThrow({where:{operadorId:operator.id,activo:true}});
 const vehicle=await db.vehiculo.findFirstOrThrow({where:{transportistaId:carrier.id,activo:true,vencimiento:{gt:new Date()}}});
 const driver=await db.chofer.findFirstOrThrow({where:{transportistaId:carrier.id,activo:true,vencimiento:{gt:new Date()}}});
 const waste=await db.tipoResiduo.findFirstOrThrow({where:{codigo:'Y1'}});
 const sharp=backendRequire('sharp');
 const signature='data:image/png;base64,'+(await sharp(Buffer.from('<svg width="300" height="100"><rect width="300" height="100" fill="white"/><path d="M10 70 L40 20 L80 75 L120 15 L180 80 L270 30" stroke="black" stroke-width="3" fill="none"/></svg>')).png().toBuffer()).toString('base64');
 const baseline=await db.manifiesto.findMany({where:{id:{notIn:report.manifest?[report.manifest.id]:[]}},orderBy:{id:'asc'},include:{residuos:{orderBy:{id:'asc'}}}});
 const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 const before=hash(baseline);
 if(!report.manifest){
  const m=(await call(fixture.owner,'/manifiestos','POST',{id:randomUUID(),generadorId:activity.actorId,transportistaId:carrier.id,operadorId:operator.id,modalidad:'FIJO',vehiculoId:vehicle.id,choferId:driver.id,fechaEstimadaRetiro:'2099-12-25',observaciones:'QA UX 20261026 · certificados representantes · datos artificiales',residuos:[{tipoResiduoId:waste.id,cantidad:10,unidad:'kg'}]},headers,201)).manifiesto;
  report.manifest={id:m.id,numero:m.numero};save();
  await db.manifiesto.update({where:{id:m.id},data:{isDemoData:true}});
 }
 const id=report.manifest.id;
 const m=await db.manifiesto.findUniqueOrThrow({where:{id},include:{residuos:true}});
 assert.match(m.observaciones,/^QA UX 20261026 · certificados representantes/);
 if(m.estado==='PENDIENTE_APROBACION'){
  await call(fixture.owner,'/manifiestos/'+id+'/firmar','POST',{firma:signature},headers);
  await call('transportista@night-qa.invalid','/manifiestos/'+id+'/aprobar-parte','POST',{});
  await call('operador@night-qa.invalid','/manifiestos/'+id+'/aprobar-parte','POST',{});
  await call(fixture.owner,'/manifiestos/'+id+'/iniciar-coordinacion','POST',{},headers);
  await call('transportista@night-qa.invalid','/manifiestos/'+id+'/confirmar-retiro','POST',{});
  await call('transportista@night-qa.invalid','/manifiestos/'+id+'/confirmar-entrega','POST',{});
  await call('operador@night-qa.invalid','/manifiestos/'+id+'/confirmar-recepcion','POST',{});
 }
 if(!report.certificate){
  const loaded=(await call('operador@night-qa.invalid','/manifiestos/'+id)).manifiesto;
  const residue=loaded.residuos[0];
  await call('operador@night-qa.invalid','/manifiestos/'+id+'/pesaje','POST',{residuos:[{id:residue.id,cantidadRecibida:10}]});
  if(loaded.estado==='RECIBIDO')await call('operador@night-qa.invalid','/manifiestos/'+id+'/tratamiento','POST',{metodo:treatment.metodo});
  const command={id:randomUUID(),tipo:'PARCIAL',firma:signature,metodo:treatment.metodo,cantidades:[{residuoId:residue.id,cantidad:4}]};
  report.certificate=await call('operador@night-qa.invalid','/manifiestos/'+id+'/certificados','POST',command,{},201);save();
  const replay=await call('operador@night-qa.invalid','/manifiestos/'+id+'/certificados','POST',command);assert.equal(replay.id,report.certificate.id);assert.equal(replay.replayed,true);
 }
 const notices=await db.notificacion.findMany({where:{manifiestoId:id,datos:{contains:'certificado_manifiesto'}}});
 assert.equal(new Set(notices.map((n:any)=>n.usuarioId)).size,notices.length);
 const notice=notices.find((n:any)=>n.usuarioId===member.id);assert.ok(notice);
 const data=JSON.parse(notice.datos);assert.equal(data.documentoId,report.certificate.id);assert.equal(data.accesosEmpresa.length,1);assert.equal(data.accesosEmpresa[0].actividadId,activity.id);
 const received=await call(fixture.member,'/notificaciones/'+notice.id);assert.equal(received.id,notice.id);
 const profile=await call(fixture.member,'/auth/profile','GET',undefined,headers);assert.equal(profile.user.empresaContexto.actividadId,activity.id);
 const docs=await call(fixture.member,'/manifiestos/'+id+'/certificados','GET',undefined,headers);assert.ok(docs.some((d:any)=>d.id===report.certificate.id));
 const pdf=await fetch(base+'/manifiestos/'+id+'/certificados/'+report.certificate.id+'/archivo',{headers:{Authorization:'Bearer '+await token(fixture.member),...headers}});
 assert.equal(pdf.status,200);const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(bytes.subarray(0,4).toString(),'%PDF');assert.equal(createHash('sha256').update(bytes).digest('hex'),report.certificate.pdfSha256);
 await call('generador2@night-qa.invalid','/notificaciones/'+notice.id,'GET',undefined,{},404);
 await call('generador2@night-qa.invalid','/manifiestos/'+id+'/certificados','GET',undefined,{},404);
 const {manifestCompanyRecipients}=backendRequire('./dist/services/manifestCompanyRecipients.service.js');
 const rollback=new Error('QA rollback only');
 for(const reason of ['revoked','wrong-site']){
  try{await db.$transaction(async(tx:any)=>{
   await tx.autorizacionEmpresa.update({where:{actividadId_usuarioId:{actividadId:activity.id,usuarioId:member.id}},data:reason==='revoked'?{activa:false}:{todosEstablecimientos:false,establecimientoIds:['nonexistent-qa-site']}});
   assert.ok(!(await manifestCompanyRecipients(tx,id)).some((p:any)=>p.usuarioId===member.id));throw rollback;
  });}catch(e){if(e!==rollback)throw e;}
 }
 assert.equal(before,hash(await db.manifiesto.findMany({where:{id:{in:baseline.map((m:any)=>m.id)}},orderBy:{id:'asc'},include:{residuos:{orderBy:{id:'asc'}}}})));
 report.member=fixture.member;report.company=fixture.companyId;report.headers=headers;report.notice=notice.id;
 report.checks=['alta aprobada y representación existente','creación y tres aprobaciones por API','recepción, pesaje y certificado parcial por operador','reintento sin duplicación','aviso único al representante','contexto confirmado por API','PDF idéntico por SHA-256','otra cuenta: 404 aviso y certificado','revocación y otra sede excluidas dentro de transacciones revertidas','manifiestos previos intactos'];
 report.complete=true;save();console.log(JSON.stringify(report));
}finally{await db.$disconnect();}
