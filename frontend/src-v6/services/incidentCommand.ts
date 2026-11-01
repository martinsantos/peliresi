import { api } from './api';
import type { AxiosResponse } from 'axios';
import { newGpsPointId } from './gpsQueue';
import { supportRequestContext, supportSessionMatches } from '../utils/supportSession';
import type { RegistrarIncidenteRequest } from '../types/api';

export type IncidentContext = { userId: string; owner: string; requestContext: string };
export type IncidentCommand = { version: 1; referencia: string; body: RegistrarIncidenteRequest };
export type IncidentResult = { body: RegistrarIncidenteRequest; cleaned: boolean; repeated: boolean };
type IncidentResponse = { success?: unknown; data?: { evento?: { id?: unknown; manifiestoId?: unknown; tipo?: unknown;
  usuarioId?: unknown; descripcion?: unknown; latitud?: unknown; longitud?: unknown };
  idempotencia?: { version?: unknown; referencia?: unknown; repetido?: unknown } } };
export const INCIDENT_COMMAND_CHANGED = 'sitrep:incident-command-changed';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key));
const position = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

function validBody(value: unknown): value is RegistrarIncidenteRequest {
  return object(value) && exactKeys(value, ['tipo', 'descripcion', 'latitud', 'longitud'])
    && typeof value.tipo === 'string' && value.tipo.trim() === value.tipo && value.tipo.length > 0 && value.tipo.length <= 120
    && typeof value.descripcion === 'string' && value.descripcion.trim() === value.descripcion && value.descripcion.length > 0 && value.descripcion.length <= 1000
    && ((value.latitud === undefined && value.longitud === undefined)
      || (position(value.latitud, -90, 90) && position(value.longitud, -180, 180)));
}
function validCommand(value: unknown): value is IncidentCommand {
  return object(value) && exactKeys(value, ['version', 'referencia', 'body']) && value.version === 1
    && typeof value.referencia === 'string' && uuid.test(value.referencia) && validBody(value.body);
}
export function incidentCommandKey(id: string, context: IncidentContext): string {
  if (!id || !context.userId || !context.owner || !context.requestContext) throw new Error('No se pudo identificar la cuenta y el viaje. Volvé a ingresar.');
  return 'sitrep:incident-command:v1:' + encodeURIComponent(JSON.stringify([context.userId, context.owner, context.requestContext, id]));
}
export function readIncidentCommand(id: string, context: IncidentContext): IncidentCommand | null {
  const raw = localStorage.getItem(incidentCommandKey(id, context));
  if (raw === null) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('La copia del incidente no se puede leer. Conservá este dispositivo y consultá a soporte.'); }
  if (!validCommand(value)) throw new Error('La copia del incidente no se puede verificar. Conservá este dispositivo y consultá a soporte.');
  return value;
}
const current = (context: IncidentContext) => supportSessionMatches(context.userId) && supportRequestContext() === context.requestContext;
const changed = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(INCIDENT_COMMAND_CHANGED)); };

async function withIncidentLock<T>(id: string, context: IncidentContext, run: () => Promise<T>): Promise<T> {
  if (!current(context)) throw new Error('La cuenta o actividad cambió. Volvé a abrir el viaje antes de continuar.');
  if (typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function') {
    throw new Error('Este navegador no puede proteger el envío entre ventanas. Usá un navegador compatible o consultá a soporte.');
  }
  return navigator.locks.request(`sitrep:incident:${incidentCommandKey(id, context)}`, { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock) throw new Error('Otra ventana está registrando este incidente. Esperá y comprobá el envío.');
    if (!current(context)) throw new Error('La cuenta o actividad cambió. Volvé a abrir el viaje antes de continuar.');
    return run();
  });
}

async function dispatch(id: string, context: IncidentContext, command: IncidentCommand): Promise<IncidentResult> {
  let response: AxiosResponse<IncidentResponse>;
  try {
    response = await api.post(`/manifiestos/${encodeURIComponent(id)}/incidente-idempotente`, { ...command.body, referencia: command.referencia });
  } catch {
    throw new Error('No pudimos confirmar el incidente. Conservá este dispositivo y usá Comprobar envío.');
  }
  const result = response?.data?.data, event = result?.evento, receipt = result?.idempotencia;
  if (response?.data?.success !== true || receipt?.version !== 1 || typeof receipt.repetido !== 'boolean'
    || typeof receipt.referencia !== 'string' || receipt.referencia.toLowerCase() !== command.referencia.toLowerCase()
    || typeof event?.id !== 'string' || event.manifiestoId !== id || event.tipo !== 'INCIDENTE'
    || event.usuarioId !== context.userId || event.descripcion !== `INCIDENTE: ${command.body.tipo}. ${command.body.descripcion}`
    || (event.latitud ?? null) !== (command.body.latitud ?? null) || (event.longitud ?? null) !== (command.body.longitud ?? null)) {
    throw new Error('No recibimos una confirmación verificable. Conservá este dispositivo y usá Comprobar envío.');
  }
  if (!current(context)) throw new Error('La cuenta o actividad cambió. Volvé al contexto original para comprobar el envío.');
  let cleaned = false;
  try {
    if (JSON.stringify(readIncidentCommand(id, context)) === JSON.stringify(command)) {
      localStorage.removeItem(incidentCommandKey(id, context));
      cleaned = readIncidentCommand(id, context) === null;
    }
  } catch { /* The server confirmed the event; retain the local warning. */ }
  changed();
  return { body: command.body, cleaned, repeated: receipt.repetido };
}

/** Persist the exact request before dispatch. A retry must reuse this reference. */
export async function submitIncidentCommand(id: string, context: IncidentContext, body: RegistrarIncidenteRequest): Promise<IncidentResult> {
  return withIncidentLock(id, context, async () => {
    if (readIncidentCommand(id, context)) throw new Error('Hay un envío sin confirmar. Usá Comprobar envío antes de registrar otro.');
    const clean = { ...body, tipo: body.tipo.trim(), descripcion: body.descripcion.trim() };
    if (!validBody(clean)) throw new Error('Revisá el tipo, la descripción y la ubicación antes de enviar.');
    let referencia: string;
    try { referencia = newGpsPointId(); } catch { throw new Error('No se pudo preparar una referencia segura para el incidente. Consultá a soporte.'); }
    const command: IncidentCommand = { version: 1, referencia, body: clean };
    if (!validCommand(command)) throw new Error('No se pudo preparar una referencia segura. Consultá a soporte.');
    const key = incidentCommandKey(id, context), encoded = JSON.stringify(command);
    try {
      localStorage.setItem(key, encoded);
      if (localStorage.getItem(key) !== encoded) throw new Error('No se confirmó la copia.');
    } catch { throw new Error('No se pudo guardar el envío en este dispositivo. No se registró el incidente.'); }
    changed();
    return dispatch(id, context, command);
  });
}

export async function retryIncidentCommand(id: string, context: IncidentContext): Promise<IncidentResult> {
  return withIncidentLock(id, context, async () => {
    const command = readIncidentCommand(id, context);
    if (!command) throw new Error('No encontramos el envío guardado. Revisá el historial antes de registrar otro incidente.');
    return dispatch(id, context, command);
  });
}
