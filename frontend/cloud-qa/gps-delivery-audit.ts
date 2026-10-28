import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const directory = process.env.QA_ARTIFACTS!;
const fixture = JSON.parse(await readFile(path.join(directory, 'gps-delivery-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient(), checked = [];
try {
  for (const [surface, entry] of Object.entries({ ...fixture.cases, ...Object.fromEntries(Object.entries(fixture.offlineCases).map(([surface, value]) => [surface + '-offline', value])) }) as Array<[string, { id: string; numero: string }]>) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: entry.id }, select: { numero: true, isDemoData: true, estado: true } });
    assert.equal(manifest.numero, entry.numero); assert.equal(manifest.isDemoData, true); assert.equal(manifest.estado, 'ENTREGADO');
    const points = await db.trackingGPS.findMany({ where: { manifiestoId: entry.id }, select: { latitud: true, longitud: true } });
    assert.equal(points.length, 2);
    for (const [latitude, longitude] of [[-33.123, -68.123], [-33.456, -68.456]]) {
      assert.equal(points.filter((point: { latitud: number; longitud: number }) => point.latitud === latitude && point.longitud === longitude).length, 1);
    }
    checked.push({ surface, points: points.length, state: manifest.estado });
  }
  for (const [surface, entry] of Object.entries(fixture.handoffCases) as Array<[string, { id: string; numero: string }]>) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: entry.id }, select: { numero: true, isDemoData: true, estado: true } });
    assert.equal(manifest.numero, entry.numero); assert.equal(manifest.isDemoData, true); assert.equal(manifest.estado, 'EN_TRANSITO');
    const points = await db.trackingGPS.findMany({ where: { manifiestoId: entry.id }, select: { latitud: true, longitud: true } });
    assert.equal(points.length, 2);
    for (const [latitude, longitude] of [[-33.123, -68.123], [-33.456, -68.456]]) {
      assert.equal(points.filter((point: { latitud: number; longitud: number }) => point.latitud === latitude && point.longitud === longitude).length, 1);
    }
    checked.push({ surface: surface + '-handoff', points: points.length, state: manifest.estado });
  }
  await writeFile(path.join(directory, 'gps-delivery-audit.json'), JSON.stringify({ checked, production: false, physicalGps: false }, null, 2));
  console.log('Las ubicaciones artificiales se enviaron antes de cada entrega.');
} finally { await db.$disconnect(); }
