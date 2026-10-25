import { ADDENDUM_AUTHORITY_ROLES } from '../domain/addendumAuthority';
import { designatedReviewAccount } from '../domain/manifestReviewAuthority';
import { COMPANY_NOTICE_LABELS, validCompanyNotice, companyNoticeEligible } from './companyNotice.service';
/** Relay committed in-app notices, never send from inside a business transaction.
 * Separate opt-in per family; SMTP still requires its own explicit activation.
 * No historic backfill: both source notices and queue are fenced by the cutoff.
 */
import prisma from '../lib/prisma';
import { mailPolicy } from './email-policy';
import { escapeMail, mailAction, mailShell } from './email-templates';
import { isFullAccess } from '../utils/roleFilter';
import { INSPECTION_EXCHANGE_LABELS } from './inspectionExchangeNotice.service';
import { PARTICIPANT_VISIBLE_STATES } from './inspectionExchange.service';
import { INSPECTION_AGENDA_LABELS } from './inspectionAgendaNotice.service';
import { requirementSituation } from './alertCataloguePolicy.service';
import { EVENTUAL_NOTICE_LABELS, eventualNoticeAudience, eventualNoticeEvent } from './eventualNotice.service';
import { manifestFeatureEnabled } from '../lib/manifestTraining';

export type NoticeForMail = {
  id: string; tipo: string; datos: string | null; createdAt: Date;
  email: string; activo: boolean; emailVerified: boolean; notifEmail: boolean; rol: string;
  usuarioId?: string; motivoInactividad?: string | null;
  manifiestoId?: string | null; esInspector?: boolean;
};
const MANIFEST_TYPES = ['MANIFIESTO_FIRMADO', 'MANIFIESTO_EN_TRANSITO', 'MANIFIESTO_ENTREGADO', 'MANIFIESTO_RECIBIDO', 'MANIFIESTO_TRATADO', 'MANIFIESTO_RECHAZADO'];
const ALERT_TYPES = ['INCIDENTE_REPORTADO', 'ANOMALIA_DETECTADA', 'VENCIMIENTO_PROXIMO', 'ALERTA_SISTEMA'];
function enabledFamilies(): string[] {
  return (process.env.EMAIL_NOTIFICATION_FAMILIES || '').split(',').map(item => item.trim()).filter(item => ['solicitudes', 'soporte', 'inspecciones', 'certificados', 'manifiestos', 'alertas', 'padron', 'representacion'].includes(item));
}

type InspectionMailScope = { inspectorId: string; tipoActor: string | null; estado: string;
  generador: { usuarioId: string } | null; transportista: { usuarioId: string } | null; operador: { usuarioId: string } | null };
function inspectionAudience(notice: NoticeForMail, inspection: InspectionMailScope) {
  const authority = notice.rol === 'ADMIN' || notice.rol === `ADMIN_${inspection.tipoActor}`
    || (!notice.rol.startsWith('ADMIN_') && notice.esInspector === true && notice.usuarioId === inspection.inspectorId);
  const owner = inspection.tipoActor === 'GENERADOR' ? inspection.generador : inspection.tipoActor === 'TRANSPORTISTA' ? inspection.transportista : inspection.operador;
  const participant = Boolean(PARTICIPANT_VISIBLE_STATES.includes(inspection.estado as typeof PARTICIPANT_VISIBLE_STATES[number]) && inspection.tipoActor && notice.rol === inspection.tipoActor && owner?.usuarioId === notice.usuarioId);
  return { authority, participant };
}

