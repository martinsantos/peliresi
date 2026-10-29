import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client');
const { dispararReglasAlerta } = backendRequire('./dist/subscribers/alerta.subscriber.js');
const { matchesAlertCondition } = backendRequire('./dist/services/alertRuleCondition.service.js');
const db = new PrismaClient(), run = randomUUID().slice(0, 8), ruleIds: string[] = [];
let victimId = '';
const baseline = process.env.QA_RULE_BASELINE === 'true';
try {
 const [generator, carrier, operator, admin] = await Promise.all([
  db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
 ]);
 for (const user of [generator, carrier, operator, admin]) assert.equal(user.activo, true);
 for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
 const admins = await db.usuario.findMany({ where: { rol: 'ADMIN', activo: true }, select: { id: true, email: true } });
 assert.ok(admins.length && admins.every((user: any) => user.email.endsWith('@night-qa.invalid')));
 const makeTrip = (suffix: string) => db.manifiesto.create({ data: { numero: `QA-RULE-ATOMIC-${run}-${suffix}`,
  generadorId: generator.generador.id, transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
  creadoPorId: carrier.id, estado: 'EN_TRANSITO', modalidad: 'FIJO', fechaRetiro: new Date(), isDemoData: true } });
 const makeRule = async (trip: any, suffix: string, roles: string[]) => {
  const rule = await db.reglaAlerta.create({ data: { nombre: `QA regla atómica ${run} ${suffix}`, evento: 'ANOMALIA_GPS', activa: true,
   condicion: JSON.stringify({ manifiestoId: trip.id }), destinatarios: JSON.stringify(roles), creadoPorId: admin.id } });
  ruleIds.push(rule.id); return rule;
 };
 const eventData = (trip: any) => ({ manifiestoId: trip.id, numero: trip.numero, userId: carrier.id,
  tipoAnomalia: 'GPS_PERDIDO', descripcion: 'Observación artificial QA', severidad: 'MEDIA' });
 const checkNoOtherMatchingRules = async (data: any) => {
  const rules = await db.reglaAlerta.findMany({ where: { activa: true, evento: 'ANOMALIA_GPS', id: { notIn: ruleIds } } });
  assert.ok(rules.every((rule: any) => !matchesAlertCondition(rule.condicion, data)), 'Otra regla activa coincide con el evento artificial');
 };
 const dispatch = (trip: any) => dispararReglasAlerta('ANOMALIA_GPS', trip.id, eventData(trip));
 const victim = await db.usuario.create({ data: { email: `qa-general-rule-${run}@night-qa.invalid`, password: admin.password,
  nombre: 'QA destinatario transitorio', rol: 'ADMIN', activo: true, emailVerified: true, notifEmail: false } });
 victimId = victim.id;
 const failingTrip = await makeTrip('FAILURE'); await checkNoOtherMatchingRules(eventData(failingTrip));
 const failingRule = await makeRule(failingTrip, 'falla', ['TRANSPORTISTA', 'ADMIN']);
 let pending: Promise<void> | undefined, rejected = false;
 try {
  await db.$transaction(async (tx: any) => {
   await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${victim.id} FOR UPDATE`;
   pending = dispatch(failingTrip); pending!.catch(() => {});
   let blocked = false;
   for (let attempt = 0; attempt < 120; attempt++) {
    const [row] = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM pg_stat_activity
     WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%notificaciones%' AND query ILIKE '%INSERT%'`;
    if (Number(row.count) > 0) { blocked = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
   }
   assert.equal(blocked, true, 'La inserción artificial debe esperar al destinatario bloqueado');
   await tx.usuario.delete({ where: { id: victim.id } });
  }, { timeout: 30000, maxWait: 10000 });
  victimId = '';
 } finally {
  if (pending) try { await pending; } catch { rejected = true; }
 }
 assert.equal(rejected, true, 'La inserción con destinatario eliminado debe fallar');
 const afterFailure = { cases: await db.alertaGenerada.count({ where: { reglaId: failingRule.id, manifiestoId: failingTrip.id } }),
  notices: await db.notificacion.count({ where: { manifiestoId: failingTrip.id, titulo: failingRule.nombre } }) };
 if (baseline) { assert.equal(afterFailure.cases, 1); assert.ok(afterFailure.notices >= 1); }
 else assert.deepEqual(afterFailure, { cases: 0, notices: 0 });
 await Promise.all(Array.from({ length: 4 }, () => dispatch(failingTrip)));
 const afterRetry = { cases: await db.alertaGenerada.count({ where: { reglaId: failingRule.id, manifiestoId: failingTrip.id } }),
  notices: await db.notificacion.findMany({ where: { manifiestoId: failingTrip.id, titulo: failingRule.nombre }, select: { usuarioId: true } }) };
 if (!baseline) {
  assert.equal(afterRetry.cases, 1);
  assert.deepEqual(afterRetry.notices.map((notice: any) => notice.usuarioId).sort(), [...new Set([carrier.id, ...admins.map((a: any) => a.id)])].sort());
 }

 // Hold INSERTs, but not SELECTs, to force concurrent workers past the old
 // check. The corrected implementation lets only one worker reach the insert.
 const raceTrip = await makeTrip('RACE'); await checkNoOtherMatchingRules(eventData(raceTrip));
 const raceRule = await makeRule(raceTrip, 'concurrencia', ['TRANSPORTISTA']);
 let race: Promise<void[]> | undefined;
 await db.$transaction(async (tx: any) => {
  await tx.$executeRaw`LOCK TABLE alertas_generadas IN SHARE MODE`;
  race = Promise.all(Array.from({ length: 4 }, () => dispatch(raceTrip))); race.catch(() => {});
  let blocked = 0;
  for (let attempt = 0; attempt < 120; attempt++) {
   const [row] = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM pg_stat_activity
    WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%alertas_generadas%' AND query ILIKE '%INSERT%'`;
   blocked = Number(row.count); if (blocked >= (baseline ? 2 : 1)) break;
   await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(blocked >= (baseline ? 2 : 1), 'Las inserciones artificiales deben estar bloqueadas antes de liberar la tabla');
 }, { timeout: 30000, maxWait: 10000 });
 await race;
 const concurrent = { attempts: 4, cases: await db.alertaGenerada.count({ where: { reglaId: raceRule.id, manifiestoId: raceTrip.id } }),
  notices: await db.notificacion.count({ where: { manifiestoId: raceTrip.id, titulo: raceRule.nombre } }) };
 if (baseline) assert.ok(concurrent.cases >= 2); else assert.deepEqual(concurrent, { attempts: 4, cases: 1, notices: 1 });
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 const report = { synthetic: true, baseline, afterFailure, retry: { cases: afterRetry.cases, notices: afterRetry.notices.length }, concurrent,
  emailAttempts: 0, emailSent: 0, push: false, capClosed: true };
 await writeFile(path.join(process.env.QA_ARTIFACTS!, baseline ? 'general-rule-baseline.json' : 'general-rule-fixed.json'), JSON.stringify(report, null, 2));
 console.log(JSON.stringify(report));
} finally {
 if (ruleIds.length) await db.reglaAlerta.updateMany({ where: { id: { in: ruleIds } }, data: { activa: false } });
 if (victimId) await db.usuario.deleteMany({ where: { id: victimId, email: `qa-general-rule-${run}@night-qa.invalid` } });
 await db.$disconnect();
}
