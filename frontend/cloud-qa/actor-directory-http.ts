import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {assertCloudDatabase,backendRequire} from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const {PrismaClient}=backendRequire('@prisma/client'), db=new PrismaClient();
const checks:Array<{path:string;status:number;total?:number}>=[];
const prefix='qa-directory-20261024', search='QA Padrón 24';
const base='http://127.0.0.1:3037/api';
try {
 const before={manifests:await db.manifiesto.count(),sent:await db.emailQueue.count({where:{sentAt:{not:null}}}),attempts:await db.emailQueue.count({where:{intentos:{gt:0}}})};
 // Artificial records exclusively inside the verified QA schema. No business workflow, mail or push.
 const password=await backendRequire('bcryptjs').hash('OnlyLocal-NightQA-2026!',10);
 for(const [kind,index] of [['generador',1],['transportista',2],['operador',3]] as const) {
  for(let i=0;i<24;i++) {
   const id=prefix+'-'+kind+'-'+i, cuit='99'+String(index*1000+i).padStart(9,'0'),email=id+'@night-qa.invalid';
   if(await db[kind].findUnique({where:{id}}))continue;
   await db.$transaction(async(tx:any)=>{
    await tx.usuario.create({data:{id:id+'-user',email,nombre:search+' '+kind+' '+String(i).padStart(2,'0'),password,rol:kind.toUpperCase(),cuit,activo:true,emailVerified:true,notifEmail:false}});
    const common={id,usuarioId:id+'-user',razonSocial:search+' '+kind+' '+String(i).padStart(2,'0'),cuit,email,domicilio:'Domicilio sintético QA',telefono:'000000000',activo:i<22};
    await tx[kind].create({data:{...common,...(kind==='generador'?{numeroInscripcion:'QA-'+i,categoria:'1',rubro:i<21?'QA habitual':'QA especial'}:kind==='transportista'?{numeroHabilitacion:'QA-'+i,localidad:i<21?'QA Centro':'QA Valle'}:{numeroHabilitacion:'QA-'+i,categoria:'QA',tipoOperador:i<21?'FIJO':i===21?'IN_SITU':i===22?'FIJO / IN SITU':'IN SITU',corrientesY:i<21?'Y80':i===21?'Y8/Y9':i===22?'Y8; Y48':'Y48'})}});
   });
  }
 }
 const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'})});
 assert.equal(login.status,200);const token=(await login.json()).data.tokens.accessToken;
 async function get(path:string,status=200) {
  const r=await fetch(base+path,{headers:{Authorization:'Bearer '+token}}),body=await r.json();
  assert.equal(r.status,status,path+' '+JSON.stringify(body));checks.push({path,status,total:body.data?.pagination?.total});return body.data;
 }
 const q='?search='+encodeURIComponent(search)+'&limit=20&sortBy=razonSocial&sortOrder=asc';
 for(const kind of ['generadores','transportistas','operadores']) {
  const first=await get('/actores/'+kind+q);assert.equal(first[kind].length,20);assert.equal(first.pagination.total,24);assert.equal(first.pagination.pages,2);
  const second=await get('/actores/'+kind+q+'&page=2');assert.equal(second[kind].length,4);assert.ok(!first[kind].some((row:any)=>second[kind].some((other:any)=>row.id===other.id)));
  const inactive=await get('/actores/'+kind+q+'&activo=false');assert.equal(inactive.pagination.total,2);assert.equal(inactive[kind].length,2);assert.ok(inactive[kind].every((row:any)=>row.activo===false));
 }
 const allT=await get('/actores/transportistas'+q);assert.ok(allT.localidades.includes('QA Valle'));assert.ok(allT.transportistas.every((row:any)=>row.localidad==='QA Centro'));
 const valley=await get('/actores/transportistas'+q+'&localidad=QA%20Valle');assert.equal(valley.pagination.total,3);assert.equal(valley.transportistas.length,3);
 const valleyActive=await get('/actores/transportistas'+q+'&localidad=QA%20Valle&activo=true');assert.equal(valleyActive.pagination.total,1);
 const fixed=await get('/actores/operadores'+q+'&tipoOperador=FIJO');assert.equal(fixed.pagination.total,22);assert.equal(fixed.pagination.pages,2);
 const situ=await get('/actores/operadores'+q+'&tipoOperador=IN%20SITU');assert.equal(situ.pagination.total,3);
 const oil=await get('/actores/operadores'+q+'&corriente=Y8');assert.equal(oil.pagination.total,2);assert.ok(oil.operadores.every((o:any)=>!o.corrientesY.includes('Y80')));
 const both=await get('/actores/operadores'+q+'&tipoOperador=FIJO&corriente=Y8&activo=false');assert.equal(both.pagination.total,1);assert.equal(both.operadores[0].id,prefix+'-operador-22');
 await get('/actores/operadores'+q+'&corriente=Y80',400);
 await get('/actores/operadores'+q+'&tipoOperador=unknown',400);
 await get('/actores/transportistas'+q+'&localidad[]=x',400);
 const after={manifests:await db.manifiesto.count(),sent:await db.emailQueue.count({where:{sentAt:{not:null}}}),attempts:await db.emailQueue.count({where:{intentos:{gt:0}}})};
 assert.deepEqual(after,before);assert.equal(after.sent,0);assert.equal(after.attempts,0);
 writeFileSync(process.env.QA_ARTIFACTS+'/directory-http.json',JSON.stringify({at:new Date().toISOString(),passed:checks.length,checks,syntheticActors:72,before,after},null,2));
 console.log(checks.length+' directory HTTP checks passed');
} finally {await db.$disconnect();}
