import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-manifest-owner-20261030'; assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.ACTOR_MULTIROLE_ENABLED, 'true'); assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(process.env.TRAINING_DATABASE_URL, '');
const phase = process.env.QA_OWNER_PHASE; assert.ok(phase === 'before' || phase === 'after');
const dist = path.join(root, 'backend', phase === 'before' ? 'dist-qa-operation-reminders-20261030' : 'dist-qa-manifest-owner-20261030');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const prisma = backendRequire(path.join(dist, 'lib/prisma.js')).default;
const { ejecutarRecordatorios } = backendRequire(path.join(dist, 'jobs/recordatorio.job.js'));
const { notificationMailContent, notificationSourceEligible } = backendRequire(path.join(dist, 'services/notification-mail.service.js'));
const selected = new Set<string>();
const delegate = prisma.manifiesto, originalFindMany = delegate.findMany.bind(delegate);
delegate.findMany = (args: any) => args?.where?.fechaEstimadaRetiro
  ? (assert.ok(selected.size, 'Do not run an unscoped sweep'), originalFindMany({ ...args, where: { AND: [args.where, { id: { in: [...selected] } }] } }))
  : originalFindMany(args);

async function token(email: string) {
  assert.match(email, /@night-qa\.invalid$/);
  const response = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(response.status, 200); return (await response.json() as any).data.tokens.accessToken as string;
}
async function get(pathname: string, access: string, activity?: string) {
  return fetch('http://127.0.0.1:3037/api' + pathname, { headers: { Authorization: 'Bearer ' + access,
    ...(activity ? { 'X-SITREP-Activity': activity } : {}) } });
}

