import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-deadline-company-20261030';
const run = process.env.QA_DIRECT_RUN || ''; assert.ok(['', 'final', 'polished'].includes(run));
const suffix = run ? '-' + run : '';
const backend = run === 'polished' ? 'inspection-deadline-polished' : run === 'final' ? 'inspection-deadline-authority' : 'inspection-deadline-direct';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, backend);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const report = read(`browser-direct${suffix}.json`);
assert.equal(report.stats.expected, 2); assert.equal(report.stats.unexpected, 0); assert.equal(report.stats.skipped, 0);
assert.equal(report.stats.flaky, 0); assert.deepEqual(report.errors, []);
for (const proc of read('processes.json')) {
  const env = Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(entry => [entry.slice(0, entry.indexOf('=')), entry.slice(entry.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(env.QA_COMPAT_BACKEND, backend);
  assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const dist = path.join(root, 'backend/dist-qa-psip-deadline-company-20261030-' + (run === 'polished' ? 'v6' : run === 'final' ? 'v5' : 'v4'));
const { TRAINING_LOGINS } = backendRequire(path.join(dist, 'lib/trainingDirectLogin.js'));
for (const { email } of TRAINING_LOGINS) {
  assert.match(email, /@capacitacion\.invalid$/);
  const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.85.97' },
    body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
  assert.equal(response.status, 403);
}
const fixture = read(`fixture-direct${suffix}.json`); assert.equal(fixture.synthetic, true);
const db = backendRequire(path.join(dist, 'lib/prisma.js')).default;
try {
  const rule = await db.reglaAlerta.findUniqueOrThrow({ where: { id: fixture.ruleId } });
  assert.ok(rule.activa && rule.nombre.startsWith('QA vencimiento directo '));
  const records = Object.values(fixture.cases).flat() as any[]; assert.equal(records.length, 6);
  assert.equal(await db.alertaGenerada.count({ where: { reglaId: rule.id } }), 6);
  for (const item of records) {
    assert.match(item.email, /^psip-owner-.*@night-qa\.invalid$/);
    const inspection = await db.inspeccion.findUniqueOrThrow({ where: { id: item.inspectionId } });
    assert.match(inspection.numero, /^QA-DEADLINE-DIRECT-/);
    const entries = await db.intercambioInspeccion.findMany({ where: { inspeccionId: item.inspectionId }, orderBy: { secuencia: 'asc' } });
    assert.deepEqual(entries.map((entry: any) => entry.tipo), ['REQUERIMIENTO', 'RESPUESTA']);
    const itemCase = await db.alertaGenerada.findUniqueOrThrow({ where: { id: item.caseId } });
    assert.equal(itemCase.estado, 'PENDIENTE'); // The corrected view did not wait for the reconciliation job.
    const notice = await db.notificacion.findUniqueOrThrow({ where: { id: item.noticeId } });
    assert.equal(notice.usuarioId, item.ownerId);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  await db.reglaAlerta.update({ where: { id: rule.id }, data: { activa: false } });
  writeFileSync(path.join(out, `audit-direct${suffix}.json`), JSON.stringify({ synthetic: true, production: false,
    cases: 6, roles: ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'], surfaces: ['web-desktop', 'app'],
    responses: 6, casesStillPendingBeforeSweep: 6, capClosed: true, emailAttempts: 0, emailSent: 0,
    pushEnabled: false, qaRuleDeactivated: true }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('PASS auditoría: seis respuestas y seis avisos actualizados antes del barrido; sin correos.');
} finally { await db.$disconnect(); }
