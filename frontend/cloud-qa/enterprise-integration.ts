import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase,backendRequire } from './safety.ts';
await assertCloudDatabase();
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient(),base='http://127.0.0.1:3037/api';
const fixture=JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!,'fixture.json'),'utf8'));
const password='OnlyLocal-NightQA-2026!';
async function req(token:string|null,route:string,status=200,body?:object,method=body?'POST':'GET',headers:Record<string,string>={}) {
 const res=await fetch(base+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
 const raw=await res.text();assert.equal(res.status,status,route+': '+raw);
 return raw?JSON.parse(raw).data:undefined;
}
async function login(name:string){return (await req(null,'/auth/login',200,{email:name+'@night-qa.invalid',password})).tokens.accessToken;}
function cuit(n:number){const b='30'+String(n).padStart(8,'0'),weights=[5,4,3,2,7,6,5,4,3,2];const v=11-[...b].reduce((s,c,i)=>s+Number(c)*weights[i],0)%11;return b+(v===11?0:v===10?9:v);}
const contexts:any={};
try {
 const original=await db.usuario.findUniqueOrThrow({where:{id:fixture.users.generador}});
 const template=await db.generador.findUniqueOrThrow({where:{id:fixture.actors.generador}});
 const legacy=await db.manifiesto.findMany({orderBy:{id:'asc'},include:{residuos:true,eventos:true}});
 const beforeUsers=await db.usuario.findMany({orderBy:{id:'asc'}});
 const beforeActors=await db.generador.findMany({orderBy:{id:'asc'}});
 const admin=await login('admin');
 for(const [i,surface] of ['http','web-desktop','web-responsive','app','apk'].entries()) {
  const prefix='empresa-'+surface;
  const user=async(suffix:string,extra:any={})=>db.usuario.create({data:{email:prefix+'-'+suffix+'@night-qa.invalid',nombre:'QA '+surface+' '+suffix,password:original.password,rol:'GENERADOR',activo:true,emailVerified:true,notifEmail:false,notifWhatsapp:false,notifTelegram:false,notifNuevoRegistro:false,...extra}});
  const owner=await user('owner'),member=await user('member'),other=await user('other'),actorUser=await user('actor');
  const tax=cuit(90001000+i);
  const actor=await db.generador.create({data:{...template,id:randomUUID(),usuarioId:actorUser.id,razonSocial:'QA Empresa '+surface,cuit:tax,numeroInscripcion:'QA-EMP-'+i}});
  const company=(await req(admin,'/empresas',201,{cuit:tax,razonSocial:actor.razonSocial,domicilioLegal:{calle:'Legal QA 100',localidad:'Mendoza',departamento:'Capital'}})).empresa;
  const route='/empresas/'+company.id;
  const activity=(await req(admin,route+'/actividades',201,{rol:'GENERADOR',actorId:actor.id})).actividad;
  await req(admin,route+'/responsables',200,{email:owner.email,motivo:'Responsable sintético validado por DGFA'});
  const token=await login(prefix+'-owner');
  const sites=[];
  for(const [code,name,address]of [['NORTE','Planta Norte','Productiva QA 200'],['SUR','Planta Sur','Productiva QA 300']])sites.push((await req(token,route+'/establecimientos',201,{codigo:code,nombre:name,domicilio:address,localidad:'Mendoza',departamento:'Capital',certificados:['QA-'+surface+'-'+code]})).establecimiento);
  const scope={actividadId:activity.id,todosEstablecimientos:true,establecimientoIds:[]};
  await req(token,route+'/personas',201,{...scope,email:owner.email});
  const grant=(await req(token,route+'/personas',201,{...scope,email:member.email,todosEstablecimientos:false,establecimientoIds:[sites[0].id]})).autorizacion;
  const old=await db.manifiesto.create({data:{id:randomUUID(),numero:'QA-EMP-OLD-'+i,estado:'BORRADOR',generadorId:actor.id,transportistaId:fixture.actors.transportista,operadorId:fixture.actors.operador,creadoPorId:actorUser.id,isDemoData:true}});
  const headers=(site:any)=>({'X-SITREP-Empresa':company.id,'X-SITREP-Empresa-Actividad':activity.id,'X-SITREP-Establecimiento':site.id});
  const body={transportistaId:fixture.actors.transportista,operadorId:fixture.actors.operador,modalidad:'FIJO',residuos:[{tipoResiduoId:fixture.wastes[0],cantidad:5,unidad:'kg'}]};
  const north=(await req(token,'/manifiestos',201,body,'POST',headers(sites[0]))).manifiesto;
  const south=(await req(token,'/manifiestos',201,body,'POST',headers(sites[1]))).manifiesto;
  assert.equal(north.creadoPorId,owner.id);assert.equal(north.generadorId,actor.id);
  assert.equal(north.contextoEmpresa.establecimientoId,sites[0].id);assert.equal(north.contextoEmpresa.domicilioLegal.calle,'Legal QA 100');
  contexts[surface]={company,activity,sites,grant,owner,member,other,actor,old,north,south,prefix};
 }
 const c=contexts.http,route='/empresas/'+c.company.id,owner=await login(c.prefix+'-owner'),member=await login(c.prefix+'-member'),outsider=await login(c.prefix+'-other');
 const h={'X-SITREP-Empresa':c.company.id,'X-SITREP-Empresa-Actividad':c.activity.id,'X-SITREP-Establecimiento':c.sites[0].id};
 await req(owner,route+'/actividades',403,{rol:'OPERADOR',actorId:fixture.actors.operador});
 await req(owner,route+'/responsables',403,{email:c.other.email,motivo:'No autoridad'});
 await req(member,route+'/personas',403,{email:c.other.email,actividadId:c.activity.id,todosEstablecimientos:true,establecimientoIds:[]});
 await req(outsider,route,404);
 assert.deepEqual((await req(member,route)).establecimientos.map((s:any)=>s.id),[c.sites[0].id]);
 await req(outsider,'/auth/profile',403,undefined,'GET',h);
 await req(member,'/auth/profile',403,undefined,'GET',{...h,'X-SITREP-Establecimiento':c.sites[1].id});
 await req(member,'/auth/profile',400,undefined,'GET',{...h,'X-SITREP-Activity':'GENERADOR'});
 const listed=await req(member,'/manifiestos?limit=100',200,undefined,'GET',h);
 assert.ok(listed.manifiestos.some((m:any)=>m.id===c.north.id));
 assert.ok(!listed.manifiestos.some((m:any)=>[c.south.id,c.old.id].includes(m.id)));
 await req(member,'/manifiestos/'+c.south.id,404,undefined,'GET',h);
 await req(member,'/manifiestos/'+c.old.id,404,undefined,'GET',h);
 await req(member,'/manifiestos/'+c.south.id,404,{observaciones:'Debe denegarse'},'PUT',h);
 await req(member,'/reportes/manifiestos',403,undefined,'GET',h);
 // One legal entity, several approved activities. Never mutate the person's base role.
 for(const role of ['TRANSPORTISTA','OPERADOR']) {
  const key=role.toLowerCase(),copy=await db[key].findUniqueOrThrow({where:{id:fixture.actors[key]}});
  const a=await db[key].create({data:{...copy,id:randomUUID(),usuarioId:c.owner.id,cuit:c.company.cuit,razonSocial:c.company.razonSocial}});
  const activity=(await req(admin,route+'/actividades',201,{rol:role,actorId:a.id})).actividad;
  await req(owner,route+'/personas',400,{email:c.other.email,actividadId:activity.id,todosEstablecimientos:false,establecimientoIds:[c.sites[0].id]});
  await req(owner,route+'/personas',201,{email:c.owner.email,actividadId:activity.id,todosEstablecimientos:true,establecimientoIds:[]});
  const profile=await req(owner,'/auth/profile',200,undefined,'GET',{'X-SITREP-Empresa':c.company.id,'X-SITREP-Empresa-Actividad':activity.id});
  assert.equal(profile.user.rol,role);assert.equal(profile.user[key].id,a.id);assert.equal(profile.user.id,c.owner.id);
 }
 assert.equal((await db.usuario.findUniqueOrThrow({where:{id:c.owner.id}})).rol,'GENERADOR');
 const pdf=await fetch(base+'/pdf/manifiesto/'+c.north.id,{headers:{Authorization:'Bearer '+member,...h}});
 assert.equal(pdf.status,200);await writeFile(path.join(process.env.QA_ARTIFACTS!,'empresa-north.pdf'),Buffer.from(await pdf.arrayBuffer()));
 const companyBody={revision:0,razonSocial:c.company.razonSocial,domicilioLegal:{calle:'Legal actualizada QA 101',localidad:'Mendoza',departamento:'Capital'},motivo:'Cambio legal sintético'};
 const races=await Promise.all([companyBody,companyBody].map(b=>fetch(base+route,{method:'PUT',headers:{Authorization:'Bearer '+owner,'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.status)));
 assert.deepEqual(races.sort(),[200,409]);
 assert.equal((await db.manifiesto.findUniqueOrThrow({where:{id:c.north.id}})).contextoEmpresa.domicilioLegal.calle,'Legal QA 100');
 assert.equal((await db.generador.findUniqueOrThrow({where:{id:c.actor.id}})).domicilio,template.domicilio);
 await req(owner,route+'/personas/'+c.grant.id+'/revocar',200,{revision:0,motivo:'Revocación inmediata'});
 await req(member,'/auth/profile',403,undefined,'GET',h); // same JWT, no logout/relogin
 await req(member,'/auth/profile'); // personal account still works
 await req(owner,route+'/personas',409,{email:c.member.email,actividadId:c.activity.id,todosEstablecimientos:true,establecimientoIds:[],revision:0});
 await req(owner,route+'/personas',201,{email:c.member.email,actividadId:c.activity.id,todosEstablecimientos:true,establecimientoIds:[],revision:1});
 await req(member,'/manifiestos/'+c.old.id,200,undefined,'GET',h);
 // Existing verified and new personal invitees, invalid/used/unverified/suspended denied.
 const invite=async(email:string)=>req(owner,route+'/invitaciones',201,{email,actividadId:c.activity.id,todosEstablecimientos:true,establecimientoIds:[]});
 const invited=await invite(c.other.email),inviteRoute=invited.ruta.replace('/empresa-invitacion/','/empresas/invitaciones/');
 assert.equal(invited.enviada,false);await req(null,inviteRoute);
 await req(null,inviteRoute+'/aceptar',403,{email:c.other.email,password:'wrong'});
 await req(null,inviteRoute+'/aceptar',200,{email:c.other.email,password});
 await req(null,inviteRoute+'/aceptar',404,{email:c.other.email,password});
 const newEmail='empresa-new-personal@night-qa.invalid';
 await req(null,'/auth/register',201,{email:newEmail,password,nombre:'QA Persona invitada',rol:'GENERADOR'});
 const pending=await db.usuario.findUniqueOrThrow({where:{email:newEmail}});
 const newInvite=await invite(newEmail),newRoute=newInvite.ruta.replace('/empresa-invitacion/','/empresas/invitaciones/');
 await req(null,newRoute+'/aceptar',403,{email:newEmail,password});
 // Synthetic mailbox proof: exercise the real verifier without delivering email.
 const verifyToken=randomUUID();
 await db.usuario.update({where:{id:pending.id},data:{emailVerificationToken:createHash('sha256').update(verifyToken).digest('hex')}});
 await req(null,'/auth/verify-email?token='+verifyToken);
 await req(null,newRoute+'/aceptar',200,{email:newEmail,password});
 const suspended=await db.usuario.create({data:{nombre:'QA Suspendida',email:'empresa-suspended@night-qa.invalid',password:original.password,rol:'GENERADOR',activo:false,emailVerified:true,motivoInactividad:'SUSPENDIDA'}});
 const si=await invite(suspended.email),sr=si.ruta.replace('/empresa-invitacion/','/empresas/invitaciones/');
 // Separate client IP only for synthetic rate-limiter isolation; do not weaken production limit.
 await req(null,sr+'/aceptar',403,{email:suspended.email,password},'POST',{'X-Forwarded-For':'192.0.2.81'});
 const fresh=await db.usuario.findUniqueOrThrow({where:{id:pending.id}});assert.equal(fresh.activo,true);assert.equal(fresh.cuit,null);
 assert.equal(await db.generador.count({where:{usuarioId:pending.id}}),0);
 assert.equal(await db.emailQueue.count({where:{estado:'ENVIADO'}}),0,'no email sent');
 for(const u of beforeUsers)assert.deepEqual(await db.usuario.findUniqueOrThrow({where:{id:u.id}}),u,'existing user unchanged');
 for(const a of beforeActors)assert.deepEqual(await db.generador.findUniqueOrThrow({where:{id:a.id}}),a,'existing actor unchanged');
 for(const m of legacy)assert.deepEqual(await db.manifiesto.findUniqueOrThrow({where:{id:m.id},include:{residuos:true,eventos:true}}),m,'existing manifest unchanged');
 // Never retain passwords, JWTs or invitation capabilities in downloadable reports.
 await writeFile(path.join(process.env.QA_ARTIFACTS!,'enterprise-fixture.json'),JSON.stringify(Object.fromEntries(Object.entries(contexts).map(([k,v]:any)=>[k,{companyId:v.company.id,northId:v.north.id,southId:v.south.id,prefix:v.prefix}]))));
 await writeFile(path.join(process.env.QA_ARTIFACTS!,'enterprise-http.json'),JSON.stringify({passed:true,emailSent:0,groups:[
 'DGFA validates activities/responsibles; company owner alone delegates; outsiders and escalation rejected',
 'separate legal and productive addresses, before/after audit and concurrent revision conflict',
 'site list/detail/edit/PDF isolation, no inference of legacy site, personal identity retained',
 'same JWT immediate revocation, personal recovery, deliberate regrant with current revision',
 'one-time invitations, verified personal activation only, wrong/unverified/suspended/used denied',
 'original users/actors/manifests unchanged; no accounts auto-created from register contacts'
 ]},null,2));
 console.log('Enterprise HTTP, isolation and historical invariants passed');
}finally{await db.$disconnect();}
