import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out='/work/sitrep/.qa-inspection-deadline-company-20261030';
assert.equal(process.env.QA_ARTIFACTS,out);assert.equal(process.env.QA_COMPAT_BACKEND,'inspection-deadline-company-after');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const fixture=JSON.parse(readFileSync(path.join(out,'fixture.json'),'utf8'));assert.match(fixture.email,/@night-qa\.invalid$/);
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient(),base='http://127.0.0.1:3037/api';
async function request(token:string|null,route:string,body?:unknown,headers:Record<string,string>={}){
 const response=await fetch(base+route,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),
  ...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
 const raw=await response.text();return {status:response.status,data:raw?JSON.parse(raw).data:null,raw};
}
async function login(email:string,octet:number){
 assert.match(email,/@night-qa\.invalid$/);const result=await request(null,'/auth/login',{email,password:'OnlyLocal-NightQA-2026!'},
  {Cookie:`sitrep_qa_client=127.11.84.${octet}`});assert.equal(result.status,200);return result.data.tokens.accessToken as string;
}
try{
 const [member,outsider]=await Promise.all([login(fixture.email,1),login('generador2@night-qa.invalid',2)]),checks=[];
 for(const item of fixture.cases['web-desktop']){
  const grant=await db.autorizacionEmpresa.findUniqueOrThrow({where:{actividadId_usuarioId:{actividadId:item.activityId,usuarioId:fixture.memberId}}});
  assert.ok(grant.activa&&grant.todosEstablecimientos);
  const context={'X-SITREP-Empresa':item.companyId,'X-SITREP-Empresa-Actividad':item.activityId};
  const visible=await request(member,'/notificaciones/'+item.noticeId);assert.equal(visible.status,200,visible.raw);
  assert.equal(visible.data.titulo,'Requerimiento vencido sin respuesta');
  assert.equal(JSON.parse(visible.data.datos).inspeccionId,item.inspectionId);
  assert.equal((await request(outsider,'/notificaciones/'+item.noticeId)).status,404);
  assert.equal((await request(member,`/inspecciones/${item.inspectionId}/intercambios`,undefined,context)).status,200);
  assert.equal((await request(member,'/inspecciones',undefined,context)).status,403);
  try{
   await db.autorizacionEmpresa.update({where:{id:grant.id},data:{activa:false}});
   const revoked=await request(member,'/notificaciones/'+item.noticeId);
   assert.equal(revoked.status,200);assert.equal(revoked.data.titulo,'Aviso no disponible');assert.ok(!JSON.stringify(revoked.data).includes(item.inspectionId));
   assert.notEqual((await request(member,`/inspecciones/${item.inspectionId}/intercambios`,undefined,context)).status,200);
   await db.autorizacionEmpresa.update({where:{id:grant.id},data:{activa:true,todosEstablecimientos:false}});
   const site=await request(member,'/notificaciones/'+item.noticeId);assert.equal(site.data.titulo,'Aviso no disponible');
   assert.notEqual((await request(member,`/inspecciones/${item.inspectionId}/intercambios`,undefined,context)).status,200);
  }finally{await db.autorizacionEmpresa.update({where:{id:grant.id},data:{activa:true,todosEstablecimientos:true}});}
  assert.equal((await request(member,'/notificaciones/'+item.noticeId)).data.titulo,'Requerimiento vencido sin respuesta');
  checks.push({role:item.role,unrelatedDenied:true,inspectionListDenied:true,revokedMasked:true,siteOnlyMasked:true});
 }
 assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
 writeFileSync(path.join(out,'http-proof.json'),JSON.stringify({synthetic:true,production:false,checks,emailAttempts:0,emailSent:0},null,2),{flag:'wx',mode:0o600});
 console.log('PASS acceso PSIP vencido: representante, revocación y sede en tres roles.');
}finally{await db.$disconnect();}
