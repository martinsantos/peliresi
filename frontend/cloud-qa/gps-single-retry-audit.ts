import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const directory = process.env.QA_ARTIFACTS!;
const fixture = JSON.parse(await readFile(path.join(directory, 'single-gps-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient(), checked = [];
try {
  for (const [surface, entry] of Object.entries(fixture.cases) as Array<[string, { id: string; numero: string }]>) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: entry.id }, select: { numero: true, isDemoData: true, estado: true } });
    assert.equal(manifest.numero, entry.numero); assert.equal(manifest.isDemoData, true); assert.equal(manifest.estado, 'EN_TRANSITO');
    const points = await db.trackingGPS.findMany({ where: { manifiestoId: entry.id }, select: { latitud: true, longitud: true } });
    assert.ok(points.length >= 1);
    assert.ok(points.every((point: { latitud: number; longitud: number }) => point.latitud === -33.334 && point.longitud === -68.744));
    checked.push({ surface, points: points.length, allFromSimulatedFix: true });
  }
  for (const [surface, entry] of Object.entries(fixture.queueCases) as Array<[string, { id: string; numero: string }]>) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: entry.id }, select: { numero: true, isDemoData: true, estado: true } });
    assert.equal(manifest.numero, entry.numero); assert.equal(manifest.isDemoData, true); assert.equal(manifest.estado, 'EN_TRANSITO');
    const points = await db.trackingGPS.findMany({ where: { manifiestoId: entry.id }, select: { latitud: true, longitud: true } });
    assert.equal(points.length, 2);
    for (const [latitude, longitude] of [[-33.111, -68.111], [-33.222, -68.222]]) {
      assert.equal(points.filter((point: { latitud: number; longitud: number }) => point.latitud === latitude && point.longitud === longitude).length, 1);
    }
    checked.push({ surface: surface + '-queue', points: points.length, allFromSimulatedFix: true });
  }
  await writeFile(path.join(directory, 'single-gps-audit.json'), JSON.stringify({ checked, production: false, physicalGps: false }, null, 2));
  console.log('GPS y cola recuperados en viajes artificiales; cada punto de la cola se guardó una sola vez.');
} finally { await db.$disconnect(); }
