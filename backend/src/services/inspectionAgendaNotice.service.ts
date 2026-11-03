import { inspectionManagementRecipientIds } from './inspectionManagementRole.service';
import { createHash } from 'node:crypto';
import type { Prisma, TipoActorInspeccion } from '@prisma/client';
import { inspectionParticipantNoticeWhere } from './inspectionExchangeNotice.service';
import { inspectionCompanyNoticeRows } from './inspectionCompanyNotice.service';
import { INSPECTION_AGENDA_LABELS } from '../domain/inspectionNoticeLabels';
export { INSPECTION_AGENDA_LABELS } from '../domain/inspectionNoticeLabels';

export type InspectionAgendaEvent = keyof typeof INSPECTION_AGENDA_LABELS;
type Target = { id: string; numero: string; inspectorId: string; tipoActor: TipoActorInspeccion | null;
  generadorId?: string | null; transportistaId?: string | null; operadorId?: string | null };

export function inspectionScheduleChange(before: Date | null | undefined, after: string | Date | null | undefined): InspectionAgendaEvent | null {
  if (after === undefined) return null;
  const oldTime = before?.getTime() ?? null, newTime = after ? new Date(after).getTime() : null;
  if (oldTime === newTime) return null;
  return newTime === null ? 'AGENDA_RETIRADA' : oldTime === null ? 'PROGRAMADA' : 'REPROGRAMADA';
}

/** Notice and event belong to the same transaction. No external delivery here. */
export async function createInspectionAgendaNotices(tx: Prisma.TransactionClient, inspection: Target,
  input: { evento: InspectionAgendaEvent; eventoId: string; autorId: string; assignedSelf?: boolean }) {
  const roles = ['ADMIN', ...(inspection.tipoActor ? [`ADMIN_${inspection.tipoActor}`] : [])] as Array<'ADMIN' | 'ADMIN_GENERADOR' | 'ADMIN_TRANSPORTISTA' | 'ADMIN_OPERADOR'>;
  const managementIds = await inspectionManagementRecipientIds();
  const staff = await tx.usuario.findMany({ where: { activo: true,
    ...(input.assignedSelf ? {} : { id: { not: input.autorId } }),
    OR: [{ id: { in: managementIds } }, { rol: { in: roles } }, { id: inspection.inspectorId, esInspector: true, NOT: { rol: { in: ['ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'] } } }],
  }, select: { id: true } });
  const recipients = new Map(staff.map(user => [user.id, 'inspeccion']));
  if (['NOTIFICADA', 'EN_TRAMITE_LEGAL', 'FINALIZADA'].includes(input.evento) && inspection.tipoActor) {
    const owner = inspectionParticipantNoticeWhere(inspection);
    if (owner) {
      const owners = await tx.usuario.findMany({ where: { AND: [{ activo: true, id: { not: input.autorId } }, owner] }, select: { id: true } });
      for (const user of owners) recipients.set(user.id, 'participacion');
    }
  }
  const companyRows = ['NOTIFICADA', 'EN_TRAMITE_LEGAL', 'FINALIZADA'].includes(input.evento)
    ? await inspectionCompanyNoticeRows(tx, inspection, { clase: 'agenda', id: input.eventoId, autorId: input.autorId }, [...recipients.keys()]) : [];
  if (!recipients.size && !companyRows.length) return;
  const [title, action] = INSPECTION_AGENDA_LABELS[input.evento];
  const directRows = [...recipients].map(([usuarioId, destino]) => ({
    id: createHash('sha256').update(`agenda:${input.eventoId}:${usuarioId}`).digest('hex'),
    usuarioId, tipo: 'INFO_GENERAL', titulo: `PSIP · ${title}`, mensaje: `${inspection.numero} · ${action}`,
    datos: JSON.stringify({ tipo: 'agenda_inspeccion', version: 1, correoVersion: 1, inspeccionId: inspection.id,
      eventoId: input.eventoId, evento: input.evento, destino, ...(destino === 'participacion' ? { tipoActor: inspection.tipoActor } : {}) }),
  } as Prisma.NotificacionCreateManyInput));
  await tx.notificacion.createMany({ skipDuplicates: true, data: [...directRows, ...companyRows] });
}

export async function recordInspectionScheduleChange(tx: Prisma.TransactionClient, inspection: Target & { fechaProgramada?: Date | null },
  date: string | null | undefined, autorId: string, version: number) {
  const evento = inspectionScheduleChange(inspection.fechaProgramada, date);
  if (!evento) return;
  const event = await tx.eventoInspeccion.create({ data: { inspeccionId: inspection.id, usuarioId: autorId,
    tipo: 'AGENDA_ACTUALIZADA', titulo: INSPECTION_AGENDA_LABELS[evento][0], visibleActor: false,
    metadata: { fechaAnterior: inspection.fechaProgramada?.toISOString() || null, fechaNueva: date ? new Date(date).toISOString() : null,
      versionBase: version, versionNueva: version + 1, avisoAgenda: evento },
  } });
  await createInspectionAgendaNotices(tx, inspection, { evento, eventoId: event.id, autorId });
}
