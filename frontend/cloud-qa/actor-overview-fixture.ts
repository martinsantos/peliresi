import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out=process.env.QA_ARTIFACTS!;
assert.equal(out,'/work/sitrep/.qa-actor-overview-20261031');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
const prefix='qa-overview31-',search='QA DIR31',fixture=path.join(out,'fixture.json');
const roles=['generador','transportista','operador'] as const;
const base='http://127.0.0.1:4177/api';
try {
 if(process.argv[2]==='prepare') {
  assert.equal(existsSync(fixture),false);
  const before={manifests:await db.manifiesto.count(),attempts:await db.emailQueue.count({where:{intentos:{gt:0}}}),sent:await db.emailQueue.count({where:{sentAt:{not:null}}})};
  assert.equal(before.attempts,0);assert.equal(before.sent,0);
  assert.equal(await db.usuario.count({where:{email:{startsWith:prefix}}}),0);
  const users:any[]=[],actors:Record<string,any[]>={generador:[],transportista:[],operador:[]};
  for(const [typeIndex,kind] of roles.entries())for(let i=0;i<121;i++){
   const id=prefix+kind+'-'+String(i).padStart(3,'0'),email=id+'@night-qa.invalid';
   const cuit='99'+String(9_000_000+typeIndex*1000+i).padStart(9,'0');
   users.push({id:id+'-user',email,nombre:'QA cuenta deshabilitada',password:'!disabled',rol:kind.toUpperCase(),activo:false,notifEmail:false});
   const common={id,usuarioId:id+'-user',razonSocial:search+' '+String(i).padStart(3,'0')+' '+kind,cuit,email,domicilio:'QA domicilio artificial',telefono:'000000000',activo:i%4!==0};
   actors[kind].push({...common,...(kind==='generador'?{numeroInscripcion:'QA',categoria:'QA'}:kind==='transportista'?{numeroHabilitacion:'QA'}:{numeroHabilitacion:'QA',categoria:'QA'})});
  }
  await db.$transaction(async(tx:any)=>{
   await tx.usuario.createMany({data:users});
   for(const kind of roles)await tx[kind].createMany({data:actors[kind]});
  });
  writeFileSync(fixture,JSON.stringify({synthetic:true,prefix,search,perType:121,before}),{flag:'wx',mode:0o600});
  console.log('363 actores artificiales preparados con cuentas deshabilitadas.');
 } else if(process.argv[2]==='http') {
  const f=JSON.parse(readFileSync(fixture,'utf8'));assert.equal(f.synthetic,true);assert.equal(f.prefix,prefix);
  const checks:Array<{name:string;status:number}>=[];
  async function login(role:string){
   const response=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json','cookie':'sitrep_qa_client=127.11.42.19'},
    body:JSON.stringify({email:role+'@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'})});
   assert.equal(response.status,200,'login '+role);
   return (await response.json()).data.tokens.accessToken as string;
  }
  async function get(token:string|undefined,query:string,status=200){
   const response=await fetch(base+'/actores/directorio'+query,{headers:token?{authorization:'Bearer '+token}:{}});
   const body=await response.json();assert.equal(response.status,status,query+' '+JSON.stringify(body));
   checks.push({name:query,status});return body.data;
  }
  const admin=await login('admin'),inspector=await login('inspector'),generator=await login('generador');
  const q='?search='+encodeURIComponent(search)+'&limit=20';
  const first=await get(admin,q),last=await get(admin,q+'&page=19'),clamped=await get(admin,q+'&page=9999');
  assert.deepEqual(first.counts,{generador:121,transportista:121,operador:121});
  assert.equal(first.pagination.total,363);assert.equal(first.pagination.pages,19);assert.equal(first.items.length,20);
  assert.equal(last.items.length,3);assert.ok(last.items.every((row:any)=>row.razonSocial.includes('120')));
  assert.equal(clamped.pagination.page,19);assert.deepEqual(clamped.items,last.items);
  assert.equal(new Set([...first.items,...last.items].map((row:any)=>row.tipo+':'+row.id)).size,23);
  const inactive=await get(admin,q+'&tipo=generador&estado=inactivo&page=2');
  assert.equal(inactive.pagination.total,31);assert.equal(inactive.pagination.pages,2);assert.equal(inactive.items.length,11);
  assert.ok(inactive.items.every((row:any)=>row.tipo==='generador'&&!row.activo));
  const active=await get(admin,q+'&estado=activo&sortBy=estado&sortOrder=asc');
  assert.equal(active.pagination.total,270);assert.ok(active.items.every((row:any)=>row.activo));
  const reverse=await get(admin,q+'&sortBy=actor&sortOrder=desc');assert.ok(reverse.items[0].razonSocial.includes('120'));
  const literal=await get(admin,'?search='+encodeURIComponent(search+' %'));assert.equal(literal.pagination.total,0);
  assert.equal((await get(inspector,q)).pagination.total,363);
  assert.equal((await get(generator,q)).pagination.total,0);
  const own=await get(generator,'');assert.equal(own.pagination.total,1);assert.equal(own.items[0].tipo,'generador');
  await get(undefined,'',401);
  for(const bad of ['?estado[]=activo','?page=1.5','?limit=101','?sortBy=desconocido','?tipo=desconocido'])await get(admin,bad,400);
  writeFileSync(path.join(out,'http.json'),JSON.stringify({synthetic:true,checks,roles:['admin','inspector','generador'],fixtureRows:363}),{flag:'wx',mode:0o600});
  console.log(checks.length+' comprobaciones HTTP de paginación, filtros y permisos superadas.');
 } else if(process.argv[2]==='audit') {
  const f=JSON.parse(readFileSync(fixture,'utf8'));assert.equal(f.synthetic,true);
  for(const kind of roles)assert.equal(await db[kind].count({where:{id:{startsWith:prefix+kind+'-'}}}),121);
  const after={manifests:await db.manifiesto.count(),attempts:await db.emailQueue.count({where:{intentos:{gt:0}}}),sent:await db.emailQueue.count({where:{sentAt:{not:null}}})};
  assert.deepEqual(after,f.before);assert.equal(after.attempts,0);assert.equal(after.sent,0);
  const processes=JSON.parse(readFileSync(path.join(out,'processes.json'),'utf8'));
  for(const item of processes){
   const env=Object.fromEntries(readFileSync('/proc/'+item.pid+'/environ','utf8').split('\0').filter(Boolean).map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
   assertCloudEnvironment(env);assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'),'proposal_operations_20261021');
   assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED,'false');assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
  }
  writeFileSync(path.join(out,'audit.json'),JSON.stringify({synthetic:true,fixtureRows:363,before:f.before,after,capClosed:true,push:false}),{flag:'wx',mode:0o600});
  console.log('Auditoría artificial: 363 actores, manifiestos sin cambios y cero correos enviados.');
 } else throw Error('Fase de QA desconocida');
} finally {await db.$disconnect();}
