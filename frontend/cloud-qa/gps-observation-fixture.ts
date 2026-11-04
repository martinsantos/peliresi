import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const [generator, carrier, operator, admin] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
  ]);
  for (const user of [generator, carrier, operator, admin]) assert.equal(user.activo, true);
  for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
  const run = randomUUID().slice(0, 8), receiverName = `qa-gps-observation-${run}`;
  const receiver = await db.usuario.create({ data: { email: `${receiverName}@night-qa.invalid`, password: admin.password,
    nombre: 'QA receptor GPS', rol: 'ADMIN', activo: true, emailVerified: true, notifEmail: false } });
  const cases: Record<string, { id: string; numero: string; historicalTitle: string; historicalId: string; ruleName: string }> = {};
  for (const [index, surface] of ['web-desktop', 'app'].entries()) {
    const manifest = await db.manifiesto.create({ data: { numero: `QA-GPS-OBS-${run}-${index}`,
      generadorId: generator.generador.id, transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
      creadoPorId: carrier.id, estado: 'EN_TRANSITO', modalidad: 'FIJO', fechaRetiro: new Date(Date.now() - 5 * 3600_000), isDemoData: true },
      select: { id: true, numero: true } });
    const start = Date.now() - 4 * 3600_000;
    await db.trackingGPS.createMany({ data: [
      { manifiestoId: manifest.id, latitud: -33, longitud: -69, timestamp: new Date(start), isDemoData: true },
      { manifiestoId: manifest.id, latitud: -33.1, longitud: -69, timestamp: new Date(start + 1000), isDemoData: true },
      { manifiestoId: manifest.id, latitud: -33.1, longitud: -69, timestamp: new Date(start + 2 * 3600_000 + 2000), isDemoData: true },
      { manifiestoId: manifest.id, latitud: -33.2, longitud: -69, timestamp: new Date(start + 2 * 3600_000 + 31 * 60_000 + 2000), isDemoData: true },
    ] });
    const historicalTitle = `QA GPS anterior ${run}-${index}`;
    const historical = await db.notificacion.create({ data: { usuarioId: receiver.id, tipo: 'ANOMALIA_DETECTADA', titulo: historicalTitle,
      mensaje: 'Velocidad anormalmente alta detectada: 250 km/h', manifiestoId: manifest.id, prioridad: 'ALTA' }, select: { id: true } });
    const ruleName = `QA GPS regla ${run}-${index}`;
    await db.reglaAlerta.create({ data: { nombre: ruleName, evento: 'ANOMALIA_GPS', activa: true, creadoPorId: admin.id,
      condicion: JSON.stringify({ all: [{ manifiestoId: manifest.id }, { tipoAnomalia: 'VELOCIDAD_ANORMAL' }] }), destinatarios: '["GENERADOR"]' } });
    cases[surface] = { ...manifest, historicalTitle, historicalId: historical.id, ruleName };
  }
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'gps-observation-private.json'), JSON.stringify({ receiverName, receiverId: receiver.id, generatorId: generator.id, cases }), { mode: 0o600 });
  console.log('Avisos, reglas y posiciones artificiales preparados.');
} finally { await db.$disconnect(); }
