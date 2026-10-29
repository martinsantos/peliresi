import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const out = process.env.QA_ARTIFACTS!;
assert.equal(out, '/work/sitrep/.qa-toast-compact-fix-20261029');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const processes = JSON.parse(readFileSync(path.join(out, 'processes.json'), 'utf8'));
assert.deepEqual(processes.map((p: { file: string }) => p.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.TRAINING_DATABASE_URL, '');
  assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
  assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const duration = JSON.parse(readFileSync(path.join(out, 'transit-duration-http-proof.json'), 'utf8'));
assert.equal(duration.synthetic, true);
assert.equal(duration.automaticDefaultAlerts, 0);
assert.equal(duration.legacyUnboundedAlerts, 0);
assert.equal(duration.beforeThreshold, 0);
assert.equal(duration.afterThreshold, 1);
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const manualSource = digest('/work/sitrep/docs/manual/help-data.js');
assert.equal(digest(path.join(out, 'manual', 'help-data.js')), manualSource);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const report = { source: process.env.GITHUB_SHA, synthetic: true, runtimeProcesses: processes.length,
    capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false,
    durationOnlyConfigured: true, manualSha256: manualSource };
  writeFileSync(path.join(out, 'cut-final-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
