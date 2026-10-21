import { createHash } from 'node:crypto';
import type { Prisma, TipoActorInspeccion } from '@prisma/client';

export const INSPECTION_AGENDA_LABELS = {
  CREADA: ['Nueva inspección', 'Revisá el responsable y prepará la visita.'],
  PROGRAMADA: ['Inspección programada', 'Revisá la fecha prevista y el responsable en la agenda.'],
  REPROGRAMADA: ['Inspección reprogramada', 'La fecha prevista cambió. Consultá la agenda actualizada antes de la visita.'],
  AGENDA_RETIRADA: ['Inspección sin fecha programada', 'Se retiró la fecha prevista. Administración debe definir la próxima visita.'],
  REASIGNADA: ['Responsable de inspección actualizado', 'Consultá el responsable y la fecha vigentes en el expediente.'],
  SUJETO_VINCULADO: ['Sujeto de inspección identificado', 'Se vinculó el sujeto del expediente. Revisá su seguimiento y el ámbito competente.'],
  EN_CAMPO: ['Inspección en campo', 'El recorrido comenzó. El inspector asignado registra los controles y evidencias.'],
  EN_REVISION: ['Inspección para revisar', 'El trabajo de campo está cerrado. Administración debe revisar el expediente.'],
  NOTIFICADA: ['Inspección puesta a disposición', 'Consultá el expediente, las observaciones y el plazo de respuesta.'],
  CANCELADA: ['Inspección cancelada', 'La visita quedó cancelada. Consultá el motivo en el expediente.'],
  EN_TRAMITE_LEGAL: ['Expediente en trámite legal', 'Consultá el seguimiento de la derivación y la próxima actuación.'],
  FINALIZADA: ['Inspección finalizada', 'Consultá el resultado y la trazabilidad del expediente.'],
} as const;
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
  const staff = await tx.usuario.findMany({ where: { activo: true,
    ...(input.assignedSelf ? {} : { id: { not: input.autorId } }),
    OR: [{ rol: { in: roles } }, { id: inspection.inspectorId, esInspector: true, NOT: { rol: { in: ['ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'] } } }],
  }, select: { id: true } });
  const recipients = new Map(staff.map(user => [user.id, 'inspeccion']));
  if (['NOTIFICADA', 'EN_TRAMITE_LEGAL', 'FINALIZADA'].includes(input.evento) && inspection.tipoActor) {
    const relation = inspection.tipoActor === 'GENERADOR' ? 'generador' : inspection.tipoActor === 'TRANSPORTISTA' ? 'transportista' : 'operador';
    const actorId = inspection[`${relation}Id`];
    if (actorId) {
      const owners = await tx.usuario.findMany({ where: { activo: true, id: { not: input.autorId }, rol: inspection.tipoActor,
        [relation]: { is: { id: actorId } } }, select: { id: true } });
      for (const user of owners) recipients.set(user.id, 'participacion');
    }
  }
  if (!recipients.size) return;
  const [title, action] = INSPECTION_AGENDA_LABELS[input.evento];
  await tx.notificacion.createMany({ skipDuplicates: true, data: [...recipients].map(([usuarioId, destino]) => ({
    id: createHash('sha256').update(`agenda:${input.eventoId}:${usuarioId}`).digest('hex'),
    usuarioId, tipo: 'INFO_GENERAL', titulo: `PSIP · ${title}`, mensaje: `${inspection.numero} · ${action}`,
    datos: JSON.stringify({ tipo: 'agenda_inspeccion', version: 1, correoVersion: 1, inspeccionId: inspection.id,
      eventoId: input.eventoId, evento: input.evento, destino }),
  })) });
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
