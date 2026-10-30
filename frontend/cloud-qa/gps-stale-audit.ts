import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'gps-stale-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const baseline = process.env.QA_GPS_STALE_BASELINE === 'true';
try {
  const processes = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'processes.json'), 'utf8'));
  for (const { pid } of processes) {
    const env = Object.fromEntries((await readFile(`/proc/${pid}/environ`, 'utf8')).split('\0').filter(Boolean)
      .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
    assertCloudEnvironment(env);
    assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
    assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
    assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
    for (const key of externalKeys) assert.equal(env[key], '');
  }
  for (const surface of ['web-desktop', 'app']) {
    const trip = await db.manifiesto.findUniqueOrThrow({ where: { id: fixture.cases[surface].id }, select: { isDemoData: true, estado: true } });
    assert.equal(trip.isDemoData, true); assert.equal(trip.estado, 'ENTREGADO');
    assert.ok(await db.trackingGPS.count({ where: { manifiestoId: fixture.cases[surface].id } }) >= 1,
      'The queued GPS point remains recorded before delivery');
    const events = await db.eventoManifiesto.findMany({ where: { manifiestoId: fixture.cases[surface].id },
      select: { tipo: true, descripcion: true, latitud: true, longitud: true } });
    const old = events.filter((event: any) => event.tipo === 'INCIDENTE' && event.descripcion.includes('QA GPS antiguo'));
    const fresh = events.filter((event: any) => event.tipo === 'INCIDENTE' && event.descripcion.includes('QA GPS reciente'));
    const delivery = events.filter((event: any) => event.tipo === 'ENTREGA');
    assert.equal(old.length, 1); assert.equal(delivery.length, 1);
    if (baseline) {
      assert.equal(old[0].latitud, -33.334); assert.equal(old[0].longitud, -68.744);
      assert.equal(delivery[0].latitud, -33.334); assert.equal(delivery[0].longitud, -68.744);
      assert.equal(fresh.length, 0);
    } else {
      assert.equal(old[0].latitud, null); assert.equal(old[0].longitud, null);
      assert.equal(delivery[0].latitud, null); assert.equal(delivery[0].longitud, null);
      assert.equal(fresh.length, 1); assert.equal(fresh[0].latitud, -33.334); assert.equal(fresh[0].longitud, -68.744);
      const current = await db.manifiesto.findUniqueOrThrow({ where: { id: fixture.freshCases[surface].id }, select: { isDemoData: true, estado: true } });
      assert.equal(current.isDemoData, true); assert.equal(current.estado, 'ENTREGADO');
      const freshDelivery = await db.eventoManifiesto.findMany({ where: { manifiestoId: fixture.freshCases[surface].id, tipo: 'ENTREGA' }, select: { latitud: true, longitud: true } });
      assert.equal(freshDelivery.length, 1); assert.equal(freshDelivery[0].latitud, -33.334); assert.equal(freshDelivery[0].longitud, -68.744);
    }
  }
  const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.13.48.68' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');
  assert.equal(digest(await readFile(path.join(process.env.QA_ARTIFACTS!, 'manual', 'help-data.js'))), digest(await readFile('/work/sitrep/docs/manual/help-data.js')));
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'gps-stale-audit.json'), JSON.stringify({ baseline, surfaces: ['web-desktop', 'app'], verified: true, capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false, manualMatches: true }), { mode: 0o600 });
  console.log('Auditoría de eventos artificiales GPS completa.');
} finally { await db.$disconnect(); }
