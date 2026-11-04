import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-operational-ui-current2026102943');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.ENTERPRISE_ENABLED, 'true'); assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-uiux-final-7c057295-20261027/onboarding-ux-fixture.json', 'utf8'));
assert.match(fixture.owner, /@night-qa\.invalid$/); assert.match(fixture.member, /@night-qa\.invalid$/);
const base = 'http://127.0.0.1:3037/api', tokens = new Map<string, string>(), run = randomUUID().slice(0, 8);
async function call(email: string, route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}, status = 200) {
 assert.match(email, /@night-qa\.invalid$/);
 if (!tokens.has(email)) {
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json',
   Cookie: `sitrep_qa_client=127.13.22.${tokens.size + 1}` }, body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
  const data = await login.json() as any; assert.equal(login.status, 200); tokens.set(email, data.data.tokens.accessToken);
 }
 const response = await fetch(base + route, { method, headers: { Authorization: 'Bearer ' + tokens.get(email),
  ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
 const result = await response.json() as any; assert.equal(response.status, status, route + ' ' + JSON.stringify(result)); return result.data;
}
try {
 const company = await db.empresa.findUniqueOrThrow({ where: { id: fixture.companyId } }); assert.match(company.razonSocial, /QA/i);
 const activity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: company.id, rol: 'GENERADOR', activa: true } });
 const [generator, member, carrier, operator] = await Promise.all([
  db.generador.findUniqueOrThrow({ where: { id: activity.actorId }, include: { usuario: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: fixture.member } }),
  db.transportista.findFirstOrThrow({ where: { usuario: { email: 'transportista@night-qa.invalid' } }, include: { usuario: true } }),
  db.operador.findFirstOrThrow({ where: { usuario: { email: 'operador@night-qa.invalid' } }, include: { usuario: true } }),
 ]);
 assert.equal(generator.usuario.email, fixture.owner); assert.equal(member.activo, true); assert.equal(member.emailVerified, true);
 assert.match(carrier.razonSocial, /^QA /); assert.match(operator.razonSocial, /^QA /);
 const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: member.id } } });
 assert.equal(grant.activa, true);
 let site = await db.establecimientoEmpresa.findFirst({ where: { empresaId: company.id, activo: true,
  ...(grant.todosEstablecimientos ? {} : { id: { in: grant.establecimientoIds } }) } });
 if (!site && grant.todosEstablecimientos) site = await db.establecimientoEmpresa.create({ data: { empresaId: company.id,
  codigo: `QA-ESTADO-${run}`, nombre: 'QA Sede de avisos', domicilio: 'Domicilio artificial QA', certificados: [] } });
 assert.ok(site);
 const method = (await db.tratamientoAutorizado.findFirst({ where: { operadorId: operator.id, activo: true } }))?.metodo || 'QA tratamiento';
 const cases: Record<string, { manifestId: string; numero: string; notice: string }> = {};
 for (const surface of ['web-desktop', 'app', 'access']) {
  const manifest = await db.manifiesto.create({ data: { numero: `QA-REP-ESTADO-${run}-${surface.toUpperCase()}`,
   generadorId: generator.id, transportistaId: carrier.id, operadorId: operator.id, creadoPorId: generator.usuarioId,
   estado: 'APROBADO', modalidad: 'FIJO', isDemoData: true, contextoEmpresa: { empresaId: company.id, establecimientoId: site.id } } });
  const marker = { version: 2, modalidad: 'FIJO', generadorId: generator.id, transportistaId: carrier.id,
   operadorId: operator.id, creadoPorId: generator.usuarioId, autorRol: 'GENERADOR' };
  await db.eventoManifiesto.createMany({ data: [
   { manifiestoId: manifest.id, tipo: 'PROPUESTA_PARTES_V1', descripcion: JSON.stringify(marker), usuarioId: generator.usuarioId },
   { manifiestoId: manifest.id, tipo: 'FIRMA', descripcion: 'Aprobación QA', usuarioId: generator.usuarioId },
   { manifiestoId: manifest.id, tipo: 'APROBACION_TRANSPORTISTA', descripcion: 'Aprobación QA', usuarioId: carrier.usuarioId },
   { manifiestoId: manifest.id, tipo: 'APROBACION_OPERADOR', descripcion: 'Aprobación QA', usuarioId: operator.usuarioId },
   { manifiestoId: manifest.id, tipo: 'INICIO_COORDINACION', descripcion: 'Coordinación QA', usuarioId: generator.usuarioId },
  ] });
  await call(carrier.usuario.email, `/manifiestos/${manifest.id}/confirmar-retiro`, 'POST', {});
  const deliveryRoute = surface === 'app' ? 'confirmar-entrega-idempotente' : 'confirmar-entrega';
  await call(carrier.usuario.email, `/manifiestos/${manifest.id}/${deliveryRoute}`, 'POST', surface === 'app' ? { referencia: randomUUID() } : {});
  await call(operator.usuario.email, `/manifiestos/${manifest.id}/confirmar-recepcion`, 'POST', {});
  await call(operator.usuario.email, `/manifiestos/${manifest.id}/tratamiento`, 'POST', { metodo: method });
  await call(operator.usuario.email, `/manifiestos/${manifest.id}/cerrar`, 'POST', {});
  await new Promise(resolve => setTimeout(resolve, 500));
  const notices = await db.notificacion.findMany({ where: { manifiestoId: manifest.id, usuarioId: member.id } });
  const states = notices.map((notice: any) => ({ notice, data: JSON.parse(notice.datos || '{}') }))
   .filter((entry: any) => entry.data.tipo === 'estado_manifiesto');
  const required = surface === 'app' ? ['EN_TRANSITO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO']
   : ['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'];
  for (const state of required) {
   const found = states.filter((entry: any) => entry.data.estado === state);
   assert.equal(found.length, 1, state + ' debe guardarse una vez para el representante');
   assert.equal(found[0].data.destino, 'representante');
   assert.equal(found[0].data.accesosEmpresa[0].actividadId, activity.id);
   assert.equal(found[0].data.accesosEmpresa[0].establecimientoId, site.id);
  }
  if (surface === 'app') assert.equal(notices.filter((notice: any) => JSON.parse(notice.datos || '{}').evento === 'ENTREGA').length, 1);
  cases[surface] = { manifestId: manifest.id, numero: manifest.numero,
   notice: states.find((entry: any) => entry.data.estado === 'EN_TRANSITO').notice.id };
 }
 for (const mode of ['IN_SITU', 'CANCELADO']) {
  const manifest = await db.manifiesto.create({ data: { numero: `QA-REP-ESTADO-${run}-${mode}`,
   generadorId: generator.id, transportistaId: carrier.id, operadorId: operator.id, creadoPorId: generator.usuarioId,
   estado: 'APROBADO', modalidad: mode === 'IN_SITU' ? 'IN_SITU' : 'FIJO', isDemoData: true,
   contextoEmpresa: { empresaId: company.id, establecimientoId: site.id } } });
  if (mode === 'IN_SITU') {
   const marker = { version: 2, modalidad: 'IN_SITU', generadorId: generator.id, transportistaId: carrier.id,
    operadorId: operator.id, creadoPorId: generator.usuarioId, autorRol: 'GENERADOR' };
   await db.eventoManifiesto.createMany({ data: [
    { manifiestoId: manifest.id, tipo: 'PROPUESTA_PARTES_V1', descripcion: JSON.stringify(marker), usuarioId: generator.usuarioId },
    { manifiestoId: manifest.id, tipo: 'FIRMA', descripcion: 'Aprobación QA', usuarioId: generator.usuarioId },
    { manifiestoId: manifest.id, tipo: 'APROBACION_TRANSPORTISTA', descripcion: 'Aprobación QA', usuarioId: carrier.usuarioId },
    { manifiestoId: manifest.id, tipo: 'APROBACION_OPERADOR', descripcion: 'Aprobación QA', usuarioId: operator.usuarioId },
    { manifiestoId: manifest.id, tipo: 'INICIO_COORDINACION', descripcion: 'Coordinación QA', usuarioId: generator.usuarioId },
   ] });
   await call(operator.usuario.email, `/manifiestos/${manifest.id}/recepcion-insitu`, 'POST', {});
  } else await call(generator.usuario.email, `/manifiestos/${manifest.id}/cancelar`, 'POST', { motivo: 'Cancelación artificial QA' });
  const notices = await db.notificacion.findMany({ where: { manifiestoId: manifest.id, usuarioId: member.id } });
  const expected = mode === 'IN_SITU' ? 'RECIBIDO' : 'CANCELADO';
  const found = notices.filter((notice: any) => JSON.parse(notice.datos || '{}').estado === expected);
  assert.equal(found.length, 1); assert.equal(JSON.parse(found[0].datos).destino, 'representante');
  if (mode === 'IN_SITU') {
   assert.equal(await db.tramoTransporte.count({ where: { manifiestoId: manifest.id } }), 0);
   assert.equal(await db.trackingGPS.count({ where: { manifiestoId: manifest.id } }), 0);
  }
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
 writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'state-notice-company-private.json'), JSON.stringify({ member: fixture.member,
  company: company.id, activity: activity.id, site: site.id, cases }, null, 2), { mode: 0o600 });
 writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'state-notice-company-proof.json'), JSON.stringify({ synthetic: true,
  manifests: 5, legacyDeliveryCases: 2, idempotentDeliveryCases: 1, stateNoticesPerRepresentative: [5, 4, 5],
  inSituReceipt: true, cancellation: true,
  revokedHidden: true, otherSiteHidden: true, otherAccountDenied: true, emailAttempts: 0, emailSent: 0, pushEnabled: false }, null, 2));
 console.log('Avisos de estado y autorización de representantes verificados con datos artificiales.');
} finally { await db.$disconnect(); }
