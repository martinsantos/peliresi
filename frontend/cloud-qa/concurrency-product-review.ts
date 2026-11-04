import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {spawn} from 'node:child_process';
import {assertCloudDatabase,assertCloudEnvironment,backendRequire} from './safety.ts';

// Diagnostic, bounded and synthetic. Never interpret this bounded preview
// as a capacity certificate for production, physical phones or delivered mail.
await assertCloudDatabase();
const out=process.env.QA_ARTIFACTS!,schema='proposal_operations_20261021';
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),schema);
for(const process of JSON.parse(readFileSync(out+'/processes.json','utf8'))){
 const env=Object.fromEntries(readFileSync(`/proc/${process.pid}/environ`,'utf8').split('\0').filter(Boolean).map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
 assertCloudEnvironment(env);assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'),schema);
 assert.equal(env.TRAINING_DATABASE_URL,'');assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
 assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED,'false');assert.equal(env.EMAIL_NOTIFICATION_FAMILIES,'');assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED,'false');
}
const fixture=JSON.parse(readFileSync(out+'/fixture.json','utf8'));
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
const base='http://127.0.0.1:3037/api',run=randomUUID(),prefix='QA-CONC-'+run.slice(0,8),tokens=new Map<string,string>();
const roles=['generador','transportista','operador','admin','inspector','jefe-generadores','jefe-transporte','jefe-operadores','transportista2'];
const requests:any[]=[],checks:any[]=[],records:string[]=[],observations:Record<string,unknown>={};
const startedAt=new Date().toISOString();
const secondary=process.env.QA_SECONDARY_API;
if(secondary)assert.equal(secondary,'http://127.0.0.1:3038/api');
if(process.env.QA_REQUIRE_SECONDARY_API==='true')assert.ok(secondary,'The cluster regression requires a second API in the same preview cgroup');
const browserFixture:any={run,database:'sitrep_night_qa_20260926',previewOnly:true,externalDelivery:false,assigned:[],handoffs:[],longTrip:null};
let extraSequence=200;
async function syntheticTrip(){const row=await db.manifiesto.create({data:manifestData(extraSequence++,'EN_TRANSITO')});records.push(row.id);return row;}
async function incidentProcesses(event:unknown,count=100){
 // Both consumers inherit this exact isolated DB and share the container limits.
 // The stdin barrier starts both processes only after they loaded the subscriber.
 const childSource=`const {eventoManifiestoSubscriber:consume}=require(process.env.QA_CONSUMER_MODULE);const db=require(process.env.QA_PRISMA_MODULE).default;process.stdout.write('READY\\n');process.stdin.once('data',async()=>{try{await Promise.all(Array.from({length:Number(process.env.QA_ATTEMPTS)},()=>consume(JSON.parse(process.env.QA_EVENT))));process.stdout.write(JSON.stringify({pid:process.pid,completed:Number(process.env.QA_ATTEMPTS)})+'\\n')}catch(error){process.stderr.write(String(error));process.exitCode=1}finally{await db.$disconnect();process.stdin.destroy()}});`;
 const children=Array.from({length:2},()=>{
  const child=spawn(process.execPath,['-e',childSource],{env:{...process.env,QA_CONSUMER_MODULE:backendRequire.resolve('./dist/subscribers/eventoManifiesto.subscriber.js'),QA_PRISMA_MODULE:backendRequire.resolve('./dist/lib/prisma.js'),QA_ATTEMPTS:String(count/2),QA_EVENT:JSON.stringify(event)},stdio:['pipe','pipe','pipe']});
  let output='',errors='';let readyResolve:()=>void,readyReject:(error:Error)=>void;
  const ready=new Promise<void>((resolve,reject)=>{readyResolve=resolve;readyReject=reject});
  child.stdout.on('data',data=>{output+=data.toString();if(output.includes('READY\n'))readyResolve()});
  child.stderr.on('data',data=>{errors+=data.toString()});
  const timer=setTimeout(()=>child.kill('SIGTERM'),45000);
  const done=new Promise<any>((resolve,reject)=>{child.on('error',error=>{readyReject(error);reject(error)});child.on('exit',code=>{clearTimeout(timer);if(code!==0){const error=new Error('Incident consumer failed: '+errors+' '+output);readyReject(error);reject(error)}else resolve(JSON.parse(output.trim().split('\n').at(-1)!))})});
  // Attach rejection immediately, while retaining the rejecting promise for the barrier.
  void done.catch(()=>{});return {child,ready,done};
 });
 try{await Promise.all(children.map(c=>c.ready));children.forEach(c=>c.child.stdin.end('start'));const results=await Promise.all(children.map(c=>c.done));assert.equal(new Set(results.map(r=>r.pid)).size,2);assert.equal(results.reduce((sum,r)=>sum+r.completed,0),count);return results}
 finally{for(const c of children)if(c.child.exitCode===null)c.child.kill('SIGTERM')}
}

