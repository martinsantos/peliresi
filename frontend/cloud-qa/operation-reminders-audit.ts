import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operation-reminders-20261030'; assert.equal(process.env.QA_ARTIFACTS, out);
const load = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const before = load('integration-before.json'), after = load('integration-after.json');
assert.deepEqual(before, { synthetic: true, originNotices: 2, falsePickupNotice: true, operatorMissing: true });
assert.deepEqual(after, { synthetic: true, originRecipients: 5, representativeRevokedHidden: true, foreign404: true,
  duplicate: 0, legacyPerPerson: true, concurrentDuplicates: 0, rescheduledRecipients: 5,
  obsoleteMailSuppressed: true, concurrentTransitionNotices: 0, trainingNotices: 0,
  emailAttempts: 0, emailSent: 0, pushEnabled: false });
const browser = load('browser-final.json').stats;
assert.equal(browser.expected, 12); assert.equal(browser.unexpected, 0); assert.equal(browser.skipped, 0);
const geometry = load('browser-geometry.json').stats;
assert.equal(geometry.expected, 2); assert.equal(geometry.unexpected, 0); assert.equal(geometry.skipped, 0);
const strip = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');
assert.match(strip(readFileSync(path.join(out, 'backend-final.log'), 'utf8')), /233 passed/);
assert.match(strip(readFileSync(path.join(out, 'frontend-final.log'), 'utf8')), /172 passed/);
const manual = readFileSync(path.join(out, 'manual.log'), 'utf8');
assert.match(manual, /# pass 36\b/); assert.match(manual, /# fail 0\b/);
const gallery = load('gallery/coverage.json'), galleryQa = load('gallery/qa-result.json');
assert.equal(gallery.cases, 354); assert.deepEqual(gallery.uncataloguedProducers, []);
assert.equal(gallery.deliveryCalls, 0); assert.equal(gallery.databaseConnections, 0);
assert.ok(galleryQa.checks.length >= 20 && galleryQa.checks.every((check: any) => check.passed));
assert.deepEqual(galleryQa.errors, []); assert.deepEqual(galleryQa.externalRequests, []); assert.deepEqual(galleryQa.overflows, []);
const processes = load('processes.json');
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.QA_COMPAT_BACKEND, 'operation-reminders');
  assert.equal(env.QA_WEB_BUILD, out + '/web-sitefinal'); assert.equal(env.QA_APP_BUILD, out + '/app-sitefinal');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
assert.equal(qaBackendEntry(), '/work/sitrep/backend/dist-qa-operation-reminders-20261030/index.js');
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const expected: Record<string, string> = load('source-digests.json');
for (const [file, digest] of Object.entries(expected)) assert.equal(hash(readFileSync('/work/sitrep/' + file)), digest, file);
const assetsCompared: Record<string, number> = {};
for (const [surface, oldName, newName] of [['web', 'web-final', 'web-sitefinal'], ['app', 'app-final', 'app-sitefinal']]) {
  const old = path.join(out, oldName), fresh = path.join(out, newName);
  assert.equal(hash(readFileSync(path.join(old, 'index.html'))), hash(readFileSync(path.join(fresh, 'index.html'))));
  const names = readdirSync(path.join(fresh, 'assets'), { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => entry.name);
  assert.ok(names.length > 0); assetsCompared[surface] = names.length;
  for (const name of names) assert.equal(hash(readFileSync(path.join(old, 'assets', name))), hash(readFileSync(path.join(fresh, 'assets', name))), name);
}
const forbidden = ['notification.controller.ts', 'manifiesto-gps.controller.ts', 'transport-handoff.controller.ts', 'gpsReceptionObservations.service.ts'];
const compilerFiles = readFileSync(path.join(out, 'backend-final-build.log'), 'utf8').split('\n');
for (const file of forbidden) assert.ok(!compilerFiles.some(line => line.endsWith('/' + file)), file);
function files(dir: string, relative = ''): string[] {
  return readdirSync(path.join(dir, relative), { withFileTypes: true }).flatMap(entry => {
    const name = path.join(relative, entry.name);
    return entry.isDirectory() ? files(dir, name) : entry.isFile() ? [name] : [];
  });
}
const baseline = '/work/sitrep/backend/dist-qa-signature-representatives-20261030';
const candidate = '/work/sitrep/backend/dist-qa-operation-reminders-20261030';
const left = files(baseline).sort(), right = files(candidate).sort();
assert.deepEqual(right.filter(file => !left.includes(file)), ['domain/operationReminder.js']);
assert.deepEqual(left.filter(file => !right.includes(file)), []);
const changed = left.filter(file => hash(readFileSync(path.join(baseline, file))) !== hash(readFileSync(path.join(candidate, file))));
assert.deepEqual(changed.sort(), ['jobs/recordatorio.job.js', 'services/committed-manifest-push.service.js',
  'services/manifestRuleCompanyNotice.service.js', 'services/notification-mail.service.js']);
const source = readFileSync('/work/sitrep/docs/manual/help-data.js');
const served = await fetch('http://127.0.0.1:4177/manual/help-data.js'); assert.equal(served.status, 200);
assert.equal(hash(Buffer.from(await served.arrayBuffer())), hash(source));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const { TRAINING_LOGINS } = backendRequire(path.join(candidate, 'lib/trainingDirectLogin.js'));
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.99.8' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const report = { synthetic: true, production: false, browserPasses: 12, backendUnitPasses: 233, frontendUnitPasses: 172,
    manualPasses: 36, galleryCases: gallery.cases, galleryChecks: galleryQa.checks.length, compiledFilesCompared: left.length,
    compiledChanges: changed, compiledAdded: 'domain/operationReminder.js', comparedFiles: Object.keys(expected).length, assetsCompared,
    manualSha256: hash(source), capClosed: true, emailAttempts: 0, emailsSent: 0, pushEnabled: false };
  writeFileSync(path.join(out, 'audit.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
