import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-operational-ui-current2026102944');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const proposalsOff = process.env.SITREP_QA_PROPOSALS_OFF === 'true';
assert.equal(process.env.MANIFEST_PROPOSALS_ENABLED, proposalsOff ? 'false' : 'true');
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-uiux-final-7c057295-20261027/onboarding-ux-fixture.json', 'utf8'));
const base = 'http://127.0.0.1:3037/api', tokens = new Map<string, string>(), run = randomUUID().slice(0, 8);
async function call(email: string, route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
 assert.match(email, /@night-qa\.invalid$/);
 if (!tokens.has(email)) {
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json',
   Cookie: `sitrep_qa_client=127.13.24.${tokens.size + 1}` }, body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
  const data = await login.json() as any; assert.equal(login.status, 200); tokens.set(email, data.data.tokens.accessToken);
 }
 const response = await fetch(base + route, { method, headers: { Authorization: 'Bearer ' + tokens.get(email),
  ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
 return { status: response.status, body: await response.json() as any };
}
try {
 const company = await db.empresa.findUniqueOrThrow({ where: { id: fixture.companyId } }); assert.match(company.razonSocial, /QA/i);
 const activity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: company.id, rol: 'GENERADOR', activa: true } });
 const [generator, member, carrier, operator, admin] = await Promise.all([
  db.generador.findUniqueOrThrow({ where: { id: activity.actorId }, include: { usuario: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: fixture.member } }),
  db.transportista.findFirstOrThrow({ where: { usuario: { email: 'transportista@night-qa.invalid' } }, include: { usuario: true } }),
  db.operador.findFirstOrThrow({ where: { usuario: { email: 'operador@night-qa.invalid' } }, include: { usuario: true } }),
  db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
 ]);
 assert.match(fixture.member, /@night-qa\.invalid$/); assert.equal(generator.usuario.email, fixture.owner);
 assert.match(carrier.razonSocial, /^QA /); assert.match(operator.razonSocial, /^QA /);
 const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: member.id } } });
 assert.equal(grant.activa, true);
 const site = await db.establecimientoEmpresa.findFirstOrThrow({ where: { empresaId: company.id, activo: true,
  ...(grant.todosEstablecimientos ? {} : { id: { in: grant.establecimientoIds } }) } });
 const mk = (suffix: string, estado: string, modalidad = 'FIJO') => db.manifiesto.create({ data: {
  numero: `QA-REVERSION-${run}-${suffix}`, generadorId: generator.id, transportistaId: carrier.id, operadorId: operator.id,
  creadoPorId: generator.usuarioId, estado, modalidad, isDemoData: true,
  contextoEmpresa: { empresaId: company.id, establecimientoId: site.id },
 } });
 const cases: Record<string, { manifestId: string; numero: string; notice: string }> = {};
 assert.equal((await call(admin.email, '/auth/profile')).status, 200);
 for (const surface of ['web-desktop', 'app', 'access']) {
  const manifest = await mk(surface.toUpperCase(), 'ENTREGADO');
  const route = `/manifiestos/${manifest.id}/revertir-estado`;
  const forbidden = await call(carrier.usuario.email, route, 'POST', { estadoNuevo: 'EN_TRANSITO', motivo: 'Corrección artificial QA' });
  assert.equal(forbidden.status, 403);
  const responses = await Promise.all([call(admin.email, route, 'POST', { estadoNuevo: 'EN_TRANSITO', motivo: 'Corrección artificial QA' }),
   call(admin.email, route, 'POST', { estadoNuevo: 'EN_TRANSITO', motivo: 'Corrección artificial QA' })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
  assert.equal((await db.manifiesto.findUniqueOrThrow({ where: { id: manifest.id } })).estado, 'EN_TRANSITO');
  assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: manifest.id, tipo: 'REVERSION' } }), 1);
  const notices = await db.notificacion.findMany({ where: { manifiestoId: manifest.id, usuarioId: member.id } });
  const reversion = notices.filter((n: any) => JSON.parse(n.datos || '{}').tipo === 'reversion_manifiesto');
  assert.equal(reversion.length, 1); assert.equal(reversion[0].titulo, 'Estado del manifiesto corregido');
  assert.match(reversion[0].mensaje, /de entregado a en tránsito/);
  assert.equal(JSON.parse(reversion[0].datos).accesosEmpresa[0].establecimientoId, site.id);
  cases[surface] = { manifestId: manifest.id, numero: manifest.numero, notice: reversion[0].id };
 }
 const checked = cases.access;
 assert.equal((await call(fixture.member, '/notificaciones/' + checked.notice)).body.data.manifiestoId, checked.manifestId);
 assert.equal((await call('generador2@night-qa.invalid', '/notificaciones/' + checked.notice)).status, 404);
 try {
  await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: false } });
  const hidden = await call(fixture.member, '/notificaciones/' + checked.notice);
  assert.equal(hidden.body.data.manifiestoId, null); assert.equal(hidden.body.data.titulo, 'Aviso no disponible');
  assert.doesNotMatch(JSON.stringify(hidden.body), new RegExp(checked.numero));
 } finally { await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: grant.activa, updatedAt: grant.updatedAt } }); }
 const blocked: Record<string, number> = {};
 const legacyCases: Record<string, { draftId: string; draftNumber: string; oldId: string; oldNumber: string }> = {};
 for (const mode of ['FIJO', 'IN_SITU']) {
  const draft = await mk('DRAFT-' + mode, 'BORRADOR', mode);
  const signed = await call(generator.usuario.email, `/manifiestos/${draft.id}/firmar`, 'POST', {});
  blocked['singleSignature' + mode] = signed.status; assert.equal(signed.status, 409);
  assert.equal((await db.manifiesto.findUniqueOrThrow({ where: { id: draft.id } })).estado, 'BORRADOR');
  assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: draft.id, tipo: 'FIRMA' } }), 0);
  const old = await mk('OLD-' + mode, 'APROBADO', mode);
  legacyCases[mode] = { draftId: draft.id, draftNumber: draft.numero, oldId: old.id, oldNumber: old.numero };
  const attempt = mode === 'FIJO' ? await call(carrier.usuario.email, `/manifiestos/${old.id}/confirmar-retiro`, 'POST', {})
   : await call(operator.usuario.email, `/manifiestos/${old.id}/recepcion-insitu`, 'POST', {});
  blocked['legacyStart' + mode] = attempt.status; assert.equal(attempt.status, 409);
  assert.equal((await db.manifiesto.findUniqueOrThrow({ where: { id: old.id } })).estado, 'APROBADO');
 }
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 if (!proposalsOff) writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'reversion-notices-private.json'), JSON.stringify({ member: fixture.member, owner: fixture.owner, cases, legacyCases }, null, 2), { mode: 0o600 });
 const proof = { synthetic: true, proposalsEnabled: !proposalsOff, reversionRaceCases: 3, oneEventAndNoticePerCase: true, unauthorizedDenied: true,
  revokedAccessHidden: true, blocked, emailAttempts: 0, emailSent: 0, pushEnabled: false };
 writeFileSync(path.join(process.env.QA_ARTIFACTS!, proposalsOff ? 'reversion-notices-flag-off-proof.json' : 'reversion-notices-proof.json'), JSON.stringify(proof, null, 2));
 console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
