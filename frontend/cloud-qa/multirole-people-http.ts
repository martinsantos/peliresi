import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { assertCloudDatabase, backendRequire } from './safety.ts';
import { syntheticCuit } from './synthetic-cuit.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'multirole_people_20261022');
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient(),out=process.env.QA_ARTIFACTS!;
const base='http://127.0.0.1:3037/api',password='OnlyLocal-NightQA-2026!',runId=randomUUID().slice(0,8);
let requests=0;
async function api(token:string|undefined,route:string,body?:unknown,status=200,method=body?'POST':'GET',extra:Record<string,string>={}) {
 const response=await fetch(base+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json();requests++;assert.equal(response.status,status,route+': '+JSON.stringify(result));return result.data;
}
try {
 const token=(await api(undefined,'/auth/login',{email:'admin@night-qa.invalid',password})).tokens.accessToken;
 const template=await db.usuario.findUniqueOrThrow({where:{email:'generador@night-qa.invalid'}});
 const rows=[];
 for(const [index,role]of ['GENERADOR','TRANSPORTISTA','OPERADOR'].entries()) {
  const cuit=syntheticCuit(Date.now()+index*1000),prefix='edge-'+runId+'-'+role.toLowerCase();
  const company=(await api(token,'/empresas',{cuit,razonSocial:'QA entidad '+prefix,domicilioLegal:{calle:'Artificial',localidad:'Mendoza',departamento:'Capital'}},201)).empresa;
  const persons=[];
  for(const n of [1,2]){
   const person=await db.usuario.create({data:{email:prefix+'-'+n+'@night-qa.invalid',nombre:'QA responsable '+n,password:template.password,rol:'GENERADOR',activo:true,emailVerified:true}});persons.push(person);
   await api(token,'/empresas/'+company.id+'/responsables',{email:person.email,motivo:'QA responsabilidad previa a vinculación'});
  }
  assert.equal((await api(token,'/empresas/'+company.id)).cupoPersonas.ocupados,2);
  const paths:Record<string,string>={GENERADOR:'generadores',TRANSPORTISTA:'transportistas',OPERADOR:'operadores'};
  const email=prefix+'-owner@night-qa.invalid';
  await api(token,'/actores/'+paths[role],{razonSocial:'QA '+prefix,cuit,email,password,domicilio:'Artificial',telefono:'000',numeroInscripcion:'QA',numeroHabilitacion:'QA',categoria:'QA'},409);
  assert.equal(await db.usuario.count({where:{email}}),0,'Rejected owner must roll back together with actor');
  assert.equal((await api(token,'/empresas/'+company.id)).cupoPersonas.ocupados,2);
  // The public application approval must enforce the same limit and roll back
  // actor, activity and activation together. Only artificial review data is set.
  await api(undefined,'/solicitudes/iniciar',{email,nombre:'QA solicitante '+prefix,password,tipoActor:role,cuit},201);
  const applicant=await db.usuario.findUniqueOrThrow({where:{email}});
  const application=await db.solicitudInscripcion.findFirstOrThrow({where:{usuarioId:applicant.id}});
  await db.usuario.update({where:{id:applicant.id},data:{emailVerified:true}});
  await db.solicitudInscripcion.update({where:{id:application.id},data:{estado:'EN_REVISION',datosActor:JSON.stringify({razonSocial:'QA '+prefix,cuit,email,domicilio:'Artificial',telefono:'000',numeroInscripcion:'QA',numeroHabilitacion:'QA',categoria:'QA'})}});
  assert.equal((await api(token,'/empresas/'+company.id)).cupoPersonas.ocupados,2,'A pending applicant does not become a third member');
  await api(token,'/solicitudes/'+application.id+'/aprobar',{},409);
  assert.equal(await db[role.toLowerCase()].count({where:{usuarioId:applicant.id}}),0);
  assert.equal((await db.usuario.findUniqueOrThrow({where:{id:applicant.id}})).activo,false);
  assert.equal((await db.solicitudInscripcion.findUniqueOrThrow({where:{id:application.id}})).estado,'EN_REVISION');
  await api(token,'/empresas/'+company.id+'/responsables',{email:persons[1].email,motivo:'QA reemplazo explícito',revocar:true});
  await api(token,'/solicitudes/'+application.id+'/aprobar',{});
  assert.equal((await api(token,'/empresas/'+company.id)).cupoPersonas.ocupados,2);
  rows.push({role,thirdOwnerRejected:true,approvalRejected:true,rollbackComplete:true,explicitReplacementAllowed:true});
 }
 const surfaces:Record<string,unknown>={};
 for(const [index,surface]of ['web-desktop','web-responsive','app'].entries()) {
  const prefix='edge-ui-'+runId+'-'+surface,email=prefix+'@night-qa.invalid',cuit=syntheticCuit(Date.now()+index*1000);
  const body={razonSocial:'QA entidad '+surface,cuit,email,password,domicilio:'Artificial',telefono:'000',numeroInscripcion:'QA',numeroHabilitacion:'QA',categoria:'QA'};
  await api(token,'/actores/generadores',body,201);
  const owner=(await api(undefined,'/auth/login',{email,password})).tokens.accessToken;
  const company=(await api(owner,'/empresas')).empresas[0],route='/empresas/'+company.id;
  for(const tipoActor of ['TRANSPORTISTA','OPERADOR']){
   const a=(await api(owner,'/solicitudes/actividad-adicional',{tipoActor},201)).solicitud;
   await db.solicitudInscripcion.update({where:{id:a.id},data:{estado:'EN_REVISION',datosActor:JSON.stringify(body)}});
   await api(token,'/solicitudes/'+a.id+'/aprobar',{});
  }
  const member=await db.usuario.create({data:{email:prefix+'-member@night-qa.invalid',nombre:'QA segunda persona',password:template.password,rol:'GENERADOR',activo:true,emailVerified:true}});
  let detail=await api(owner,route);
  const activities=detail.actividades;
  const scope=(id:string)=>({email:member.email,actividadId:id,todosEstablecimientos:true,establecimientoIds:[]});
  const invite=await api(owner,route+'/invitaciones',scope(activities[0].id),201);
  await api(owner,route+'/invitaciones',scope(activities[0].id),409);
  const stale=await api(owner,route+'/invitaciones',scope(activities[1].id),201);
  assert.equal((await api(owner,route)).cupoPersonas.ocupados,2,'Several invitations reserve one person');
  await api(undefined,invite.ruta.replace('/empresa-invitacion/','/empresas/invitaciones/')+'/aceptar',{email:member.email,password});
  await api(undefined,invite.ruta.replace('/empresa-invitacion/','/empresas/invitaciones/')+'/aceptar',{email:member.email,password},404);
  let grant=(await api(owner,route+'/personas',scope(activities[1].id),201)).autorizacion;
  await api(owner,route+'/personas/'+grant.id+'/revocar',{revision:grant.revision,motivo:'QA revocación posterior al enlace'});
  await api(undefined,stale.ruta.replace('/empresa-invitacion/','/empresas/invitaciones/')+'/aceptar',{email:member.email,password},409);
  assert.equal((await db.autorizacionEmpresa.findUniqueOrThrow({where:{id:grant.id}})).activa,false,'An old link cannot restore revoked access');
  for(let i=0;i<2;i++)await api(owner,route+'/invitaciones/'+stale.invitacion.id+'/revocar',{});
  assert.equal(await db.eventoEmpresa.count({where:{empresaId:company.id,tipo:'INVITACION_REVOCADA'}}),1,'Repeated revocation does not duplicate events');
  await api(owner,route+'/invitaciones',scope(activities[1].id),409);
  grant=(await api(owner,route+'/personas',{...scope(activities[1].id),revision:grant.revision+1},201)).autorizacion;
  await api(owner,route+'/personas',scope(activities[2].id),201);
  detail=await api(owner,route);assert.equal(detail.cupoPersonas.ocupados,2);assert.equal(detail.cupoPersonas.personas.find((p:any)=>p.id===member.id).roles.length,3);
  const memberToken=(await api(undefined,'/auth/login',{email:member.email,password})).tokens.accessToken;
  for(const activity of activities){
   const profile=(await api(memberToken,'/auth/profile',undefined,200,'GET',{'X-SITREP-Empresa':company.id,'X-SITREP-Empresa-Actividad':activity.id})).user;
   assert.equal(profile.id,member.id);assert.equal(profile.rol,activity.rol);assert.equal(profile.empresaContexto.empresaId,company.id);assert.equal(profile[activity.rol.toLowerCase()].id,activity.actorId);
  }
  assert.equal((await db.usuario.findUniqueOrThrow({where:{id:member.id}})).rol,'GENERADOR','Acting for another activity does not change the personal account');
  await api(owner,route+'/invitaciones',{...scope(activities[0].id),email:'third-'+prefix+'@night-qa.invalid'},409);
  for(const g of detail.autorizaciones.filter((g:any)=>g.usuarioId===member.id))await api(owner,route+'/personas/'+g.id+'/revocar',{revision:g.revision,motivo:'QA cese completo'});
  assert.equal((await api(owner,route)).cupoPersonas.ocupados,1,'Only revoking all remaining roles releases the person');
  surfaces[surface]={prefix,companyId:company.id,memberId:member.id,activityIds:activities.map((a:any)=>a.id)};
 }
 assert.equal(await db.emailQueue.count({where:{estado:{not:'SUPRIMIDO'}}}),0);
 writeFileSync(out+'/edge-fixtures.json',JSON.stringify(surfaces));
 writeFileSync(out+'/edge-http.json',JSON.stringify({requests,rows,synthetic:true,emailsSent:0}));console.log('PASS ownership capacity HTTP: '+requests+' requests');
}finally{await db.$disconnect();}
