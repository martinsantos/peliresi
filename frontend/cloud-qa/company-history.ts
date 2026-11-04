import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const out=process.env.QA_ARTIFACTS!,fixture=JSON.parse(readFileSync(out+'/onboarding-ux-fixture.json','utf8'));
assert.match(fixture.owner,/@night-qa.invalid$/);assert.match(fixture.member,/@night-qa.invalid$/);
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function snapshot(){return {
 events:hash(await db.eventoEmpresa.findMany({orderBy:{id:'asc'}})),
 grants:hash(await db.autorizacionEmpresa.findMany({orderBy:{id:'asc'}})),
 responsibles:hash(await db.responsableEmpresa.findMany({orderBy:{id:'asc'}})),
 notices:await db.notificacion.count(),manifests:await db.manifiesto.count(),
};}
async function detail(email:string){
 const login=await fetch('http://127.0.0.1:3037/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'OnlyLocal-NightQA-2026!'})});
 assert.equal(login.status,200);const token=(await login.json()).data.tokens.accessToken;
 const response=await fetch('http://127.0.0.1:3037/api/empresas/'+fixture.companyId,{headers:{Authorization:'Bearer '+token}});
 assert.equal(response.status,200);return (await response.json()).data;
}
try{
 const before=await snapshot(),owner=await detail(fixture.owner);
 assert.equal(owner.puedeGestionar,true);assert.ok(owner.eventos.length>0);
 const names=await db.usuario.findMany({where:{id:{in:owner.eventos.map((e:any)=>e.usuarioId).filter(Boolean)}},select:{id:true,nombre:true}});
 for(const event of owner.eventos){
  assert.ok(event.presentacion.titulo);assert.notEqual(event.presentacion.titulo,event.tipo);
  assert.equal(event.presentacion.autor,names.find((p:any)=>p.id===event.usuarioId)?.nombre||null);
  assert.deepEqual(Object.keys(event.presentacion).sort(),['actividad','autor','establecimiento','persona','titulo']);
 }
 const member=await detail(fixture.member);assert.equal(member.puedeGestionar,false);assert.deepEqual(member.eventos,[]);assert.deepEqual(member.personas,[]);
 const after=await snapshot();assert.deepEqual(after,before);
 writeFileSync(out+'/company-history-http.json',JSON.stringify({at:new Date().toISOString(),eventsChecked:owner.eventos.length,managerHistory:true,operationalHistoryHidden:true,unchanged:after,businessWrites:0},null,2));
 console.log('Company history: authorized names, operational access isolation and unchanged records verified');
}finally{await db.$disconnect();}
