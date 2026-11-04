import { gpsObservationIsFresh } from '../utils/gpsFreshness';

/** Coordinates GPS uploads for a manifest within one browser page. */
const tasksByTrip = new Map<string, Set<Promise<void>>>();
const volatileQueues = new Map<string, PendingGpsPoint[]>();
export const GPS_DELIVERY_CONFIRMED_EVENT = 'sitrep:gps-delivery-confirmed';

// A failed local write leaves data only in this page's memory. Warn on a
// normal close even if the tracking component has already been unmounted.
function warnAboutVolatileGps(event: BeforeUnloadEvent) {
  if (![...volatileQueues.values()].some(points => points.length)) return;
  event.preventDefault(); event.returnValue = '';
}
function updateVolatileGpsWarning() {
  if (typeof window === 'undefined') return;
  if ([...volatileQueues.values()].some(points => points.length)) window.addEventListener('beforeunload', warnAboutVolatileGps);
  else window.removeEventListener('beforeunload', warnAboutVolatileGps);
}

export class GpsPendingError extends Error {
  constructor(message = 'No se pudieron enviar las ubicaciones pendientes. Revisá la conexión y volvé a intentar.', readonly issue?: GpsStorageIssue) {
    super(message);
    this.name = 'GpsPendingError';
  }
}

/** The saved point cannot be confirmed or safely replayed as a current fix. */
export class GpsUnconfirmedPreviousPointError extends GpsPendingError {
  constructor() {
    super('SITREP no confirmó una ubicación anterior. Se conserva en este dispositivo; contactá a soporte antes de continuar.');
    this.name = 'GpsUnconfirmedPreviousPointError';
  }
}

export interface PendingGpsPoint {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  puntoId?: string;
  /** Device capture time, retained locally; absent on queues from older versions. */
  observedAt?: number | null;
}

