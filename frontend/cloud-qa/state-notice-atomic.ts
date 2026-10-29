import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-operational-ui-current2026102943');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('connection_limit'), '4');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const run = randomUUID().slice(0, 8);
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
 const victim = await db.usuario.create({ data: { email: `qa-state-atomic-${run}@night-qa.invalid`, password: admin.password,
  nombre: 'QA destinatario transitorio', rol: 'ADMIN', activo: true, emailVerified: true, notifEmail: false } });
 temporaryAdmin = victim.id;
 const manifest = await db.manifiesto.create({ data: { numero: `QA-STATE-ATOMIC-${run}`,
  generadorId: generator.generador.id, transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
  creadoPorId: generator.id, estado: 'APROBADO', modalidad: 'FIJO', isDemoData: true } });
 const proposal = { version: 2, modalidad: 'FIJO', generadorId: generator.generador.id, transportistaId: carrier.transportista.id,
  operadorId: operator.operador.id, creadoPorId: generator.id, autorRol: 'GENERADOR' };
 await db.eventoManifiesto.createMany({ data: [
  { manifiestoId: manifest.id, tipo: 'PROPUESTA_PARTES_V1', descripcion: JSON.stringify(proposal), usuarioId: generator.id },
  { manifiestoId: manifest.id, tipo: 'FIRMA', descripcion: 'Aprobación QA', usuarioId: generator.id },
  { manifiestoId: manifest.id, tipo: 'APROBACION_TRANSPORTISTA', descripcion: 'Aprobación QA', usuarioId: carrier.id },
  { manifiestoId: manifest.id, tipo: 'APROBACION_OPERADOR', descripcion: 'Aprobación QA', usuarioId: operator.id },
  { manifiestoId: manifest.id, tipo: 'INICIO_COORDINACION', descripcion: 'Coordinación QA', usuarioId: generator.id },
 ] });
 const { manifestCompanyRecipients } = backendRequire('./dist/services/manifestCompanyRecipients.service.js');
 const representatives = await manifestCompanyRecipients(db, manifest.id);
 const login = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json',
  Cookie: 'sitrep_qa_client=127.13.23.21' }, body: JSON.stringify({ email: 'transportista@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
 const auth = await login.json() as any; assert.equal(login.status, 200);
 const request = () => fetch(`http://127.0.0.1:3037/api/manifiestos/${manifest.id}/confirmar-retiro`, { method: 'POST',
  headers: { Authorization: 'Bearer ' + auth.data.tokens.accessToken, 'Content-Type': 'application/json' }, body: '{}' });
 let pending: Promise<Response> | undefined;
 // This account exists only in the isolated synthetic database. Deleting it
 // while its notice is blocked forces a real FK failure without a migration.
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
 const afterFailure = { status: response.status, state: (await db.manifiesto.findUniqueOrThrow({ where: { id: manifest.id } })).estado,
  pickups: await db.eventoManifiesto.count({ where: { manifiestoId: manifest.id, tipo: 'RETIRO' } }),
  notices: await db.notificacion.count({ where: { manifiestoId: manifest.id, tipo: 'MANIFIESTO_EN_TRANSITO' } }) };
 assert.deepEqual(afterFailure, { status: 500, state: 'APROBADO', pickups: 0, notices: 0 });
 const retry = await request(); assert.equal(retry.status, 200);
 const repeat = await request(); assert.equal(repeat.status, 400);
 assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: manifest.id, tipo: 'RETIRO' } }), 1);
 const recipients = await db.notificacion.findMany({ where: { manifiestoId: manifest.id, tipo: 'MANIFIESTO_EN_TRANSITO' }, select: { usuarioId: true } });
 assert.deepEqual(recipients.map((n: any) => n.usuarioId).sort(), [...new Set([generator.id, operator.id,
  ...admins.map((a: any) => a.id), ...representatives.map((person: any) => person.usuarioId).filter((id: string) => id !== carrier.id)])].sort());
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 const proof = { synthetic: true, afterFailure, retrySucceeded: true, duplicatePickupRejected: true, emailAttempts: 0, emailSent: 0, pushEnabled: false };
 await writeFile(path.join(process.env.QA_ARTIFACTS!, 'state-notice-atomic-proof.json'), JSON.stringify(proof, null, 2));
 console.log(JSON.stringify(proof));
} finally {
 if (temporaryAdmin) await db.usuario.deleteMany({ where: { id: temporaryAdmin, email: `qa-state-atomic-${run}@night-qa.invalid` } });
 await db.$disconnect();
}