/** Recheck the source at enqueue AND delivery, including reassignment/revocation. */
export async function notificationSourceEligible(notice: NoticeForMail, family: string): Promise<boolean> {
  const data = JSON.parse(notice.datos || '{}');
  if (family === 'representacion') return process.env.ENTERPRISE_ENABLED === 'true' && companyNoticeEligible(prisma, notice.usuarioId, data);
  if (family === 'manifiestos' && data.tipo === 'manifiesto_eventual') {
    if (!manifestFeatureEnabled('MANIFEST_EXCEPTIONAL_ENABLED') || !validEventualMail(data) || !notice.usuarioId) return false;
    const record = await prisma.registroManifiestoExcepcional.findUnique({ where: { id: data.registroId as string } });
    if (!record) return false;
    const event = eventualNoticeEvent(record, data.eventoId as string);
    if (!event || event.kind !== data.evento) return false;
    return (await eventualNoticeAudience(prisma, record, event.kind, event.authorId)).some(user => user.id === notice.usuarioId);
  }
  if (family === 'padron') {
    const renewal = await prisma.renovacion.findUnique({ where: { id: data.renovacionId }, include: {
      generador: { select: { usuarioId: true } }, operador: { select: { usuarioId: true } },
    } });
    if (!renewal) return false;
    if (notice.tipo === 'MODIFICACION_SOLICITADA') return renewal.estado === 'PENDIENTE' && ['ADMIN', 'ADMIN_' + renewal.tipoActor].includes(notice.rol);
    const owner = renewal.tipoActor === 'GENERADOR' ? renewal.generador : renewal.operador;
    const expected = notice.tipo === 'MODIFICACION_APROBADA' ? 'APROBADA' : 'RECHAZADA';
    return Boolean(notice.usuarioId && owner?.usuarioId === notice.usuarioId && renewal.estado === expected);
  }
  if (notice.manifiestoId) {
    const manifest = await prisma.manifiesto.findUnique({ where: { id: notice.manifiestoId }, select: {
      isDemoData: true, estado: true, fechaFirma: true, generador: { select: { usuarioId: true } },
      transportista: { select: { usuarioId: true } }, operador: { select: { usuarioId: true } },
    } });
    if (!manifest || manifest.isDemoData) return false;
    if (data.tipo === 'recordatorio_firma') {
      const days = manifest.fechaFirma ? (Date.now() - manifest.fechaFirma.getTime()) / 86400000 : -1;
      const currentPhase = days >= 30 ? 'TREINTA_DIAS' : days >= 23 ? 'SEMANA' : null;
      if (data.version !== 1 || !currentPhase || data.fase !== currentPhase || manifest.fechaFirma?.toISOString() !== data.fechaFirma
        || !['APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO'].includes(manifest.estado)) return false;
    }
    const owner = notice.rol === 'GENERADOR' ? manifest.generador : notice.rol === 'TRANSPORTISTA' ? manifest.transportista : notice.rol === 'OPERADOR' ? manifest.operador : null;
    if (!isFullAccess(notice) && (!notice.usuarioId || owner?.usuarioId !== notice.usuarioId)) {
      // A registered replacement can see its own leg history in the carrier
      // profile. This never grants it the private original manifest dossier.
      if (data.tipo !== 'relevo_transporte' || notice.rol !== 'TRANSPORTISTA' || !notice.usuarioId) return false;
      const carrier = await prisma.transportista.findFirst({ where: { usuarioId: notice.usuarioId }, select: { id: true } });
      if (!carrier) return false;
      const ownLeg = await prisma.tramoTransporte.findFirst({ where: {
        manifiestoId: notice.manifiestoId, tipo: 'REGISTRADO', transportistaId: carrier.id,
      }, select: { id: true } });
      if (!ownLeg) return false;
    }
  }
  if (data.tipo === 'ADENDA_POST_FACTO') {
    if (data.correoVersion !== 1 || !notice.usuarioId || !notice.manifiestoId || typeof data.adendaId !== 'string'
      || !ADDENDUM_AUTHORITY_ROLES.includes(notice.rol as any) || !designatedReviewAccount(notice.usuarioId)) return false;
    return Boolean(await prisma.adendaManifiesto.findFirst({ where: { id: data.adendaId, manifiestoId: notice.manifiestoId }, select: { id: true } }));
  }
  if (family === 'manifiestos' && data.tipo === 'certificado_manifiesto') {
    if(data.version!==1 || !notice.manifiestoId || typeof data.documentoId!=='string' || !['PARCIAL','FINAL'].includes(data.tipoCertificado)) return false;
    const certificate=await prisma.certificadoManifiesto.findFirst({where:{id:data.documentoId,manifiestoId:notice.manifiestoId,tipo:data.tipoCertificado},select:{id:true}});
    return Boolean(certificate);
  }
  if (family === 'certificados') {
    const document = await prisma.documento.findUnique({ where: { id: data.documentoId }, include: {
      generador: { select: { usuarioId: true } }, operador: { select: { usuarioId: true } }, transportista: { select: { usuarioId: true } },
    } });
    if (!document || document.tipo !== 'CERTIFICADO_AMBIENTAL' || document.estado !== 'APROBADO') return false;
    const owners = [document.generador, document.operador, document.transportista].filter(Boolean);
    const actorId = data.actorTipo === 'generador' ? document.generadorId : data.actorTipo === 'operador' ? document.operadorId : document.transportistaId;
    return owners.length === 1 && owners[0]?.usuarioId === notice.usuarioId && actorId === data.actorId;
  }
  if (family === 'alertas' && typeof data.casoId === 'string') {
    const alert = await prisma.alertaGenerada.findUnique({ where: { id: data.casoId }, select: { estado: true, datos: true, regla: { select: { activa: true } } } });
    if (!alert?.regla.activa || !['PENDIENTE', 'EN_REVISION'].includes(alert.estado)) return false;
    if (data.familia === 'catalogo_verificable' && data.tipo === 'requerimiento_inspeccion') {
      if (!notice.usuarioId || data.version !== 1 || typeof data.entidadId !== 'string' || typeof data.inspeccionId !== 'string') return false;
      let original: Record<string, unknown>;
      try { original = JSON.parse(alert.datos); } catch { return false; }
      if (!original || original.tipo !== data.tipo || original.entidadId !== data.entidadId || original.inspeccionId !== data.inspeccionId || original.vencimiento !== data.vencimiento) return false;
      const requirement = await prisma.intercambioInspeccion.findUnique({ where: { id: data.entidadId }, include: {
        respuestas: { select: { tipo: true, parte: true } },
        inspeccion: { select: { inspectorId: true, tipoActor: true, estado: true,
          generador: { select: { usuarioId: true } }, transportista: { select: { usuarioId: true } }, operador: { select: { usuarioId: true } } } },
      } });
      if (!requirement || requirement.inspeccionId !== data.inspeccionId || requirement.plazoRespuestaAt?.toISOString() !== data.vencimiento || requirementSituation(requirement, new Date()) !== 'PENDIENTE') return false;
      const audience = inspectionAudience(notice, requirement.inspeccion);
      return data.destino === 'inspeccion' ? audience.authority : data.destino === 'participacion' && audience.participant;
    }
    return true;
  }
  if (family === 'inspecciones' && data.tipo === 'antecedente_fiscalizacion') {
    if (!validIntakeMail(data) || !notice.usuarioId) return false;
    const intake = await prisma.antecedenteFiscalizacion.findUnique({ where: { id: data.antecedenteId },
      select: { tipoActor: true, estado: true, creadoPorId: true } });
    return Boolean(intake && ['PENDIENTE', 'EN_EVALUACION'].includes(intake.estado)
      && ['ADMIN', `ADMIN_${intake.tipoActor}`].includes(notice.rol) && intake.creadoPorId !== notice.usuarioId);
  }
  if (family === 'inspecciones') {
    if (!notice.usuarioId || typeof data.inspeccionId !== 'string' || !data.inspeccionId) return false;
    const inspection = await prisma.inspeccion.findUnique({ where: { id: data.inspeccionId }, select: {
      numeroActa: true, inspectorId: true, tipoActor: true, estado: true,
      generador: { select: { usuarioId: true } }, transportista: { select: { usuarioId: true } }, operador: { select: { usuarioId: true } },
    } });
    if (!inspection || /^(?:ARP-?DEMO|DEMO)(?:[-/]|$)/i.test(inspection.numeroActa?.trim() || '')) return false;
    const { authority, participant } = inspectionAudience(notice, inspection);
    if (data.tipo === 'agenda_inspeccion') {
      if (!validAgendaMail(data)) return false;
      const event = await prisma.eventoInspeccion.findUnique({ where: { id: data.eventoId }, select: { inspeccionId: true, metadata: true } });
      const details = event?.metadata as Record<string, unknown> | null;
      if (!event || event.inspeccionId !== data.inspeccionId || details?.avisoAgenda !== data.evento) return false;
      return data.destino === 'inspeccion' ? authority
        : ['NOTIFICADA', 'EN_TRAMITE_LEGAL', 'FINALIZADA'].includes(String(data.evento)) && participant;
    }
    if (data.tipo === 'intercambio_inspeccion') {
      if (!validExchangeMail(data)) return false;
      const exchange = await prisma.intercambioInspeccion.findUnique({ where: { id: data.intercambioId }, select: {
        inspeccionId: true, secuencia: true, tipo: true, parte: true, autorId: true,
      } });
      if (!exchange || exchange.inspeccionId !== data.inspeccionId || exchange.secuencia !== data.secuencia
        || exchange.tipo !== data.evento || exchange.parte !== data.parte || exchange.autorId === notice.usuarioId) return false;
      return exchange.parte === 'AUTORIDAD' ? data.destino === 'participacion' && participant : data.destino === 'inspeccion' && authority;
    }
    return authority || (data.evento !== 'ASIGNADA' && participant);
  }
  return true;
}

