import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {assertCloudDatabase,assertCloudEnvironment,backendRequire} from './safety.ts';

// Diagnostic, bounded and synthetic. Never interpret this single-process preview
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
async function request(group:string,role:string,route:string,method='GET',body?:unknown,ip?:string){
 const begin=performance.now();
 try{
  const res=await fetch(base+route,{method,signal:AbortSignal.timeout(30000),headers:{
   'X-Forwarded-For':ip||`127.51.1.${roles.indexOf(role)+1}`,Authorization:'Bearer '+(tokens.get(role)||''),'Content-Type':'application/json'},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const raw=Buffer.from(await res.arrayBuffer()),text=raw.toString();let data:any;try{data=JSON.parse(text)}catch{data=res.headers.get('content-type')?.includes('application/pdf')?{pdf:raw.subarray(0,5).toString()==='%PDF-',bytes:raw.length}:{message:text.slice(0,200)}}
  const row={group,role,method,status:res.status,ms:Math.round(performance.now()-begin),bytes:raw.length};
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
   expected.push({id:m.id,expected:assigned.patente});
  }
  const data=(await checked('assigned-vehicle','admin','/centro-control/monitor-live')).data;
  const comparisons=expected.map(row=>({...row,shown:data.enTransito.find((r:any)=>r.manifiestoId===row.id)?.vehiculo?.patente}));
  observations.assignedVehicles=comparisons;
  assert.ok(comparisons.every(row=>row.expected===row.shown),JSON.stringify(comparisons));
 });
 await check('concurrent duplicate GPS alerts create only one incident',async()=>{
  // This uses the actual compiled subscriber and real isolated DB, without SMTP.
  const {eventoManifiestoSubscriber}=backendRequire('./dist/subscribers/eventoManifiesto.subscriber.js');
  const event={type:'TIEMPO_EXCESIVO',manifiestoId:records[100],horasTransito:25,numero:records[100],userId:fixture.users.transportista};
  await Promise.all(Array.from({length:20},()=>eventoManifiestoSubscriber(event)));
  const count=await db.eventoManifiesto.count({where:{manifiestoId:records[100],tipo:'INCIDENTE'}});observations.duplicateIncidentCount=count;assert.equal(count,1);
 });
 await check('long trip endpoint includes its latest point after 501 observations',async()=>{
  await db.trackingGPS.createMany({data:Array.from({length:501},(_,i)=>({manifiestoId:records[100],latitud:-32.88+i*.000001,longitud:-68.84,timestamp:new Date(Date.now()-1000000+i*1000)}))});
  const all=(await checked('long-trip','transportista',`/manifiestos/${records[100]}/viaje-actual`)).data;
  const latest=await db.trackingGPS.findFirst({where:{manifiestoId:records[100]},orderBy:{timestamp:'desc'}});
  observations.longTrip={stored:501,returned:all.length,containsLatest:all.some((r:any)=>r.id===latest.id)};
  assert.ok(observations.longTrip.containsLatest,'The currently displayed route loses its newest sample after the hard limit');
 });
 // NAT admission is a separate experiment: never bypass or raise the limiter.
 const nat='127.52.99.201',natRows:any[]=[];const natStart=performance.now();
 for(let n=0;n<7;n++)natRows.push(...await Promise.all(Array.from({length:100},(_,i)=>request('shared-nat',roles[i%8],'/notificaciones?limit=5','GET',undefined,nat))));
 observations.sharedNat={wallMs:Math.round(performance.now()-natStart),requests:700,statuses:natRows.reduce((a,r)=>({...a,[r.status]:(a[r.status]||0)+1}),{})};
 await check('700 valid actions from eight roles on one shared IP avoid throttling',async()=>{assert.ok(natRows.every(r=>r.status===200),JSON.stringify(observations.sharedNat))});
 await check('original historical manifest, CAP closure and disabled delivery are preserved',async()=>{
  assert.equal(JSON.stringify(await db.manifiesto.findUniqueOrThrow({where:{id:'manifest-qa-legacy'},include:{residuos:true,eventos:true}})),readFileSync(out+'/manifest-legacy-before.json','utf8'));
  assert.equal(await db.emailQueue.count({where:{estado:{not:'SUPRIMIDO'}}}),0);assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
  const {TRAINING_LOGINS}=backendRequire('./dist/lib/trainingDirectLogin.js');for(const {email} of TRAINING_LOGINS)assert.equal((await request('cap-closed','admin','/auth/login','POST',{email,password:'closed-qa'})).status,403);
  assert.equal((await checked('recovery','admin','/health')).db,'connected');
 });
}catch(e){checks.push({name:'setup or unexpected error',status:'FAIL',error:String(e)});console.log(String(e));}
finally{
 const metrics=[...new Set(requests.map(r=>r.group))].map(group=>{const rows=requests.filter(r=>r.group===group),times=rows.map(r=>r.ms).sort((a,b)=>a-b);return{group,requests:rows.length,statuses:rows.reduce((a,r)=>({...a,[r.status]:(a[r.status]||0)+1}),{}),p50Ms:times[Math.ceil(times.length*.5)-1],p95Ms:times[Math.ceil(times.length*.95)-1],maxMs:times.at(-1),maxBytes:Math.max(...rows.map(r=>r.bytes))}});
 const report={run,startedAt,completedAt:new Date().toISOString(),previewOnly:true,capClosed:true,externalDelivery:false,limits:{cpu:1,memoryGiB:2,workers:1},records,checks,observations,metrics,
 limitations:['One backend process; no PM2 cluster or actual proxy tested','Synthetic GPS observations, not physical sensors or radio/background operation','Repeated sessions across eight roles, not hundreds of distinct humans','Fixture setup inserts artificial trips; measured actions use real APIs except the explicitly named subscriber race','No production or main; no external mail/push']};
 writeFileSync(out+'/concurrency-review-'+run+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({run,checks,observations,metrics},null,2));
 await db.$disconnect();const compiled=backendRequire('./dist/lib/prisma.js').default;await compiled.$disconnect();
 // Findings are results of this diagnostic, not swallowed test failures.
 if(checks.some(c=>c.status==='FAIL'))process.exitCode=2;
}
