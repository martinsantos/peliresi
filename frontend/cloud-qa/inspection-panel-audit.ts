import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const out = process.env.QA_ARTIFACTS!;
assert.equal(out, '/work/sitrep/.qa-inspection-panel-20261030');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const processes = JSON.parse(readFileSync(path.join(out, 'processes.json'), 'utf8'));
assert.deepEqual(processes.map((process: { file: string }) => process.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(env.TRAINING_DATABASE_URL, '');
  assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
  assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const browser = JSON.parse(readFileSync(path.join(out, 'inspection-panel-e2e.json'), 'utf8'));
assert.equal(browser.stats.expected, 12); assert.equal(browser.stats.unexpected, 0); assert.equal(browser.stats.skipped, 0);
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
for (const name of ['help-data.js', 'directorio.html']) assert.equal(digest(path.join(out, 'manual', name)), digest(path.join('/work/sitrep/docs/manual', name)));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
  assert.equal(TRAINING_LOGINS.length, 4);
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.13.48.67' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const fixture = JSON.parse(readFileSync(path.join(out, 'inspection-panel-fixture.json'), 'utf8'));
  const byState = await db.inspeccion.groupBy({ by: ['estado'], where: { tipoActor: 'GENERADOR', generadorId: fixture.actors.generador2 }, _count: { estado: true } });
  const closed = byState.filter((row: any) => ['CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA'].includes(row.estado)).reduce((sum: number, row: any) => sum + row._count.estado, 0);
  const total = byState.reduce((sum: number, row: any) => sum + row._count.estado, 0);
  assert.equal(total, fixture.total); assert.equal(closed, fixture.closed); assert.equal(total - closed, fixture.open);
  const report = { source: process.env.GITHUB_SHA, synthetic: true, total, closed, open: total - closed, browserTests: 12,
    capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false, manualMatches: true };
  writeFileSync(path.join(out, 'inspection-panel-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
