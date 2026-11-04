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
  for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
  assert.ok(Number.isFinite(generator.generador.latitud) && Number.isFinite(generator.generador.longitud));
  const now = Date.now();
  const day = (at: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Mendoza', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
  assert.equal(day(now), day(now - 300_000), 'El caso debe quedar dentro de un día de Mendoza');
  const numero = `QA-HISTORIAL-${randomUUID().slice(0, 8)}`;
  const manifest = await db.manifiesto.create({ data: { numero, generadorId: generator.generador.id,
    transportistaId: carrier.transportista.id, operadorId: operator.operador.id, creadoPorId: carrier.id,
    estado: 'EN_TRANSITO', modalidad: 'FIJO', fechaRetiro: new Date(now - 300_000), isDemoData: true } });
  const pickup = await db.eventoManifiesto.create({ data: { manifiestoId: manifest.id, tipo: 'RETIRO', descripcion: 'QA retiro artificial',
    latitud: -32.93, longitud: -68.85, usuarioId: carrier.id, createdAt: new Date(now - 300_000), isDemoData: true } });
  const fallbackNumero = `QA-HISTORIAL-FUENTE-${randomUUID().slice(0, 8)}`;
  const fallback = await db.manifiesto.create({ data: { numero: fallbackNumero, generadorId: generator.generador.id,
    transportistaId: carrier.transportista.id, operadorId: operator.operador.id, creadoPorId: carrier.id,
    estado: 'EN_TRANSITO', modalidad: 'FIJO', fechaRetiro: new Date(now - 250_000), isDemoData: true } });
  const fallbackPickup = await db.eventoManifiesto.create({ data: { manifiestoId: fallback.id, tipo: 'RETIRO',
    descripcion: 'QA retiro sin coordenadas en el evento', usuarioId: carrier.id, createdAt: new Date(now - 250_000), isDemoData: true } });
  const beforeGps = await db.eventoManifiesto.create({ data: { manifiestoId: manifest.id, tipo: 'INCIDENTE', descripcion: 'QA antes de recibir GPS',
    usuarioId: carrier.id, createdAt: new Date(now - 240_000), isDemoData: true } });
  const receivedAt = new Date(now - 180_000);
  const gps = await db.trackingGPS.create({ data: { manifiestoId: manifest.id, latitud: -33.05, longitud: -68.9,
    timestamp: receivedAt, isDemoData: true } });
  const afterGps = await db.eventoManifiesto.create({ data: { manifiestoId: manifest.id, tipo: 'INCIDENTE', descripcion: 'QA después de recibir GPS',
    usuarioId: carrier.id, createdAt: new Date(now - 120_000), isDemoData: true } });
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'monitor-history-private.json'), JSON.stringify({
    numero, manifestId: manifest.id, pickupId: pickup.id, beforeGpsId: beforeGps.id,
    gpsId: gps.id, gpsReceivedAt: receivedAt.toISOString(), afterGpsId: afterGps.id,
    fallbackNumero, fallbackManifestId: fallback.id, fallbackPickupId: fallbackPickup.id,
  }), { mode: 0o600 });
  console.log('Historial artificial preparado con retiro, GPS recibido y dos eventos.');
} finally { await db.$disconnect(); }
