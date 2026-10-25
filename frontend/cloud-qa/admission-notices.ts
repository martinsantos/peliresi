import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
import { syntheticCuit } from './synthetic-cuit.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const out = process.env.QA_ARTIFACTS!, file = out + '/admission-notices.json';
const password = 'OnlyLocal-NightQA-2026!';
async function api(route: string, token?: string, body?: unknown, expected = 200) {
 const response = await fetch('http://127.0.0.1:3037/api' + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
 const result = await response.json(); assert.equal(response.status, expected, route + ': ' + JSON.stringify(result)); return result.data;
}
const login = async (email: string) => (await api('/auth/login', undefined, { email, password })).tokens.accessToken;
try {
 if (process.env.QA_ADMISSION_NOTICES_VERIFY === 'true') {
  const fixture = JSON.parse(readFileSync(file, 'utf8'));
  const application = await db.solicitudInscripcion.findUniqueOrThrow({ where: { id: fixture.application.id } });
  assert.equal(application.estado, 'EN_REVISION');
  assert.equal(JSON.parse(application.datosActor).domicilio, 'QA corrección confirmada en app');
  assert.equal(await db.manifiesto.count(), fixture.manifests);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  writeFileSync(out + '/admission-notices-ui.json', JSON.stringify({ at: new Date().toISOString(), applicationId: application.id, state: application.estado, finalAddress: JSON.parse(application.datosActor).domicilio, manifests: fixture.manifests, emailAttempts: 0, emailSent: 0 }, null, 2));
  console.log('UI correction confirmed, application remains in review; no email attempts');
 } else {
  assert.ok(!existsSync(file), 'Reuse recorded synthetic notices; do not duplicate fixtures');
  const admin = await login('admin@night-qa.invalid'), prefix = 'ux-notices-' + randomUUID().slice(0, 8);
  const manifests = await db.manifiesto.count(), renewals = [], previews = [];
  const { notificationMailContent } = backendRequire('./dist/services/notification-mail.service.js');
  const { escapeMail } = backendRequire('./dist/services/email-templates.js');
  for (const type of ['GENERADOR', 'OPERADOR']) {
   const actor = await (type === 'GENERADOR' ? db.generador : db.operador).findFirstOrThrow({ where: { usuario: { email: type.toLowerCase() + '@night-qa.invalid' } }, include: { usuario: true } });
   assert.ok(actor.usuario.email.endsWith('@night-qa.invalid'));
   const token = await login(actor.usuario.email), key = type === 'GENERADOR' ? 'generadorId' : 'operadorId';
   for (const decision of ['aprobar', 'rechazar', 'pendiente']) {
    let year = 2070;
    while (await db.renovacion.count({ where: { [key]: actor.id, anio: year } })) year++;
    assert.ok(year <= 2100);
    const row = (await api('/renovaciones', token, { anio: year, tipoActor: type, [key]: actor.id, modalidad: 'SIN_CAMBIOS', observaciones: 'QA aviso · ' + prefix }, 201)).renovacion;
    const pending = await db.notificacion.findMany({ where: { tipo: 'MODIFICACION_SOLICITADA', datos: { contains: row.id } }, include: { usuario: true } });
    assert.ok(pending.length > 0); assert.ok(pending.every((n: any) => ['ADMIN', 'ADMIN_' + type].includes(n.usuario.rol)));
    assert.equal(new Set(pending.map((n: any) => n.usuarioId)).size, pending.length);
    let notices = pending.filter((n: any) => n.usuario.email === 'admin@night-qa.invalid');
    assert.equal(notices.length, 1);
    const reviewNotice = notices[0].id;
    if (decision !== 'pendiente') {
     await api('/renovaciones/' + row.id + '/' + decision, admin, { motivoRechazo: 'QA falta constancia legible · motivo privado del trámite' });
     notices = await db.notificacion.findMany({ where: { tipo: decision === 'aprobar' ? 'MODIFICACION_APROBADA' : 'MODIFICACION_RECHAZADA', datos: { contains: row.id } }, include: { usuario: true } });
     assert.equal(notices.length, 1); assert.equal(notices[0].usuarioId, actor.usuarioId);
    }
    const notice = notices[0], data = JSON.parse(notice.datos!);
    assert.equal(data.actorNombre, actor.razonSocial); assert.equal(data.anio, year); assert.equal(data.tipoActor, type);
    assert.ok(notice.mensaje.includes('Período ' + year)); assert.ok(notice.mensaje.includes(actor.razonSocial));
    const rendered = notificationMailContent({ ...notice, ...notice.usuario, id: notice.id, tipo: notice.tipo, datos: notice.datos });
    assert.ok(rendered); assert.ok(rendered.html.includes(escapeMail(actor.razonSocial)));
    assert.ok(rendered.html.includes('Período ' + year)); assert.ok(!rendered.html.includes('motivo privado'));
    const expectedPath = decision === 'pendiente' ? '/admin/renovaciones?anio=&amp;revision=' + row.id : '/notificaciones/' + notice.id;
    assert.ok(rendered.html.includes(expectedPath));
    const resultRead = await api('/notificaciones/' + notice.id, decision === 'pendiente' ? admin : token);
    assert.equal(resultRead.id, notice.id);
    const other = await login(type === 'GENERADOR' ? 'operador@night-qa.invalid' : 'generador@night-qa.invalid');
    await api('/notificaciones/' + notice.id, other, undefined, 404);
    previews.push({ title: type + ' · ' + decision + ' · ' + year, html: rendered.html, subject: rendered.subject });
    renewals.push({ id: row.id, type, year, decision, ownerEmail: actor.usuario.email, noticeId: notice.id, reviewNotice, title: notice.titulo, message: notice.mensaje, sourceScoped: true, mailRendered: true });
   }
  }
  // Fixture starts at ENVIADA; this is not a public signup test or real account.
  const seed = await db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' } });
  const email = prefix + '@night-qa.invalid', cuit = syntheticCuit(Date.now());
  const person = await db.usuario.create({ data: { email, password: seed.password, nombre: 'QA confirmación de corrección', cuit, rol: 'TRANSPORTISTA', activo: false, motivoInactividad: 'PENDIENTE_APROBACION', emailVerified: true, notifEmail: false } });
  const application = await db.solicitudInscripcion.create({ data: { usuarioId: person.id, tipoActor: 'TRANSPORTISTA', estado: 'ENVIADA', fechaEnvio: new Date(), datosActor: JSON.stringify({ razonSocial: 'QA confirmación de corrección', cuit, domicilio: 'Domicilio artificial original', telefono: '02610000000', emailContacto: email }) } });
  const gallery = '<!doctype html><html lang="es"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Correos de renovación · preview sin envío</title><style>body{font:16px system-ui;margin:24px;background:#f5f7f6;color:#173f2b}section{max-width:800px;margin:32px auto}iframe{width:100%;height:700px;border:1px solid #c9d7cf;border-radius:12px}h1{font-size:24px}</style><h1>Renovaciones: plantillas reales, sin enviar</h1><p>Datos artificiales · Generador y Operador · Pendiente, aprobada y rechazada</p>' + previews.map((p: any) => '<section><h2>' + escapeMail(p.title) + '</h2><p>' + escapeMail(p.subject) + '</p><iframe sandbox="" title="' + escapeMail(p.title) + '" srcdoc="' + escapeMail(p.html) + '"></iframe></section>').join('') + '</html>';
  writeFileSync(out + '/admission-mail-gallery.html', gallery);
  writeFileSync(process.env.QA_WEB_BUILD + '/qa-admission-mails.html', gallery);
  assert.equal(await db.manifiesto.count(), manifests);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), prefix, manifests, renewals, application: { id: application.id, email }, rendered: previews.length, emailAttempts: 0 }, null, 2));
  console.log(JSON.stringify({ renewals, application: { id: application.id, email }, rendered: previews.length }));
 }
} finally { await db.$disconnect(); }
