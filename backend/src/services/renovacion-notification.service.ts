import type { Prisma, Renovacion, TipoNotificacion } from '@prisma/client';

/** Persist alongside the renewal decision. The mail relay handles optional delivery. */
export async function notifyRenovacion(tx: Prisma.TransactionClient, renewal: Renovacion, tipo: TipoNotificacion): Promise<void> {
  const recipients: string[] = [];
  if (tipo === 'MODIFICACION_SOLICITADA') {
    const reviewers = await tx.usuario.findMany({ where: {
      activo: true, rol: { in: ['ADMIN', renewal.tipoActor === 'GENERADOR' ? 'ADMIN_GENERADOR' : 'ADMIN_OPERADOR'] },
    }, select: { id: true } });
    recipients.push(...reviewers.map(user => user.id));
  } else {
    const actor = renewal.tipoActor === 'GENERADOR' && renewal.generadorId
      ? await tx.generador.findUnique({ where: { id: renewal.generadorId }, select: { usuarioId: true } })
      : renewal.operadorId ? await tx.operador.findUnique({ where: { id: renewal.operadorId }, select: { usuarioId: true } }) : null;
    if (actor) recipients.push(actor.usuarioId);
  }
  const title = tipo === 'MODIFICACION_SOLICITADA' ? 'Renovación de padrón pendiente'
    : tipo === 'MODIFICACION_APROBADA' ? 'Renovación de padrón aprobada' : 'Renovación de padrón rechazada';
  await tx.notificacion.createMany({ data: [...new Set(recipients)].map(usuarioId => ({
    usuarioId, tipo, titulo: title,
    mensaje: tipo === 'MODIFICACION_RECHAZADA' ? renewal.motivoRechazo || 'Consultá el resultado con la administración.'
      : tipo === 'MODIFICACION_APROBADA' ? 'La administración aprobó tu solicitud de padrón.' : 'Hay una solicitud de padrón para revisar.',
    datos: JSON.stringify({ renovacionId: renewal.id, tipoActor: renewal.tipoActor }),
  })) });
}
