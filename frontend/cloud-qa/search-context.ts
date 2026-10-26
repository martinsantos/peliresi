import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {assertCloudDatabase,backendRequire} from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const out=process.env.QA_ARTIFACTS!,fixture=JSON.parse(readFileSync(out+'/onboarding-ux-fixture.json','utf8'));
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
const checks:any[]=[],tokens=new Map<string,string>();let requests=0;
async function get(email:string,path:string,headers={},expected=200){
 assert.match(email,/@night-qa.invalid$/);
 if(!tokens.has(email)){const res=await fetch('http://127.0.0.1:3037/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'OnlyLocal-NightQA-2026!'})});requests++;assert.equal(res.status,200);const body=await res.json();tokens.set(email,body.data.tokens.accessToken);}
 const res=await fetch('http://127.0.0.1:3037/api'+path,{headers:{Authorization:'Bearer '+tokens.get(email),...headers}});requests++;const b=await res.json();assert.equal(res.status,expected,path+': '+JSON.stringify(b));return b.data;
}
try {
 const before=await db.manifiesto.count();
 for(const role of ['generador','transportista','operador']){
  const email=role+'@night-qa.invalid',profile=(await get(email,'/auth/profile')).user;
  const actor=profile[role];assert.ok(actor?.id);
  const results=await get(email,'/search?q='+encodeURIComponent(actor.razonSocial));
  const kind={generador:'generadores',transportista:'transportistas',operador:'operadores'}[role]!;
  assert.ok(results[kind].some((a:any)=>a.id===actor.id));
  for(const group of ['generadores','transportistas','operadores']){assert.ok(results[group].every((a:any)=>group===kind&&a.id===actor.id));}
  const manifests=await get(email,'/search?q=2026');
  for(const m of manifests.manifiestos){const detail=(await get(email,'/manifiestos/'+m.id)).manifiesto;assert.equal(detail[role+'Id'],actor.id);}
  await get(email,'/actores/'+kind+'/'+actor.id);
  checks.push({role,actorResultCount:results[kind].length,manifestCount:manifests.manifiestos.length,correctFicha:true});
 }
 const company=await get(fixture.owner,'/empresas/'+fixture.companyId);
 for(const activity of company.actividades){
  const headers={'X-SITREP-Empresa':fixture.companyId,'X-SITREP-Empresa-Actividad':activity.id};
  const results=await get(fixture.member,'/search?q=2026',headers);
  for(const m of results.manifiestos){const detail=(await get(fixture.member,'/manifiestos/'+m.id,headers)).manifiesto;assert.equal(detail[activity.rol.toLowerCase()+'Id'],activity.actorId);}
  const actors=await get(fixture.member,'/search?q=QA',headers);
  for(const group of ['generadores','transportistas','operadores'])assert.ok(actors[group].every((a:any)=>a.id===activity.actorId));
  checks.push({role:activity.rol,representative:true,manifestCount:results.manifiestos.length});
 }
 const admin=await get('admin@night-qa.invalid','/search?q=QA');
 for(const group of ['generadores','transportistas','operadores']){assert.ok(admin[group].length>0);await get('admin@night-qa.invalid','/actores/'+group+'/'+admin[group][0].id);}
 await get('admin@night-qa.invalid','/search?q=QA&estado=inventado',{},400);
 const empty=await get('admin@night-qa.invalid','/search?q=sin-coincidencia-QA-987654321');assert.equal(empty.totalHits,0);
 assert.equal(await db.manifiesto.count(),before);
 const report={at:new Date().toISOString(),requests,businessWrites:0,checks,adminFichas:3,invalidState:400,emptyDistinct:true,manifestCount:before};
 writeFileSync(out+'/search-http.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await db.$disconnect();}
