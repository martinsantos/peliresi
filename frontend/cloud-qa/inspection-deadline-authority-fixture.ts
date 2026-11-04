import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-deadline-company-20261030';
const polished = process.env.QA_AUTHORITY_RUN === 'polished';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, polished ? 'inspection-deadline-polished' : 'inspection-deadline-authority');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const prior = JSON.parse(readFileSync(path.join(out, 'fixture.json'), 'utf8'));
const original = JSON.parse(readFileSync(path.join(out, 'fixture-before1.json'), 'utf8'));
const template = prior.cases['web-desktop'].find((item: any) => item.role === 'GENERADOR'); assert.ok(template);
const dist = path.join(root, 'backend/dist-qa-psip-deadline-company-20261030-' + (polished ? 'v6' : 'v5'));
const db = backendRequire(path.join(dist, 'lib/prisma.js')).default;
const { ejecutarCatalogo } = backendRequire(path.join(dist, 'jobs/alertCatalogue.job.js'));
const { buildInspectionExchangeDigests } = backendRequire(path.join(dist, 'services/inspectionExchange.service.js'));
let rule: any, done = false;
try {
  const activity = await db.empresaActividad.findUniqueOrThrow({ where: { id: template.activityId } });
  const company = await db.empresa.findUniqueOrThrow({ where: { id: template.companyId } });
  assert.match(company.razonSocial, /^QA Empresa /); assert.ok(activity.activa && activity.rol === 'GENERADOR');
  const actor = await db.generador.findUniqueOrThrow({ where: { id: activity.actorId }, include: { usuario: true } });
  const admin = await db.usuario.findUniqueOrThrow({ where: { id: original.adminId } });
  assert.match(actor.usuario.email, /^psip-owner-.*@night-qa\.invalid$/); assert.equal(admin.email, 'admin@night-qa.invalid');
  assert.ok(actor.activo && actor.usuario.activo && actor.usuario.rol === 'GENERADOR' && admin.activo && admin.rol === 'ADMIN');
  const now = new Date(), records: any[] = [];
  for (const surface of ['web-desktop', 'app']) {
    const inspection = await db.inspeccion.create({ data: { numero: 'QA-DEADLINE-AUTH-' + randomUUID(), tipoActor: 'GENERADOR',
      generadorId: actor.id, inspectorId: admin.id, estado: 'NOTIFICADA', observaciones: 'QA aviso autoridad.' } });
    const fields = { inspeccionId: inspection.id, secuencia: 1, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', destinatario: 'INSPECCIONADO',
      asunto: 'QA requerimiento para autoridad', cuerpo: 'QA artificial de respuesta y aviso a autoridad.',
      plazoRespuestaAt: new Date(now.getTime() - 3_600_000), canal: 'PORTAL_SITREP', versionExpediente: 2,
      autorId: admin.id, createdAt: new Date(now.getTime() - 7_200_000) };
    const entry = await db.intercambioInspeccion.create({ data: { ...fields, ...buildInspectionExchangeDigests({ ...fields, adjuntos: [] }, null), hashAnterior: null } });
    await db.inspeccion.update({ where: { id: inspection.id }, data: { version: 2 } });
    records.push({ surface, inspectionId: inspection.id, requirementId: entry.id, ownerId: actor.usuario.id, email: actor.usuario.email });
  }
  rule = await db.reglaAlerta.create({ data: { nombre: 'QA vencimiento autoridad ' + randomUUID(), descripcion: 'Regla artificial para autoridad.',
    evento: 'TIEMPO_EXCESIVO', condicion: '{"tipo":"requerimiento_inspeccion"}', destinatarios: '["INSPECCIONADO","INSPECTOR_ASIGNADO"]', activa: true, creadoPorId: admin.id } });
  const rules = db.reglaAlerta, requests = db.intercambioInspeccion, findRules = rules.findMany.bind(rules), findRequests = requests.findMany.bind(requests);
  rules.findMany = (args: any) => findRules({ ...args, where: { AND: [args.where, { id: rule.id }] } });
  requests.findMany = (args: any) => findRequests({ ...args, where: { AND: [args.where, { id: { in: records.map(item => item.requirementId) } }] } });
  assert.equal(await ejecutarCatalogo(now), 6);
  const cases = await db.alertaGenerada.findMany({ where: { reglaId: rule.id } }); assert.equal(cases.length, 2);
  for (const item of records) {
    const found = cases.find((row: any) => JSON.parse(row.datos).entidadId === item.requirementId); assert.ok(found);
    const notices = await db.notificacion.findMany({ where: { datos: { contains: found.id } } });
    const owner = notices.find((row: any) => row.usuarioId === item.ownerId), authority = notices.find((row: any) => row.usuarioId === admin.id);
    assert.ok(owner && authority); item.caseId = found.id; item.noticeId = owner.id; item.authorityNoticeId = authority.id;
  }
  writeFileSync(path.join(out, polished ? 'fixture-authority-polished.json' : 'fixture-authority.json'), JSON.stringify({ synthetic: true, ruleId: rule.id, adminId: admin.id,
    cases: Object.fromEntries(records.map(item => [item.surface, item])) }, null, 2), { flag: 'wx', mode: 0o600 });
  done = true; console.log('Preparados dos casos artificiales con aviso a autoridad.');
} finally {
  if (rule && !done) await db.reglaAlerta.update({ where: { id: rule.id }, data: { activa: false } });
  await db.$disconnect();
}
