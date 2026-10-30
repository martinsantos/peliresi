import prisma from '../lib/prisma';
import { isTrainingSession } from '../lib/trainingScope';
import logger from '../utils/logger';
import { enviarPushAlUsuario, type PushPayload } from './push.service';
import { notificationSourceEligible, type NoticeForMail } from './notification-mail.service';

/** Controlled labels only: notes, quantities and declarations stay behind login. */
export function manifestPushContent(notice: Pick<NoticeForMail, 'tipo' | 'datos' | 'manifiestoId' | 'rol'> & { id?: string }): PushPayload | null {
  if (!notice.manifiestoId) return null;
  let data: Record<string, unknown>;
  try { data = JSON.parse(notice.datos || '{}'); } catch { return null; }
  if (!data || data.interno === true || data.isDemoData === true || ['revision', 'prueba'].includes(String(data.modo))) return null;
  const url = '/manifiestos/' + encodeURIComponent(notice.manifiestoId);
  // A representative first opens their own notice and chooses a current,
  // verified activity/site; the push must never select a company on its own.
  const companyContext = data.destino === 'representante' || (Array.isArray(data.accesosEmpresa) && data.accesosEmpresa.length > 0);
  const ownedNotice = companyContext && typeof notice.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(notice.id)
    ? '/notificaciones/' + encodeURIComponent(notice.id) : null;
  if (companyContext && !ownedNotice) return null;
  const state: Record<string, { tipo: string; title: string }> = {
    EN_TRANSITO: { tipo: 'MANIFIESTO_EN_TRANSITO', title: 'Retiro confirmado' },
    ENTREGADO: { tipo: 'MANIFIESTO_ENTREGADO', title: 'Entrega confirmada' },
    RECIBIDO: { tipo: 'MANIFIESTO_RECIBIDO', title: 'Recepción confirmada' },
    EN_TRATAMIENTO: { tipo: 'INFO_GENERAL', title: 'Tratamiento iniciado' },
    TRATADO: { tipo: 'MANIFIESTO_TRATADO', title: 'Tratamiento registrado' },
    CANCELADO: { tipo: 'INFO_GENERAL', title: 'Manifiesto cancelado' },
  };
  const status = typeof data.estado === 'string' && Object.prototype.hasOwnProperty.call(state, data.estado) ? state[data.estado] : null;
  if (data.tipo === 'estado_manifiesto' && data.version === 1 && status?.tipo === notice.tipo) return {
    title: status.title, body: 'Abrí el manifiesto para consultar el cambio y las acciones disponibles.',
    url: ownedNotice || url, prioridad: 'NORMAL',
  };
  if (notice.tipo === 'ALERTA_SISTEMA' && data.tipo === 'recordatorio_operacion' && data.version === 1
    && (data.modalidad === 'FIJO' || data.modalidad === 'IN_SITU')) return data.modalidad === 'IN_SITU'
    ? { title: 'Tratamiento en origen previsto', body: 'Revisá las aprobaciones y coordiná el inicio. No hay retiro ni traslado.', url: ownedNotice || url, prioridad: 'ALTA' }
    : { title: 'Retiro previsto', body: 'Revisá las aprobaciones y coordiná con las partes.', url: ownedNotice || url, prioridad: 'ALTA' };
  if (notice.tipo !== 'INFO_GENERAL') return null;
  if (data.tipo === 'reversion_manifiesto' && data.version === 1) return {
    title: 'Estado del manifiesto corregido', body: 'Administración corrigió el estado. Revisá el historial y las acciones disponibles.',
    url: ownedNotice || url, prioridad: 'NORMAL',
  };
  if (data.tipo === 'relevo_transporte' && typeof data.tramoId === 'string') return {
    title: 'Cambio de transporte en tránsito', body: 'La transportista de origen registró un relevo. Revisá su seguimiento.',
    url: notice.rol === 'TRANSPORTISTA' ? '/transporte/perfil' : url, prioridad: 'ALTA',
  };
  const addenda: Record<string, string> = { CREADA: 'Nueva adenda para revisar', APROBADA: 'Adenda aprobada', OBSERVADA: 'Adenda observada', RECHAZADA: 'Adenda rechazada' };
  if (data.tipo === 'adenda_manifiesto' && typeof data.evento === 'string' && Object.prototype.hasOwnProperty.call(addenda, data.evento)) return {
    title: addenda[data.evento], body: 'Revisá el anexo y las acciones pendientes de tu perfil.', url: ownedNotice || url + '/adendas' + (typeof data.adendaId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.adendaId) ? '?adenda=' + data.adendaId : ''), prioridad: 'ALTA',
  };
  const proposals: Record<string, string> = { creada: 'Manifiesto pendiente de aprobación', aprobada: 'Tres aprobaciones: listo para iniciar', iniciada: 'Coordinación iniciada', rechazada: 'Propuesta rechazada' };
  if (data.tipo === 'propuesta_partes' && typeof data.fase === 'string') {
    const title = Object.prototype.hasOwnProperty.call(proposals, data.fase) ? proposals[data.fase] : data.fase.startsWith('aprobacion-') ? 'Una parte aprobó el manifiesto' : null;
    if (title) return { title, body: 'Abrí el manifiesto para ver su estado y tu siguiente paso.', url: ownedNotice || url, prioridad: 'ALTA' };
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
