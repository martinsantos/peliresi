/** Persist only synthetic prerequisites; login and resource reads use the real API. */
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
import { loadSeed } from './load-seed.ts';
await assertCloudDatabase();
const fixture = await loadSeed().seedNightDatabase();
const { PrismaClient } = backendRequire('@prisma/client');
const { notificationMailContent } = backendRequire(path.join(root, 'backend/dist/services/notification-mail.service.js'));
const { renderMail } = backendRequire(path.join(root, 'backend/dist/services/email-templates.js'));
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
  const cases = [
    { id: 'support-owner', user: 'generador', tipo: 'INFO_GENERAL', datos: { tipo: 'soporte', ticketId: ticket.id }, expected: '/soporte/' + ticket.id, visible: ticket.asunto },
    { id: 'support-staff', user: 'admin', tipo: 'INFO_GENERAL', datos: { tipo: 'soporte', ticketId: ticket.id }, expected: '/soporte/' + ticket.id, visible: ticket.asunto },
    { id: 'inspection-inspector', user: 'inspector', tipo: 'INFO_GENERAL', datos: { inspeccionId: inspection.id }, expected: '/inspecciones/' + inspection.id, visible: inspection.numero },
    { id: 'inspection-actor', user: 'generador', tipo: 'INFO_GENERAL', datos: { inspeccionId: inspection.id }, expected: '/mis-inspecciones/' + inspection.id, visible: inspection.numero },
    { id: 'application-staff', user: 'admin', tipo: 'SOLICITUD_OBSERVADA', datos: { solicitudId: application.id }, expected: '/admin/solicitudes/' + application.id, visible: 'QA sin-actor' },
    { id: 'application-owner', user: 'sin-actor', tipo: 'SOLICITUD_OBSERVADA', datos: { solicitudId: application.id }, expected: '/mi-solicitud', visible: 'QA completar domicilio' },
  ];
  const mails = cases.map(item => ({ ...item, ...notificationMailContent({ ...item,
    rol: item.user === 'admin' ? 'ADMIN' : 'GENERADOR', datos: JSON.stringify(item.datos),
  }) }));
  const templates = ['verify', 'pending', 'approved', 'newAccount', 'reset', 'application', 'observed', 'response', 'rejected', 'modification', 'modificationApproved', 'modificationRejected'].map(id => ({ id,
    ...renderMail(id, { name: 'Persona de capacitación', role: 'Generador', message: 'Revisá el domicilio del establecimiento.', token: 'solo-qa-sin-validez' }),
  }));
  await writeFile(path.join(output, 'mail-fixture.json'), JSON.stringify({ mails, templates, ticketId: ticket.id, database: 'sitrep_night_qa_20260926', externalDelivery: false }));
} finally { await db.$disconnect(); }
