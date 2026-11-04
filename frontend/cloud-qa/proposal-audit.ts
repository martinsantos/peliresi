import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {assertCloudDatabase,assertCloudEnvironment,backendRequire,externalKeys} from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
const out=process.env.QA_ARTIFACTS!,{PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient(),checks:string[]=[];
const compiledDb=backendRequire('./dist/lib/prisma.js').default;
try{
 for(const proc of JSON.parse(readFileSync(out+'/processes.json','utf8'))){
  const env=Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`,'utf8').split('\0').filter(Boolean).map(s=>[s.slice(0,s.indexOf('=')),s.slice(s.indexOf('=')+1)]));
  assertCloudEnvironment(env);assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'),'proposal_operations_20261021');
  assert.equal(env.TRAINING_DATABASE_URL,'');assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED,'false');assert.equal(env.EMAIL_NOTIFICATION_FAMILIES,'');
  assert.equal(env.MANIFEST_PROPOSALS_ENABLED,'true');for(const key of externalKeys)assert.equal(env[key],'');
 }
 checks.push('actual runtime: isolated database, proposals enabled, CAP closed, email and push disabled, providers empty');
 const {TRAINING_LOGINS}=backendRequire('./dist/lib/trainingDirectLogin.js');
 assert.equal(TRAINING_LOGINS.length,4);
 for(const {email} of TRAINING_LOGINS){
  assert.match(email,/@capacitacion\.invalid$/);{const res=await fetch('http://127.0.0.1:4177/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.12.22.99'},body:JSON.stringify({email,password:'expired-qa-probe'})});assert.equal(res.status,403);}
 }
 checks.push('all four CAP aliases refuse login with 403');
 const {notificationMailContent,notificationSourceEligible,queueCommittedNotificationEmails}=backendRequire('./dist/services/notification-mail.service.js');
 const notices=await db.notificacion.findMany({where:{datos:{contains:'propuesta_partes'}},include:{usuario:true}});assert.ok(notices.length>=50);
 const phases=new Set<string>();let simulated=0;
 for(const notice of notices){
  const data=JSON.parse(notice.datos);phases.add(data.fase);
  const envelope={...notice,...notice.usuario,id:notice.id,usuarioId:notice.usuarioId,manifiestoId:notice.manifiestoId,tipo:notice.tipo,datos:notice.datos};
  const content=notificationMailContent(envelope);assert.ok(content);assert.equal(await notificationSourceEligible(envelope,'manifiestos'),true);simulated++;
 }
 for(const phase of ['creada','aprobada','iniciada','rechazada','aprobacion-GENERADOR','aprobacion-TRANSPORTISTA','aprobacion-OPERADOR'])assert.ok(phases.has(phase),phase);
 const count=await db.emailQueue.count();assert.equal(await queueCommittedNotificationEmails(),0);assert.equal(await db.emailQueue.count(),count);
 assert.equal(await db.emailQueue.count({where:{estado:{not:'SUPRIMIDO'}}}),0);assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
 checks.push('proposal notices resolve to the three current parties; every phase renders simulated mail; actual relay queues/sends nothing');
 const original=await db.manifiesto.findUniqueOrThrow({where:{id:'manifest-qa-legacy'},include:{residuos:true,eventos:true}});assert.equal(JSON.stringify(original),readFileSync(out+'/manifest-legacy-before.json','utf8'));
 checks.push('original historical manifest retained byte-for-byte');
 writeFileSync(out+'/proposal-audit.json',JSON.stringify({checks,noticeCount:notices.length,simulatedMail:simulated,phases:[...phases],emailQueue:count,attempts:0,sent:0},null,2));console.log(checks);
}finally{await db.$disconnect();await compiledDb.$disconnect();}
