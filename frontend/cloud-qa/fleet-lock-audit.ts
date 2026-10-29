import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {assertCloudDatabase,backendRequire} from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL,'');assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const dir=process.env.QA_ARTIFACTS!,fixture=JSON.parse(readFileSync(path.join(dir,'fleet-private.json'),'utf8'));
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient(),results=[];
try{
  for(const surface of ['web','app']){
    const {a,b}=fixture.cases[surface];
    const records=await Promise.all([a,b].map((item:{id:string})=>db.manifiesto.findUniqueOrThrow({where:{id:item.id},select:{estado:true,isDemoData:true}})));
    assert.ok(records.every((r:{isDemoData:boolean})=>r.isDemoData));
    assert.deepEqual(records.map((r:{estado:string})=>r.estado),['ENTREGADO','EN_TRANSITO']);
    const points=await Promise.all([a,b].map((item:{id:string})=>db.trackingGPS.count({where:{manifiestoId:item.id}})));
    assert.deepEqual(points,[1,1]);assert.equal(await db.eventoManifiesto.count({where:{manifiestoId:a.id,tipo:'ENTREGA'}}),1);
    results.push({surface,points,deliveries:1});
  }
  assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
  const result={synthetic:true,production:false,emails:false,push:false,results};
  writeFileSync(path.join(dir,'fleet-lock-audit.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await db.$disconnect();}
