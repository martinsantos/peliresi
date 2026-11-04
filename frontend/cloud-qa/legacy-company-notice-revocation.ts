import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026102943';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const mode = process.argv[2]; assert.ok(mode === 'baseline' || mode === 'fixed');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const report = JSON.parse(readFileSync(path.join(out, 'company-workflow-notices.json'), 'utf8'));
const fixture = JSON.parse(readFileSync(path.join(out, 'onboarding-ux-fixture.json'), 'utf8'));
assert.match(fixture.owner, /@night-qa\.invalid$/); assert.match(fixture.member, /@night-qa\.invalid$/);
const base = 'http://127.0.0.1:3037/api', tokens = new Map<string, string>();
async function call(email: string, route: string, method = 'GET', body?: unknown, status = 200) {
 assert.match(email, /@night-qa\.invalid$/);
 if (!tokens.has(email)) {
  const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json',
   Cookie: `sitrep_qa_client=127.13.24.${tokens.size + 1}` }, body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
  const login = await response.json() as any; assert.equal(response.status, 200); tokens.set(email, login.data.tokens.accessToken);
 }
 const response = await fetch(base + route, { method, headers: { Authorization: 'Bearer ' + tokens.get(email),
  ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
 const result = await response.json() as any; assert.equal(response.status, status, route + ' ' + JSON.stringify(result)); return result.data;
}
try {
 const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: report.manifest.id }, include: { residuos: true } });
 assert.equal(manifest.isDemoData, true); assert.match(manifest.numero, /^2026-/);
 const member = await db.usuario.findUniqueOrThrow({ where: { email: fixture.member } });
 const owner = await db.usuario.findUniqueOrThrow({ where: { email: fixture.owner } });
 const activity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: fixture.companyId, rol: 'GENERADOR', activa: true } });
 const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: member.id } } });
 assert.equal(grant.activa, true);
 const privatePath = path.join(out, 'legacy-company-notice-private.json');
 let stored: any;
 if (existsSync(privatePath)) stored = JSON.parse(readFileSync(privatePath, 'utf8'));
 else {
  assert.equal(mode, 'baseline'); assert.equal(manifest.estado, 'RECIBIDO');
  const method = (await db.tratamientoAutorizado.findFirst({ where: { operadorId: manifest.operadorId, activo: true } }))?.metodo || 'QA tratamiento';
  await call('operador@night-qa.invalid', `/manifiestos/${manifest.id}/tratamiento`, 'POST', { metodo: method });
  const sharp = backendRequire('sharp');
  const signature = 'data:image/png;base64,' + (await sharp(Buffer.from('<svg width="300" height="100"><rect width="300" height="100" fill="white"/><path d="M10 70 L40 20 L80 75 L120 15 L180 80 L270 30" stroke="black" stroke-width="3" fill="none"/></svg>')).png().toBuffer()).toString('base64');
  const issued = await call('operador@night-qa.invalid', `/manifiestos/${manifest.id}/certificados`, 'POST',
   { id: randomUUID(), tipo: 'PARCIAL', firma: signature, metodo: method, cantidades: [{ residuoId: manifest.residuos[0].id, cantidad: 4 }] }, 201);
  const certificate = await db.notificacion.findFirstOrThrow({ where: { manifiestoId: manifest.id, usuarioId: member.id,
   datos: { contains: issued.id } } });
  const ownerNotice = await db.notificacion.findFirstOrThrow({ where: { id: report.proposalNotice } });
  assert.equal(ownerNotice.usuarioId, member.id);
  const primaryNotice = await db.notificacion.findFirst({ where: { manifiestoId: manifest.id, usuarioId: owner.id,
   datos: { contains: 'propuesta_partes' } } });
  stored = { member: fixture.member, owner: fixture.owner, company: fixture.companyId, activity: activity.id, grant: grant.id,
   original: { activa: grant.activa, todosEstablecimientos: grant.todosEstablecimientos, establecimientoIds: grant.establecimientoIds, updatedAt: grant.updatedAt },
   manifestId: manifest.id, numero: manifest.numero, notices: [report.proposalNotice, report.adendaNotice, certificate.id],
   primaryNotice: primaryNotice?.id || null };
  writeFileSync(privatePath, JSON.stringify(stored, null, 2), { mode: 0o600 });
 }
 assert.equal(stored.manifestId, manifest.id); assert.equal(stored.grant, grant.id); assert.equal(stored.notices.length, 3);
 for (const id of stored.notices) {
  const notice = await call(fixture.member, '/notificaciones/' + id);
  assert.equal(notice.manifiestoId, manifest.id); assert.ok(JSON.parse(notice.datos).accesosEmpresa.length);
 }
 await call('generador2@night-qa.invalid', '/notificaciones/' + stored.notices[0], 'GET', undefined, 404);
 try {
  for (const reason of mode === 'fixed' ? ['other-site', 'revoked'] : ['revoked']) {
   await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: reason === 'other-site'
    ? { todosEstablecimientos: false, establecimientoIds: ['qa-sede-distinta'] } : { activa: false } });
   for (const id of stored.notices) {
    const notice = await call(fixture.member, '/notificaciones/' + id);
    const marked = await call(fixture.member, '/notificaciones/' + id + '/leida', 'PUT');
    if (mode === 'baseline') {
     assert.equal(notice.manifiestoId, manifest.id); assert.equal(marked.manifiestoId, manifest.id);
    } else {
     assert.equal(notice.titulo, 'Aviso no disponible'); assert.equal(notice.manifiestoId, null);
     assert.equal(marked.manifiestoId, null); assert.doesNotMatch(JSON.stringify(notice), new RegExp(manifest.numero));
     assert.doesNotMatch(JSON.stringify(marked), new RegExp(manifest.numero));
    }
   }
  }
 } finally {
  await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: grant.activa,
   todosEstablecimientos: grant.todosEstablecimientos, establecimientoIds: grant.establecimientoIds, updatedAt: grant.updatedAt } });
 }
 for (const id of stored.notices) assert.equal((await call(fixture.member, '/notificaciones/' + id)).manifiestoId, manifest.id);
 let directOwnerChecked = false;
 if (mode === 'fixed' && stored.primaryNotice) {
  const primary = await db.notificacion.findUniqueOrThrow({ where: { id: stored.primaryNotice } });
  const ownerGrant = await db.autorizacionEmpresa.findUnique({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: owner.id } } });
  if (ownerGrant?.activa && Array.isArray(JSON.parse(primary.datos || '{}').accesosEmpresa)) {
   try {
    await db.autorizacionEmpresa.update({ where: { id: ownerGrant.id }, data: { activa: false } });
    const visible = await call(fixture.owner, '/notificaciones/' + stored.primaryNotice);
    assert.equal(visible.manifiestoId, manifest.id); assert.equal(JSON.parse(visible.datos).accesosEmpresa, undefined);
    directOwnerChecked = true;
   } finally {
    await db.autorizacionEmpresa.update({ where: { id: ownerGrant.id }, data: { activa: ownerGrant.activa,
     todosEstablecimientos: ownerGrant.todosEstablecimientos, establecimientoIds: ownerGrant.establecimientoIds, updatedAt: ownerGrant.updatedAt } });
   }
  }
 }
 assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
 assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
 const proof = { synthetic: true, mode, originalNotices: 3, visibleAfterRevocation: mode === 'baseline' ? 3 : 0,
  markReadAlsoMasked: mode === 'fixed', otherSiteHidden: mode === 'fixed', directOwnerChecked,
  otherAccountDenied: true, grantRestored: true, emailAttempts: 0, emailSent: 0, pushEnabled: false };
 writeFileSync(path.join(out, `legacy-company-notice-${mode}.json`), JSON.stringify(proof, null, 2));
 console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
