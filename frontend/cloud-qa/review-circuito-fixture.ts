import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {assertCloudDatabase,backendRequire} from './safety.ts';
await assertCloudDatabase();
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const out=process.env.QA_ARTIFACTS!,fixture=JSON.parse(await readFile(path.join(out,'handoff-private.json'),'utf8'));
const fleet=JSON.parse(await readFile(path.join(out,'fleet-private.json'),'utf8'));
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
const request=async(method:string,url:string,token?:string,body?:unknown)=>{
 const response=await fetch('http://127.0.0.1:3037/api'+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,body:await response.json()};
};
try{
 const tokens:Record<string,string>={};for(const name of ['origin','foreign','generator','operator','admin']){const r=await request('POST','/auth/login',undefined,{email:fixture.users[name].email,password:fixture.password});assert.equal(r.status,200);tokens[name]=r.body.data.tokens.accessToken;}
 const run=randomUUID().slice(0,6),cases:Record<string,any>={},checks:string[]=[];
 const states=['BORRADOR','APROBADO','EN_TRANSITO','ENTREGADO','RECIBIDO','EN_TRATAMIENTO','TRATADO','RECHAZADO','CANCELADO'];
 for(const surface of ['web','web-mobile','app']){
  const prefix=`QA-${run}-${surface==='web'?'D':surface==='app'?'A':'M'}`,records:Record<string,any>={},bulk:any[]=[];
  const create=async(suffix:string,state='EN_TRANSITO',index=0)=>db.manifiesto.create({data:{numero:prefix+'-'+suffix,generadorId:fixture.browsers.web.generadorId,operadorId:fixture.browsers.web.operadorId,transportistaId:fixture.carriers.origin.id,creadoPorId:fixture.users.generator.id,estado:state,modalidad:'FIJO',isDemoData:true,
    createdAt:new Date(Date.now()-index*60000),fechaEstimadaRetiro:new Date(Date.now()+86400000),
    fechaRetiro:!['BORRADOR','APROBADO','CANCELADO'].includes(state)?new Date(Date.now()-900000):null,
    fechaEntrega:['ENTREGADO','RECIBIDO','EN_TRATAMIENTO','TRATADO','RECHAZADO'].includes(state)?new Date(Date.now()-300000):null,
    fechaCierre:state==='TRATADO'?new Date():null,
    asignacionTransporte:{version:1,transportistaId:fixture.carriers.origin.id,vehiculo:null,chofer:null}}});
  for(let i=0;i<states.length;i++)records[states[i]]=await create(states[i],states[i],i);
  records.second=await create('OTRO-VIAJE','EN_TRANSITO',10);
  records.pickup=await create('RETIRAR','APROBADO',11);
  records.permission=await create('PERMISO-GPS','EN_TRANSITO',12);
  for(let i=0;i<24;i++)bulk.push(await create('LISTA-'+String(i).padStart(2,'0'),'BORRADOR',20+i));
  for(const role of ['origin','generator','operator','admin'])for(const [phase,wanted]of Object.entries({pendientes:['BORRADOR','PENDIENTE_APROBACION','APROBADO'],en_curso:['EN_TRANSITO','ENTREGADO','RECIBIDO','EN_TRATAMIENTO'],terminados:['TRATADO','RECHAZADO','CANCELADO']})){
   const r=await request('GET',`/manifiestos?search=${prefix}&fase=${phase}&limit=100`,tokens[role]);assert.equal(r.status,200);const found=r.body.data.manifiestos;assert.ok(found.length>0);assert.ok(found.every((m:any)=>wanted.includes(m.estado)));assert.ok(found.every((m:any)=>m.numero.startsWith(prefix)));checks.push(surface+':'+role+':'+phase);
  }
  const history=await request('GET',`/manifiestos?search=${prefix}&fase=post_entrega&limit=100`,tokens.origin);assert.equal(history.status,200);assert.ok(!history.body.data.manifiestos.some((m:any)=>m.id===records.CANCELADO.id));
  checks.push(surface+':history-excludes-cancelled-without-delivery');
  cases[surface]={prefix,records,bulk};
  if(surface==='web-mobile'){
   fixture.browsers[surface]=await create('RELEVO','EN_TRANSITO',14);
   const fleetPrefix=prefix+'-GPS',a=await create('GPS-A'),b=await create('GPS-B');
   const incoming=await db.manifiesto.create({data:{numero:fleetPrefix+'-C',generadorId:a.generadorId,operadorId:a.operadorId,transportistaId:fixture.carriers.foreign.id,creadoPorId:fixture.users.foreign.id,estado:'EN_TRANSITO',modalidad:'FIJO',fechaRetiro:new Date(),isDemoData:true}});
   const r=await request('POST',`/manifiestos/${incoming.id}/tramos`,tokens.foreign,{id:randomUUID(),anteriorId:null,tipo:'REGISTRADO',transportistaId:fixture.carriers.origin.id,datos:{},motivo:'Relevo sintético para la revisión de web móvil'});assert.equal(r.status,201);
   fleet.cases[surface]={prefix:fleetPrefix,a,b,incoming:{...incoming,tramoId:r.body.data.tramo.id}};
  }
 }
 for(const role of ['origin','generator','operator','admin'])for(const route of ['/manifiestos/tareas-partes','/manifiestos/agenda-partes']){assert.equal((await request('GET',route,tokens[role])).status,404);checks.push(role+':school-route-closed:'+route);}
 for(const role of ['admin','generador','transporte','operador']){assert.equal((await request('POST','/auth/login',undefined,{email:role+'@capacitacion.invalid',password:'CAP-CERRADO-NO-USAR'})).status,403);checks.push('cap-'+role+'-closed');}
 await writeFile(path.join(out,'handoff-private.json'),JSON.stringify(fixture),{mode:0o600});await writeFile(path.join(out,'fleet-private.json'),JSON.stringify({...fleet,browsers:fixture.browsers}),{mode:0o600});
 await writeFile(path.join(out,'review-private.json'),JSON.stringify({...fixture,cases}),{mode:0o600});
 await writeFile(path.join(out,'review-api.json'),JSON.stringify({passed:true,checks,production:false,capClosed:true,emails:false,push:false},null,2));console.log('Review API: '+checks.length+' groups PASS; CAP closed');
}finally{await db.$disconnect();}
