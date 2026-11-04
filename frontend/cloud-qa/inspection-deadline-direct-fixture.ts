import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-deadline-company-20261030';
const run = process.env.QA_DIRECT_RUN || ''; assert.ok(['', 'final', 'polished'].includes(run));
const backend = run === 'polished' ? 'inspection-deadline-polished' : run === 'final' ? 'inspection-deadline-authority' : 'inspection-deadline-direct';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, backend);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const prior = JSON.parse(readFileSync(path.join(out, 'fixture.json'), 'utf8'));
const original = JSON.parse(readFileSync(path.join(out, 'fixture-before1.json'), 'utf8'));
assert.match(prior.email, /@night-qa\.invalid$/);
const dist = path.join(root, 'backend/dist-qa-psip-deadline-company-20261030-' + (run === 'polished' ? 'v6' : run === 'final' ? 'v5' : 'v4'));
const db = backendRequire(path.join(dist, 'lib/prisma.js')).default;
const { ejecutarCatalogo } = backendRequire(path.join(dist, 'jobs/alertCatalogue.job.js'));
const { buildInspectionExchangeDigests } = backendRequire(path.join(dist, 'services/inspectionExchange.service.js'));
let rule: any, done = false;
try {
  const now = new Date(), records: any[] = [];
  for (const surface of ['web-desktop', 'app']) for (const template of prior.cases['web-desktop']) {
    const activity = await db.empresaActividad.findUniqueOrThrow({ where: { id: template.activityId } });
    const company = await db.empresa.findUniqueOrThrow({ where: { id: template.companyId } });
    assert.match(company.razonSocial, /^QA Empresa /); assert.ok(activity.activa && activity.rol === template.role);
    const key = template.role.toLowerCase() as 'generador' | 'transportista' | 'operador';
    const actor = await db[key].findUniqueOrThrow({ where: { id: activity.actorId }, include: { usuario: true } });
    assert.match(actor.usuario.email, /^psip-owner-.*@night-qa\.invalid$/);
    assert.ok(actor.activo && actor.usuario.activo && actor.usuario.rol === template.role);
    const id = randomUUID(), inspection = await db.inspeccion.create({ data: { numero: 'QA-DEADLINE-DIRECT-' + id,
      tipoActor: template.role, [`${key}Id`]: actor.id, inspectorId: original.adminId, estado: 'NOTIFICADA', observaciones: 'QA aviso directo.' } });
    const fields = { inspeccionId: inspection.id, secuencia: 1, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', destinatario: 'INSPECCIONADO',
      asunto: 'QA requerimiento directo vencido', cuerpo: 'QA artificial de respuesta y aviso directo.',
      plazoRespuestaAt: new Date(now.getTime() - 3_600_000), canal: 'PORTAL_SITREP', versionExpediente: 2,
      autorId: original.adminId, createdAt: new Date(now.getTime() - 7_200_000) };
    const entry = await db.intercambioInspeccion.create({ data: { ...fields, ...buildInspectionExchangeDigests({ ...fields, adjuntos: [] }, null), hashAnterior: null } });
    await db.inspeccion.update({ where: { id: inspection.id }, data: { version: 2 } });
    records.push({ surface, role: template.role, inspectionId: inspection.id, requirementId: entry.id,
      ownerId: actor.usuario.id, email: actor.usuario.email });
  }
  rule = await db.reglaAlerta.create({ data: { nombre: 'QA vencimiento directo ' + randomUUID(), descripcion: 'Regla artificial de aviso directo.',
    evento: 'TIEMPO_EXCESIVO', condicion: '{"tipo":"requerimiento_inspeccion"}', destinatarios: '["INSPECCIONADO"]', activa: true, creadoPorId: original.adminId } });
  const rules = db.reglaAlerta, requests = db.intercambioInspeccion, findRules = rules.findMany.bind(rules), findRequests = requests.findMany.bind(requests);
  rules.findMany = (args: any) => findRules({ ...args, where: { AND: [args.where, { id: rule.id }] } });
  requests.findMany = (args: any) => findRequests({ ...args, where: { AND: [args.where, { id: { in: records.map(item => item.requirementId) } }] } });
  assert.equal(await ejecutarCatalogo(now), 12);
  const cases = await db.alertaGenerada.findMany({ where: { reglaId: rule.id } }); assert.equal(cases.length, 6);
  for (const item of records) {
    const found = cases.find((row: any) => JSON.parse(row.datos).entidadId === item.requirementId); assert.ok(found);
    const notices = await db.notificacion.findMany({ where: { usuarioId: item.ownerId, datos: { contains: found.id } } });
    assert.equal(notices.length, 1); item.caseId = found.id; item.noticeId = notices[0].id;
  }
  const groups = Object.fromEntries(['web-desktop', 'app'].map(surface => [surface, records.filter(item => item.surface === surface)]));
  writeFileSync(path.join(out, `fixture-direct${run ? '-' + run : ''}.json`), JSON.stringify({ synthetic: true, ruleId: rule.id, cases: groups }, null, 2), { flag: 'wx', mode: 0o600 });
  done = true; console.log('Preparados seis avisos directos artificiales para web y app.');
} finally {
  if (rule && !done) await db.reglaAlerta.update({ where: { id: rule.id }, data: { activa: false } });
  await db.$disconnect();
}
