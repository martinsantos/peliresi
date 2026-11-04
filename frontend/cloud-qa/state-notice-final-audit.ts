import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026102943';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (file: string) => JSON.parse(readFileSync(path.join(out, file), 'utf8'));
const processes = read('processes.json');
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
 const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
  .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
 assertCloudEnvironment(env);
 assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
 assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
 assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
 assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
 for (const key of externalKeys) assert.equal(env[key], '');
}
for (const file of ['state-notice-company-results.json', 'legacy-company-notice-results.json', 'manifest-complete.json']) {
 const report = read(file); assert.equal(report.stats.expected, 2, file); assert.equal(report.stats.skipped, 0, file);
 assert.equal(report.stats.unexpected, 0, file); assert.equal(report.stats.flaky, 0, file); assert.deepEqual(report.errors, [], file);
}
const before = read('legacy-company-notice-baseline.json'), after = read('legacy-company-notice-fixed.json');
assert.equal(before.visibleAfterRevocation, 3); assert.equal(after.visibleAfterRevocation, 0);
assert.equal(after.otherSiteHidden, true); assert.equal(after.directOwnerChecked, true); assert.equal(after.grantRestored, true);
const state = read('state-notice-company-proof.json'), atomic = read('state-notice-atomic-proof.json'), race = read('state-notice-race-proof.json');
const roles = read('state-notice-role-matrix-proof.json');
assert.deepEqual(roles.results.map((entry: { role: string }) => entry.role).sort(), ['OPERADOR', 'TRANSPORTISTA']);
assert.ok(roles.results.every((entry: { noticeCount: number; revokedHidden: boolean; dossierDenied: boolean; grantRestored: boolean }) =>
 entry.noticeCount === 1 && entry.revokedHidden && entry.dossierDenied && entry.grantRestored));
assert.equal(state.manifests, 5); assert.equal(state.inSituReceipt, true); assert.equal(state.cancellation, true);
assert.equal(state.revokedHidden, true); assert.equal(state.otherSiteHidden, true);
assert.deepEqual(atomic.afterFailure, { status: 500, state: 'APROBADO', pickups: 0, notices: 0 });
assert.equal(atomic.retrySucceeded, true); assert.equal(atomic.duplicatePickupRejected, true);
assert.deepEqual(race.statuses, [200, 400]); assert.equal(race.receptionEvents, 1); assert.equal(race.representativeNotices, 1);
const operation = read('operational-http.json'); assert.equal(operation.complete, true); assert.equal(operation.created.length, 3);
const receipts = read('receipts-verified.json'); assert.equal(receipts.results.length, 2);
for (const item of receipts.results) { assert.equal(item.original, 'OBSERVADA'); assert.equal(item.rectification, 'APROBADA'); assert.equal(item.treatedFinding, 'Y12 1 kg'); }
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const manualSha256 = digest('/work/sitrep/docs/manual/help-data.js');
assert.equal(digest(path.join(out, 'manual', 'help-data.js')), manualSha256);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
 const privateFixture = read('legacy-company-notice-private.json');
 const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: privateFixture.grant } });
 assert.equal(grant.activa, privateFixture.original.activa);
 assert.equal(grant.todosEstablecimientos, privateFixture.original.todosEstablecimientos);
 assert.deepEqual(grant.establecimientoIds, privateFixture.original.establecimientoIds);
 const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
 assert.equal(TRAINING_LOGINS.length, 4);
 for (const { email } of TRAINING_LOGINS) {
  assert.match(email, /@capacitacion\.invalid$/);
  const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
   headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.13.25.99' },
   body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
  assert.equal(response.status, 403);
 }
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 const result = { source: process.env.GITHUB_SHA, synthetic: true, runtimeProcesses: processes.length,
  legacyRevokedHidden: 3, directOwnerChecked: true, stateCases: state.manifests, additionalRoles: 2, atomicRollback: true, raceEvents: 1,
  browserJourneys: 6, operationalApiCases: 3, manualSha256, capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false };
 writeFileSync(path.join(out, 'state-notice-final-audit.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
