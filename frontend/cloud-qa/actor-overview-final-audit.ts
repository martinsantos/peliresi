import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {assertCloudDatabase,assertCloudEnvironment,backendRequire} from './safety.ts';

await assertCloudDatabase();
const out=process.env.QA_ARTIFACTS!;
assert.equal(out,'/work/sitrep/.qa-actor-overview-20261031');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
const fixture=JSON.parse(readFileSync(path.join(out,'fixture.json'),'utf8'));assert.equal(fixture.synthetic,true);
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
try{
 for(const kind of ['generador','transportista','operador'])assert.equal(await db[kind].count({where:{id:{startsWith:fixture.prefix+kind+'-'}}}),121);
 const manifests=await db.manifiesto.count(),attempts=await db.emailQueue.count({where:{intentos:{gt:0}}}),sent=await db.emailQueue.count({where:{sentAt:{not:null}}});
 assert.equal(manifests,fixture.before.manifests+4);assert.equal(attempts,0);assert.equal(sent,0);
 const processes=JSON.parse(readFileSync(path.join(out,'processes.json'),'utf8'));
 for(const item of processes){
  const env=Object.fromEntries(readFileSync('/proc/'+item.pid+'/environ','utf8').split('\0').filter(Boolean).map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
  assertCloudEnvironment(env);assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'),'proposal_operations_20261021');
  assert.equal(env.TRAINING_DATABASE_URL,'');assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
 }
 writeFileSync(path.join(out,'final-safety.json'),JSON.stringify({synthetic:true,fixtureActors:363,additionalSyntheticManifests:4,emailsSent:sent,emailAttempts:attempts,push:false,capClosed:true}),{flag:'wx',mode:0o600});
 console.log('Auditoría final: sólo datos artificiales; cero intentos y envíos de correo; CAP cerrado y push apagado.');
}finally{await db.$disconnect();}
