import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z'); assert.equal(process.env.ENTERPRISE_ENABLED, 'true');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const { matchesAlertCondition } = backendRequire('./dist/services/alertRuleCondition.service.js');
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-uiux-final-7c057295-20261027/onboarding-ux-fixture.json', 'utf8'));
assert.match(fixture.owner, /@night-qa\.invalid$/); assert.match(fixture.member, /@night-qa\.invalid$/);
const run = randomUUID().slice(0, 8), out = process.env.QA_ARTIFACTS!, base = 'http://127.0.0.1:3037/api';
const baseline = process.env.QA_EXPECT_DEFAULT_MISSING === 'true', tokens = new Map<string, string>();
async function call(email: string, route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}, status = 200) {
 assert.match(email, /@night-qa\.invalid$/);
 if (!tokens.has(email)) {
  const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
  const result = await response.json() as any; assert.equal(response.status, 200, 'Synthetic login'); tokens.set(email, result.data.tokens.accessToken);
 }
 const response = await fetch(base + route, { method, headers: { Authorization: 'Bearer ' + tokens.get(email), 'Content-Type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
 const result = await response.json() as any; assert.equal(response.status, status, route + ' ' + JSON.stringify(result)); return result.data;
}
async function waitFor(fn: () => Promise<boolean>) {
 for (let i = 0; i < 80; i++) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
 throw new Error('No llegó el aviso artificial esperado');
}
try {
 const previous = JSON.parse(readFileSync('/work/sitrep/.qa-company-alerts-20261028/company-rule-browser.json', 'utf8'));
 const previousManifest = await db.manifiesto.findUniqueOrThrow({ where: { id: previous.manifestId }, select: { numero: true, isDemoData: true } });
 const previousNotice = await db.notificacion.findUniqueOrThrow({ where: { id: previous.notice }, select: { manifiestoId: true } });
 assert.equal(previousManifest.numero, previous.numero); assert.equal(previousManifest.isDemoData, true); assert.equal(previousNotice.manifiestoId, previous.manifestId);
 const company = await db.empresa.findUniqueOrThrow({ where: { id: fixture.companyId } }); assert.match(company.razonSocial, /QA/i);
 const activity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: company.id, rol: 'GENERADOR', activa: true } });
 const [generator, member, carrier, templateOperator, admin, site, waste] = await Promise.all([
  db.generador.findUniqueOrThrow({ where: { id: activity.actorId }, include: { usuario: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: fixture.member } }),
  db.transportista.findFirstOrThrow({ where: { usuario: { email: 'transportista@night-qa.invalid' } }, include: { usuario: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
  db.establecimientoEmpresa.findFirstOrThrow({ where: { empresaId: company.id, activo: true } }),
  db.tipoResiduo.findFirstOrThrow({ where: { codigo: 'Y1' } }),
 ]);
 assert.equal(generator.usuario.email, fixture.owner); assert.equal(member.activo, true); assert.equal(member.emailVerified, true);
 const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: member.id } } });
 assert.equal(grant.activa, true); assert.ok(grant.todosEstablecimientos || grant.establecimientoIds.includes(site.id));
 const opEmail = `qa-event-operator-${run}@night-qa.invalid`, cuit = '99' + String(parseInt(run, 16) % 1_000_000_000).padStart(9, '0');
 const opUser = await db.usuario.create({ data: { email: opEmail, password: templateOperator.password, nombre: 'QA operador de avisos',
  rol: 'OPERADOR', activo: true, emailVerified: true, notifEmail: false } });
 const operator = await db.operador.create({ data: { usuarioId: opUser.id, razonSocial: `QA operador avisos ${run}`, cuit,
  domicilio: 'Domicilio artificial', telefono: '000', email: opEmail, numeroHabilitacion: `QA-${run}`, categoria: 'QA' } });
 const opCompany = await db.empresa.create({ data: { cuit, razonSocial: operator.razonSocial, domicilioLegal: { calle: 'QA' } } });
 const opActivity = await db.empresaActividad.create({ data: { empresaId: opCompany.id, rol: 'OPERADOR', actorId: operator.id, aprobadaPor: admin.id } });
 const opGrant = await db.autorizacionEmpresa.create({ data: { empresaId: opCompany.id, actividadId: opActivity.id, usuarioId: member.id,
  todosEstablecimientos: true, establecimientoIds: [], otorgadaPor: admin.id } });
 const trip = async (suffix: string, estado: string) => db.manifiesto.create({ data: { numero: `QA-DEFAULT-${run}-${suffix}`,
  generadorId: generator.id, transportistaId: carrier.id, operadorId: operator.id, creadoPorId: carrier.usuarioId, estado,
  modalidad: 'FIJO', isDemoData: true, contextoEmpresa: { empresaId: company.id, establecimientoId: site.id },
  residuos: { create: [{ tipoResiduoId: waste.id, cantidad: 10, unidad: 'kg', estado: 'SOLIDO' }] } }, include: { residuos: true } });
 const incident = await trip('INC', 'EN_TRANSITO'), rejected = await trip('REJ', 'ENTREGADO'), weighed = await trip('WEIGH', 'RECIBIDO');
 const probes = [
  { evento: 'INCIDENTE', data: { manifiestoId: incident.id, tipoIncidente: 'QA', descripcion: 'Incidente artificial', userId: carrier.usuarioId } },
  { evento: 'RECHAZO_CARGA', data: { manifiestoId: rejected.id, motivo: 'Rechazo artificial QA', numero: rejected.numero, userId: opUser.id } },
  { evento: 'DIFERENCIA_PESO', data: { manifiestoId: weighed.id, pesoDeclarado: 10, pesoReal: 12, delta: '20.00%', deltaPorcentaje: 20, userId: opUser.id } },
 ];
 for (const probe of probes) {
  const rules = await db.reglaAlerta.findMany({ where: { evento: probe.evento, activa: true } });
  assert.ok(rules.every((rule: any) => !matchesAlertCondition(rule.condicion, probe.data)), 'Otra regla coincide con la prueba artificial');
 }
 await call(carrier.usuario.email, `/manifiestos/${incident.id}/incidente`, 'POST', { tipoIncidente: 'QA', descripcion: 'Incidente artificial' });
 await call(opEmail, `/manifiestos/${rejected.id}/rechazar`, 'POST', { motivo: 'Rechazo artificial QA' });
 await call(opEmail, `/manifiestos/${weighed.id}/pesaje`, 'POST', { residuos: [{ id: weighed.residuos[0].id, cantidadRecibida: 12 }] });
 const cases = [
  { key: 'incident', manifest: incident, owner: opUser.id, title: '⚠️ Incidente en Tránsito', role: 'OPERADOR', activity: opActivity.id },
  { key: 'rejection', manifest: rejected, owner: generator.usuarioId, title: '❌ Carga Rechazada', role: 'GENERADOR', activity: activity.id },
  { key: 'weighing', manifest: weighed, owner: generator.usuarioId, title: '⚖️ Diferencia de Peso Detectada', role: 'GENERADOR', activity: activity.id },
 ];
 const report: any = { synthetic: true, baseline, cases: {} };
 const representativeNotices = new Map<string, any>();
 for (const item of cases) {
  await waitFor(async () => await db.notificacion.count({ where: { manifiestoId: item.manifest.id, titulo: item.title, usuarioId: item.owner } }) === 1);
  if (!baseline) await waitFor(async () => await db.notificacion.count({ where: { manifiestoId: item.manifest.id, titulo: item.title, usuarioId: member.id } }) === 1);
  const ownerCount = await db.notificacion.count({ where: { manifiestoId: item.manifest.id, titulo: item.title, usuarioId: item.owner } });
  const representative = await db.notificacion.findMany({ where: { manifiestoId: item.manifest.id, titulo: item.title, usuarioId: member.id } });
  assert.equal(ownerCount, 1); assert.equal(representative.length, baseline ? 0 : 1);
  if (!baseline) {
   const data = JSON.parse(representative[0].datos); assert.equal(data.destino, 'representante');
   assert.equal(data.accesosEmpresa[0].rol, item.role); assert.equal(data.accesosEmpresa[0].actividadId, item.activity);
   const visible = await call(fixture.member, '/notificaciones/' + representative[0].id);
   assert.equal(visible.manifiestoId, item.manifest.id);
   representativeNotices.set(item.key, { ...item, notice: representative[0] });
  }
  report.cases[item.key] = { owner: ownerCount, representative: representative.length };
 }
 if (!baseline) {
  // Revoking an activity or changing its permitted site must hide the notice,
  // even when the same person has another valid role on the manifest.
  try {
   for (const key of ['rejection', 'weighing']) {
    const item = representativeNotices.get(key);
    for (const reason of ['other-site', 'revoked']) {
     await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: reason === 'other-site'
      ? { todosEstablecimientos: false, establecimientoIds: ['qa-sede-distinta'] } : { activa: false } });
     const hidden = await call(fixture.member, '/notificaciones/' + item.notice.id);
     assert.equal(hidden.titulo, 'Aviso no disponible'); assert.equal(hidden.manifiestoId, null);
     assert.doesNotMatch(JSON.stringify(hidden), new RegExp(item.manifest.numero));
     await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: grant.activa,
      todosEstablecimientos: grant.todosEstablecimientos, establecimientoIds: grant.establecimientoIds, updatedAt: grant.updatedAt } });
    }
   }
   const item = representativeNotices.get('incident');
   await db.autorizacionEmpresa.update({ where: { id: opGrant.id }, data: { activa: false } });
   const hidden = await call(fixture.member, '/notificaciones/' + item.notice.id);
   assert.equal(hidden.titulo, 'Aviso no disponible'); assert.equal(hidden.manifiestoId, null);
   assert.doesNotMatch(JSON.stringify(hidden), new RegExp(item.manifest.numero));
  } finally {
   await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: grant.activa,
    todosEstablecimientos: grant.todosEstablecimientos, establecimientoIds: grant.establecimientoIds, updatedAt: grant.updatedAt } });
   await db.autorizacionEmpresa.update({ where: { id: opGrant.id }, data: { activa: opGrant.activa,
    todosEstablecimientos: opGrant.todosEstablecimientos, establecimientoIds: opGrant.establecimientoIds, updatedAt: opGrant.updatedAt } });
  }
  const item = representativeNotices.get('weighing');
  assert.equal((await call(fixture.member, '/notificaciones/' + item.notice.id)).manifiestoId, item.manifest.id);
  await call(admin.email, '/notificaciones/' + item.notice.id, 'GET', undefined, {}, 404);
  writeFileSync(path.join(out, 'default-notice-browser.json'), JSON.stringify({ synthetic: true, member: fixture.member,
   manifestId: item.manifest.id, numero: item.manifest.numero, notice: item.notice.id, title: item.title,
   company: company.id, activity: activity.id, site: site.id }, null, 2), { mode: 0o600 });
  report.representativeScopeRechecked = true; report.otherAccountDenied = true;
 }
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 report.noMailAttempts = true; report.noPush = true;
 writeFileSync(path.join(out, baseline ? 'default-notices-baseline.json' : 'default-notices-fixed.json'), JSON.stringify(report, null, 2));
 console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
