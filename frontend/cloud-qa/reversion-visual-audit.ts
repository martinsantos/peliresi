import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026102944';
assert.equal(process.env.QA_ARTIFACTS, out);
const read = (file: string) => JSON.parse(readFileSync(path.join(out, file), 'utf8'));
const processes = read('processes.json');
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
 const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
  .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
 assertCloudEnvironment(env);
 assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
 assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
 assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
 assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false'); assert.equal(env.MANIFEST_PROPOSALS_ENABLED, 'true');
 for (const key of externalKeys) assert.equal(env[key], '');
}
for (const [file, count] of [['reversion-browser-results.json', 8], ['manifest-complete.json', 2]] as const) {
 const report = read(file); assert.equal(report.stats.expected, count, file); assert.equal(report.stats.skipped, 0, file);
 assert.equal(report.stats.unexpected, 0, file); assert.equal(report.stats.flaky, 0, file); assert.deepEqual(report.errors, [], file);
}
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const manualSha256 = digest('/work/sitrep/docs/manual/help-data.js');
assert.equal(digest(path.join(out, 'manual', 'help-data.js')), manualSha256);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
 const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
 for (const { email } of TRAINING_LOGINS) {
  assert.match(email, /@capacitacion\.invalid$/);
  const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
   headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.13.25.98' },
   body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
  assert.equal(response.status, 403);
 }
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 const result = { source: process.env.GITHUB_SHA, synthetic: true, runtimeProcesses: processes.length,
  correctionBrowserJourneys: 8, earlierFullLifecycleJourneys: 2, manualSha256,
  capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false };
 writeFileSync(path.join(out, 'reversion-visual-final-audit.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
