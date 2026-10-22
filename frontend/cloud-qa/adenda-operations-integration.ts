import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {assertCloudDatabase,assertCloudEnvironment,backendRequire,externalKeys} from './safety.ts';
await assertCloudDatabase();
assert.ok(['adenda_operations_20261021','adenda_authorities_20261021','reactivation_20261022'].includes(new URL(process.env.DATABASE_URL!).searchParams.get('schema')!));
const out=process.env.QA_ARTIFACTS!,f=JSON.parse(readFileSync(out+'/fixture.json','utf8'));
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient(),base='http://127.0.0.1:4177/api';
const tokens=new Map<string,string>(),checks:string[]=[];
const hash=(data:unknown)=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
async function token(role:string){if(!tokens.has(role)){const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.12.23.'+(tokens.size+1)},body:JSON.stringify({email:role+'@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'})});const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));assert.notEqual(body.data.user?.training,true);tokens.set(role,body.data.tokens.accessToken);}return tokens.get(role)!;}
async function request(role:string,path:string,method='GET',body?:unknown,status=200){const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+await token(role),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const result=await r.json();assert.equal(r.status,status,role+' '+path+' '+JSON.stringify(result));assert.notEqual(r.headers.get('x-sitrep-training'),'true');return result.data;}
const manifest=(state='RECIBIDO')=>db.manifiesto.create({data:{numero:'QA-ADENDA-'+randomUUID(),estado:state,generadorId:f.actors.generador,transportistaId:f.actors.transportista,operadorId:f.actors.operador,creadoPorId:f.users.generador,isDemoData:true,modalidad:'FIJO',residuos:{create:[{tipoResiduoId:f.wastes[0],cantidad:10,unidad:'kg',estado:'SOLIDO'}]}},include:{residuos:true,eventos:true}});
const input=()=>({id:randomUUID(),motivo:'Hallazgo artificial al recibir: cantidad diferente y corriente no declarada',residuos:[{corriente:'Y1',cantidad:12,unidad:'kg'},{corriente:'Y21',cantidad:3,unidad:'kg'}]});
async function pdf(path:string,version:number){const r=await fetch(base+path+'/anexo?version='+version,{headers:{Authorization:'Bearer '+await token('generador')}});assert.equal(r.status,200);assert.match(r.headers.get('content-type')!,/application\/pdf/);assert.match(r.headers.get('cache-control')!,/no-store/);return {bytes:Buffer.from(await r.arrayBuffer()),hash:r.headers.get('x-sitrep-content-sha256')};}
try{
 const phase=process.argv[2];
 if(phase==='adenda-authority'){
  const admin=await db.usuario.findUniqueOrThrow({where:{id:f.users.admin}});
  await db.usuario.create({data:{id:'adenda-qa-authority',email:'adenda-authority@night-qa.invalid',password:admin.password,rol:'ADMIN',nombre:'QA Autoridad adendas',activo:true,emailVerified:true}});
  console.log('Separate synthetic authority prepared; ordinary administrator remains undesignated');
 }else if(phase==='adenda-noauthority'){
  const m=await manifest(),endpoint=`/manifiestos/${m.id}/adendas`;
  const a=(await request('operador',endpoint,'POST',input(),201)).adenda;
  const before=await db.adendaManifiesto.findUniqueOrThrow({where:{id:a.id}}),notices=await db.notificacion.count();
  await request('generador',endpoint+'/'+a.id+'/revisiones','POST',{id:randomUUID(),version:0,decision:'APROBADA',nota:'Aprobación sin autoridad configurada debe fallar'},409);
  assert.deepEqual(await db.adendaManifiesto.findUniqueOrThrow({where:{id:a.id}}),before);assert.equal(await db.notificacion.count(),notices);
  checks.push('missing authority returns actionable 409; review/version/notices roll back atomically');
  writeFileSync(out+'/adenda-noauthority.json',JSON.stringify({checks}));
 }else if(phase==='adenda-fixtures'){
  await db.operador.update({where:{id:f.actors.operador},data:{corrientesY:'Y1 / Y2'}});
  const cases:Record<string,unknown>={};for(const name of ['web-desktop','web-responsive','app'])cases[name]=await manifest();
  writeFileSync(out+'/adenda-browser-fixture.json',JSON.stringify({cases,at:new Date().toISOString()}));
 }else if(phase==='adenda-off'){
  const saved=JSON.parse(readFileSync(out+'/adenda-http.json','utf8'));
  for(const role of ['generador','transportista','operador'])await request(role,`/manifiestos/${saved.manifestId}/adendas`,'GET',undefined,404);
  await request('operador',`/manifiestos/${saved.manifestId}/adendas`,'POST',input(),404);
  await request('generador',`/manifiestos/${saved.manifestId}/adendas/${saved.adendaId}/revisiones`,'POST',{id:randomUUID(),version:0,decision:'APROBADA',nota:'No debe pasar'},404);
  checks.push('flags off close reads and writes without reopening CAP');
  writeFileSync(out+'/adenda-off.json',JSON.stringify({checks}));
 }else if(phase==='adenda-audit'){
  for(const proc of JSON.parse(readFileSync(out+'/processes.json','utf8'))){const env=Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`,'utf8').split('\0').filter(Boolean).map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));assertCloudEnvironment(env);assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'),new URL(process.env.DATABASE_URL!).searchParams.get('schema'));assert.equal(env.TRAINING_DATABASE_URL,'');assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED,'false');for(const key of externalKeys)assert.equal(env[key],'');}
  for(const role of ['admin','generador','transporte','operador']){const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.12.23.99'},body:JSON.stringify({email:role+'@capacitacion.invalid',password:'expired-probe'})});assert.equal(r.status,403);}
  checks.push('actual runtime providers closed; four CAP aliases 403');
  const compiled=backendRequire('./dist/lib/prisma.js').default;
  try{
   const {notificationMailContent,notificationSourceEligible,queueCommittedNotificationEmails}=backendRequire('./dist/services/notification-mail.service.js');
   const notices=await db.notificacion.findMany({where:{datos:{contains:'adenda_manifiesto'}},include:{usuario:true}});const phases=new Set<string>();let simulated=0;
   for(const n of notices){phases.add(JSON.parse(n.datos).evento);const envelope={...n,...n.usuario,id:n.id,usuarioId:n.usuarioId,manifiestoId:n.manifiestoId,tipo:n.tipo,datos:n.datos};assert.ok(notificationMailContent(envelope));assert.equal(await notificationSourceEligible(envelope,'manifiestos'),false,'Synthetic isDemoData source must be excluded from delivery');simulated++;}
   for(const phase of ['CREADA','APROBADA','OBSERVADA','RECHAZADA'])assert.ok(phases.has(phase));
   const before=await db.emailQueue.count();assert.equal(await queueCommittedNotificationEmails(),0);assert.equal(await db.emailQueue.count(),before);assert.equal(await db.emailQueue.count({where:{estado:{not:'SUPRIMIDO'}}}),0);assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
   assert.equal(JSON.stringify(await db.manifiesto.findUniqueOrThrow({where:{id:'manifest-qa-legacy'},include:{residuos:true,eventos:true}})),readFileSync(out+'/manifest-legacy-before.json','utf8'));
   checks.push('all four phases render simulated mail; zero attempts/sends; legacy original unchanged');
   writeFileSync(out+'/adenda-audit.json',JSON.stringify({checks,simulated,demoSourcesSuppressed:simulated,phases:[...phases],attempts:0,sent:0,emailQueue:before},null,2));
  }finally{await compiled.$disconnect();}
 }else{
  assert.equal(phase,'adenda-api');
  await db.operador.update({where:{id:f.actors.operador},data:{corrientesY:'Y1 / Y2'}});
  const m=await manifest(),endpoint=`/manifiestos/${m.id}/adendas`,command=input();
  const list=(role='generador')=>request(role,endpoint);
  for(const role of ['generador','admin'])await request(role,endpoint,'POST',command,403);
  await request('operador2',endpoint,'POST',command,404);await request('generador2',endpoint,'GET',undefined,404);
  await request('operador',endpoint,'POST',{...command,informeHallazgo:{autorId:'fake'}},400);
  const draft=await manifest('BORRADOR');await request('operador',`/manifiestos/${draft.id}/adendas`,'POST',input(),409);
  checks.push('normal accounts and linked roles only; draft/forged finding rejected');
  const a=(await request('operador',endpoint,'POST',command,201)).adenda;
  assert.deepEqual(a.informeHallazgo.diferencias.map((d:any)=>d.tipo),['CANTIDAD_DIFERENTE','Y_OMITIDA']);assert.equal(a.informeHallazgo.autorId,f.users.operador);assert.equal(a.autor.rol,'OPERADOR');
  assert.deepEqual(a.informeHallazgo.alcanceOperador.corrientesNoRegistradas,['Y21']);
  const intake=await db.antecedenteFiscalizacion.findMany({where:{origenId:a.id},orderBy:{id:'asc'}});assert.equal(intake.length,2);const intakeHash=hash(intake);
  assert.deepEqual((await list()).adendas[0].declaracion.residuos.map((r:any)=>[r.corriente,r.cantidad,r.unidad]),[['Y1',10,'kg']]);
  checks.push('quantity and omitted Y conserved in finding; independent generator/operator intake');
  const notices=()=>db.notificacion.findMany({where:{datos:{contains:a.id}},orderBy:{id:'asc'}});
  assert.equal((await notices()).filter((n:any)=>JSON.parse(n.datos).tipo==='adenda_manifiesto').length,2);
  const n0=await notices();await request('operador',endpoint,'POST',command,201);assert.deepEqual(await notices(),n0);
  await request('operador',endpoint,'POST',{...command,motivo:'Different'},409);
  checks.push('idempotent creation preserves exact notices and request identity');
  const path=endpoint+'/'+a.id,doc0=await pdf(path,0),review={id:randomUUID(),version:0,decision:'OBSERVADA',nota:'Generador: revisar medición recibida'};
  for(const role of process.env.MANIFEST_REVIEW_AUTHORITY_BY_ROLE==='true'?['operador']:['operador','admin'])await request(role,path+'/revisiones','POST',review,403);
  const first=(await request('generador',path+'/revisiones','POST',review)).adenda;assert.equal(first.version,1);assert.equal(first.revisiones[0].autor.rol,'GENERADOR');
  const n1=await notices();await request('generador',path+'/revisiones','POST',review);assert.deepEqual(await notices(),n1);
  await request('transportista',path+'/revisiones','POST',{...review,id:randomUUID(),decision:'APROBADA'},409);
  checks.push('counterpart observation, no self-review or undesignated admin review in account mode; stale version blocked and replay deduplicated');
  const resolve=(role:string,version:number,decision:string)=>request(role,path+'/revisiones','POST',{id:randomUUID(),version,decision,nota:role+': resolución artificial'});
  await resolve('transportista',1,'APROBADA');await resolve('generador',2,'RECHAZADA');
  const authorityNotices=await db.notificacion.findMany({where:{usuarioId:'adenda-qa-authority',datos:{contains:endpoint}}});assert.ok(authorityNotices.some((n:any)=>{const d=JSON.parse(n.datos);return d.corrientes.includes('Y21')&&d.adendaId===a.id&&d.versionAdenda===2&&d.reviewerId===f.users.transportista&&n.manifiestoId===m.id;}));
  const current=(await list()).adendas[0];assert.equal(current.estadoRevision,'RECHAZADA');assert.equal(current.revisiones.length,3);assert.deepEqual(current.revisiones.map((r:any)=>r.autor.rol),['GENERADOR','TRANSPORTISTA','GENERADOR']);
  assert.equal(hash(await db.antecedenteFiscalizacion.findMany({where:{origenId:a.id},orderBy:{id:'asc'}})),intakeHash);
  assert.equal((await pdf(path,0)).hash,doc0.hash);const doc=await pdf(path,3);writeFileSync(out+'/adenda-reviewed.pdf',doc.bytes);const text=execFileSync('pdftotext',['-raw',out+'/adenda-reviewed.pdf','-'],{encoding:'utf8'});assert.match(text,/RECHAZADA/);assert.match(text,/Y21/);assert.match(text,/hallazgo/i);
  checks.push('independent decisions and historic PDF/finding retained; current annex includes finding/reviews');
  const rect=(await request('operador',endpoint,'POST',{...input(),rectificaId:a.id},201)).adenda;assert.equal(rect.rectificaId,a.id);assert.equal((await db.adendaManifiesto.findUniqueOrThrow({where:{id:a.id}})).version,3);
  const other=await manifest();await request('operador',`/manifiestos/${other.id}/adendas`,'POST',{...input(),rectificaId:a.id},400);
  checks.push('rectification appends, original rejected record retained; cross-manifest link denied');
  const parallelInput=input();await Promise.all([1,2,3].map(()=>request('operador',endpoint,'POST',parallelInput,201)));
  assert.equal(await db.adendaManifiesto.count({where:{id:parallelInput.id}}),1);assert.equal(await db.notificacion.count({where:{datos:{contains:parallelInput.id},titulo:'Nueva adenda en tu manifiesto'}}),2);
  const versioned=endpoint+'/'+parallelInput.id+'/revisiones';const decisions=await Promise.all(['generador','transportista'].map(async role=>{const res=await fetch(base+versioned,{method:'POST',headers:{Authorization:'Bearer '+await token(role),'Content-Type':'application/json'},body:JSON.stringify({id:randomUUID(),version:0,decision:'APROBADA',nota:role+' concurrente'})});return res.status;}));assert.deepEqual(decisions.sort(),[200,409]);
  checks.push('concurrent creation once; one version decision wins, loser must refresh');
  const carrierManifest=await manifest('EN_TRANSITO');const carrier=(await request('transportista',`/manifiestos/${carrierManifest.id}/adendas`,'POST',input(),201)).adenda;assert.equal(carrier.informeHallazgo,null);assert.equal(await db.antecedenteFiscalizacion.count({where:{origenId:carrier.id}}),0);
  const carrierDecision=(await request('operador',`/manifiestos/${carrierManifest.id}/adendas/${carrier.id}/revisiones`,'POST',{id:randomUUID(),version:0,decision:'OBSERVADA',nota:'Operador pide verificación'})).adenda;assert.equal(carrierDecision.revisiones[0].autor.rol,'OPERADOR');
  checks.push('carrier difference stays distinct from destination operator finding; operator counterpart can observe');
  await db.usuario.update({where:{id:f.users.generador},data:{activo:false}});await db.transportista.update({where:{id:f.actors.transportista},data:{activo:false}});
  try{const inactive=input();await request('operador',endpoint,'POST',inactive,201);assert.equal(await db.notificacion.count({where:{datos:{contains:inactive.id},titulo:'Nueva adenda en tu manifiesto'}}),0);}finally{await db.usuario.update({where:{id:f.users.generador},data:{activo:true}});await db.transportista.update({where:{id:f.actors.transportista},data:{activo:true}});}
  checks.push('inactive recipient account or actor receives no new internal party notice');
  for(const original of [m,draft,other,carrierManifest])assert.equal(hash(await db.manifiesto.findUniqueOrThrow({where:{id:original.id},include:{residuos:true,eventos:true}})),hash(original));
  assert.equal((await list()).documental.cierreAcreditado,false);checks.push('manifest status/declaration/events unchanged; review does not certify documentary closure');
  writeFileSync(out+'/adenda-http.json',JSON.stringify({checks,manifestId:m.id,adendaId:a.id},null,2));
 }
 console.log(phase+': '+checks.length+' checks PASS');
}finally{await db.$disconnect();}
