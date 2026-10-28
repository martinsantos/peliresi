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
    assert.equal(points.filter((point: { latitud: number; longitud: number }) => point.latitud === -33.111 && point.longitud === -68.111).length, 1);
    assert.equal(points.filter((point: { latitud: number; longitud: number }) => point.latitud === -33.222 && point.longitud === -68.222).length, 1);
    checked.push({ surface: surface + '-queue', points: points.length, allFromSimulatedFix: true });
  }
  for (const [surface, entry] of Object.entries(fixture.lostCases) as Array<[string, { id: string; numero: string }]>) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: entry.id }, select: { numero: true, isDemoData: true, estado: true } });
    assert.equal(manifest.numero, entry.numero); assert.equal(manifest.isDemoData, true); assert.equal(manifest.estado, 'EN_TRANSITO');
    const points = await db.trackingGPS.findMany({ where: { manifiestoId: entry.id }, select: { id: true, latitud: true, longitud: true } });
    assert.equal(points.length, 1); assert.equal(new Set(points.map((point: { id: string }) => point.id)).size, 1);
    assert.ok(points.every((point: { id: string; latitud: number; longitud: number }) => point.id.startsWith('gpsv1_') && point.latitud === -33.777 && point.longitud === -68.777));
    checked.push({ surface: surface + '-lost-response', points: points.length, referencesUnique: true });
  }
  for (const [surface, entry] of Object.entries(fixture.raceCases) as Array<[string, { id: string; numero: string }]>) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: entry.id }, select: { numero: true, isDemoData: true, estado: true } });
    assert.equal(manifest.numero, entry.numero); assert.equal(manifest.isDemoData, true); assert.equal(manifest.estado, 'EN_TRANSITO');
    const points = await db.trackingGPS.findMany({ where: { manifiestoId: entry.id }, select: { id: true, latitud: true, longitud: true } });
    assert.equal(points.length, 3);
    assert.equal(points.filter((point: { id: string }) => point.id.startsWith('gpsv1_')).length, 1);
    assert.equal(points.filter((point: { id: string }) => !point.id.startsWith('gpsv1_')).length, 2);
    checked.push({ surface: surface + '-concurrent', idempotent: 1, legacy: 2 });
  }
  for (const [surface, entry] of Object.entries(fixture.crossTabCases) as Array<[string, { id: string; numero: string }]>) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: entry.id }, select: { numero: true, isDemoData: true, estado: true } });
    assert.equal(manifest.numero, entry.numero); assert.equal(manifest.isDemoData, true); assert.equal(manifest.estado, 'EN_TRANSITO');
    const points = await db.trackingGPS.findMany({ where: { manifiestoId: entry.id }, select: { id: true, latitud: true, longitud: true } });
    assert.equal(points.length, 2);
    assert.equal(points.filter((point: { id: string; latitud: number; longitud: number }) => point.id.startsWith('gpsv1_') && point.latitud === -33.601 && point.longitud === -68.601).length, 1);
    assert.equal(points.filter((point: { id: string; latitud: number; longitud: number }) => point.id.startsWith('gpsv1_') && point.latitud === -33.702 && point.longitud === -68.702).length, 1);
    checked.push({ surface: surface + '-shared-queue', points: points.length, allFromSimulatedFix: true });
  }
  await writeFile(path.join(directory, 'single-gps-audit.json'), JSON.stringify({ checked, production: false, physicalGps: false }, null, 2));
  console.log('GPS y cola recuperados en viajes artificiales; cada punto de la cola se guardó una sola vez.');
} finally { await db.$disconnect(); }
