import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026102943';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.ENTERPRISE_ENABLED, 'true'); assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const fixture = JSON.parse(readFileSync(path.join(out, 'state-notice-company-private.json'), 'utf8'));
assert.match(fixture.member, /@night-qa\.invalid$/);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:3037/api', tokens = new Map<string, string>();
async function call(email: string, route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}, status = 200) {
 assert.match(email, /@night-qa\.invalid$/);
 if (!tokens.has(email)) {
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json',
   Cookie: `sitrep_qa_client=127.13.26.${tokens.size + 1}` }, body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
  const data = await login.json() as any; assert.equal(login.status, 200); tokens.set(email, data.data.tokens.accessToken);
 }
 const response = await fetch(base + route, { method, headers: { Authorization: 'Bearer ' + tokens.get(email),
  ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
 const result = await response.json() as any; assert.equal(response.status, status, route + ' ' + JSON.stringify(result)); return result.data;
}
try {
 const [member, generator, defaultCarrier, defaultOperator] = await Promise.all([
  db.usuario.findUniqueOrThrow({ where: { email: fixture.member } }),
  db.generador.findFirstOrThrow({ where: { usuario: { email: 'generador@night-qa.invalid' } } }),
  db.transportista.findFirstOrThrow({ where: { usuario: { email: 'transportista@night-qa.invalid' } } }),
  db.operador.findFirstOrThrow({ where: { usuario: { email: 'operador@night-qa.invalid' } } }),
 ]);
 assert.match(generator.razonSocial, /^QA /); assert.match(defaultCarrier.razonSocial, /^QA /); assert.match(defaultOperator.razonSocial, /^QA /);
 const results = [];
 for (const role of ['TRANSPORTISTA', 'OPERADOR'] as const) {
  const activity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: fixture.company, rol: role, activa: true } });
  const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: member.id } } });
  assert.equal(grant.activa, true); assert.ok(grant.todosEstablecimientos || grant.establecimientoIds.includes(fixture.site));
  const carrier = role === 'TRANSPORTISTA' ? await db.transportista.findUniqueOrThrow({ where: { id: activity.actorId } }) : defaultCarrier;
  const operator = role === 'OPERADOR' ? await db.operador.findUniqueOrThrow({ where: { id: activity.actorId } }) : defaultOperator;
  assert.match(carrier.razonSocial, /^QA /); assert.match(operator.razonSocial, /^QA /);
  const manifest = await db.manifiesto.create({ data: { numero: `QA-STATE-ROLE-${role}-${randomUUID().slice(0, 8)}`,
   generadorId: generator.id, transportistaId: carrier.id, operadorId: operator.id, creadoPorId: generator.usuarioId,
   estado: 'APROBADO', modalidad: 'FIJO', isDemoData: true, contextoEmpresa: { empresaId: fixture.company, establecimientoId: fixture.site } } });
  const proposal = { version: 2, modalidad: 'FIJO', generadorId: generator.id, transportistaId: carrier.id,
   operadorId: operator.id, creadoPorId: generator.usuarioId, autorRol: 'GENERADOR' };
  await db.eventoManifiesto.createMany({ data: [
   { manifiestoId: manifest.id, tipo: 'PROPUESTA_PARTES_V1', descripcion: JSON.stringify(proposal), usuarioId: generator.usuarioId },
   { manifiestoId: manifest.id, tipo: 'FIRMA', descripcion: 'Aprobación QA', usuarioId: generator.usuarioId },
   { manifiestoId: manifest.id, tipo: 'APROBACION_TRANSPORTISTA', descripcion: 'Aprobación QA', usuarioId: carrier.usuarioId },
   { manifiestoId: manifest.id, tipo: 'APROBACION_OPERADOR', descripcion: 'Aprobación QA', usuarioId: operator.usuarioId },
   { manifiestoId: manifest.id, tipo: 'INICIO_COORDINACION', descripcion: 'Coordinación QA', usuarioId: generator.usuarioId },
  ] });
  await call('admin@night-qa.invalid', `/manifiestos/${manifest.id}/confirmar-retiro`, 'POST', {});
  if (role === 'OPERADOR') {
   await call('admin@night-qa.invalid', `/manifiestos/${manifest.id}/confirmar-entrega`, 'POST', {});
   await call('admin@night-qa.invalid', `/manifiestos/${manifest.id}/confirmar-recepcion`, 'POST', {});
  }
  const expected = role === 'TRANSPORTISTA' ? 'EN_TRANSITO' : 'RECIBIDO';
  const notices = await db.notificacion.findMany({ where: { manifiestoId: manifest.id, usuarioId: member.id } });
  const found = notices.filter((notice: any) => JSON.parse(notice.datos || '{}').estado === expected);
  assert.equal(found.length, 1);
  const metadata = JSON.parse(found[0].datos); assert.equal(metadata.destino, 'representante');
  assert.ok(metadata.accesosEmpresa.some((access: any) => access.rol === role && access.actividadId === activity.id && access.establecimientoId === fixture.site));
  const detail = await call(fixture.member, '/notificaciones/' + found[0].id); assert.equal(detail.manifiestoId, manifest.id);
  const headers = { 'X-SITREP-Empresa': fixture.company, 'X-SITREP-Empresa-Actividad': activity.id, 'X-SITREP-Establecimiento': fixture.site };
  await call(fixture.member, '/manifiestos/' + manifest.id, 'GET', undefined, headers);
  try {
   await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: false } });
   const hidden = await call(fixture.member, '/notificaciones/' + found[0].id);
   assert.equal(hidden.manifiestoId, null); assert.equal(hidden.titulo, 'Aviso no disponible');
   await call(fixture.member, '/manifiestos/' + manifest.id, 'GET', undefined, headers, 403);
  } finally {
   await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: grant.activa,
    todosEstablecimientos: grant.todosEstablecimientos, establecimientoIds: grant.establecimientoIds, updatedAt: grant.updatedAt } });
  }
  const restored = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: grant.id } });
  assert.equal(restored.activa, grant.activa); assert.equal(restored.todosEstablecimientos, grant.todosEstablecimientos);
  assert.deepEqual(restored.establecimientoIds, grant.establecimientoIds);
  results.push({ role, state: expected, noticeCount: found.length, revokedHidden: true, dossierDenied: true, grantRestored: true });
 }
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 const proof = { synthetic: true, results, emailAttempts: 0, emailSent: 0, pushEnabled: false };
 writeFileSync(path.join(out, 'state-notice-role-matrix-proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
