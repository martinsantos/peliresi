import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const out = process.env.QA_ARTIFACTS!;
assert.equal(out, '/work/sitrep/.qa-monitor-history-20261029');
const processes = JSON.parse(readFileSync(path.join(out, 'processes.json'), 'utf8'));
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.TRAINING_DATABASE_URL, '');
  assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
  assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const fixture = JSON.parse(readFileSync(path.join(out, 'monitor-history-private.json'), 'utf8'));
assert.match(fixture.numero, /^QA-HISTORIAL-/);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: fixture.manifestId }, select: { numero: true, isDemoData: true } });
  assert.deepEqual(manifest, { numero: fixture.numero, isDemoData: true });
  const point = await db.trackingGPS.findUniqueOrThrow({ where: { id: fixture.gpsId } });
  assert.equal(point.manifiestoId, fixture.manifestId); assert.equal(point.isDemoData, true);
  assert.equal(point.timestamp.toISOString(), fixture.gpsReceivedAt);
  assert.equal(await db.trackingGPS.count({ where: { manifiestoId: fixture.manifestId } }), 1);
  const eventCount = await db.eventoManifiesto.count({ where: { manifiestoId: fixture.manifestId,
    id: { in: [fixture.pickupId, fixture.beforeGpsId, fixture.afterGpsId] }, isDemoData: true } });
  assert.equal(eventCount, 3);
  const fallback = await db.manifiesto.findUniqueOrThrow({ where: { id: fixture.fallbackManifestId }, select: { numero: true, isDemoData: true } });
  assert.deepEqual(fallback, { numero: fixture.fallbackNumero, isDemoData: true });
  const fallbackPickup = await db.eventoManifiesto.findUniqueOrThrow({ where: { id: fixture.fallbackPickupId } });
  assert.equal(fallbackPickup.manifiestoId, fixture.fallbackManifestId);
  assert.equal(fallbackPickup.isDemoData, true);
  assert.equal(fallbackPickup.latitud, null); assert.equal(fallbackPickup.longitud, null);
  assert.equal(await db.trackingGPS.count({ where: { manifiestoId: fixture.fallbackManifestId } }), 0);
  const directory = path.join(out, 'monitor-history-browser');
  const proofs = readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory())
    .map(entry => path.join(directory, entry.name, 'monitor-history-proof.json')).filter(existsSync)
    .map(file => JSON.parse(readFileSync(file, 'utf8')));
  assert.deepEqual(proofs.map(proof => proof.surface).sort(), ['app', 'web-desktop']);
  for (const proof of proofs) {
    assert.equal(proof.numero, fixture.numero); assert.equal(proof.gpsReceivedAt, fixture.gpsReceivedAt);
    assert.equal(proof.pickupWithoutGps, true); assert.equal(proof.generatorFallbackIdentified, true);
    assert.deepEqual(proof.writes, []); assert.deepEqual(proof.errors, []);
  }
  const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.22.95' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  const emailAttempts = await db.emailQueue.count({ where: { intentos: { gt: 0 } } });
  const emailSent = await db.emailQueue.count({ where: { sentAt: { not: null } } });
  assert.equal(emailAttempts, 0); assert.equal(emailSent, 0);
  const report = { source: process.env.GITHUB_SHA, synthetic: true, surfaces: proofs.map(proof => proof.surface),
    pickupIsNotGps: true, generatorFallbackIdentified: true, gpsReceiptRetained: true, gpsCaptureTimeUnknown: true,
    capClosed: true, emailAttempts, emailSent, pushEnabled: false };
  writeFileSync(path.join(out, 'monitor-history-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
