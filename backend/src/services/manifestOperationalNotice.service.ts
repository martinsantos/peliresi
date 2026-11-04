import { createHash } from 'node:crypto';
import type { Prisma, PrioridadNotificacion, TipoNotificacion } from '@prisma/client';
import { manifestCompanyRecipients, type ManifestCompanyAccess } from './manifestCompanyRecipients.service';

type OperationalEvent =
 | { tipo: 'INCIDENTE'; eventoId: string; manifiestoId: string; authorId: string; descripcion: string }
 | { tipo: 'RECHAZO'; eventoId: string; manifiestoId: string; authorId: string }
 | { tipo: 'DIFERENCIA_PESO'; eventoId: string; manifiestoId: string; authorId: string; delta: string };

/** Commit the inbox with the underlying event. The current target roles are
 * preserved; authorized representatives share the same activity/site scope. */
export async function notifyManifestOperationalEvent(tx: Prisma.TransactionClient, event: OperationalEvent) {
 const manifest = await tx.manifiesto.findUnique({ where: { id: event.manifiestoId }, select: {
  numero: true, generador: { select: { usuario: { select: { id: true } } } },
  operador: { select: { usuario: { select: { id: true } } } },
 } });
 if (!manifest) throw new Error('No se encontró el manifiesto del aviso operativo');
 const role = event.tipo === 'INCIDENTE' ? 'OPERADOR' : 'GENERADOR';
 const primary = role === 'OPERADOR' ? manifest.operador?.usuario?.id : manifest.generador?.usuario?.id;
 const recipientIds = new Set<string>();
 const companyAccesses = new Map<string, ManifestCompanyAccess[]>();
 if (primary && primary !== event.authorId) recipientIds.add(primary);
 for (const recipient of await manifestCompanyRecipients(tx, event.manifiestoId)) {
  const accesses = recipient.accesosEmpresa.filter(access => access.rol === role);
  if (accesses.length && recipient.usuarioId !== event.authorId && !recipientIds.has(recipient.usuarioId)) {
   recipientIds.add(recipient.usuarioId); companyAccesses.set(recipient.usuarioId, accesses);
  }
 }
 const admins = await tx.usuario.findMany({ where: { rol: 'ADMIN', activo: true }, select: { id: true } });
 admins.forEach(admin => { if (admin.id !== event.authorId) recipientIds.add(admin.id); });
 const type: TipoNotificacion = event.tipo === 'INCIDENTE' ? 'INCIDENTE_REPORTADO'
  : event.tipo === 'RECHAZO' ? 'MANIFIESTO_RECHAZADO' : 'ALERTA_SISTEMA';
 const title = event.tipo === 'INCIDENTE' ? '⚠️ Incidente en Tránsito'
  : event.tipo === 'RECHAZO' ? '❌ Carga Rechazada' : '⚖️ Diferencia de Peso Detectada';
 const message = event.tipo === 'INCIDENTE' ? `Incidente reportado en manifiesto ${manifest.numero}${event.descripcion ? ': ' + event.descripcion : ''}`
  : event.tipo === 'RECHAZO' ? `La carga del manifiesto ${manifest.numero} fue rechazada`
  : `El manifiesto ${manifest.numero} presenta diferencia de peso del ${event.delta}`;
 const notices = [...recipientIds].map(usuarioId => ({
  id: createHash('sha256').update(JSON.stringify(['manifest-operational-notice', event.tipo, event.eventoId, usuarioId])).digest('hex'),
  usuarioId, tipo: type, titulo: title, mensaje: message, manifiestoId: event.manifiestoId,
  prioridad: 'ALTA' as PrioridadNotificacion,
  datos: JSON.stringify({ tipo: 'alerta_evento_manifiesto', version: 1, evento: event.tipo, eventoId: event.eventoId,
   ...(companyAccesses.has(usuarioId) ? { destino: 'representante', accesosEmpresa: companyAccesses.get(usuarioId) } : {}) }),
 }));
 if (!notices.length) return [];
 const inserted = await tx.notificacion.createMany({ data: notices, skipDuplicates: true });
 // Existing notices are never dispatched again. The mail relay can read newly
 // committed rows independently; other channels remain best-effort postcommit.
 return inserted.count === notices.length ? notices : [];
}
