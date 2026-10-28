import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const [generator, carrier, operator, admin] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
  ]);
  for (const user of [generator, carrier, operator, admin]) assert.equal(user.activo, true);
  assert.match(generator.generador.razonSocial, /^QA /);
  assert.match(carrier.transportista.razonSocial, /^QA /);
  assert.match(operator.operador.razonSocial, /^QA /);
  const run = randomUUID().replaceAll('-', '').slice(0, 12);
  const outsiderEmail = `qa-anomaly-outsider-${run}@night-qa.invalid`;
  const outsider = await db.usuario.create({ data: {
    email: outsiderEmail, password: generator.password, nombre: 'QA generador ajeno', rol: 'GENERADOR',
    activo: true, emailVerified: true, notifEmail: false,
    generador: { create: { razonSocial: `QA Ajeno ${run}`, cuit: `QA-${run}`, domicilio: 'QA', telefono: 'QA',
      email: outsiderEmail, numeroInscripcion: `QA-${run}`, categoria: 'QA' } },
  } });
  const manifest = await db.manifiesto.create({ data: {
    numero: `QA-GPS-ANOMALIA-${run}`, generadorId: generator.generador.id,
    transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
    creadoPorId: carrier.id, estado: 'EN_TRANSITO', modalidad: 'FIJO', fechaRetiro: new Date(), isDemoData: true,
  }, select: { id: true, numero: true } });
  await db.trackingGPS.createMany({ data: [
    { manifiestoId: manifest.id, latitud: -33, longitud: -69, timestamp: new Date('2026-01-01T00:00:00Z'), isDemoData: true },
    { manifiestoId: manifest.id, latitud: -33.1, longitud: -69, timestamp: new Date('2026-01-01T00:00:01Z'), isDemoData: true },
  ] });
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'gps-anomaly-private.json'),
    JSON.stringify({ manifest, outsiderEmail, outsiderId: outsider.id, adminId: admin.id }), { mode: 0o600 });
  console.log('Manifiesto y cuentas artificiales preparados para comprobar límites de anomalías.');
} finally { await db.$disconnect(); }
