import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, root } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-notification-click-20261031';
const commit = '2ebc202da7f5a01fafe1455cb47e8e598afd1a1f';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, 'notice-click-20261031');
assert.equal(process.env.GITHUB_SHA, commit);
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const previous = JSON.parse(readFileSync('/work/sitrep/.qa-pwa-shortcuts-20261031/pwa-shortcuts-audit.json', 'utf8'));
assert.equal(previous.productCommit, '1d391e38a9071eba7e64350c543eb8286a605049');
for (const stage of ['before', 'after']) {
  const net = read(`network-isolation-${stage}.json`);
  assert.deepEqual(net.networks, ['sitrep-qa-enterprise-net-20261016']);
  assert.equal(net.internal, true); assert.equal(net.publishedPorts, false);
  assert.deepEqual([net.nanoCpus, net.memoryBytes, net.memorySwapBytes], [1000000000, 2147483648, 2147483648]);
  const source = read(`source-${stage}.json`), qa = read(`qa-sources-${stage}.json`);
  assert.equal(source.commit, commit); assert.equal(source.files, 911);
  assert.deepEqual(source.missing, []); assert.deepEqual(source.different, []);
  assert.equal(qa.stage, stage); assert.equal(qa.matched, true); assert.ok(qa.files >= 90);
}
for (const [file, digest] of Object.entries(read('qa-digests.json') as Record<string, string>)) {
  assert.equal(sha(readFileSync(path.join(root, file))), digest, file);
}
const reuse = read('source-reuse.json');
assert.equal(reuse.from, previous.productCommit); assert.equal(reuse.to, commit);
assert.deepEqual(reuse.changedProductFiles, ['docs/manual/directorio.html', 'frontend/public/sw-app.js', 'frontend/public/sw.js']);
const webWorker = readFileSync(path.join(root, 'frontend/public/sw.js'));
assert.equal(sha(readFileSync(path.join(out, 'web/sw.js'))), sha(webWorker));
const appSource = readFileSync(path.join(root, 'frontend/public/sw-app.js'), 'utf8');
const appBuild = readFileSync(path.join(out, 'app/sw-app.js'), 'utf8');
const version = appBuild.match(/const SW_VERSION = '([0-9]{14})'/)?.[1];
assert.ok(version); assert.equal(appBuild, appSource.replaceAll('__SW_VERSION__', version));
const compiled = '9efba0ec3eedeacacfa1da4dccbdffae923a5e42';
const buildReuse = read('build-reuse.json'); assert.equal(buildReuse.from, compiled); assert.equal(buildReuse.to, commit);
assert.deepEqual(buildReuse.changedProductFiles, ['docs/manual/directorio.html']);
const flags = read('build-flags.json'); assert.equal(flags.candidate, compiled);
for (const value of Object.values(flags.flags)) assert.equal(value, 'true');
assert.equal(read('runtime-proof.json').source, compiled);
assert.equal(read('runtime-proof.json').backend, path.join(root, 'backend/dist-qa-liveness-20261031/index.js'));
for (const { pid } of read('processes.json')) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(env.QA_ARTIFACTS, out); assert.equal(env.QA_COMPAT_BACKEND, 'notice-click-20261031');
  assert.equal(env.QA_WEB_BUILD, path.join(out, 'web-current')); assert.equal(env.QA_APP_BUILD, path.join(out, 'app-current'));
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
}
const baseline = read('baseline.json'); assert.equal(baseline.numFailedTests, 12); assert.equal(baseline.numPassedTests, 5);
const unit = read('unit.json'); assert.equal(unit.success, true); assert.equal(unit.numPassedTests, 86);
assert.equal(unit.numFailedTests, 0); assert.equal(unit.numPendingTests, 0);
const tap = readFileSync(path.join(out, 'manual-final.tap'), 'utf8');
assert.match(tap, /# tests 54\b/); assert.match(tap, /# pass 54\b/); assert.match(tap, /# fail 0\b/);
const browser = read('browser.json'); assert.equal(browser.stats.expected, 9); assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0); assert.equal(browser.stats.flaky, 0); assert.deepEqual(browser.errors, []);
const proofFiles = readdirSync(path.join(out, 'browser'), { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => path.join(out, 'browser', entry.name, 'proof.json')).filter(existsSync);
assert.equal(proofFiles.length, 6);
const consoleErrors: string[] = [];
for (const file of proofFiles) {
  const proof = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(proof.synthetic, true); assert.equal(proof.pushSent, false); assert.equal(proof.systemClick, false);
  assert.equal(proof.workerHandlerSimulated, true); assert.equal(proof.navigationAwaited, true);
  assert.equal(proof.destinationOpenedAfterSimulation, true);
  assert.ok(Array.isArray(proof.consoleErrors)); consoleErrors.push(...proof.consoleErrors);
}
const update = read('update-browser.json'); assert.equal(update.stats.expected, 2); assert.equal(update.stats.unexpected, 0);
assert.equal(update.stats.skipped, 0); assert.equal(update.stats.flaky, 0); assert.deepEqual(update.errors, []);
const updateProofs = readdirSync(path.join(out, 'update-browser'), { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => path.join(out, 'update-browser', entry.name, 'proof.json'));
assert.equal(updateProofs.length, 2);
for (const file of updateProofs) {
  const proof = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(proof, { synthetic: true, oldShellRetainedWhileWaiting: true, draftEditableAfterUpdate: true, draftRecoveredAfterReload: true });
}
const manual = await fetch('http://127.0.0.1:4177/manual/directorio.html');
assert.equal(manual.status, 200);
assert.equal(sha(Buffer.from(await manual.arrayBuffer())), sha(readFileSync(path.join(root, 'docs/manual/directorio.html'))));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  for (const [i, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.11.97.${90 + i}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { productCommit: commit, synthetic: true, production: false, previousProductCommit: previous.productCommit, frontendBuildCommit: compiled,
    previousIntegratedCommit: previous.previousIntegratedCommit, previousIntegratedBrowserTests: previous.previousIntegratedBrowserTests,
    simulatedClickBrowserTests: 6, manualBrowserTests: 3, updateBrowserTests: 2, unitTests: 86, manualTests: 54,
    consoleErrors, realPushSent: false, systemClickVerified: false,
    capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false, androidVerified: false };
  writeFileSync(path.join(out, 'notice-click-audit.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
