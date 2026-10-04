import { EstadoAlerta } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';
import { parseAlertCondition } from './alertRuleCondition.service';

export const FOLLOWUP_RULE_ID = 'seguimiento_cierre_v1';
export const FOLLOWUP_CONDITION = JSON.stringify({ tipo: 'seguimiento_cierre', diasRecepcion: { gte: 0 } });

/** This reserved condition is evaluated by the daily database sweep, not transport events. */
export function followupDays(raw: string): number | null {
  const condition = parseAlertCondition(raw);
  if (condition.tipo !== 'seguimiento_cierre') return null;
  const threshold = condition.diasRecepcion;
  if (Object.keys(condition).some(key => !['tipo', 'diasRecepcion'].includes(key)) ||
      !threshold || typeof threshold !== 'object' || Array.isArray(threshold) ||
      Object.keys(threshold).length !== 1 || !('gte' in threshold) ||
      typeof threshold.gte !== 'number' || !Number.isInteger(threshold.gte) || threshold.gte < 0 || threshold.gte > 365) {
    throw new AppError('Seguimiento: indique días enteros desde la recepción, entre 0 y 365', 400);
  }
  return threshold.gte;
}

export function validateFollowupRule(evento: string, condition: string, recipients: string): void {
  if (followupDays(condition) === null) return;
  const roles: string[] = JSON.parse(recipients);
  if (evento !== 'TIEMPO_EXCESIVO' || roles.some(role => !['OPERADOR', 'ADMIN', 'ADMIN_OPERADOR'].includes(role))) {
    throw new AppError('El seguimiento sólo admite el operador involucrado y administración, por avisos internos', 400);
  }
}

export function alertResolution(estado: unknown, notas: unknown, userId: string, now = new Date()) {
  if (typeof estado !== 'string' || !Object.values(EstadoAlerta).includes(estado as EstadoAlerta)) {
    throw new AppError('Seleccione explícitamente el estado del caso; leer un aviso no lo resuelve', 400);
  }
  if (typeof notas !== 'string' || !notas.trim() || notas.trim().length > 2000) {
    throw new AppError('Registre un motivo de entre 1 y 2000 caracteres', 400);
  }
  const terminal = estado === 'RESUELTA' || estado === 'DESCARTADA';
  return { estado: estado as EstadoAlerta, notas: notas.trim(), resueltaPor: terminal ? userId : null, fechaResolucion: terminal ? now : null };
}
