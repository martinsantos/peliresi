import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-eventual-site-20261030'; assert.equal(process.env.QA_ARTIFACTS, out);
const load = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const fixture = load('fixture.json'), before = load('before-api.json'), after = load('after-api.json');
assert.equal(fixture.synthetic, true); assert.equal(before.synthetic, true); assert.equal(after.synthetic, true);
assert.match(fixture.owner, /@night-qa\.invalid$/); assert.match(fixture.member, /@night-qa\.invalid$/);
for (const key of ['detail', 'list', 'tracking', 'reconcile', 'decision']) { assert.equal(before[key], 200); assert.equal(after[key], 403); }
assert.equal(before.containsSouthRecord, true); assert.equal(before.resultingVersion, 1); assert.equal(after.resultingVersion, 0);
assert.equal(before.siteStored, false); assert.equal(after.siteStored, false); assert.equal(after.fullAccess, 200);
assert.equal(before.memberNotices, 0); assert.equal(after.memberNotices, 0);
const multirole = load('multirol-gap.json');
assert.equal(multirole.synthetic, true); assert.equal(multirole.ownerBaseRole, 'GENERADOR');
assert.equal(multirole.involvedRole, 'OPERADOR'); assert.equal(multirole.detail, 200); assert.equal(multirole.notices, 0);
const representative = load('representative-gap.json');
assert.equal(representative.synthetic, true); assert.equal(representative.fullCompanyAccess, true);
assert.equal(representative.detail, 200); assert.equal(representative.representativeNotices, 0); assert.equal(representative.ownerNotices, 1);
assert.equal(load('grant-restored.json').restored, true);
for (const [name, expected] of [['unit-back-after.json', 82], ['unit-authority-after.json', 8], ['unit-front-after.json', 41]] as const) {
  const unit = load(name); assert.equal(unit.numPassedTests, expected); assert.equal(unit.numFailedTests, 0); assert.equal(unit.numPendingTests, 0);
}
const browser = load('browser.json').stats; assert.equal(browser.expected, 4); assert.equal(browser.unexpected, 0); assert.equal(browser.skipped, 0);
const manualLog = readFileSync(path.join(out, 'manual-final.log'), 'utf8'); assert.match(manualLog, /# pass 32\b/); assert.match(manualLog, /# fail 0\b/);
const processes = load('processes.json'); assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.QA_COMPAT_BACKEND, 'eventual-site-after'); assert.equal(env.QA_WEB_BUILD, out + '/web-after'); assert.equal(env.QA_APP_BUILD, out + '/app-after');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const digest = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const manual = readFileSync('/work/sitrep/docs/manual/help-data.js');
const served = await fetch('http://127.0.0.1:4177/manual/help-data.js'); assert.equal(served.status, 200);
assert.equal(digest(Buffer.from(await served.arrayBuffer())), digest(manual));
const baselineDir = '/work/sitrep/backend/dist-qa-receipt-document-20261030';
const candidateDir = '/work/sitrep/backend/dist-qa-eventual-site-20261030';
function files(root: string, folder = ''): string[] {
  return readdirSync(path.join(root, folder), { withFileTypes: true }).flatMap(item => item.isDirectory()
    ? files(root, path.join(folder, item.name)) : item.isFile() ? [path.join(folder, item.name)] : []);
}
const baselineFiles = files(baselineDir).sort(), candidateFiles = files(candidateDir).sort();
assert.deepEqual(candidateFiles, baselineFiles);
const changed = baselineFiles.filter(name => digest(readFileSync(path.join(baselineDir, name))) !== digest(readFileSync(path.join(candidateDir, name))));
assert.deepEqual(changed, ['controllers/manifiesto-excepcional.controller.js']);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: fixture.grantId } });
  assert.equal(grant.usuarioId, fixture.memberId); assert.equal(grant.todosEstablecimientos, fixture.original.todosEstablecimientos);
  assert.deepEqual(grant.establecimientoIds, fixture.original.establecimientoIds); assert.equal(grant.revision, fixture.original.revision);
  const ownerGrant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: fixture.activityId, usuarioId: fixture.ownerId } } });
  assert.equal(ownerGrant.activa, true); assert.equal(ownerGrant.todosEstablecimientos, true);
  assert.equal((await db.registroManifiestoExcepcional.findUniqueOrThrow({ where: { id: before.adminId } })).version, 1);
  assert.equal((await db.registroManifiestoExcepcional.findUniqueOrThrow({ where: { id: after.adminId } })).version, 0);
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.95.1' }, body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const report = { synthetic: true, production: false, beforeUnauthorizedDecision: true, afterBlockedEndpoints: 5,
    authorizedAccess: true, browserPasses: 4, backendPasses: 82, authorityPasses: 8, frontendPasses: 41,
    manualPasses: 32, backendFilesCompared: baselineFiles.length, changedBackendFiles: changed,
    grantRestored: true, multiroleNoticeGap: true, representativeNoticeGap: true,
    capClosed: true, emailAttempts: 0, emailsSent: 0, pushEnabled: false, manualSha256: digest(manual) };
  writeFileSync(path.join(out, 'audit.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
