import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-receipt-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  const checked = [];
  for (const manifest of Object.values(fixture.cases) as Array<{ id: string; numero: string }>) {
    const current = await db.manifiesto.findUniqueOrThrow({ where: { id: manifest.id }, select: { estado: true, isDemoData: true, numero: true } });
    assert.equal(current.isDemoData, true); assert.match(current.numero, /^QA-GPS-RECEIPT-/); assert.equal(current.estado, 'ENTREGADO');
    const points = await db.trackingGPS.findMany({ where: { manifiestoId: manifest.id }, select: { latitud: true, longitud: true, emisor: true } });
    assert.deepEqual(points, [{ latitud: -33.777, longitud: -68.777, emisor: `usuario:${fixture.owner}` }]);
    assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: manifest.id, tipo: 'ENTREGA' } }), 1);
    checked.push({ manifest: manifest.numero, points: points.length, deliveryEvents: 1 });
  }
  const report = { synthetic: true, checked, noUnconfirmedPointsInserted: true };
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-receipt-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
