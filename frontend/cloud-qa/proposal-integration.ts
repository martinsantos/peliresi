import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {assertCloudDatabase,backendRequire} from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
const out=process.env.QA_ARTIFACTS!,fixture=JSON.parse(readFileSync(out+'/fixture.json','utf8'));
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
const base='http://127.0.0.1:4177/api',sessions=new Map<string,string>(),passed:string[]=[],records:any[]=[];
async function token(role:string){
 if(!sessions.has(role)){
  const res=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.12.21.'+(sessions.size+1)},body:JSON.stringify({email:role+'@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'})});
  const body=await res.json();assert.equal(res.status,200,JSON.stringify(body));assert.notEqual(body.data.user?.training,true);sessions.set(role,body.data.tokens.accessToken);
 }
 return sessions.get(role)!;
}
async function request(role:string,route:string,method='GET',body?:unknown,status=200){
 const res=await fetch(base+route,{method,headers:{Authorization:'Bearer '+await token(role),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const json=await res.json();assert.equal(res.status,status,role+' '+route+' '+JSON.stringify(json));return json;
}
const body={generadorId:fixture.actors.generador,transportistaId:fixture.actors.transportista,operadorId:fixture.actors.operador,modalidad:'FIJO',fechaEstimadaRetiro:'2099-12-25',vehiculoId:'manifest-qa-second-vehicle',choferId:'manifest-qa-second-driver',residuos:[{tipoResiduoId:fixture.wastes[0],cantidad:15,unidad:'kg'}]};
const sharp=backendRequire('sharp');
const firma='data:image/png;base64,'+(await sharp(Buffer.from('<svg width="300" height="100"><rect width="300" height="100" fill="white"/><path d="M10 70 L40 20 L80 75 L120 15 L180 80 L270 30" stroke="black" stroke-width="3" fill="none"/></svg>')).png().toBuffer()).toString('base64');
const approve=(role:string,id:string,status=200)=>request(role,`/manifiestos/${id}/${role==='generador'?'firmar':'aprobar-parte'}`,'POST',role==='generador'?{firma}:{},status);
try{
 if(process.argv.includes('--flag-off')){
  const saved=JSON.parse(readFileSync(out+'/proposal-http.json','utf8')),id=saved.pendingId;
  await request('operador','/manifiestos','POST',body,403);
  await request('generador',`/manifiestos/${id}/aprobaciones`,'GET',undefined,404);
  await approve('generador',id,404);
  await request('transportista',`/manifiestos/${id}/confirmar-retiro`,'POST',{},409);
  await request('admin',`/manifiestos/${id}/revertir-estado`,'POST',{estado:'BORRADOR',motivo:'QA no bypass'},409);
  await request('admin',`/manifiestos/${id}`,'PUT',{observaciones:'QA bypass'},409);
  await request('admin',`/manifiestos/${saved.cancelledId}`,'DELETE',undefined,409);
  const legacy=(await request('generador','/manifiestos','POST',body,201)).data.manifiesto;
  assert.equal(legacy.estado,'BORRADOR');await request('generador',`/manifiestos/${legacy.id}/firmar`,'POST',{firma});
  assert.equal(await db.eventoManifiesto.count({where:{manifiestoId:legacy.id,tipo:'PROPUESTA_PARTES_V1'}}),0);
  passed.push('disabled feature closes proposal APIs; persisted approvals cannot be bypassed; legacy create/sign remains available');
  writeFileSync(out+'/proposal-flags-off.json',JSON.stringify({passed}));
 }else{
  for(const creator of ['generador','transportista','operador']){
   const m=(await request(creator,'/manifiestos','POST',body,201)).data.manifiesto;records.push(m);
   assert.equal(m.estado,'PENDIENTE_APROBACION');assert.equal(m.creadoPorId,fixture.users[creator]);
   assert.equal(m.asignacionTransporte.vehiculo.patente,'QA002ZZ');
   for(const role of ['generador','transportista','operador']){
    const p=(await request(role,`/manifiestos/${m.id}/aprobaciones`)).data;
    assert.equal(p.puedeAprobar,role.toUpperCase());assert.ok(p.partes.every((p:any)=>!p.aprobada));
    const tasks=(await request(role,'/manifiestos/tareas-partes')).data.items;
    assert.equal(tasks[0].id,m.id);assert.equal(tasks[0].requiereMiAprobacion,true);
   }
   await request('admin',`/manifiestos/${m.id}/aprobar-parte`,'POST',{},403);
   await request('transportista',`/manifiestos/${m.id}/confirmar-retiro`,'POST',{},409);
   await request('operador',`/manifiestos/${m.id}/iniciar-coordinacion`,'POST',{},409);
   await request('generador',`/manifiestos/${m.id}/firmar`,'POST',{},400);
   await approve('operador',m.id);await approve('operador',m.id);
   assert.equal((await request('operador','/manifiestos/tareas-partes')).data.items.find((v:any)=>v.id===m.id).requiereMiAprobacion,false);
   await Promise.all([approve('generador',m.id),approve('transportista',m.id),approve('transportista',m.id)]);
   const approved=(await request('generador',`/manifiestos/${m.id}/aprobaciones`)).data;
   assert.equal(approved.estado,'APROBADO');assert.equal(approved.partes.filter((p:any)=>p.aprobada).length,3);assert.equal(approved.inicio,null);
   await request('transportista',`/manifiestos/${m.id}/confirmar-retiro`,'POST',{},409);
   const validated=await request('transportista','/manifiestos/validar-qr','POST',{qrData:JSON.stringify({id:m.id,numero:m.numero})});assert.equal(validated.valid,true);
   const schedule=(await request('generador','/manifiestos/agenda-partes?search='+m.numero)).data;
   assert.equal(schedule.total,1);assert.equal(schedule.items[0].id,m.id);
   await Promise.all(['generador','transportista','operador'].map(role=>request(role,`/manifiestos/${m.id}/iniciar-coordinacion`,'POST',{})));
   assert.equal(await db.eventoManifiesto.count({where:{manifiestoId:m.id,tipo:'INICIO_COORDINACION'}}),1);
   const approvals=await db.eventoManifiesto.findMany({where:{manifiestoId:m.id,tipo:{in:['FIRMA','APROBACION_TRANSPORTISTA','APROBACION_OPERADOR']}}});
   assert.equal(approvals.length,3);assert.ok(approvals.every((e:any)=>/^[a-f0-9]{64}$/.test(e.integrityHash)));
   const notices=await db.notificacion.findMany({where:{manifiestoId:m.id}});
   assert.equal(notices.length,15);assert.deepEqual([...new Set(notices.map((n:any)=>n.usuarioId))].sort(),['generador','transportista','operador'].map(r=>fixture.users[r]).sort());
   assert.equal((await db.manifiesto.findUniqueOrThrow({where:{id:m.id}})).fechaRetiro,null);
   await request('transportista',`/manifiestos/${m.id}/confirmar-retiro`,'POST',{latitud:-32.89,longitud:-68.84});
   assert.equal((await db.manifiesto.findUniqueOrThrow({where:{id:m.id}})).estado,'EN_TRANSITO');
   passed.push(creator+': creation -> own explicit approval -> concurrent unanimity -> future agenda -> coordination -> physical pickup; 15 deduplicated notices');
  }
  const pending=(await request('operador','/manifiestos','POST',body,201)).data.manifiesto;
  for(const outsider of ['generador2','transportista2','operador2']){
   await request(outsider,`/manifiestos/${pending.id}/aprobaciones`,'GET',undefined,404);
   await request(outsider,`/manifiestos/${pending.id}/aprobar-parte`,'POST',{decision:'RECHAZADA',motivo:'QA intruso'},404);
   assert.ok(!(await request(outsider,'/manifiestos/tareas-partes')).data.items.some((m:any)=>m.id===pending.id));
  }
  for(const [role,field] of [['generador','generadorId'],['transportista','transportistaId'],['operador','operadorId']]) await request(role,'/manifiestos','POST',{...body,[field]:fixture.actors[role+'2']},403);
  await request('sin-actor','/manifiestos','POST',body,403);
  for(const extra of [{fechaEstimadaRetiro:undefined},{fechaEstimadaRetiro:'2026-02-31'},{vehiculoId:'night-qa-vehicle-2'},{choferId:'manifest-qa-inactive-driver'}]) await request('operador','/manifiestos','POST',{...body,...extra},400);
  await request('admin',`/manifiestos/${pending.id}`,'PUT',{operadorId:fixture.actors.operador2},409);
  await request('admin',`/manifiestos/${pending.id}/revertir-estado`,'POST',{estado:'BORRADOR',motivo:'QA no bypass'},409);
  await db.generador.update({where:{id:fixture.actors.generador2},data:{activo:false}});
  try { await request('operador','/manifiestos','POST',{...body,generadorId:fixture.actors.generador2},400); }
  finally { await db.generador.update({where:{id:fixture.actors.generador2},data:{activo:true}}); }
  passed.push('foreign, inactive or missing actor, forged ownership, invalid dates and foreign/inactive fleet denied; actors and proposal immutable');
  const rejected=(await request('transportista','/manifiestos','POST',body,201)).data.manifiesto;
  await request('operador',`/manifiestos/${rejected.id}/aprobar-parte`,'POST',{decision:'RECHAZADA',motivo:'QA no disponemos de capacidad'});
  await approve('generador',rejected.id,409);
  await request('transportista',`/manifiestos/${rejected.id}/confirmar-retiro`,'POST',{},409);
  await request('admin',`/manifiestos/${rejected.id}`,'DELETE',undefined,409);
  passed.push('reasoned rejection persists and blocks other approval, pickup and removal');
  const cancelled=(await request('generador','/manifiestos','POST',body,201)).data.manifiesto;
  await request('generador',`/manifiestos/${cancelled.id}/cancelar`,'POST',{motivo:'QA cancelación antes del retiro'});
  await approve('operador',cancelled.id,409);await request('generador',`/manifiestos/${cancelled.id}`,'DELETE',undefined,409);
  passed.push('cancellation preserves immutable history and rejects subsequent approval');
  const insitu=(await request('generador','/manifiestos','POST',{...body,modalidad:'IN_SITU',transportistaId:undefined,vehiculoId:undefined,choferId:undefined},201)).data.manifiesto;
  assert.equal(insitu.estado,'BORRADOR');assert.equal(insitu.transportistaId,null);
  await request('generador',`/manifiestos/${insitu.id}/firmar`,'POST',{firma});
  await request('operador',`/manifiestos/${insitu.id}/recepcion-insitu`,'POST',{});
  passed.push('existing in-situ two-party creation, signature and reception unchanged');
  const legacy=await db.manifiesto.findUniqueOrThrow({where:{id:'manifest-qa-legacy'},include:{residuos:true,eventos:true}});
  assert.equal(JSON.stringify(legacy),readFileSync(out+'/manifest-legacy-before.json','utf8'));
  passed.push('legacy historical manifest unchanged byte-for-byte');
  writeFileSync(out+'/proposal-http.json',JSON.stringify({passed,pendingId:pending.id,cancelledId:cancelled.id,records:records.map(m=>({id:m.id,numero:m.numero})),capClosed:true,externalDelivery:false},null,2));
 }
 console.log(passed);
}finally{await db.$disconnect();}
