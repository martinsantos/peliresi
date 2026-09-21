import type { BadgeColor } from '../../components/ui/BadgeV2';
import type { Inspection, InspectionActorType, InspectionState } from '../../types/inspection';

export const INSPECTION_STATE_LABELS: Record<InspectionState, string> = {
  BORRADOR: 'Borrador',
  PLANIFICADA: 'Planificada',
  EN_CAMPO: 'En campo',
  EN_REVISION: 'En revisión',
  NOTIFICADA: 'Notificada',
  EN_DESCARGO: 'En descargo',
  REQUIERE_SUBSANACION: 'Requiere subsanación',
  CERRADA_CONFORME: 'Cerrada conforme',
  DERIVADA_LEGALES: 'Derivada a legales',
  EN_TRAMITE_LEGAL: 'En trámite legal',
  DERIVADA_ATM: 'Derivada a ATM',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

export const INSPECTION_STATE_COLORS: Partial<Record<InspectionState, BadgeColor>> = {
  BORRADOR: 'neutral', PLANIFICADA: 'info', EN_CAMPO: 'primary', EN_REVISION: 'warning',
  NOTIFICADA: 'info', EN_DESCARGO: 'warning', REQUIERE_SUBSANACION: 'error',
  CERRADA_CONFORME: 'success', DERIVADA_LEGALES: 'error', EN_TRAMITE_LEGAL: 'warning',
  DERIVADA_ATM: 'warning', FINALIZADA: 'success', CANCELADA: 'neutral',
};

export const INSPECTION_ACTOR_LABELS: Record<InspectionActorType, string> = {
  GENERADOR: 'Generador', TRANSPORTISTA: 'Transportista', OPERADOR: 'Operador',
};

export const inspectionActorRoute = (type: InspectionActorType, actorId: string, mobile = false) => {
  const segment = type === 'GENERADOR' ? 'generadores' : type === 'TRANSPORTISTA' ? 'transportistas' : 'operadores';
  return `${mobile ? '/mobile' : ''}/admin/actores/${segment}/${actorId}`;
};

export const inspectionDate = (value?: string | null, withTime = false) => {
  if (!value) return 'Sin informar';
  return new Date(value).toLocaleString('es-AR', withTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'medium' });
};

export const inspectionRelevantDate = (inspection: Inspection) => inspection.fechaProgramada
  || inspection.iniciadaAt
  || inspection.createdAt;

export const inspectionErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object') return fallback;
  const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
};
