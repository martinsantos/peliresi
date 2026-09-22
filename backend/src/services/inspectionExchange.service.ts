import crypto from 'crypto';
import {
  EstadoInspeccion,
  ParteIntercambioInspeccion,
  TipoActorInspeccion,
  TipoIntercambioInspeccion,
} from '@prisma/client';

export type InspectionExchangeAccessTarget = {
  inspectorId: string;
  tipoActor: TipoActorInspeccion;
  generadorId?: string | null;
  transportistaId?: string | null;
  operadorId?: string | null;
};

export type ExchangeAttachmentDigest = {
  nombreOriginal: string;
  mimeDetectado: string;
  bytes: number;
  sha256: string;
};

export type ExchangeDigestInput = {
  inspeccionId: string;
  secuencia: number;
  respondeAId?: string | null;
  tipo: TipoIntercambioInspeccion;
  parte: ParteIntercambioInspeccion;
  asunto: string;
  cuerpo: string;
  plazoRespuestaAt?: Date | string | null;
  canal: 'PORTAL_SITREP';
  versionExpediente: number;
  autorId: string;
  createdAt: Date | string;
  adjuntos: ExchangeAttachmentDigest[];
};

const ACTOR_RESPONSE_TYPES = new Set<TipoIntercambioInspeccion>(['RESPUESTA', 'DESCARGO', 'SUBSANACION']);
const AUTHORITY_MESSAGE_TYPES = new Set<TipoIntercambioInspeccion>(['REQUERIMIENTO', 'RESPUESTA', 'PRONUNCIAMIENTO']);
const EXCHANGE_OPEN_STATES = new Set<EstadoInspeccion>(['NOTIFICADA', 'EN_DESCARGO', 'REQUIERE_SUBSANACION']);

function actorIdForInspection(inspection: InspectionExchangeAccessTarget): string | null {
  if (inspection.tipoActor === 'GENERADOR') return inspection.generadorId || null;
  if (inspection.tipoActor === 'TRANSPORTISTA') return inspection.transportistaId || null;
  return inspection.operadorId || null;
}

function actorIdForUser(user: any, tipoActor: TipoActorInspeccion): string | null {
  if (tipoActor === 'GENERADOR') return user?.generador?.id || null;
  if (tipoActor === 'TRANSPORTISTA') return user?.transportista?.id || null;
  return user?.operador?.id || null;
}

export function exchangePartyForUser(
  user: any,
  inspection: InspectionExchangeAccessTarget,
): ParteIntercambioInspeccion | null {
  const role = String(user?.rol || '');
  if (role === 'ADMIN') return 'AUTORIDAD';
  if (role === `ADMIN_${inspection.tipoActor}`) return 'AUTORIDAD';
  if (user?.esInspector && String(user?.id) === inspection.inspectorId) return 'AUTORIDAD';
  const expectedRole = inspection.tipoActor;
  if (role === expectedRole && actorIdForUser(user, inspection.tipoActor) === actorIdForInspection(inspection)) {
    return 'INSPECCIONADO';
  }
  return null;
}

export function canDecideInspectionExchange(user: any, inspection: InspectionExchangeAccessTarget): boolean {
  const role = String(user?.rol || '');
  return role === 'ADMIN' || role === `ADMIN_${inspection.tipoActor}`;
}

export function isInspectionExchangeOpen(estado: EstadoInspeccion): boolean {
  return EXCHANGE_OPEN_STATES.has(estado);
}

export function isExchangeTypeAllowed(
  parte: ParteIntercambioInspeccion,
  tipo: TipoIntercambioInspeccion,
): boolean {
  if (parte === 'INSPECCIONADO') return ACTOR_RESPONSE_TYPES.has(tipo);
  if (parte === 'AUTORIDAD') return AUTHORITY_MESSAGE_TYPES.has(tipo);
  return false;
}

export function canonicalizeExchangeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalizeExchangeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalizeExchangeValue(child)]),
    );
  }
  return value;
}

export function buildInspectionExchangeDigests(
  input: ExchangeDigestInput,
  previousHash?: string | null,
): { contenidoSha256: string; hashCadena: string } {
  const normalized: ExchangeDigestInput = {
    ...input,
    asunto: input.asunto.trim(),
    cuerpo: input.cuerpo.trim(),
    adjuntos: [...input.adjuntos]
      .map((file) => ({ ...file, nombreOriginal: file.nombreOriginal.trim(), sha256: file.sha256.toLowerCase() }))
      .sort((left, right) => left.sha256.localeCompare(right.sha256) || left.nombreOriginal.localeCompare(right.nombreOriginal)),
  };
  const contenidoSha256 = crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalizeExchangeValue(normalized)))
    .digest('hex');
  const hashCadena = crypto
    .createHash('sha256')
    .update(`${previousHash || 'GENESIS'}:${contenidoSha256}`)
    .digest('hex');
  return { contenidoSha256, hashCadena };
}

export function nextInspectionStateForExchange(
  current: EstadoInspeccion,
  parte: ParteIntercambioInspeccion,
  tipo: TipoIntercambioInspeccion,
): EstadoInspeccion {
  if (parte === 'INSPECCIONADO' && ['RESPUESTA', 'DESCARGO', 'SUBSANACION'].includes(tipo)) return 'EN_DESCARGO';
  if (parte === 'AUTORIDAD' && tipo === 'REQUERIMIENTO' && current === 'EN_DESCARGO') return 'REQUIERE_SUBSANACION';
  return current;
}
