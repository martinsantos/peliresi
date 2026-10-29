import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const out = process.env.QA_ARTIFACTS!, fixture = JSON.parse(readFileSync(path.join(out, 'fleet-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient(), results = [];
try {
  for (const surface of ['web','app']) {
    const item = fixture.cases[surface];
    const [delivered, handedOff, incoming] = await Promise.all([item.a,item.b,item.incoming].map((load: {id:string}) =>
      db.manifiesto.findUniqueOrThrow({ where: { id: load.id }, select: { numero:true,isDemoData:true,estado:true } })));
    for (const manifest of [delivered,handedOff,incoming]) assert.equal(manifest.isDemoData, true);
    assert.equal(delivered.numero,item.a.numero); assert.equal(delivered.estado,'ENTREGADO');
    assert.equal(handedOff.numero,item.b.numero); assert.equal(handedOff.estado,'EN_TRANSITO');
    assert.equal(incoming.numero,item.incoming.numero); assert.equal(incoming.estado,'EN_TRANSITO');
    const [aPoints,bPoints,incomingPoints,external,receivedLeg] = await Promise.all([
      db.trackingGPS.findMany({where:{manifiestoId:item.a.id},select:{latitud:true,longitud:true}}),
      db.trackingGPS.findMany({where:{manifiestoId:item.b.id},select:{latitud:true,longitud:true}}),
      db.trackingGPS.findMany({where:{manifiestoId:item.incoming.id},select:{latitud:true,longitud:true,tramoId:true}}),
      db.tramoTransporte.findMany({where:{manifiestoId:item.b.id,tipo:'EXTERNO',fin:null}}),
      db.tramoTransporte.findUniqueOrThrow({where:{id:item.incoming.tramoId}}),
    ]);
    assert.equal(aPoints.length,1); assert.ok(bPoints.length>=2); assert.ok(incomingPoints.length>=3);
    assert.ok(bPoints.every((point:{latitud:number}) => Math.abs(point.latitud-(-33.22))>0.001));
    assert.ok(incomingPoints.some((point:{latitud:number;longitud:number;tramoId:string}) =>
      Math.abs(point.latitud-(-33.22))<0.001 && Math.abs(point.longitud-(-68.92))<0.001 && point.tramoId===item.incoming.tramoId));
    assert.equal(external.length,1); assert.equal(receivedLeg.tipo,'REGISTRADO');
    assert.equal(receivedLeg.transportistaId,fixture.carriers.origin.id); assert.equal(receivedLeg.fin,null);
    assert.equal(await db.eventoManifiesto.count({where:{manifiestoId:item.a.id,tipo:'ENTREGA'}}),1);
    assert.equal(await db.auditoria.count({where:{manifiestoId:item.a.id,accion:'CONFIRMAR_ENTREGA_V1'}}),1);
    results.push({surface,deliveredPoints:aPoints.length,handedOffPoints:bPoints.length,replacementPoints:incomingPoints.length});
  }
  assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
  assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
  const result={synthetic:true,production:false,emailAttempts:0,emailSent:0,pushEnabled:false,results};
  writeFileSync(path.join(out,'fleet-current-audit.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
