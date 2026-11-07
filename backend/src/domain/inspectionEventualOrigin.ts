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
 * A declared external party becomes part of the signable act. Once the field
 * stage closes the act can no longer be re-signed, so a late link would hide
 * the signatures already captured. Only field states accept a new origin.
 */
export const EVENTUAL_LINK_STATES: ReadonlySet<string> = new Set(['BORRADOR', 'PLANIFICADA', 'EN_CAMPO']);
export function eventualLinkAllowed(intake: { origen: string }, inspection: { estado: string }): boolean {
  return intake.origen !== 'PARTICIPANTE_EVENTUAL' || EVENTUAL_LINK_STATES.has(inspection.estado);
}

export function eventualOrigins(inspection: { antecedentes?: Origin[]; origenesEventuales?: Origin[] }): Origin[] {
  // A signed copy carries the origins seen at signing, independent of later links.
  return inspection.origenesEventuales ?? inspection.antecedentes ?? [];
}
