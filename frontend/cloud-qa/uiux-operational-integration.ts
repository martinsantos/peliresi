/** Full business flow against the existing private preview, never a production endpoint. */
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
const out=process.env.QA_ARTIFACTS!;
const f:{users:Record<string,string>;actors:Record<string,string>;wastes:string[]}={users:{},actors:{},wastes:[]};
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
const previous=existsSync(out+'/operational-http.json')?JSON.parse(readFileSync(out+'/operational-http.json','utf8')):null;
const resume=previous&&!previous.complete&&previous.created?.length===3;
const base='http://127.0.0.1:4177/api',tokens=new Map<string,string>(),checks:string[]=resume?previous.checks:[],created:any[]=resume?previous.created:[];
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function token(role:string){
  if(!tokens.has(role)){
    const res=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.11.25.'+(tokens.size+1)},body:JSON.stringify({email:role+'@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'})});
    const body=await res.json();assert.equal(res.status,200);assert.notEqual(body.data.user.training,true);tokens.set(role,body.data.tokens.accessToken);
  }
  return tokens.get(role)!;
}
async function request(role:string,path:string,method='GET',body?:unknown,status=200){
  const res=await fetch(base+path,{method,headers:{Authorization:'Bearer '+await token(role),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await res.json();assert.equal(res.status,status,role+' '+path+' '+JSON.stringify(result));return result;
}
const sharp=backendRequire('sharp');
const signature='data:image/png;base64,'+(await sharp(Buffer.from('<svg width="300" height="100"><rect width="300" height="100" fill="white"/><path d="M10 70 L40 20 L80 75 L120 15 L180 80 L270 30" stroke="black" stroke-width="3" fill="none"/></svg>')).png().toBuffer()).toString('base64');
const before=await db.manifiesto.findMany({where:{id:{notIn:created.map(m=>m.id)}},orderBy:{id:'asc'},include:{residuos:{orderBy:{id:'asc'}},eventos:{orderBy:{id:'asc'}}}});
const beforeHash=hash(before),priorIds=before.map((m:any)=>m.id);
const checkpoint=()=>writeFileSync(out+'/operational-http.json',JSON.stringify({at:new Date().toISOString(),checks,created,priorCount:before.length,complete:false},null,2));
try{
  for(const role of ['generador','transportista','operador']){
    const user=await db.usuario.findUniqueOrThrow({where:{email:role+'@night-qa.invalid'},include:{generador:true,transportista:true,operador:true}});assert.equal(user.activo,true);assert.match(user[role].razonSocial,/^QA /);f.users[role]=user.id;f.actors[role]=user[role].id;
  }
  f.wastes=[(await db.tipoResiduo.findFirstOrThrow({where:{codigo:'Y1'}})).id];
  const vehicle=await db.vehiculo.findFirstOrThrow({where:{transportistaId:f.actors.transportista,activo:true,vencimiento:{gt:new Date()}}}),driver=await db.chofer.findFirstOrThrow({where:{transportistaId:f.actors.transportista,activo:true,vencimiento:{gt:new Date()}}});
  const treatment=await db.tratamientoAutorizado.findFirst({where:{operadorId:f.actors.operador,activo:true}}),method=treatment?.metodo||'QA tratamiento artificial';
  for(const creator of ['generador','transportista','operador']){
    if(created.some(m=>m.creator===creator)){assert.ok(checks.some(c=>c.startsWith(creator+': creación')));continue;}
    const m=(await request(creator,'/manifiestos','POST',{generadorId:f.actors.generador,transportistaId:f.actors.transportista,operadorId:f.actors.operador,modalidad:'FIJO',fechaEstimadaRetiro:'2099-12-25',vehiculoId:vehicle.id,choferId:driver.id,observaciones:'QA UIUX integral 20261025 · datos artificiales',residuos:[{tipoResiduoId:f.wastes[0],cantidad:10,unidad:'kg'}]},201)).data.manifiesto;
    created.push({id:m.id,numero:m.numero,creator});checkpoint();
    // Mark only this new synthetic row so it stays excluded from any future delivery.
    await db.manifiesto.update({where:{id:m.id},data:{isDemoData:true}});
    assert.equal(m.estado,'PENDIENTE_APROBACION');
    const detail=(await request(creator,`/manifiestos/${m.id}`)).data.manifiesto;
    const configured=detail.eventos.find((event:any)=>event.tipo==='CERTIFICACION_OPERADOR_V1');
    assert.ok(configured, 'Certificate-management event exists at creation');
    assert.equal(configured.descripcion,'Gestión de certificados configurada; emisión sujeta a las condiciones del manifiesto');
    assert.ok(!detail.eventos.some((event:any)=>event.tipo==='CERTIFICADO_OPERADOR_V1'), 'No certificate is issued at creation');
    for(const role of ['generador','transportista','operador']){
      const approvals=(await request(role,`/manifiestos/${m.id}/aprobaciones`)).data;assert.equal(approvals.partes.length,3);assert.ok(approvals.partes.every((p:any)=>!p.aprobada));
      assert.ok(await db.notificacion.count({where:{manifiestoId:m.id,usuarioId:f.users[role]}})>0);
    }
    await request('transportista',`/manifiestos/${m.id}/confirmar-retiro`,'POST',{},409);
    await request('generador',`/manifiestos/${m.id}/firmar`,'POST',{firma:signature});
    await request('operador',`/manifiestos/${m.id}/aprobar-parte`,'POST',{});
    await request('operador',`/manifiestos/${m.id}/iniciar-coordinacion`,'POST',{},409);
    await request('transportista',`/manifiestos/${m.id}/aprobar-parte`,'POST',{});
    const all=(await request('generador',`/manifiestos/${m.id}/aprobaciones`)).data;assert.ok(all.partes.every((p:any)=>p.aprobada));assert.equal(all.estado,'APROBADO');
    await request('transportista',`/manifiestos/${m.id}/confirmar-retiro`,'POST',{},409);
    const agenda=(await request(creator,'/manifiestos/agenda-partes?search='+encodeURIComponent(m.numero))).data;assert.equal(agenda.total,1);assert.ok(agenda.items[0].generador.razonSocial);assert.ok(agenda.items[0].operador.razonSocial);
    await request(creator,`/manifiestos/${m.id}/iniciar-coordinacion`,'POST',{});
    await request('transportista',`/manifiestos/${m.id}/confirmar-retiro`,'POST',{});
    await request('transportista',`/manifiestos/${m.id}/ubicacion`,'POST',{latitud:-32.89,longitud:-68.84});
    checks.push(creator+': creación sin certificado emitido, aviso a las tres partes, 0→3 aprobaciones, bloqueos previos, agenda con nombres, coordinación y retiro');checkpoint();
  }
  const ids=created.map(m=>m.id);
  const transit=(await request('admin','/centro-control/actividad?capas=transito')).data.enTransito;
  for(const m of created)assert.ok(transit.some((v:any)=>v.manifiestoId===m.id));
  checks.push('Tres viajes simultáneos visibles en Centro de control con GPS artificial');
  const first=created[0];
  const leg=(await request('transportista',`/manifiestos/${first.id}/tramos`,'POST',{id:randomUUID(),anteriorId:null,tipo:'EXTERNO',datos:{empresa:'QA auxiliar eventual',patente:'QA-UX-001'},motivo:'Rotura artificial durante QA'},201)).data;
  await request('transportista',`/manifiestos/${first.id}/ubicacion`,'POST',{latitud:-32.90,longitud:-68.85},409);
  const gps=await fetch(base+`/seguimiento-relevo/${leg.tramo.id}/ubicacion`,{method:'POST',headers:{Authorization:'Bearer '+leg.acceso,'Content-Type':'application/json'},body:JSON.stringify({latitud:-32.91,longitud:-68.86,precision:12})});assert.equal(gps.status,200);
  const monitored=(await request('admin','/centro-control/actividad?capas=transito')).data.enTransito.find((v:any)=>v.manifiestoId===first.id);assert.equal(monitored.tramoActual.id,leg.tramo.id);assert.ok(monitored.ultimaPosicion);
  checks.push('Relevo eventual: origen deja de transmitir, nuevo tramo recibe GPS y Monitor distingue el tramo');checkpoint();
  for(const m of created){
    await request('transportista',`/manifiestos/${m.id}/confirmar-entrega`,'POST',{});
    await request('operador',`/manifiestos/${m.id}/confirmar-recepcion`,'POST',{});
    const loaded=(await request('operador',`/manifiestos/${m.id}`)).data.manifiesto;
    const residue=loaded.residuos[0];
    await request('operador',`/manifiestos/${m.id}/pesaje`,'POST',{residuos:[{id:residue.id,cantidadRecibida:11}]});
    const adenda=(await request('operador',`/manifiestos/${m.id}/adendas`,'POST',{id:randomUUID(),motivo:'QA Hallazgo: 11 kg recibidos frente a 10 kg declarados',residuos:[{corriente:'Y1',cantidad:11,unidad:'kg'}]},201)).data.adenda;
    assert.ok(adenda.informeHallazgo);assert.ok(adenda.informeHallazgo.diferencias.some((d:any)=>d.tipo==='CANTIDAD_DIFERENTE'));
    const review=`/manifiestos/${m.id}/adendas/${adenda.id}/revisiones`;
    await request('generador',review,'POST',{id:randomUUID(),version:0,decision:'OBSERVADA',nota:'QA verificar pesaje'});
    await request('transportista',review,'POST',{id:randomUUID(),version:0,decision:'APROBADA',nota:'QA versión antigua'},409);
    await request('operador',`/manifiestos/${m.id}/tratamiento`,'POST',{metodo:method});
    const cert={id:randomUUID(),tipo:'PARCIAL',firma:signature,metodo:method,cantidades:[{residuoId:residue.id,cantidad:4}]};
    const partial=(await request('operador',`/manifiestos/${m.id}/certificados`,'POST',cert,201)).data;
    await request('operador',`/manifiestos/${m.id}/cerrar`,'POST',{});
    const final={...cert,id:randomUUID(),tipo:'FINAL',cantidades:[{residuoId:residue.id,cantidad:11}]};
    await request('operador',`/manifiestos/${m.id}/certificados`,'POST',final,409);
    await request('transportista',review,'POST',{id:randomUUID(),version:1,decision:'APROBADA',nota:'QA transporte confirma medición'});
    await request('generador',review,'POST',{id:randomUUID(),version:2,decision:'APROBADA',nota:'QA generador confirma medición'});
    const issued=(await request('operador',`/manifiestos/${m.id}/certificados`,'POST',final,201)).data;
    for(const role of ['generador','transportista','operador']){
      const list=(await request(role,`/manifiestos/${m.id}/certificados`)).data;assert.ok(list.some((d:any)=>d.id===issued.id));assert.ok(list.some((d:any)=>d.id===partial.id));
      const pdf=await fetch(base+`/manifiestos/${m.id}/certificados/${issued.id}/archivo`,{headers:{Authorization:'Bearer '+await token(role)}});assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type')!,/application\/pdf/);
      const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),issued.pdfSha256);
      if(role==='generador')writeFileSync(out+'/'+m.creator+'-final.pdf',bytes);
    }
    for(const role of ['generador','transportista'])assert.ok(await db.notificacion.count({where:{manifiestoId:m.id,usuarioId:f.users[role],datos:{contains:issued.id}}})>0);
    await request('generador2',`/manifiestos/${m.id}/certificados`,'GET',undefined,404);
    Object.assign(m,{adendaId:adenda.id,partialId:partial.id,finalId:issued.id});
    checks.push(m.creator+': recepción, pesaje, hallazgo, observación, conflicto de versión, parcial, cierre, final bloqueado y luego recibido por las tres partes');checkpoint();
  }
  assert.equal(hash(await db.manifiesto.findMany({where:{id:{in:priorIds}},orderBy:{id:'asc'},include:{residuos:{orderBy:{id:'asc'}},eventos:{orderBy:{id:'asc'}}}})),beforeHash);
  assert.equal(await db.manifiesto.count(),before.length+created.length);
  assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
  checks.push('Manifiestos anteriores intactos; cero envíos e intentos de correo; ningún proveedor externo habilitado');
  writeFileSync(out+'/operational-http.json',JSON.stringify({at:new Date().toISOString(),checks,created,priorCount:before.length,finalCount:before.length+ids.length,complete:true,emailsSent:0,emailAttempts:0},null,2));
  console.log('Operational integration PASS: '+checks.length+' grouped checks');
} catch(error) { checkpoint(); console.error(String(error).slice(-1800)); process.exitCode=1; } finally { await db.$disconnect(); }
