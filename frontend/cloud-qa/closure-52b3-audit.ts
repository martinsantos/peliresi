/** Evidence checks for the combined, synthetic preview regression. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys, root } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026103090';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.GITHUB_SHA, '52b3bec4c72eefa9d88c221b6bb36b56c2fcafdf');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const flags = ['MANIFEST_PROPOSALS_ENABLED', 'MANIFEST_EXCEPTIONAL_ENABLED', 'MANIFEST_ADDENDA_ENABLED',
  'MANIFEST_PARTY_REVIEW_ENABLED', 'MANIFEST_CERTIFICATES_ENABLED', 'MANIFEST_TRANSPORT_HANDOFF_ENABLED', 'TRANSPORT_MULTI_GPS_ENABLED'];
const frontendFlags = ['VITE_MANIFEST_PROPOSALS_ENABLED', 'VITE_MANIFEST_EXCEPTIONAL_ENABLED', 'VITE_MANIFEST_ADDENDA_ENABLED',
  'VITE_MANIFEST_PARTY_REVIEW_ENABLED', 'VITE_MANIFEST_CERTIFICATES_ENABLED', 'VITE_MANIFEST_TRANSPORT_HANDOFF_ENABLED', 'VITE_TRANSPORT_MULTI_GPS_ENABLED'];
const processes = read('processes.json');
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
  assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false'); assert.equal(env.MANIFEST_REVIEW_AUTHORITY_BY_ROLE, 'true');
  assert.equal(env.QA_COMPAT_BACKEND, 'closure-52b3bec4'); assert.equal(env.UPLOADS_DIR, path.join(out, 'uploads'));
  assert.equal(env.QA_WEB_BUILD, '/work/sitrep/.qa-inspection-deadline-company-20261030/web-inbox-final2'); assert.equal(env.QA_APP_BUILD, '/work/sitrep/.qa-inspection-deadline-company-20261030/app-inbox-final2');
  for (const key of flags) assert.equal(env[key], 'true', key);
  for (const key of frontendFlags) assert.equal(env[key], 'true', key);
  for (const key of externalKeys) assert.equal(env[key], '', key);
}
const reports: Record<string, number> = { 'manifest-complete.json': 6, 'proposal-e2e-initial.json': 6,
  'insitu-certificates-browser.json': 2, 'psip-lifecycle-current.json': 6, 'fleet-browser.json': 2,
  'fleet-monitor.json': 2, 'browser.json': 2, 'focus-current.json': 6, 'role-zoom.json': 3,
  'payment-electricity-browser.json': 2 };
for (const [file, expected] of Object.entries(reports)) {
  const report = read(file);
  assert.equal(report.stats.expected, expected, file); assert.equal(report.stats.unexpected, 0, file);
  assert.equal(report.stats.skipped, 0, file); assert.equal(report.stats.flaky, 0, file);
  assert.deepEqual(report.errors, [], file);
}
const source = read('source-comparison-initial.json');
assert.equal(source.commit, '52b3bec4'); assert.deepEqual(source.missing, []); assert.deepEqual(source.mismatch, []); assert.equal(source.files, 1683);
const qaSource = read('qa-source-comparison.json'); assert.equal(qaSource.count, 681); assert.deepEqual(qaSource.missing, []);
assert.deepEqual(qaSource.different.sort(), ['frontend/cloud-qa/closure-current-fixture.ts', 'frontend/cloud-qa/gps-lost-response-runner.ts', 'frontend/cloud-qa/psip-lifecycle-audit.ts', 'frontend/cloud-qa/rollback-backend.test.ts', 'frontend/cloud-qa/rollback-backend.ts']);
const comparison = read('backend-compiled-comparison.json');
assert.equal(comparison.freshFiles, 210); assert.deepEqual(comparison.missing, []); assert.deepEqual(comparison.extra, []); assert.deepEqual(comparison.changed, []);
const build = read('backend-source-proof.json');
assert.equal(build.mismatches, 0); assert.equal(build.commit, process.env.GITHUB_SHA); assert.equal(build.trackedBackendFiles, 400); assert.equal(build.compilationRoots, 210); assert.equal(build.uncommittedGpsIncluded, false);
assert.doesNotMatch(readFileSync(path.join(out, 'backend-build.log'), 'utf8'), /gpsReceptionObservations|\/\._/);
for (const [file, count] of [['unit-current.json', 177], ['pdf-unit-current.json', 32]] as const) {
  const report = read(file); assert.equal(report.success, true); assert.equal(report.numPassedTests, count);
  assert.equal(report.numFailedTests, 0); assert.equal(report.numPendingTests, 0);
}
const manualTests = readFileSync(path.join(out, 'manual-current.tap'), 'utf8');
assert.match(manualTests, /# tests 37\b/); assert.match(manualTests, /# pass 37\b/); assert.match(manualTests, /# fail 0\b/);
const receipts = read('receipts-verified.json'); assert.equal(receipts.results.length, 6);
assert.ok(receipts.results.every((r: any) => r.original === 'OBSERVADA' && r.rectification === 'APROBADA'
  && r.declaration === 'Y1 21 kg' && r.received === 'Y1 22 kg' && r.treatedFinding === 'Y12 1 kg'));
const psip = read('psip-lifecycle-audit.json'); assert.equal(psip.checks.length, 6);
assert.ok(psip.checks.every((r: any) => r.exchanges === 5 && r.attachmentVerified && r.noticesVerified && r.unrelatedActorDenied));
const fleet = read('fleet-current-audit.json'); assert.equal(fleet.results.length, 2);
const onboarding = read('onboarding-ux-http.json');
assert.equal(onboarding.requests, 141); assert.equal(onboarding.checks.length, 7);
assert.equal(onboarding.manifestsUntouched, true); assert.equal(onboarding.emailsSent, 0);
const certificates = read('insitu-certificates.json'); assert.equal(certificates.results.length, 2);
const proofDir = path.join(out, 'proposal-e2e-initial');
const proofs = readdirSync(proofDir, { withFileTypes: true }).filter(entry => entry.isDirectory())
  .map(entry => path.join(proofDir, entry.name, 'proof.json')).filter(existsSync)
  .map(file => JSON.parse(readFileSync(file, 'utf8'))).filter(proof => proof.noTripOrGps === true);
assert.equal(proofs.length, 6);
assert.deepEqual(proofs.map(p => `${p.surface}:${p.creator}`).sort(),
  ['app:generador', 'app:operador', 'app:transportista', 'web-desktop:generador', 'web-desktop:operador', 'web-desktop:transportista']);
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const qaSources: Record<string, string> = read('qa-digests.json');
for (const [file, digest] of Object.entries(qaSources)) assert.equal(hash(readFileSync(path.join(root, file))), digest, file);
const manual = readFileSync(path.join(root, 'docs/manual/help-data.js'));
const response = await fetch('http://127.0.0.1:4177/manual/help-data.js');
assert.equal(response.status, 200); assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(manual));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const completed = certificates.results.map((r: { id: string }) => r.id);
  for (const proof of proofs) {
    const record = await db.manifiesto.findUniqueOrThrow({ where: { id: proof.id },
      select: { isDemoData: true, estado: true, modalidad: true, transportistaId: true, fechaRetiro: true } });
    assert.equal(record.isDemoData, true); assert.equal(record.modalidad, 'IN_SITU'); assert.ok(record.transportistaId);
    assert.equal(record.fechaRetiro, null); assert.equal(record.estado, completed.includes(proof.id) ? 'TRATADO' : 'RECIBIDO');
    for (const tipo of ['FIRMA', 'APROBACION_TRANSPORTISTA', 'APROBACION_OPERADOR'])
      assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: proof.id, tipo } }), 1);
    assert.equal(await db.tramoTransporte.count({ where: { manifiestoId: proof.id } }), 0);
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: proof.id } }), 0);
  }
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const [i, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const r = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.11.49.${90 + i}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(r.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { productCommit: process.env.GITHUB_SHA, synthetic: true, production: false, reports,
    browserTests: Object.values(reports).reduce((a, b) => a + b, 0), unitTests: 177, pdfTests: 32, manualTests: 37,
    onboardingApiRequests: onboarding.requests, manualSha256: hash(manual),
    capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false };
  writeFileSync(path.join(out, 'closure-52b3-audit.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
