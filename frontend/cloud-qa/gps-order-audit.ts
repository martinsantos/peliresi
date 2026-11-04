import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-order-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient(), checked = [];
try {
  for (const [surface, value] of Object.entries(fixture.cases) as Array<[string, any]>) {
    for (const [name, lat, lon, nextLat, nextLon] of [['individual', -33.11, -68.11, null, null], ['fleetA', -33.22, -68.22, -33.23, -68.23], ['fleetB', -33.22, -68.22, -33.23, -68.23], ['relay', -33.33, -68.33, -33.34, -68.34]] as const) {
      const current = await db.manifiesto.findUniqueOrThrow({ where: { id: value[name].id }, select: { numero: true, isDemoData: true } });
      assert.equal(current.isDemoData, true); assert.match(current.numero, /^QA-GPS-ORDER-/);
      const points = await db.trackingGPS.findMany({ where: { manifiestoId: value[name].id }, select: { latitud: true, longitud: true } });
      assert.equal(points.length, nextLat === null ? 1 : 2, `${surface}:${name}: unexpected number of positions`);
      assert.equal(points.filter((point: { latitud: number; longitud: number }) => point.latitud === lat && point.longitud === lon).length, 1);
      if (nextLat !== null) assert.equal(points.filter((point: { latitud: number; longitud: number }) => point.latitud === nextLat && point.longitud === nextLon).length, 1);
      checked.push({ surface, name, points: points.length, noOlderPoint: true });
    }
  }
  const report = { synthetic: true, physicalGps: false, checked };
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'gps-order-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
