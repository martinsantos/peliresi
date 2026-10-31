import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out=process.env.QA_ARTIFACTS!;
assert.equal(out,'/work/sitrep/.qa-actor-overview-20261031');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
const fixture=JSON.parse(readFileSync(path.join(out,'fixture.json'),'utf8'));assert.equal(fixture.synthetic,true);
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
try {
 const cases=[];
 for(const surface of ['web-desktop','app']){
  const proof=JSON.parse(readFileSync(path.join(out,'manifest-complete','proposal-lifecycle-complet-a3ca0-ox-updates-transport-starts-'+surface,'complete-lifecycle.json'),'utf8'));
  assert.equal(proof.creator,'operador');assert.equal(proof.actualRoles,true);assert.equal(proof.samePdfAcrossParties,true);
  const manifest=await db.manifiesto.findUniqueOrThrow({where:{id:proof.id},include:{generador:{include:{usuario:true}},transportista:{include:{usuario:true}},operador:{include:{usuario:true}}}});
  assert.equal(manifest.isDemoData,true);assert.equal(manifest.estado,'TRATADO');assert.equal(manifest.numero,proof.numero);
  for(const actor of [manifest.generador,manifest.transportista,manifest.operador]){
   assert.ok(actor);assert.match(actor.razonSocial,/^QA /);assert.match(actor.usuario.email,/@night-qa\.invalid$/);
  }
  const events=await db.eventoManifiesto.findMany({where:{manifiestoId:manifest.id,tipo:{in:['FIRMA','APROBACION_TRANSPORTISTA','APROBACION_OPERADOR']}}});
  for(const type of ['FIRMA','APROBACION_TRANSPORTISTA','APROBACION_OPERADOR'])assert.equal(events.filter((event:any)=>event.tipo===type).length,1);
  const documents=await db.certificadoManifiesto.findMany({where:{manifiestoId:manifest.id}});
  assert.equal(documents.length,2);
  for(const expected of proof.certificates){
   const document=documents.find((item:any)=>item.id===expected.id&&item.tipo===expected.tipo);
   assert.ok(document);assert.equal(document.pdfSha256,expected.sha256);
   assert.equal(createHash('sha256').update(document.pdf).digest('hex'),expected.sha256);
   const notices=await db.notificacion.findMany({where:{manifiestoId:manifest.id,datos:{contains:document.id}},select:{usuarioId:true}});
   for(const recipient of [manifest.generador.usuarioId,manifest.transportista.usuarioId])assert.equal(notices.filter((n:any)=>n.usuarioId===recipient).length,1);
  }
  cases.push({surface,approvals:3,certificates:2,noticesPerCertificate:2,pdfHashesMatch:true});
 }
 assert.equal(await db.manifiesto.count(),fixture.before.manifests+2);
 assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
 assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
 const processes=JSON.parse(readFileSync(path.join(out,'processes.json'),'utf8'));
 for(const item of processes){
  const env=Object.fromEntries(readFileSync('/proc/'+item.pid+'/environ','utf8').split('\0').filter(Boolean).map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
  assertCloudEnvironment(env);assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'),'proposal_operations_20261021');
  assert.equal(env.TRAINING_DATABASE_URL,'');assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED,'false');assert.equal(env.MANIFEST_PROPOSALS_ENABLED,'true');
 }
 writeFileSync(path.join(out,'lifecycle-audit.json'),JSON.stringify({synthetic:true,cases,emailsSent:0,emailAttempts:0,push:false,capClosed:true}),{flag:'wx',mode:0o600});
 console.log('Cotejo artificial: tres aprobaciones, dos certificados y avisos por contraparte en web y app.');
}finally{await db.$disconnect();}
