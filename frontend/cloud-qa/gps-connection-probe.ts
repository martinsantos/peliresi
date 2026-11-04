import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {chromium,request,type APIRequestContext} from '@playwright/test';
import {assertCloudDatabase,backendRequire} from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
assert.equal(process.env.MANIFEST_TRANSPORT_HANDOFF_ENABLED,'true');
const out=process.env.QA_ARTIFACTS!;
const fixture=JSON.parse(readFileSync(path.join(out,'gps-order-private.json'),'utf8'));
const item=fixture.cases['web-desktop'].relay;
assert.match(item.numero,/^QA-GPS-ORDER-/);
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
const manifest=await db.manifiesto.findUniqueOrThrow({where:{id:item.id},select:{numero:true,isDemoData:true}});
assert.equal(manifest.numero,item.numero);assert.equal(manifest.isDemoData,true);

type Result={phase:string;target:'proxy'|'direct';probe:string;status?:number;error?:string};
const results:Result[]=[];
const classify=(error:unknown)=>{
  const message=error instanceof Error?error.message:'';
  return /socket hang up|ECONNRESET/i.test(message)?'socket-reset':/timeout/i.test(message)?'timeout':'other-network-error';
};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});
const direct=await request.newContext({baseURL:'http://127.0.0.1:3037'});
const proxy=context.request;
let setupFailure:string|null=null,abortResult:Record<string,unknown>|null=null;
let eventCount=0,legCount=0,pointCount=0,abortPointCount=0;
const health:Record<string,number|string>={};

async function post(client:APIRequestContext,target:'proxy'|'direct',phase:string,probe:string,url:string,token:string,data:unknown):Promise<Result>{
  try{
    const response=await client.post(url,{headers:{Authorization:`Bearer ${token}`,'x-sitrep-qa-probe':probe},data,timeout:15000});
    return {phase,target,probe,status:response.status()};
  }catch(error){return {phase,target,probe,error:classify(error)};}
}
async function batch(phase:string,url:string,token:string,data:unknown,rounds:number){
  for(let round=0;round<rounds;round++){
    const requests=Array.from({length:8},(_,index)=>{
      const target=index<4?'proxy':'direct';
      return post(target==='proxy'?proxy:direct,target,phase,`c18-${phase}-${round}-${index}`,url,token,data);
    });
    results.push(...await Promise.all(requests));
  }
}

