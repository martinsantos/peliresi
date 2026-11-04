import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

// Verify only the isolated run. This audit never opens a production connection.
await assertCloudDatabase();
const candidate = process.env.SITREP_QA_RUN === 'closure-candidate-32b12b81';
const out = candidate ? '/work/sitrep/.qa-operational-ui-current2026102950' : '/work/sitrep/.qa-operational-ui-current2026102942';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.GITHUB_SHA, candidate ? '32b12b81161b01648608286f1c36e8eec1839044' : 'c64352127bf390839cf309339bf5768d045d6618');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (file: string) => JSON.parse(readFileSync(path.join(out, file), 'utf8'));
const processes = read('processes.json');
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
const browserCounts: Record<string, number> = {
  'manifest-complete.json': candidate ? 6 : 2,
  'proposal-e2e-initial.json': 6,
  'insitu-certificates-browser.json': 2,
  'fleet-browser.json': 2,
  'fleet-monitor.json': 2,
  'payment-electricity-browser.json': 2,
  'psip-role-notices-current.json': 2,
};
for (const [file, count] of Object.entries(browserCounts)) {
  const report = read(file);
  assert.equal(report.stats.expected, count, file);
  assert.equal(report.stats.skipped, 0, file);
  assert.equal(report.stats.unexpected, 0, file);
  assert.equal(report.stats.flaky, 0, file);
  assert.deepEqual(report.errors, [], file);
}
const operational = read('operational-http.json');
assert.equal(operational.complete, true);
assert.deepEqual(operational.created.map((item: { creator: string }) => item.creator).sort(),
  ['generador', 'operador', 'transportista']);
const receipts = read('receipts-verified.json');
assert.equal(receipts.results.length, candidate ? 6 : 2);
if (candidate) assert.deepEqual(receipts.results.map((receipt: {surface: string; creator: string}) => `${receipt.surface}:${receipt.creator}`).sort(),
  ['app:generador', 'app:operador', 'app:transportista', 'web-desktop:generador', 'web-desktop:operador', 'web-desktop:transportista']);
for (const receipt of receipts.results) {
  assert.equal(receipt.original, 'OBSERVADA'); assert.equal(receipt.rectification, 'APROBADA');
  assert.equal(receipt.declaration, 'Y1 21 kg'); assert.equal(receipt.received, 'Y1 22 kg');
  assert.equal(receipt.treatedFinding, 'Y12 1 kg');
  const file = 'final-' + receipt.surface + (candidate ? '-' + receipt.creator : '') + '.pdf';
  assert.equal(createHash('sha256').update(readFileSync(path.join(out, file))).digest('hex'), receipt.sha256);
}
const inSituCertificates = read('insitu-certificates.json');
assert.equal(inSituCertificates.results.length, 2);
const completedInSituIds = inSituCertificates.results.map((result: { id: string }) => result.id);
assert.equal(new Set(completedInSituIds).size, 2);
assert.ok(inSituCertificates.results.every((result: { noTripOrGps: boolean }) => result.noTripOrGps));
const fleet = read('fleet-current-audit.json');
assert.equal(fleet.results.length, 2); assert.equal(fleet.emailAttempts, 0); assert.equal(fleet.emailSent, 0);
const onboarding = read('onboarding-ux-http.json');
assert.equal(onboarding.requests, 141); assert.equal(onboarding.checks.length, 7);
assert.equal(onboarding.manifestsUntouched, true); assert.equal(onboarding.emailsSent, 0);
const psip = read('psip-context-http.json');
assert.equal(psip.checks.filter((check: { status: number }) => check.status === 200).length, 3);
assert.equal(psip.checks.filter((check: { status: number }) => check.status === 403).length, 6);
assert.equal(psip.responsesSubmitted, 0);
const duration = read('transit-duration-http-proof.json');
assert.equal(duration.synthetic, true); assert.equal(duration.beforeThreshold, 0); assert.equal(duration.afterThreshold, 1);
assert.equal(duration.automaticDefaultAlerts, 0); assert.equal(duration.legacyUnboundedAlerts, 0);
assert.equal(duration.relayThresholdAlerts, 1); assert.equal(duration.emailAttempts, 0); assert.equal(duration.emailSent, 0);
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const manualSha256 = digest('/work/sitrep/docs/manual/help-data.js');
assert.equal(digest(path.join(out, 'manual', 'help-data.js')), manualSha256);

const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const proofsDir = path.join(out, 'proposal-e2e-initial');
  const proofs = readdirSync(proofsDir, { withFileTypes: true }).filter(entry => entry.isDirectory())
    .map(entry => path.join(proofsDir, entry.name, 'proof.json')).filter(existsSync)
    .map(file => JSON.parse(readFileSync(file, 'utf8'))).filter(proof => proof.noTripOrGps === true);
  assert.equal(proofs.length, 6);
  assert.deepEqual(proofs.map(proof => `${proof.surface}:${proof.creator}`).sort(),
    ['app:generador', 'app:operador', 'app:transportista', 'web-desktop:generador', 'web-desktop:operador', 'web-desktop:transportista']);
  for (const proof of proofs) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: proof.id },
      select: { numero: true, isDemoData: true, estado: true, modalidad: true, transportistaId: true, fechaRetiro: true } });
    assert.equal(manifest.numero, proof.numero); assert.equal(manifest.isDemoData, true);
    assert.equal(manifest.modalidad, 'IN_SITU'); assert.ok(manifest.transportistaId); assert.equal(manifest.fechaRetiro, null);
    assert.equal(manifest.estado, completedInSituIds.includes(proof.id) ? 'TRATADO' : 'RECIBIDO');
    for (const tipo of ['FIRMA', 'APROBACION_TRANSPORTISTA', 'APROBACION_OPERADOR'])
      assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: proof.id, tipo } }), 1);
    assert.equal(await db.tramoTransporte.count({ where: { manifiestoId: proof.id } }), 0);
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: proof.id } }), 0);
  }
  for (const item of operational.created) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { isDemoData: true, estado: true } });
    assert.equal(manifest.isDemoData, true); assert.equal(manifest.estado, 'TRATADO');
    assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: item.id, tipo: 'ENTREGA' } }), 1);
  }
  const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.22.96' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const report = { productCommit: process.env.GITHUB_SHA, synthetic: true, browserCounts,
    operationalApiCases: operational.created.length, inSituThreePartyCases: proofs.length,
    onboardingApiRequests: onboarding.requests, psipAuthorized: 3, psipDenied: 6,
    durationOnlyConfigured: true, manualSha256, runtimeProcesses: processes.length,
    capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false };
  writeFileSync(path.join(out, 'integrated-cut-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
