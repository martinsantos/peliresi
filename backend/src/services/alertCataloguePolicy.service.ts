import { AppError } from '../middlewares/errorHandler';
import { parseAlertCondition } from './alertRuleCondition.service';

export const EXPIRY_ENTITIES = ['TRANSPORTISTA', 'OPERADOR', 'VEHICULO', 'CHOFER'] as const;
export type ExpiryEntity = typeof EXPIRY_ENTITIES[number];
export type CatalogueCondition = { tipo: 'requerimiento_inspeccion' } | { tipo: 'vencimiento_documental'; anticipacionDias: number; entidades: ExpiryEntity[] };
export const CATALOGUE_MARKER = '"familia":"catalogo_verificable"';

export function catalogueCondition(raw: string): CatalogueCondition | null {
  const value = parseAlertCondition(raw);
  if (!['requerimiento_inspeccion', 'vencimiento_documental'].includes(String(value.tipo))) return null;
  if (value.tipo === 'requerimiento_inspeccion' && Object.keys(value).length === 1) return { tipo: value.tipo };
  if (value.tipo === 'vencimiento_documental' && Object.keys(value).every(key => ['tipo', 'anticipacionDias', 'entidades'].includes(key)) &&
    typeof value.anticipacionDias === 'number' && Number.isInteger(value.anticipacionDias) && value.anticipacionDias >= 0 && value.anticipacionDias <= 365 &&
    Array.isArray(value.entidades) && value.entidades.length > 0 && value.entidades.length <= 4 &&
    value.entidades.every(entity => EXPIRY_ENTITIES.includes(entity as ExpiryEntity)) && new Set(value.entidades).size === value.entidades.length) {
    return value as CatalogueCondition;
  }
  throw new AppError('Seleccione una fuente admitida y días enteros de anticipación entre 0 y 365', 400);
}

export function validateCatalogueRule(event: string, raw: string, recipients: string): void {
  const condition = catalogueCondition(raw);
  const roles: string[] = JSON.parse(recipients);
  if (!condition) {
    if (roles.some(role => ['INSPECCIONADO', 'INSPECTOR_ASIGNADO'].includes(role))) throw new AppError('Estos destinatarios requieren una regla de requerimientos de inspección', 400);
    return;
  }
  const allowed = condition.tipo === 'requerimiento_inspeccion'
    ? ['INSPECCIONADO', 'INSPECTOR_ASIGNADO', 'ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR']
    : ['TRANSPORTISTA', 'OPERADOR', 'ADMIN', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'];
  if (event !== (condition.tipo === 'requerimiento_inspeccion' ? 'TIEMPO_EXCESIVO' : 'VENCIMIENTO') || roles.some(role => !allowed.includes(role))) {
    throw new AppError('La familia sólo admite su evento y destinatarios internos autorizados', 400);
  }
}

type RequestFacts = { tipo: string; parte: string; destinatario: string; plazoRespuestaAt: Date | null;
  inspeccion: { estado: string }; respuestas: Array<{ tipo: string; parte: string }> };
export function requirementSituation(request: RequestFacts | null, now: Date): 'PENDIENTE' | 'RESPONDIDO' | 'FUERA_DE_ALCANCE' {
  if (!request || request.tipo !== 'REQUERIMIENTO' || request.parte !== 'AUTORIDAD' || request.destinatario !== 'INSPECCIONADO' ||
    !request.plazoRespuestaAt || !Number.isFinite(request.plazoRespuestaAt.getTime()) || request.plazoRespuestaAt >= now ||
    !['NOTIFICADA', 'EN_DESCARGO', 'REQUIERE_SUBSANACION'].includes(request.inspeccion.estado)) return 'FUERA_DE_ALCANCE';
  return request.respuestas.some(reply => reply.parte === 'INSPECCIONADO' && ['RESPUESTA', 'DESCARGO', 'SUBSANACION'].includes(reply.tipo)) ? 'RESPONDIDO' : 'PENDIENTE';
}

export function expirySituation(date: Date | null, active: boolean, days: number, now: Date): 'VENCIDO' | 'PROXIMO' | 'FUERA_DE_ALCANCE' {
  if (!active || !date || !Number.isFinite(date.getTime()) || date.getTime() > now.getTime() + days * 86400000) return 'FUERA_DE_ALCANCE';
  return date <= now ? 'VENCIDO' : 'PROXIMO';
}