export function gpsPointPayload(point: PendingGpsPoint) {
  return { latitud: point.lat, longitud: point.lng,
    ...(point.puntoId && { puntoId: point.puntoId }),
    ...(point.speed != null && { velocidad: point.speed }),
    ...(point.heading != null && { direccion: point.heading }) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The identifier stays with one observation across failures and reloads. */
export function newGpsPointId(): string {
  const crypto = globalThis.crypto;
  if (crypto?.randomUUID) return crypto.randomUUID();
  if (!crypto?.getRandomValues) throw new GpsPendingError('No se pudo preparar una referencia segura para la ubicación. Contactá a soporte.', 'reference');
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Assign and persist IDs to owned queues produced by an older app version. */
export function prepareGpsPoints(owner: string | number, id: string, points: PendingGpsPoint[], contextOwner?: string): PendingGpsPoint[] {
  if (points.some(point => point.puntoId !== undefined && !UUID.test(point.puntoId))) {
    throw new GpsPendingError('Una ubicación guardada tiene una referencia inválida. Contactá a soporte.', 'invalid');
  }
  if (points.every(point => point.puntoId)) return points;
  const prepared = points.map(point => point.puntoId ? point : { ...point, puntoId: newGpsPointId() });
  if (!savePendingGpsQueue(owner, id, prepared, contextOwner)) {
    throw new GpsPendingError('No se pudieron guardar las ubicaciones en el dispositivo.', 'storage');
  }
  return prepared;
}

type GpsApiClient = { post: (endpoint: string, data?: unknown) => Promise<unknown> };

/** A new path fails closed on an older backend, which would ignore a retry key. */
export async function sendIdempotentGps(api: GpsApiClient, id: string, point: PendingGpsPoint): Promise<void> {
  if (!point.puntoId || !UUID.test(point.puntoId)) throw new GpsPendingError('No se pudo preparar la ubicación para sincronizar.');
  let response: unknown;
  try { response = await api.post(`/manifiestos/${id}/ubicacion-idempotente`, gpsPointPayload(point)); }
  catch (error) {
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    if (status === 404 || status === 405 || status === 501) {
      throw new GpsPendingError('No se pudo verificar el viaje o el servidor. Actualizá la pantalla y, si persiste, contactá a soporte.');
    }
    throw error;
  }
  const body = (response as { data?: { success?: unknown; data?: { idempotencia?: { version?: unknown; puntoId?: unknown } } } } | undefined)?.data;
  if (body?.success !== true || body.data?.idempotencia?.version !== 1 || body.data.idempotencia.puntoId !== point.puntoId) {
    throw new GpsPendingError('SITREP no confirmó la ubicación. Revisá la conexión o contactá a soporte.');
  }
}

/** Only a recent sensor fix may be sent as a current position. An older or
 * unclocked point may be removed from a queue only after an exact receipt. */
export async function deliverPendingGpsPoint(
  point: PendingGpsPoint,
  send: (point: PendingGpsPoint) => Promise<unknown>,
  verify?: (point: PendingGpsPoint) => Promise<boolean>,
): Promise<'sent' | 'verified'> {
  if (gpsObservationIsFresh(point.observedAt)) {
    await send(point);
    return 'sent';
  }
  if (point.puntoId && verify) {
    try {
      if (await verify(point)) return 'verified';
      throw new GpsUnconfirmedPreviousPointError();
    }
    catch (error) {
      if (error instanceof GpsUnconfirmedPreviousPointError) throw error;
      const status = (error as { response?: { status?: number } } | null)?.response?.status;
      if (status !== 404 && status !== 405 && status !== 501) throw error;
      // A missing receipt, older server or inaccessible resource is not proof
      // that the point was never sent. Keep it for an authorized review.
    }
  }
  throw new GpsPendingError('SITREP no confirmó una ubicación anterior. Se conserva en este dispositivo; contactá a soporte antes de continuar.');
}

export type GpsStorageIssue = 'legacy' | 'unscoped' | 'context' | 'invalid' | 'storage' | 'reference' | 'conflict';
type QueueRead = { ok: true; durable: boolean; points: PendingGpsPoint[] } | { ok: false; reason: GpsStorageIssue };

/** Explain the same blocking condition wherever the driver encounters it. */
export function gpsStorageErrorMessage(issue: GpsStorageIssue | null): string {
  if (issue === 'legacy') return 'Hay ubicaciones anteriores sin titular identificado. Se conservaron; contactá a soporte antes de confirmar.';
  if (issue === 'unscoped') return 'Hay ubicaciones anteriores sin actividad identificada. Conservá este dispositivo y contactá a soporte.';
  if (issue === 'context') return 'Hay ubicaciones pendientes de otra actividad. Volvé a esa actividad o contactá a soporte.';
  if (issue === 'invalid') return 'No se pudieron leer las ubicaciones guardadas. La copia no se modificó; conservá este dispositivo y contactá a soporte antes de confirmar.';
  if (issue === 'reference') return 'No se pudo preparar la ubicación para enviarla de forma segura. Contactá a soporte.';
  if (issue === 'conflict') return 'Una ubicación cambió durante la comprobación. Se conservó en este dispositivo; actualizá el viaje y consultá a soporte si persiste.';
  return 'No se pudo guardar el recorrido en el dispositivo. Mantené esta pantalla abierta, revisá el almacenamiento o la conexión y reintentá.';
}

/** Include the request identity (including temporary views) without storing a token. */
export function gpsContextScope(owner: string, requestContext: string): string {
  return owner && requestContext ? JSON.stringify([owner, requestContext]) : '';
}
export function gpsScopeMatchesRequest(scope: string, requestContext: string): boolean {
  try {
    const value:unknown = JSON.parse(scope);
    return Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && !!value[0]
      && !!requestContext && value[1] === requestContext;
  } catch { return false; }
}

export function gpsQueueKey(owner: string | number, id: string, contextOwner?: string): string {
  return contextOwner
    ? `sitrep_gps_v3_${encodeURIComponent(JSON.stringify([String(owner), id, contextOwner]))}`
    : `sitrep_gps_v2_${encodeURIComponent(JSON.stringify([String(owner), id]))}`;
}

export function hasVolatileGpsQueue(owner: string | number, id: string, contextOwner?: string): boolean {
  return (volatileQueues.get(gpsQueueKey(owner, id, contextOwner))?.length ?? 0) > 0;
}

/** A different account's pending work must not be uploaded under this session
 * or silently stranded by finishing the same trip on this device. */
export function assertNoOtherGpsQueue(owner: string | number, id: string, contextOwner?: string): void {
  const ownKey = gpsQueueKey(owner, id, contextOwner);
  const check = (key: string, raw: string | null) => {
    const version = key.startsWith('sitrep_gps_v2_') ? 'sitrep_gps_v2_' : key.startsWith('sitrep_gps_v3_') ? 'sitrep_gps_v3_' : null;
    if (!version || key === ownKey || raw === null) return;
    let identity: unknown;
    try { identity = JSON.parse(decodeURIComponent(key.slice(version.length))); } catch { return; }
    if (!Array.isArray(identity) || identity[1] !== id || (version === 'sitrep_gps_v2_' ? identity.length !== 2 : identity.length !== 3)) return;
    // An empty queue is harmless. Invalid saved data must remain available for review.
    try { const value: unknown = JSON.parse(raw); if (Array.isArray(value) && value.length === 0) return; } catch { /* preserve it */ }
    if (String(identity[0]) === String(owner)) {
      throw new GpsPendingError('Hay ubicaciones pendientes de otra actividad. Volvé a esa actividad y sincronizalas. Si no la encontrás, contactá a soporte.', 'context');
    }
    throw new GpsPendingError('Hay ubicaciones pendientes de otra cuenta en este navegador o app. Ingresá con esa cuenta y sincronizalas antes de continuar.');
  };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) check(key, localStorage.getItem(key));
    }
    for (const [key, points] of volatileQueues) check(key, JSON.stringify(points));
  } catch (error) {
    if (error instanceof GpsPendingError) throw error;
    throw new GpsPendingError('No se pudo revisar el almacenamiento de ubicaciones. Reintentá antes de continuar.', 'storage');
  }
}

