import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient(), out = process.env.QA_ARTIFACTS!;
const file = out + '/fiscal-company-notices.json';
const fixture = JSON.parse(readFileSync(out + '/onboarding-ux-fixture.json', 'utf8'));
assert.match(fixture.owner, /@night-qa\.invalid$/); assert.match(fixture.member, /@night-qa\.invalid$/);
const base = 'http://127.0.0.1:3037/api', tokens = new Map<string, string>();
async function token(email: string) {
  assert.match(email, /@night-qa\.invalid$/);
  if (!tokens.has(email)) {
    const res = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
    const body = await res.json(); assert.equal(res.status, 200); tokens.set(email, body.data.tokens.accessToken);
  }
  return tokens.get(email)!;
}
async function call(email: string, path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}, status = 200) {
  const res = await fetch(base + path, { method, headers: { Authorization: 'Bearer ' + await token(email), 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const payload = await res.json(); assert.equal(res.status, status, path + ': ' + res.status);
  return payload.data;
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const manifests = () => db.manifiesto.findMany({ orderBy: { id: 'asc' }, select: { id: true, estado: true, updatedAt: true } });
const delivery = async () => ({ attempts: await db.emailQueue.count({ where: { intentos: { gt: 0 } } }),
  sent: await db.emailQueue.count({ where: { sentAt: { not: null } } }) });
let temporarySite: { id: string; codigo: string } | null = null;
try {
  const company = await db.empresa.findUniqueOrThrow({ where: { id: fixture.companyId } });
  assert.match(company.razonSocial, /QA/i);
  const activity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: company.id, rol: 'GENERADOR', activa: true } });
  const generator = await db.generador.findUniqueOrThrow({ where: { id: activity.actorId }, include: { usuario: true } });
  const member = await db.usuario.findUniqueOrThrow({ where: { email: fixture.member } });
  assert.equal(generator.usuario.email, fixture.owner); assert.equal(generator.usuario.activo, true); assert.equal(member.activo, true);
  const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: member.id } } });
  assert.equal(grant.activa, true); assert.equal(grant.todosEstablecimientos, true);
  let site = await db.establecimientoEmpresa.findFirst({ where: { empresaId: company.id, activo: true } });
  if (!site && process.env.QA_FISCAL_COMPANY_VERIFY !== 'true') {
    site = await db.establecimientoEmpresa.create({ data: { empresaId: company.id, codigo: 'QA-FISCAL-TEMP-' + Date.now(),
      nombre: 'Sede temporal de prueba', domicilio: 'Domicilio artificial QA', certificados: [] } });
    temporarySite = { id: site.id, codigo: site.codigo };
  }
  const headers = { 'X-SITREP-Empresa': company.id, 'X-SITREP-Empresa-Actividad': activity.id };
  const noticeMessage = 'QA exclusivo: revisá la documentación fiscal artificial del ejercicio 2026.';
  const send = () => call('admin@night-qa.invalid', '/actores/generadores/recordatorios', 'POST',
    { ids: [generator.id], fiscalYear: 2026, motivo: noticeMessage }, {}, 201);
  const noticesFor = (campaignId: string) => db.notificacion.findMany({ where: { datos: { contains: campaignId } } });
  let report: any = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  if (!report) {
    assert.notEqual(process.env.QA_FISCAL_COMPANY_VERIFY, 'true');
    const before = { manifests: hash(await manifests()), delivery: await delivery() };
    assert.deepEqual(before.delivery, { attempts: 0, sent: 0 });
    const result = await send(); assert.equal(result.requested, 1); assert.equal(result.delivered, 2); assert.equal(result.skipped, 0);
    const rows = await noticesFor(result.campaignId);
    assert.equal(rows.length, 2); assert.equal(new Set(rows.map((n: any) => n.usuarioId)).size, 2);
    const own = rows.find((n: any) => n.usuarioId === generator.usuarioId), representative = rows.find((n: any) => n.usuarioId === member.id);
    assert.ok(own && representative); assert.equal(representative.titulo, 'Aviso para tu empresa');
    report = { before, company: company.id, activity: activity.id, generator: generator.id, member: fixture.member,
      owner: fixture.owner, notice: representative.id, ownerNotice: own.id, campaign: result.campaignId };
    writeFileSync(file, JSON.stringify(report, null, 2));
  }
  assert.equal(report.company, company.id); assert.equal(report.member, fixture.member);
  const visible = await call(fixture.member, '/notificaciones/' + report.notice);
  assert.equal(visible.titulo, 'Recordatorio fiscal 2026'); assert.equal(visible.mensaje, noticeMessage);
  const data = JSON.parse(visible.datos);
  assert.equal(data.generadorId, generator.id); assert.equal(data.fiscalYear, 2026);
  assert.deepEqual(data.accesosEmpresa, [{ empresaId: company.id, actividadId: activity.id, rol: 'GENERADOR', razonSocial: company.razonSocial }]);
  const profile = await call(fixture.member, '/auth/profile', 'GET', undefined, headers);
  assert.equal(profile.user.empresaContexto.actorId, generator.id); assert.equal(profile.user.empresaContexto.todasSedes, true);
  await call(fixture.member, '/actores/generadores/' + generator.id + '/pagos', 'GET', undefined, headers);
  await call('generador2@night-qa.invalid', '/notificaciones/' + report.notice, 'GET', undefined, {}, 404);
  if (process.env.QA_FISCAL_COMPANY_VERIFY !== 'true' && !report.restrictionsChecked) {
    assert.ok(site);
    try {
      for (const reason of ['site-only', 'revoked']) {
        await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: reason === 'site-only'
          ? { todosEstablecimientos: false, establecimientoIds: [site.id] } : { activa: false } });
        const hidden = await call(fixture.member, '/notificaciones/' + report.notice);
        assert.equal(hidden.titulo, 'Aviso no disponible');
        assert.doesNotMatch(hidden.titulo + hidden.mensaje + hidden.datos, /2026|documentación fiscal|generadorId|campaign/);
        const list = await call(fixture.member, '/notificaciones?limit=500');
        assert.equal(list.notificaciones.find((n: any) => n.id === report.notice).titulo, 'Aviso no disponible');
        const read = await call(fixture.member, '/notificaciones/' + report.notice + '/leida', 'PUT');
        assert.doesNotMatch(read.titulo + read.mensaje + read.datos, /2026|documentación fiscal|generadorId|campaign/);
        await call(fixture.member, '/actores/generadores/' + generator.id + '/pagos', 'GET', undefined,
          reason === 'site-only' ? { ...headers, 'X-SITREP-Establecimiento': site.id } : headers, 403);
        const result = await send(); const rows = await noticesFor(result.campaignId);
        assert.equal(result.delivered, 1); assert.ok(rows.every((n: any) => n.usuarioId !== member.id));
      }
    } finally {
      await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: grant.activa,
        todosEstablecimientos: grant.todosEstablecimientos, establecimientoIds: grant.establecimientoIds, updatedAt: grant.updatedAt } });
    }
    assert.deepEqual(await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: grant.id } }), grant);
    assert.equal((await call(fixture.member, '/notificaciones/' + report.notice)).titulo, 'Recordatorio fiscal 2026');
    const owner = generator.usuario;
    try {
      await db.usuario.update({ where: { id: owner.id }, data: { activo: false } });
      const result = await send(); const rows = await noticesFor(result.campaignId);
      assert.equal(result.delivered, 1); assert.equal(result.skipped, 0);
      assert.equal(rows.length, 1); assert.equal(rows[0].usuarioId, member.id);
    } finally { await db.usuario.update({ where: { id: owner.id }, data: { activo: owner.activo, updatedAt: owner.updatedAt } }); }
    assert.deepEqual(await db.usuario.findUniqueOrThrow({ where: { id: owner.id } }), owner);
    report.restrictionsChecked = true;
    report.checks = ['titular y representante reciben un aviso cada uno', 'ficha fiscal accesible con autorización total',
      'otra cuenta no puede abrir el aviso', 'autorización de una sede y revocación ocultan el contenido y bloquean la ficha',
      'ambos escenarios dejan de crear nuevos avisos para el representante', 'respuesta de marcar leído no revela el contenido',
      'cuenta principal inactiva no impide avisar al representante autorizado', 'autorización y cuenta restauradas'];
  }
  assert.equal(hash(await manifests()), report.before.manifests); assert.deepEqual(await delivery(), { attempts: 0, sent: 0 });
  report.at = new Date().toISOString(); report.complete = report.restrictionsChecked === true;
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ notice: report.notice, checks: report.checks, emailAttempts: 0, emailSent: 0 }));
} finally {
  try {
    if (temporarySite) await db.establecimientoEmpresa.deleteMany({ where: { id: temporarySite.id, empresaId: fixture.companyId, codigo: temporarySite.codigo } });
  } finally { await db.$disconnect(); }
}
