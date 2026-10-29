import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const out = process.env.QA_ARTIFACTS!, path = out + '/psip-context-fixture.json';
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-product-ux-20261023/multirol-draft-20261024/multirol-fixture.json', 'utf8'));
assert.equal(fixture.email, 'draft-multirole-20261024@night-qa.invalid');
const roles = ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'];
async function api(route: string, token?: string, body?: unknown, role?: string, status = 200) {
  const r = await fetch('http://127.0.0.1:3037/api' + route, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(role ? { 'X-SITREP-Activity': role } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await r.json();
  assert.equal(r.status, status, route + ': ' + JSON.stringify(result));
  return result.data;
}
const login = async (email: string) => (await api('/auth/login', undefined, { email, password: 'OnlyLocal-NightQA-2026!' })).tokens.accessToken;
try {
  const manifestsBeforeVerification = await db.manifiesto.count();
  const user = await db.usuario.findUniqueOrThrow({ where: { id: fixture.userId } });
  assert.equal(user.email, fixture.email);
  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
  const token = await login(fixture.email);
  let recorded: any;
  if (!existsSync(path)) {
    assert.notEqual(process.env.QA_PSIP_CONTEXT_VERIFY, 'true', 'Create the explicit synthetic fixture first');
    const authority = await login(admin.email), cases = [];
    const manifests = await db.manifiesto.count();
    for (const role of roles) {
      const id = 'qa-psip-context-' + role.toLowerCase() + '-20261025';
      assert.equal(await db.inspeccion.count({ where: { id } }), 0, 'Do not overwrite an existing case');
      const actorId = fixture.actors[role];
      const entity = await db[role.toLowerCase()].findUniqueOrThrow({ where: { id: actorId } });
      assert.equal(entity.usuarioId, fixture.userId);
      await db.inspeccion.create({ data: {
        id, numero: 'QA-PSIP-CONTEXT-' + role + '-20261025', tipoActor: role,
        [role.toLowerCase() + 'Id']: actorId, inspectorId: admin.id, estado: 'NOTIFICADA',
        observaciones: 'QA aislamiento de actividad; datos artificiales, sin salida externa.',
      } });
      const entry = await api('/inspecciones/' + id + '/intercambios', authority, {
        version: 1, clienteId: 'qa_context_' + role.toLowerCase() + '_20261025', tipo: 'REQUERIMIENTO',
        asunto: 'QA · constancia de ' + role.toLowerCase(), cuerpo: 'Pedido artificial para comprobar borradores separados por actividad. No enviar documentación real.',
      }, undefined, 201);
      cases.push({ id, role, exchangeId: entry.id });
    }
    recorded = { at: new Date().toISOString(), email: fixture.email, userId: fixture.userId, cases, manifests };
    writeFileSync(path, JSON.stringify(recorded, null, 2));
  } else recorded = JSON.parse(readFileSync(path, 'utf8'));
  if (!recorded.noticesVerified) {
    assert.notEqual(process.env.QA_PSIP_CONTEXT_VERIFY, 'true', 'Run the explicit corrected-notice fixture phase first');
    const authority = await login(admin.email);
    for (const item of recorded.cases) {
      const current = await api('/inspecciones/' + item.id + '/intercambios', authority);
      const entry = await api('/inspecciones/' + item.id + '/intercambios', authority, {
        version: current.inspeccion.version, clienteId: 'qa_context_notice_' + item.role.toLowerCase() + '_20261025', tipo: 'REQUERIMIENTO',
        asunto: 'QA · aviso para ' + item.role.toLowerCase(), cuerpo: 'Segundo pedido artificial para verificar aviso, cambio de actividad y recuperación. No enviar respuesta.',
      }, undefined, 201);
      const notices = await db.notificacion.findMany({ where: { datos: { contains: entry.id } } });
      assert.equal(notices.length, 1); assert.equal(notices[0].usuarioId, fixture.userId);
      assert.equal(JSON.parse(notices[0].datos).tipoActor, item.role);
      item.previousExchangeId = item.exchangeId; item.exchangeId = entry.id; item.noticeId = notices[0].id; item.entries = 2;
    }
    recorded.noticesVerified = true;
    writeFileSync(path, JSON.stringify(recorded, null, 2));
  }
  const checks = [];
  for (const role of roles) {
    const profile = await api('/auth/profile', token, undefined, role);
    assert.equal(profile.user.id, fixture.userId); assert.equal(profile.user.rol, role);
    await api('/inspecciones', token, undefined, role, 403);
    for (const item of recorded.cases) {
      const status = role === item.role ? 200 : 403;
      const timeline = await api('/inspecciones/' + item.id + '/intercambios', token, undefined, role, status);
      if (status === 200) {
        assert.equal(timeline.parteActual, 'INSPECCIONADO');
        assert.equal(timeline.intercambios.length, item.entries, 'Draft checks must never submit responses');
        assert.equal(timeline.intercambios.at(-1).id, item.exchangeId);
      }
      checks.push({ role, caseRole: item.role, status });
    }
  }
  for (const item of recorded.cases) {
    const notice = await api('/notificaciones/' + item.noticeId, token, undefined, 'GENERADOR');
    assert.equal(JSON.parse(notice.datos).tipoActor, item.role);
  }
  const expectedManifests = process.env.QA_PSIP_CONTEXT_VERIFY === 'true' ? manifestsBeforeVerification : recorded.manifests;
  assert.equal(await db.manifiesto.count(), expectedManifests);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  writeFileSync(out + '/psip-context-http.json', JSON.stringify({ at: new Date().toISOString(), checks, manifests: expectedManifests, responsesSubmitted: 0, emailAttempts: 0, emailSent: 0 }, null, 2));
  console.log('Same account: three authorized requirements, six cross-role denials; no responses submitted.');
} finally { await db.$disconnect(); }
