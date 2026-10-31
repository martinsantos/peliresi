import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out=process.env.QA_ARTIFACTS!;
assert.ok(['/work/sitrep/.qa-certificate-receipt-ux-20261030','/work/sitrep/.qa-certificate-layout-20261030','/work/sitrep/.qa-actor-overview-20261031'].includes(out));
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS,'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
const attempt=process.env.QA_CASE_ATTEMPT||'initial';assert.match(attempt,/^[a-z0-9-]+$/);
const fixture=path.join(out,'certificate-receipt-fixture'+(attempt==='initial'?'':'-'+attempt)+'.json');
try {
 if(process.argv[2]==='prepare') {
  assert.equal(existsSync(fixture),false,'No repetir la preparación de los mismos casos');
  const [g,t,o,waste]=await Promise.all([
   db.usuario.findUniqueOrThrow({where:{email:'generador@night-qa.invalid'},include:{generador:true}}),
   db.usuario.findUniqueOrThrow({where:{email:'transportista@night-qa.invalid'},include:{transportista:true}}),
   db.usuario.findUniqueOrThrow({where:{email:'operador@night-qa.invalid'},include:{operador:true}}),
   db.tipoResiduo.findFirstOrThrow({where:{codigo:'Y1'}}),
  ]);
  for(const actor of [g.generador,t.transportista,o.operador]){assert.ok(actor);assert.match(actor.razonSocial,/^QA /);}
  for(const user of [g,t,o])assert.equal(user.activo,true);
  const cases:Record<string,{id:string;numero:string}>={};
  const surfaces=process.env.QA_SURFACE==='app'?['app']:['web-desktop','app'];
  for(const surface of surfaces) {
   const numero='QA-RECIBO-'+surface+'-'+randomUUID().slice(0,8);
   const m=await db.manifiesto.create({data:{numero,estado:'TRATADO',generadorId:g.generador.id,transportistaId:t.transportista.id,operadorId:o.operador.id,creadoPorId:o.id,isDemoData:true,modalidad:'FIJO',tratamientoMetodo:'QA tratamiento artificial',fechaCierre:new Date(),residuos:{create:[{tipoResiduoId:waste.id,cantidad:10,cantidadRecibida:10,unidad:'kg',estado:'SOLIDO'}]},eventos:{create:{tipo:'CERTIFICACION_OPERADOR_V1',descripcion:'QA',usuarioId:o.id}}},select:{id:true,numero:true}});
   cases[surface]=m;
  }
  writeFileSync(fixture,JSON.stringify({synthetic:true,cases,parties:[g.id,t.id]}),{flag:'wx',mode:0o600});
  console.log(surfaces.length+' manifiesto(s) artificial(es) preparados para el recibo.');
 } else if(process.argv[2]==='status') {
  const f=JSON.parse(readFileSync(fixture,'utf8'));assert.equal(f.synthetic,true);
  for(const [surface,item] of Object.entries(f.cases) as [string,{id:string}][]) {
   const m=await db.manifiesto.findUniqueOrThrow({where:{id:item.id},select:{isDemoData:true,numero:true}});assert.equal(m.isDemoData,true);assert.match(m.numero,/^QA-RECIBO-/);
   console.log(JSON.stringify({surface,certificates:await db.certificadoManifiesto.count({where:{manifiestoId:item.id}})}));
  }
 } else if(process.argv[2]==='audit') {
  const f=JSON.parse(readFileSync(fixture,'utf8'));assert.equal(f.synthetic,true);
  const results=[];
  for(const [surface,item] of Object.entries(f.cases) as [string,{id:string;numero:string}][]) {
   const manifest=await db.manifiesto.findUniqueOrThrow({where:{id:item.id},select:{isDemoData:true,numero:true}});
   assert.equal(manifest.isDemoData,true);assert.match(manifest.numero,/^QA-RECIBO-/);
   const docs=await db.certificadoManifiesto.findMany({where:{manifiestoId:item.id}});
   assert.equal(docs.length,1);assert.equal(docs[0].tipo,'PARCIAL');
   const events=await db.eventoManifiesto.findMany({where:{manifiestoId:item.id,tipo:'CERTIFICADO_OPERADOR_V1'}});assert.equal(events.length,1);
   const notices=await db.notificacion.findMany({where:{manifiestoId:item.id,datos:{contains:docs[0].id}}});
   for(const party of f.parties)assert.equal(notices.filter((n:any)=>n.usuarioId===party).length,1);
   results.push({surface,certificateId:docs[0].id,documents:docs.length,events:events.length,noticesForParties:2});
  }
  assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
  assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
  const processes=JSON.parse(readFileSync(out+'/processes.json','utf8'));
  for(const item of processes){const env=Object.fromEntries(readFileSync('/proc/'+item.pid+'/environ','utf8').split('\0').filter(Boolean).map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));assertCloudEnvironment(env);assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'),'proposal_operations_20261021');assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED,'false');assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');}
  writeFileSync(path.join(out,'audit-'+attempt+'.json'),JSON.stringify({synthetic:true,results,emailAttempts:0,emailSent:0,capClosed:true,push:false}),{flag:'wx',mode:0o600});
  console.log('Auditoría artificial: un certificado y un aviso por contraparte en cada superficie; cero correos enviados.');
 } else throw Error('Fase de QA desconocida');
} finally {await db.$disconnect();}
