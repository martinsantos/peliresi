import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-receipt-document-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
const fixture = JSON.parse(readFileSync(path.join(out, 'fixture-after.json'), 'utf8'));
assert.equal(fixture.synthetic, true); assert.match(fixture.owner, /@night-qa\.invalid$/);
const processes = JSON.parse(readFileSync(path.join(out, 'processes.json'), 'utf8'));
assert.deepEqual(processes.map((item: { file: string }) => item.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.QA_COMPAT_BACKEND, 'receipt-document-after');
  assert.equal(env.QA_WEB_BUILD, `${out}/web-final`); assert.equal(env.QA_APP_BUILD, `${out}/app-final`);
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const baseline = JSON.parse(readFileSync(path.join(out, 'before.json'), 'utf8')).stats;
const result = JSON.parse(readFileSync(path.join(out, 'after.json'), 'utf8')).stats;
assert.equal(baseline.unexpected, 2); assert.equal(baseline.expected, 0); assert.equal(baseline.skipped, 0);
assert.equal(result.expected, 14); assert.equal(result.unexpected, 0); assert.equal(result.skipped, 0);
const preference = JSON.parse(readFileSync(path.join(out, 'preference.json'), 'utf8')).stats;
assert.equal(preference.expected, 4); assert.equal(preference.unexpected, 0); assert.equal(preference.skipped, 0);
for (const name of ['frontend-final', 'backend-final']) {
  const test = JSON.parse(readFileSync(path.join(out, name + '.json'), 'utf8'));
  assert.equal(test.numFailedTests, 0); assert.equal(test.numPendingTests, 0); assert.equal(test.numPassedTests, test.numTotalTests);
}
const source = JSON.parse(readFileSync(path.join(out, 'backend-source-proof.json'), 'utf8'));
assert.equal(source.baseline, '67f330a7'); assert.equal(source.otherChanges, 0); assert.ok(source.compilationRoots > 100);
const manual = readFileSync('/work/sitrep/docs/manual/help-data.js');
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const served = await fetch('http://127.0.0.1:4177/manual/help-data.js'); assert.equal(served.status, 200);
assert.equal(digest(Buffer.from(await served.arrayBuffer())), digest(manual));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const owner = await db.usuario.findUniqueOrThrow({ where: { email: fixture.owner } });
  assert.equal(owner.preferenciaEnlaces, 'AUTO', 'Restore the synthetic account preference after the browser tests');
  const application = await db.solicitudInscripcion.findUniqueOrThrow({ where: { id: fixture.operator } });
  const document = await db.documentoSolicitud.findUniqueOrThrow({ where: { id: fixture.document } });
  assert.equal(application.usuarioId, owner.id); assert.equal(document.solicitudId, application.id);
  const { TRAINING_LOGINS } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'lib/trainingDirectLogin.js'));
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.22.97' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const report = { synthetic: true, production: false, beforeBrowserFailures: 2, afterBrowserPasses: 14, preferenceBrowserPasses: 4,
    capClosed: true, emailAttempts: 0, emailsSent: 0, pushEnabled: false, manualSha256: digest(manual) };
  writeFileSync(path.join(out, 'audit.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
