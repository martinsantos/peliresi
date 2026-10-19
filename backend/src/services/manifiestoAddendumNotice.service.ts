import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';

type AddendumEvent = 'CREADA' | 'APROBADA' | 'OBSERVADA' | 'RECHAZADA';
type Manifest = { id: string; numero: string; generadorId: string; transportistaId: string | null; operadorId: string };

/** Record a notice in the same transaction as the addendum, without external I/O. */
export async function notifyAddendumParties(
  tx: Prisma.TransactionClient,
  manifest: Manifest,
  adendaId: string,
  version: number,
  event: AddendumEvent,
  authorId: string,
) {
  const [generador, transportista, operador] = await Promise.all([
    tx.generador.findUnique({ where: { id: manifest.generadorId }, select: { usuarioId: true } }),
    manifest.transportistaId ? tx.transportista.findUnique({ where: { id: manifest.transportistaId }, select: { usuarioId: true } }) : null,
    tx.operador.findUnique({ where: { id: manifest.operadorId }, select: { usuarioId: true } }),
  ]);
  const recipients = [...new Set([generador?.usuarioId, transportista?.usuarioId, operador?.usuarioId])]
    .filter((id): id is string => !!id && id !== authorId);
  const labels: Record<AddendumEvent, [string, string]> = {
    CREADA: ['Nueva adenda en tu manifiesto', 'Abrí la adenda para ver la diferencia declarada y, si te corresponde, revisarla.'],
    APROBADA: ['Adenda aprobada', 'La revisión quedó registrada. Consultá el manifiesto y su anexo.'],
    OBSERVADA: ['Adenda observada', 'Hay una observación para revisar en el manifiesto.'],
    RECHAZADA: ['Adenda rechazada', 'La adenda quedó rechazada; el original y la resolución se conservan.'],
  };
  const [title, message] = labels[event];
  await tx.notificacion.createMany({ skipDuplicates: true, data: recipients.map(usuarioId => ({
    id: createHash('sha256').update(`adenda:${adendaId}:${version}:${event}:${usuarioId}`).digest('hex'),
    usuarioId, tipo: 'INFO_GENERAL', titulo: title,
    mensaje: `${manifest.numero}. ${message}`, manifiestoId: manifest.id,
    prioridad: event === 'CREADA' || event === 'OBSERVADA' ? 'ALTA' : 'NORMAL',
    datos: JSON.stringify({ tipo: 'adenda_manifiesto', evento: event, adendaId, url: `/manifiestos/${manifest.id}/adendas` }),
  })) });
}