/** Explicit new contract; legacy bell-only records never become a mail backfill. */
function validExchangeMail(data: Record<string, unknown>): data is Record<string, unknown> & { intercambioId: string } {
  return data.version === 1 && data.correoVersion === 1 && data.soloCampana !== true
    && typeof data.inspeccionId === 'string' && Boolean(data.inspeccionId)
    && typeof data.intercambioId === 'string' && Boolean(data.intercambioId)
    && Number.isSafeInteger(data.secuencia) && Number(data.secuencia) > 0
    && ['AUTORIDAD', 'INSPECCIONADO'].includes(String(data.parte))
    && ['participacion', 'inspeccion'].includes(String(data.destino))
    && Object.prototype.hasOwnProperty.call(INSPECTION_EXCHANGE_LABELS, String(data.evento));
}

function validAgendaMail(data: Record<string, unknown>): data is Record<string, unknown> & { eventoId: string } {
  return data.version === 1 && data.correoVersion === 1 && data.soloCampana !== true
    && typeof data.inspeccionId === 'string' && Boolean(data.inspeccionId)
    && typeof data.eventoId === 'string' && Boolean(data.eventoId)
    && ['participacion', 'inspeccion'].includes(String(data.destino))
    && Object.prototype.hasOwnProperty.call(INSPECTION_AGENDA_LABELS, String(data.evento));
}

