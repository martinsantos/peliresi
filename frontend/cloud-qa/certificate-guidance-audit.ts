import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys, root } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026103113';
const commit = '407cffd9c2e289443c24283a63da6edaf35ec9a6';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'certificate-guidance-20261031');
assert.equal(process.env.GITHUB_SHA, commit);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const prior = JSON.parse(readFileSync('/work/sitrep/.qa-operational-ui-current2026103112/closure-ce2-audit.json', 'utf8'));
assert.equal(prior.productCommit, 'ce2eb1cbe1eda468482bf10bc029636f47fd3857');
assert.equal(prior.synthetic, true); assert.equal(prior.browserTests, 37);
for (const stage of ['before', 'after']) {
  const source = read(`source-${stage}.json`), qa = read(`qa-sources-${stage}.json`);
  assert.equal(source.commit, commit); assert.equal(source.stage, stage); assert.equal(source.files, 911);
  assert.deepEqual(source.missing, []); assert.deepEqual(source.different, []);
  assert.equal(qa.stage, stage); assert.equal(qa.matched, true); assert.ok(qa.files >= 57);
}
for (const [file, digest] of Object.entries(read('qa-digests.json') as Record<string, string>)) {
  assert.equal(hash(readFileSync(path.join(root, file))), digest, file);
}
const backend = read('backend-reuse.json');
assert.equal(backend.fromCommit, 'a624b232bc3ca48a2f7e8582e8051170372070ed');
assert.equal(backend.toCommit, commit); assert.deepEqual(backend.changedBackendFiles, []);
assert.match(read('runtime-proof.json').backend, /backend\/dist-qa-support-mail-20261031\/index\.js$/);
const baseline = read('baseline-compiled-proof.json');
const baselineDir = path.join(root, 'backend/dist-qa-actor-overview-20261031');
const backendDir = path.join(root, 'backend/dist-qa-support-mail-20261031');
function compiledFiles(dir: string, prefix = ''): string[] {
  return readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? compiledFiles(dir, path.join(prefix, entry.name)) : entry.name.endsWith('.js') ? [path.join(prefix, entry.name)] : []).sort();
}
const compiled = compiledFiles(baselineDir), digest = createHash('sha256');
assert.equal(compiled.length, baseline.currentCount);
for (const file of compiled) digest.update(file + ' ' + hash(readFileSync(path.join(baselineDir, file))) + '\n');
assert.equal(digest.digest('hex'), baseline.compiledSha256); assert.deepEqual(compiledFiles(backendDir), compiled);
const changed = compiled.filter(file => !readFileSync(path.join(baselineDir, file)).equals(readFileSync(path.join(backendDir, file))));
assert.deepEqual(changed, ['controllers/support.controller.js', 'services/notification-mail.service.js']);
for (const file of changed) assert.ok(readFileSync(path.join(backendDir, file)).equals(readFileSync(path.join(root, '.qa-support-mail-20261031/compiled', file))));
const flags = ['MANIFEST_PROPOSALS_ENABLED', 'MANIFEST_EXCEPTIONAL_ENABLED', 'MANIFEST_ADDENDA_ENABLED',
  'MANIFEST_PARTY_REVIEW_ENABLED', 'MANIFEST_CERTIFICATES_ENABLED', 'MANIFEST_TRANSPORT_HANDOFF_ENABLED', 'TRANSPORT_MULTI_GPS_ENABLED'];
const frontendFlags = [...flags.map(key => `VITE_${key}`), 'VITE_ACTOR_MULTIROLE_ENABLED', 'VITE_ENTERPRISE_ENABLED'];
const build = read('build-flags.json'); assert.equal(build.candidate, commit);
for (const flag of frontendFlags) assert.equal(build.flags[flag], 'true', flag);
for (const { pid } of read('processes.json')) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(env.QA_COMPAT_BACKEND, 'certificate-guidance-20261031');
  assert.equal(env.QA_WEB_BUILD, path.join(out, 'web')); assert.equal(env.QA_APP_BUILD, path.join(out, 'app'));
  assert.equal(env.UPLOADS_DIR, path.join(out, 'uploads'));
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
  assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const flag of [...flags, ...frontendFlags]) assert.equal(env[flag], 'true', flag);
  for (const key of externalKeys) assert.equal(env[key], '');
}
const baseline = read('baseline-unit.json');
assert.equal(baseline.success, false); assert.equal(baseline.numFailedTests, 1);
const failures = baseline.testResults.flatMap((file: { assertionResults: Array<{ status: string; failureMessages: string[] }> }) =>
  file.assertionResults.filter(item => item.status === 'failed').flatMap(item => item.failureMessages));
assert.ok(failures.some((message: string) => message.includes('Publicación de certificación')));
const unit = read('unit.json'); assert.equal(unit.success, true); assert.equal(unit.numFailedTests, 0);
assert.ok(unit.numPassedTests >= 20);
const manual = readFileSync(path.join(out, 'manual.tap'), 'utf8');
const manualCount = Number(manual.match(/# tests (\d+)/)?.[1]);
assert.ok(manualCount >= 49); assert.equal(Number(manual.match(/# pass (\d+)/)?.[1]), manualCount); assert.match(manual, /# fail 0\b/);
const browser = read('manifest-complete.json');
assert.equal(browser.stats.expected, 2); assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0); assert.equal(browser.stats.flaky, 0); assert.deepEqual(browser.errors, []);
const receipts = read('receipts-verified.json'); assert.equal(receipts.results.length, 2);
assert.ok(receipts.results.every((r: { original: string; rectification: string; treatedFinding: string }) =>
  r.original === 'OBSERVADA' && r.rectification === 'APROBADA' && r.treatedFinding === 'Y12 1 kg'));
const dirs = readdirSync(path.join(out, 'manifest-complete'), { withFileTypes: true }).filter(entry => entry.isDirectory())
  .map(entry => path.join(out, 'manifest-complete', entry.name));
const proofs = dirs.map(dir => path.join(dir, 'complete-lifecycle.json')).filter(existsSync).map(file => JSON.parse(readFileSync(file, 'utf8')));
assert.deepEqual(proofs.map(proof => proof.surface).sort(), ['app', 'web-desktop']);
for (const dir of dirs.filter(dir => existsSync(path.join(dir, 'complete-lifecycle.json')))) {
  assert.ok(existsSync(path.join(dir, 'partial-finding-incomplete.png')));
  assert.ok(existsSync(path.join(dir, 'final-finding-incomplete.png')));
}
const help = readFileSync(path.join(root, 'docs/manual/help-data.js'));
const response = await fetch('http://127.0.0.1:4177/manual/help-data.js');
assert.equal(response.status, 200); assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(help));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const [i, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const login = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.11.71.${90 + i}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(login.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { productCommit: commit, synthetic: true, previousIntegratedCommit: prior.productCommit,
    previousIntegratedBrowserTests: prior.browserTests, browserTests: 2, unitTests: unit.numPassedTests,
    manualTests: manualCount, manualSha256: hash(help), baselineReproduced: true,
    capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false };
  writeFileSync(path.join(out, 'certificate-guidance-audit.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
