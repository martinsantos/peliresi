import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-corridor-relay-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
for (const { pid } of read('processes.json')) {
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
const source = read('source-comparison.json');
assert.equal(source.equal, true); assert.deepEqual(source.mismatches, []);
for (const name of ['corridor-relay-browser.json', 'gps-corridor-context-browser.json']) {
  const report = read(name);
  assert.equal(report.stats.expected, 2); assert.equal(report.stats.unexpected, 0);
  assert.equal(report.stats.skipped, 0); assert.deepEqual(report.errors, []);
}
assert.equal(read('manual-served.json').servedMatchesSource, true);
const proof = read('corridor-relay-http-proof.json');
assert.equal(proof.checks.length, 2);
for (const item of proof.checks) {
  assert.equal(item.noEarlyNotice, true); assert.equal(item.direct, true); assert.equal(item.configured, true);
  assert.equal(item.retryDeduplicated, true); assert.equal(item.inventedIncidentAuthor, false);
}
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  // Disable only the uniquely named rules created by the original-carrier test.
  const fixture = read('gps-corridor-context-fixture.json');
  for (const item of Object.values(fixture.cases) as Array<any>) {
    assert.match(item.numero, /^QA-CORRIDOR-/);
    assert.match(item.liveRule, /^QA corredor vigente [a-f0-9]{8}-[01]$/);
    const rule = await db.reglaAlerta.findFirstOrThrow({ where: { nombre: item.liveRule } });
    assert.match(rule.condicion, new RegExp(item.id));
    await db.reglaAlerta.update({ where: { id: rule.id }, data: { activa: false } });
  }
  const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const [index, { email }] of TRAINING_LOGINS.entries()) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.46.28.${90 + index}` },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const audit = { synthetic: true, production: false, sourceFiles: source.files, web: true, app: true,
    capClosed: true, emailsSent: 0, emailAttempts: 0, pushEnabled: false, artificialRulesDisabled: true };
  writeFileSync(path.join(out, 'corridor-relay-audit.json'), JSON.stringify(audit, null, 2));
  console.log(JSON.stringify(audit));
} finally { await db.$disconnect(); }
