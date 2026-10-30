import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase,assertCloudEnvironment,backendRequire,externalKeys } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
const out=process.env.QA_ARTIFACTS!,fixture=JSON.parse(readFileSync(path.join(out,'individual-gps-scope-private.json'),'utf8'));
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient(),results=[];
try {
  for(const proc of JSON.parse(readFileSync(path.join(out,'processes.json'),'utf8'))) {
    const env=Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`,'utf8').split('\0').filter(Boolean).map(entry=>[entry.slice(0,entry.indexOf('=')),entry.slice(entry.indexOf('=')+1)]));
    assertCloudEnvironment(env);assert.equal(env.TRAINING_DATABASE_URL,'');assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
    assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED,'false');assert.equal(env.EMAIL_NOTIFICATION_FAMILIES,'');
    assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED,'false');for(const key of externalKeys)assert.equal(env[key],'');
  }
  const {TRAINING_LOGINS}=backendRequire('./dist/lib/trainingDirectLogin.js');assert.equal(TRAINING_LOGINS.length,4);
  for(const {email} of TRAINING_LOGINS) {
    assert.match(email,/@capacitacion\.invalid$/);
    const response=await fetch('http://127.0.0.1:4177/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.12.22.96'},body:JSON.stringify({email,password:'expired-qa-probe'})});
    assert.equal(response.status,403);
  }
  assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
  assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
  for(const [surface,cases] of Object.entries(fixture.cases) as Array<[string,Record<string,{id:string;numero:string}>]>) {
    for(const kind of ['scope','legacy']) {
      const item=cases[kind],manifest=await db.manifiesto.findUniqueOrThrow({where:{id:item.id},select:{estado:true,isDemoData:true}});
      assert.equal(manifest.isDemoData,true);assert.equal(manifest.estado,'EN_TRANSITO');
      const points=await db.trackingGPS.count({where:{manifiestoId:item.id,latitud:-33.62,longitud:-68.62}});
      assert.equal(points,kind==='scope'?1:0);
      assert.equal(await db.eventoManifiesto.count({where:{manifiestoId:item.id,tipo:{in:['ENTREGA','TRASPASO_TRANSPORTE']}}}),0);
      results.push({surface,kind,points});
    }
  }
  const report={synthetic:true,production:false,physicalGps:false,capClosed:true,emailAttempts:0,emailSent:0,pushEnabled:false,results};
  writeFileSync(path.join(out,'individual-gps-scope-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