/** Keep unsaved points in memory and report storage failures to the user. */
export function savePendingGpsQueue(owner: string | number, id: string, points: PendingGpsPoint[], contextOwner?: string): boolean {
  const key = gpsQueueKey(owner, id, contextOwner);
  try {
    if (points.length) localStorage.setItem(key, JSON.stringify(points));
    else localStorage.removeItem(key);
    volatileQueues.delete(key);
    updateVolatileGpsWarning();
    return true;
  } catch {
    volatileQueues.set(key, [...points]);
    updateVolatileGpsWarning();
    return false;
  }
}

export function readPendingGpsQueue(owner: string | number, id: string, contextOwner?: string): QueueRead {
  const key = gpsQueueKey(owner, id, contextOwner);
  let saved: string | null;
  try {
    // Old queues did not record their owner. Do not attach them to a new
    // account or erase them until their provenance can be checked.
    if (localStorage.getItem(`gps_pending_${id}`) !== null) return { ok: false, reason: 'legacy' };
    // The v2 key identified an account but not its activity/company. Do not
    // silently attribute those points to whichever activity is now active.
    if (contextOwner) {
      const old = localStorage.getItem(gpsQueueKey(owner, id));
      if (old !== null) {
        try { const value: unknown = JSON.parse(old); if (!Array.isArray(value) || value.length) return { ok: false, reason: 'unscoped' }; }
        catch { return { ok: false, reason: 'unscoped' }; }
      }
      if (hasVolatileGpsQueue(owner, id)) return { ok: false, reason: 'unscoped' };
    }
    const memory = volatileQueues.get(key);
    if (memory) return { ok: true, durable: false, points: [...memory] };
    saved = localStorage.getItem(key);
  } catch {
    return { ok: false, reason: 'storage' };
  }
  // Only an absent key means there is no queue. An empty string is damaged
  // data, not an empty list; preserve it and block transitions for review.
  if (saved === null) return { ok: true, durable: true, points: [] };
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.some(point => !point || typeof point !== 'object'
      || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)
      || (point.observedAt != null && (typeof point.observedAt !== 'number' || !Number.isFinite(point.observedAt)))
      || (point.puntoId !== undefined && (typeof point.puntoId !== 'string' || !UUID.test(point.puntoId))))) return { ok: false, reason: 'invalid' };
    return { ok: true, durable: true, points: parsed as PendingGpsPoint[] };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

