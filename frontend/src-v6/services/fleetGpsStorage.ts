import { GpsPendingError } from './gpsQueue';

/** A distinct key per observation avoids overwriting another tab's point. The
 * key includes the account/activity scope supplied by the screen; no token or
 * relay capability is persisted here. */
const PREFIX = 'sitrep_fleet_gps_v1:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface FleetStoredPoint {
  targetKey: string;
  puntoId: string;
  observedAt: number;
  point: { latitud: number; longitud: number; precision: number; velocidad?: number; direccion?: number };
}
const prefixFor = (targetKey: string) => PREFIX + encodeURIComponent(targetKey) + ':';
const keyFor = (item: FleetStoredPoint) => prefixFor(item.targetKey) + item.puntoId.toLowerCase();
const failure = () => new GpsPendingError('No se pudieron revisar o guardar las ubicaciones de GPS de varias cargas. Conservá esta pantalla y revisá el almacenamiento.', 'storage');

function valid(item: unknown, targetKey: string, storageKey: string): item is FleetStoredPoint {
  if (!item || typeof item !== 'object') return false;
  const value = item as Partial<FleetStoredPoint>, p = value.point;
  return value.targetKey === targetKey && typeof value.puntoId === 'string' && UUID.test(value.puntoId)
    && keyFor(value as FleetStoredPoint) === storageKey && typeof value.observedAt === 'number' && Number.isFinite(value.observedAt) && value.observedAt > 0
    && !!p && Number.isFinite(p.latitud) && p.latitud >= -90 && p.latitud <= 90
    && Number.isFinite(p.longitud) && p.longitud >= -180 && p.longitud <= 180
    && Number.isFinite(p.precision) && p.precision >= 0
    && (p.velocidad === undefined || (Number.isFinite(p.velocidad) && p.velocidad >= 0))
    && (p.direccion === undefined || Number.isFinite(p.direccion));
}

/** Invalid or inaccessible data is retained and blocks the corresponding
 * operation; an empty list is never inferred from a storage failure. */
export function readFleetGpsPoints(targetKey: string): FleetStoredPoint[] {
  try {
    const prefix = prefixFor(targetKey), points: FleetStoredPoint[] = [];
    // Snapshot names before reading: another tab removing an unrelated key
    // must not shift indices and hide a pending point during the scan.
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      if (raw === null) throw failure();
      const item: unknown = JSON.parse(raw);
      if (!valid(item, targetKey, key)) throw failure();
      points.push(item);
    }
    return points.sort((a, b) => a.observedAt - b.observedAt || a.puntoId.localeCompare(b.puntoId));
  } catch (error) { if (error instanceof GpsPendingError) throw error; throw failure(); }
}

export function saveFleetGpsPoint(item: FleetStoredPoint): void {
  const key = keyFor(item);
  if (!valid(item, item.targetKey, key)) throw new GpsPendingError('No se pudo preparar una ubicación válida para guardar.', 'invalid');
  try {
    const raw = JSON.stringify(item), existing = localStorage.getItem(key);
    if (existing !== null && existing !== raw) throw failure();
    localStorage.setItem(key, raw);
    if (localStorage.getItem(key) !== raw) throw failure();
  } catch (error) { if (error instanceof GpsPendingError) throw error; throw failure(); }
}

/** Only a server-confirmed identical point can be removed. A different or
 * malformed value at the same key remains untouched for review. */
export function acknowledgeFleetGpsPoint(item: FleetStoredPoint): void {
  try {
    const key = keyFor(item), existing = localStorage.getItem(key);
    if (existing === null) return;
    if (existing !== JSON.stringify(item)) throw failure();
    localStorage.removeItem(key);
    if (localStorage.getItem(key) !== null) throw failure();
  } catch (error) { if (error instanceof GpsPendingError) throw error; throw failure(); }
}

/** Prevent this browser from finishing or handing off an original manifest
 * while any scoped fleet observation is still in its local storage. */
export function assertNoStoredFleetGpsForManifest(id: string): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(PREFIX)) continue;
      const suffix = key.slice(PREFIX.length), delimiter = suffix.lastIndexOf(':');
      if (delimiter < 0) continue;
      let identity: unknown;
      try { identity = JSON.parse(decodeURIComponent(suffix.slice(0, delimiter))); } catch { continue; }
      if (Array.isArray(identity) && identity.length === 2 && identity[1] === 'MANIFIESTO:' + id) {
        throw new GpsPendingError('Hay ubicaciones de GPS de varias cargas sin confirmar en este dispositivo. Abrí GPS de mis viajes con la cuenta y actividad originales para revisarlas antes de continuar.');
      }
    }
  } catch (error) { if (error instanceof GpsPendingError) throw error; throw failure(); }
}
