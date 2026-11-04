// P0 circuit on the isolated preview API only (127.0.0.1:3048, schema inspection_field_20261103).
// Artificial accounts and data. DISABLE_EMAILS stays true: rows are inspected, never delivered.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
const root='/qa/inspection-model-20261103';const out=root+'/results/correos-p0';mkdirSync(out,{recursive:true});
const require=createRequire(root+'/backend/package.json');const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient({datasources:{db:{url:'postgresql://qa@127.0.0.1:55441/sitrep_ephemeral_qa_1a93?schema=inspection_field_20261103&connection_limit=1'}}});
const proof=await db.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`;assert.deepEqual(proof,[{name:'sitrep_ephemeral_qa_1a93',port:55441}]);
const checks=[];const ok=label=>{checks.push(label);console.log('PASS',label);};
let auth='';
async function call(path,body,method=body?'POST':'GET',headers={}){const res=await fetch('http://127.0.0.1:3048/api'+path,{method,headers:{'X-SITREP-Synthetic-Preview':'1',...(auth?{Authorization:'Bearer '+auth}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});const data=(res.headers.get('content-type')||'').includes('json')?await res.json():null;return{status:res.status,data};}
function expectStatus(label,r,status){assert.equal(r.status,status,label+': '+JSON.stringify(r.data).slice(0,300));ok(label);return r.data?.data;}
async function login(email,password){auth='';const r=await call('/auth/login',{email,password});assert.equal(r.status,200,'login '+email);auth=r.data.data.tokens.accessToken;}
const secretsFile=root+'/results/p0-accounts.json';
const accounts=existsSync(secretsFile)?JSON.parse(readFileSync(secretsFile,'utf8')):{jefatura:randomBytes(12).toString('hex')};
writeFileSync(secretsFile,JSON.stringify(accounts),{mode:0o600});
const JEF='jefatura01@practica.sitrep.test';
const rows=async eventoId=>db.emailQueue.findMany({where:{id:{startsWith:`inspection-act:${eventoId}:`}},orderBy:{id:'asc'}});

// Staff preferences through the product endpoints; jefatura created by the admin flow.
await login('inspector01@practica.sitrep.test',process.env.QA_INSPECTOR_PASSWORD);
expectStatus('inspector opts in to email notices',await call('/admin/preferencias-notificacion',{notifEmail:true},'PUT'),200);
let jef=await db.usuario.findUnique({where:{email:JEF}});
if(!jef){expectStatus('admin creates artificial management account',await call('/admin/usuarios',{email:JEF,password:accounts.jefatura,nombre:'Jefatura de práctica',rol:'ADMIN_GENERADOR',emailVerified:true}),201);jef=await db.usuario.findUnique({where:{email:JEF}});}
expectStatus('explicit ADMIN_INSPECCIONES assignment',await call('/inspecciones/jefatura',{usuarioId:jef.id,activo:true},'PUT'),200);
await login(JEF,accounts.jefatura);
expectStatus('management account opts in to email notices',await call('/admin/preferencias-notificacion',{notifEmail:true},'PUT'),200);

await login('inspector01@practica.sitrep.test',process.env.QA_INSPECTOR_PASSWORD);
const detail=expectStatus('open artificial case',await call('/inspecciones/qa-field-case'),200);
const firma=detail.eventos.filter(e=>e.tipo==='ACTA_FIRMADA').sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];assert.ok(firma,'signed version required');
async function share(){const s=expectStatus('prepare limited link without sending',await call('/inspecciones/qa-field-case/accesos-acta',{firmaId:firma.id,destinatario:'inspeccionado@practica.sitrep.test',diasAcceso:7}),201);assert.equal(s.correo.enviado,false);return{...s,token:new URL(s.url).hash.slice(1)};}
const live=await share();const staffAuth=auth;
writeFileSync(root+'/results/p0-live-link.json',JSON.stringify({id:live.id,url:live.url,appUrl:live.appUrl}),{mode:0o600});

// Link holder presents; a replay of the same request id is not a new presentation nor new mail.
auth='';const H={'X-Sitrep-Acta-Token':live.token};
expectStatus('link holder opens copy',await call('/inspecciones/acta-compartida/'+live.id,undefined,'GET',H),200);
const body={clienteId:randomUUID(),tipo:'DESCARGO',nombre:'Persona de práctica',texto:'Descargo artificial para comprobar los avisos por correo del circuito P0.'};
const posted=expectStatus('link holder registers descargo',await call('/inspecciones/acta-compartida/'+live.id+'/presentaciones',body,'POST',H),201);
const replay=expectStatus('replay of the same request id',await call('/inspecciones/acta-compartida/'+live.id+'/presentaciones',body,'POST',H),201);assert.equal(replay.id,posted.id);ok('replay returns the same presentation');
let q=await rows(posted.id);
assert.deepEqual(q.map(r=>r.id.split(':')[2]).sort(),['INSPECCIONADO','INSPECTOR','JEFATURA']);ok('presentation prepares inspeccionado, inspector and management mail once');
assert.ok(q.every(r=>r.estado==='SUPRIMIDO'&&r.error==='EMAIL_DISABLED'&&!r.sentAt));ok('all rows held by the kill switch, none sent');
assert.equal(q.find(r=>r.id.includes(':INSPECCIONADO:')).to,'inspeccionado@practica.sitrep.test');
assert.ok(!q.find(r=>r.id.includes(':INSPECCIONADO:')).html.includes(live.token));ok('inspeccionado mail does not carry the personal token');
const tamper=await call('/inspecciones/acta-compartida/'+live.id+'/presentaciones',{...body,texto:body.texto+' alterado'},'POST',H);assert.equal(tamper.status,409);ok('reused request id with different text is rejected');

// Inspector answers: inspeccionado + management copy, never the author.
auth=staffAuth;
const answer=expectStatus('assigned inspector publishes answer',await call('/inspecciones/qa-field-case/presentaciones-acta/responder',{clienteId:randomUUID(),respondeAId:posted.id,texto:'Respuesta artificial del inspector asignado.'}),200);
q=await rows(answer.id);assert.deepEqual(q.map(r=>r.id.split(':')[2]).sort(),['INSPECCIONADO','JEFATURA']);ok('inspector answer: no copy to its author');
await login(JEF,accounts.jefatura);
const second=expectStatus('management publishes a follow-up answer',await call('/inspecciones/qa-field-case/presentaciones-acta/responder',{clienteId:randomUUID(),respondeAId:posted.id,texto:'Ampliación artificial de la jefatura de práctica.'}),200);
q=await rows(second.id);assert.deepEqual(q.map(r=>r.id.split(':')[2]).sort(),['INSPECCIONADO','INSPECTOR']);ok('management answer copies the assigned inspector');
const ledger=expectStatus('staff ledger lists prepared mail',await call('/inspecciones/qa-field-case/correos-acta'),200);assert.equal(ledger.envioHabilitado,false);assert.equal(ledger.motivo,'EMAIL_DISABLED');
auth='';const seen=expectStatus('link holder sees both answers',await call('/inspecciones/acta-compartida/'+live.id,undefined,'GET',H),200);assert.equal(seen.mensajes.filter(m=>m.autoridad).length>=2,true);

// Revoked link: no access, no new presentation, an answer keeps staff mail only.
auth=staffAuth;const gone=await share();
auth='';const G={'X-Sitrep-Acta-Token':gone.token};
const early=expectStatus('second link holder registers consulta',await call('/inspecciones/acta-compartida/'+gone.id+'/presentaciones',{clienteId:randomUUID(),tipo:'CONSULTA',nombre:'Persona de práctica',texto:'Consulta artificial antes de la revocación.'},'POST',G),201);
auth=staffAuth;expectStatus('inspector revokes second link',await call('/inspecciones/qa-field-case/accesos-acta/'+gone.id+'/revocar',{}),200);
auth='';expectStatus('revoked link cannot be opened',await call('/inspecciones/acta-compartida/'+gone.id,undefined,'GET',G),403);
expectStatus('revoked link cannot present',await call('/inspecciones/acta-compartida/'+gone.id+'/presentaciones',{clienteId:randomUUID(),tipo:'CONSULTA',nombre:'Persona',texto:'Intento posterior a la revocación.'},'POST',G),403);
auth=staffAuth;const late=expectStatus('answer after revocation stays in the dossier',await call('/inspecciones/qa-field-case/presentaciones-acta/responder',{clienteId:randomUUID(),respondeAId:early.id,texto:'Respuesta artificial posterior a la revocación.'}),200);
q=await rows(late.id);assert.ok(!q.some(r=>r.id.includes(':INSPECCIONADO:')));ok('revoked link receives no mail');

// Actors never reach the internal module or its mail ledger.
await login('generador01@practica.sitrep.test',process.env.QA_GENERATOR_PASSWORD);
for(const [path,method,payload] of [['/inspecciones','GET'],['/inspecciones/qa-field-case','GET'],['/inspecciones/qa-field-case/correos-acta','GET'],['/inspecciones/qa-field-case/presentaciones-acta/responder','POST',{clienteId:randomUUID(),respondeAId:posted.id,texto:'Intento de un actor sin permiso.'}],['/inspecciones/qa-field-case/accesos-acta','POST',{firmaId:firma.id,destinatario:'x@practica.sitrep.test'}]]){const r=await call(path,payload,method);assert.equal(r.status,403,path+' '+r.status);ok('actor denied '+method+' '+path);}

// Render every prepared variant for visual review. Nothing is sent.
const all=await db.emailQueue.findMany({where:{id:{startsWith:'inspection-act:'}},orderBy:{createdAt:'asc'}});
assert.ok(all.every(r=>r.estado!=='ENVIADO'&&!r.sentAt));ok('no inspection-act row was ever sent');
const index=[];const events={[posted.id]:'presentacion',[answer.id]:'respuesta-inspector',[second.id]:'respuesta-jefatura',[late.id]:'respuesta-tras-revocacion'};
for(const r of all){const [,ev,aud]=r.id.split(':');if(!events[ev])continue;const name=`${events[ev]}-${aud.toLowerCase()}.html`;writeFileSync(out+'/'+name,r.html);index.push({archivo:name,audiencia:aud,evento:events[ev],destinatario:r.to.replace(/^[^@]+/,'***'),asunto:r.subject,estado:r.estado,motivo:r.error});}
writeFileSync(out+'/index.json',JSON.stringify(index,null,2));
writeFileSync(root+'/results/flow-p0.json',JSON.stringify({checks,production:false,emails:false,push:false,emailRowsSent:0},null,2));
console.log('P0 checks',checks.length);await db.$disconnect();
