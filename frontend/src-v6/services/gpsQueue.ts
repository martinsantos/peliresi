/** Coordinates GPS uploads for a manifest within one browser page. */
const tasksByTrip = new Map<string, Set<Promise<void>>>();
const volatileQueues = new Map<string, PendingGpsPoint[]>();
export const GPS_DELIVERY_CONFIRMED_EVENT = 'sitrep:gps-delivery-confirmed';

export class GpsPendingError extends Error {
  constructor(message = 'No se pudieron enviar las ubicaciones pendientes. Revisá la conexión y volvé a intentar.', readonly issue?: GpsStorageIssue) {
    super(message);
    this.name = 'GpsPendingError';
  }
}

export interface PendingGpsPoint {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  puntoId?: string;
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
export function prepareGpsPoints(owner: string | number, id: string, points: PendingGpsPoint[]): PendingGpsPoint[] {
  if (points.some(point => point.puntoId !== undefined && !UUID.test(point.puntoId))) {
    throw new GpsPendingError('Una ubicación guardada tiene una referencia inválida. Contactá a soporte.', 'invalid');
  }
  if (points.every(point => point.puntoId)) return points;
  const prepared = points.map(point => point.puntoId ? point : { ...point, puntoId: newGpsPointId() });
  if (!savePendingGpsQueue(owner, id, prepared)) {
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

export type GpsStorageIssue = 'legacy' | 'invalid' | 'storage' | 'reference';
type QueueRead = { ok: true; durable: boolean; points: PendingGpsPoint[] } | { ok: false; reason: GpsStorageIssue };

export function gpsQueueKey(owner: string | number, id: string): string {
  return `sitrep_gps_v2_${encodeURIComponent(JSON.stringify([String(owner), id]))}`;
}

/** A different account's pending work must not be uploaded under this session
 * or silently stranded by finishing the same trip on this device. */
export function assertNoOtherGpsQueue(owner: string | number, id: string): void {
  const prefix = 'sitrep_gps_v2_';
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix) || key === gpsQueueKey(owner, id)) continue;
      let identity: unknown;
      try { identity = JSON.parse(decodeURIComponent(key.slice(prefix.length))); } catch { continue; }
      if (!Array.isArray(identity) || identity.length !== 2 || identity[1] !== id || String(identity[0]) === String(owner)) continue;
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      // A deliberately empty array does not represent unsent work. Malformed
      // data remains untouched and blocks the transition for manual review.
      try { const value: unknown = JSON.parse(raw); if (Array.isArray(value) && value.length === 0) continue; } catch { /* preserve it */ }
      throw new GpsPendingError('Hay ubicaciones pendientes de otra cuenta en este navegador o app. Ingresá con esa cuenta y sincronizalas antes de continuar.');
    }
  } catch (error) {
    if (error instanceof GpsPendingError) throw error;
    throw new GpsPendingError('No se pudo revisar el almacenamiento de ubicaciones. Reintentá antes de continuar.', 'storage');
  }
}

/** Keep unsaved points in memory and report storage failures to the user. */
export function savePendingGpsQueue(owner: string | number, id: string, points: PendingGpsPoint[]): boolean {
  const key = gpsQueueKey(owner, id);
  try {
    if (points.length) localStorage.setItem(key, JSON.stringify(points));
    else localStorage.removeItem(key);
    volatileQueues.delete(key);
    return true;
  } catch {
    volatileQueues.set(key, [...points]);
    return false;
  }
}

export function readPendingGpsQueue(owner: string | number, id: string): QueueRead {
  const key = gpsQueueKey(owner, id);
  let saved: string | null;
  try {
    // Old queues did not record their owner. Do not attach them to a new
    // account or erase them until their provenance can be checked.
    if (localStorage.getItem(`gps_pending_${id}`) !== null) return { ok: false, reason: 'legacy' };
    const memory = volatileQueues.get(key);
    if (memory) return { ok: true, durable: false, points: [...memory] };
    saved = localStorage.getItem(key);
  } catch {
    return { ok: false, reason: 'storage' };
  }
  if (!saved) return { ok: true, durable: true, points: [] };
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.some(point => !point || typeof point !== 'object'
      || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)
      || (point.puntoId !== undefined && (typeof point.puntoId !== 'string' || !UUID.test(point.puntoId))))) return { ok: false, reason: 'invalid' };
    return { ok: true, durable: true, points: parsed as PendingGpsPoint[] };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

/** Remove only the acknowledged point from the latest queue, retaining later additions. */
export function acknowledgeGpsPoint(owner: string | number, id: string, puntoId: string): QueueRead {
  const saved = readPendingGpsQueue(owner, id);
  if (!saved.ok) return saved;
  const index = saved.points.findIndex(point => point.puntoId === puntoId);
  if (index < 0) return saved;
  const remaining = [...saved.points.slice(0, index), ...saved.points.slice(index + 1)];
  return { ok: true, durable: savePendingGpsQueue(owner, id, remaining), points: remaining };
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
export async function flushStoredGpsQueue(owner: string | number, id: string, send: (point: PendingGpsPoint) => Promise<unknown>): Promise<void> {
  const key = gpsQueueKey(owner, id);
  const read = (): PendingGpsPoint[] => {
    const saved = readPendingGpsQueue(owner, id);
    if (!saved.ok) throw new Error(saved.reason === 'legacy'
      ? 'Hay ubicaciones anteriores sin titular identificado. Contactá a soporte para revisarlas.'
      : 'No se pudieron leer las ubicaciones guardadas.');
    if (!saved.durable) throw new Error('No se pudieron guardar las ubicaciones en el dispositivo.');
    return saved.points;
  };
  let pending = prepareGpsPoints(owner, id, read());
  while (pending.length) {
    const first = pending[0];
    await send(first);
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
  assertNoOtherGpsQueue(owner, id);
}
