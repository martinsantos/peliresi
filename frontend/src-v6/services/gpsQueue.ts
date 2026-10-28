/** Coordinates GPS uploads for a manifest within one browser page. */
const tasksByTrip = new Map<string, Set<Promise<void>>>();
const volatileQueues = new Map<string, PendingGpsPoint[]>();
export const GPS_DELIVERY_CONFIRMED_EVENT = 'sitrep:gps-delivery-confirmed';

export class GpsPendingError extends Error {
  constructor(message = 'No se pudieron enviar las ubicaciones pendientes. Revisá la conexión y volvé a intentar.') {
    super(message);
    this.name = 'GpsPendingError';
  }
}

export interface PendingGpsPoint {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
}

export function gpsPointPayload(point: PendingGpsPoint) {
  return { latitud: point.lat, longitud: point.lng,
    ...(point.speed != null && { velocidad: point.speed }),
    ...(point.heading != null && { direccion: point.heading }) };
}

export type GpsStorageIssue = 'legacy' | 'invalid' | 'storage';
type QueueRead = { ok: true; durable: boolean; points: PendingGpsPoint[] } | { ok: false; reason: GpsStorageIssue };

export function gpsQueueKey(owner: string | number, id: string): string {
  return `sitrep_gps_v2_${encodeURIComponent(JSON.stringify([String(owner), id]))}`;
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
      || !Number.isFinite(point.lat) || !Number.isFinite(point.lng))) return { ok: false, reason: 'invalid' };
    return { ok: true, durable: true, points: parsed as PendingGpsPoint[] };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
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
  let pending = read();
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
}
