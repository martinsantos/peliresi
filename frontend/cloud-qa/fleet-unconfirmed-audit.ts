import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const directory=process.env.QA_ARTIFACTS!, fixture=JSON.parse(readFileSync(path.join(directory,'fleet-private.json'),'utf8'));
const baseline=process.env.QA_FLEET_UNCONFIRMED_BASELINE==='true';
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient(),results=[];
try{
  for(const surface of ['web','app']){
    const {a,b}=fixture.cases[surface];
    const [first,second]=await Promise.all([a,b].map((item:{id:string})=>db.manifiesto.findUniqueOrThrow({where:{id:item.id},select:{numero:true,isDemoData:true,estado:true}})));
    assert.equal(first.isDemoData,true);assert.equal(second.isDemoData,true);assert.equal(first.numero,a.numero);assert.equal(second.numero,b.numero);
    assert.equal(first.estado,'ENTREGADO');assert.equal(second.estado,'EN_TRANSITO');
    const [firstPoints,secondPoints,deliveries]=await Promise.all([
      db.trackingGPS.count({where:{manifiestoId:a.id}}),db.trackingGPS.count({where:{manifiestoId:b.id}}),
      db.eventoManifiesto.count({where:{manifiestoId:a.id,tipo:'ENTREGA'}}),
    ]);
    assert.equal(firstPoints,baseline?0:1);assert.equal(secondPoints,1);assert.equal(deliveries,1);
    results.push({surface,firstPoints,secondPoints,deliveries});
  }
  assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
  assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
  const result={synthetic:true,baseline,production:false,emails:false,push:false,results};
  writeFileSync(path.join(directory,'fleet-unconfirmed-audit.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}finally{await db.$disconnect();}
