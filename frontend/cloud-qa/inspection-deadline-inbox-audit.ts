import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-deadline-company-20261030';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, 'inspection-deadline-polished');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const suffix = ['2', '3', '4'].includes(process.env.QA_INBOX_RUN || '') ? '-' + process.env.QA_INBOX_RUN : '';
const report = read(`browser-inbox${suffix}.json`);
assert.equal(report.stats.expected, suffix === '-4' ? 8 : 2); assert.equal(report.stats.unexpected, 0); assert.equal(report.stats.skipped, 0);
assert.equal(report.stats.flaky, 0); assert.deepEqual(report.errors, []);
for (const proc of read('processes.json')) {
  const env = Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(entry => [entry.slice(0, entry.indexOf('=')), entry.slice(entry.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(env.QA_COMPAT_BACKEND, 'inspection-deadline-polished');
  assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const dist = path.join(root, 'backend/dist-qa-psip-deadline-company-20261030-v6');
const { TRAINING_LOGINS } = backendRequire(path.join(dist, 'lib/trainingDirectLogin.js'));
for (const { email } of TRAINING_LOGINS) {
  assert.match(email, /@capacitacion\.invalid$/);
  const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.85.95' },
    body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
  assert.equal(response.status, 403);
}
const direct = read('fixture-direct-polished.json'), authority = read('fixture-authority-polished.json');
assert.equal(direct.synthetic, true); assert.equal(authority.synthetic, true);
const db = backendRequire(path.join(dist, 'lib/prisma.js')).default;
try {
  for (const id of [direct.ruleId, authority.ruleId]) {
    const rule = await db.reglaAlerta.findUniqueOrThrow({ where: { id } });
    assert.ok(!rule.activa && /^QA vencimiento (directo|autoridad) /.test(rule.nombre));
  }
  const records = [...Object.values(direct.cases).flat(), ...Object.values(authority.cases)] as any[];
  assert.equal(records.length, 8);
  for (const item of records) {
    const inspection = await db.inspeccion.findUniqueOrThrow({ where: { id: item.inspectionId } });
    assert.match(inspection.numero, /^QA-DEADLINE-(DIRECT|AUTH)-/);
    assert.equal(await db.intercambioInspeccion.count({ where: { inspeccionId: item.inspectionId, tipo: 'RESPUESTA' } }), 1);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  writeFileSync(path.join(out, 'audit-inbox.json'), JSON.stringify({ synthetic: true, production: false, repeatedCases: 8,
    roles: ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'ADMIN'], surfaces: ['web-desktop', 'app'],
    capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false, qaRulesInactive: true }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('PASS auditoría: bandeja y campana de ocho casos artificiales, sin correos.');
} finally { await db.$disconnect(); }
