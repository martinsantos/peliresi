import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.SITREP_PAUSE_BACKGROUND_JOBS, 'true');
const out = process.env.QA_ARTIFACTS!;
assert.equal(out, '/work/sitrep/.qa-gps-empty-20261101');
const fixture = JSON.parse(readFileSync(path.join(out, 'gps-receipt-private.json'), 'utf8'));
const before = JSON.parse(readFileSync(path.join(out, 'unit-before.json'), 'utf8'));
const after = JSON.parse(readFileSync(path.join(out, 'unit-final.json'), 'utf8'));
const browser = JSON.parse(readFileSync(path.join(out, 'e2e.json'), 'utf8'));
assert.equal(before.numFailedTests, 5);
assert.equal(after.numFailedTests, 0); assert.equal(after.numPassedTests, 116);
assert.equal(browser.stats.unexpected, 0); assert.equal(browser.stats.expected, 2);
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  for (const item of [...Object.values(fixture.cases), fixture.handoffCase] as Array<{ id: string; numero: string }>) {
    const trip = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, estado: true, isDemoData: true } });
    assert.deepEqual(trip, { numero: item.numero, estado: 'EN_TRANSITO', isDemoData: true });
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: item.id } }), 0);
    assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: item.id, tipo: 'ENTREGA' } }), 0);
  }
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const [index, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.11.49.${90 + index}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { product: process.env.GITHUB_SHA, synthetic: true, production: false,
    beforeFailures: before.numFailedTests, unitPassed: after.numPassedTests, browserPassed: browser.stats.expected,
    fixtureTripsUnchanged: 3, gpsRows: 0, deliveryEvents: 0, emailAttempts: 0, emailsSent: 0,
    capClosedForSyntheticLogins: true, pushEnabled: false, backgroundJobsPaused: true };
  writeFileSync(path.join(out, 'audit.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