try{
  for(const [name,client] of [['proxyBefore',proxy],['directBefore',direct]] as const){
    try{health[name]=(await client.get('/api/health',{timeout:10000})).status();}catch(error){health[name]=classify(error);}
  }
  await context.addCookies([{name:'sitrep_qa_client',value:'127.11.173.91',url:'http://127.0.0.1:4177'}]);
  let login;
  try{login=await proxy.post('/api/auth/login',{data:{email:'transportista@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'},timeout:15000});}
  catch{throw new Error('El ingreso de la cuenta artificial no recibió respuesta');}
  if(login.status()!==200)throw new Error(`El ingreso de la cuenta artificial respondió ${login.status()}`);
  const token=(await login.json()).data.tokens.accessToken as string;
  assert.equal(typeof token,'string');
  const command={id:randomUUID(),anteriorId:null,tipo:'REGISTRADO',transportistaId:fixture.replacementId,datos:{},motivo:'Relevo artificial para diagnosticar conexiones'};
  const handoffUrl=`/api/manifiestos/${item.id}/tramos`;
  let handoff;
  try{handoff=await proxy.post(handoffUrl,{headers:{Authorization:`Bearer ${token}`,'x-sitrep-qa-probe':'c18-setup'},data:command,timeout:15000});}
  catch(error){setupFailure=classify(error);handoff=await direct.post(handoffUrl,{headers:{Authorization:`Bearer ${token}`},data:command,timeout:15000});}
  if(handoff.status()!==201)throw new Error(`No se pudo preparar el relevo artificial (${handoff.status()})`);
  const {tramo,acceso}=(await handoff.json()).data;
  const gpsUrl=`/api/seguimiento-relevo/${tramo.id}/ubicacion-idempotente`;
  const point={latitud:-33.71,longitud:-68.71,precision:10,puntoId:randomUUID()};

  await batch('handoff',handoffUrl,token,command,10);
  await batch('gps-before',gpsUrl,acceso,point,10);

  // Reproduce the test's network boundary: forward a real accepted request,
  // then discard its response before asking this same context to send again.
  await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4177'?route.continue():route.abort());
  const page=await context.newPage();await page.goto('/app/login');
  const abortedPoint={latitud:-33.72,longitud:-68.72,precision:10,puntoId:randomUUID()};
  let acceptedStatus:number|null=null;
  await page.route(`**${gpsUrl}`,async route=>{
    const accepted=await route.fetch();acceptedStatus=accepted.status();await route.abort('failed');
  });
  const browserResult=await page.evaluate(async({url,access,body})=>{
    try{await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json','x-sitrep-qa-probe':'c18-abort'},body:JSON.stringify(body)});return 'unexpected-response';}
    catch{return 'response-discarded';}
  },{url:gpsUrl,access:acceso,body:abortedPoint});
  await page.unrouteAll();
  abortResult={acceptedStatus,browserResult};
  await batch('gps-after',gpsUrl,acceso,point,10);
  // Probe around the default HTTP keep-alive window without changing the
  // transport settings. Each wait precedes a new eight-request batch.
  for(const delay of [4700,4900,5000,5100,5300]){
    await new Promise(resolve=>setTimeout(resolve,delay));
    await batch(`gps-idle-${delay}`,gpsUrl,acceso,point,1);
  }
  for(const [name,client] of [['proxyAfter',proxy],['directAfter',direct]] as const){
    try{health[name]=(await client.get('/api/health',{timeout:10000})).status();}catch(error){health[name]=classify(error);}
  }
  await page.close();

  [eventCount,legCount,pointCount,abortPointCount]=await Promise.all([
    db.eventoManifiesto.count({where:{manifiestoId:item.id,tipo:'RELEVO_TRANSPORTE'}}),
    db.tramoTransporte.count({where:{manifiestoId:item.id,tipo:'REGISTRADO'}}),
    db.trackingGPS.count({where:{manifiestoId:item.id,latitud:point.latitud,longitud:point.longitud}}),
    db.trackingGPS.count({where:{manifiestoId:item.id,latitud:abortedPoint.latitud,longitud:abortedPoint.longitud}}),
  ]);
}catch(error){
  // Do not write Playwright request logs: they can contain bearer credentials.
  setupFailure=error instanceof Error&&/^El ingreso|^No se pudo preparar/.test(error.message)?error.message:'No se pudo completar la preparación o el diagnóstico';
}finally{
  await context.close();await direct.dispose();await browser.close();await db.$disconnect();
}

const summary:Record<string,{requests:number;status:Record<string,number>;errors:Record<string,number>}>={};
for(const result of results){
  const key=`${result.phase}:${result.target}`,entry=summary[key]??={requests:0,status:{},errors:{}};
  entry.requests++;
  if(result.status!==undefined)entry.status[String(result.status)]=(entry.status[String(result.status)]??0)+1;
  if(result.error)entry.errors[result.error]=(entry.errors[result.error]??0)+1;
}
const report={synthetic:true,production:false,setupFailure,abortResult,health,summary,results,
  database:{handoffEvents:eventCount,registeredLegs:legCount,pointCount,abortPointCount}};
writeFileSync(path.join(out,'c18-connection-probe.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({setupFailure,abortResult,health,summary,database:report.database}));
if(setupFailure||results.length!==280||eventCount!==1||legCount!==1||pointCount!==1||abortPointCount!==1
  ||abortResult?.acceptedStatus!==200||abortResult?.browserResult!=='response-discarded'
  ||Object.values(health).some(status=>status!==200))process.exitCode=1;
