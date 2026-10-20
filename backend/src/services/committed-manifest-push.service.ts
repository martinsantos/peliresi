import prisma from '../lib/prisma';
import { isTrainingSession } from '../lib/trainingScope';
import logger from '../utils/logger';
import { enviarPushAlUsuario, type PushPayload } from './push.service';
import { notificationSourceEligible, type NoticeForMail } from './notification-mail.service';

/** Controlled labels only: notes, quantities and declarations stay behind login. */
export function manifestPushContent(notice: Pick<NoticeForMail, 'tipo' | 'datos' | 'manifiestoId' | 'rol'>): PushPayload | null {
  if (notice.tipo !== 'INFO_GENERAL' || !notice.manifiestoId) return null;
  let data: Record<string, unknown>;
  try { data = JSON.parse(notice.datos || '{}'); } catch { return null; }
  if (!data || data.interno === true || data.isDemoData === true || ['revision', 'prueba'].includes(String(data.modo))) return null;
  const url = '/manifiestos/' + encodeURIComponent(notice.manifiestoId);
  if (data.tipo === 'relevo_transporte' && typeof data.tramoId === 'string') return {
    title: 'Cambio de transporte en tránsito', body: 'La transportista de origen registró un relevo. Revisá su seguimiento.',
    url: notice.rol === 'TRANSPORTISTA' ? '/transporte/perfil' : url, prioridad: 'ALTA',
  };
  const addenda: Record<string, string> = { CREADA: 'Nueva adenda para revisar', APROBADA: 'Adenda aprobada', OBSERVADA: 'Adenda observada', RECHAZADA: 'Adenda rechazada' };
  if (data.tipo === 'adenda_manifiesto' && typeof data.evento === 'string' && Object.prototype.hasOwnProperty.call(addenda, data.evento)) return {
    title: addenda[data.evento], body: 'Revisá el anexo y las acciones pendientes de tu perfil.', url: url + '/adendas', prioridad: 'ALTA',
  };
  const proposals: Record<string, string> = { creada: 'Manifiesto pendiente de aprobación', aprobada: 'Tres aprobaciones: listo para iniciar', iniciada: 'Coordinación iniciada', rechazada: 'Propuesta rechazada' };
  if (data.tipo === 'propuesta_partes' && typeof data.fase === 'string') {
    const title = Object.prototype.hasOwnProperty.call(proposals, data.fase) ? proposals[data.fase] : data.fase.startsWith('aprobacion-') ? 'Una parte aprobó el manifiesto' : null;
    if (title) return { title, body: 'Abrí el manifiesto para ver su estado y tu siguiente paso.', url, prioridad: 'ALTA' };
  }
  return null;
}

/** Called ONLY after the business transaction commits, with newly inserted IDs.
 * Push is best effort; the durable inbox is the authoritative notice history.
 * Email uses its separate durable relay, verification and opt-in policy. */
export async function dispatchCommittedManifestPush(ids: string[]): Promise<number> {
  if (isTrainingSession() || process.env.PUSH_MANIFEST_NOTICES_ENABLED !== 'true' || !ids.length) return 0;
  const notices = await prisma.notificacion.findMany({ where: { id: { in: [...new Set(ids)] } }, include: {
    usuario: { select: { email: true, activo: true, emailVerified: true, notifEmail: true, rol: true, esInspector: true } },
  } });
  let attempted = 0;
  for (const notice of notices) {
    const user = notice.usuario;
    if (!user?.activo || !user.emailVerified || !notice.usuarioId) continue;
    const payload = manifestPushContent({ ...notice, rol: user.rol });
    if (!payload || !await notificationSourceEligible({ ...notice, ...user, usuarioId: notice.usuarioId }, 'manifiestos')) continue;
    // A deterministic tag updates this same notice on subscribed devices.
    await enviarPushAlUsuario(notice.usuarioId, { ...payload, tag: 'notification:' + notice.id });
    attempted++;
  }
  return attempted;
}

export function scheduleCommittedManifestPush(ids: string[]): void {
  if (isTrainingSession() || process.env.PUSH_MANIFEST_NOTICES_ENABLED !== 'true' || !ids.length) return;
  setImmediate(() => { void dispatchCommittedManifestPush(ids).catch(error => logger.warn({ error }, 'Committed manifest push attempt failed; inbox notice retained')); });
}
