import type { Prisma } from '@prisma/client';
import { isInspectionExchangeOpen } from './inspectionExchange.service';

/** A list projection, without presentation bodies, attachments or personal data. */
export const inspectionFollowUpSelect = {
  id: true, secuencia: true, tipo: true, parte: true, destinatario: true,
  respondeAId: true, plazoRespuestaAt: true,
} satisfies Prisma.IntercambioInspeccionSelect;

type Entry = Prisma.IntercambioInspeccionGetPayload<{ select: typeof inspectionFollowUpSelect }>;

export function inspectionFollowUp(estado: Parameters<typeof isInspectionExchangeOpen>[0], entries: Entry[]) {
  if (!isInspectionExchangeOpen(estado)) return { paso: 'CERRADO' as const, pendientes: [] };
  const requirements = entries.filter(entry => entry.parte === 'AUTORIDAD' && entry.tipo === 'REQUERIMIENTO' && entry.destinatario === 'INSPECCIONADO');
  const answered = new Set(entries.filter(entry => entry.parte === 'INSPECCIONADO' && ['RESPUESTA', 'DESCARGO', 'SUBSANACION'].includes(entry.tipo)).map(entry => entry.respondeAId));
  const pending = requirements.filter(entry => !answered.has(entry.id))
    .sort((a, b) => b.secuencia - a.secuencia)
    .map(({ id, secuencia, plazoRespuestaAt }) => ({ id, secuencia, plazoRespuestaAt }));
  return { paso: !requirements.length ? 'PUBLICAR' as const : pending.length ? 'RESPONDER' as const : 'REVISAR' as const, pendientes: pending };
}
