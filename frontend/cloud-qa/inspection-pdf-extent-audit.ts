import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-pdf-extent-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const processes = read('processes.json');
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(env.TRAINING_DATABASE_URL, '');
  assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
  assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  assert.equal(env.QA_MANUAL_ROOT, out + '/manual');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
assert.equal(hash(path.join(out, 'compiled/services/inspectionFieldActPdf.service.js')),
  hash('/work/sitrep/backend/dist/services/inspectionFieldActPdf.service.js'));
assert.notEqual(hash(path.join(out, 'original-service.js')),
  hash('/work/sitrep/backend/dist/services/inspectionFieldActPdf.service.js'));
const source = read('source-comparison.json');
assert.equal(source.equal, true); assert.deepEqual(source.mismatches, []);
const browser = read('browser.json');
assert.equal(browser.stats.expected, 2); assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0); assert.deepEqual(browser.errors, []);
const tests = read('backend-tests.json');
assert.equal(tests.success, true); assert.equal(tests.numPassedTests, 32); assert.equal(tests.numFailedTests, 0);
assert.equal(tests.numPendingTests, 0); assert.equal(tests.numTodoTests, 0);
const manualTests = readFileSync(path.join(out, 'manual-tests.tap'), 'utf8');
assert.match(manualTests, /# tests 36\b/); assert.match(manualTests, /# pass 36\b/); assert.match(manualTests, /# fail 0\b/);
assert.equal(read('manual-served.json').servedMatchesSource, true);
const probe = read('corrected-release/probe.json');
assert.equal(probe.corrected, true); assert.equal(probe.documents.find((d: any) => d.name === 'acta').pages, 5);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const fixture = read('browser-fixture.json');
  assert.match(fixture.inspection.numero, /^QA-ACTA-EXTENSA-/);
  const record = await db.inspeccion.findUniqueOrThrow({ where: { id: fixture.inspection.id }, select: { numero: true } });
  assert.equal(record.numero, fixture.inspection.numero);
  const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const [index, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.46.29.${90 + index}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const audit = { synthetic: true, production: false, backendBase: 'ac4b11b5',
    substitutedService: 'inspectionFieldActPdf', sourceFiles: source.files, web: true, app: true,
    capClosed: true, emailsSent: 0, emailAttempts: 0, pushEnabled: false };
  writeFileSync(path.join(out, 'audit.json'), JSON.stringify(audit, null, 2));
  console.log(JSON.stringify(audit));
} finally { await db.$disconnect(); }
