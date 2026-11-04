import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
 const [generator, carrier, operator] = await Promise.all([
  db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
 ]);
 for (const user of [generator, carrier, operator]) assert.equal(user.activo, true);
 for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
 const manifest = await db.manifiesto.create({ data: { numero: `QA-LAYOUT-GPS-${randomUUID().slice(0, 8)}`,
  generadorId: generator.generador.id, transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
  creadoPorId: carrier.id, estado: 'EN_TRANSITO', modalidad: 'FIJO', fechaRetiro: new Date(), isDemoData: true,
  asignacionTransporte: { version: 1, transportistaId: carrier.transportista.id, vehiculo: null, chofer: null } }, select: { id: true, numero: true } });
 await writeFile(path.join(process.env.QA_ARTIFACTS!, 'single-gps-private.json'), JSON.stringify({ cases: { app: manifest } }), { mode: 0o600 });
 console.log('Viaje artificial aislado para regresión visual de GPS en app.');
} finally { await db.$disconnect(); }
