import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, root } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-pwa-shortcuts-20261031';
const commit = '1d391e38a9071eba7e64350c543eb8286a605049';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'pwa-shortcuts-20261031');
assert.equal(process.env.GITHUB_SHA, commit);
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const previous = JSON.parse(readFileSync('/work/sitrep/.qa-liveness-20261031/liveness-audit.json', 'utf8'));
assert.equal(previous.productCommit, 'af64384d8dd848898ffbed4e1c139d787271861e');
assert.equal(previous.previousBrowserTests, 37);
for (const stage of ['before', 'after']) {
  const net = read(`network-isolation-${stage}.json`);
  assert.deepEqual(net.networks, ['sitrep-qa-enterprise-net-20261016']);
  assert.equal(net.internal, true); assert.equal(net.publishedPorts, false);
  assert.deepEqual([net.nanoCpus, net.memoryBytes, net.memorySwapBytes], [1000000000, 2147483648, 2147483648]);
  const source = read(`source-${stage}.json`), qa = read(`qa-sources-${stage}.json`);
  assert.equal(source.commit, commit); assert.equal(source.files, 911);
  assert.deepEqual(source.missing, []); assert.deepEqual(source.different, []);
  assert.equal(qa.stage, stage); assert.equal(qa.matched, true); assert.ok(qa.files >= 87);
}
for (const [file, digest] of Object.entries(read('qa-digests.json') as Record<string, string>)) {
  assert.equal(sha(readFileSync(path.join(root, file))), digest, file);
}
const built = JSON.parse(readFileSync(path.join(out, 'app/manifest-app.json'), 'utf8'));
const source = JSON.parse(readFileSync(path.join(root, 'frontend/public/manifest-app.json'), 'utf8'));
assert.deepEqual(built, source);
assert.deepEqual(built.shortcuts.map((entry: { name: string }) => entry.name), ['Inicio', 'Escanear QR', 'Avisos']);
assert.equal(sha(readFileSync(path.join(out, 'web/manifest-app.json'))), sha(readFileSync(path.join(root, 'frontend/public/manifest-app.json'))));
const flags = read('build-flags.json'); assert.equal(flags.candidate, commit);
for (const value of Object.values(flags.flags)) assert.equal(value, 'true');
assert.equal(read('runtime-proof.json').backend, path.join(root, 'backend/dist-qa-liveness-20261031/index.js'));
for (const { pid } of read('processes.json')) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(env.QA_ARTIFACTS, out); assert.equal(env.QA_COMPAT_BACKEND, 'pwa-shortcuts-20261031');
  assert.equal(env.QA_WEB_BUILD, path.join(out, 'web')); assert.equal(env.QA_APP_BUILD, path.join(out, 'app-current'));
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
}
const unit = read('unit.json');
assert.equal(unit.success, true); assert.equal(unit.numPassedTests, 84); assert.equal(unit.numFailedTests, 0); assert.equal(unit.numPendingTests, 0);
const baseline = read('baseline-unit.json'); assert.equal(baseline.numFailedTests, 8);
const workerBaseline = read('worker-baseline.json'); assert.equal(workerBaseline.numFailedTests, 1);
const tap = readFileSync(path.join(out, 'manual-final.tap'), 'utf8');
assert.match(tap, /# tests 53\b/); assert.match(tap, /# pass 53\b/); assert.match(tap, /# fail 0\b/);
const browser = read('browser.json');
assert.equal(browser.stats.expected, 9); assert.equal(browser.stats.unexpected, 0); assert.equal(browser.stats.skipped, 0);
assert.equal(browser.stats.flaky, 0); assert.deepEqual(browser.errors, []);
const manual = await fetch('http://127.0.0.1:4177/manual/directorio.html');
assert.equal(manual.status, 200);
assert.equal(sha(Buffer.from(await manual.arrayBuffer())), sha(readFileSync(path.join(root, 'docs/manual/directorio.html'))));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  for (const [i, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.11.98.${90 + i}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { productCommit: commit, synthetic: true, production: false, previousIntegratedCommit: previous.previousIntegratedCommit,
    previousIntegratedBrowserTests: previous.previousBrowserTests, directedBrowserTests: 9, unitTests: 84, manualTests: 53,
    capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false, androidLauncherVerified: false };
  writeFileSync(path.join(out, 'pwa-shortcuts-audit.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
