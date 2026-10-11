/** Relay committed in-app notices, never send from inside a business transaction.
 * Separate opt-in per family; SMTP still requires its own explicit activation.
 * No historic backfill: both source notices and queue are fenced by the cutoff.
 */
import prisma from '../lib/prisma';
import { mailPolicy } from './email-policy';
import { escapeMail, mailLink, mailShell } from './email-templates';

export type NoticeForMail = {
  id: string; tipo: string; datos: string | null; createdAt: Date;
  email: string; activo: boolean; emailVerified: boolean; notifEmail: boolean; rol: string;
  usuarioId?: string; motivoInactividad?: string | null;
};
function enabledFamilies(): string[] {
  return (process.env.EMAIL_NOTIFICATION_FAMILIES || '').split(',').filter(item => ['solicitudes', 'soporte', 'inspecciones'].includes(item));
}

/** Pending is explicit and limited to the applicant's own still-open application. */
async function recipientEligible(notice: NoticeForMail, family: string): Promise<boolean> {
  if (!notice.emailVerified || !notice.notifEmail) return false;
  if (notice.activo) return true;
  if (family !== 'solicitudes' || notice.motivoInactividad !== 'PENDIENTE_APROBACION' || !notice.usuarioId) return false;
  const { solicitudId } = JSON.parse(notice.datos!);
  return Boolean(await prisma.solicitudInscripcion.findFirst({
    where: { id: solicitudId, usuarioId: notice.usuarioId, estado: { in: ['BORRADOR', 'ENVIADA', 'EN_REVISION', 'OBSERVADA'] } },
    select: { id: true },
  }));
}

/** Eligibility can change while an item waits or retries; never send to an old address. */
export async function queuedNoticeStillEligible(queueId: string, recipient: string): Promise<boolean> {
  if (!queueId.startsWith('notification:')) return true;
  const notice = await prisma.notificacion.findUnique({
    where: { id: queueId.slice('notification:'.length) },
    include: { usuario: { select: { email: true, activo: true, motivoInactividad: true, emailVerified: true, notifEmail: true, rol: true } } },
  });
  if (!notice?.usuario) return false;
  const user = notice.usuario;
  if (user.email.toLowerCase() !== recipient.toLowerCase()) return false;
  const content = notificationMailContent({ ...notice, ...user });
  if (!content || !enabledFamilies().includes(content.family)) return false;
  if (!await recipientEligible({ ...notice, ...user }, content.family)) return false;
  if (content.family === 'inspecciones') {
    const { inspeccionId } = JSON.parse(notice.datos!);
    const inspection = await prisma.inspeccion.findUnique({ where: { id: inspeccionId }, select: { numeroActa: true } });
    if (!inspection || /^(?:ARP-?DEMO|DEMO)(?:[-/]|$)/i.test(inspection.numeroActa?.trim() || '')) return false;
  }
  return true;
}
export function notificationMailContent(notice: NoticeForMail): { family: string; subject: string; html: string } | null {
  let data: Record<string, unknown>;
  try { data = JSON.parse(notice.datos || '{}'); } catch { return null; }
  if (!data || typeof data !== 'object' || data.interno === true || data.isDemoData === true || data.modo === 'revision' || data.modo === 'prueba') return null;
  let family: string, path: string, title: string;
  if (notice.tipo.startsWith('SOLICITUD_') && typeof data.solicitudId === 'string' && data.solicitudId) {
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
    SELECT n.id, n.tipo, n.datos, n."createdAt", n."usuarioId", u.email, u.activo, u."motivoInactividad", u."emailVerified", u."notifEmail", u.rol
    FROM notificaciones n JOIN usuarios u ON u.id = n."usuarioId"
    LEFT JOIN email_queue q ON q.id = 'notification:' || n.id
    WHERE q.id IS NULL AND n."createdAt" >= $1
      AND (n.tipo::text LIKE 'SOLICITUD_%' OR (n.tipo::text = 'INFO_GENERAL'
        AND (n.datos LIKE '%"soporte"%' OR n.datos LIKE '%"inspeccionId"%')))
    ORDER BY n."createdAt", n.id LIMIT 100
  `, policy.notBefore);
  let inserted = 0;
  for (const notice of notices) {
    const content = notificationMailContent(notice);
    let trainingOrMissing = false;
    if (content?.family === 'inspecciones') {
      const { inspeccionId } = JSON.parse(notice.datos!);
      const inspection = await prisma.inspeccion.findUnique({ where: { id: inspeccionId }, select: { numeroActa: true } });
      trainingOrMissing = !inspection || /^(?:ARP-?DEMO|DEMO)(?:[-/]|$)/i.test(inspection.numeroActa?.trim() || '');
    }
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
