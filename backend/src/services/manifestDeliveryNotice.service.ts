import { createHash } from 'node:crypto';
import type { Prisma, PrioridadNotificacion, TipoNotificacion } from '@prisma/client';
import { manifestCompanyRecipients, type ManifestCompanyAccess } from './manifestCompanyRecipients.service';

type DeliveryManifest = {
 id: string; numero: string;
 generador: { usuarioId: string }; transportista: { usuarioId: string } | null; operador: { usuarioId: string };
};

/** Save the inbox together with the delivery, never in the later event subscriber. */
export async function notifyManifestDelivery(tx: Prisma.TransactionClient, manifest: DeliveryManifest, eventId: string, authorId: string) {
 const recipientIds = new Set<string>();
 const companyAccesses = new Map<string, ManifestCompanyAccess[]>();
 for (const userId of [manifest.generador.usuarioId, manifest.transportista?.usuarioId, manifest.operador.usuarioId]) {
  if (userId && userId !== authorId) recipientIds.add(userId);
 }
 for (const recipient of await manifestCompanyRecipients(tx, manifest.id)) {
  if (recipient.usuarioId !== authorId && !recipientIds.has(recipient.usuarioId) && recipient.accesosEmpresa.length) {
   recipientIds.add(recipient.usuarioId); companyAccesses.set(recipient.usuarioId, recipient.accesosEmpresa);
  }
 }
 const admins = await tx.usuario.findMany({ where: { rol: 'ADMIN', activo: true }, select: { id: true } });
 for (const admin of admins) recipientIds.add(admin.id);
 const notices = [...recipientIds].map(usuarioId => ({
  id: createHash('sha256').update(JSON.stringify(['manifest-delivery-notice-v1', eventId, usuarioId])).digest('hex'),
  usuarioId, tipo: 'MANIFIESTO_ENTREGADO' as TipoNotificacion, titulo: 'Entrega confirmada',
  mensaje: `El manifiesto ${manifest.numero} fue entregado en destino.`, manifiestoId: manifest.id,
  prioridad: 'NORMAL' as PrioridadNotificacion,
  datos: JSON.stringify(companyAccesses.has(usuarioId)
   ? { tipo: 'alerta_evento_manifiesto', version: 1, evento: 'ENTREGA', eventoId: eventId,
    destino: 'representante', accesosEmpresa: companyAccesses.get(usuarioId) }
   : { tipo: 'estado_manifiesto', version: 1, estado: 'ENTREGADO' }),
 }));
 // A conflict or insert failure must abort the entire delivery. A later replay
 // follows its stored receipt and never creates this event or its notices again.
 if (notices.length) await tx.notificacion.createMany({ data: notices });
 return notices;
}
