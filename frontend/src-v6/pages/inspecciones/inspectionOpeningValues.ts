import type { InspectionActorType } from '../../types/inspection';
import type { InspectionIntake } from '../../types/inspectionIntake';
import type { InspectionOpeningSource, InspectionOpeningValues } from '../../services/inspectionOpeningDraft';
import { INSPECTION_ACTOR_LABELS } from './inspectionPresentation';

export function openingValues(role: string, initialType: InspectionActorType | '', initialActor: string, source: InspectionIntake | null): InspectionOpeningValues {
  const type = source?.tipoActor || initialType || (role === 'ADMIN_OPERADOR' ? 'OPERADOR' : role === 'ADMIN_TRANSPORTISTA' ? 'TRANSPORTISTA' : 'GENERADOR');
  const party = source?.evidencia.participante;
  const identificacion = party?.identificacion || party?.cuit || party?.documento || '';
  const domicilio = party?.domicilio || '';
  const declaration = source && !source.actorId ? [
    `Participante declarado: ${INSPECTION_ACTOR_LABELS[source.tipoActor]} · ${source.actorNombre}. Sin alta vinculada; identidad por verificar.`,
    identificacion && `Identificación declarada: ${identificacion}`, domicilio && `Domicilio declarado: ${domicilio}`,
    party?.patente && `Patente declarada: ${party.patente}`, party?.chofer && `Chofer declarado: ${party.chofer}`,
  ].filter(Boolean).join('\n') : '';
  const origin: InspectionOpeningSource | null = source ? { id: source.id, referencia: source.referencia, actorNombre: source.actorNombre, tipoActor: source.tipoActor, actorId: source.actorId, identificacion, domicilio } : null;
  return { type, actorId: source ? source.actorId || '' : initialActor, withoutActor: source ? !source.actorId : false,
    inspectionType: source && !source.actorId ? 'ESPONTANEA' : type,
    description: source ? `Antecedente ${source.referencia} · ${source.actorNombre}. Evaluación pendiente; no acredita infracción.${declaration ? '\n' + declaration : ''}` : '',
    assignedInspector: '', numeroActa: '', ubicacion: domicilio.slice(0, 300), fechaProgramada: '', source: origin };
}
