import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-eventual-notices-20261030'; assert.equal(process.env.QA_ARTIFACTS, out);
const load = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const fixture = load('fixture.json'), integration = load('integration.json');
assert.equal(fixture.synthetic, true); assert.equal(integration.synthetic, true);
assert.match(fixture.member, /@night-qa\.invalid$/); assert.match(fixture.owner, /@night-qa\.invalid$/);
for (const name of ['oneNoticePerPerson', 'approvalNotice', 'movementNoticeOtherRole', 'revokeOnePreservesOther', 'revokeBothMasksDetailListAndMark',
 'limitedSiteReceivesNoNotice', 'revokedMultiRoleMasked', 'mailEligibilityRechecked', 'renderedMailOnly', 'emailAndPushDisabled']) assert.equal(integration[name], true);
assert.equal(integration.sameActivityRetry, 200); assert.equal(integration.otherActivityRetry, 409);
const browser = load('browser.json').stats; assert.equal(browser.expected, 12); assert.equal(browser.unexpected, 0); assert.equal(browser.skipped, 0);
const bell = load('bell-browser.json').stats; assert.equal(bell.expected, 2); assert.equal(bell.unexpected, 0); assert.equal(bell.skipped, 0);
const manualLog = readFileSync(path.join(out, 'manual-unit.log'), 'utf8'); assert.match(manualLog, /# pass 32\b/); assert.match(manualLog, /# fail 0\b/);
const processes = load('processes.json'); assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
 const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
 assertCloudEnvironment(env); assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
 assert.equal(env.QA_COMPAT_BACKEND, 'eventual-notice-after'); assert.equal(env.QA_WEB_BUILD, out + '/web-final3'); assert.equal(env.QA_APP_BUILD, out + '/app-final3');
 assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
 assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
 assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
 for (const key of externalKeys) assert.equal(env[key], '');
}
const digest = (v: Buffer) => createHash('sha256').update(v).digest('hex');
const manual = readFileSync('/work/sitrep/docs/manual/help-data.js');
const served = await fetch('http://127.0.0.1:4177/manual/help-data.js'); assert.equal(served.status, 200);
assert.equal(digest(Buffer.from(await served.arrayBuffer())), digest(manual));
const baseline = '/work/sitrep/backend/dist-qa-eventual-context-20261030', candidate = '/work/sitrep/backend/dist-qa-eventual-notices-20261030';
function files(root: string, folder = ''): string[] {
 return readdirSync(path.join(root, folder), { withFileTypes: true }).flatMap(item => item.isDirectory()
  ? files(root, path.join(folder, item.name)) : item.isFile() ? [path.join(folder, item.name)] : []);
}
const beforeFiles = files(baseline).sort(), afterFiles = files(candidate).sort();
assert.deepEqual(afterFiles.filter(name => !beforeFiles.includes(name)), ['services/eventualNoticeContext.service.js']);
assert.deepEqual(beforeFiles.filter(name => !afterFiles.includes(name)), []);
const changed = beforeFiles.filter(name => digest(readFileSync(path.join(baseline, name))) !== digest(readFileSync(path.join(candidate, name))));
assert.deepEqual(changed, ['controllers/manifiesto-excepcional.controller.js', 'services/eventualNotice.service.js', 'services/manifestRuleCompanyNotice.service.js', 'services/notification-mail.service.js']);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
 for (const [id, revision] of [[fixture.generatorGrantId, fixture.generatorGrantRevision], [fixture.operatorGrantId, fixture.operatorGrantRevision]]) {
  const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id } });
  assert.equal(grant.usuarioId, fixture.memberId); assert.equal(grant.activa, true); assert.equal(grant.todosEstablecimientos, true); assert.equal(grant.revision, revision);
 }
 const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
 for (const { email } of TRAINING_LOGINS) {
  assert.match(email, /@capacitacion\.invalid$/);
  const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.99.2' }, body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
  assert.equal(response.status, 403);
 }
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 const report = { synthetic: true, production: false, browserPasses: 12, manualPasses: 32, backendFilesCompared: beforeFiles.length,
  changedBackendFiles: changed, addedBackendFiles: ['services/eventualNoticeContext.service.js'], controllerUnchanged: true,
  grantRestored: true, capClosed: true, emailAttempts: 0, emailsSent: 0, pushEnabled: false, manualSha256: digest(manual) };
 writeFileSync(path.join(out, 'audit.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
