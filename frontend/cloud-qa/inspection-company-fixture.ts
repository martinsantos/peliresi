import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
import { syntheticCuit } from './synthetic-cuit.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-representative-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'inspection-company');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.ENTERPRISE_ENABLED, 'true');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const prior = JSON.parse(readFileSync('/work/sitrep/.qa-uiux-final-7c057295-20261027/onboarding-ux-fixture.json', 'utf8'));
assert.match(prior.member, /@night-qa\.invalid$/);
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient(), base = 'http://127.0.0.1:3037/api', run = randomUUID();
type Role = 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
const roles: Role[] = ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'];
const surfaces = ['web-desktop', 'web-responsive', 'app'];
async function request(token: string | null, route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(base + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const raw = await response.text(); let json: any = null;
  try { json = raw ? JSON.parse(raw) : null; } catch { throw new Error('Respuesta no JSON: ' + route); }
  return { status: response.status, data: json?.data, raw };
}
async function login(email: string, octet: number) {
  assert.match(email, /@night-qa\.invalid$/);
  const response = await request(null, '/auth/login', 'POST', { email, password: 'OnlyLocal-NightQA-2026!' },
    { Cookie: `sitrep_qa_client=127.11.81.${octet}` });
  assert.equal(response.status, 200); return response.data.tokens.accessToken as string;
}
try {
  const member = await db.usuario.findUniqueOrThrow({ where: { email: prior.member } });
  const source = await db.usuario.findUniqueOrThrow({ where: { email: prior.owner } });
  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
  assert.ok(member.activo && member.emailVerified); assert.match(source.email, /@night-qa\.invalid$/);
  const [adminToken, memberToken, outsiderToken] = await Promise.all([
    login(admin.email, 1), login(member.email, 2), login('generador2@night-qa.invalid', 3),
  ]);
  const before = await db.emailQueue.count({ where: { OR: [{ intentos: { gt: 0 } }, { sentAt: { not: null } }] } });
  const cases: Record<string, any[]> = Object.fromEntries(surfaces.map(name => [name, []]));
  const proof: any[] = [];
  for (const [index, role] of roles.entries()) {
    const suffix = role.toLowerCase() + '-' + run.slice(0, 8), cuit = syntheticCuit(Date.now() + index * 1000);
    const email = 'psip-owner-' + suffix + '@night-qa.invalid';
    const owner = await db.usuario.create({ data: { email, nombre: 'QA titular ' + role, password: source.password,
      rol: role, activo: true, emailVerified: true, notifEmail: false } });
    const common = { usuarioId: owner.id, razonSocial: 'QA Empresa ' + suffix, cuit, domicilio: 'QA artificial', telefono: '000', email };
    const actor = role === 'GENERADOR' ? await db.generador.create({ data: { ...common, numeroInscripcion: 'QA', categoria: 'QA' } })
      : role === 'TRANSPORTISTA' ? await db.transportista.create({ data: { ...common, numeroHabilitacion: 'QA' } })
      : await db.operador.create({ data: { ...common, numeroHabilitacion: 'QA', categoria: 'QA' } });
    const company = await db.empresa.create({ data: { cuit: cuit.replace(/\D/g, ''), razonSocial: common.razonSocial, domicilioLegal: { calle: 'QA' } } });
    const activity = await db.empresaActividad.create({ data: { empresaId: company.id, rol: role, actorId: actor.id, aprobadaPor: admin.id } });
    const grant = await db.autorizacionEmpresa.create({ data: { empresaId: company.id, actividadId: activity.id, usuarioId: member.id,
      todosEstablecimientos: true, establecimientoIds: [], otorgadaPor: owner.id } });
    const context = { 'X-SITREP-Empresa': company.id, 'X-SITREP-Empresa-Actividad': activity.id };
    for (const surface of surfaces) {
      const key = randomUUID();
      const inspection = await db.inspeccion.create({ data: { numero: `QA-PSIP-REP-${role}-${key}`, tipoActor: role,
        ...(role === 'GENERADOR' ? { generadorId: actor.id } : role === 'TRANSPORTISTA' ? { transportistaId: actor.id } : { operadorId: actor.id }),
        inspectorId: admin.id, estado: 'NOTIFICADA', observaciones: 'QA artificial: representante y aviso.' } });
      const created = await request(adminToken, `/inspecciones/${inspection.id}/intercambios`, 'POST', {
        version: 1, clienteId: 'qa-psip-' + key, tipo: 'REQUERIMIENTO', asunto: 'QA requerimiento ' + role,
        cuerpo: 'QA artificial: responder este requerimiento en representación de la empresa.',
        plazoRespuestaAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      });
      assert.equal(created.status, 201, created.raw);
      const sourceId = created.data.id as string;
      const [direct, representatives] = await Promise.all([
        db.notificacion.findMany({ where: { usuarioId: owner.id, datos: { contains: sourceId } } }),
        db.notificacion.findMany({ where: { usuarioId: member.id, datos: { contains: sourceId } } }),
      ]);
      assert.equal(direct.length, 1); assert.equal(representatives.length, 1);
      const notice = representatives[0];
      assert.ok(!JSON.stringify(notice).includes(inspection.numero), 'Raw notice must stay opaque');
      const own = await request(memberToken, '/notificaciones/' + notice.id);
      assert.equal(own.status, 200, own.raw);
      const details = JSON.parse(own.data.datos);
      assert.equal(details.inspeccionId, inspection.id); assert.equal(details.tipoActor, role);
      assert.deepEqual(details.accesosEmpresa.map((item: any) => [item.empresaId, item.actividadId, item.actorId]), [[company.id, activity.id, actor.id]]);
      assert.equal((await request(outsiderToken, '/notificaciones/' + notice.id)).status, 404);
      assert.equal((await request(memberToken, `/inspecciones/${inspection.id}/intercambios`, 'GET', undefined, context)).status, 200);
      assert.notEqual((await request(memberToken, `/inspecciones/${inspection.id}/intercambios`)).status, 200);
      cases[surface].push({ role, id: inspection.id, noticeId: notice.id, sourceId, companyId: company.id, activityId: activity.id });
    }
    // The grant belongs only to this newly created synthetic company and is restored before browser tests.
    const sample = cases['web-desktop'].find(c => c.role === role);
    try {
      await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: false } });
      const revoked = await request(memberToken, '/notificaciones/' + sample.noticeId);
      assert.equal(revoked.status, 200); assert.equal(revoked.data.titulo, 'Aviso no disponible');
      assert.ok(!JSON.stringify(revoked.data).includes(sample.id));
      assert.notEqual((await request(memberToken, `/inspecciones/${sample.id}/intercambios`, 'GET', undefined, context)).status, 200);
      await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: true, todosEstablecimientos: false } });
      const limited = await request(memberToken, '/notificaciones/' + sample.noticeId);
      assert.equal(limited.data.titulo, 'Aviso no disponible');
      assert.notEqual((await request(memberToken, `/inspecciones/${sample.id}/intercambios`, 'GET', undefined, context)).status, 200);
    } finally {
      await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: true, todosEstablecimientos: true } });
    }
    assert.equal((await request(memberToken, '/notificaciones/' + sample.noticeId)).data.titulo, 'PSIP · Nuevo requerimiento');
    proof.push({ role, privateRawNotice: true, revokedHidden: true, siteOnlyHidden: true, unrelatedRejected: true });
  }
  assert.equal(await db.emailQueue.count({ where: { OR: [{ intentos: { gt: 0 } }, { sentAt: { not: null } }] } }), before);
  writeFileSync(out + '/inspection-company-fixture.json', JSON.stringify({ email: member.email, cases }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  writeFileSync(out + '/inspection-company-http-proof.json', JSON.stringify({ synthetic: true, production: false,
    requirements: 9, roles: proof, emailAttemptsAdded: 0, emailSentAdded: 0 }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('PASS PSIP representantes: tres roles, avisos privados y revocación verificados en datos artificiales.');
} finally { await db.$disconnect(); }