try {
  const [owner, generator, carrier] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'draft-multirole-20261024@night-qa.invalid' }, include: { generador: true, transportista: true, operador: true } }),
    db.generador.findFirstOrThrow({ where: { usuario: { email: 'generador@night-qa.invalid' } }, include: { usuario: true } }),
    db.transportista.findFirstOrThrow({ where: { usuario: { email: 'transportista@night-qa.invalid' } }, include: { usuario: true } }),
  ]);
  for (const user of [owner, generator.usuario, carrier.usuario]) { assert.match(user.email, /@night-qa\.invalid$/); assert.equal(user.activo, true); }
  assert.equal(owner.rol, 'GENERADOR'); assert.ok(owner.operador?.activo && owner.generador?.activo);
  assert.notEqual(generator.usuarioId, owner.id); assert.notEqual(carrier.usuarioId, owner.id);
  assert.ok(await db.solicitudInscripcion.findFirst({ where: { usuarioId: owner.id, tipoActor: 'OPERADOR', operadorId: owner.operador.id, estado: 'APROBADA' } }));
  const ownerToken = await token(owner.email);
  let fixture: { synthetic: boolean; email: string; manifestId: string; numero: string; notice: string; adenda?: string; singleNotice?: string };
  if (phase === 'before') {
    const m = await db.manifiesto.create({ data: { numero: 'QA-TITULAR-' + randomUUID().slice(0, 10),
      generadorId: generator.id, transportistaId: carrier.id, operadorId: owner.operador.id, creadoPorId: generator.usuarioId,
      estado: 'APROBADO', modalidad: 'FIJO', isDemoData: false, fechaEstimadaRetiro: new Date(Date.now() + 12 * 3600000) } });
    selected.add(m.id); assert.equal(await ejecutarRecordatorios(), 1);
    const notice = await db.notificacion.findFirstOrThrow({ where: { manifiestoId: m.id, usuarioId: owner.id, tipo: 'ALERTA_SISTEMA' } });
    assert.equal(JSON.parse(notice.datos).tipo, 'recordatorio_operacion');
    fixture = { synthetic: true, email: owner.email, manifestId: m.id, numero: m.numero, notice: notice.id };
    writeFileSync(path.join(out, 'fixture.json'), JSON.stringify(fixture));
  } else fixture = JSON.parse(readFileSync(path.join(out, 'fixture.json'), 'utf8'));
  assert.equal(fixture.synthetic, true); assert.equal(fixture.email, owner.email);
  if (phase === 'after' && !fixture.adenda) {
    const adenda = await db.adendaManifiesto.create({ data: { id: 'qa-adenda-' + randomUUID(), manifiestoId: fixture.manifestId,
      creadoPorId: owner.id, huellaSolicitud: 'fixture-artificial', declaracion: { numero: fixture.numero, residuos: [] },
      residuos: [], motivo: 'QA adenda para enlace anterior', revisiones: [] } });
    fixture.adenda = adenda.id; writeFileSync(path.join(out, 'fixture.json'), JSON.stringify(fixture));
  }
  const notice = await db.notificacion.findUniqueOrThrow({ where: { id: fixture.notice } });
  assert.equal(notice.usuarioId, owner.id); assert.equal(notice.manifiestoId, fixture.manifestId);
  const mailNotice = { ...notice, email: owner.email, activo: owner.activo, emailVerified: owner.emailVerified, notifEmail: owner.notifEmail, rol: owner.rol };
  const eligible = await notificationSourceEligible(mailNotice, 'alertas');
  const rendered = notificationMailContent(mailNotice); assert.ok(rendered?.html);
  const web = new URL(rendered.html.match(/data-mail-action="web" href="([^"]+)"/)![1].replace(/&amp;/g, '&'));
  const owned = await get('/notificaciones/' + notice.id, ownerToken); assert.equal(owned.status, 200);
  const wrong = await get('/manifiestos/' + fixture.manifestId, ownerToken, 'GENERADOR'); assert.equal(wrong.status, 404);
  const right = await get('/manifiestos/' + fixture.manifestId, ownerToken, 'OPERADOR'); assert.equal(right.status, 200);
  const foreign = await get('/notificaciones/' + notice.id, await token('generador2@night-qa.invalid')); assert.equal(foreign.status, 404);
  if (phase === 'before') {
    assert.equal(eligible, false); assert.equal(web.pathname, '/manifiestos/' + fixture.manifestId);
    writeFileSync(path.join(out, 'before.json'), JSON.stringify({ synthetic: true, wrongRole: 404, correctRole: 200,
      otherAccount: 404, sourceEligible: false, mailOpensNotice: false }));
  } else {
    assert.equal(eligible, true); assert.equal(web.pathname, '/notificaciones/' + notice.id);
    const singleNotice = await db.notificacion.findFirstOrThrow({ where: { manifiestoId: fixture.manifestId, usuarioId: generator.usuarioId, tipo: 'ALERTA_SISTEMA' } });
    const singleMail = notificationMailContent({ ...singleNotice, email: generator.usuario.email, activo: generator.usuario.activo,
      emailVerified: generator.usuario.emailVerified, notifEmail: generator.usuario.notifEmail, rol: generator.usuario.rol });
    assert.ok(singleMail?.html); assert.match(singleMail.html, new RegExp('/notificaciones/' + singleNotice.id));
    fixture.singleNotice = singleNotice.id; writeFileSync(path.join(out, 'fixture.json'), JSON.stringify(fixture));
    writeFileSync(path.join(out, 'single-mail.html'), singleMail.html);
    writeFileSync(path.join(out, 'after.json'), JSON.stringify({ synthetic: true, wrongRole: 404, correctRole: 200,
      otherAccount: 404, sourceEligible: true, mailOpensNotice: true }));
  }
  writeFileSync(path.join(out, phase + '-mail.html'), rendered.html);
  console.log('Contexto titular artificial:', JSON.stringify({ phase, wrongRole: 404, correctRole: 200, sourceEligible: eligible, mailPath: web.pathname }));
} finally { delegate.findMany = originalFindMany; await prisma.$disconnect(); await db.$disconnect(); }
