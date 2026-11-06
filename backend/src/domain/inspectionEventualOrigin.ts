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

export function eventualOrigins(inspection: { antecedentes?: Origin[]; origenesEventuales?: Origin[] }): Origin[] {
  // A signed copy carries the origins seen at signing, independent of later links.
  return inspection.origenesEventuales ?? inspection.antecedentes ?? [];
}
