import { Prisma, PrioridadNotificacion, TipoNotificacion } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { DomainEvent } from './domainEvent.service';

export interface DefaultAdminNoticeInput {
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  manifiestoId?: string;
  prioridad: PrioridadNotificacion;
  excluirId?: string;
}

/** Reuses the same class/manifest window for direct and transactional callers.
 * No external channel runs while this transaction holds a lock. */
export async function saveDefaultAdminNotices(tx: Prisma.TransactionClient, input: DefaultAdminNoticeInput) {
  const { tipo, titulo, mensaje, manifiestoId, prioridad, excluirId } = input;
  const lockKey = JSON.stringify(['default-admin-notice', tipo, titulo, manifiestoId ?? null]);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text`;
  // Read the DB clock after waiting for the transaction-level lock.
  const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS "now"`;
  const admins = await tx.usuario.findMany({ where: { rol: 'ADMIN', activo: true }, select: { id: true } });
  const ids = admins.map(admin => admin.id).filter(id => id !== excluirId).sort();
  const existing = ids.length ? await tx.notificacion.findMany({
    where: { usuarioId: { in: ids }, tipo, titulo, manifiestoId: manifiestoId ?? null,
      createdAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) } },
    select: { usuarioId: true },
  }) : [];
  const alreadyNotified = new Set(existing.map(notice => notice.usuarioId));
  const fresh = ids.filter(id => !alreadyNotified.has(id)).map(usuarioId => ({ id: randomUUID(), usuarioId,
    tipo, titulo, mensaje, manifiestoId: manifiestoId ?? null, prioridad, createdAt: now }));
  if (fresh.length) await tx.notificacion.createMany({ data: fresh });
  return fresh;
}

export function defaultGpsAnomalyNotice(event: Extract<DomainEvent, { type: 'ANOMALIA_GPS' }>): DefaultAdminNoticeInput {
  const titles: Record<string, string> = {
    VELOCIDAD_ANORMAL: 'GPS: posible velocidad elevada',
    PARADA_PROLONGADA: 'GPS: posible parada',
    GPS_PERDIDO: 'GPS: sin posiciones recibidas',
  };
  return { tipo: 'ANOMALIA_DETECTADA', titulo: titles[event.tipoAnomalia] || '⚠️ Anomalía GPS Detectada',
    mensaje: `${event.numero ? `${event.numero} · ` : ''}${event.descripcion}`,
    manifiestoId: event.manifiestoId, prioridad: event.severidad === 'ALTA' ? 'URGENTE' : 'ALTA', excluirId: event.userId };
}
