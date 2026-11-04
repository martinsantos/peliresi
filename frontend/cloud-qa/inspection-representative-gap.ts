import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-inspection-representative-20261030');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.ENTERPRISE_ENABLED, 'true');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-uiux-final-7c057295-20261027/onboarding-ux-fixture.json', 'utf8'));
assert.match(fixture.owner, /@night-qa\.invalid$/); assert.match(fixture.member, /@night-qa\.invalid$/);
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const base = 'http://127.0.0.1:3037/api';
async function login(email: string, suffix: number) {
  assert.match(email, /@night-qa\.invalid$/);
  const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json',
    Cookie: `sitrep_qa_client=127.11.80.${suffix}` }, body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(response.status, 200); return (await response.json() as any).data.tokens.accessToken as string;
}
try {
  const company = await db.empresa.findUniqueOrThrow({ where: { id: fixture.companyId } });
  const activity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: company.id, rol: 'GENERADOR', activa: true } });
  const [actor, member, admin] = await Promise.all([
    db.generador.findUniqueOrThrow({ where: { id: activity.actorId }, include: { usuario: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: fixture.member } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
  ]);
  assert.match(company.razonSocial, /QA/i); assert.match(actor.razonSocial, /^QA /);
  assert.equal(actor.usuario.email, fixture.owner); assert.ok(company.activa && actor.activo && member.activo && member.emailVerified);
  const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: member.id } } });
  assert.ok(grant.activa && grant.todosEstablecimientos);
  const run = randomUUID();
  const inspection = await db.inspeccion.create({ data: { numero: 'QA-PSIP-REP-' + run,
    tipoActor: 'GENERADOR', generadorId: actor.id, inspectorId: admin.id, estado: 'NOTIFICADA',
    observaciones: 'Expediente artificial para reproducir un aviso al representante.' } });
  const [authority, representative] = await Promise.all([login(admin.email, 1), login(member.email, 2)]);
  const response = await fetch(`${base}/inspecciones/${inspection.id}/intercambios`, { method: 'POST',
    headers: { Authorization: 'Bearer ' + authority, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: 1, clienteId: 'qa_psip_rep_' + run, tipo: 'REQUERIMIENTO',
      asunto: 'QA requerimiento para representante', cuerpo: 'Solicitud artificial para probar el aviso y su respuesta.' }) });
  assert.equal(response.status, 201, await response.text());
  const [ownerNotices, representativeNotices, authorized, personal] = await Promise.all([
    db.notificacion.findMany({ where: { usuarioId: actor.usuarioId, datos: { contains: inspection.id } } }),
    db.notificacion.findMany({ where: { usuarioId: member.id, datos: { contains: inspection.id } } }),
    fetch(`${base}/inspecciones/${inspection.id}/intercambios`, { headers: { Authorization: 'Bearer ' + representative,
      'X-SITREP-Empresa': company.id, 'X-SITREP-Empresa-Actividad': activity.id } }),
    fetch(`${base}/inspecciones/${inspection.id}/intercambios`, { headers: { Authorization: 'Bearer ' + representative } }),
  ]);
  assert.equal(ownerNotices.length, 1); assert.equal(representativeNotices.length, 0);
  assert.equal(authorized.status, 200); assert.equal(personal.status, 403);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  writeFileSync(process.env.QA_ARTIFACTS + '/gap.json', JSON.stringify({ synthetic: true, production: false,
    inspectionId: inspection.id, companyId: company.id, activityId: activity.id, actorId: actor.id,
    ownerId: actor.usuarioId, memberId: member.id, memberEmail: member.email,
    ownerNotices: ownerNotices.length, representativeNotices: representativeNotices.length,
    authorizedStatus: authorized.status, personalStatus: personal.status, emailAttempts: 0, emailSent: 0 }) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Reproducción artificial: titular avisado; representante autorizado puede abrir el requerimiento, pero no recibió aviso.');
} finally { await db.$disconnect(); }
