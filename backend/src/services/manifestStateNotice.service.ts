import { createHash } from 'node:crypto';
import type { Prisma, PrioridadNotificacion, TipoNotificacion } from '@prisma/client';
import { manifestCompanyRecipients, type ManifestCompanyAccess } from './manifestCompanyRecipients.service';

type State = 'EN_TRANSITO' | 'ENTREGADO' | 'RECIBIDO' | 'EN_TRATAMIENTO' | 'TRATADO' | 'CANCELADO';
type Manifest = {
 id: string; numero: string;
 generador: { usuarioId: string }; transportista: { usuarioId: string } | null; operador: { usuarioId: string };
};

/** Save the inbox in the same transaction as the transition and its event. */
export async function notifyManifestState(tx: Prisma.TransactionClient, manifest: Manifest, state: State, eventId: string, authorId: string) {
 const labels: Record<State, { tipo: TipoNotificacion; titulo: string; mensaje: string }> = {
  EN_TRANSITO: { tipo: 'MANIFIESTO_EN_TRANSITO', titulo: 'Retiro confirmado', mensaje: `El manifiesto ${manifest.numero} está en tránsito.` },
  ENTREGADO: { tipo: 'MANIFIESTO_ENTREGADO', titulo: 'Entrega confirmada', mensaje: `El manifiesto ${manifest.numero} fue entregado en destino.` },
  RECIBIDO: { tipo: 'MANIFIESTO_RECIBIDO', titulo: 'Recepción confirmada', mensaje: `El operador confirmó la recepción del manifiesto ${manifest.numero}.` },
  EN_TRATAMIENTO: { tipo: 'INFO_GENERAL', titulo: 'Tratamiento iniciado', mensaje: `El operador inició el tratamiento del manifiesto ${manifest.numero}.` },
  TRATADO: { tipo: 'MANIFIESTO_TRATADO', titulo: 'Tratamiento registrado', mensaje: `El manifiesto ${manifest.numero} fue tratado y cerrado.` },
  CANCELADO: { tipo: 'INFO_GENERAL', titulo: 'Manifiesto cancelado', mensaje: `El manifiesto ${manifest.numero} fue cancelado. Consultá el motivo y el historial.` },
 };
 const recipientIds = new Set<string>();
 const companyAccesses = new Map<string, ManifestCompanyAccess[]>();
 for (const id of [manifest.generador.usuarioId, manifest.transportista?.usuarioId, manifest.operador.usuarioId]) {
  if (id && id !== authorId) recipientIds.add(id);
 }
 for (const recipient of await manifestCompanyRecipients(tx, manifest.id)) {
  if (recipient.usuarioId !== authorId && !recipientIds.has(recipient.usuarioId) && recipient.accesosEmpresa.length) {
   recipientIds.add(recipient.usuarioId); companyAccesses.set(recipient.usuarioId, recipient.accesosEmpresa);
  }
 }
 const admins = await tx.usuario.findMany({ where: { rol: 'ADMIN', activo: true }, select: { id: true } });
 for (const admin of admins) recipientIds.add(admin.id);
 const notices = [...recipientIds].map(usuarioId => ({
  id: createHash('sha256').update(JSON.stringify(['manifest-state-notice-v1', eventId, usuarioId])).digest('hex'),
  usuarioId, ...labels[state], manifiestoId: manifest.id, prioridad: 'NORMAL' as PrioridadNotificacion,
  datos: JSON.stringify({ tipo: 'estado_manifiesto', version: 1, estado: state, eventoId: eventId,
   ...(companyAccesses.has(usuarioId) ? { destino: 'representante', accesosEmpresa: companyAccesses.get(usuarioId) } : {}) }),
 }));
 // Failure must abort the transition: later code must not announce an event
 // whose inbox entries were not committed.
 if (notices.length) await tx.notificacion.createMany({ data: notices });
 return notices.map(notice => notice.id);
}
