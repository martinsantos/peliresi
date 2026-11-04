import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys, root } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-liveness-20261031', commit = 'af64384d8dd848898ffbed4e1c139d787271861e';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, 'liveness-20261031');
assert.equal(process.env.GITHUB_SHA, commit);
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const previous = JSON.parse(readFileSync('/work/sitrep/.qa-operational-ui-current2026103114/followup-cut-audit.json', 'utf8'));
assert.equal(previous.productCommit, 'dde430161d1f6cdc374f1a7999ff339e79182b82'); assert.equal(previous.browserTests, 37);
for (const stage of ['before', 'after']) {
  const network = read(`network-isolation-${stage}.json`);
  assert.deepEqual(network.networks, ['sitrep-qa-enterprise-net-20261016']); assert.equal(network.internal, true);
  assert.equal(network.publishedPorts, false); assert.equal(network.nanoCpus, 1000000000);
  assert.equal(network.memoryBytes, 2147483648); assert.equal(network.memorySwapBytes, 2147483648);
  const source = read(`source-${stage}.json`), qa = read(`qa-sources-${stage}.json`);
  assert.equal(source.commit, commit); assert.equal(source.stage, stage); assert.equal(source.files, 911);
  assert.deepEqual(source.missing, []); assert.deepEqual(source.different, []);
  assert.equal(qa.stage, stage); assert.equal(qa.matched, true); assert.ok(qa.files >= 74);
}
for (const [file, digest] of Object.entries(read('qa-digests.json') as Record<string, string>)) assert.equal(hash(readFileSync(path.join(root, file))), digest, file);
const reuse = read('source-reuse.json');
assert.equal(reuse.fromCommit, previous.productCommit); assert.equal(reuse.toCommit, commit);
assert.deepEqual(reuse.changedProductFiles, ['backend/src/middlewares/analytics.middleware.ts', 'docs/manual/directorio.html']);
assert.equal(hash(readFileSync(path.join(root, 'backend/src/middlewares/analytics.middleware.ts'))), reuse.backendSourceSha256);
const oldBackend = path.join(root, 'backend/dist-qa-followup-v2-20261031');
const newBackend = path.join(root, 'backend/dist-qa-liveness-20261031');
function compiled(dir: string, prefix = ''): string[] {
  return readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? compiled(dir, path.join(prefix, entry.name)) : entry.name.endsWith('.js') ? [path.join(prefix, entry.name)] : []).sort();
}
const files = compiled(oldBackend); assert.equal(files.length, 211); assert.deepEqual(compiled(newBackend), files);
assert.deepEqual(files.filter(file => !readFileSync(path.join(oldBackend, file)).equals(readFileSync(path.join(newBackend, file)))), ['middlewares/analytics.middleware.js']);
assert.ok(readFileSync(path.join(newBackend, 'middlewares/analytics.middleware.js')).equals(readFileSync(path.join(out, 'compiled/middlewares/analytics.middleware.js'))));
assert.match(read('runtime-proof.json').backend, /backend\/dist-qa-liveness-20261031\/index\.js$/);
for (const { pid } of read('processes.json')) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(env.QA_COMPAT_BACKEND, 'liveness-20261031');
  assert.equal(env.QA_WEB_BUILD, '/work/sitrep/.qa-operational-ui-current2026103114/web');
  assert.equal(env.QA_APP_BUILD, '/work/sitrep/.qa-operational-ui-current2026103114/app');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
  for (const key of externalKeys) assert.equal(env[key], '', key);
}
for (const variant of ['baseline', 'candidate']) {
  const result = read(`integration-${variant}.json`);
  assert.equal(result.synthetic, true); assert.equal(result.production, false);
  assert.deepEqual(result.livenessStatuses, [200, 200, 200, 429]);
  assert.equal(result.livenessAnalyticsRows, variant === 'baseline' ? 3 : 0);
  assert.equal(result.livenessDbCounterRows, 0); assert.equal(result.otherHealthAnalyticsRows, 2); assert.equal(result.otherHealthDbHits, 2);
  assert.equal(result.emailAttempts, 0); assert.equal(result.emailsSent, 0); assert.equal(result.pushEnabled, false);
}
const unit = read('unit.json'); assert.equal(unit.success, true); assert.equal(unit.numFailedTests, 0); assert.equal(unit.numPendingTests, 0);
assert.equal(unit.numPassedTests, 28);
const manualTests = readFileSync(path.join(out, 'manual-final.tap'), 'utf8');
const manualCount = Number(manualTests.match(/# tests (\d+)/)?.[1]);
assert.ok(manualCount >= 52); assert.equal(Number(manualTests.match(/# pass (\d+)/)?.[1]), manualCount); assert.match(manualTests, /# fail 0\b/);
const browser = read('liveness-ui.json'); assert.equal(browser.stats.expected, 2); assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0); assert.equal(browser.stats.flaky, 0); assert.deepEqual(browser.errors, []);
const directory = readFileSync(path.join(root, 'docs/manual/directorio.html'));
const response = await fetch('http://127.0.0.1:4177/manual/directorio.html');
assert.equal(response.status, 200); assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(directory));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const [i, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const r = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.11.99.${90 + i}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(r.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { productCommit: commit, synthetic: true, production: false, previousIntegratedCommit: previous.productCommit,
    previousBrowserTests: previous.browserTests, directedBrowserTests: 2, unitTests: unit.numPassedTests, manualTests: manualCount,
    baselineLivenessAnalytics: 3, candidateLivenessAnalytics: 0, capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false };
  writeFileSync(path.join(out, 'liveness-audit.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
