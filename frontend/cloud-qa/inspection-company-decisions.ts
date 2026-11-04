import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-representative-20261030';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, 'inspection-company');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.ENTERPRISE_ENABLED, 'true'); assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const fixture = JSON.parse(readFileSync(out + '/inspection-company-fixture.json', 'utf8'));
assert.match(fixture.email, /@night-qa\.invalid$/);
const { PrismaClient } = backendRequire('@prisma/client'); const db = new PrismaClient();
const base = 'http://127.0.0.1:3037/api';
async function request(token: string | null, route: string, body?: unknown, headers: Record<string, string> = {}) {
 const response = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: {
  ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers,
 }, ...(body ? { body: JSON.stringify(body) } : {}) });
 const raw = await response.text(); return { status: response.status, data: raw ? JSON.parse(raw).data : null, raw };
}
async function login(email: string, octet: number) {
 assert.match(email, /@night-qa\.invalid$/);
 const result = await request(null, '/auth/login', { email, password: 'OnlyLocal-NightQA-2026!' }, { Cookie: `sitrep_qa_client=127.11.82.${octet}` });
 assert.equal(result.status, 200); return result.data.tokens.accessToken as string;
}
try {
 const [admin, member] = await Promise.all([login('admin@night-qa.invalid', 1), login(fixture.email, 2)]);
 const memberUser = await db.usuario.findUniqueOrThrow({ where: { email: fixture.email } });
 const before = await db.emailQueue.count({ where: { OR: [{ intentos: { gt: 0 } }, { sentAt: { not: null } }] } });
 const results: Record<string, any[]> = {};
 for (const surface of ['web-desktop', 'web-responsive', 'app']) {
  results[surface] = [];
  for (const item of fixture.cases[surface]) {
   const current = await request(admin, `/inspecciones/${item.id}/intercambios`);
   assert.equal(current.status, 200); assert.match(current.data.inspeccion.numero, /^QA-PSIP-REP-/);
   assert.equal(current.data.intercambios.filter((entry: any) => entry.parte === 'INSPECCIONADO').length, 1);
   const legal = item.role === 'OPERADOR';
   const result = await request(admin, `/inspecciones/${item.id}/intercambios/decision`, {
    version: current.data.inspeccion.version, clienteId: 'qa-psip-decision-' + randomUUID(),
    decision: legal ? 'DERIVADA_LEGALES' : 'CERRADA_CONFORME',
    fundamento: 'QA decisión artificial para comprobar el aviso de la persona representante.',
   });
   assert.equal(result.status, 200, result.raw);
   const decisionId = result.data.id as string;
   const rows = await db.notificacion.findMany({ where: { usuarioId: memberUser.id, datos: { contains: decisionId } } });
   assert.equal(rows.length, 1);
   const notice = await request(member, '/notificaciones/' + rows[0].id);
   assert.equal(notice.status, 200); assert.equal(notice.data.titulo, 'PSIP · ' + (legal ? 'Derivación a Legales' : 'Cierre conforme'));
   const data = JSON.parse(notice.data.datos);
   assert.equal(data.inspeccionId, item.id); assert.equal(data.tipoActor, item.role);
   const context = { 'X-SITREP-Empresa': item.companyId, 'X-SITREP-Empresa-Actividad': item.activityId };
   const dossier = await request(member, `/inspecciones/${item.id}/intercambios`, undefined, context);
   assert.equal(dossier.status, 200); assert.equal(dossier.data.inspeccion.estado, legal ? 'DERIVADA_LEGALES' : 'CERRADA_CONFORME');
   results[surface].push({ role: item.role, id: item.id, noticeId: rows[0].id, legal });
  }
 }
 assert.equal(await db.emailQueue.count({ where: { OR: [{ intentos: { gt: 0 } }, { sentAt: { not: null } }] } }), before);
 writeFileSync(out + '/inspection-company-decisions.json', JSON.stringify({ email: fixture.email, cases: results,
  synthetic: true, production: false, emailAttemptsAdded: 0, emailSentAdded: 0 }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
 console.log('PASS PSIP decisiones: cierre y Legales avisan a representantes de tres roles en datos artificiales.');
} finally { await db.$disconnect(); }
