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
  for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
  const run = randomUUID().replaceAll('-', '').slice(0, 12);
  const create = (kind: string) => db.manifiesto.create({ data: {
    numero: `QA-GPS-AVISO-${run}-${kind}`, generadorId: generator.generador.id, transportistaId: carrier.transportista.id,
    operadorId: operator.operador.id, creadoPorId: carrier.id, estado: 'EN_TRANSITO', modalidad: 'FIJO',
    fechaRetiro: new Date(), isDemoData: true,
  }, select: { id: true, numero: true } });
  const crash = await create('CORTE'), rollback = await create('REVERSA');
  await db.trackingGPS.createMany({ data: [
    { manifiestoId: crash.id, latitud: -33, longitud: -69, timestamp: new Date('2026-01-01T00:00:00Z'), isDemoData: true },
    { manifiestoId: crash.id, latitud: -33.1, longitud: -69, timestamp: new Date('2026-01-01T00:00:01Z'), isDemoData: true },
  ] });
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'gps-alert-atomic-private.json'),
    JSON.stringify({ crash, rollback, carrierId: carrier.id, adminId: admin.id }), { mode: 0o600 });
  console.log('Dos manifiestos artificiales preparados para probar interrupción y reversión.');
} finally { await db.$disconnect(); }