/** Remove only the acknowledged point from the latest queue, retaining later additions. */
export function acknowledgeGpsPoint(owner: string | number, id: string, puntoId: string, contextOwner?: string, expected?: PendingGpsPoint): QueueRead {
  const saved = readPendingGpsQueue(owner, id, contextOwner);
  if (!saved.ok) return saved;
  const index = saved.points.findIndex(point => point.puntoId === puntoId);
  if (index < 0) return saved;
  if (expected && JSON.stringify(saved.points[index]) !== JSON.stringify(expected)) return { ok: false, reason: 'conflict' };
  const remaining = [...saved.points.slice(0, index), ...saved.points.slice(index + 1)];
  return { ok: true, durable: savePendingGpsQueue(owner, id, remaining, contextOwner), points: remaining };
}

export function gpsTasksForTrip(id: string): Promise<void>[] {
  return [...(tasksByTrip.get(id) ?? [])];
}

export function trackGpsTask(id: string, task: Promise<void>): void {
  let bucket = tasksByTrip.get(id);
  if (!bucket) {
    bucket = new Set();
    tasksByTrip.set(id, bucket);
  }
  const tasks = bucket;
  tasks.add(task);
  const remove = () => {
    tasks.delete(task);
    if (tasks.size === 0 && tasksByTrip.get(id) === tasks) tasksByTrip.delete(id);
  };
  void task.then(remove, remove);
}

export function runExclusiveGpsTask(id: string, work: () => Promise<void>): Promise<void> {
  const earlier = gpsTasksForTrip(id);
  const task = (async () => {
    if (earlier.length) await Promise.allSettled(earlier);
    await work();
  })();
  trackGpsTask(id, task);
  return task;
}

/** Advance the durable queue after each confirmed response, preserving the rest on failure. */
export async function flushStoredGpsQueue(owner: string | number, id: string, send: (point: PendingGpsPoint) => Promise<unknown>, contextOwner?: string, verify?: (point: PendingGpsPoint) => Promise<boolean>): Promise<void> {
  const key = gpsQueueKey(owner, id, contextOwner);
  const read = (): PendingGpsPoint[] => {
    const saved = readPendingGpsQueue(owner, id, contextOwner);
    if (!saved.ok) throw new GpsPendingError(saved.reason === 'legacy'
      ? 'Hay ubicaciones anteriores sin titular identificado. Contactá a soporte para revisarlas.'
      : saved.reason === 'unscoped' ? 'Hay ubicaciones anteriores sin actividad identificada. Conservá este dispositivo y contactá a soporte.'
      : 'No se pudieron leer las ubicaciones guardadas.', saved.reason);
    if (!saved.durable) throw new Error('No se pudieron guardar las ubicaciones en el dispositivo.');
    return saved.points;
  };
  let pending = prepareGpsPoints(owner, id, read(), contextOwner);
  while (pending.length) {
    const first = pending[0];
    await deliverPendingGpsPoint(first, send, verify);
    const current = read();
    if (!current.length || JSON.stringify(current[0]) !== JSON.stringify(first)) {
      throw new Error('Las ubicaciones pendientes cambiaron. Revisá la sincronización antes de continuar.');
    }
    pending = current.slice(1);
    if (pending.length) localStorage.setItem(key, JSON.stringify(pending));
    else localStorage.removeItem(key);
  }
  // Let this owner synchronize their own work first. Another account's work
  // still blocks the transition and is never uploaded under this session.
  assertNoOtherGpsQueue(owner, id, contextOwner);
}
