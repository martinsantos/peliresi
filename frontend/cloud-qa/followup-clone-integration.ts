/** Stateful checks run only on a fresh clone of the artificial preview database. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.GITHUB_SHA, '78c75f9473ff2a0a08962af6d6d22e441675ee51');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const out = '/work/sitrep/.qa-followup-clone-20261031';
assert.equal(process.env.QA_ARTIFACTS, out);
const url = new URL(process.env.DATABASE_URL!);
assert.equal(url.pathname, '/sitrep_night_qa_20260926');
assert.equal(url.searchParams.get('schema'), 'proposal_operations_20261021');
url.pathname = '/sitrep_followup_isolation_20261031';
process.env.DATABASE_URL = url.toString();
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
let jobClient: { $disconnect(): Promise<void> } | undefined;
const now = new Date('2026-11-10T12:00:00Z');
const when = new Date('2026-11-06T12:00:00Z');
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

try {
  const identity = await db.$queryRawUnsafe('SELECT current_database() AS name, inet_server_port() AS port, host(inet_server_addr()) AS address');
  assert.deepEqual(identity, [{ name: 'sitrep_followup_isolation_20261031', port: 55440, address: '127.0.0.1' }]);
  const { ejecutarSeguimientoCierre, simularSeguimientoCierre } = backendRequire(path.join(root, 'backend/dist-qa-followup-20261031/jobs/seguimientoCierre.job.js'));
  jobClient = backendRequire(path.join(root, 'backend/dist-qa-followup-20261031/lib/prisma.js')).default;
  const generator = await db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } });
  const operator = await db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } });
  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
  assert.match(generator.generador.razonSocial, /^QA /); assert.match(operator.operador.razonSocial, /^QA /);
  assert.equal(operator.activo, true); assert.equal(admin.rol, 'ADMIN');
  const rule = 'seguimiento_cierre_v1';
  await db.manifiesto.updateMany({ data: { isDemoData: true } });
  await db.reglaAlerta.updateMany({ where: { id: { not: rule }, evento: 'TIEMPO_EXCESIVO' }, data: { activa: false } });
  const ruleData = { nombre: 'QA seguimiento', evento: 'TIEMPO_EXCESIVO', condicion: '{"tipo":"seguimiento_cierre","diasRecepcion":{"gte":0}}', destinatarios: '["OPERADOR"]', activa: true };
  await db.reglaAlerta.upsert({ where: { id: rule }, create: { id: rule, ...ruleData, creadoPorId: admin.id }, update: ruleData });
  const create = (id: string, estado: string, isDemoData: boolean) => db.manifiesto.create({ data: {
    id, numero: `QA-FOLLOWUP-${id}`, generadorId: generator.generador.id, operadorId: operator.operador.id,
    creadoPorId: generator.id, estado, isDemoData, fechaRecepcion: when,
  } });
  const normal = 'qa-followup-ordinary', demo = 'qa-followup-artificial', terminal = 'qa-followup-terminal', demoTerminal = 'qa-followup-demo-terminal';
  await create(normal, 'RECIBIDO', false); await create(demo, 'RECIBIDO', true);
  await create(terminal, 'TRATADO', false); await create(demoTerminal, 'TRATADO', true);
  for (const id of [terminal, demoTerminal]) await db.alertaGenerada.create({ data: { id: `case-${id}`, reglaId: rule, manifiestoId: id, datos: '{}' } });
  assert.equal((await simularSeguimientoCierre(0, now)).total, 1);
  assert.equal(await ejecutarSeguimientoCierre(now), 1);
  assert.equal(await db.notificacion.count({ where: { manifiestoId: normal } }), 1);
  assert.equal(await db.notificacion.count({ where: { manifiestoId: demo } }), 0);
  assert.equal((await db.alertaGenerada.findUniqueOrThrow({ where: { id: `case-${terminal}` } })).estado, 'RESUELTA');
  assert.equal((await db.alertaGenerada.findUniqueOrThrow({ where: { id: `case-${demoTerminal}` } })).estado, 'PENDIENTE');
  await db.notificacion.updateMany({ where: { manifiestoId: normal }, data: { leida: true } });
  assert.equal(await ejecutarSeguimientoCierre(now), 1);
  assert.equal(await db.notificacion.count({ where: { manifiestoId: normal, leida: true } }), 1);
  await db.manifiesto.update({ where: { id: normal }, data: { isDemoData: true } });

  const race = 'qa-followup-race'; await create(race, 'RECIBIDO', false);
  const locked = deferred(), release = deferred();
  const holder = db.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM manifiestos WHERE id = ${race} FOR UPDATE`;
    await tx.manifiesto.update({ where: { id: race }, data: { isDemoData: true } });
    locked.resolve(); await release.promise;
  }, { timeout: 20000 });
  await locked.promise;
  const run = ejecutarSeguimientoCierre(now).then((value: number) => ({ value }), (error: Error) => ({ error }));
  let waited = false;
  try {
    for (let i = 0; i < 30 && !waited; i++) {
      const rows = await db.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM manifiestos%'");
      waited = rows[0].count > 0;
      if (!waited) await delay(100);
    }
    assert.equal(waited, true, 'Sweep must wait on the changed manifest row');
  } finally { release.resolve(); await holder; }
  const raceResult = await run; if ('error' in raceResult) throw raceResult.error;
  assert.equal(raceResult.value, 0); assert.equal(await db.notificacion.count({ where: { manifiestoId: race } }), 0);
  assert.equal(await db.alertaGenerada.count({ where: { manifiestoId: race } }), 0);

  const first = 'qa-followup-first', second = 'qa-followup-second';
  await create(first, 'RECIBIDO', false); await create(second, 'RECIBIDO', false);
  const firstLocked = deferred(), releaseFirst = deferred();
  const firstHolder = db.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM manifiestos WHERE id = ${first} FOR UPDATE`;
    firstLocked.resolve(); await releaseFirst.promise;
  }, { timeout: 20000 });
  await firstLocked.promise;
  const failedSweep = ejecutarSeguimientoCierre(now).then((value: number) => ({ value }), (error: Error) => ({ error }));
  let secondProcessed = false;
  try {
    for (let i = 0; i < 75 && !secondProcessed; i++) {
      secondProcessed = await db.notificacion.count({ where: { manifiestoId: second } }) === 1;
      if (!secondProcessed) await delay(200);
    }
    assert.equal(secondProcessed, true, 'A locked row must not prevent the next row being evaluated');
  } finally { releaseFirst.resolve(); await firstHolder; }
  const failedResult = await failedSweep;
  assert.ok('error' in failedResult && /Seguimiento incompleto: 1/.test(failedResult.error.message));
  assert.equal(await db.notificacion.count({ where: { manifiestoId: first } }), 0);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { synthetic: true, production: false, database: 'sitrep_followup_isolation_20261031',
    scopedSimulation: true, terminalReconciliationScoped: true, idempotent: true,
    lockedRowRechecked: waited, laterRowProcessedAfterTimeout: secondProcessed, failureReported: true,
    emailAttempts: 0, emailsSent: 0, pushEnabled: false };
  writeFileSync(path.join(out, 'followup-integration.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await jobClient?.$disconnect(); await db.$disconnect(); }
