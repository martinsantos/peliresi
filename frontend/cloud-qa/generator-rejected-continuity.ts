import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { assertCloudDatabase, backendRequire } from './safety.ts';
import { syntheticCuit } from './synthetic-cuit.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const out = process.env.QA_ARTIFACTS!;
const file = out + '/generator-rejected-fixture.json';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const manifests = async () => digest(await db.manifiesto.findMany({orderBy:{id:'asc'}}));
const record = async (id: string) => db.solicitudInscripcion.findUniqueOrThrow({where:{id},include:{documentos:true,mensajes:true}});
async function api(route: string, token?: string, body?: unknown, expected=200) {
 const response = await fetch('http://127.0.0.1:3037/api'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result = await response.json();
 assert.equal(response.status, expected, route+': '+JSON.stringify(result));
 return result.data;
}
const login = async (email: string) => (await api('/auth/login',undefined,{email,password:'OnlyLocal-NightQA-2026!'})).tokens.accessToken;
try {
 if (process.argv[2] === 'generator-rejected-prepare') {
  assert.equal(existsSync(file),false,'Reuse the existing fixture; never duplicate preparation');
  const base={users:await db.usuario.count(),applications:await db.solicitudInscripcion.count(),manifests:await manifests()};
  const email='ux-generator-rejected-'+randomUUID().slice(0,8)+'@night-qa.invalid';
  const seed=await db.usuario.findUniqueOrThrow({where:{email:'generador@night-qa.invalid'}});
  const cuit=syntheticCuit(Date.now());
  const user=await db.usuario.create({data:{email,password:seed.password,nombre:'QA Generador · nueva presentación',cuit,rol:'GENERADOR',activo:false,motivoInactividad:'PENDIENTE_APROBACION',emailVerified:true,notifEmail:false}});
  // An explicit synthetic review fixture, not evidence of completing public signup.
  const application=await db.solicitudInscripcion.create({data:{usuarioId:user.id,tipoActor:'GENERADOR',estado:'ENVIADA',fechaEnvio:new Date(),datosActor:JSON.stringify({razonSocial:'QA Generador · nueva presentación',cuit,emailContacto:email,telefono:'02610000000',domicilio:'QA UX133 · expediente original'})}});
  writeFileSync(file,JSON.stringify({email,userId:user.id,id:application.id,base,prepared:false},null,2));
  const admin=await login('admin@night-qa.invalid');
  const reviewing=(await api('/solicitudes/'+application.id+'/revisar',admin,{})).solicitud;
  await api('/solicitudes/'+application.id+'/rechazar',admin,{motivoRechazo:'QA UX133 · constancia artificial inválida. Iniciá una nueva presentación con la documentación corregida.',expectedUpdatedAt:reviewing.updatedAt});
  const prior=await record(application.id);
  assert.equal(prior.estado,'RECHAZADA');
  const notices=await db.notificacion.findMany({where:{usuarioId:user.id,tipo:'SOLICITUD_RECHAZADA',datos:{contains:application.id}}});
  assert.equal(notices.length,1);
  const userRecord=await db.usuario.findUniqueOrThrow({where:{id:user.id}});
  const fixture={email,userId:user.id,id:application.id,base,prepared:true,priorHash:digest(prior),userBusiness:{activo:userRecord.activo,emailVerified:userRecord.emailVerified,motivoInactividad:userRecord.motivoInactividad,rol:userRecord.rol,cuit:userRecord.cuit},notices:1,at:new Date().toISOString()};
  writeFileSync(file,JSON.stringify(fixture,null,2));
  assert.equal(await manifests(),base.manifests);
  assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
  console.log(JSON.stringify({email,id:application.id,state:'RECHAZADA',syntheticFixture:true,publicSignupTested:false,notice:1}));
 } else {
  const f=JSON.parse(readFileSync(file,'utf8'));assert.equal(f.prepared,true);
  assert.equal(digest(await record(f.id)),f.priorHash,'Rejected history must remain intact');
  const rows=await db.solicitudInscripcion.findMany({where:{usuarioId:f.userId},include:{documentos:true,mensajes:true},orderBy:{createdAt:'asc'}});
  assert.equal(rows.length,2);
  const fresh=rows.find((r:any)=>r.id!==f.id)!;
  assert.equal(fresh.tipoActor,'GENERADOR');assert.equal(fresh.estado,'BORRADOR');
  assert.equal(JSON.parse(fresh.datosActor).domicilio,'QA UX133 · nuevo domicilio recuperado');
  assert.equal(fresh.documentos.length,0);assert.equal(fresh.mensajes.length,0);
  const user=await db.usuario.findUniqueOrThrow({where:{id:f.userId}});
  assert.deepEqual({activo:user.activo,emailVerified:user.emailVerified,motivoInactividad:user.motivoInactividad,rol:user.rol,cuit:user.cuit},f.userBusiness);
  const token=await login(f.email);
  const repeated=await api('/solicitudes/actividad-adicional',token,{tipoActor:'GENERADOR'},201);
  assert.equal(repeated.solicitud.id,fresh.id);
  assert.equal(await db.solicitudInscripcion.count({where:{usuarioId:f.userId}}),2);
  assert.equal(await db.usuario.count(),f.base.users+1);
  assert.equal(await db.solicitudInscripcion.count(),f.base.applications+2);
  assert.equal(await manifests(),f.base.manifests);
  const attempts=await db.emailQueue.count({where:{intentos:{gt:0}}}),sent=await db.emailQueue.count({where:{sentAt:{not:null}}});
  assert.equal(attempts,0);assert.equal(sent,0);
  const result={at:new Date().toISOString(),old:f.id,fresh:fresh.id,oldUnchanged:true,newDraft:true,sameAccount:true,noCopiedDocuments:true,retryReusesDraft:true,userBusinessUnchanged:true,newSyntheticUsers:1,newSyntheticApplications:2,manifestsUnchanged:true,emailAttempts:attempts,emailSent:sent};
  writeFileSync(out+'/generator-rejected-verified.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }
} finally {await db.$disconnect();}
