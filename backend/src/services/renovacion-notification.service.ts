import type { Prisma, Renovacion, TipoNotificacion } from '@prisma/client';
import { RENEWAL_NOTICE_LABELS, renewalNoticeReference, validRenewalNotice } from '../domain/renewalNotice';

/** Persist alongside the renewal decision. The mail relay handles optional delivery. */
export async function notifyRenovacion(tx: Prisma.TransactionClient, renewal: Renovacion, tipo: TipoNotificacion): Promise<void> {
  const recipients: string[] = [];
  const actor = renewal.tipoActor === 'GENERADOR' && renewal.generadorId
    ? await tx.generador.findUnique({ where: { id: renewal.generadorId }, select: { usuarioId: true, razonSocial: true } })
    : renewal.tipoActor === 'OPERADOR' && renewal.operadorId
      ? await tx.operador.findUnique({ where: { id: renewal.operadorId }, select: { usuarioId: true, razonSocial: true } }) : null;
  const context = {
    tipo: 'renovacion_padron', version: 1, renovacionId: renewal.id, tipoActor: renewal.tipoActor,
    actorNombre: actor?.razonSocial?.trim().slice(0, 200) || '', anio: renewal.anio,
  };
  if (tipo === 'MODIFICACION_SOLICITADA') {
    const reviewers = await tx.usuario.findMany({ where: {
      activo: true, rol: { in: ['ADMIN', renewal.tipoActor === 'GENERADOR' ? 'ADMIN_GENERADOR' : 'ADMIN_OPERADOR'] },
    }, select: { id: true } });
    recipients.push(...reviewers.map(user => user.id));
  } else {
    if (actor) recipients.push(actor.usuarioId);
  }
  const [title, action] = RENEWAL_NOTICE_LABELS[tipo] || ['Renovación de padrón', 'Consultá el resultado en tus avisos.'];
  const reference = validRenewalNotice(context) ? renewalNoticeReference(context) + '. ' : '';
  await tx.notificacion.createMany({ data: [...new Set(recipients)].map(usuarioId => ({
    usuarioId, tipo, titulo: title,
    mensaje: reference + action + (tipo === 'MODIFICACION_RECHAZADA' && renewal.motivoRechazo ? ' Motivo: ' + renewal.motivoRechazo : ''),
    datos: JSON.stringify(validRenewalNotice(context) ? context : { renovacionId: renewal.id, tipoActor: renewal.tipoActor }),
  })) });
}
