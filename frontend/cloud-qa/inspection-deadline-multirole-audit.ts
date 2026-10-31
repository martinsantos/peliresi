import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-deadline-company-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'inspection-deadline-company-after');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
const report = read('browser-multirole.json');
assert.equal(report.stats.expected, 2);
assert.equal(report.stats.unexpected, 0);
assert.equal(report.stats.skipped, 0);
assert.equal(report.stats.flaky, 0);
assert.deepEqual(report.errors, []);
for (const proc of read('processes.json')) {
  const env = Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(entry => [entry.slice(0, entry.indexOf('=')), entry.slice(entry.indexOf('=') + 1)]));
  assertCloudEnvironment(env);
  assert.equal(env.QA_COMPAT_BACKEND, 'inspection-deadline-company-after');
  assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(env.TRAINING_DATABASE_URL, '');
  assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
  assert.equal(env.DISABLE_EMAILS, 'true');
  assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
  assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
  for (const key of externalKeys) assert.equal(env[key], '');
}
const dist = path.join(root, 'backend/dist-qa-psip-deadline-company-20261030-v3');
const { TRAINING_LOGINS } = backendRequire(path.join(dist, 'lib/trainingDirectLogin.js'));
for (const { email } of TRAINING_LOGINS) {
  assert.match(email, /@capacitacion\.invalid$/);
  const response = await fetch('http://127.0.0.1:4177/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.85.98' },
    body: JSON.stringify({ email, password: 'expired-qa-probe' }),
  });
  assert.equal(response.status, 403);
}
const fixture = read('fixture-multirole.json');
assert.equal(fixture.synthetic, true);
assert.equal(fixture.email, 'draft-multirole-20261024@night-qa.invalid');
const db = backendRequire(path.join(dist, 'lib/prisma.js')).default;
try {
  const user = await db.usuario.findUniqueOrThrow({ where: { email: fixture.email } });
  assert.equal(user.rol, 'GENERADOR');
  const rule = await db.reglaAlerta.findUniqueOrThrow({ where: { id: fixture.ruleId } });
  assert.ok(rule.activa && rule.nombre.startsWith('QA vencimiento multirrol '));
  const cases = Object.values(fixture.cases) as any[];
  assert.equal(cases.length, 2);
  assert.equal(await db.alertaGenerada.count({ where: { reglaId: rule.id } }), 2);
  for (const item of cases) {
    const inspection = await db.inspeccion.findUniqueOrThrow({ where: { id: item.inspectionId } });
    assert.match(inspection.numero, /^QA-DEADLINE-MULTI-/);
    const notice = await db.notificacion.findUniqueOrThrow({ where: { id: item.noticeId } });
    assert.equal(notice.usuarioId, user.id);
    assert.equal(JSON.parse(notice.datos).tipoActor, 'OPERADOR');
    assert.equal(await db.intercambioInspeccion.count({ where: { inspeccionId: item.inspectionId, tipo: 'RESPUESTA' } }), 0);
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  await db.reglaAlerta.update({ where: { id: rule.id }, data: { activa: false } });
  writeFileSync(path.join(out, 'audit-multirole.json'), JSON.stringify({ synthetic: true, production: false,
    activity: 'OPERADOR', baseRole: 'GENERADOR', browserRuns: 2, capClosed: true, emailAttempts: 0,
    emailSent: 0, pushEnabled: false, qaRuleDeactivated: true }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('PASS auditoría: actividad secundaria en web y app; regla artificial desactivada; sin correos.');
} finally {
  await db.$disconnect();
}
