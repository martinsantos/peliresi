import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-evidence-focus-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.UPLOADS_DIR, path.join(out, 'uploads'));
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const fixture = read('fixture.json');
assert.equal(fixture.synthetic, true); assert.match(fixture.inspection.numero, /^QA-EVIDENCIA-/);
for (const { pid, file } of read('processes.json')) {
  assert.ok(['runtime.ts', 'server.ts'].includes(file));
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(env.TRAINING_DATABASE_URL, '');
  assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
  assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  assert.equal(env.MANIFEST_EXCEPTIONAL_ENABLED, 'true');
  assert.equal(env.MANIFEST_REVIEW_AUTHORITY_BY_ROLE, 'true');
  assert.equal(env.UPLOADS_DIR, path.join(out, 'uploads'));
  for (const key of externalKeys) assert.equal(env[key], '');
  if (file === 'server.ts') {
    assert.equal(env.QA_WEB_BUILD, path.join(out, 'web-reflow6'));
    assert.equal(env.QA_APP_BUILD, path.join(out, 'app-reflow6'));
  }
}
const unit = read('unit-reflow6.json');
assert.equal(unit.success, true); assert.equal(unit.numPassedTests, 175);
assert.equal(unit.numFailedTests, 0); assert.equal(unit.numPendingTests, 0); assert.equal(unit.numTodoTests, 0);
for (const file of ['InspectionEvidenceImage.test.tsx', 'MobileLayout.test.tsx', 'ModalKeyboardViewport.test.tsx',
  'NotificationBell.test.tsx', 'SupportBubble.test.tsx', 'ConfirmManifestClosure.test.tsx']) {
  assert.ok(unit.testResults.some((result: { name: string; status: string }) => result.name.endsWith(file) && result.status === 'passed'), file);
}
const manual = readFileSync(path.join(out, 'manual-tests.tap'), 'utf8');
assert.match(manual, /# tests 29\b/); assert.match(manual, /# pass 29\b/); assert.match(manual, /# fail 0\b/);
const browser = read('reflow6.json');
assert.equal(browser.stats.expected, 6); assert.equal(browser.stats.unexpected, 0); assert.equal(browser.stats.skipped, 0);
assert.deepEqual(browser.errors, []);
const roles = read('role-zoom-verified.json');
assert.equal(roles.stats.expected, 3); assert.equal(roles.stats.unexpected, 0); assert.equal(roles.stats.skipped, 0);
assert.deepEqual(roles.errors, []);
const manualSource = readFileSync('/work/sitrep/docs/manual/help-data.js');
const manualResponse = await fetch('http://127.0.0.1:4177/manual/help-data.js');
assert.equal(manualResponse.status, 200);
assert.equal(hash(Buffer.from(await manualResponse.arrayBuffer())), hash(manualSource));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const evidence = await db.evidenciaInspeccion.findUniqueOrThrow({ where: { id: fixture.evidence.id } });
  assert.equal(evidence.inspeccionId, fixture.inspection.id);
  assert.equal(evidence.descripcion, 'Imagen artificial de revisión');
  assert.equal(hash(readFileSync(path.join(out, 'uploads', evidence.storageKey))), evidence.sha256);
  const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const [index, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.11.48.${90 + index}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { synthetic: true, production: false, browserTests: 9, unitTests: unit.numPassedTests, manualTests: 29,
    emailAttempts: 0, emailsSent: 0, pushEnabled: false, capClosed: true, manualSha256: hash(manualSource) };
  writeFileSync(path.join(out, 'audit.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
