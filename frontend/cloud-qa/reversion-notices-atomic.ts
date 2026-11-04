import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-operational-ui-current2026102944');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const { notifyManifestReversion } = backendRequire('./dist/services/manifestStateNotice.service.js');
try {
 const [generator, carrier, operator, admin] = await Promise.all([
  db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
 ]);
 for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
 const manifest = await db.manifiesto.create({ data: { numero: `QA-REVERSION-ATOMIC-${randomUUID().slice(0, 8)}`,
  generadorId: generator.generador.id, transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
  creadoPorId: generator.id, estado: 'ENTREGADO', modalidad: 'FIJO', isDemoData: true } });
 await assert.rejects(db.$transaction(async (tx: any) => {
  const current = await tx.manifiesto.findUniqueOrThrow({ where: { id: manifest.id }, include: {
   generador: { select: { usuarioId: true } }, transportista: { select: { usuarioId: true } }, operador: { select: { usuarioId: true } },
  } });
  await tx.manifiesto.update({ where: { id: manifest.id }, data: { estado: 'EN_TRANSITO' } });
  const event = await tx.eventoManifiesto.create({ data: { manifiestoId: manifest.id, usuarioId: admin.id, tipo: 'REVERSION', descripcion: 'Corrección artificial QA' } });
  const failing = new Proxy(tx, { get(target, key) {
   if (key === 'notificacion') return { createMany: async () => { throw new Error('simulated inbox failure'); } };
   return Reflect.get(target, key);
  } });
  await notifyManifestReversion(failing, current, 'ENTREGADO', 'EN_TRANSITO', event.id, admin.id);
 }), /simulated inbox failure/);
 const afterFailure = { state: (await db.manifiesto.findUniqueOrThrow({ where: { id: manifest.id } })).estado,
  events: await db.eventoManifiesto.count({ where: { manifiestoId: manifest.id, tipo: 'REVERSION' } }),
  notices: await db.notificacion.count({ where: { manifiestoId: manifest.id } }) };
 assert.deepEqual(afterFailure, { state: 'ENTREGADO', events: 0, notices: 0 });
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 const proof = { synthetic: true, failure: 'simulated inbox failure inside a real database transaction', afterFailure, emailAttempts: 0, emailSent: 0, pushEnabled: false };
 await writeFile(path.join(process.env.QA_ARTIFACTS!, 'reversion-notices-atomic-proof.json'), JSON.stringify(proof, null, 2));
 console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
