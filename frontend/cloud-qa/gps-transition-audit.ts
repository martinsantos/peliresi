import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'gps-transition-private.json'), 'utf8'));
const kind = process.env.QA_GPS_TRANSITION_CASE || 'fleet-delivery';
assert.ok(['fleet-delivery', 'admin-delivery'].includes(kind));
const manifest = fixture.cases['web-desktop'][kind];
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  const [trip, points] = await Promise.all([
    db.manifiesto.findUniqueOrThrow({ where: { id: manifest.id }, select: { estado: true, isDemoData: true } }),
    db.trackingGPS.count({ where: { manifiestoId: manifest.id } }),
  ]);
  assert.equal(trip.isDemoData, true);
  assert.equal(trip.estado, 'ENTREGADO');
  assert.equal(points, 0);
  const evidence = { synthetic: true, kind, transitionedTo: trip.estado, gpsRows: points, production: false };
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'gps-transition-baseline-proof.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally { await db.$disconnect(); }
