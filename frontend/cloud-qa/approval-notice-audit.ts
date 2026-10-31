/** Close only the synthetic approval-notice rehearsal; never inspect production. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys, root } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-approval-notice-short-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'approval-notice-short');
const commit = process.env.GITHUB_SHA!;
assert.match(commit, /^[a-f0-9]{40}$/);
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const source = read('source-comparison.json');
assert.equal(source.commit, commit); assert.ok(source.files > 1600);
assert.deepEqual(source.missing, []); assert.deepEqual(source.mismatch, []);
const after = read('source-comparison-after.json');
assert.equal(after.commit, commit); assert.deepEqual(after.missing, []); assert.deepEqual(after.mismatch, []);
const backend = read('backend-source-proof.json');
assert.equal(backend.commit, commit); assert.equal(backend.mismatches, 0);
assert.equal(backend.uncommittedGpsIncluded, false); assert.equal(backend.controllerSource, 'committed');
const compiled = read('backend-compiled-comparison.json');
assert.equal(compiled.freshFiles, 210); assert.deepEqual(compiled.missing, []); assert.deepEqual(compiled.extra, []);
assert.deepEqual(compiled.changed, ['services/manifestProposal.service.js', 'services/notification-mail.service.js']);
assert.doesNotMatch(readFileSync(path.join(out, 'backend-build.log'), 'utf8'), /gpsReceptionObservations|\/\._/);
const processes = read('processes.json');
assert.deepEqual(processes.map((item: { file: string }) => item.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(env.GITHUB_SHA, commit);
  assert.equal(env.QA_COMPAT_BACKEND, 'approval-notice-short');
  assert.equal(env.QA_WEB_BUILD, path.join(out, 'web')); assert.equal(env.QA_APP_BUILD, path.join(out, 'app'));
  assert.equal(env.UPLOADS_DIR, path.join(out, 'uploads')); assert.equal(env.TRAINING_DATABASE_URL, '');
  assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '', key);
}
const browser = read('approval-notice-browser.json');
assert.equal(browser.stats.expected, 2); assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0); assert.equal(browser.stats.flaky, 0); assert.deepEqual(browser.errors, []);
const proofDir = path.join(out, 'approval-notice-browser');
const proofs = readdirSync(proofDir, { withFileTypes: true }).filter(entry => entry.isDirectory())
  .map(entry => path.join(proofDir, entry.name, 'approval-notice-proof.json')).filter(existsSync)
  .map(file => JSON.parse(readFileSync(file, 'utf8')));
assert.deepEqual(proofs.map(item => item.surface).sort(), ['app', 'web-desktop']);
for (const proof of proofs) for (const field of ['synthetic', 'historicalRecordUnchanged', 'live', 'bell', 'inbox', 'detail', 'mailRenderedWithoutSending', 'mailLinkToOwnedNotice', 'mailLogosFromLocalAssets']) assert.equal(proof[field], true, field);
const generation = read('approval-generation.json');
assert.equal(generation.synthetic, true); assert.equal(generation.production, false);
assert.equal(generation.results.length, 6);
assert.ok(generation.results.every((item: any) => item.partiesNotified === 3 && item.retryDidNotDuplicate));
for (const file of ['frontend-notice-unit.json', 'backend-notice-unit.json']) {
  const result = read(file); assert.equal(result.success, true); assert.equal(result.numFailedTests, 0); assert.equal(result.numPendingTests, 0);
}
const manual = readFileSync(path.join(out, 'manual.tap'), 'utf8');
assert.match(manual, /# fail 0\b/); assert.match(manual, /# pass [1-9]\d*\b/);
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const manualSource = readFileSync(path.join(root, 'docs/manual/help-data.js'));
const manualResponse = await fetch('http://127.0.0.1:4177/manual/help-data.js');
assert.equal(manualResponse.status, 200); assert.equal(hash(Buffer.from(await manualResponse.arrayBuffer())), hash(manualSource));
for (const [route, folder] of [['/login', 'web'], ['/app/login', 'app']]) {
  const response = await fetch(`http://127.0.0.1:4177${route}`); assert.equal(response.status, 200);
  assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(readFileSync(path.join(out, folder, 'index.html'))));
}
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const [index, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.11.50.${90 + index}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
    assert.match(JSON.stringify(await response.json()), /acceso directo de capacitaci[oó]n no est[aá] habilitado/i);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { commit, synthetic: true, production: false, browserTests: 2, generationCases: generation.results.length,
    frontendTests: read('frontend-notice-unit.json').numPassedTests, backendTests: read('backend-notice-unit.json').numPassedTests,
    manualTests: Number(manual.match(/# pass (\d+)/)?.[1]), capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false,
    historicalStoredTextUnchanged: true, scope: 'individual approval notice with recognized legacy metadata and exact previous wording' };
  writeFileSync(path.join(out, 'approval-notice-audit.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
