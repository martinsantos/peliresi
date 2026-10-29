import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const baseline = process.env.QA_GPS_ALERT_BASELINE === 'true';
assert.ok(baseline || process.env.QA_GPS_ALERT_BASELINE === 'false');
const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'gps-alert-atomic-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const singleton = backendRequire('./dist/lib/prisma.js').default;
const { anomaliaDetector } = backendRequire('./dist/controllers/notification.controller.js');
const { domainEvents } = backendRequire('./dist/services/domainEvent.service.js');
const originalEmit = domainEvents.emit;
try {
  const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: fixture.crash.id }, select: { numero: true, isDemoData: true } });
  assert.equal(manifest.numero, fixture.crash.numero); assert.equal(manifest.isDemoData, true);
  const admins = await db.usuario.findMany({ where: { rol: 'ADMIN', activo: true, id: { not: fixture.carrierId } }, select: { id: true } });
  assert.ok(admins.some((user: { id: string }) => user.id === fixture.adminId));
  const where = { manifiestoId: fixture.crash.id, tipo: 'ANOMALIA_DETECTADA', titulo: 'GPS: posible velocidad elevada' };
  assert.equal(await db.anomaliaTransporte.count({ where: { manifiestoId: fixture.crash.id } }), 0);
  assert.equal(await db.notificacion.count({ where }), 0);
  let interrupted = 0, repeatedEvents = 0;
  domainEvents.emit = (event: { type?: string }) => {
    if (event.type === 'ANOMALIA_GPS') { interrupted++; throw new Error('QA: interrupción del despachador después del registro'); }
    return true;
  };
  await assert.rejects(anomaliaDetector.detectarAnomalias(fixture.crash.id, fixture.carrierId), /QA: interrupción/);
  assert.equal(interrupted, 1);
  assert.equal(await db.anomaliaTransporte.count({ where: { manifiestoId: fixture.crash.id } }), 1);
  const afterInterruption = await db.notificacion.findMany({ where, select: { usuarioId: true, mensaje: true } });
  if (baseline) assert.equal(afterInterruption.length, 0);
  else {
    assert.deepEqual(afterInterruption.map((n: { usuarioId: string }) => n.usuarioId).sort(), admins.map((a: { id: string }) => a.id).sort());
    assert.ok(afterInterruption.every((n: { mensaje: string }) => /Hora de captura no disponible/.test(n.mensaje)));
  }
  domainEvents.emit = (event: { type?: string }) => { if (event.type === 'ANOMALIA_GPS') repeatedEvents++; return true; };
  await anomaliaDetector.detectarAnomalias(fixture.crash.id, fixture.carrierId);
  assert.equal(repeatedEvents, 0);
  assert.equal(await db.anomaliaTransporte.count({ where: { manifiestoId: fixture.crash.id } }), 1);
  assert.equal(await db.notificacion.count({ where }), afterInterruption.length);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const proof = { synthetic: true, baseline, anomaly: 1, interruptionObserved: true,
    activeAdmins: admins.length, adminNotices: afterInterruption.length, duplicateEventsOnRepeat: repeatedEvents,
    emailAttempts: 0, emailsSent: 0, push: false, capClosed: true };
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'gps-alert-atomic-crash-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally {
  domainEvents.emit = originalEmit;
  await db.$disconnect(); await singleton.$disconnect();
}
