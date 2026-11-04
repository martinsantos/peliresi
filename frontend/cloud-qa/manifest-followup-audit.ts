import { stripVTControlCharacters } from 'node:util';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-followup-notice-20261030'; assert.equal(process.env.QA_ARTIFACTS, out);
const load = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const strip = (name: string) => stripVTControlCharacters(readFileSync(path.join(out, name), 'utf8'));
assert.match(strip('backend-before.log'), /3 failed/); assert.match(strip('frontend-before.log'), /3 failed/);
assert.match(strip('backend-final.log'), /214 passed/); assert.match(strip('frontend-final.log'), /239 passed/);
assert.match(strip('manual-final.log'), /# pass 37\b/); assert.match(strip('manual-final.log'), /# fail 0\b/);
assert.match(strip('fixture.log'), /rol correcto 200, rol incorrecto y cuenta ajena 404; caso descartado no elegible/);
for (const file of ['build-web.log', 'build-app.log']) assert.match(strip(file), /built in/);
const browser = load('browser.json').stats; assert.equal(browser.expected, 8); assert.equal(browser.unexpected, 0); assert.equal(browser.skipped, 0);
const prior = load('browser-ux238.json').stats; assert.equal(prior.expected, 10); assert.equal(prior.unexpected, 0); assert.equal(prior.skipped, 0);
const gallery = load('gallery/coverage.json'), galleryQa = load('gallery/qa-result.json');
assert.equal(gallery.cases, 354); assert.deepEqual(gallery.uncataloguedProducers, []);
assert.equal(gallery.deliveryCalls, 0); assert.equal(gallery.databaseConnections, 0);
assert.ok(galleryQa.checks.length >= 21 && galleryQa.checks.every((check: any) => check.passed));
assert.deepEqual(galleryQa.errors, []); assert.deepEqual(galleryQa.externalRequests, []); assert.deepEqual(galleryQa.overflows, []);
const processes = load('processes.json'); assert.deepEqual(processes.map((p: {file: string}) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.QA_COMPAT_BACKEND, 'manifest-followup'); assert.equal(env.QA_WEB_BUILD, out + '/web'); assert.equal(env.QA_APP_BUILD, out + '/app');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const expected: Record<string, string> = load('source-digests.json');
for (const [file, digest] of Object.entries(expected)) assert.equal(hash(readFileSync('/work/sitrep/' + file)), digest, file);
const forbidden = ['notification.controller.ts', 'manifiesto-gps.controller.ts', 'transport-handoff.controller.ts', 'gpsReceptionObservations.service.ts'];
for (const file of forbidden) assert.ok(!strip('backend-build.log').split('\n').some(line => line.endsWith('/' + file)), file);
const candidate = '/work/sitrep/backend/dist-qa-followup-notice-20261030'; assert.equal(qaBackendEntry(), candidate + '/index.js');
function files(dir: string, relative = ''): string[] {
  return readdirSync(path.join(dir, relative), { withFileTypes: true }).flatMap(entry => {
    const name = path.join(relative, entry.name); return entry.isDirectory() ? files(dir, name) : entry.isFile() ? [name] : [];
  });
}
const baseline = '/work/sitrep/backend/dist-qa-manifest-owner-20261030';
const left = files(baseline).sort(), right = files(candidate).sort(); assert.deepEqual(right, left);
const changed = left.filter(file => hash(readFileSync(path.join(baseline, file))) !== hash(readFileSync(path.join(candidate, file))));
assert.deepEqual(changed, ['domain/manifestNoticeContext.js']);
const manual = readFileSync('/work/sitrep/docs/manual/help-data.js'); const served = await fetch('http://127.0.0.1:4177/manual/help-data.js');
assert.equal(served.status, 200); assert.equal(hash(Buffer.from(await served.arrayBuffer())), hash(manual));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const { TRAINING_LOGINS } = backendRequire(path.join(candidate, 'lib/trainingDirectLogin.js'));
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const r = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.98.8' }, body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(r.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const report = { synthetic: true, production: false, browserPasses: 8, priorBrowserRepeated: 10, backendUnitPasses: 214, frontendUnitPasses: 239,
    manualPasses: 37, galleryCases: gallery.cases, galleryChecks: galleryQa.checks.length, compiledFilesCompared: left.length,
    compiledChanges: changed, comparedFiles: Object.keys(expected).length, manualSha256: hash(manual), capClosed: true,
    emailAttempts: 0, emailsSent: 0, pushEnabled: false };
  writeFileSync(path.join(out, 'audit.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
