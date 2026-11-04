import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.QA_GPS_ALERT_BASELINE, 'false');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'gps-alert-atomic-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const { recordGpsAnomaly } = backendRequire('./dist/services/gpsAnomalyRecorder.service.js');
try {
  const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: fixture.rollback.id }, select: { numero: true, isDemoData: true } });
  assert.equal(manifest.numero, fixture.rollback.numero); assert.equal(manifest.isDemoData, true);
  const admins = await db.usuario.findMany({ where: { rol: 'ADMIN', activo: true, id: { not: fixture.carrierId } }, select: { id: true } });
  assert.ok(admins.some((user: { id: string }) => user.id === fixture.adminId));
  const id = 'gpsan1_' + createHash('sha256').update(JSON.stringify([fixture.rollback.id, 'QA-rollback'])).digest('hex');
  const event = { type: 'ANOMALIA_GPS', manifiestoId: fixture.rollback.id, numero: fixture.rollback.numero,
    tipoAnomalia: 'VELOCIDAD_ANORMAL', descripcion: 'Hora de captura no disponible. Verificá el caso con transporte.',
    severidad: 'ALTA', userId: fixture.carrierId, avisosConfirmados: true };
  const data = { id, manifiestoId: fixture.rollback.id, tipo: 'VELOCIDAD_ANORMAL', descripcion: event.descripcion,
    latitud: -33, longitud: -69, valorDetectado: 150, valorEsperado: 100, severidad: 'ALTA', isDemoData: true };
  const where = { manifiestoId: fixture.rollback.id, tipo: 'ANOMALIA_DETECTADA', titulo: 'GPS: posible velocidad elevada' };
  assert.equal(await db.anomaliaTransporte.count({ where: { id } }), 0);
  assert.equal(await db.notificacion.count({ where }), 0);
  const failingDb = new Proxy(db, { get(target, key, receiver) {
    if (key !== '$transaction') return Reflect.get(target, key, receiver);
    return (work: (tx: unknown) => Promise<unknown>, options: unknown) => target.$transaction((tx: any) => work(new Proxy(tx, {
      get(inner, property, innerReceiver) {
        if (property !== 'notificacion') return Reflect.get(inner, property, innerReceiver);
        return new Proxy(inner.notificacion, { get(delegate, method, delegateReceiver) {
          if (method === 'createMany') return async () => { throw new Error('QA: error al guardar avisos'); };
          return Reflect.get(delegate, method, delegateReceiver);
        } });
      },
    })), options);
  } });
  await assert.rejects(recordGpsAnomaly(failingDb, data, event), /QA: error al guardar avisos/);
  assert.equal(await db.anomaliaTransporte.count({ where: { id } }), 0);
  assert.equal(await db.notificacion.count({ where }), 0);
  const attempts = await Promise.all(Array.from({ length: 8 }, () => recordGpsAnomaly(db, data, event)));
  assert.equal(attempts.filter((result: { created: boolean }) => result.created).length, 1);
  assert.equal(await db.anomaliaTransporte.count({ where: { id } }), 1);
  const notices = await db.notificacion.findMany({ where, select: { usuarioId: true } });
  assert.deepEqual(notices.map((n: { usuarioId: string }) => n.usuarioId).sort(), admins.map((a: { id: string }) => a.id).sort());
  assert.equal((await recordGpsAnomaly(db, data, event)).created, false);
  assert.equal(await db.notificacion.count({ where }), admins.length);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const proof = { synthetic: true, insertFailureRolledBack: true, concurrentAttempts: attempts.length,
    anomalyRows: 1, adminNotices: notices.length, noDuplicatesOnRepeat: true, emailAttempts: 0, emailsSent: 0, push: false, capClosed: true };
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'gps-alert-atomic-rollback-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
