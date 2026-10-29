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
const { PrismaClient } = backendRequire('@prisma/client');
const { alertaSubscriber } = backendRequire('./dist/subscribers/alerta.subscriber.js');
const { matchesAlertCondition } = backendRequire('./dist/services/alertRuleCondition.service.js');
const db = new PrismaClient(), run = randomUUID().slice(0, 8), baseline = process.env.QA_GPS_ADMIN_BASELINE === 'true';
let victimId = '';
try {
 const [generator, carrier, operator] = await Promise.all([
  db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
 ]);
 for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
 const admins = await db.usuario.findMany({ where: { rol: 'ADMIN', activo: true }, select: { id: true, email: true, password: true } });
 assert.ok(admins.length && admins.every((user: any) => user.email.endsWith('@night-qa.invalid')));
 const victim = await db.usuario.create({ data: { email: `qa-gps-admin-${run}@night-qa.invalid`, password: admins[0].password,
  nombre: 'QA destinatario transitorio', rol: 'ADMIN', activo: true, emailVerified: true, notifEmail: false } });
 victimId = victim.id;
 const makeTrip = (suffix: string) => db.manifiesto.create({ data: { numero: `QA-GPS-ADMIN-${run}-${suffix}`,
  generadorId: generator.generador.id, transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
  creadoPorId: carrier.id, estado: 'EN_TRANSITO', modalidad: 'FIJO', fechaRetiro: new Date(), isDemoData: true } });
 const event = (trip: any) => ({ type: 'ANOMALIA_GPS', manifiestoId: trip.id, numero: trip.numero,
  tipoAnomalia: 'GPS_PERDIDO', descripcion: 'Observación artificial QA', severidad: 'MEDIA', userId: carrier.id });
 const title = 'GPS: sin posiciones recibidas';
 const failing = await makeTrip('FAILURE'), concurrent = await makeTrip('CONCURRENT');
 const rules = await db.reglaAlerta.findMany({ where: { activa: true, evento: 'ANOMALIA_GPS' } });
 for (const trip of [failing, concurrent]) {
  const { type: _type, ...data } = event(trip);
  assert.ok(rules.every((rule: any) => !matchesAlertCondition(rule.condicion, data)), 'Otra regla coincide con la prueba');
 }
 let pending: Promise<void> | undefined, rejected = false;
 await db.$transaction(async (tx: any) => {
  await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${victim.id} FOR UPDATE`;
  pending = alertaSubscriber(event(failing)); pending!.catch(() => {});
  let blocked = false;
  for (let attempt = 0; attempt < 120; attempt++) {
   const [row] = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM pg_stat_activity
    WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%notificaciones%' AND query ILIKE '%INSERT%'`;
   if (Number(row.count) > 0) { blocked = true; break; }
   await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(blocked, true, 'El destinatario artificial debe bloquear la inserción');
  await tx.usuario.delete({ where: { id: victim.id } });
 }, { timeout: 15000, maxWait: 10000 });
 victimId = '';
 try { await pending; } catch { rejected = true; }
 assert.equal(rejected, true);
 const afterFailure = await db.notificacion.count({ where: { manifiestoId: failing.id, titulo: title } });
 if (baseline) assert.ok(afterFailure > 0); else assert.equal(afterFailure, 0);
 await alertaSubscriber(event(failing));
 const afterRetry = await db.notificacion.findMany({ where: { manifiestoId: failing.id, titulo: title }, select: { usuarioId: true } });
 assert.deepEqual(afterRetry.map((row: any) => row.usuarioId).sort(), admins.map((a: any) => a.id).sort());

 let runs: Promise<void>[] = [];
 await db.$transaction(async (tx: any) => {
  await tx.$executeRaw`LOCK TABLE notificaciones IN SHARE MODE`;
  runs = Array.from({ length: 4 }, () => alertaSubscriber(event(concurrent)));
  runs.forEach(p => p.catch(() => {}));
  let blocked = false;
  for (let attempt = 0; attempt < 120; attempt++) {
   const [row] = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM pg_stat_activity
    WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%notificaciones%' AND query ILIKE '%INSERT%'`;
   if (Number(row.count) >= (baseline ? 4 : 1)) { blocked = true; break; }
   await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(blocked, true, 'Las evaluaciones deben coincidir antes del insert');
 }, { timeout: 15000, maxWait: 10000 });
 await Promise.all(runs);
 const concurrentNotices = await db.notificacion.findMany({ where: { manifiestoId: concurrent.id, titulo: title }, select: { usuarioId: true } });
 const counts = admins.map((a: any) => concurrentNotices.filter((notice: any) => notice.usuarioId === a.id).length);
 if (baseline) assert.ok(counts.some((count: number) => count > 1));
 else assert.ok(counts.every((count: number) => count === 1));
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 const proof = { synthetic: true, baseline, afterFailure, afterRetry: afterRetry.length,
  concurrent: { evaluations: 4, counts }, emailAttempts: 0, emailSent: 0, push: false };
 await writeFile(path.join(process.env.QA_ARTIFACTS!, baseline ? 'default-gps-baseline.json' : 'default-gps-fixed.json'), JSON.stringify(proof, null, 2));
 console.log(JSON.stringify(proof));
} finally {
 if (victimId) await db.usuario.deleteMany({ where: { id: victimId, email: `qa-gps-admin-${run}@night-qa.invalid` } });
 await db.$disconnect();
}
