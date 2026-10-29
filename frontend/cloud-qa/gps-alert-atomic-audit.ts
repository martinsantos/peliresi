import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const out = process.env.QA_ARTIFACTS!;
assert.equal(out, '/work/sitrep/.qa-gps-alert-atomic-fix-20261029');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const processes = JSON.parse(readFileSync(path.join(out, 'processes.json'), 'utf8'));
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(env.TRAINING_DATABASE_URL, '');
  assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const crash = read('gps-alert-atomic-crash-proof.json'), rollback = read('gps-alert-atomic-rollback-proof.json');
const http = read('gps-alert-atomic-http-proof.json');
assert.equal(crash.synthetic, true); assert.equal(crash.adminNotices, crash.activeAdmins);
assert.equal(rollback.insertFailureRolledBack, true); assert.equal(rollback.anomalyRows, 1);
assert.equal(http.ruleCases, 1); assert.equal(http.generatorInboxNotices, 1);
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const manual = digest('/work/sitrep/docs/manual/help-data.js');
assert.equal(digest(path.join(out, 'manual', 'help-data.js')), manual);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.22.97' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  const fixture = read('gps-anomaly-private.json');
  const rule = await db.reglaAlerta.findFirstOrThrow({ where: { nombre: 'QA regla GPS ' + fixture.manifest.numero } });
  assert.equal(rule.activa, false);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const proof = { source: process.env.GITHUB_SHA, synthetic: true, runtimeProcesses: processes.length,
    capClosed: true, emailAttempts: 0, emailsSent: 0, pushEnabled: false, temporaryRuleDisabled: true, manualSha256: manual };
  writeFileSync(path.join(out, 'gps-alert-atomic-audit.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
