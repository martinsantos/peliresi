import {test,expect,type APIRequestContext} from '@playwright/test';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {assertCloudDatabase,backendRequire} from '../safety';
const fixture=JSON.parse(readFileSync(process.env.QA_ARTIFACTS!+'/fixture.json','utf8'));
async function auth(request:APIRequestContext,role:string){
 const response=await request.post('/api/auth/login',{headers:{Cookie:'sitrep_qa_client=127.19.33.'+Math.ceil(Math.random()*240)},data:{email:role+'@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'}});
 expect(response.status()).toBe(200);return {Authorization:'Bearer '+(await response.json()).data.tokens.accessToken};
}
test('complete agenda: counts, every page, dates, ownership and malformed filters',async({request})=>{
 for(const role of ['generador','transportista','operador']){
  const headers=await auth(request,role),ids:string[]=[];
  for(let page=1;page<=22;page++){
   const r=await request.get('/api/manifiestos/tareas-partes',{headers,params:{page,limit:6}});expect(r.status()).toBe(200);const d=(await r.json()).data;
   expect(d.total).toBe(131);expect(d.counts.certificates).toBe(3);ids.push(...d.items.map((m:any)=>m.id));
  }
  expect(new Set(ids).size).toBe(131);expect(ids).toContain('continuity-active-124');expect(ids).not.toContain('continuity-foreign');expect(ids).not.toContain('continuity-historical');
  const search=await request.get('/api/manifiestos/tareas-partes',{headers,params:{search:'QA-AGENDA-0124'}});expect((await search.json()).data.items.map((m:any)=>m.id)).toEqual(['continuity-active-124']);
  const future=await request.get('/api/manifiestos/tareas-partes',{headers,params:{period:'future'}});expect((await future.json()).data.items.map((m:any)=>m.id)).toEqual(['continuity-future']);
  for(const [filter,total] of [['mine',role==='operador'?1:2],['waiting',role==='operador'?1:0],['progress',1],['certificates',3]] as const){
   const r=await request.get('/api/manifiestos/tareas-partes',{headers,params:{filter}});expect((await r.json()).data.total).toBe(total);
  }
  expect((await request.get('/api/manifiestos/tareas-partes',{headers,params:{page:'-1'}})).status()).toBe(400);
 }
});
test('private drafts: permissions, idempotency, concurrent changes, file integrity, expiration and no actor creation',async({request})=>{
 await assertCloudDatabase();const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
 expect(['continuity_final_20261022','reactivation_20261022']).toContain(new URL(process.env.DATABASE_URL!).searchParams.get('schema'));
 const headers=await auth(request,'admin'),other=await auth(request,'lector-generadores'),actor=await auth(request,'generador'),wrongSector=await auth(request,'lector-transporte');
 const url='/api/actores/borradores/'+encodeURIComponent('admin:GENERADOR:qa-contract');
 const counts=async()=>[await db.generador.count(),await db.transportista.count(),await db.operador.count()];
 try{
  const before=await counts(),requestId=randomUUID(),data={form:{razonSocial:'ARTIFICIAL QA',password:'NEVER-PERSIST'},step:2};
  const save=await request.put(url,{headers,data:{version:0,requestId,data}});expect(save.status()).toBe(200);let d=(await save.json()).data.draft;
  expect(d.data.form).toEqual({razonSocial:'ARTIFICIAL QA'});expect(d.version).toBe(1);
  const retry=await request.put(url,{headers,data:{version:0,requestId,data}});expect((await retry.json()).data.draft.version).toBe(1);
  expect((await request.get(url,{headers:actor})).status()).toBe(403);expect((await request.get(url,{headers:wrongSector})).status()).toBe(403);
  expect((await (await request.get(url,{headers:other})).json()).data.draft).toBeNull();
  const {jsPDF}=createRequire(new URL('../../package.json',import.meta.url))('jspdf');const doc=new jsPDF();doc.text('ARTIFICIAL QA SIN VALIDEZ',20,20);const bytes=Buffer.from(doc.output('arraybuffer'));
  const upload=await request.put(url+'/archivos/CONSTANCIA_AFIP',{headers,multipart:{version:'1',year:'2025',file:{name:'QA.pdf',mimeType:'application/pdf',buffer:bytes}}});expect(upload.status(),await upload.text()).toBe(200);d=(await upload.json()).data.draft;
  expect(d.files[0]).toMatchObject({name:'QA.pdf',year:2025,sha256:createHash('sha256').update(bytes).digest('hex')});expect(d.files[0]).not.toHaveProperty('path');
  expect((await request.put(url,{headers,data:{version:0,requestId,data}})).status()).toBe(409);
  const file=await request.get(url+'/archivos/CONSTANCIA_AFIP',{headers});expect(file.status()).toBe(200);expect(await file.body()).toEqual(bytes);expect(file.headers()['cache-control']).toBe('no-store');
  expect((await request.get(url+'/archivos/CONSTANCIA_AFIP',{headers:other})).status()).toBe(404);
  const updated=await request.put(url,{headers,data:{version:d.version,requestId:randomUUID(),data:{form:{razonSocial:'SECOND DEVICE'},step:3}}});expect(updated.status()).toBe(200);const version=(await updated.json()).data.draft.version;
  expect((await request.put(url,{headers,data:{version:d.version,requestId:randomUUID(),data:{form:{razonSocial:'STALE'}}}})).status()).toBe(409);
  expect((await request.delete(url,{headers,data:{version:d.version}})).status()).toBe(409);
  expect((await request.put(url+'/archivos/CONSTANCIA_AFIP',{headers,multipart:{version:'1',year:'2025',file:{name:'QA.pdf',mimeType:'application/pdf',buffer:bytes}}})).status()).toBe(409);
  const after=(await (await request.get(url,{headers})).json()).data.draft;expect(after.data.form.razonSocial).toBe('SECOND DEVICE');expect(after.files).toHaveLength(1);
  expect((await request.put(url+'/archivos/FAKE',{headers,multipart:{version:String(version),file:{name:'fake.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')}}})).status()).toBe(400);
  await db.actorFormDraft.update({where:{ownerId_scope:{ownerId:fixture.users.admin,scope:'admin:GENERADOR:qa-contract'}},data:{expiresAt:new Date('2000-01-01')}});
  expect((await (await request.get(url,{headers})).json()).data.draft).toBeNull();expect((await request.get(url+'/archivos/CONSTANCIA_AFIP',{headers})).status()).toBe(404);
  expect((await request.delete(url,{headers,data:{version}})).status()).toBe(200);expect(await counts()).toEqual(before);
  writeFileSync(process.env.QA_ARTIFACTS!+'/draft-api-proof.json',JSON.stringify({noActorsCreated:true,privateFiles:true,conflict409:true,idempotentRetry:true,expiredDenied:true}));
 }finally{await db.$disconnect();}
});
