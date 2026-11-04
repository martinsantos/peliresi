import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'gps-transition-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  const results: Array<Record<string, unknown>> = [];
  for (const surface of ['web-desktop', 'app']) {
    const cases = fixture.cases[surface];
    const [admin, fleet, other, points] = await Promise.all([
      db.manifiesto.findUniqueOrThrow({ where: { id: cases['admin-delivery'].id }, select: { estado: true, isDemoData: true } }),
      db.manifiesto.findUniqueOrThrow({ where: { id: cases['fleet-delivery'].id }, select: { estado: true, isDemoData: true } }),
      db.manifiesto.findUniqueOrThrow({ where: { id: cases['fleet-other'].id }, select: { estado: true, isDemoData: true } }),
      db.trackingGPS.findMany({ where: { manifiestoId: cases['fleet-delivery'].id }, select: { id: true, latitud: true, longitud: true, emisor: true } }),
    ]);
    assert.ok(admin.isDemoData && fleet.isDemoData && other.isDemoData);
    assert.equal(admin.estado, 'EN_TRANSITO');
    assert.equal(fleet.estado, 'ENTREGADO');
    assert.equal(other.estado, 'EN_TRANSITO');
    assert.equal(points.length, 1); assert.match(points[0].id, /^gpsv1_/);
    assert.equal(points[0].latitud, -33.123); assert.equal(points[0].longitud, -68.123);
    assert.equal(points[0].emisor, `usuario:${fixture.owner}`);
    results.push({ surface, adminTransitionBlocked: true, fleetDelivered: true, otherStillInTransit: true, acceptedPointCount: points.length });
  }
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  const proof = { synthetic: true, production: false, capClosed: true, emailsSent: 0, emailAttempts: 0, push: false, results };
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'gps-transition-final-audit.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