async function request(group:string,role:string,route:string,method='GET',body?:unknown,ip?:string,server=base,accessToken?:string){
 const begin=performance.now();
 try{
  const res=await fetch(server+route,{method,signal:AbortSignal.timeout(30000),headers:{
   'X-Forwarded-For':ip||`127.51.1.${roles.indexOf(role)+1}`,Authorization:'Bearer '+(accessToken??tokens.get(role)??''),'Content-Type':'application/json'},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const raw=Buffer.from(await res.arrayBuffer()),text=raw.toString();let data:any;try{data=JSON.parse(text)}catch{data=res.headers.get('content-type')?.includes('application/pdf')?{pdf:raw.subarray(0,5).toString()==='%PDF-',bytes:raw.length}:{message:text.slice(0,200)}}
  const row={group,role,method,status:res.status,retryAfter:res.headers.get('retry-after'),server,ms:Math.round(performance.now()-begin),bytes:raw.length};
  requests.push(row);return {...row,data};
 }catch(error){const row={group,role,method,status:0,ms:Math.round(performance.now()-begin),bytes:0,error:String(error)};requests.push(row);return {...row,data:null};}
}
async function checked(group:string,role:string,route:string,method='GET',body?:unknown,status=200){
 const result=await request(group,role,route,method,body);assert.equal(result.status,status,group+': '+JSON.stringify(result.data));return result.data;
}
async function check(name:string,fn:()=>Promise<void>){try{await fn();checks.push({name,status:'PASS'});console.log('PASS '+name)}catch(e){checks.push({name,status:'FAIL',error:String(e)});console.log('FINDING '+name+': '+String(e))}}
const manifestData=(n:number,state:'EN_TRANSITO'|'RECIBIDO')=>({id:`${prefix}-${n}`,numero:`${prefix}-${n}`,estado:state,
 generadorId:fixture.actors.generador,transportistaId:fixture.actors.transportista,operadorId:fixture.actors.operador,
 creadoPorId:fixture.users.operador,isDemoData:true,fechaRetiro:new Date(),...(state==='RECIBIDO'?{fechaRecepcion:new Date()}:{}),
 residuos:{create:[{tipoResiduoId:fixture.wastes[0],cantidad:15,unidad:'kg',estado:'SOLIDO'}]}});
try{
 const before=await db.manifiesto.findUniqueOrThrow({where:{id:'manifest-qa-legacy'},include:{residuos:true,eventos:true}});
 assert.equal(JSON.stringify(before),readFileSync(out+'/manifest-legacy-before.json','utf8'));
 for(const role of roles){const data=await checked('setup-login',role,'/auth/login','POST',{email:role+'@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'});assert.notEqual(data.data.user.training,true);tokens.set(role,data.data.tokens.accessToken)}
 // Direct insertion is only fixture setup. Every measured action goes through HTTP.
 for(let n=0;n<121;n++){const row=await db.manifiesto.create({data:manifestData(n,n<101?'EN_TRANSITO':'RECIBIDO')});records.push(row.id)}
 const waste=await db.tipoResiduo.findUniqueOrThrow({where:{id:fixture.wastes[0]}});
 const adendas:any[]=[];for(let n=101;n<121;n++){
  const data=await checked('setup-addendum','operador',`/manifiestos/${records[n]}/adendas`,'POST',
   {id:randomUUID(),motivo:'QA concurrencia: diferencia artificial de cantidad',residuos:[{corriente:waste.codigo,cantidad:16,unidad:'kg'}]},201);
  adendas.push({manifest:records[n],id:data.data.adenda.id});
 }
 const proposalBody={generadorId:fixture.actors.generador,transportistaId:fixture.actors.transportista,operadorId:fixture.actors.operador,
  modalidad:'FIJO',fechaEstimadaRetiro:'2099-12-25',vehiculoId:'manifest-qa-second-vehicle',choferId:'manifest-qa-second-driver',
  observaciones:prefix,residuos:[{tipoResiduoId:fixture.wastes[0],cantidad:15,unidad:'kg'}]};
 const proposals:any[]=[];for(let n=0;n<20;n++)proposals.push((await checked('setup-proposal','operador','/manifiestos','POST',{
  ...proposalBody,...(n%2?{vehiculoId:'night-qa-vehicle-1',choferId:'night-qa-driver-1'}:{})
 },201)).data.manifiesto);
 records.push(...proposals.map(row=>row.id));
 const gps=(n:number,group:string)=>request(group,'transportista',`/manifiestos/${records[n]}/ubicacion`,'POST',{latitud:-32.88+n*.00001,longitud:-68.84,velocidad:15,direccion:180});
 for(const size of [50,100,200]){
  const jobs:Array<()=>Promise<any>>=[];
  for(let n=0;n<size/2;n++)jobs.push(()=>gps(n,`burst-${size}/gps`));
  for(let n=0;n<size/4;n++)jobs.push(()=>request(`burst-${size}/notices`,roles[n%8],'/notificaciones?limit=5'));
  for(let n=0;n<Math.floor(size/10);n++)jobs.push(()=>request(`burst-${size}/monitor`,'admin','/centro-control/monitor-live'));
  let n=0;while(jobs.length<size){const i=n++;if(i%2===0){const m=proposals[Math.floor(i/2)%20];jobs.push(()=>request(`burst-${size}/approval`,'transportista',`/manifiestos/${m.id}/aprobar-parte`,'POST',{}))}
   else {const a=adendas[Math.floor(i/2)%20];const version=await db.adendaManifiesto.findUniqueOrThrow({where:{id:a.id},select:{version:true}});
    const command={id:randomUUID(),version:version.version,nota:'QA revisión artificial concurrente',decision:'APROBADA'};
    jobs.push(()=>request(`burst-${size}/addendum`,'generador',`/manifiestos/${a.manifest}/adendas/${a.id}/revisiones`,'POST',command));}}
  const begin=performance.now(),rows=await Promise.all(jobs.map(job=>job()));
  observations[`burst-${size}`]={launched:jobs.length,wallMs:Math.round(performance.now()-begin),successful:rows.filter(r=>r.status===200).length,statuses:rows.reduce((a,r)=>({...a,[r.status]:(a[r.status]||0)+1}),{})};
  await check(`${size} mixed simultaneous HTTP actions all return 200`,async()=>{assert.equal(rows.filter(r=>r.status!==200).length,0,JSON.stringify(observations[`burst-${size}`]))});
  if(rows.some(r=>r.status===0))break; // Stop escalation after a transport timeout.
 }
 await check('five generated PDFs remain valid while GPS and Monitor continue',async()=>{
  const documents=records.slice(0,5).map(id=>request('pdf-burst','operador',`/pdf/manifiesto/${id}`));
  const rows=await Promise.all([...documents,gps(0,'pdf-burst/gps'),request('pdf-burst/monitor','admin','/centro-control/monitor-live')]);
  assert.ok(rows.every(r=>r.status===200));assert.ok(rows.slice(0,5).every(r=>r.data.pdf&&r.data.bytes>1000));
 });
 await check('every acknowledged GPS point is persisted and latest points reach Monitor',async()=>{
  const accepted=requests.filter(r=>(r.group.startsWith('burst-')||r.group.startsWith('pdf-burst'))&&r.group.endsWith('/gps')&&r.status===200).length;
  assert.equal(await db.trackingGPS.count({where:{manifiestoId:{in:records.slice(0,100)}}}),accepted);
  const data=(await checked('read-back','admin','/centro-control/monitor-live')).data;
  const tracked=await db.trackingGPS.groupBy({by:['manifiestoId'],where:{manifiestoId:{in:records.slice(0,100)}},_count:true});
  for(const m of tracked){const shown=data.enTransito.find((r:any)=>r.manifiestoId===m.manifiestoId);assert.ok(shown?.ultimaPosicion);const latest=await db.trackingGPS.findFirst({where:{manifiestoId:m.manifiestoId},orderBy:{timestamp:'desc'}});assert.equal(shown.ultimaPosicion.timestamp,latest.timestamp.toISOString())}
 });
 await check('unrelated carrier cannot write or read the synthetic trip',async()=>{
  assert.equal((await request('permission','transportista2',`/manifiestos/${records[0]}/ubicacion`,'POST',{latitud:-32.88,longitud:-68.84})).status,404);
  assert.equal((await request('permission','transportista2',`/manifiestos/${records[0]}/viaje-actual`)).status,404);
 });
 await check('20 repeated approvals persist one decision and one notice per recipient/phase',async()=>{
  const m=proposals[19];const rows=await Promise.all(Array.from({length:20},()=>request('approval-race','transportista',`/manifiestos/${m.id}/aprobar-parte`,'POST',{})));
  assert.ok(rows.every(r=>r.status===200));assert.equal(await db.eventoManifiesto.count({where:{manifiestoId:m.id,tipo:'APROBACION_TRANSPORTISTA'}}),1);
  const notices=await db.notificacion.findMany({where:{manifiestoId:m.id}});const keys=notices.map((n:any)=>n.usuarioId+':'+JSON.parse(n.datos||'{}').fase);assert.equal(new Set(keys).size,keys.length);
 });
 await check('two different decisions on the same addendum version give one success and one conflict',async()=>{
  const a=adendas[19];const saved=await db.adendaManifiesto.findUniqueOrThrow({where:{id:a.id}});
  const rows=await Promise.all(['APROBADA','OBSERVADA'].map(decision=>request('addendum-race','generador',`/manifiestos/${a.manifest}/adendas/${a.id}/revisiones`,'POST',{id:randomUUID(),version:saved.version,nota:'QA conflicto explícito',decision})));
  assert.deepEqual(rows.map(r=>r.status).sort(),[200,409]);assert.equal((await db.adendaManifiesto.findUniqueOrThrow({where:{id:a.id}})).version,saved.version+1);
 });
 await check('Monitor distinguishes the assigned vehicles of two simultaneous trips of the same carrier',async()=>{
  const sharp=backendRequire('sharp'),firma='data:image/png;base64,'+(await sharp(Buffer.from('<svg width="300" height="100"><path d="M10 70L40 20L80 75L120 15L180 80L270 30" stroke="black" stroke-width="3" fill="none"/></svg>')).png().toBuffer()).toString('base64');
  const expected:any[]=[];
  for(const index of [18,19]){
   const m=proposals[index];await checked('assigned-vehicle','operador',`/manifiestos/${m.id}/aprobar-parte`,'POST',{});
   await checked('assigned-vehicle','transportista',`/manifiestos/${m.id}/aprobar-parte`,'POST',{});
   await checked('assigned-vehicle','generador',`/manifiestos/${m.id}/firmar`,'POST',{firma});
   await checked('assigned-vehicle','operador',`/manifiestos/${m.id}/iniciar-coordinacion`,'POST',{});
   await checked('assigned-vehicle','transportista',`/manifiestos/${m.id}/confirmar-retiro`,'POST',{latitud:-32.88,longitud:-68.84});
   const assigned=await db.vehiculo.findUniqueOrThrow({where:{id:index%2?'night-qa-vehicle-1':'manifest-qa-second-vehicle'},select:{patente:true}});
   const snapshot=await db.manifiesto.findUniqueOrThrow({where:{id:m.id},select:{asignacionTransporte:true}});
   const driver=snapshot.asignacionTransporte.chofer;
   expected.push({id:m.id,numero:m.numero,expected:assigned.patente,driver:driver.nombre+' '+driver.apellido});
  }
  const data=(await checked('assigned-vehicle','admin','/centro-control/monitor-live')).data;
  const comparisons=expected.map(row=>({...row,shown:data.enTransito.find((r:any)=>r.manifiestoId===row.id)?.vehiculo?.patente,shownDriver:data.enTransito.find((r:any)=>r.manifiestoId===row.id)?.chofer?.nombre}));
  observations.assignedVehicles=comparisons;
  assert.ok(comparisons.every(row=>row.expected===row.shown&&row.driver===row.shownDriver),JSON.stringify(comparisons));
  browserFixture.assigned=expected;
  const legacy=data.enTransito.find((r:any)=>r.manifiestoId===records[0]);
  assert.equal(legacy.vehiculo,null);assert.equal(legacy.chofer,null);
  // Relays use separate new trips; the two original assignments stay available for UI.
  for(const tipo of ['REGISTRADO','EXTERNO']){
   const m=await syntheticTrip();await checked('handoff-origin','transportista',`/manifiestos/${m.id}/ubicacion`,'POST',{latitud:-32.88,longitud:-68.84});
   let relaySelection:any;
   if(tipo==='REGISTRADO'){
    const vehicle=await db.vehiculo.create({data:{id:prefix+'-relay-vehicle',transportistaId:fixture.actors.transportista2,patente:'QAREL99',marca:'QA',modelo:'Relevo',anio:2026,capacidad:1000,numeroHabilitacion:'QA-'+run,vencimiento:new Date('2099-01-01')}});
    const driver=await db.chofer.create({data:{id:prefix+'-relay-driver',transportistaId:fixture.actors.transportista2,nombre:'QA',apellido:'Chofer relevo',dni:'99999999',licencia:'QA-'+run,vencimiento:new Date('2099-01-01'),telefono:'000000000'}});
    relaySelection={transportistaId:fixture.actors.transportista2,vehiculoId:vehicle.id,choferId:driver.id};
   }
   const legId=randomUUID();const datos=tipo==='EXTERNO'?{empresa:'QA Relevo eventual '+prefix,patente:'QAEXT99',chofer:'QA Chofer eventual'}:{};
   const relay=await checked('handoff-create','transportista',`/manifiestos/${m.id}/tramos`,'POST',{id:legId,anteriorId:null,tipo,motivo:'QA rotura artificial: comprobar identidad de tramo',datos,...(tipo==='REGISTRADO'?relaySelection:{})},201);
   const pending=(await checked('handoff-waiting','admin','/centro-control/monitor-live')).data.enTransito.find((r:any)=>r.manifiestoId===m.id);
   assert.equal(pending.tramoActual.id,legId);assert.equal(pending.ultimaPosicion,null);assert.deepEqual(pending.ruta,[]);
   assert.equal((await request('handoff-revoked-original','transportista',`/manifiestos/${m.id}/ubicacion`,'POST',{latitud:-32.89,longitud:-68.85})).status,409);
   const point={latitud:-32.9-extraSequence*.00001,longitud:-68.85,velocidad:22};
   const received=await request('handoff-gps','transportista',`/seguimiento-relevo/${legId}/ubicacion`,'POST',point,undefined,base,relay.data.acceso);assert.equal(received.status,200,JSON.stringify(received.data));
   const current=(await checked('handoff-current','admin','/centro-control/monitor-live')).data.enTransito.find((r:any)=>r.manifiestoId===m.id);
   const expectedVehicle=tipo==='EXTERNO'?'QAEXT99':'QAREL99',expectedDriver=tipo==='EXTERNO'?'QA Chofer eventual':'QA Chofer relevo';
   assert.equal(current.vehiculo.patente,expectedVehicle);assert.equal(current.chofer.nombre,expectedDriver);assert.equal(current.ultimaPosicion.latitud,point.latitud);assert.equal(current.ruta.length,1);assert.equal(current.tramoActual.gpsRecibido,true);
   browserFixture.handoffs.push({id:m.id,numero:m.numero,expected:expectedVehicle,driver:expectedDriver,tipo,point});
  }
 });
 await check('100 duplicate GPS incidents across two processes persist once and keep independent classes, manifests and windows',async()=>{
  const {eventoManifiestoSubscriber}=backendRequire('./dist/subscribers/eventoManifiesto.subscriber.js');
  const m=await syntheticTrip(),other=await syntheticTrip(),inside=await syntheticTrip(),outside=await syntheticTrip(),failed=await syntheticTrip();
  const event={type:'TIEMPO_EXCESIVO',manifiestoId:m.id,horasTransito:25,numero:m.numero,userId:fixture.users.transportista};
  const consumers=await incidentProcesses(event,100);assert.equal(await db.eventoManifiesto.count({where:{manifiestoId:m.id,tipo:'INCIDENTE'}}),1);
  await Promise.all([eventoManifiestoSubscriber({...event,manifiestoId:other.id}),eventoManifiestoSubscriber({...event,type:'DESVIO_RUTA',distanciaKm:100}),eventoManifiestoSubscriber({...event,type:'ANOMALIA_GPS',tipoAnomalia:'QA_DISTINCT',descripcion:'QA anomalía independiente',severidad:'ALTA'})]);
  assert.equal(await db.eventoManifiesto.count({where:{manifiestoId:m.id,tipo:'INCIDENTE'}}),3);assert.equal(await db.eventoManifiesto.count({where:{manifiestoId:other.id,tipo:'INCIDENTE'}}),1);
  for(const [trip,minutes] of [[inside,29],[outside,31]] as const)await db.eventoManifiesto.create({data:{manifiestoId:trip.id,tipo:'INCIDENTE',usuarioId:fixture.users.transportista,descripcion:'Tiempo de tránsito excesivo: QA anterior',createdAt:new Date(Date.now()-minutes*60000)}});
  await incidentProcesses({...event,manifiestoId:inside.id},20);await incidentProcesses({...event,manifiestoId:outside.id},20);
  assert.equal(await db.eventoManifiesto.count({where:{manifiestoId:inside.id,tipo:'INCIDENTE'}}),1);assert.equal(await db.eventoManifiesto.count({where:{manifiestoId:outside.id,tipo:'INCIDENTE'}}),2);
  await assert.rejects(()=>eventoManifiestoSubscriber({...event,manifiestoId:failed.id,userId:prefix+'-missing-user'}));
  assert.equal(await db.eventoManifiesto.count({where:{manifiestoId:failed.id,tipo:'INCIDENTE'}}),0);
  await incidentProcesses({...event,manifiestoId:failed.id},20);assert.equal(await db.eventoManifiesto.count({where:{manifiestoId:failed.id,tipo:'INCIDENTE'}}),1);
  observations.incidentAtomicity={consumers,duplicateCount:1,distinctClasses:3,distinctManifest:1,inside29Minutes:1,outside31Minutes:2,retryAfterRollback:1};
 });
 await check('GPS windows preserve the newest 500 points in stable chronological order at every boundary',async()=>{
  const results=[];
  for(const count of [0,1,499,500,501,1201]){
   const m=await syntheticTrip(),epoch=Date.now()-count*1000;
   const points=Array.from({length:count},(_,i)=>({id:prefix+'-gps-'+count+'-'+String(i).padStart(5,'0'),manifiestoId:m.id,latitud:-32.88+i*.000001,longitud:-68.84,isDemoData:true,
    // Last 20 share a timestamp: timestamp alone cannot define the window edge.
    timestamp:new Date(epoch+(count===501?0:Math.min(i,Math.max(0,count-20)))*1000)}));
   if(points.length)await db.trackingGPS.createMany({data:points});
   const response=await checked('gps-window-'+count,'transportista',`/manifiestos/${m.id}/viaje-actual`),all=response.data;
   const expected=points.slice(-500);assert.deepEqual(all.map((p:any)=>p.id),expected.map(p=>p.id));assert.equal(await db.trackingGPS.count({where:{manifiestoId:m.id}}),count);
   assert.equal(response.ventana.limite,500);assert.equal(response.ventana.hayAnteriores,count>500);assert.equal(response.ventana.orden,'timestamp_asc_id_asc');
   const repeated=(await checked('gps-window-repeat-'+count,'transportista',`/manifiestos/${m.id}/viaje-actual`)).data;assert.deepEqual(repeated.map((p:any)=>p.id),all.map((p:any)=>p.id));
   results.push({stored:count,returned:all.length,latest:all.at(-1)?.id??null,hasEarlier:response.ventana.hayAnteriores});
   if(count===1201)browserFixture.longTrip={id:m.id,numero:m.numero,latest:await db.trackingGPS.findUniqueOrThrow({where:{id:points.at(-1)!.id}}),expectedIds:expected.map(p=>p.id)};
  }
  observations.gpsWindows=results;
 });
 // NAT admission is a separate experiment: never bypass or raise the limiter.
 const nat='127.52.99.201',natRows:any[]=[];const natStart=performance.now();
 for(let n=0;n<7;n++)natRows.push(...await Promise.all(Array.from({length:100},(_,i)=>request('shared-nat',roles[i%8],'/notificaciones?limit=5','GET',undefined,nat,secondary&&i%2?secondary:base))));
 observations.sharedNat={wallMs:Math.round(performance.now()-natStart),requests:700,statuses:natRows.reduce((a,r)=>({...a,[r.status]:(a[r.status]||0)+1}),{})};
 await check('700 valid actions from eight roles on one shared IP avoid throttling',async()=>{assert.ok(natRows.every(r=>r.status===200),JSON.stringify(observations.sharedNat))});
 await check('one abusive identity is throttled across workers without blocking another identity or GPS',async()=>{
  assert.ok(secondary,'A second loopback API is required to validate shared counters');
  const abusive:any[]=[];
  for(let n=0;n<7;n++)abusive.push(...await Promise.all(Array.from({length:100},(_,i)=>request('identity-abuse','transportista','/notificaciones?limit=1','GET',undefined,nat,i%2?secondary:base))));
  const blocked=abusive.filter(r=>r.status===429);assert.ok(blocked.length>0,'The 600/minute limit must still reject abuse across workers');assert.ok(abusive.every(r=>[200,429].includes(r.status)));
  assert.ok(blocked.every(r=>r.data.code==='RATE_LIMITED'&&Number(r.retryAfter)>0&&r.data.retryAfterSeconds>0));
  const other=await Promise.all(Array.from({length:20},(_,i)=>request('identity-isolation','operador','/notificaciones?limit=1','GET',undefined,nat,i%2?secondary:base)));assert.ok(other.every(r=>r.status===200));
  const sample=await request('gps-budget-isolation','transportista',`/manifiestos/${records[0]}/ubicacion`,'POST',{latitud:-32.88,longitud:-68.84},nat,secondary);assert.equal(sample.status,200);
  observations.identityQuota={workers:[base,secondary],attempts:700,accepted:abusive.filter(r=>r.status===200).length,blocked:blocked.length,otherIdentityAccepted:20,gpsAccepted:true};
 });
 await check('shared admission refunds successful requests and preserves a newer window on delayed release',async()=>{
  const {PostgresAdmissionStore}=backendRequire('./dist/services/apiAdmission.service.js'),store=new PostgresAdmissionStore();
  const namespace='qa:'+run;
  const success=await store.consume(namespace,'success',60000);assert.equal(success.hits,1);
  await store.release(success);assert.equal((await db.rateLimitCounter.findUniqueOrThrow({where:{key:success.key}})).hits,0);
  const expired=await store.consume(namespace,'late-refund',10);
  await new Promise(resolve=>setTimeout(resolve,25));
  const fresh=await store.consume(namespace,'late-refund',60000);assert.equal(fresh.hits,1);assert.ok(fresh.resetAt>expired.resetAt);
  await store.release(expired);assert.equal((await db.rateLimitCounter.findUniqueOrThrow({where:{key:fresh.key}})).hits,1);
  await store.release(fresh);assert.equal((await db.rateLimitCounter.findUniqueOrThrow({where:{key:fresh.key}})).hits,0);
  observations.admissionRefund={successfulRequestRefunded:true,expiredReleasePreservesNewGeneration:true};
 });
 await check('original historical manifest, CAP closure and disabled delivery are preserved',async()=>{
  assert.equal(JSON.stringify(await db.manifiesto.findUniqueOrThrow({where:{id:'manifest-qa-legacy'},include:{residuos:true,eventos:true}})),readFileSync(out+'/manifest-legacy-before.json','utf8'));
  assert.equal(await db.emailQueue.count({where:{estado:{not:'SUPRIMIDO'}}}),0);assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
  const {TRAINING_LOGINS}=backendRequire('./dist/lib/trainingDirectLogin.js');for(const {email} of TRAINING_LOGINS)assert.equal((await request('cap-closed','admin','/auth/login','POST',{email,password:'closed-qa'})).status,403);
  assert.equal((await checked('recovery','admin','/health')).db,'connected');
 });
}catch(e){checks.push({name:'setup or unexpected error',status:'FAIL',error:String(e)});console.log(String(e));}
finally{
 const metrics=[...new Set(requests.map(r=>r.group))].map(group=>{const rows=requests.filter(r=>r.group===group),times=rows.map(r=>r.ms).sort((a,b)=>a-b);return{group,requests:rows.length,statuses:rows.reduce((a,r)=>({...a,[r.status]:(a[r.status]||0)+1}),{}),p50Ms:times[Math.ceil(times.length*.5)-1],p95Ms:times[Math.ceil(times.length*.95)-1],maxMs:times.at(-1),maxBytes:Math.max(...rows.map(r=>r.bytes))}});
 const report={run,startedAt,completedAt:new Date().toISOString(),previewOnly:true,capClosed:true,externalDelivery:false,limits:{cpu:1,memoryGiB:2,testWorkers:1,apiWorkers:secondary?2:1},records,checks,observations,metrics,
 limitations:['Two loopback API processes when configured; no actual production proxy or PM2 cluster tested','Synthetic GPS observations, not physical sensors or radio/background operation','Repeated sessions across eight roles, not hundreds of distinct humans','Fixture setup inserts artificial trips; measured actions use real APIs except the explicitly named subscriber race','No production or main; no external mail/push']};
 writeFileSync(out+'/concurrency-browser-fixture.json',JSON.stringify(browserFixture,null,2));
 writeFileSync(out+'/concurrency-review-'+run+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({run,checks,observations,metrics},null,2));
 await db.$disconnect();const compiled=backendRequire('./dist/lib/prisma.js').default;await compiled.$disconnect();
 // Findings are results of this diagnostic, not swallowed test failures.
 if(checks.some(c=>c.status==='FAIL'))process.exitCode=2;
}
