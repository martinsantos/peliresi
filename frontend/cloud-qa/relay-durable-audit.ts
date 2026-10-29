import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {assertCloudDatabase,backendRequire} from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL,'');assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const dir=process.env.QA_ARTIFACTS!,baseline=process.env.QA_RELAY_DURABLE_BASELINE==='true';
const fixture=JSON.parse(readFileSync(path.join(dir,'fleet-private.json'),'utf8'));
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient(),results=[];
try{
  for(const surface of ['web','app']){
    const name=`relay-durable-a-lost-rela-7b19d--reopen-without-duplicating-its-fix-${surface}`;
    const root=path.join(dir,'relay-durable-browser');
    const {readdirSync}=await import('node:fs');const testDir=readdirSync(root).find((v:string)=>v.endsWith('-'+surface)&&v.startsWith('relay-durable-')&&!v.includes('rotated')&&!v.includes('older')&&!v.includes('not-accept'));
    assert.ok(testDir,`Missing ${name}`);
    const ids=JSON.parse(readFileSync(path.join(root,testDir,'relay-ids.json'),'utf8'));
    assert.equal(ids.fleetLeg,fixture.cases[surface].incoming.tramoId);
    const legs=await db.tramoTransporte.findMany({where:{id:{in:[ids.standaloneLeg,ids.fleetLeg]}},include:{manifiesto:{select:{isDemoData:true}}}});
    assert.equal(legs.length,2);assert.ok(legs.every((leg:any)=>leg.manifiesto.isDemoData));
    const points=await Promise.all([ids.standaloneLeg,ids.fleetLeg].map((tramoId:string)=>db.trackingGPS.count({where:{tramoId}})));
    assert.deepEqual(points,baseline?[2,2]:[1,1]);
    if(!baseline){
      const rotationDir=readdirSync(root).find((v:string)=>v.endsWith('-'+surface)&&v.startsWith('relay-durable-')&&v.includes('rotated'));
      assert.ok(rotationDir,'Missing rotated capability case');
      const rotation=JSON.parse(readFileSync(path.join(root,rotationDir,'relay-rotation.json'),'utf8'));
      const leg=await db.tramoTransporte.findUniqueOrThrow({where:{id:rotation.leg},include:{manifiesto:{select:{isDemoData:true}}}});
      assert.equal(leg.manifiesto.isDemoData,true);assert.equal(await db.trackingGPS.count({where:{tramoId:rotation.leg}}),2);
      const missingDir=readdirSync(root).find((v:string)=>v.endsWith('-'+surface)&&v.startsWith('relay-durable-')&&v.includes('not-accept'));
      assert.ok(missingDir,'Missing unaccepted fix case');
      const missing=JSON.parse(readFileSync(path.join(root,missingDir,'relay-not-accepted.json'),'utf8'));
      const missingLeg=await db.tramoTransporte.findUniqueOrThrow({where:{id:missing.leg},include:{manifiesto:{select:{isDemoData:true}}}});
      assert.equal(missingLeg.manifiesto.isDemoData,true);assert.equal(await db.trackingGPS.count({where:{tramoId:missing.leg}}),1);
      const olderDir=readdirSync(root).find((v:string)=>v.endsWith('-'+surface)&&v.startsWith('relay-durable-')&&v.includes('older'));
      assert.ok(olderDir,'Missing older fix case');
      const older=JSON.parse(readFileSync(path.join(root,olderDir,'relay-older.json'),'utf8'));
      const olderLeg=await db.tramoTransporte.findUniqueOrThrow({where:{id:older.leg},include:{manifiesto:{select:{isDemoData:true}}}});
      assert.equal(olderLeg.manifiesto.isDemoData,true);assert.equal(await db.trackingGPS.count({where:{tramoId:older.leg}}),1);
    }
    results.push({surface,points});
  }
  assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
  const result={synthetic:true,production:false,emails:false,push:false,baseline,results};
  writeFileSync(path.join(dir,'relay-durable-audit.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await db.$disconnect();}
