/** Persist only synthetic prerequisites; login and resource reads use the real API. */
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
import { loadSeed } from './load-seed.ts';
import { createHash } from 'node:crypto';
await assertCloudDatabase();
const fixture = await loadSeed().seedNightDatabase();
const { PrismaClient } = backendRequire('@prisma/client');
const { notificationMailContent } = backendRequire(path.join(root, 'backend/dist/services/notification-mail.service.js'));
const { renderMail, renderDigest } = backendRequire(path.join(root, 'backend/dist/services/email-templates.js'));
const { digestTemplate } = backendRequire(path.join(root, 'backend/dist/services/email.service.js'));
const { renderAccountMail } = backendRequire(path.join(root, 'backend/dist/services/account-mail.service.js'));
const db = new PrismaClient();
const output = process.env.QA_ARTIFACTS!;
await mkdir(output, { recursive: true });
try {
  const ticket = await db.ticketSoporte.create({ data: {
    autorId: fixture.users.generador, asunto: 'QA respuesta de soporte por correo',
    clienteId: 'mail-link-qa', huella: 'synthetic', contexto: {},
    mensajes: { create: [
      { autorId: fixture.users.admin, cuerpo: 'QA respuesta pública: revisamos el acceso.' },
      { autorId: fixture.users.admin, cuerpo: 'QA NOTA INTERNA NO EXPONER', interno: true },
    ] },
  } });
  const inspection = await db.inspeccion.create({ data: {
    numero: 'I-QA-MAIL-00001', numeroActa: 'QA-CLOUD-MAIL', tipoActor: 'GENERADOR',
    inspectorId: fixture.users.inspector, generadorId: fixture.actors.generador,
    estado: 'NOTIFICADA',
  } });
  const application = await db.solicitudInscripcion.create({ data: {
    usuarioId: fixture.users['sin-actor'], tipoActor: 'GENERADOR', estado: 'OBSERVADA',
    datosActor: JSON.stringify({ razonSocial: 'QA solicitante correo', domicilio: 'QA sin domicilio real' }),
    observaciones: 'QA completar domicilio',
  } });
  const cases: Array<{ id: string; user: string; tipo: string; datos: Record<string, string>; expected: string; visible: string }> = [
    { id: 'support-owner', user: 'generador', tipo: 'INFO_GENERAL', datos: { tipo: 'soporte', ticketId: ticket.id }, expected: '/soporte/' + ticket.id, visible: ticket.asunto },
    { id: 'support-staff', user: 'admin', tipo: 'INFO_GENERAL', datos: { tipo: 'soporte', ticketId: ticket.id }, expected: '/soporte/' + ticket.id, visible: ticket.asunto },
    { id: 'inspection-inspector', user: 'inspector', tipo: 'INFO_GENERAL', datos: { inspeccionId: inspection.id }, expected: '/inspecciones/' + inspection.id, visible: inspection.numero },
    { id: 'inspection-actor', user: 'generador', tipo: 'INFO_GENERAL', datos: { inspeccionId: inspection.id }, expected: '/mis-inspecciones/' + inspection.id, visible: inspection.numero },
    { id: 'application-staff', user: 'admin', tipo: 'SOLICITUD_OBSERVADA', datos: { solicitudId: application.id }, expected: '/admin/solicitudes/' + application.id, visible: 'QA sin-actor' },
    { id: 'application-owner', user: 'sin-actor', tipo: 'SOLICITUD_OBSERVADA', datos: { solicitudId: application.id }, expected: '/mi-solicitud', visible: 'QA completar domicilio' },
  ];
  const seedUser = await db.usuario.findUniqueOrThrow({ where: { id: fixture.users['sin-actor'] } });
  const pending = await db.usuario.create({ data: { email: 'pending-mail@night-qa.invalid', nombre: 'QA pending mail', password: seedUser.password,
    rol: 'GENERADOR', activo: false, motivoInactividad: 'PENDIENTE_APROBACION', emailVerified: true } });
  const pendingApplication = await db.solicitudInscripcion.create({ data: { usuarioId: pending.id, tipoActor: 'GENERADOR', estado: 'OBSERVADA',
    datosActor: '{}', observaciones: 'QA observación pendiente verificado' } });
  cases.push({ id: 'application-pending', user: 'pending-mail', tipo: 'SOLICITUD_OBSERVADA', datos: { solicitudId: pendingApplication.id },
    expected: '/mi-solicitud', visible: 'QA observación pendiente verificado' });
  const rejected = await db.usuario.create({ data: { email: 'rejected-mail@night-qa.invalid', nombre: 'QA rejected mail', password: seedUser.password,
    rol: 'GENERADOR', activo: false, motivoInactividad: 'PENDIENTE_APROBACION', emailVerified: true } });
  const rejectedApplication = await db.solicitudInscripcion.create({ data: { usuarioId: rejected.id, tipoActor: 'GENERADOR', estado: 'RECHAZADA',
    datosActor: '{}', motivoRechazo: 'QA rechazo consultable sin habilitación' } });
  cases.push({ id: 'application-pending-rejected', user: 'rejected-mail', tipo: 'SOLICITUD_RECHAZADA', datos: { solicitudId: rejectedApplication.id },
    expected: '/mi-solicitud', visible: 'Motivo: QA rechazo consultable sin habilitación' });
  for (const actor of ['generador', 'operador', 'transportista']) cases.push({
    id: 'certificate-' + actor, user: actor, tipo: 'INFO_GENERAL',
    datos: { tipo: 'certificado_ambiental', documentoId: 'qa-certificate', actorTipo: actor, actorId: fixture.actors[actor] },
    expected: '/mi-perfil', visible: 'Certificado ambiental anual',
  });
  const mails = cases.map(item => ({ ...item, ...notificationMailContent({ ...item,
    rol: item.user === 'admin' ? 'ADMIN' : 'GENERADOR', datos: JSON.stringify(item.datos),
  }) }));
  const templates = ['verify', 'pending', 'approved', 'newAccount', 'reset', 'application', 'observed', 'response', 'rejected', 'modification', 'modificationApproved', 'modificationRejected'].map(id => ({ id,
    ...renderMail(id, { name: 'Persona de capacitación',
      ...(['pending', 'newAccount', 'application', 'modification'].includes(id) ? { role: 'Generador' } : {}),
      ...(['observed', 'rejected', 'modificationRejected'].includes(id) ? { message: 'Revisá el domicilio del establecimiento.' } : {}),
      ...(['verify', 'reset'].includes(id) ? { token: 'solo-qa-sin-validez' } : {}),
    }),
  }));
  templates.push(...['created', 'enabled', 'disabled', 'deleted', 'roleChanged', 'emailChanged', 'passwordChanged'].map(id => ({ id: 'account-' + id, ...renderAccountMail(id) })));
  templates.push(...mails.map(item => ({ id: 'notice-' + item.id, subject: item.subject, html: item.html })));
  // Preview every controlled event label, not just the role/destination samples.
  // Pure renderers only: these synthetic previews never enqueue or send mail.
  const preview = (id: string, tipo: string, datos: Record<string, string>, manifiestoId?: string) => {
    const content = notificationMailContent({ tipo, datos: JSON.stringify(datos), manifiestoId, rol: 'ADMIN' });
    if (!content) throw new Error('Missing synthetic preview: ' + id);
    templates.push({ id, subject: content.subject, html: content.html });
  };
  for (const event of ['ENVIADA', 'MENSAJE', 'APROBADA']) preview('application-' + event.toLowerCase(), 'SOLICITUD_' + event, { solicitudId: application.id });
  for (const event of ['SOLICITADA', 'APROBADA', 'RECHAZADA']) preview('padron-' + event.toLowerCase(), 'MODIFICACION_' + event, { renovacionId: 'qa-preview' });
  for (const event of ['FIRMADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'TRATADO', 'RECHAZADO']) preview('manifest-' + event.toLowerCase(), 'MANIFIESTO_' + event, {}, 'qa-preview');
  for (const event of ['INCIDENTE_REPORTADO', 'ANOMALIA_DETECTADA', 'VENCIMIENTO_PROXIMO', 'ALERTA_SISTEMA']) preview('alert-' + event.toLowerCase(), event, {});
  for (const event of ['CREADO', 'EN_NOMBRE', 'RESPONDER', 'DERIVAR', 'TOMAR', 'ESPERAR', 'CERRAR', 'REABRIR']) preview('support-' + event.toLowerCase(), 'INFO_GENERAL', { tipo: 'soporte', ticketId: ticket.id, evento: event });
  preview('inspection-assigned', 'INFO_GENERAL', { inspeccionId: inspection.id, evento: 'ASIGNADA' });
  const alertSamples = [{ subject: 'Vencimiento próximo: revisar la habilitación', html: '<p>Ejemplo de capacitación.</p>' }, { subject: 'Manifiesto pendiente de cierre', html: '<p>Ejemplo de capacitación.</p>' }];
  for (const count of [1, 2]) templates.push({ id: 'digest-' + count, subject: '[SITREP] Resumen de alertas', html: digestTemplate(alertSamples.slice(0, count), '11/10/2026 10:00 (Mendoza)') });
  templates.push({ id: 'digest-helper', subject: '[SITREP] Resumen de alertas', html: renderDigest(alertSamples) });
  const verifications: Record<string, unknown> = {};
  for (const project of ['web-desktop', 'web-responsive', 'app']) {
    const pairs = [];
    for (const kind of ['anonymous', 'other-session', 'new-browser']) {
      const token = `synthetic-verification-${project}-${kind}`;
      const email = `verify-${project}-${kind}@night-qa.invalid`;
      const user = await db.usuario.create({ data: { email, nombre: 'QA verificación y borrador', password: seedUser.password,
        rol: 'GENERADOR', activo: false, motivoInactividad: 'PENDIENTE_APROBACION', emailVerified: false,
        emailVerificationToken: createHash('sha256').update(token).digest('hex') } });
      const draft = await db.solicitudInscripcion.create({ data: { usuarioId: user.id, tipoActor: 'GENERADOR', estado: 'BORRADOR',
        datosActor: JSON.stringify({ razonSocial: 'QA borrador guardado en SITREP', domicilio: 'QA domicilio conservado', telefono: '02615550101' }) } });
      pairs.push({ token, email, userId: user.id, draftId: draft.id, revision: draft.updatedAt.toISOString() });
    }
    verifications[project] = pairs;
  }
  await writeFile(path.join(output, 'mail-fixture.json'), JSON.stringify({ mails, templates, verifications, ticketId: ticket.id, database: 'sitrep_night_qa_20260926', externalDelivery: false }));
} finally { await db.$disconnect(); }
