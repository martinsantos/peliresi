import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');

if (process.argv.includes('--worker')) {
  const { evaluarDuracionTransito } = backendRequire('./dist/jobs/transitDuration.job.js');
  assert.ok(process.send);
  process.send({ phase: 'ready' });
  const message = await new Promise(resolve => process.once('message', resolve));
  assert.equal(message, 'go');
  const result = await evaluarDuracionTransito();
  await backendRequire('./dist/lib/prisma.js').default.$disconnect();
  process.send!({ phase: 'done', result }, () => process.disconnect());
} else {
  type WorkerMessage = { phase: 'ready' | 'done'; result?: { evaluados: number; errores: number } };
  function worker(): { child: ChildProcess; ready: Promise<void>; done: Promise<WorkerMessage> } {
    const child = fork(fileURLToPath(import.meta.url), ['--worker'], {
      execArgv: ['--experimental-strip-types'], stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: process.env,
    });
    let readyResolve!: () => void, doneResolve!: (value: WorkerMessage) => void;
    let rejectReady!: (error: Error) => void, rejectDone!: (error: Error) => void;
    const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; rejectReady = reject; });
    const done = new Promise<WorkerMessage>((resolve, reject) => { doneResolve = resolve; rejectDone = reject; });
    void ready.catch(() => {}); void done.catch(() => {});
    let hasReady = false, hasDone = false, stderr = '';
    child.stderr?.on('data', chunk => { stderr += String(chunk).slice(0, 2000); });
    child.on('message', (message: WorkerMessage) => {
      if (message.phase === 'ready') { hasReady = true; readyResolve(); }
      if (message.phase === 'done') { hasDone = true; doneResolve(message); }
    });
    child.on('error', error => { if (!hasReady) rejectReady(error); if (!hasDone) rejectDone(error); });
    child.on('exit', code => {
      if (code !== 0 || !hasDone) {
        const error = new Error(`Proceso artificial finalizó sin resultado: ${code}; ${stderr}`);
        if (!hasReady) rejectReady(error);
        if (!hasDone) rejectDone(error);
      }
    });
    return { child, ready, done };
  }

  const { PrismaClient } = backendRequire('@prisma/client');
  const db = new PrismaClient();
  const manifestIds: string[] = [], ruleIds: string[] = [];
  let workers: ReturnType<typeof worker>[] = [];
  try {
    const [generator, carrier, operator, admin] = await Promise.all([
      db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
      db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
      db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
      db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
    ]);
    for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
    const run = randomUUID().slice(0, 8), title = `QA duración multiproceso ${run}`;
    const createTrip = async (name: string, hours: number) => {
      const manifest = await db.manifiesto.create({ data: { numero: `QA-MULTI-SWEEP-${run}-${name}`,
        generadorId: generator.generador.id, transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
        creadoPorId: carrier.id, estado: 'EN_TRANSITO', modalidad: 'FIJO',
        fechaRetiro: new Date(Date.now() - hours * 3_600_000), isDemoData: false } });
      manifestIds.push(manifest.id); return manifest;
    };
    const reached = await createTrip('REACHED', 25), early = await createTrip('EARLY', 23);
    const rule = await db.reglaAlerta.create({ data: { nombre: title, evento: 'TIEMPO_EXCESIVO', activa: true,
      condicion: JSON.stringify({ all: [{ horasTransito: { gte: 24 } }, { numero: { contains: run } }] }),
      destinatarios: '["TRANSPORTISTA"]', creadoPorId: admin.id } });
    ruleIds.push(rule.id);
    workers = [worker(), worker()];
    await Promise.all(workers.map(item => item.ready));
    const lockKey = JSON.stringify(['transit-duration-rule', rule.id, reached.id]);
    await db.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text`;
      workers.forEach(item => item.child.send('go'));
      let waiting = 0;
      for (let attempt = 0; attempt < 150; attempt++) {
        const [row] = await db.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*) AS count FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query ILIKE '%pg_advisory_xact_lock%'
        `;
        waiting = Number(row.count);
        if (waiting >= 2) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.ok(waiting >= 2, 'Los dos procesos artificiales deben competir por el mismo caso');
    }, { timeout: 30000, maxWait: 10000 });
    const results = await Promise.all(workers.map(item => item.done));
    assert.ok(results.every(item => item.result?.errores === 0));
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: reached.id } }), 0);
    assert.equal(await db.alertaGenerada.count({ where: { reglaId: rule.id, manifiestoId: reached.id } }), 1);
    assert.equal(await db.alertaGenerada.count({ where: { reglaId: rule.id, manifiestoId: early.id } }), 0);
    assert.equal(await db.notificacion.count({ where: { manifiestoId: reached.id, usuarioId: carrier.id, titulo: title } }), 1);
    assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
    assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
    const proof = { synthetic: true, independentProcesses: 2, bothWaitedForSameCase: true,
      positionsReceived: 0, beforeThreshold: 0, casesAfterThreshold: 1, carrierNotices: 1,
      emailAttempts: 0, emailSent: 0, push: false };
    await writeFile(path.join(process.env.QA_ARTIFACTS!, 'transit-duration-multiprocess.json'), JSON.stringify(proof, null, 2));
    console.log(JSON.stringify(proof));
  } finally {
    for (const item of workers) if (item.child.connected) item.child.disconnect();
    if (ruleIds.length) await db.reglaAlerta.updateMany({ where: { id: { in: ruleIds } }, data: { activa: false } });
    if (manifestIds.length) await db.manifiesto.updateMany({ where: { id: { in: manifestIds } }, data: { isDemoData: true } });
    await db.$disconnect();
  }
}
