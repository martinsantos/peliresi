import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {assertCloudDatabase,backendRequire} from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS,'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const out=process.env.QA_ARTIFACTS!;
const second=JSON.parse(readFileSync(path.join(out,'gps-order-second-private.json'),'utf8'));
const third=JSON.parse(readFileSync(path.join(out,'gps-order-third-private.json'),'utf8'));
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();

async function inspect(id:string,number:string){
  const manifest=await db.manifiesto.findUniqueOrThrow({where:{id},select:{numero:true,isDemoData:true}});
  assert.equal(manifest.numero,number);assert.equal(manifest.isDemoData,true);assert.match(number,/^QA-GPS-ORDER-/);
  const [legs,events,firstPoint,concurrentPoint]=await Promise.all([
    db.tramoTransporte.findMany({where:{manifiestoId:id},select:{tipo:true,fin:true}}),
    db.eventoManifiesto.count({where:{manifiestoId:id,tipo:'RELEVO_TRANSPORTE'}}),
    db.trackingGPS.count({where:{manifiestoId:id,latitud:-33.52,longitud:-68.52}}),
    db.trackingGPS.count({where:{manifiestoId:id,latitud:-33.54,longitud:-68.54}}),
  ]);
  return {synthetic:true,legs:legs.map((leg:{tipo:string;fin:Date|null})=>({type:leg.tipo,ended:leg.fin!==null})),
    handoffEvents:events,firstPoint,concurrentPoint};
}
try{
  const secondApp=second.cases.app.relay,thirdWeb=third.cases['web-desktop'].relay;
  const report={synthetic:true,production:false,
    concurrentRelayFailure:await inspect(secondApp.id,secondApp.numero),
    handoffRequestFailure:await inspect(thirdWeb.id,thirdWeb.numero)};
  writeFileSync(path.join(out,'c18-forensics.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}finally{await db.$disconnect();}