function validIntakeMail(data: Record<string, unknown>): data is Record<string, unknown> & { antecedenteId: string } {
  return data.version === 1 && data.correoVersion === 1 && data.soloCampana !== true
    && typeof data.antecedenteId === 'string' && Boolean(data.antecedenteId);
}

function validEventualMail(data: Record<string, unknown>) {
  return data.version === 1 && data.correoVersion === 1 && data.soloCampana !== true
    && typeof data.registroId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.registroId)
    && typeof data.eventoId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.eventoId)
    && Object.prototype.hasOwnProperty.call(EVENTUAL_NOTICE_LABELS, String(data.evento));
}

/** Pending is explicit and limited to the applicant's own application/result. */
async function recipientEligible(notice: NoticeForMail, family: string): Promise<boolean> {
  if (!notice.emailVerified || !notice.notifEmail) return false;
  if (notice.activo) return true;
  if (family !== 'solicitudes' || notice.motivoInactividad !== 'PENDIENTE_APROBACION' || !notice.usuarioId) return false;
  const { solicitudId } = JSON.parse(notice.datos!);
  return Boolean(await prisma.solicitudInscripcion.findFirst({
    where: { id: solicitudId, usuarioId: notice.usuarioId, estado: { in: notice.tipo === 'SOLICITUD_RECHAZADA' ? ['RECHAZADA'] : ['BORRADOR', 'ENVIADA', 'EN_REVISION', 'OBSERVADA'] } },
    select: { id: true },
  }));
}

