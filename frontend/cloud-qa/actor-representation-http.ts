import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { assertCloudDatabase, backendRequire } from './safety.ts';
import { syntheticCuit } from './synthetic-cuit.ts';
await assertCloudDatabase();
assert.ok(['actor_representation_20261022', 'web_app_audit_20261022', 'multirole_people_20261022'].includes(new URL(process.env.DATABASE_URL!).searchParams.get('schema')!));
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient(),out=process.env.QA_ARTIFACTS!;
const fixture=JSON.parse(readFileSync(out+'/fixture.json','utf8')),base='http://127.0.0.1:3037/api',password='OnlyLocal-NightQA-2026!';
const runId=randomUUID().slice(0,8),taxSeed=Date.now();
let requests=0;
async function api(token:string|undefined,route:string,body?:unknown,status=200,method=body?'POST':'GET',extra:Record<string,string>={}) {
 const response=await fetch(base+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})});
 const raw=await response.text();requests++;assert.equal(response.status,status,route+': '+raw);return raw?JSON.parse(raw).data:undefined;
}
const login=async(email:string)=>(await api(undefined,'/auth/login',{email,password})).tokens.accessToken as string;
const rolePaths:Record<string,string>={GENERADOR:'generadores',TRANSPORTISTA:'transportistas',OPERADOR:'operadores'};
try {
 const admin=await login('admin@night-qa.invalid');
 await api(undefined,'/solicitudes/iniciar',{email:'bad-cuit-'+runId+'@night-qa.invalid',nombre:'QA identidad inválida',password,tipoActor:'GENERADOR',cuit:'20-12345678-5'},400);
 for(const invalid of [{cuit:20123456786},{password:12345678},{nombre:{text:'QA'}}])await api(undefined,'/solicitudes/iniciar',{email:'bad-cuit-'+runId+'@night-qa.invalid',nombre:'QA datos inválidos',password,tipoActor:'GENERADOR',cuit:'20-12345678-6',...invalid},400);
 assert.equal(await db.usuario.count({where:{email:'bad-cuit-'+runId+'@night-qa.invalid'}}),0);
 const sources=await db.usuario.findUniqueOrThrow({where:{id:fixture.users.generador}});
 const data:any={};
 for(const [index,role]of ['GENERADOR','TRANSPORTISTA','OPERADOR'].entries()) {
  const name='representation-'+runId+'-'+role.toLowerCase(),email=name+'@night-qa.invalid',cuit=syntheticCuit(taxSeed+index*100);
  const body={razonSocial:'QA '+name,cuit,email,password,domicilio:'QA artificial',telefono:'000',numeroInscripcion:'QA',numeroHabilitacion:'QA',categoria:'QA'};
  const created=(await api(admin,'/actores/'+rolePaths[role],{...body,cuit:cuit.replace(/-/g,' '),email:' '+email.toUpperCase()+' '},201))[role.toLowerCase()];
  assert.equal(created.cuit,cuit);assert.equal(created.email,email);
  await api(admin,'/actores/'+rolePaths[['GENERADOR','TRANSPORTISTA','OPERADOR'].find(r=>r!==role)!],{...body,cuit:cuit.replace(/-/g,''),email:'duplicate-'+email},409);
  const owner=await db.usuario.findUniqueOrThrow({where:{email}}),token=await login(email);
  let detail=(await api(token,'/empresas')).empresas;assert.equal(detail.length,1);const company=detail[0],route='/empresas/'+company.id;
  detail=await api(token,route);assert.equal(detail.cupoPersonas.ocupados,1);assert.equal(detail.cupoPersonas.personas[0].responsable,true);
  const ownerHash=owner.password;
  for(const other of ['GENERADOR','TRANSPORTISTA','OPERADOR'].filter(r=>r!==role)) {
   const application=(await api(token,'/solicitudes/actividad-adicional',{tipoActor:other},201)).solicitud;
   // Only the new artificial dossier is prepared for review; the approval,
   // actor creation, account activation and grants use the real controller.
   await db.solicitudInscripcion.update({where:{id:application.id},data:{estado:'EN_REVISION',datosActor:JSON.stringify({...body,razonSocial:'QA '+name})}});
   await api(admin,'/solicitudes/'+application.id+'/aprobar',{});
   assert.equal((await api(token,'/auth/profile',undefined,200,'GET',{'X-SITREP-Activity':other})).user.rol,other);
  }
  detail=await api(token,route);assert.equal(detail.actividades.length,3);assert.equal(detail.cupoPersonas.ocupados,1);
  const fresh=await db.usuario.findUniqueOrThrow({where:{id:owner.id}});assert.equal(fresh.rol,role);assert.equal(fresh.password,ownerHash);
  const candidates=await Promise.all(['a','b'].map(letter=>db.usuario.create({data:{email:name+'-'+letter+'@night-qa.invalid',nombre:'QA representante '+letter,password:sources.password,rol:'GENERADOR',activo:true,emailVerified:true}})));
  const activity=detail.actividades[0],scope={actividadId:activity.id,todosEstablecimientos:true,establecimientoIds:[]};
  const expired=await api(token,route+'/invitaciones',{...scope,email:'expired-'+name+'@night-qa.invalid'},201);
  await db.invitacionEmpresa.update({where:{id:expired.invitacion.id},data:{venceAt:new Date(Date.now()-1000)}});
  await api(undefined,expired.ruta.replace('/empresa-invitacion/','/empresas/invitaciones/'),undefined,404);
  assert.equal((await api(token,route)).cupoPersonas.ocupados,1);
  const races=await Promise.all(candidates.map(async candidate=>{const res=await fetch(base+route+'/invitaciones',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({...scope,email:candidate.email})});return {status:res.status,body:await res.json(),candidate};}));requests+=2;
  assert.deepEqual(races.map(r=>r.status).sort(),[201,409]);
  const winner=races.find(r=>r.status===201)!,loser=races.find(r=>r.status===409)!;
  assert.equal((await api(token,route)).cupoPersonas.ocupados,2);
  const invitation=winner.body.data.ruta.replace('/empresa-invitacion/','/empresas/invitaciones/');
  await api(undefined,invitation+'/aceptar',{email:winner.candidate.email,password});
  const memberToken=await login(winner.candidate.email);
  await api(token,route+'/personas',{...scope,email:loser.candidate.email},409);
  await api(admin,route+'/responsables',{email:loser.candidate.email,motivo:'QA cupo compartido'},409);
  for(const a of detail.actividades.filter((a:any)=>a.id!==activity.id))await api(token,route+'/personas',{...scope,actividadId:a.id,email:winner.candidate.email},201);
  detail=await api(token,route);assert.equal(detail.cupoPersonas.ocupados,2);assert.equal(detail.cupoPersonas.personas.find((p:any)=>p.id===winner.candidate.id).roles.length,3);
  await api(token,route+'/responsables',{email:winner.candidate.email,motivo:'QA responsable designado por titular'});
  assert.equal((await api(memberToken,route)).puedeGestionar,true);
  const notices=await db.notificacion.findMany({where:{usuarioId:winner.candidate.id}});assert.ok(notices.some(n=>JSON.parse(n.datos||'{}').evento==='RESPONSABLE_VALIDADO'));
  await db.usuario.update({where:{id:owner.id},data:{activo:false,motivoInactividad:'SUSPENDIDA'}});
  await api(memberToken,route+'/responsables',{email:winner.candidate.email,motivo:'QA último responsable activo',revocar:true},409);
  await db.usuario.update({where:{id:owner.id},data:{activo:true,motivoInactividad:null}});
  await db.usuario.update({where:{id:winner.candidate.id},data:{activo:false,motivoInactividad:'SUSPENDIDA'}});
  await api(token,route+'/responsables',{email:winner.candidate.email,motivo:'QA fin de responsabilidad',revocar:true});
  await db.usuario.update({where:{id:winner.candidate.id},data:{activo:true,motivoInactividad:null}});
  await api(memberToken,route+'/establecimientos',{codigo:'FORBIDDEN',nombre:'No autorizado',domicilio:'QA',certificados:[]},403);
  // Role revocation is checked with the same session; other roles survive.
  const own=db[role.toLowerCase()];await api(admin,'/actores/'+rolePaths[role]+'/'+created.id,{activo:false},200,'PUT');
  await api(token,'/auth/profile',undefined,403,'GET',{'X-SITREP-Activity':role});
  await api(token,'/manifiestos',{observaciones:'must not create with an inactive base'},403);
  assert.equal((await api(token,'/auth/profile')).user.actividades.length,2);
  await api(admin,'/actores/'+rolePaths[role]+'/'+created.id,undefined,400,'DELETE');
  assert.equal(await db.usuario.count({where:{id:owner.id}}),1);assert.ok(await own.findUnique({where:{id:created.id}}));
  const oldGrant=detail.autorizaciones.find((g:any)=>g.usuarioId===winner.candidate.id&&g.actividadId===activity.id);
  await api(token,route+'/personas/'+oldGrant.id+'/revocar',{revision:oldGrant.revision,motivo:'QA revocación de actividad'});
  await api(memberToken,'/auth/profile',undefined,403,'GET',{'X-SITREP-Empresa':company.id,'X-SITREP-Empresa-Actividad':activity.id});
  assert.equal((await api(token,route)).cupoPersonas.ocupados,2,'one remaining role still occupies the same slot');
  await api(token,route+'/invitaciones',{...scope,actividadId:detail.actividades.find((a:any)=>a.rol!==role).id,email:loser.candidate.email},409);
  data[role]={ownerId:owner.id,companyId:company.id,memberId:winner.candidate.id,thirdId:loser.candidate.id};
 }
 // Each UI surface receives a fresh pair with its own company and base account.
 const surfaces:any={};
 for(const [i,surface]of ['web-desktop','web-responsive','app'].entries()) {
  const name='representation-ui-'+runId+'-'+surface,cuit=syntheticCuit(taxSeed+10000+i*100),email=name+'@night-qa.invalid';
  const actor=(await api(admin,'/actores/generadores',{razonSocial:'QA entidad '+surface,cuit,email,password,domicilio:'Artificial',telefono:'000',numeroInscripcion:'QA',categoria:'QA'},201)).generador;
  const token=await login(email),company=(await api(token,'/empresas')).empresas[0];
  const member=await db.usuario.create({data:{email:name+'-member@night-qa.invalid',nombre:'QA representante '+surface,password:sources.password,rol:'GENERADOR',activo:true,emailVerified:true}});
  surfaces[surface]={prefix:name,companyId:company.id,actorId:actor.id,memberId:member.id};
 }
 assert.equal(await db.emailQueue.count({where:{estado:{not:'SUPRIMIDO'}}}),0);
 writeFileSync(out+'/representation-fixture.json',JSON.stringify(surfaces));
 writeFileSync(out+'/representation-http.json',JSON.stringify({requests,threeStartingRoles:Object.keys(data),concurrencyRaces:3,oneIdentityAcrossThreeRoles:true,twoPeopleAcrossRoles:true,sameSessionRevocations:true,mailSent:0,synthetic:true}));
 console.log('PASS representation HTTP: '+requests+' requests');
}finally{await db.$disconnect();}
