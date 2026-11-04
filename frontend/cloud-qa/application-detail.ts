import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { assertCloudDatabase,backendRequire } from './safety.ts';
import { syntheticCuit } from './synthetic-cuit.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
const file=process.env.QA_ARTIFACTS+'/application-detail-fixtures.json', password='OnlyLocal-NightQA-2026!';
async function request(route:string,token?:string,body?:unknown,method=body===undefined?'GET':'POST'){
 const response=await fetch('http://127.0.0.1:3037/api'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json();return {status:response.status,data:result.data,message:result.message};
}
async function api(route:string,token?:string,body?:unknown,status=200,method?:string){const result=await request(route,token,body,method);assert.equal(result.status,status,route+': '+JSON.stringify(result));return result.data;}
const login=async(email:string)=>(await api('/auth/login',undefined,{email,password})).tokens.accessToken;
try{
 const admin=await login('admin@night-qa.invalid');
 if(process.env.QA_APPLICATION_FIXTURE_ACCOUNT==='true'){
  const output=process.env.QA_ARTIFACTS+'/application-fixture-account.json';assert.ok(!existsSync(output),'Fixture account repair already recorded');
  const fixture=JSON.parse(readFileSync(file,'utf8')),fixed=[];
  for(const row of [...fixture.ui,fixture.http]){
   const account=await db.usuario.findUniqueOrThrow({where:{id:row.userId}});
   assert.equal(account.email,row.email);assert.ok(account.email.startsWith('ux-application-')&&account.email.endsWith('@night-qa.invalid'));assert.equal(account.activo,false);assert.equal(account.motivoInactividad,null);
   await db.usuario.update({where:{id:row.userId},data:{motivoInactividad:'PENDIENTE_APROBACION'}});
   fixed.push({id:row.userId,active:false,pendingReason:true});
  }
  writeFileSync(output,JSON.stringify({at:new Date().toISOString(),reason:'Direct fixture omitted the inactivity reason set by public signup; no production behavior changed',fixed},null,2));
  console.log('Synthetic pending-account fixture aligned with public signup');
 }else if(process.env.QA_APPLICATION_MESSAGE_RETRY==='true'){
  const output=process.env.QA_ARTIFACTS+'/application-message-retry.json';assert.ok(!existsSync(output),'Message retry already verified');
  const fixture=JSON.parse(readFileSync(file,'utf8')),row=fixture.ui[0],clientMessageId=randomUUID();
  const input={contenido:'QA mensaje único ante reintento '+clientMessageId,clientMessageId};
  const outcomes=await Promise.all([request('/solicitudes/'+row.id+'/mensajes',admin,input),request('/solicitudes/'+row.id+'/mensajes',admin,input)]);
  assert.ok(outcomes.every(r=>r.status===201));assert.equal(outcomes[0].data.mensaje.id,outcomes[1].data.mensaje.id);
  const third=await api('/solicitudes/'+row.id+'/mensajes',admin,input,201);assert.equal(third.mensaje.id,outcomes[0].data.mensaje.id);
  await api('/solicitudes/'+row.id+'/mensajes',admin,{...input,contenido:'Otro contenido con la misma referencia'},409);
  assert.equal(await db.mensajeSolicitud.count({where:{id:'ui-'+clientMessageId}}),1);
  const notices=await db.notificacion.findMany({where:{usuarioId:row.userId,tipo:'SOLICITUD_MENSAJE',datos:{contains:row.id}}});
  assert.equal(notices.length,1);
  assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
  writeFileSync(output,JSON.stringify({at:new Date().toISOString(),messageId:'ui-'+clientMessageId,replies:outcomes.map(r=>r.status),replaySameId:true,conflictingReferenceDenied:true,messages:1,ownerNotices:1,emailAttempts:0},null,2));
  console.log('Concurrent message and repeat acknowledged once');
 }else if(process.env.QA_APPLICATION_VERIFY==='true'){
  const fixture=JSON.parse(readFileSync(file,'utf8')), results=[];
  for(const row of fixture.ui){
   const current=await db.solicitudInscripcion.findUniqueOrThrow({where:{id:row.id}});
   const expected=row.surface==='web'?'OBSERVADA':'RECHAZADA';
   assert.equal(current.estado,expected);
   const notices=await db.notificacion.findMany({where:{tipo:'SOLICITUD_'+expected,datos:{contains:row.id}}});
   assert.equal(notices.length,1);assert.equal(notices[0].usuarioId,row.userId);
   results.push({id:row.id,surface:row.surface,state:current.estado,notices:1});
  }
  assert.equal(await db.manifiesto.count(),fixture.manifests);
  assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
  writeFileSync(process.env.QA_ARTIFACTS+'/application-detail-ui.json',JSON.stringify({at:new Date().toISOString(),results,emailAttempts:0},null,2));
  console.log(JSON.stringify(results));
 }else{
  assert.ok(!existsSync(file),'Reuse existing fixtures; do not duplicate the run');
  const seed=await db.usuario.findUniqueOrThrow({where:{email:'generador@night-qa.invalid'}});
  const prefix='ux-application-'+randomUUID().slice(0,8),manifests=await db.manifiesto.count(),rows=[],areas=[];
  // Explicit artificial fixtures begin at ENVIADA; this is not proof of a public signup.
  for(const [index,type]of ['GENERADOR','OPERADOR','TRANSPORTISTA'].entries()){
   const email=prefix+'-'+type.toLowerCase()+'@night-qa.invalid',cuit=syntheticCuit(Date.now()+index*137);
   const person=await db.usuario.create({data:{email,password:seed.password,nombre:'QA revisión '+type,cuit,rol:type,activo:false,motivoInactividad:'PENDIENTE_APROBACION',emailVerified:true,notifEmail:false}});
   const datosActor={razonSocial:'QA revisión '+type,cuit,domicilio:'Domicilio artificial original',telefono:'02610000000',emailContacto:email};
   const s=await db.solicitudInscripcion.create({data:{usuarioId:person.id,tipoActor:type,estado:'ENVIADA',datosActor:JSON.stringify(datosActor),fechaEnvio:new Date()}});
   rows.push({id:s.id,userId:person.id,email,type});
   const area=await db.usuario.create({data:{email:prefix+'-admin-'+type.toLowerCase()+'@night-qa.invalid',password:seed.password,nombre:'QA área '+type,rol:'ADMIN_'+type,activo:true,emailVerified:true,notifEmail:false}});
   areas.push({email:area.email,type});
  }
  writeFileSync(file,JSON.stringify({prefix,manifests,ui:rows.slice(0,2).map((r,index)=>({...r,surface:index===0?'web':'app'})),http:rows[2],areas},null,2));
  const scopes=[];
  for(const area of areas){
   const token=await login(area.email),own=rows.find(r=>r.type===area.type)!,foreign=rows.find(r=>r.type!==area.type)!;
   const list=await api('/solicitudes?tipoActor='+foreign.type+'&limit=100',token);
   assert.ok(list.solicitudes.every((s:any)=>s.tipoActor===area.type));
   await api('/solicitudes/'+own.id,token);
   for(const suffix of ['','/mensajes','/documentos/invalid/download'])await api('/solicitudes/'+foreign.id+suffix,token,undefined,403);
   await api('/solicitudes/'+foreign.id+'/mensajes',token,{contenido:'No debe enviarse'},403);
   scopes.push({type:area.type,filtered:true,foreignReadMessageFileDenied:true});
  }
  const row=rows[2],token=await login(row.email);
  await api('/solicitudes/'+row.id,admin);
  assert.equal((await db.solicitudInscripcion.findUniqueOrThrow({where:{id:row.id}})).estado,'ENVIADA');
  const started=(await api('/solicitudes/'+row.id+'/revisar',admin,{})).solicitud;
  await api('/solicitudes/'+row.id+'/observar',admin,{observaciones:'Versión antigua',expectedUpdatedAt:'2000-01-01T00:00:00.000Z'},409);
  await api('/solicitudes/'+row.id+'/mensajes',token,{contenido:'Respuesta artificial de transporte'},201);
  const messageNotices=await db.notificacion.findMany({where:{tipo:'SOLICITUD_MENSAJE',datos:{contains:row.id}},include:{usuario:{select:{rol:true}}}});
  assert.ok(messageNotices.length>0);assert.ok(messageNotices.every((n:any)=>['ADMIN','ADMIN_TRANSPORTISTA'].includes(n.usuario.rol)));
  const outcomes=await Promise.all([
   request('/solicitudes/'+row.id+'/observar',admin,{observaciones:'Completar constancia artificial',expectedUpdatedAt:started.updatedAt}),
   request('/solicitudes/'+row.id+'/rechazar',admin,{motivoRechazo:'Constancia artificial inválida',expectedUpdatedAt:started.updatedAt}),
  ]);
  assert.equal(outcomes.filter(r=>r.status===200).length,1);assert.ok(outcomes.every(r=>[200,400,409].includes(r.status)));
  const notices=await db.notificacion.findMany({where:{usuarioId:row.userId,tipo:{in:['SOLICITUD_OBSERVADA','SOLICITUD_RECHAZADA']},datos:{contains:row.id}}});
  assert.equal(notices.length,1);
  assert.equal(await db.manifiesto.count(),manifests);assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
  writeFileSync(process.env.QA_ARTIFACTS+'/application-detail-http.json',JSON.stringify({at:new Date().toISOString(),scopes,readDidNotMutate:true,staleDecisionDenied:true,race:outcomes.map(r=>r.status),decisionNotices:1,responseRecipientsScoped:true,emailAttempts:0},null,2));
  console.log(JSON.stringify({ui:rows.slice(0,2),scopes,race:outcomes.map(r=>r.status)}));
 }
}finally{await db.$disconnect();}
