/** Exercise only the synthetic multi-role account and in-app reminder. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-product-ux-20261023/multirol-draft-20261024/multirol-fixture.json', 'utf8'));
assert.equal(fixture.email, 'draft-multirole-20261024@night-qa.invalid');
const evidence = process.env.QA_ARTIFACTS + '/fiscal-reminder-context.json';
async function request(route: string, options: { token?: string; role?: string; body?: unknown; status?: number } = {}) {
  const response = await fetch('http://127.0.0.1:3037/api' + route, {
    method: options.body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}),
      ...(options.role ? { 'X-SITREP-Activity': options.role } : {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  assert.equal(response.status, options.status || 200, route + ': ' + response.status);
  const data = await response.json();
  return data.data;
}
async function login(email: string) {
  assert.ok(email.endsWith('@night-qa.invalid'));
  return (await request('/auth/login', { body: { email, password: 'OnlyLocal-NightQA-2026!' } })).tokens.accessToken as string;
}
try {
  const user = await db.usuario.findUniqueOrThrow({ where: { id: fixture.userId } });
  assert.equal(user.email, fixture.email);
  const generator = await db.generador.findUniqueOrThrow({ where: { id: fixture.actors.GENERADOR } });
  assert.equal(generator.usuarioId, user.id);
  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
  assert.equal(admin.rol, 'ADMIN');
  let recorded: any;
  if (!existsSync(evidence)) {
    assert.notEqual(process.env.QA_FISCAL_REMINDER_VERIFY, 'true');
    const before = { manifests: await db.manifiesto.count(), attempts: await db.emailQueue.count({ where: { intentos: { gt: 0 } } }),
      sent: await db.emailQueue.count({ where: { sentAt: { not: null } } }) };
    assert.equal(before.attempts, 0); assert.equal(before.sent, 0);
    const response = await request('/actores/generadores/recordatorios', { token: await login(admin.email),
      body: { ids: [generator.id], fiscalYear: 2026, motivo: 'QA: revisá la documentación fiscal artificial del ejercicio 2026.' }, status: 201 });
    assert.equal(response.requested, 1); assert.equal(response.delivered, 1); assert.equal(response.skipped, 0);
    const notices = await db.notificacion.findMany({ where: { usuarioId: user.id, datos: { contains: response.campaignId } } });
    assert.equal(notices.length, 1);
    const data = JSON.parse(notices[0].datos);
    assert.equal(data.tipo, 'recordatorio_fiscal'); assert.equal(data.generadorId, generator.id); assert.equal(data.fiscalYear, 2026);
    recorded = { userId: user.id, email: fixture.email, generatorId: generator.id, noticeId: notices[0].id, fiscalYear: 2026, before };
    writeFileSync(evidence, JSON.stringify(recorded, null, 2));
  } else recorded = JSON.parse(readFileSync(evidence, 'utf8'));
  const owner = await login(fixture.email), other = await login('generador2@night-qa.invalid');
  const notice = await request('/notificaciones/' + recorded.noticeId, { token: owner, role: 'OPERADOR' });
  assert.equal(JSON.parse(notice.datos).generadorId, recorded.generatorId);
  await request('/notificaciones/' + recorded.noticeId, { token: other, status: 404 });
  await request('/actores/generadores/' + recorded.generatorId + '/pagos', { token: owner, role: 'OPERADOR', status: 403 });
  await request('/actores/generadores/' + recorded.generatorId + '/pagos', { token: owner, role: 'GENERADOR' });
  await request('/actores/generadores/' + recorded.generatorId + '/pagos', { token: other, status: 403 });
  assert.equal(await db.manifiesto.count(), recorded.before.manifests);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  console.log(JSON.stringify({ noticeId: recorded.noticeId, ownNotice: true, wrongRoleDenied: true, foreignAccountDenied: true, emailAttempts: 0, emailSent: 0 }));
} finally { await db.$disconnect(); }
