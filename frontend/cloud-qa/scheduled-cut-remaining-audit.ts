/** Verify separate synthetic batches on the same immutable product candidate. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys, root } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026110102';
const previous = '/work/sitrep/.qa-operational-ui-current2026110101';
const candidate = '62516a08a3fe189d7d5612520d678162674f1b32';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'scheduled-cut-regression-62516a08');
assert.equal(process.env.GITHUB_SHA, candidate);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const earlier = JSON.parse(readFileSync(path.join(previous, 'scheduled-cut-lifecycle-audit-candidate-mail-v3.json'), 'utf8'));
assert.equal(earlier.productCommit, candidate); assert.equal(earlier.synthetic, true); assert.equal(earlier.production, false);
assert.equal(earlier.ordinaryBrowserCases, 6); assert.equal(earlier.inSituBrowserCases, 6);
assert.equal(earlier.certificatesVerified, 6); assert.equal(earlier.preferredLinksOpenedByEachParty, true);
assert.equal(earlier.emailAttempts, 0); assert.equal(earlier.emailSent, 0); assert.equal(earlier.pushEnabled, false);

const reports: Record<string, number> = { 'insitu-certificates-browser.json': 2, 'psip-lifecycle-current.json': 6,
  'fleet-browser.json': 2, 'fleet-monitor.json': 2, 'browser.json': 2, 'focus-current.json': 6,
  'role-zoom.json': 3, 'payment-electricity-browser.json': 2 };
for (const [name, count] of Object.entries(reports)) {
  const report = read(name);
  assert.equal(report.stats.expected, count, name); assert.equal(report.stats.unexpected, 0, name);
  assert.equal(report.stats.skipped, 0, name); assert.equal(report.stats.flaky, 0, name);
  assert.deepEqual(report.errors, [], name);
}
const diary = readFileSync(path.join(out, 'remaining-stages.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
assert.equal(diary.filter(row => row.state === 'started').length, 16);
assert.equal(diary.filter(row => row.state === 'passed').length, 16);
assert.equal(diary.filter(row => row.state === 'failed').length, 0);
for (const stage of ['before', 'after']) {
  const source = read(`source-${stage}.json`);
  assert.equal(source.commit, candidate); assert.equal(source.stage, stage); assert.equal(source.files, 911);
  assert.deepEqual(source.missing, []); assert.deepEqual(source.different, []);
}
const qa = read('qa-sources-after.json');
assert.equal(qa.stage, 'after'); assert.equal(qa.files, 56); assert.equal(qa.matched, true); assert.deepEqual(qa.mismatch, []);
const network = read('network-isolation.json');
assert.deepEqual(network.networks, ['sitrep-qa-enterprise-net-20261016']); assert.equal(network.internal, true);
assert.equal(network.publishedPorts, false); assert.equal(network.nanoCpus, 1000000000);
assert.equal(network.memoryBytes, 2147483648); assert.equal(network.memorySwapBytes, 2147483648);

const processes = read('processes.json');
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(env.SITREP_PAUSE_BACKGROUND_JOBS, 'true'); assert.equal(env.TRAINING_DATABASE_URL, '');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
  assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false'); assert.equal(env.MANIFEST_REVIEW_AUTHORITY_BY_ROLE, 'true');
  for (const key of ['MANIFEST_PROPOSALS_ENABLED', 'MANIFEST_EXCEPTIONAL_ENABLED', 'MANIFEST_ADDENDA_ENABLED',
    'MANIFEST_PARTY_REVIEW_ENABLED', 'MANIFEST_CERTIFICATES_ENABLED', 'MANIFEST_TRANSPORT_HANDOFF_ENABLED', 'TRANSPORT_MULTI_GPS_ENABLED']) assert.equal(env[key], 'true', key);
  for (const key of externalKeys) assert.equal(env[key], '', key);
}
const runtime = read('runtime-proof.json');
assert.equal(runtime.source, candidate); assert.match(runtime.backend, /\.qa-scheduled-pause-20261101\/dist\/index\.js$/);
const priorProofs = read('prior-insitu-proofs.json');
assert.equal(priorProofs.source, previous); assert.equal(priorProofs.productCommit, candidate);
assert.equal(priorProofs.attempt, 'candidate-mail-v3'); assert.equal(priorProofs.copied.length, 6);
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
for (const proof of priorProofs.copied) {
  const relative = path.join('proposal-e2e-candidate-mail-v3', proof.case, 'proof.json');
  assert.equal(hash(readFileSync(path.join(out, relative))), proof.sha256);
  assert.equal(hash(readFileSync(path.join(previous, relative))), proof.sha256);
}
const certificates = read('insitu-certificates.json');
assert.equal(certificates.synthetic, true); assert.equal(certificates.externalDelivery, false);
assert.equal(certificates.results.length, 2); assert.ok(certificates.results.every((r: { noTripOrGps: boolean }) => r.noTripOrGps));
const psip = read('psip-lifecycle-audit.json'); assert.equal(psip.checks.length, 6);
assert.ok(psip.checks.every((r: { exchanges: number; attachmentVerified: boolean; noticesVerified: boolean; unrelatedActorDenied: boolean }) =>
  r.exchanges === 5 && r.attachmentVerified && r.noticesVerified && r.unrelatedActorDenied));
const fleet = read('fleet-current-audit.json'); assert.equal(fleet.results.length, 2);
assert.equal(fleet.emailAttempts, 0); assert.equal(fleet.emailSent, 0);
const onboarding = read('onboarding-ux-http.json');
assert.equal(onboarding.requests, 141); assert.equal(onboarding.checks.length, 7);
assert.equal(onboarding.manifestsUntouched, true); assert.equal(onboarding.emailsSent, 0);
const counts: Record<string, number> = {};
for (const [name, min] of [['unit-current.json', 245], ['pdf-unit-current.json', 32]] as const) {
  const report = read(name); assert.equal(report.success, true); assert.ok(report.numPassedTests >= min, name);
  assert.equal(report.numFailedTests, 0); assert.equal(report.numPendingTests, 0); counts[name] = report.numPassedTests;
}
const manual = readFileSync(path.join(out, 'manual-current.tap'), 'utf8');
const manualCount = Number(manual.match(/# tests (\d+)/)?.[1]);
assert.ok(manualCount >= 55); assert.equal(Number(manual.match(/# pass (\d+)/)?.[1]), manualCount);
assert.match(manual, /# fail 0\b/); assert.match(manual, /# skipped 0\b/);
for (const name of ['directorio.html', 'directorio.css', 'directorio.js', 'help-data.js']) {
  const response = await fetch('http://127.0.0.1:4177/manual/' + name);
  assert.equal(response.status, 200); assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(readFileSync(path.join(root, 'docs/manual', name))));
}
const webWorker = await fetch('http://127.0.0.1:4177/sw.js');
assert.equal(webWorker.status, 200);
assert.equal(hash(Buffer.from(await webWorker.arrayBuffer())), hash(readFileSync(path.join(root, 'frontend/public/sw.js'))));
const appWorkerResponse = await fetch('http://127.0.0.1:4177/app/sw-app.js');
assert.equal(appWorkerResponse.status, 200);
const appWorker = await appWorkerResponse.text(), version = appWorker.match(/const SW_VERSION = '(\d{14})'/)?.[1];
assert.ok(version);
const appWorkerSource = readFileSync(path.join(root, 'frontend/public/sw-app.js'), 'utf8').replaceAll('__SW_VERSION__', version);
assert.equal(hash(Buffer.from(appWorker)), hash(Buffer.from(appWorkerSource)));

const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  for (const result of certificates.results) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: result.id },
      select: { isDemoData: true, modalidad: true, estado: true, transportistaId: true, fechaRetiro: true } });
    assert.equal(manifest.isDemoData, true); assert.equal(manifest.modalidad, 'IN_SITU'); assert.equal(manifest.estado, 'TRATADO');
    assert.ok(manifest.transportistaId); assert.equal(manifest.fechaRetiro, null);
    for (const tipo of ['FIRMA', 'APROBACION_TRANSPORTISTA', 'APROBACION_OPERADOR'])
      assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: result.id, tipo } }), 1);
    assert.equal(await db.tramoTransporte.count({ where: { manifiestoId: result.id } }), 0);
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: result.id } }), 0);
  }
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const [i, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.11.60.${90 + i}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  const emailAttempts = await db.emailQueue.count({ where: { intentos: { gt: 0 } } });
  const emailSent = await db.emailQueue.count({ where: { sentAt: { not: null } } });
  assert.equal(emailAttempts, 0); assert.equal(emailSent, 0);
  const result = { productCommit: candidate, synthetic: true, production: false,
    earlierBatch: { ordinaryBrowserCases: 6, inSituBrowserCases: 6, source: previous },
    currentBatch: { browserCases: Object.values(reports).reduce((a, b) => a + b, 0), reports,
      frontendUnitTests: counts['unit-current.json'], pdfTests: counts['pdf-unit-current.json'], manualTests: manualCount,
      onboardingApiRequests: onboarding.requests },
    frontendBuildCommit: '9efba0ec3eedeacacfa1da4dccbdffae923a5e42',
    qaSourcesMatchedAfter: qa.files, capClosed: true, scheduledJobsPaused: true,
    emailAttempts, emailSent, pushEnabled: false };
  writeFileSync(path.join(out, 'scheduled-cut-remaining-audit.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
