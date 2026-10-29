import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-manifest-gps-context-20261029');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const [generator, carrier, operator] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
  ]);
  for (const user of [generator, carrier, operator]) assert.equal(user.activo, true);
  for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
  const run = randomUUID().slice(0, 12);
  const trip = (label: string, estado: 'EN_TRANSITO' | 'TRATADO') => db.manifiesto.create({ data: {
    numero: `QA-CONTEXTO-GPS-${run}-${label}`, generadorId: generator.generador.id, transportistaId: carrier.transportista.id,
    operadorId: operator.operador.id, creadoPorId: generator.id, estado, modalidad: 'FIJO',
    fechaRetiro: new Date('2026-10-20T11:00:00Z'), isDemoData: true,
  }, select: { id: true, numero: true } });
  const active = await trip('ACTIVO', 'EN_TRANSITO'), finished = await trip('FINAL', 'TRATADO'), single = await trip('UNO', 'TRATADO');
  const first = Date.parse('2026-10-20T12:00:00Z');
  const points = [active, finished].flatMap(manifest => Array.from({ length: 103 }, (_, index) => ({
    manifiestoId: manifest.id, latitud: -33 - index / 1000, longitud: -69,
    // Two final receipts share a timestamp, to exercise the stable ID tie-break.
    timestamp: new Date(first + (index === 101 ? 102 : index) * 60_000), isDemoData: true,
  })));
  points.push({ manifiestoId: single.id, latitud: -33, longitud: -69, timestamp: new Date(first), isDemoData: true });
  await db.trackingGPS.createMany({ data: points });
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'manifest-gps-context-private.json'), JSON.stringify({ active, finished, single }), { mode: 0o600 });
  console.log('Tres manifiestos artificiales preparados: dos con 103 posiciones y uno con una posición.');
} finally { await db.$disconnect(); }
