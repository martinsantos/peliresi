import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {assertCloudDatabase,assertCloudEnvironment,backendRequire,externalKeys} from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
const out=process.env.QA_ARTIFACTS!,fixture=JSON.parse(readFileSync(path.join(out,'sync-role-private.json'),'utf8'));
const baseline=process.env.SITREP_QA_RUN==='sync-role-baseline-20261029';
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient(),results=[];
try{
  for(const proc of JSON.parse(readFileSync(path.join(out,'processes.json'),'utf8'))){
    const env=Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`,'utf8').split('\0').filter(Boolean).map(entry=>[entry.slice(0,entry.indexOf('=')),entry.slice(entry.indexOf('=')+1)]));
    assertCloudEnvironment(env);assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'),'proposal_operations_20261021');
    assert.equal(env.ACTOR_MULTIROLE_ENABLED,'true');assert.equal(env.VITE_ACTOR_MULTIROLE_ENABLED,'true');
    assert.equal(env.TRAINING_DATABASE_URL,'');assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
    assert.equal(env.DISABLE_EMAILS,'true');assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
    assert.equal(env.EMAIL_NOTIFICATION_FAMILIES,'');assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED,'false');
    for(const key of externalKeys)assert.equal(env[key],'');
  }
  const {TRAINING_LOGINS}=backendRequire('./dist/lib/trainingDirectLogin.js');assert.equal(TRAINING_LOGINS.length,4);
  for(const {email} of TRAINING_LOGINS){
    assert.match(email,/@capacitacion\.invalid$/);
    const response=await fetch('http://127.0.0.1:4177/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.12.22.98'},body:JSON.stringify({email,password:'expired-qa-probe'})});
    assert.equal(response.status,403);
  }
  assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
  assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
  for(const [surface,item] of Object.entries(fixture.cases) as Array<[string,{id:string;numero:string}]>){
    const manifest=await db.manifiesto.findUniqueOrThrow({where:{id:item.id},select:{numero:true,estado:true,isDemoData:true}});
    assert.equal(manifest.numero,item.numero);assert.equal(manifest.isDemoData,true);assert.match(item.numero,/^QA-SYNC-ROLE-/);
    const deliveries=await db.eventoManifiesto.count({where:{manifiestoId:item.id,tipo:'ENTREGA'}});
    assert.equal(manifest.estado,baseline?'EN_TRANSITO':'ENTREGADO');assert.equal(deliveries,baseline?0:1);
    results.push({surface,state:manifest.estado,deliveries});
  }
  if(!baseline)for(const [surface,item] of Object.entries(fixture.legacy) as Array<[string,{id:string;numero:string}]>){
    const manifest=await db.manifiesto.findUniqueOrThrow({where:{id:item.id},select:{numero:true,estado:true,isDemoData:true}});
    assert.equal(manifest.numero,item.numero);assert.equal(manifest.isDemoData,true);assert.match(item.numero,/^QA-SYNC-ROLE-/);
    const deliveries=await db.eventoManifiesto.count({where:{manifiestoId:item.id,tipo:'ENTREGA'}});
    assert.equal(manifest.estado,'ENTREGADO');assert.equal(deliveries,1);
    results.push({surface,scenario:'legacy',state:manifest.estado,deliveries});
  }
  const report={synthetic:true,production:false,capClosed:true,emailAttempts:0,emailSent:0,pushEnabled:false,multiRolePreview:true,results};
  writeFileSync(path.join(out,'sync-role-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await db.$disconnect();}
