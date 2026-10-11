/** Relay committed in-app notices, never send from inside a business transaction.
 * Separate opt-in per family; SMTP still requires its own explicit activation.
 * No historic backfill: both source notices and queue are fenced by the cutoff.
 */
import prisma from '../lib/prisma';
import { mailPolicy } from './email-policy';
import { escapeMail, mailLink, mailShell } from './email-templates';
import { isFullAccess } from '../utils/roleFilter';

export type NoticeForMail = {
  id: string; tipo: string; datos: string | null; createdAt: Date;
  email: string; activo: boolean; emailVerified: boolean; notifEmail: boolean; rol: string;
  usuarioId?: string; motivoInactividad?: string | null;
  manifiestoId?: string | null; esInspector?: boolean;
};
const MANIFEST_TYPES = ['MANIFIESTO_FIRMADO', 'MANIFIESTO_EN_TRANSITO', 'MANIFIESTO_ENTREGADO', 'MANIFIESTO_RECIBIDO', 'MANIFIESTO_TRATADO', 'MANIFIESTO_RECHAZADO'];
const ALERT_TYPES = ['INCIDENTE_REPORTADO', 'ANOMALIA_DETECTADA', 'VENCIMIENTO_PROXIMO', 'ALERTA_SISTEMA'];
function enabledFamilies(): string[] {
  return (process.env.EMAIL_NOTIFICATION_FAMILIES || '').split(',').map(item => item.trim()).filter(item => ['solicitudes', 'soporte', 'inspecciones', 'certificados', 'manifiestos', 'alertas', 'padron'].includes(item));
}

/** Recheck the source at enqueue AND delivery, including reassignment/revocation. */
async function sourceEligible(notice: NoticeForMail, family: string): Promise<boolean> {
  const data = JSON.parse(notice.datos || '{}');
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
      isDemoData: true, generador: { select: { usuarioId: true } },
      transportista: { select: { usuarioId: true } }, operador: { select: { usuarioId: true } },
    } });
    if (!manifest || manifest.isDemoData) return false;
    const owner = notice.rol === 'GENERADOR' ? manifest.generador : notice.rol === 'TRANSPORTISTA' ? manifest.transportista : notice.rol === 'OPERADOR' ? manifest.operador : null;
    if (!isFullAccess(notice) && (!notice.usuarioId || owner?.usuarioId !== notice.usuarioId)) return false;
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
    const alert = await prisma.alertaGenerada.findUnique({ where: { id: data.casoId }, select: { estado: true, regla: { select: { activa: true } } } });
    return Boolean(alert?.regla.activa && ['PENDIENTE', 'EN_REVISION'].includes(alert.estado));
  }
  if (family === 'inspecciones') {
    const inspection = await prisma.inspeccion.findUnique({ where: { id: data.inspeccionId }, select: { numeroActa: true } });
    return Boolean(inspection && !/^(?:ARP-?DEMO|DEMO)(?:[-/]|$)/i.test(inspection.numeroActa?.trim() || ''));
  }
  return true;
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
  return sourceEligible({ ...notice, ...user }, content.family);
}
export function notificationMailContent(notice: NoticeForMail): { family: string; subject: string; html: string } | null {
  let data: Record<string, unknown>;
  try { data = JSON.parse(notice.datos || '{}'); } catch { return null; }
  if (!data || typeof data !== 'object' || data.interno === true || data.isDemoData === true || data.modo === 'revision' || data.modo === 'prueba') return null;
  let family: string, path: string, title: string;
  if (notice.tipo === 'INFO_GENERAL' && data.tipo === 'certificado_ambiental' && typeof data.documentoId === 'string' && data.documentoId && typeof data.actorId === 'string' && data.actorId && ['generador', 'operador', 'transportista'].includes(String(data.actorTipo))) {
    family = 'certificados'; title = 'Certificado ambiental disponible';
    path = '/mi-perfil';
  } else if (['MODIFICACION_SOLICITADA', 'MODIFICACION_APROBADA', 'MODIFICACION_RECHAZADA'].includes(notice.tipo) && typeof data.renovacionId === 'string' && data.renovacionId) {
    family = 'padron'; title = 'Novedad en una solicitud de padrón';
    path = notice.tipo === 'MODIFICACION_SOLICITADA' ? '/admin/renovaciones' : '/notificaciones';
  } else if (MANIFEST_TYPES.includes(notice.tipo) && notice.manifiestoId) {
    family = 'manifiestos'; title = 'Novedad en un manifiesto'; path = '/manifiestos/' + encodeURIComponent(notice.manifiestoId);
  } else if (ALERT_TYPES.includes(notice.tipo) || (notice.tipo === 'INFO_GENERAL' && data.familia === 'catalogo_verificable' && typeof data.casoId === 'string')) {
    family = 'alertas'; title = 'Aviso de seguimiento'; path = '/notificaciones';
  } else if (notice.tipo.startsWith('SOLICITUD_') && typeof data.solicitudId === 'string' && data.solicitudId) {
    family = 'solicitudes'; title = 'Novedad en una solicitud';
    path = notice.rol.startsWith('ADMIN') ? '/admin/solicitudes/' + encodeURIComponent(data.solicitudId) : '/mi-solicitud';
  } else if (notice.tipo === 'INFO_GENERAL' && data.tipo === 'soporte' && typeof data.ticketId === 'string' && data.ticketId) {
    family = 'soporte'; title = 'Novedad en Soporte'; path = '/soporte/' + encodeURIComponent(data.ticketId);
  } else if (notice.tipo === 'INFO_GENERAL' && typeof data.inspeccionId === 'string' && data.inspeccionId) {
    family = 'inspecciones'; title = 'Novedad en una inspección'; path = '/inspecciones/' + encodeURIComponent(data.inspeccionId);
  } else return null;
  // Do not embed free text, internal notes, attachments, identity data or amounts in email.
  const link = escapeMail(mailLink(path));
  return { family, subject: '[SITREP] ' + title, html: mailShell(`<h1 style="color:#1B5E3C;font-size:22px">${title}</h1><p>Tenés una actualización disponible. Ingresá con tu cuenta para revisarla.</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#1B5E3C;color:#ffffff;text-decoration:none;border-radius:8px">Ver en SITREP</a></p><p style="word-break:break-all;font-size:12px">${link}</p>`) };
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
        OR (n.tipo::text = 'INFO_GENERAL' AND (n.datos LIKE '%"soporte"%' OR n.datos LIKE '%"inspeccionId"%' OR n.datos LIKE '%"certificado_ambiental"%' OR n.datos LIKE '%"catalogo_verificable"%')))
    ORDER BY n."createdAt", n.id LIMIT 100
  `, policy.notBefore);
  let inserted = 0;
  for (const notice of notices) {
    const content = notificationMailContent(notice);
    const trainingOrMissing = Boolean(content && !await sourceEligible(notice, content.family));
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
