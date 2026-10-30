import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.SITREP_QA_RUN, 'legacy-integrity-20261030');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const out = process.env.QA_ARTIFACTS!, processes = JSON.parse(readFileSync(path.join(out, 'processes.json'), 'utf8'));
assert.deepEqual(processes.map((process: { file: string }) => process.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const browsers = JSON.parse(readFileSync(path.join(out, 'legacy-integrity-e2e.json'), 'utf8'));
assert.equal(browsers.stats.expected, 8); assert.equal(browsers.stats.unexpected, 0); assert.equal(browsers.stats.skipped, 0);
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
for (const file of ['help-data.js', 'directorio.html']) assert.equal(digest(path.join(out, 'manual', file)), digest(path.join('/work/sitrep/docs/manual', file)));
const fixture = JSON.parse(readFileSync(path.join(out, 'legacy-integrity-fixture.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const { TRAINING_LOGINS } = backendRequire('./dist/lib/trainingDirectLogin.js');
  for (const { email } of TRAINING_LOGINS) {
    assert.match(email, /@capacitacion\.invalid$/);
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.13.48.68' },
      body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
    assert.equal(response.status, 403);
  }
  for (const kind of ['missing','invalid','mismatch','origin','valid','ordinary','badEvidence']) {
    const current = await db.manifiesto.findUniqueOrThrow({ where: { id: fixture.cases[kind].id }, include: { eventos: true } });
    assert.equal(current.isDemoData, true); assert.equal(current.numero, fixture.cases[kind].numero);
    assert.equal(current.estado, ['mismatch','origin','valid','badEvidence'].includes(kind) ? 'APROBADO' : 'PENDIENTE_APROBACION');
    assert.equal(current.fechaRetiro, null); assert.equal(current.fechaRecepcion, null);
    assert.ok(!current.eventos.some((event: any) => ['RETIRO','RECEPCION_IN_SITU'].includes(event.tipo)));
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const report = { source: process.env.GITHUB_SHA, synthetic: true, legacyCases: 7, browserTests: 8,
    capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false, manualMatches: true };
  writeFileSync(path.join(out, 'legacy-integrity-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
