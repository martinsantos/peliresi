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
const db = new PrismaClient();
let manifestId = '', ruleId = '', victimId = '';
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
  const run = randomUUID().slice(0, 8), title = `QA duración atómica ${run}`;
  const victim = await db.usuario.create({ data: { email: `qa-duration-atomic-${run}@night-qa.invalid`,
    password: admin.password, nombre: 'QA falla atómica', rol: 'ADMIN', activo: true, emailVerified: true, notifEmail: false } });
  victimId = victim.id;
  const manifest = await db.manifiesto.create({ data: { numero: `QA-ATOMIC-${run}`,
    generadorId: generator.generador.id, transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
    creadoPorId: carrier.id, estado: 'EN_TRANSITO', modalidad: 'FIJO',
    fechaRetiro: new Date(Date.now() - 25 * 3_600_000), isDemoData: false } });
  manifestId = manifest.id;
  const rule = await db.reglaAlerta.create({ data: { nombre: title, evento: 'TIEMPO_EXCESIVO', activa: true,
    condicion: JSON.stringify({ all: [{ horasTransito: { gte: 24 } }, { manifiestoId: manifest.id }] }),
    destinatarios: '["TRANSPORTISTA","ADMIN"]', creadoPorId: admin.id } });
  ruleId = rule.id;
  const event = { type: 'DURACION_TRANSITO_OBSERVADA', manifiestoId: manifest.id,
    numero: manifest.numero, horasTransito: 25, userId: carrier.id };
  let pending: Promise<void> | undefined, rejected = false;
  try {
    await db.$transaction(async (tx: any) => {
      // A second transaction removes a synthetic recipient while insertion is
      // waiting for its FK lock. This causes a real PostgreSQL write failure.
      await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${victim.id} FOR UPDATE`;
      pending = alertaSubscriber(event);
      pending!.catch(() => {});
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const [row] = await db.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*) AS count FROM pg_stat_activity
          WHERE wait_event_type = 'Lock' AND query ILIKE '%notificaciones%' AND query ILIKE '%INSERT%'
        `;
        if (Number(row.count) > 0) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.equal(blocked, true, 'La inserción de avisos debe esperar el destinatario artificial');
      await tx.usuario.delete({ where: { id: victim.id } });
    }, { timeout: 30000, maxWait: 10000 });
    victimId = '';
  } finally {
    if (pending) {
      try { await pending; } catch { rejected = true; }
    }
  }
  assert.equal(rejected, true, 'La inserción con destinatario eliminado debe fallar');
  const afterFailure = { cases: await db.alertaGenerada.count({ where: { reglaId: rule.id, manifiestoId: manifest.id } }),
    notices: await db.notificacion.count({ where: { manifiestoId: manifest.id, titulo: title } }) };
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'transit-atomic-observed.json'), JSON.stringify({ afterFailure, synthetic: true }));
  assert.deepEqual(afterFailure, { cases: 0, notices: 0 }, 'Una falla al guardar avisos debe revertir también el caso');
  await Promise.all(Array.from({ length: 4 }, () => alertaSubscriber(event)));
  const cases = await db.alertaGenerada.count({ where: { reglaId: rule.id, manifiestoId: manifest.id } });
  const notices = await db.notificacion.findMany({ where: { manifiestoId: manifest.id, titulo: title }, orderBy: { usuarioId: 'asc' } });
  const expected = [...new Set([carrier.id, ...admins.map((user: any) => user.id)])].sort();
  assert.equal(cases, 1); assert.deepEqual(notices.map((notice: any) => notice.usuarioId).sort(), expected);
  const carrierNotice = notices.find((notice: any) => notice.usuarioId === carrier.id);
  assert.ok(carrierNotice, 'La regla debe avisar al transportista aunque él envíe GPS');
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'transit-atomic-private.json'), JSON.stringify({ run, title,
    manifestId: manifest.id, numero: manifest.numero, ruleId: rule.id, carrierNoticeId: carrierNotice.id }), { mode: 0o600 });
  console.log(JSON.stringify({ synthetic: true, failedAttempt: afterFailure, concurrentRetries: 4, cases,
    carrierNotified: true, adminNotified: true, emailAttempts: 0, emailSent: 0, push: false, capClosed: true }));
} catch (error) {
  if (ruleId) await db.reglaAlerta.updateMany({ where: { id: ruleId }, data: { activa: false } });
  if (manifestId) await db.manifiesto.updateMany({ where: { id: manifestId }, data: { isDemoData: true } });
  if (victimId) await db.usuario.deleteMany({ where: { id: victimId, email: { startsWith: 'qa-duration-atomic-' } } });
  throw error;
} finally { await db.$disconnect(); }
