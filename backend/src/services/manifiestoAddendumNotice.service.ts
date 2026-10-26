import { manifestCompanyRecipients } from './manifestCompanyRecipients.service';
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
  authorRole?: string,
) {
  const [generador, transportista, operador] = await Promise.all([
    tx.generador.findUnique({ where: { id: manifest.generadorId }, select: { activo: true, usuario: { select: { id: true, activo: true } } } }),
    manifest.transportistaId ? tx.transportista.findUnique({ where: { id: manifest.transportistaId }, select: { activo: true, usuario: { select: { id: true, activo: true } } } }) : null,
    tx.operador.findUnique({ where: { id: manifest.operadorId }, select: { activo: true, usuario: { select: { id: true, activo: true } } } }),
  ]);
  const parties = [generador, transportista, operador];
  const labelsByRole: Record<string,string> = {GENERADOR:'Generador',TRANSPORTISTA:'Transporte',OPERADOR:'Operador'};
  const actor = labelsByRole[authorRole || ''] || ['Generador', 'Transporte', 'Operador'][parties.findIndex(party => party?.usuario?.id === authorId)] || 'Revisor designado';
  const companyRecipients = await manifestCompanyRecipients(tx, manifest.id);
  const companyAccess = new Map(companyRecipients.map(p => [p.usuarioId,p.accesosEmpresa]));
  const recipients = [...new Set([...parties.filter(party => party?.activo && party.usuario?.activo).map(party => party!.usuario!.id),...companyRecipients.map(p => p.usuarioId)])]
    .filter((id): id is string => !!id && id !== authorId);
  const labels: Record<AddendumEvent, [string, string]> = {
    CREADA: ['Nueva adenda en tu manifiesto', 'Abrí la adenda para ver la diferencia declarada y, si te corresponde, revisarla.'],
    APROBADA: ['Adenda aprobada', 'Registró su aprobación. No representa la decisión de las otras partes ni el cierre documental.'],
    OBSERVADA: ['Adenda observada', 'Hay una observación para revisar en el manifiesto.'],
    RECHAZADA: ['Adenda rechazada', 'La adenda quedó rechazada; el original y la resolución se conservan.'],
  };
  const [title, message] = labels[event];
  const data = recipients.map(usuarioId => ({
    id: createHash('sha256').update(`adenda:${adendaId}:${version}:${event}:${usuarioId}`).digest('hex'),
    usuarioId, tipo: 'INFO_GENERAL' as const, titulo: title,
    mensaje: `${manifest.numero}. ${actor}: ${message}`, manifiestoId: manifest.id,
    prioridad: event === 'CREADA' || event === 'OBSERVADA' ? 'ALTA' as const : 'NORMAL' as const,
    datos: JSON.stringify({ tipo: 'adenda_manifiesto', version: 1, ...(companyAccess.has(usuarioId)?{accesosEmpresa:companyAccess.get(usuarioId)}:{}), evento: event, adendaId, autorId: authorId, autorRol: actor, url: `/manifiestos/${manifest.id}/adendas?adenda=${adendaId}` }),
  }));
  const inserted = await tx.notificacion.createMany({ skipDuplicates: true, data });
  // A retried command never dispatches the already committed notices again.
  return inserted.count === data.length ? data.map(notice => notice.id) : [];
}
