import { stripVTControlCharacters } from 'node:util';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-signature-representatives-20261030'; assert.equal(process.env.QA_ARTIFACTS, out);
const load = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const before = load('integration-before.json'), after = load('integration-after.json');
assert.deepEqual({ direct: before.direct, representative: before.representative, duplicate: before.duplicate,
  concurrentClosureFinishedBeforeCommit: before.concurrentClosureFinishedBeforeCommit, staleNotices: before.staleNotices },
{ direct: 3, representative: 0, duplicate: 0, concurrentClosureFinishedBeforeCommit: true, staleNotices: 3 });
assert.deepEqual({ titulars: after.titulars, representatives: after.representatives, duplicate: after.duplicate,
  thirtyDayRecipients: after.thirtyDayRecipients, simultaneousDuplicates: after.simultaneousDuplicates,
  revokedHidden: after.revokedHidden, foreign404: after.foreign404, staleMailSuppressed: after.staleMailSuppressed,
  concurrentClosureNotices: after.concurrentClosureNotices, emailAttempts: after.emailAttempts, emailSent: after.emailSent, pushEnabled: after.pushEnabled },
{ titulars: 3, representatives: 2, duplicate: 0, thirtyDayRecipients: 5, simultaneousDuplicates: 0,
  revokedHidden: true, foreign404: true, staleMailSuppressed: true, concurrentClosureNotices: 0,
  emailAttempts: 0, emailSent: 0, pushEnabled: false });
const browser = load('browser-final.json').stats;
assert.equal(browser.expected, 14); assert.equal(browser.unexpected, 0); assert.equal(browser.skipped, 0);
const strip = (s: string) => stripVTControlCharacters(s);
assert.match(strip(readFileSync(path.join(out, 'backend-final.log'), 'utf8')), /203 passed/);
assert.match(strip(readFileSync(path.join(out, 'frontend-after.log'), 'utf8')), /171 passed/);
const manual = readFileSync(path.join(out, 'manual.log'), 'utf8');
assert.match(manual, /# pass 35\b/); assert.match(manual, /# fail 0\b/);
const gallery = load('gallery/coverage.json'), galleryQa = load('gallery/qa-result.json');
assert.equal(gallery.cases, 353); assert.deepEqual(gallery.uncataloguedProducers, []);
assert.equal(gallery.deliveryCalls, 0); assert.equal(gallery.databaseConnections, 0);
assert.ok(galleryQa.checks.length >= 19 && galleryQa.checks.every((check: any) => check.passed));
assert.deepEqual(galleryQa.errors, []); assert.deepEqual(galleryQa.externalRequests, []); assert.deepEqual(galleryQa.overflows, []);
const processes = load('processes.json');
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.QA_COMPAT_BACKEND, 'signature-representatives');
  assert.equal(env.QA_WEB_BUILD, out + '/web-final'); assert.equal(env.QA_APP_BUILD, out + '/app-final');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
assert.equal(qaBackendEntry(), '/work/sitrep/backend/dist-qa-signature-representatives-20261030/index.js');
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const expected: Record<string, string> = load('source-digests.json');
for (const [file, digest] of Object.entries(expected)) assert.equal(hash(readFileSync('/work/sitrep/' + file)), digest, file);
const forbidden = ['notification.controller.ts', 'manifiesto-gps.controller.ts', 'transport-handoff.controller.ts', 'gpsReceptionObservations.service.ts'];
const compilerFiles = readFileSync(path.join(out, 'tsc-files.txt'), 'utf8').split('\n');
for (const file of forbidden) assert.ok(!compilerFiles.some(line => line.endsWith('/' + file)), file);
function files(dir: string, relative = ''): string[] {
  return readdirSync(path.join(dir, relative), { withFileTypes: true }).flatMap(entry => {
    const name = path.join(relative, entry.name);
    return entry.isDirectory() ? files(dir, name) : entry.isFile() ? [name] : [];
  });
}
const baseline = '/work/sitrep/backend/dist-qa-eventual-notices-20261030';
const candidate = '/work/sitrep/backend/dist-qa-signature-representatives-20261030';
const left = files(baseline).sort(), right = files(candidate).sort(); assert.deepEqual(right, left);
const changed = left.filter(file => hash(readFileSync(path.join(baseline, file))) !== hash(readFileSync(path.join(candidate, file))));
assert.deepEqual(changed.sort(), ['jobs/manifestSignatureReminder.job.js', 'services/manifestRuleCompanyNotice.service.js']);
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
  const report = { synthetic: true, production: false, browserPasses: 14, backendUnitPasses: 203, frontendUnitPasses: 171,
    manualPasses: 35, galleryCases: gallery.cases, galleryChecks: galleryQa.checks.length, compiledFilesCompared: left.length,
    compiledChanges: changed, comparedFiles: Object.keys(expected).length, manualSha256: hash(source),
    capClosed: true, emailAttempts: 0, emailsSent: 0, pushEnabled: false };
  writeFileSync(path.join(out, 'audit.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
