import { createHash } from 'node:crypto';
import type { Prisma, RegistroManifiestoExcepcional } from '@prisma/client';
import { exceptionalApproval, type ExceptionalApprover, type ExceptionalEvent } from '../domain/manifiestoExcepcional';
import { reviewAuthorityByRole } from '../domain/manifestReviewAuthority';

export const EVENTUAL_NOTICE_LABELS = {
  CREADO: ['Nuevo eventual: revisá tu participación', 'Te vincularon a un eventual. Abrilo para revisar los datos y la aprobación que corresponde a tu perfil.'],
  APROBACION: ['Una parte aprobó el eventual', 'Consultá qué aprobaciones faltan. Todavía no se habilita el avance hasta reunirlas.'],
  APROBADO: ['Eventual aprobado por sus participantes', 'Las partes requeridas aprobaron. Consultá el siguiente paso operativo.'],
  RECHAZADO: ['Participación rechazada en el eventual', 'El avance quedó bloqueado. Consultá el motivo y las decisiones conservadas.'],
  RETIRADO: ['Retiro registrado en el eventual', 'Se registró el retiro. Consultá el estado y la carga declarada.'],
  RECIBIDO: ['Recepción registrada en el eventual', 'Se registró la recepción. Consultá el estado y las diferencias informadas.'],
  TRATADO: ['Tratamiento registrado en el eventual', 'El tratamiento quedó registrado; la revisión documental se consulta por separado.'],
  DIFERENCIA: ['Nueva diferencia en el eventual', 'Hay una diferencia registrada. La declaración original se conserva.'],
  SOLICITAR_REVISION: ['Eventual con revisión solicitada', 'Se solicitó una revisión posterior. Abrí el eventual para ver si corresponde actuar a tu perfil.'],
  APROBADA_POST_FACTO: ['Revisión del eventual aprobada', 'La decisión quedó registrada; consultá su fundamento y trazabilidad.'],
  OBSERVADA_POST_FACTO: ['Revisión del eventual observada', 'Hay una observación sobre el registro o una diferencia. Consultá qué debe revisarse.'],
  RECHAZADA_POST_FACTO: ['Revisión del eventual rechazada', 'Consultá la decisión; los hechos y la declaración original se conservan.'],
} as const;
export type EventualNoticeKind = keyof typeof EVENTUAL_NOTICE_LABELS;

/** Resolve the committed event, using only the approvals that existed at that point. */
export function eventualNoticeEvent(record: RegistroManifiestoExcepcional, eventId: string): { kind: EventualNoticeKind; authorId: string } | null {
  if (eventId === 'creacion') return { kind: 'CREADO', authorId: record.creadoPorId };
  const events = record.eventos as unknown as ExceptionalEvent[];
  const index = events.findIndex(event => event.id === eventId), event = events[index];
  if (!event) return null;
  if (event.tipo === 'APROBAR_PARTE') {
    const approvers = (record.datos as { aprobaciones?: ExceptionalApprover[] }).aprobaciones;
    return { kind: exceptionalApproval(approvers, events.slice(0, index + 1)).estado === 'APROBADO' ? 'APROBADO' : 'APROBACION', authorId: event.autorId };
  }
  const kind = event.tipo === 'RECHAZAR_PARTE' ? 'RECHAZADO' : event.tipo === 'AVANCE' ? event.etapa
    : event.tipo === 'RESOLVER' ? `${event.decision}_POST_FACTO` : event.tipo;
  return kind && Object.prototype.hasOwnProperty.call(EVENTUAL_NOTICE_LABELS, kind) ? { kind: kind as EventualNoticeKind, authorId: event.autorId } : null;
}

/** Current registered accounts only. Free-text contact data never creates a recipient. */
export async function eventualNoticeAudience(tx: Prisma.TransactionClient, record: RegistroManifiestoExcepcional,
  kind: EventualNoticeKind, authorId: string) {
  const parties = record.datos as Partial<Record<'generador' | 'transportista', { padronId?: string }>>;
  // Match the creator read scope: an actor account still needs its actor relation.
  const or: Prisma.UsuarioWhereInput[] = [{ id: record.creadoPorId, OR: [
    { rol: 'ADMIN' }, { rol: 'GENERADOR', generador: { isNot: null } },
    { rol: 'TRANSPORTISTA', transportista: { isNot: null } }, { rol: 'OPERADOR', operador: { isNot: null } },
  ] }];
  if (parties.generador?.padronId) or.push({ rol: 'GENERADOR', generador: { is: { id: parties.generador.padronId } } });
  if (parties.transportista?.padronId) or.push({ rol: 'TRANSPORTISTA', transportista: { is: { id: parties.transportista.padronId } } });
  if (record.operadorId) or.push({ rol: 'OPERADOR', operador: { is: { id: record.operadorId } } });
  if (kind === 'SOLICITAR_REVISION') {
    const reviewers = (process.env.MANIFEST_EXCEPTIONAL_REVIEWERS || '').split(',').filter(id => id && id !== record.creadoPorId && id !== record.impersonadoPorId);
    if (reviewAuthorityByRole()) or.push({ rol: 'ADMIN', id: { notIn: [record.creadoPorId, record.impersonadoPorId].filter((id): id is string => Boolean(id)) } });
    else if (reviewers.length) or.push({ rol: 'ADMIN', id: { in: reviewers } });
  }
  return tx.usuario.findMany({ where: { activo: true, id: { not: authorId }, OR: or }, select: { id: true } });
}

export async function notifyEventualParties(tx: Prisma.TransactionClient, record: RegistroManifiestoExcepcional, eventId: string) {
  const event = eventualNoticeEvent(record, eventId);
  if (!event) return;
  const recipients = await eventualNoticeAudience(tx, record, event.kind, event.authorId);
  if (!recipients.length) return;
  const [title, action] = EVENTUAL_NOTICE_LABELS[event.kind];
  await tx.notificacion.createMany({ skipDuplicates: true, data: recipients.map(user => ({
    id: createHash('sha256').update(`eventual:${record.id}:${eventId}:${user.id}`).digest('hex'),
    usuarioId: user.id, tipo: 'INFO_GENERAL', titulo: title, mensaje: `BI-${record.id} · ${action}`,
    prioridad: ['CREADO', 'SOLICITAR_REVISION', 'OBSERVADA_POST_FACTO'].includes(event.kind) ? 'ALTA' : 'NORMAL',
    datos: JSON.stringify({ tipo: 'manifiesto_eventual', version: 1, correoVersion: 1, registroId: record.id, eventoId: eventId, evento: event.kind }),
  })) });
}
