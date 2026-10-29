import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('connection_limit'), '4');
assert.equal(process.env.ENTERPRISE_ENABLED, 'true'); assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-uiux-final-7c057295-20261027/onboarding-ux-fixture.json', 'utf8'));
assert.match(fixture.owner, /@night-qa\.invalid$/); assert.match(fixture.member, /@night-qa\.invalid$/);
const base = 'http://127.0.0.1:3037/api', tokens = new Map<string, string>(), run = randomUUID().slice(0, 8);
async function call(email: string, route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}, status = 200) {
 assert.match(email, /@night-qa\.invalid$/);
 if (!tokens.has(email)) {
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
  const data = await login.json() as any; assert.equal(login.status, 200); tokens.set(email, data.data.tokens.accessToken);
 }
 const response = await fetch(base + route, { method, headers: { Authorization: 'Bearer ' + tokens.get(email),
  ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
 const result = await response.json() as any; assert.equal(response.status, status, route); return result.data;
}
try {
 const company = await db.empresa.findUniqueOrThrow({ where: { id: fixture.companyId } }); assert.match(company.razonSocial, /QA/i);
 const activity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: company.id, rol: 'GENERADOR', activa: true } });
 const [generator, member, carrier, operator] = await Promise.all([
  db.generador.findUniqueOrThrow({ where: { id: activity.actorId }, include: { usuario: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: fixture.member } }),
  db.transportista.findFirstOrThrow({ where: { usuario: { email: 'transportista@night-qa.invalid' } }, include: { usuario: true } }),
  db.operador.findFirstOrThrow({ where: { usuario: { email: 'operador@night-qa.invalid' } } }),
 ]);
 assert.equal(generator.usuario.email, fixture.owner); assert.equal(member.activo, true); assert.equal(member.emailVerified, true);
 assert.match(carrier.razonSocial, /^QA /); assert.match(operator.razonSocial, /^QA /);
 const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: member.id } } });
 assert.equal(grant.activa, true);
 let site = await db.establecimientoEmpresa.findFirst({ where: { empresaId: company.id, activo: true,
  ...(grant.todosEstablecimientos ? {} : { id: { in: grant.establecimientoIds } }) } });
 if (!site && grant.todosEstablecimientos) site = await db.establecimientoEmpresa.create({ data: { empresaId: company.id,
  codigo: `QA-ENTREGA-${run}`, nombre: 'QA Sede de entrega', domicilio: 'Domicilio artificial QA', certificados: [] } });
 assert.ok(site, 'La autorización artificial debe incluir una sede activa');
 const cases: Record<string, { manifestId: string; numero: string; notice: string }> = {};
 for (const surface of ['web-desktop', 'app', 'access']) {
  const manifest = await db.manifiesto.create({ data: { numero: `QA-REP-DELIVERY-${run}-${surface.toUpperCase()}`,
   generadorId: generator.id, transportistaId: carrier.id, operadorId: operator.id, creadoPorId: carrier.usuarioId,
   estado: 'EN_TRANSITO', modalidad: 'FIJO', fechaRetiro: new Date(), isDemoData: true,
   contextoEmpresa: { empresaId: company.id, establecimientoId: site.id } } });
  const body = { referencia: randomUUID(), observaciones: 'Entrega artificial QA' };
  const result = await call(carrier.usuario.email, `/manifiestos/${manifest.id}/confirmar-entrega-idempotente`, 'POST', body);
  assert.equal(result.idempotencia.repetido, false);
  const repeat = await call(carrier.usuario.email, `/manifiestos/${manifest.id}/confirmar-entrega-idempotente`, 'POST', body);
  assert.equal(repeat.idempotencia.repetido, true);
  const notices = await db.notificacion.findMany({ where: { manifiestoId: manifest.id, tipo: 'MANIFIESTO_ENTREGADO', usuarioId: member.id } });
  assert.equal(notices.length, 1);
  const metadata = JSON.parse(notices[0].datos);
  assert.equal(metadata.evento, 'ENTREGA'); assert.equal(metadata.destino, 'representante');
  assert.equal(metadata.accesosEmpresa[0].actividadId, activity.id); assert.equal(metadata.accesosEmpresa[0].establecimientoId, site.id);
  cases[surface] = { manifestId: manifest.id, numero: manifest.numero, notice: notices[0].id };
 }
 const checked = cases.access, headers = { 'X-SITREP-Empresa': company.id, 'X-SITREP-Empresa-Actividad': activity.id, 'X-SITREP-Establecimiento': site.id };
 assert.equal((await call(fixture.member, '/notificaciones/' + checked.notice)).manifiestoId, checked.manifestId);
 await call('generador2@night-qa.invalid', '/notificaciones/' + checked.notice, 'GET', undefined, {}, 404);
 await call(fixture.member, '/manifiestos/' + checked.manifestId, 'GET', undefined, headers);
 try {
  for (const reason of ['other-site', 'revoked']) {
   await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: reason === 'other-site'
    ? { todosEstablecimientos: false, establecimientoIds: ['qa-sede-distinta'] } : { activa: false } });
   const hidden = await call(fixture.member, '/notificaciones/' + checked.notice);
   assert.equal(hidden.titulo, 'Aviso no disponible'); assert.equal(hidden.manifiestoId, null);
   assert.doesNotMatch(JSON.stringify(hidden), new RegExp(checked.numero));
   const marked = await call(fixture.member, '/notificaciones/' + checked.notice + '/leida', 'PUT');
   assert.doesNotMatch(JSON.stringify(marked), new RegExp(checked.numero));
   await call(fixture.member, '/manifiestos/' + checked.manifestId, 'GET', undefined, headers, 403);
  }
 } finally {
  await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: grant.activa,
   todosEstablecimientos: grant.todosEstablecimientos, establecimientoIds: grant.establecimientoIds, updatedAt: grant.updatedAt } });
 }
 assert.equal((await call(fixture.member, '/notificaciones/' + checked.notice)).manifiestoId, checked.manifestId);
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'delivery-notice-company-private.json'), JSON.stringify({ member: fixture.member,
  company: company.id, activity: activity.id, site: site.id, cases }, null, 2), { mode: 0o600 });
 writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'delivery-notice-company-proof.json'), JSON.stringify({ synthetic: true,
  representativeNotices: 3, replayDuplicates: 0, revokedHidden: true, otherSiteHidden: true, otherAccountDenied: true,
  emailAttempts: 0, emailSent: 0, pushEnabled: false }, null, 2));
 console.log('Avisos de entrega y autorización de representantes verificados con datos artificiales.');
} finally { await db.$disconnect(); }
