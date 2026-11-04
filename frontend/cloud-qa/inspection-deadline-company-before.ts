import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-deadline-company-20261030';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, 'inspection-deadline-company-before');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.ENTERPRISE_ENABLED, 'true'); assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const prior = JSON.parse(readFileSync('/work/sitrep/.qa-inspection-representative-20261030/inspection-company-fixture.json', 'utf8'));
assert.match(prior.email, /@night-qa\.invalid$/);
const dist = path.join(root, 'backend/dist-qa-psip-company-20261030-v2');
const db = backendRequire(path.join(dist, 'lib/prisma.js')).default;
const { buildInspectionExchangeDigests } = backendRequire(path.join(dist, 'services/inspectionExchange.service.js'));
const { ejecutarCatalogo } = backendRequire(path.join(dist, 'jobs/alertCatalogue.job.js'));
const attempt = process.env.QA_ATTEMPT || 'before1'; assert.match(attempt, /^[a-z0-9-]{1,30}$/);
let rule: any;
try {
 const member = await db.usuario.findUniqueOrThrow({ where: { email: prior.email } });
 const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
 const now = new Date(), records: any[] = [];
 for (const item of prior.cases['web-desktop']) {
  const activity = await db.empresaActividad.findUniqueOrThrow({ where: { id: item.activityId } });
  const company = await db.empresa.findUniqueOrThrow({ where: { id: item.companyId } });
  const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: member.id } } });
  assert.match(company.razonSocial, /^QA Empresa /); assert.ok(grant.activa && grant.todosEstablecimientos && activity.activa);
  const role = item.role as 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR', key = role.toLowerCase() as 'generador' | 'transportista' | 'operador';
  const actor = await db[key].findUniqueOrThrow({ where: { id: activity.actorId }, include: { usuario: true } });
  assert.match(actor.email, /@night-qa\.invalid$/); assert.match(actor.razonSocial, /^QA Empresa /);
  const id = randomUUID();
  const inspection = await db.inspeccion.create({ data: { numero: 'QA-DEADLINE-REP-' + id, tipoActor: role,
   [`${key}Id`]: actor.id, inspectorId: admin.id, estado: 'NOTIFICADA', observaciones: 'QA artificial: requerimiento vencido.' } });
  const createdAt = new Date(now.getTime() - 7_200_000), deadline = new Date(now.getTime() - 3_600_000);
  const fields = { inspeccionId: inspection.id, secuencia: 1, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', destinatario: 'INSPECCIONADO',
   asunto: 'QA requerimiento vencido', cuerpo: 'QA comprobación artificial del aviso de plazo vencido.', plazoRespuestaAt: deadline,
   canal: 'PORTAL_SITREP', versionExpediente: 2, autorId: admin.id, createdAt };
  const entry = await db.intercambioInspeccion.create({ data: { ...fields, ...buildInspectionExchangeDigests({ ...fields, adjuntos: [] }, null), hashAnterior: null } });
  await db.inspeccion.update({ where: { id: inspection.id }, data: { version: 2 } });
  records.push({ role, inspectionId: inspection.id, requirementId: entry.id, companyId: company.id, activityId: activity.id, ownerId: actor.usuarioId });
 }
 rule = await db.reglaAlerta.create({ data: { nombre: 'QA vencimiento representante ' + randomUUID(), descripcion: 'Regla sintética para prueba aislada.',
  evento: 'TIEMPO_EXCESIVO', condicion: '{"tipo":"requerimiento_inspeccion"}', destinatarios: '["INSPECCIONADO"]', activa: true, creadoPorId: admin.id } });
 writeFileSync(path.join(out, 'fixture-' + attempt + '.json'), JSON.stringify({ synthetic: true, email: prior.email,
  memberId: member.id, adminId: admin.id, ruleId: rule.id, now: now.toISOString(), records }, null, 2), { flag: 'wx', mode: 0o600 });
 // Restrict only the test process's scan to its own rule and requirements.
 // Source reads, transactions, upserts and recipient selection are the compiled job.
 const ruleDelegate = db.reglaAlerta, requirementDelegate = db.intercambioInspeccion;
 const findRules = ruleDelegate.findMany.bind(ruleDelegate), findRequirements = requirementDelegate.findMany.bind(requirementDelegate);
 ruleDelegate.findMany = (args: any) => findRules({ ...args, where: { AND: [args.where, { id: rule.id }] } });
 requirementDelegate.findMany = (args: any) => findRequirements({ ...args, where: { AND: [args.where, { id: { in: records.map(r => r.requirementId) } }] } });
 assert.equal((await ruleDelegate.findMany({ where: { activa: true } })).length, 1);
 assert.equal(await ejecutarCatalogo(now), 3);
 const cases = await db.alertaGenerada.findMany({ where: { reglaId: rule.id } }); assert.equal(cases.length, 3);
 for (const record of records) {
  const found = cases.find((row: any) => JSON.parse(row.datos).entidadId === record.requirementId); assert.ok(found);
  const notices = await db.notificacion.findMany({ where: { datos: { contains: found.id } } });
  assert.deepEqual(notices.map((notice: any) => notice.usuarioId), [record.ownerId]);
  record.caseId = found.id;
 }
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 writeFileSync(path.join(out, 'reproduction-' + attempt + '.json'), JSON.stringify({ synthetic: true, production: false,
  roles: records.map(r => r.role), ownerNotices: 3, representativeNotices: 0, records, ruleId: rule.id, now: now.toISOString() }, null, 2), { flag: 'wx', mode: 0o600 });
 console.log('Reproducido: tres titulares reciben el vencimiento, la persona representante no.');
} finally {
 if (rule) await db.reglaAlerta.update({ where: { id: rule.id }, data: { activa: false } });
 await db.$disconnect();
}
