import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {assertCloudDatabase,assertCloudEnvironment,backendRequire,externalKeys} from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
const savedFixture=path.join(process.env.QA_ARTIFACTS!,'gps-lost-response-private.json');
const fixture=JSON.parse(readFileSync(existsSync(savedFixture)?savedFixture:path.join(process.env.QA_ARTIFACTS!,'gps-order-private.json'),'utf8'));
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient(),checked=[];
try{
  for(const proc of JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'processes.json'),'utf8'))){
    const env=Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`,'utf8').split('\0').filter(Boolean).map(entry=>[entry.slice(0,entry.indexOf('=')),entry.slice(entry.indexOf('=')+1)]));
    assertCloudEnvironment(env);assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'),'proposal_operations_20261021');
    assert.equal(env.TRAINING_DATABASE_URL,'');assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
    assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED,'false');assert.equal(env.EMAIL_NOTIFICATION_FAMILIES,'');assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED,'false');
    for(const key of externalKeys)assert.equal(env[key],'');
  }
  const {TRAINING_LOGINS}=backendRequire('./dist/lib/trainingDirectLogin.js');assert.equal(TRAINING_LOGINS.length,4);
  for(const {email} of TRAINING_LOGINS){
    assert.match(email,/@capacitacion\.invalid$/);
    const response=await fetch('http://127.0.0.1:4177/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.12.22.99'},body:JSON.stringify({email,password:'expired-qa-probe'})});
    assert.equal(response.status,403);
  }
  assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
  assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
  for(const [surface,value] of Object.entries(fixture.cases) as Array<[string,any]>){
    for(const [name,expected] of [['fleetA',[[-33.42,-68.42],[-33.44,-68.44]]],['fleetB',[[-33.42,-68.42]]],['relay',[[-33.52,-68.52],[-33.54,-68.54]]]] as Array<[string,number[][]]>){
      const manifest=await db.manifiesto.findUniqueOrThrow({where:{id:value[name].id},select:{numero:true,isDemoData:true}});
      assert.equal(manifest.isDemoData,true);assert.match(manifest.numero,/^QA-GPS-ORDER-/);
      const points=await db.trackingGPS.findMany({where:{manifiestoId:value[name].id},select:{id:true,latitud:true,longitud:true}});
      assert.equal(points.length,expected.length,`${surface}:${name}: unexpected point count`);
      for(const [lat,lon] of expected)assert.equal(points.filter((p:{latitud:number;longitud:number})=>p.latitud===lat&&p.longitud===lon).length,1);
      assert.ok(points.every((p:{id:string})=>p.id.startsWith(name==='relay'?'gpslegv1_':'gpsv1_')));
      checked.push({surface,name,points:points.length,duplicates:0});
    }
  }
  const report={synthetic:true,physicalGps:false,capClosed:true,emailAttempts:0,emailSent:0,pushEnabled:false,checked};
  writeFileSync(path.join(process.env.QA_ARTIFACTS!,'gps-lost-response-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await db.$disconnect();}
