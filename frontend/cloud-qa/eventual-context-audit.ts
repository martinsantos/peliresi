import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-eventual-context-20261030'; assert.equal(process.env.QA_ARTIFACTS, out);
const load = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const before = load('before-api.json'), after = load('after-api.json'), fixture = load('after-fixture.json');
assert.equal(before.synthetic, true); assert.equal(after.synthetic, true); assert.equal(fixture.synthetic, true);
assert.match(fixture.member, /@night-qa\.invalid$/); assert.equal(before.detail, 200); assert.equal(before.list, 200);
assert.equal(before.appearsInList, true); assert.equal(before.appearsInTracking, true); assert.equal(before.reconcile, 200); assert.equal(before.retry, 201);
assert.equal(after.detail, 404); assert.equal(after.list, 200); assert.equal(after.appearsInList, false);
assert.equal(after.tracking, 200); assert.equal(after.appearsInTracking, false); assert.equal(after.reconcile, 404);
assert.equal(after.retry, 409); assert.equal(after.authorized, 200); assert.equal(after.sameContextRetry, 201); assert.equal(after.revokedProfile, 403);
for (const [name, count] of [['unit-back.json', 91], ['unit-authority.json', 8], ['unit-front.json', 42]] as const) {
  const unit = load(name); assert.equal(unit.numPassedTests, count); assert.equal(unit.numFailedTests, 0); assert.equal(unit.numPendingTests, 0);
}
const browser = load('browser.json').stats; assert.equal(browser.expected, 2); assert.equal(browser.unexpected, 0); assert.equal(browser.skipped, 0);
const manualLog = readFileSync(path.join(out, 'manual-final.log'), 'utf8'); assert.match(manualLog, /# pass 32\b/); assert.match(manualLog, /# fail 0\b/);
const processes = load('processes.json'); assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.QA_COMPAT_BACKEND, 'eventual-context-after'); assert.equal(env.QA_WEB_BUILD, out + '/web-after'); assert.equal(env.QA_APP_BUILD, out + '/app-after');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const digest = (v: Buffer) => createHash('sha256').update(v).digest('hex');
const manual = readFileSync('/work/sitrep/docs/manual/help-data.js');
const served = await fetch('http://127.0.0.1:4177/manual/help-data.js'); assert.equal(served.status, 200);
assert.equal(digest(Buffer.from(await served.arrayBuffer())), digest(manual));
const baselineDir = '/work/sitrep/backend/dist-qa-eventual-site-20261030';
const candidateDir = '/work/sitrep/backend/dist-qa-eventual-context-20261030';
function files(root: string, folder = ''): string[] {
  return readdirSync(path.join(root, folder), { withFileTypes: true }).flatMap(item => item.isDirectory()
    ? files(root, path.join(folder, item.name)) : item.isFile() ? [path.join(folder, item.name)] : []);
}
const baselineFiles = files(baselineDir).sort(), candidateFiles = files(candidateDir).sort(); assert.deepEqual(candidateFiles, baselineFiles);
const changed = baselineFiles.filter(name => digest(readFileSync(path.join(baselineDir, name))) !== digest(readFileSync(path.join(candidateDir, name))));
assert.deepEqual(changed, ['controllers/manifiesto-excepcional.controller.js', 'controllers/seguimientoExterno.controller.js']);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: fixture.generatorGrantId } });
  assert.equal(grant.usuarioId, fixture.memberId); assert.equal(grant.activa, true); assert.equal(grant.revision, fixture.generatorGrantRevision);
  const row = await db.registroManifiestoExcepcional.findUniqueOrThrow({ where: { id: fixture.recordId } });
  assert.equal(row.creadoPorId, fixture.memberId); assert.equal(row.autorRol, 'GENERADOR'); assert.equal(row.version, 0);
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.99.1' }, body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const report = { synthetic: true, production: false, beforeCrossContextVisible: true, afterCrossContextHidden: true,
    sameContextRetry: true, grantRestored: true, browserPasses: 2, backendPasses: 91, authorityPasses: 8,
    frontendPasses: 42, manualPasses: 32, backendFilesCompared: baselineFiles.length, changedBackendFiles: changed,
    capClosed: true, emailAttempts: 0, emailsSent: 0, pushEnabled: false, manualSha256: digest(manual) };
  writeFileSync(path.join(out, 'audit.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
