import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-eventual-notices-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
const f = JSON.parse(readFileSync('/work/sitrep/.qa-eventual-site-20261030/fixture.json', 'utf8'));
assert.equal(f.synthetic, true); assert.match(f.owner, /@night-qa\.invalid$/); assert.match(f.member, /@night-qa\.invalid$/);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const mail = backendRequire('/work/sitrep/backend/dist-qa-eventual-notices-20261030/services/notification-mail.service.js');
const base = 'http://127.0.0.1:4177/api';
async function call(token: string | null, route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
 const response = await fetch(base + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
  'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.11.99.1', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
 const json = await response.json(); return { status: response.status, data: json.data, message: json.message };
}
async function login(email: string) {
 const r = await call(null, '/auth/login', 'POST', { email, password: 'OnlyLocal-NightQA-2026!' }); assert.equal(r.status, 200); return r.data.tokens.accessToken as string;
}
const external = (name: string) => ({ nombre: name, identificacion: 'QA sin alta', domicilio: 'QA artificial' });
const headers = (activity: string) => ({ 'X-SITREP-Empresa': f.companyId, 'X-SITREP-Empresa-Actividad': activity });
try {
 const owner = await db.usuario.findUniqueOrThrow({ where: { id: f.ownerId } });
 const member = await db.usuario.findUniqueOrThrow({ where: { id: f.memberId } });
 assert.equal(owner.email, f.owner); assert.equal(owner.rol, 'GENERADOR'); assert.equal(member.email, f.member);
 const operator = await db.operador.findUniqueOrThrow({ where: { usuarioId: owner.id } });
 const opActivity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: f.companyId, rol: 'OPERADOR', actorId: operator.id, activa: true } });
 const genGrant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: f.grantId } });
 const opGrant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: opActivity.id, usuarioId: member.id } } });
 for (const grant of [genGrant, opGrant]) { assert.equal(grant.usuarioId, member.id); assert.equal(grant.activa, true); assert.equal(grant.todosEstablecimientos, true); }
 const adminToken = await login('admin@night-qa.invalid'), ownerToken = await login(f.owner), memberToken = await login(f.member);
 const common = { patente: 'QA-005', motivo: 'QA avisos eventuales artificiales', residuos: [{ corriente: 'Y1', cantidad: 1, unidad: 'kg' }] };
 const recordId = randomUUID();
 const create = await call(adminToken, '/manifiestos/baja-intensidad', 'POST', { ...common, id: recordId,
  generador: { padronId: f.actorId }, transportista: external('QA transporte externo'), operador: { padronId: operator.id } });
 assert.equal(create.status, 201, JSON.stringify(create));
 const rows = await db.notificacion.findMany({ where: { usuarioId: { in: [owner.id, member.id] }, datos: { contains: recordId } } });
 assert.equal(rows.filter((n: any) => n.usuarioId === owner.id).length, 1);
 assert.equal(rows.filter((n: any) => n.usuarioId === member.id).length, 1);
 const ownerNotice = rows.find((n: any) => n.usuarioId === owner.id)!, memberNotice = rows.find((n: any) => n.usuarioId === member.id)!;
 const ownerRead = await call(ownerToken, '/notificaciones/' + ownerNotice.id);
 const memberRead = await call(memberToken, '/notificaciones/' + memberNotice.id);
 assert.equal(ownerRead.status, 200); assert.equal(memberRead.status, 200);
 const ownerData = JSON.parse(ownerRead.data.datos), memberData = JSON.parse(memberRead.data.datos);
 assert.ok(ownerData.actividadesPropias.some((a: any) => a.rol === 'GENERADOR' && a.actorId === f.actorId));
 assert.ok(ownerData.actividadesPropias.some((a: any) => a.rol === 'OPERADOR' && a.actorId === operator.id));
 assert.deepEqual(memberData.accesosEmpresa.map((a: any) => a.rol).sort(), ['GENERADOR', 'OPERADOR']);
 assert.equal((await call(ownerToken, '/notificaciones/' + memberNotice.id)).status, 404);
 assert.equal((await call(memberToken, '/manifiestos/baja-intensidad/' + recordId, 'GET', undefined, headers(f.activityId))).status, 200);
 assert.equal((await call(ownerToken, '/manifiestos/baja-intensidad/' + recordId, 'GET', undefined, { 'X-SITREP-Activity': 'OPERADOR' })).status, 200);
 assert.equal(await mail.notificationSourceEligible(memberNotice, 'manifiestos'), true);
 const rendered = mail.notificationMailContent({ ...memberNotice, email: f.member, activo: true, emailVerified: true, notifEmail: true, rol: member.rol });
 assert.ok(rendered?.html.includes('/notificaciones/' + memberNotice.id)); assert.ok(!rendered.html.includes('QA transporte externo'));
 const approval = await call(ownerToken, '/manifiestos/baja-intensidad/' + recordId + '/eventos', 'POST',
  { id: randomUUID(), version: 0, tipo: 'APROBAR_PARTE', parte: 'generador', nota: '' }, { 'X-SITREP-Activity': 'GENERADOR' });
 assert.equal(approval.status, 200, JSON.stringify(approval));
 const newMemberEvents = await db.notificacion.count({ where: { usuarioId: member.id, datos: { contains: recordId } } }); assert.equal(newMemberEvents, 2);
 const authorEvents = await db.notificacion.findMany({ where: { usuarioId: owner.id, datos: { contains: recordId } } });
 assert.equal(authorEvents.length, 2); const authorData = JSON.parse(authorEvents.find((n: any) => JSON.parse(n.datos!).eventoId !== 'creacion')!.datos!);
 assert.deepEqual(authorData.actividadesPropias.map((a: any) => a.rol), ['OPERADOR']);
 const adminApproval = await call(adminToken, '/manifiestos/baja-intensidad/' + recordId + '/eventos', 'POST',
  { id: randomUUID(), version: 1, tipo: 'APROBAR_PARTE', parte: 'creador', nota: '' });
 assert.equal(adminApproval.status, 200, JSON.stringify(adminApproval));
 const operatorApproval = await call(ownerToken, '/manifiestos/baja-intensidad/' + recordId + '/eventos', 'POST',
  { id: randomUUID(), version: 2, tipo: 'APROBAR_PARTE', parte: 'operador', nota: '' }, { 'X-SITREP-Activity': 'OPERADOR' });
 assert.equal(operatorApproval.status, 200, JSON.stringify(operatorApproval));
 const moveId = randomUUID(), move = { id: moveId, version: 3, tipo: 'AVANCE', etapa: 'RETIRADO', nota: '' };
 const movement = await call(ownerToken, '/manifiestos/baja-intensidad/' + recordId + '/eventos', 'POST', move, { 'X-SITREP-Activity': 'GENERADOR' });
 assert.equal(movement.status, 200, JSON.stringify(movement));
 const retry = await call(ownerToken, '/manifiestos/baja-intensidad/' + recordId + '/eventos', 'POST', move, { 'X-SITREP-Activity': 'GENERADOR' });
 const otherActivity = await call(ownerToken, '/manifiestos/baja-intensidad/' + recordId + '/eventos', 'POST', move, { 'X-SITREP-Activity': 'OPERADOR' });
 assert.equal(retry.status, 200); assert.equal(otherActivity.status, 409);
 const stored = await db.registroManifiestoExcepcional.findUniqueOrThrow({ where: { id: recordId } });
 const storedMove = (stored.eventos as any[]).find((e: any) => e.id === moveId);
 assert.equal(storedMove.autorRol, 'GENERADOR'); assert.equal(storedMove.autorActorId, f.actorId);
 const moveNotices = await db.notificacion.findMany({ where: { usuarioId: owner.id, datos: { contains: moveId } } });
 assert.equal(moveNotices.length, 1); const moveData = JSON.parse(moveNotices[0].datos!);
 assert.deepEqual(moveData.actividadesPropias.map((a: any) => a.rol), ['OPERADOR']);
 try {
  await db.autorizacionEmpresa.update({ where: { id: genGrant.id }, data: { activa: false, revision: { increment: 1 } } });
  const partial = await call(memberToken, '/notificaciones/' + memberNotice.id);
  assert.equal(partial.status, 200); assert.deepEqual(JSON.parse(partial.data.datos).accesosEmpresa.map((a: any) => a.rol), ['OPERADOR']);
  await db.autorizacionEmpresa.update({ where: { id: opGrant.id }, data: { activa: false, revision: { increment: 1 } } });
  const revoked = await call(memberToken, '/notificaciones/' + memberNotice.id);
  assert.equal(revoked.status, 200); assert.equal(revoked.data.titulo, 'Aviso no disponible'); assert.ok(!JSON.stringify(revoked.data).includes(recordId));
  const listed = await call(memberToken, '/notificaciones?limit=500'); assert.equal(listed.status, 200);
  const listItem = listed.data.notificaciones.find((n: any) => n.id === memberNotice.id); assert.equal(listItem.titulo, 'Aviso no disponible');
  assert.ok(!JSON.stringify(listItem).includes(recordId));
  const marked = await call(memberToken, '/notificaciones/' + memberNotice.id + '/leida', 'PUT');
  assert.equal(marked.status, 200); assert.ok(!JSON.stringify(marked.data).includes(recordId));
  assert.equal(await mail.notificationSourceEligible(memberNotice, 'manifiestos'), false);
  await db.autorizacionEmpresa.update({ where: { id: genGrant.id }, data: { activa: true, todosEstablecimientos: false, establecimientoIds: [f.north], revision: { increment: 1 } } });
  const limitedId = randomUUID();
  const limited = await call(adminToken, '/manifiestos/baja-intensidad', 'POST', { ...common, id: limitedId,
   generador: { padronId: f.actorId }, transportista: external('QA transporte sin alta'), operador: external('QA operador sin alta') });
  assert.equal(limited.status, 201); assert.equal(await db.notificacion.count({ where: { usuarioId: member.id, datos: { contains: limitedId } } }), 0);
 } finally {
  for (const grant of [genGrant, opGrant]) await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: {
   activa: grant.activa, todosEstablecimientos: grant.todosEstablecimientos, establecimientoIds: grant.establecimientoIds, revision: grant.revision } });
 }
 // A separate operator-only notice exercises switching a multi-role owner from its base Generator activity.
 const operatorRecordId = randomUUID();
 const opCreated = await call(adminToken, '/manifiestos/baja-intensidad', 'POST', { ...common, id: operatorRecordId,
  generador: external('QA generador sin alta'), transportista: external('QA transporte sin alta'), operador: { padronId: operator.id } });
 assert.equal(opCreated.status, 201);
 const operatorNotice = await db.notificacion.findFirstOrThrow({ where: { usuarioId: owner.id, datos: { contains: operatorRecordId } } });
 const ownerApproval = await db.solicitudInscripcion.findFirstOrThrow({ where: { usuarioId: owner.id, tipoActor: 'OPERADOR', operadorId: operator.id, estado: 'APROBADA' } });
 const ownerGrant = await db.autorizacionEmpresa.findUnique({ where: { actividadId_usuarioId: { actividadId: opActivity.id, usuarioId: owner.id } } });
 try {
  await db.solicitudInscripcion.update({ where: { id: ownerApproval.id }, data: { estado: 'OBSERVADA' } });
  if (ownerGrant) await db.autorizacionEmpresa.update({ where: { id: ownerGrant.id }, data: { activa: false, revision: { increment: 1 } } });
  const revokedRole = await call(ownerToken, '/notificaciones/' + operatorNotice.id);
  assert.equal(revokedRole.status, 200); assert.equal(revokedRole.data.titulo, 'Aviso no disponible');
  assert.ok(!JSON.stringify(revokedRole.data).includes(operatorRecordId));
  assert.equal(await mail.notificationSourceEligible(operatorNotice, 'manifiestos'), false);
 } finally {
  await db.solicitudInscripcion.update({ where: { id: ownerApproval.id }, data: { estado: ownerApproval.estado } });
  if (ownerGrant) await db.autorizacionEmpresa.update({ where: { id: ownerGrant.id }, data: { activa: ownerGrant.activa, revision: ownerGrant.revision } });
 }
 const fixture = { synthetic: true, member: f.member, owner: f.owner, memberId: member.id, companyId: f.companyId,
  genActivityId: f.activityId, opActivityId: opActivity.id, generatorGrantId: genGrant.id, operatorGrantId: opGrant.id,
  generatorGrantRevision: genGrant.revision, operatorGrantRevision: opGrant.revision, recordId, memberNoticeId: memberNotice.id,
  memberMailHtml: rendered.html, operatorRecordId, operatorNoticeId: operatorNotice.id, operatorActorId: operator.id };
 writeFileSync(path.join(out, 'fixture.json'), JSON.stringify(fixture, null, 2), { mode: 0o600 });
 const result = { synthetic: true, oneNoticePerPerson: true, multiRoleActivities: ownerData.actividadesPropias.map((a: any) => a.rol),
  companyActivities: memberData.accesosEmpresa.map((a: any) => a.rol), approvalNotice: true, movementNoticeOtherRole: true,
  sameActivityRetry: 200, otherActivityRetry: 409, otherAccount: 404,
  revokeOnePreservesOther: true, revokeBothMasksDetailListAndMark: true, limitedSiteReceivesNoNotice: true,
  revokedMultiRoleMasked: true, mailEligibilityRechecked: true, renderedMailOnly: true, emailAndPushDisabled: true };
 writeFileSync(path.join(out, 'integration.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
