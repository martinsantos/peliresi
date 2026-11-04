import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const run = randomUUID().slice(0, 8), baseline = process.env.QA_DELIVERY_NOTICE_BASELINE === 'true';
if (!baseline) assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('connection_limit'), '4');
let temporaryAdmin = '';
try {
 const [generator, carrier, operator, admin] = await Promise.all([
  db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
 ]);
 for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
 const admins = await db.usuario.findMany({ where: { rol: 'ADMIN', activo: true }, select: { id: true, email: true } });
 assert.ok(admins.length && admins.every((person: any) => person.email.endsWith('@night-qa.invalid')));
 const victim = await db.usuario.create({ data: { email: `qa-delivery-atomic-${run}@night-qa.invalid`, password: admin.password,
  nombre: 'QA destinatario transitorio', rol: 'ADMIN', activo: true, emailVerified: true, notifEmail: false } });
 temporaryAdmin = victim.id;
 const manifest = await db.manifiesto.create({ data: { numero: `QA-DELIVERY-ATOMIC-${run}`,
  generadorId: generator.generador.id, transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
  creadoPorId: carrier.id, estado: 'EN_TRANSITO', modalidad: 'FIJO', fechaRetiro: new Date(), isDemoData: true } });
 const { manifestCompanyRecipients } = backendRequire('./dist/services/manifestCompanyRecipients.service.js');
 const representatives = await manifestCompanyRecipients(db, manifest.id);
 const login = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'transportista@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
 const auth = await login.json() as any; assert.equal(login.status, 200);
 const referencia = randomUUID();
 const request = () => fetch(`http://127.0.0.1:3037/api/manifiestos/${manifest.id}/confirmar-entrega-idempotente`, { method: 'POST',
  headers: { Authorization: 'Bearer ' + auth.data.tokens.accessToken, 'Content-Type': 'application/json' },
  body: JSON.stringify({ referencia, observaciones: 'Entrega artificial QA' }) });
 let pending: Promise<Response> | undefined;
 // Lock only an account created by this test. Removing it while the insert is
 // blocked provokes an actual FK error without changing the preview schema.
 await db.$transaction(async (tx: any) => {
  await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${victim.id} FOR UPDATE`;
  pending = request(); pending.catch(() => {});
  let blocked = false;
  for (let attempt = 0; attempt < 100; attempt++) {
   const [row] = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM pg_stat_activity
    WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%notificaciones%' AND query ILIKE '%INSERT%'`;
   if (Number(row.count) > 0) { blocked = true; break; }
   await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(blocked, true, 'La inserción del aviso debe esperar al destinatario artificial');
  await tx.usuario.delete({ where: { id: victim.id } });
 }, { timeout: 15000, maxWait: 10000 });
 temporaryAdmin = '';
 const response = await pending!;
 if (baseline) await new Promise(resolve => setTimeout(resolve, 500));
 const afterFailure = { status: response.status,
  state: (await db.manifiesto.findUniqueOrThrow({ where: { id: manifest.id } })).estado,
  deliveries: await db.eventoManifiesto.count({ where: { manifiestoId: manifest.id, tipo: 'ENTREGA' } }),
  receipts: await db.auditoria.count({ where: { manifiestoId: manifest.id, accion: 'CONFIRMAR_ENTREGA_V1' } }),
  notices: await db.notificacion.count({ where: { manifiestoId: manifest.id, tipo: 'MANIFIESTO_ENTREGADO' } }) };
 if (baseline) {
  assert.equal(afterFailure.status, 200); assert.equal(afterFailure.state, 'ENTREGADO');
  assert.equal(afterFailure.deliveries, 1); assert.equal(afterFailure.receipts, 1);
  assert.ok(afterFailure.notices < new Set([generator.id, operator.id, ...admins.map((a: any) => a.id), victim.id]).size);
 } else {
  assert.deepEqual(afterFailure, { status: 500, state: 'EN_TRANSITO', deliveries: 0, receipts: 0, notices: 0 });
  const retry = await request(); const result = await retry.json() as any;
  assert.equal(retry.status, 200); assert.equal(result.data.idempotencia.repetido, false);
  const repeated = await request(); const repeatResult = await repeated.json() as any;
  assert.equal(repeated.status, 200); assert.equal(repeatResult.data.idempotencia.repetido, true);
  assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: manifest.id, tipo: 'ENTREGA' } }), 1);
  assert.equal(await db.auditoria.count({ where: { manifiestoId: manifest.id, accion: 'CONFIRMAR_ENTREGA_V1' } }), 1);
  const recipients = await db.notificacion.findMany({ where: { manifiestoId: manifest.id, tipo: 'MANIFIESTO_ENTREGADO' }, select: { usuarioId: true } });
  assert.deepEqual(recipients.map((n: any) => n.usuarioId).sort(), [...new Set([generator.id, operator.id,
   ...admins.map((a: any) => a.id), ...representatives.map((person: any) => person.usuarioId).filter((id: string) => id !== carrier.id)])].sort());
 }
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 const proof = { synthetic: true, baseline, afterFailure, retrySucceeded: !baseline, emailAttempts: 0, emailSent: 0, pushEnabled: false };
 await writeFile(path.join(process.env.QA_ARTIFACTS!, 'delivery-notice-atomic-proof.json'), JSON.stringify(proof, null, 2));
 console.log(JSON.stringify(proof));
} finally {
 if (temporaryAdmin) await db.usuario.deleteMany({ where: { id: temporaryAdmin, email: `qa-delivery-atomic-${run}@night-qa.invalid` } });
 await db.$disconnect();
}
