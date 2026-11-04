import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire, externalKeys } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-representative-20261030';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, 'inspection-company');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const read = (name: string) => JSON.parse(readFileSync(path.join(out, name), 'utf8'));
for (const proc of read('processes.json')) {
 const env = Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`, 'utf8').split('\0').filter(Boolean)
  .map(entry => [entry.slice(0, entry.indexOf('=')), entry.slice(entry.indexOf('=') + 1)]));
 assertCloudEnvironment(env); assert.equal(env.QA_COMPAT_BACKEND, 'inspection-company');
 assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), 'proposal_operations_20261021');
 assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
 assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
 assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
 assert.equal(env.ENTERPRISE_ENABLED, 'true');
 for (const key of externalKeys) assert.equal(env[key], '');
}
for (const [file, count] of [['browser-web-1.json', 1], ['browser-mobile-1.json', 2], ['browser-decisions-1.json', 3]] as const) {
 const report = read(file); assert.equal(report.stats.expected, count); assert.equal(report.stats.unexpected, 0);
 assert.equal(report.stats.skipped, 0); assert.equal(report.stats.flaky, 0); assert.deepEqual(report.errors, []);
}
const { TRAINING_LOGINS } = backendRequire('./dist-qa-psip-company-20261030-v2/lib/trainingDirectLogin.js');
for (const { email } of TRAINING_LOGINS) {
 assert.match(email, /@capacitacion\.invalid$/);
 const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.83.99' },
  body: JSON.stringify({ email, password: 'expired-qa-probe' }) });
 assert.equal(response.status, 403);
}
const fixture = read('inspection-company-fixture.json'), decisions = read('inspection-company-decisions.json');
assert.match(fixture.email, /@night-qa\.invalid$/);
const { PrismaClient } = backendRequire('@prisma/client'); const db = new PrismaClient();
try {
 const member = await db.usuario.findUniqueOrThrow({ where: { email: fixture.email } });
 const results: Array<{ surface: string; role: string; exchanges: number; notices: number }> = [];
 for (const surface of ['web-desktop', 'web-responsive', 'app']) {
  assert.equal(fixture.cases[surface].length, 3); assert.equal(decisions.cases[surface].length, 3);
  for (const item of fixture.cases[surface]) {
   const record = await db.inspeccion.findUniqueOrThrow({ where: { id: item.id } });
   assert.match(record.numero, /^QA-PSIP-REP-/);
   const exchanges = await db.intercambioInspeccion.findMany({ where: { inspeccionId: item.id }, orderBy: { secuencia: 'asc' } });
   assert.deepEqual(exchanges.map((e: any) => e.tipo), ['REQUERIMIENTO', 'RESPUESTA', item.role === 'OPERADOR' ? 'DERIVACION_LEGALES' : 'CIERRE_CONFORME']);
   const rows = await db.notificacion.findMany({ where: { usuarioId: member.id, OR: [
    { datos: { contains: exchanges[0].id } }, { datos: { contains: exchanges[2].id } },
   ] } });
   assert.equal(rows.length, 2); assert.ok(rows.every((n: any) => !JSON.stringify(n).includes(record.numero)));
   const submitted = await db.notificacion.findMany({ where: { datos: { contains: exchanges[1].id } } });
   assert.ok(submitted.some((n: any) => n.usuarioId !== member.id));
   assert.ok(!submitted.some((n: any) => n.usuarioId === member.id));
   results.push({ surface, role: item.role, exchanges: exchanges.length, notices: rows.length });
  }
 }
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 writeFileSync(path.join(out, 'inspection-company-audit.json'), JSON.stringify({ synthetic: true, production: false,
  capClosed: true, emailAttempts: 0, emailSent: 0, pushEnabled: false, results }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
 console.log('PASS auditoría PSIP: nueve circuitos, decisiones y avisos; CAP cerrado y cero correos en la base artificial.');
} finally { await db.$disconnect(); }
