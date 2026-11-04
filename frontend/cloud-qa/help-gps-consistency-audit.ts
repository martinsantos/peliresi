import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {assertCloudDatabase,assertCloudEnvironment,backendRequire} from './safety.ts';

await assertCloudDatabase();
const out=process.env.QA_ARTIFACTS!;
assert.equal(out,'/work/sitrep/.qa-help-gps-consistency-20261030');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const processes=JSON.parse(readFileSync(path.join(out,'processes.json'),'utf8'));
assert.deepEqual(processes.map((p:{file:string})=>p.file).sort(),['runtime.ts','server.ts']);
for(const p of processes){
 const env=Object.fromEntries(readFileSync('/proc/'+p.pid+'/environ','utf8').split('\0').filter(Boolean).map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
 assertCloudEnvironment(env);assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'),'proposal_operations_20261021');
 assert.equal(env.TRAINING_DATABASE_URL,'');assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
}
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
try {
 assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
 assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
 for(const [i,role] of ['admin','generador','transporte','operador'].entries()){
  const result=await fetch('http://127.0.0.1:4177/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.11.78.'+(i+1)},body:JSON.stringify({email:role+'@capacitacion.invalid',password:'expired-qa-probe'})});
  assert.equal(result.status,403,'CAP cerrado para '+role);
 }
 writeFileSync(path.join(out,'audit.json'),JSON.stringify({synthetic:true,capAliasesRejected:4,emailAttempts:0,emailSent:0,push:false,processes:processes.length}),{flag:'wx',mode:0o600});
 console.log('Preview artificial: CAP cerrado, correo sin intentos ni envíos y push apagado.');
} finally {await db.$disconnect();}