/** Eligibility can change while an item waits or retries; never send to an old address. */
export async function queuedNoticeStillEligible(queueId: string, recipient: string): Promise<boolean> {
  if (!queueId.startsWith('notification:')) return true;
  const notice = await prisma.notificacion.findUnique({
    where: { id: queueId.slice('notification:'.length) },
    include: { usuario: { select: { email: true, activo: true, motivoInactividad: true, emailVerified: true, notifEmail: true, rol: true, esInspector: true } } },
  });
  if (!notice?.usuario) return false;
  const user = notice.usuario;
  if (user.email.toLowerCase() !== recipient.toLowerCase()) return false;
  const content = notificationMailContent({ ...notice, ...user });
  if (!content || !enabledFamilies().includes(content.family)) return false;
  if (!await recipientEligible({ ...notice, ...user }, content.family)) return false;
  return notificationSourceEligible({ ...notice, ...user }, content.family);
}
export function notificationMailContent(notice: NoticeForMail): { family: string; subject: string; html: string } | null {
  let data: Record<string, unknown>;
  try { data = JSON.parse(notice.datos || '{}'); } catch { return null; }
  if (!data || typeof data !== 'object' || data.soloCampana === true || (data.tipo === 'intercambio_inspeccion' && !validExchangeMail(data)) || data.interno === true || data.isDemoData === true || data.modo === 'revision' || data.modo === 'prueba') return null;
  if (data.tipo === 'agenda_inspeccion' && !validAgendaMail(data)) return null;
  if (data.tipo === 'antecedente_fiscalizacion' && !validIntakeMail(data)) return null;
  if (data.tipo === 'manifiesto_eventual' && !validEventualMail(data)) return null;
  if (data.tipo === 'representacion_empresa' && !validCompanyNotice(data)) return null;
  if (data.tipo === 'ADENDA_POST_FACTO' && (data.correoVersion !== 1 || typeof data.adendaId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(data.adendaId))) return null;
  let family: string, path: string, title: string;
  if (notice.tipo === 'INFO_GENERAL' && validCompanyNotice(data)) {
    family = 'representacion'; title = 'Novedad en tu representación'; path = String(data.evento).includes('REVOCAD') ? '/notificaciones/' + encodeURIComponent(notice.id) : '/empresas?empresa=' + encodeURIComponent(String(data.empresaId));
  } else if (notice.tipo === 'INFO_GENERAL' && data.tipo === 'certificado_ambiental' && typeof data.documentoId === 'string' && data.documentoId && typeof data.actorId === 'string' && data.actorId && ['generador', 'operador', 'transportista'].includes(String(data.actorTipo))) {
    family = 'certificados'; title = 'Certificado ambiental disponible';
    path = '/mi-perfil';
  } else if (['MODIFICACION_SOLICITADA', 'MODIFICACION_APROBADA', 'MODIFICACION_RECHAZADA'].includes(notice.tipo) && typeof data.renovacionId === 'string' && data.renovacionId) {
    family = 'padron'; title = 'Novedad en una solicitud de padrón';
    path = notice.tipo === 'MODIFICACION_SOLICITADA' ? '/admin/renovaciones?anio=&revision=' + encodeURIComponent(data.renovacionId) : '/notificaciones/' + encodeURIComponent(notice.id);
  } else if (notice.tipo === 'INFO_GENERAL' && data.tipo === 'manifiesto_eventual' && validEventualMail(data)) {
    family = 'manifiestos'; title = 'Novedad en un eventual'; path = '/manifiestos/baja-intensidad?registro=' + encodeURIComponent(String(data.registroId));
  } else if (notice.tipo === 'INFO_GENERAL' && notice.manifiestoId && data.tipo === 'certificado_manifiesto' && data.version === 1 && typeof data.documentoId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.documentoId) && ['PARCIAL','FINAL'].includes(String(data.tipoCertificado))) {
    family='manifiestos'; title='Certificación disponible'; path='/manifiestos/'+encodeURIComponent(notice.manifiestoId)+'?certificado='+encodeURIComponent(data.documentoId)+'#certificaciones';
  } else if (MANIFEST_TYPES.includes(notice.tipo) && notice.manifiestoId) {
    family = 'manifiestos'; title = 'Novedad en un manifiesto'; path = '/manifiestos/' + encodeURIComponent(notice.manifiestoId);
  } else if (notice.tipo === 'INFO_GENERAL' && notice.manifiestoId && (data.tipo === 'propuesta_partes' || data.tipo === 'adenda_manifiesto' || data.tipo === 'ADENDA_POST_FACTO' || data.tipo === 'estado_manifiesto')) {
    family = 'manifiestos'; title = 'Novedad en un manifiesto';
    path = '/manifiestos/' + encodeURIComponent(notice.manifiestoId) + (['adenda_manifiesto', 'ADENDA_POST_FACTO'].includes(String(data.tipo)) ? '/adendas' + (typeof data.adendaId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.adendaId) ? '?adenda=' + data.adendaId : '') : '');
  } else if (notice.tipo === 'INFO_GENERAL' && notice.manifiestoId && data.tipo === 'relevo_transporte' && typeof data.tramoId === 'string') {
    family = 'manifiestos'; title = 'Cambio de transporte en tránsito';
    path = notice.rol === 'TRANSPORTISTA' ? '/transporte/perfil' : '/manifiestos/' + encodeURIComponent(notice.manifiestoId);
  } else if (notice.tipo === 'ALERTA_SISTEMA' && data.tipo === 'comprobante_repetido' && typeof data.solicitudId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.solicitudId)) {
    family = 'alertas'; title = 'Comprobante repetido';
    path = notice.rol.startsWith('ADMIN') ? '/admin/solicitudes/' + data.solicitudId : '/mi-solicitud?solicitud=' + data.solicitudId;
  } else if (ALERT_TYPES.includes(notice.tipo) || (notice.tipo === 'INFO_GENERAL' && (data.familia === 'catalogo_verificable' || (data.tipo === 'seguimiento_cierre' && notice.manifiestoId)) && typeof data.casoId === 'string')) {
    family = 'alertas'; title = 'Aviso de seguimiento'; path = notice.manifiestoId ? '/manifiestos/' + encodeURIComponent(notice.manifiestoId) : '/notificaciones/' + encodeURIComponent(notice.id);
  } else if (notice.tipo.startsWith('SOLICITUD_') && typeof data.solicitudId === 'string' && data.solicitudId) {
    family = 'solicitudes'; title = 'Novedad en una solicitud';
    path = notice.rol.startsWith('ADMIN') ? '/admin/solicitudes/' + encodeURIComponent(data.solicitudId) : '/mi-solicitud?solicitud=' + encodeURIComponent(data.solicitudId);
  } else if (notice.tipo === 'INFO_GENERAL' && data.tipo === 'soporte' && typeof data.ticketId === 'string' && data.ticketId) {
    family = 'soporte'; title = 'Novedad en Soporte'; path = '/soporte/' + encodeURIComponent(data.ticketId);
  } else if (notice.tipo === 'INFO_GENERAL' && data.tipo === 'antecedente_fiscalizacion' && validIntakeMail(data)) {
    family = 'inspecciones'; title = 'Nuevo antecedente para evaluar en PSIP'; path = '/inspecciones?vista=antecedentes';
  } else if (notice.tipo === 'INFO_GENERAL' && typeof data.inspeccionId === 'string' && data.inspeccionId) {
    family = 'inspecciones'; title = 'Novedad en una inspección';
    const participant = ['intercambio_inspeccion', 'agenda_inspeccion'].includes(String(data.tipo)) ? data.destino === 'participacion' : !notice.rol.startsWith('ADMIN') && !notice.esInspector;
    path = (participant ? '/requerimientos/' : '/inspecciones/') + encodeURIComponent(data.inspeccionId)
      + (!participant && data.tipo === 'intercambio_inspeccion' ? '#intercambios' : '');
  } else return null;
  // Only controlled event labels. Never copy free text, notes, attachments or amounts.
  const labels: Record<string, [string, string]> = {
    SOLICITUD_ENVIADA: ['Inscripción presentada para revisar', 'Hay una inscripción presentada. Revisá sus datos y documentación en SITREP.'],
    SOLICITUD_OBSERVADA: ['La inscripción tiene observaciones', 'Revisá las observaciones y la documentación solicitada en el trámite.'],
    SOLICITUD_MENSAJE: ['Nuevo mensaje en la inscripción', 'Hay un mensaje nuevo en el trámite. Abrilo para leerlo y responder.'],
    SOLICITUD_APROBADA: ['Inscripción aprobada', 'La administración aprobó la inscripción. Consultá el resultado en el trámite.'],
    SOLICITUD_RECHAZADA: ['Inscripción rechazada', 'Consultá el motivo de la resolución en el trámite.'],
    MODIFICACION_SOLICITADA: ['Cambio de padrón pendiente de revisión', 'Hay una modificación de datos para revisar.'],
    MODIFICACION_APROBADA: ['Cambio de padrón aprobado', 'La modificación fue aprobada. Consultá la resolución en tus avisos.'],
    MODIFICACION_RECHAZADA: ['Cambio de padrón rechazado', 'Revisá el motivo de la resolución en tus avisos.'],
    MANIFIESTO_FIRMADO: ['Manifiesto firmado', 'El manifiesto fue firmado. Revisá su estado y las acciones disponibles para tu perfil.'],
    MANIFIESTO_EN_TRANSITO: ['Manifiesto en tránsito', 'El retiro fue confirmado. Podés consultar el seguimiento del viaje.'],
    MANIFIESTO_ENTREGADO: ['Carga entregada', 'La entrega fue registrada. Revisá la recepción y las acciones disponibles en el manifiesto.'],
    MANIFIESTO_RECIBIDO: ['Carga recibida', 'La recepción fue registrada. Consultá el manifiesto para seguir el tratamiento.'],
    MANIFIESTO_TRATADO: ['Tratamiento finalizado', 'El manifiesto fue cerrado como tratado. Esto no confirma que se haya emitido una certificación. Las nuevas certificaciones requieren firma y emisión expresa del operador. Consultá los documentos disponibles en el manifiesto.'],
    MANIFIESTO_RECHAZADO: ['Carga rechazada', 'Se registró un rechazo de carga. Revisá el motivo y su seguimiento en el manifiesto.'],
    INCIDENTE_REPORTADO: ['Incidente reportado', 'Revisá el incidente y su seguimiento en SITREP.'],
    ANOMALIA_DETECTADA: ['Anomalía detectada', 'Hay una anomalía para revisar. Consultá los datos antes de tomar una decisión.'],
    VENCIMIENTO_PROXIMO: ['Vencimiento próximo', 'Revisá qué documento vence y la fecha indicada en tus avisos.'],
    ALERTA_SISTEMA: ['Alerta para revisar', 'Hay una alerta para tu perfil. Consultá su causa y el seguimiento requerido.'],
  };
  const families: Record<string, [string, string, string]> = {
    solicitudes: ['Novedad en la inscripción', 'Revisá el estado y los mensajes del trámite.', 'Abrir inscripción'],
    soporte: ['Actualización en tu ticket de soporte', 'Revisá la actividad del ticket. Podés responder dentro de SITREP; las notas internas no se incluyen en este correo.', 'Abrir ticket'],
    inspecciones: ['Actualización de inspección', 'Revisá la agenda, los controles y las acciones pendientes en el expediente.', 'Abrir inspección'],
    certificados: ['Certificado ambiental disponible', 'El certificado oficial está disponible en tu perfil. Ingresá para consultarlo o descargarlo.', 'Ver certificado'],
    manifiestos: ['Novedad en el manifiesto', 'Revisá el estado y las acciones disponibles para tu perfil.', 'Abrir manifiesto'],
    alertas: ['Aviso de seguimiento', 'Revisá la causa del aviso y su seguimiento en SITREP.', 'Revisar aviso'],
    representacion: ['Novedad en tu representación', 'Revisá tus accesos y los de tu entidad.', 'Revisar acceso'],
    padron: ['Novedad en el padrón', 'Revisá la resolución de la modificación de datos.', 'Revisar modificación'],
  };
  const fallback = families[family];
  const supportEvents: Record<string, [string, string]> = {
    CREADO: ['Nuevo ticket de soporte', 'Hay un reporte nuevo para atender. Abrí el ticket para tomarlo o derivarlo.'],
    EN_NOMBRE: ['Registraron un ticket a tu nombre', 'El equipo registró tu consulta. Podés seguirla y responder dentro del ticket.'],
    RESPONDER: ['Nueva respuesta en el ticket', 'Hay una respuesta nueva. Abrí el ticket para leerla y continuar la conversación.'],
    DERIVAR: ['Ticket derivado', 'Se derivó la atención del ticket. Consultá quién lo atiende y los próximos pasos.'],
    TOMAR: ['El ticket tiene responsable', 'Se asignó un responsable para atender el ticket. Podés consultar su seguimiento.'],
    ESPERAR: ['Ticket en espera', 'El ticket pasó a espera. Revisá qué información o acción falta para continuar.'],
    CERRAR: ['Ticket cerrado', 'El ticket fue cerrado. Consultá la respuesta y el motivo del cierre.'],
    REABRIR: ['Ticket reabierto', 'El ticket volvió a estar abierto. Consultá la conversación para continuar su atención.'],
    CLASIFICAR: ['Clasificación del ticket actualizada', 'Se actualizó la clasificación del ticket. Revisá su seguimiento.'],
  };
  const event = typeof data.evento === 'string' ? data.evento : '';
  const proposalEvents: Record<string, [string, string]> = {
    creada: ['Manifiesto pendiente de aprobación', 'Te vincularon a un manifiesto. Abrilo para revisar si te corresponde aprobarlo.'],
    aprobada: ['Manifiesto aprobado por las tres partes', 'La coordinación puede comenzar. Revisá el manifiesto para ver el siguiente paso.'],
    iniciada: ['Coordinación del manifiesto iniciada', 'Las partes ya pueden preparar el retiro. El viaje comienza al confirmar el retiro físico.'],
    rechazada: ['Propuesta de manifiesto rechazada', 'Una parte rechazó la propuesta. Consultá el motivo y el historial.'],
  };
  const addendumEvents: Record<string, [string, string]> = {
    CREADA: ['Nueva adenda para revisar', 'Se registró una diferencia en el manifiesto. Revisá el anexo y las acciones de tu perfil.'],
    APROBADA: ['Una parte aprobó la adenda', 'Se registró una aprobación individual. No representa la decisión de las otras partes ni el cierre documental. Abrí la adenda para consultar quién decidió y su estado actual.'],
    OBSERVADA: ['Adenda observada', 'Hay una observación sobre la adenda. Abrí el manifiesto para consultarla.'],
    RECHAZADA: ['Adenda rechazada', 'La resolución y el anexo original siguen disponibles en el manifiesto.'],
  };
  const proposalPhase = typeof data.fase === 'string' ? data.fase : '';
  const message = validCompanyNotice(data) ? COMPANY_NOTICE_LABELS[String(data.evento)]
    : data.tipo === 'antecedente_fiscalizacion' && validIntakeMail(data) ? ['Nuevo antecedente para evaluar en PSIP', 'Administración debe evaluar el antecedente y decidir su seguimiento. El registro no acredita una infracción.']
    : data.tipo === 'recordatorio_firma' && data.version === 1 ? [data.fase === 'SEMANA' ? 'Se acercan los 30 días desde la firma' : '30 días desde la firma del manifiesto', 'Revisá el estado actual y coordiná las acciones pendientes con las partes. El aviso conserva la fecha de firma; no determina una infracción.']
    : notice.tipo === 'ALERTA_SISTEMA' && data.tipo === 'comprobante_repetido' ? ['Comprobante repetido: revisá el documento', 'La huella del archivo coincide con un comprobante ya cargado. Revisá el aviso y el documento en tu inscripción o perfil. Este archivo no acredita un pago nuevo.']
    : data.tipo === 'manifiesto_eventual' && validEventualMail(data) ? EVENTUAL_NOTICE_LABELS[String(data.evento) as keyof typeof EVENTUAL_NOTICE_LABELS]
    : data.tipo === 'intercambio_inspeccion' && validExchangeMail(data) ? INSPECTION_EXCHANGE_LABELS[String(data.evento) as keyof typeof INSPECTION_EXCHANGE_LABELS]
    : data.tipo === 'agenda_inspeccion' && validAgendaMail(data) ? INSPECTION_AGENDA_LABELS[String(data.evento) as keyof typeof INSPECTION_AGENDA_LABELS]
    : data.tipo === 'propuesta_partes' && Object.prototype.hasOwnProperty.call(proposalEvents, proposalPhase) ? proposalEvents[proposalPhase]
    : data.tipo === 'propuesta_partes' && proposalPhase.startsWith('aprobacion-') ? ['Una parte aprobó el manifiesto', 'Revisá qué aprobaciones faltan para iniciar la coordinación.']
    : data.tipo === 'ADENDA_POST_FACTO' ? ['Nueva corriente en adenda para la autoridad', 'Se registró una aprobación individual sobre una corriente nueva. Revisá el informe y su seguimiento; no modifica habilitaciones ni acredita unanimidad.']
    : data.tipo === 'estado_manifiesto' && data.estado === 'EN_TRATAMIENTO' ? ['Tratamiento iniciado', 'El operador inició el tratamiento. Consultá el manifiesto y las acciones disponibles.']
    : data.tipo === 'estado_manifiesto' && data.estado === 'CANCELADO' ? ['Manifiesto cancelado', 'Consultá el motivo y el historial del manifiesto.']
    : data.tipo === 'adenda_manifiesto' && Object.prototype.hasOwnProperty.call(addendumEvents, event) ? addendumEvents[event]
    : data.tipo === 'certificado_manifiesto' ? [data.tipoCertificado === 'FINAL' ? 'Certificación final total disponible' : 'Certificación parcial disponible', 'El operador emitió el documento firmado. Ingresá al manifiesto para consultarlo y descargarlo.']
    : data.tipo === 'relevo_transporte' ? ['Cambio de transporte en tránsito', 'La transportista de origen registró un relevo. Revisá el tramo y su seguimiento en SITREP.']
    : family === 'soporte' && Object.prototype.hasOwnProperty.call(supportEvents, event) ? supportEvents[event]
    : family === 'inspecciones' && event === 'ASIGNADA' ? ['Tenés una inspección asignada', 'Revisá la ubicación, la agenda y los controles antes de iniciar la visita.']
    : labels[notice.tipo] || fallback;
  title = message[0];
  const deadline = data.tipo === 'intercambio_inspeccion' && validExchangeMail(data) && typeof data.plazoRespuestaAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(data.plazoRespuestaAt) && Number.isFinite(Date.parse(data.plazoRespuestaAt))
    ? '<p><strong>Plazo para responder:</strong> ' + escapeMail(new Date(data.plazoRespuestaAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' })) + ' (hora de Mendoza). Consultá el expediente por respuestas o cambios posteriores.</p>' : '';
  const reference = data.tipo === 'recordatorio_firma' && data.version === 1 && typeof data.fechaFirma === 'string' && Number.isFinite(Date.parse(data.fechaFirma))
    ? '<p><strong>Firma:</strong> ' + escapeMail(new Date(data.fechaFirma).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' }))
      + '<br><strong>30 días desde la firma:</strong> ' + escapeMail(new Date(Date.parse(data.fechaFirma) + 30 * 86400000).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' })) + '.</p>' : '';
  return { family, subject: '[SITREP] ' + title, html: mailShell(`<h1 style="color:#1B5E3C;font-size:22px;line-height:1.3;margin:0 0 16px">${escapeMail(title)}</h1><p>${escapeMail(message[1])}</p>${deadline}${reference}${mailAction(path, fallback[2])}<p style="font-size:13px;color:#526359;margin-top:20px">Ingresá con tu cuenta para ver los detalles.</p>`) };
}

export async function queueCommittedNotificationEmails(): Promise<number> {
  const policy = mailPolicy(process.env);
  const families = enabledFamilies();
  if (!policy.enabled || !families.length) return 0;
  // LEFT JOIN prevents repeated scans of already processed IDs, including suppressed recipients.
  const notices = await prisma.$queryRawUnsafe<NoticeForMail[]>(`
    SELECT n.id, n.tipo, n.datos, n."createdAt", n."usuarioId", n."manifiestoId", u.email, u.activo, u."motivoInactividad", u."emailVerified", u."notifEmail", u.rol, u."esInspector"
    FROM notificaciones n JOIN usuarios u ON u.id = n."usuarioId"
    LEFT JOIN email_queue q ON q.id = 'notification:' || n.id
    WHERE q.id IS NULL AND n."createdAt" >= $1
      AND (n.tipo::text LIKE 'SOLICITUD_%' OR n.tipo::text LIKE 'MANIFIESTO_%' OR n.tipo::text LIKE 'MODIFICACION_%'
        OR n.tipo::text IN ('INCIDENTE_REPORTADO', 'ANOMALIA_DETECTADA', 'VENCIMIENTO_PROXIMO', 'ALERTA_SISTEMA')
        OR (n.tipo::text = 'INFO_GENERAL' AND (n.datos LIKE '%"representacion_empresa"%' OR n.datos LIKE '%"manifiesto_eventual"%' OR n.datos LIKE '%"antecedente_fiscalizacion"%' OR n.datos LIKE '%"soporte"%' OR n.datos LIKE '%"inspeccionId"%' OR n.datos LIKE '%"certificado_manifiesto"%' OR n.datos LIKE '%"certificado_ambiental"%' OR n.datos LIKE '%"catalogo_verificable"%' OR n.datos LIKE '%"seguimiento_cierre"%' OR n.datos LIKE '%"propuesta_partes"%' OR n.datos LIKE '%"adenda_manifiesto"%' OR n.datos LIKE '%"relevo_transporte"%' OR n.datos LIKE '%"estado_manifiesto"%' OR n.datos LIKE '%"ADENDA_POST_FACTO"%')))
    ORDER BY n."createdAt", n.id LIMIT 100
  `, policy.notBefore);
  let inserted = 0;
  for (const notice of notices) {
    const content = notificationMailContent(notice);
    const trainingOrMissing = Boolean(content && !await notificationSourceEligible(notice, content.family));
    const eligible = content && families.includes(content.family) && !trainingOrMissing && await recipientEligible(notice, content.family);
    const result = await prisma.emailQueue.createMany({ skipDuplicates: true, data: [{
      id: 'notification:' + notice.id, to: notice.email,
      subject: content?.subject || '[SITREP] Aviso no habilitado', html: content?.html || '',
      tipo: 'TRANSACCIONAL', prioridad: 'NORMAL',
      estado: eligible ? 'PENDIENTE' : 'SUPRIMIDO',
      error: eligible ? 'NOTIFICATION_READY' : trainingOrMissing ? 'TRAINING_OR_MISSING_RESOURCE' : !content || !families.includes(content.family) ? 'EVENT_NOT_ENABLED' : 'RECIPIENT_NOT_ELIGIBLE',
    }] });
    inserted += result.count;
  }
  return inserted;
}
