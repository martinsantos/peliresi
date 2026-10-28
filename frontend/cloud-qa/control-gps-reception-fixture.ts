import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  const [generator, carrier, operator] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
  ]);
  for (const user of [generator, carrier, operator]) assert.equal(user.activo, true);
  assert.match(generator.generador.razonSocial, /^QA /);
  assert.match(carrier.transportista.razonSocial, /^QA /);
  assert.match(operator.operador.razonSocial, /^QA /);
  const cases: Record<string, { id: string; numero: string }> = {};
  const run = randomUUID().slice(0, 8);
  for (const [index, surface] of ['web-desktop', 'app'].entries()) {
    const manifest = await db.manifiesto.create({ data: {
      numero: `QA-MAPA-${run}-${index}`, generadorId: generator.generador.id, transportistaId: carrier.transportista.id,
      operadorId: operator.operador.id, creadoPorId: carrier.id, estado: 'EN_TRANSITO', modalidad: 'FIJO',
      fechaRetiro: new Date(Date.now() - 15 * 60_000), isDemoData: true,
    }, select: { id: true, numero: true } });
    const receivedAt = new Date(Date.now() - 10 * 60_000);
    await db.trackingGPS.create({ data: { manifiestoId: manifest.id, latitud: -33.61 - index * 0.02,
      longitud: -68.91 - index * 0.02, timestamp: receivedAt, isDemoData: true, emisor: `usuario:${carrier.id}` } });
    cases[surface] = manifest;
  }
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'control-gps-reception-private.json'), JSON.stringify({ cases }), { mode: 0o600 });
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), JSON.stringify({
    database: 'sitrep_night_qa_20260926', externalDelivery: false, deviceManifest: cases['web-desktop'],
  }), { mode: 0o600 });
  console.log('Viajes y recepción GPS artificiales preparados.');
} finally { await db.$disconnect(); }
