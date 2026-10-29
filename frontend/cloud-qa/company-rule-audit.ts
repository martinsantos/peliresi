import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const directory = process.env.QA_ARTIFACTS!, { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
 const processes = JSON.parse(readFileSync(path.join(directory, 'processes.json'), 'utf8'));
 assert.equal(processes.length, 2);
 for (const proc of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`, 'utf8').split('\0').filter(Boolean)
   .map(item => [item.slice(0, item.indexOf('=')), item.slice(item.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  const url = new URL(env.DATABASE_URL);
  assert.equal(url.searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(url.searchParams.get('connection_limit'), '4');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
  assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
 }
 const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
 assert.equal(TRAINING_LOGINS.length, 4);
 for (const { email } of TRAINING_LOGINS) {
  assert.match(email, /@capacitacion\.invalid$/);
  const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
   headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.55.99' },
   body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
  assert.equal(response.status, 403);
 }
 const attempts = await db.emailQueue.count({ where: { intentos: { gt: 0 } } });
 const sent = await db.emailQueue.count({ where: { sentAt: { not: null } } });
 assert.equal(attempts, 0); assert.equal(sent, 0);
 const report = { synthetic: true, runtimeProcesses: 2, capAliasesClosed: 4, emailsDisabled: true, pushDisabled: true,
  smtpAndPushKeysEmpty: true, emailAttempts: attempts, emailSent: sent, databaseConnectionLimitPerProcess: 4 };
 writeFileSync(path.join(directory, 'company-rule-audit.json'), JSON.stringify(report, null, 2));
 console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
