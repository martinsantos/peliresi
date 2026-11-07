import type { TipoActorInspeccion } from '@prisma/client';

export const inspectionEventualOrigins = {
  where: { origen: 'PARTICIPANTE_EVENTUAL' },
  select: { origenId: true, referencia: true, tipoActor: true, actorNombre: true },
  orderBy: { claveOrigen: 'asc' as const },
};

type Origin = {
  origenId: string;
  referencia: string;
  tipoActor: TipoActorInspeccion;
  actorNombre: string;
};

/**
 * A declared external party becomes part of the signable act, so a late link
 * would silently void signatures already captured. Decided 2026-11-07: a new
 * origin is accepted only while the field stage is open AND the act has no
 * signature yet; otherwise the chief opens a new inspection from the antecedent.
 */
export const EVENTUAL_LINK_STATES: ReadonlySet<string> = new Set(['BORRADOR', 'PLANIFICADA', 'EN_CAMPO']);
export type EventualLinkRefusal = 'CAMPO_CERRADO' | 'ACTA_FIRMADA' | null;
export function eventualLinkRefusal(intake: { origen: string }, inspection: { estado: string }, signed: boolean): EventualLinkRefusal {
  if (intake.origen !== 'PARTICIPANTE_EVENTUAL') return null;
  if (!EVENTUAL_LINK_STATES.has(inspection.estado)) return 'CAMPO_CERRADO';
  return signed ? 'ACTA_FIRMADA' : null;
}
export const EVENTUAL_LINK_MESSAGES: Record<Exclude<EventualLinkRefusal, null>, string> = {
  CAMPO_CERRADO: 'Ese expediente ya cerró la etapa de campo: su acta no admite otra parte externa. Abrí una inspección nueva desde este antecedente.',
  ACTA_FIRMADA: 'El acta de ese expediente ya tiene firma: sumar otra parte externa la anularía. Abrí una inspección nueva desde este antecedente.',
};

export function eventualOrigins(inspection: { antecedentes?: Origin[]; origenesEventuales?: Origin[] }): Origin[] {
  // A signed copy carries the origins seen at signing, independent of later links.
  return inspection.origenesEventuales ?? inspection.antecedentes ?? [];
}
