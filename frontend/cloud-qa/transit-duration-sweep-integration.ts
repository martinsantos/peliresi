import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.DISABLE_EMAILS, 'true');
const { PrismaClient } = backendRequire('@prisma/client');
const { evaluarDuracionTransito } = backendRequire('./dist/jobs/transitDuration.job.js');
const db = new PrismaClient();
const ruleIds: string[] = [], manifestIds: string[] = [];
try {
  const [generator, carrier, operator, admin] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
  ]);
  for (const user of [generator, carrier, operator, admin]) assert.equal(user.activo, true);
  for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
  const run = randomUUID().slice(0, 8), ruleName = `QA barrido duración ${run}`;
  const createTrip = async (name: string, hours: number, estado = 'EN_TRANSITO', isDemoData = false) => {
    const m = await db.manifiesto.create({ data: { numero: `QA-SWEEP-${run}-${name}`,
      generadorId: generator.generador.id, transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
      creadoPorId: carrier.id, estado, modalidad: 'FIJO', fechaRetiro: new Date(Date.now() - hours * 3_600_000), isDemoData } });
    manifestIds.push(m.id); return m;
  };
  const waiting = await createTrip('WITHOUT-GPS', 25);
  const early = await createTrip('EARLY', 23);
  const delivered = await createTrip('DELIVERED', 25, 'ENTREGADO');
  const demo = await createTrip('DEMO', 25, 'EN_TRANSITO', true);
  const configured = await db.reglaAlerta.create({ data: { nombre: ruleName, evento: 'TIEMPO_EXCESIVO', activa: true,
    condicion: JSON.stringify({ all: [{ horasTransito: { gte: 24 } }, { numero: { contains: run } }] }),
    destinatarios: '["GENERADOR"]', creadoPorId: admin.id } });
  ruleIds.push(configured.id);
  const unbounded = await db.reglaAlerta.create({ data: { nombre: `QA anterior sin umbral ${run}`, evento: 'TIEMPO_EXCESIVO', activa: true,
    condicion: JSON.stringify({ numero: { contains: run } }), destinatarios: '["GENERADOR"]', creadoPorId: admin.id } });
  ruleIds.push(unbounded.id);
  const disabled = await db.reglaAlerta.create({ data: { nombre: `QA duración apagada ${run}`, evento: 'TIEMPO_EXCESIVO', activa: false,
    condicion: JSON.stringify({ horasTransito: { gte: 0 } }), destinatarios: '["GENERADOR"]', creadoPorId: admin.id } });
  ruleIds.push(disabled.id);
  assert.equal(await db.trackingGPS.count({ where: { manifiestoId: waiting.id } }), 0);
  const sweeps = await Promise.all([evaluarDuracionTransito(), evaluarDuracionTransito()]);
  assert.ok(sweeps.every((s: any) => s.errores === 0), JSON.stringify(sweeps));
  assert.equal(await db.alertaGenerada.count({ where: { reglaId: configured.id, manifiestoId: waiting.id } }), 1);
  for (const m of [early, delivered, demo]) assert.equal(await db.alertaGenerada.count({ where: { reglaId: configured.id, manifiestoId: m.id } }), 0);
  assert.equal(await db.alertaGenerada.count({ where: { reglaId: { in: [unbounded.id, disabled.id] } } }), 0);
  const notice = await db.notificacion.findFirstOrThrow({ where: { usuarioId: generator.id, manifiestoId: waiting.id, titulo: ruleName } });
  assert.equal(await db.notificacion.count({ where: { usuarioId: generator.id, manifiestoId: waiting.id, titulo: ruleName } }), 1);
  assert.match(notice.mensaje, /umbral configurado por Ambiente/);
  assert.match(notice.mensaje, /llevaba aproximadamente 25 horas/);
  assert.equal(JSON.parse(notice.datos).tipo, 'duracion_transito_configurada');
  assert.equal(JSON.parse(notice.datos).version, 1);
  // Hold an artificial delivery transaction while the scan tries to record a
  // case. The case must re-read the row after the delivery commits.
  const race = await createTrip('RACE', 25);
  let concurrentSweep: Promise<{ evaluados: number; errores: number }> | undefined;
  try {
    await db.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM manifiestos WHERE id = ${race.id} FOR UPDATE`;
      concurrentSweep = evaluarDuracionTransito();
      concurrentSweep!.catch(() => {});
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const [row] = await db.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*) AS count FROM pg_stat_activity
          WHERE wait_event_type = 'Lock' AND query ILIKE '%FROM manifiestos WHERE id =%'
            AND query ILIKE '%FOR SHARE%'
        `;
        if (Number(row.count) > 0) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.equal(blocked, true, 'La evaluación debe esperar a la entrega artificial');
      await tx.manifiesto.update({ where: { id: race.id }, data: { estado: 'ENTREGADO', fechaEntrega: new Date() } });
    }, { timeout: 30000, maxWait: 10000 });
  } finally {
    if (concurrentSweep) {
      const result = await concurrentSweep;
      assert.equal(result.errores, 0);
    }
  }
  assert.equal(await db.alertaGenerada.count({ where: { reglaId: configured.id, manifiestoId: race.id } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'transit-sweep-private.json'), JSON.stringify({ run, ruleName,
    manifesto: waiting.numero, noticeId: notice.id, manifestIds, ruleIds }), { mode: 0o600 });
  console.log(JSON.stringify({ synthetic: true, gpsPoints: 0, concurrentSweeps: 2, activeCase: 1,
    beforeThreshold: 0, delivered: 0, concurrentDelivery: 0, demo: 0, noThreshold: 0, disabled: 0, generatorNotice: 1 }));
} catch (error) {
  // If setup fails, leave only explicitly scoped synthetic fixtures inactive.
  if (ruleIds.length) await db.reglaAlerta.updateMany({ where: { id: { in: ruleIds } }, data: { activa: false } });
  if (manifestIds.length) await db.manifiesto.updateMany({ where: { id: { in: manifestIds } }, data: { isDemoData: true } });
  throw error;
} finally { await db.$disconnect(); }
