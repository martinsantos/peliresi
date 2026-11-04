/** Cached trip data is reusable only in the complete active authorization context. */
const pair = (owner: string, id: string) => encodeURIComponent(JSON.stringify([owner, id]));
export const tripSnapshotKey = (owner: string, id: string) => `viaje_snapshot_v2_${pair(owner, id)}`;
export const tripStatusKey = (owner: string, id: string) => `viaje_status_v2_${pair(owner, id)}`;
export const activeTripKey = (owner: string) => `sitrep_active_trip_v2_${encodeURIComponent(owner)}`;

export function tripAccessDenied(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 401 || status === 403 || status === 404;
}

/** Unknown is distinct from "no handoff": never restart the original GPS
 * from a saved trip until the latest locally verified handoff state is known. */
export function tripHandoffState(enabled: boolean, usingSavedCopy: boolean, saved: unknown, verified: boolean | null): boolean | null {
  if (!enabled) return false;
  if (usingSavedCopy) return typeof saved === 'boolean' ? saved : null;
  return verified;
}

export function readTripSnapshot<T extends { id?: string }>(owner: string, id: string): T | null {
  if (!owner || !id) return null;
  try {
    const raw = localStorage.getItem(tripSnapshotKey(owner, id));
    if (!raw) return null;
    const value = JSON.parse(raw) as T;
    return value && value.id === id ? value : null;
  } catch { return null; }
}

export function readActiveTrip(owner: string): string | null {
  if (!owner) return null;
  try { return localStorage.getItem(activeTripKey(owner)); } catch { return null; }
}

export function readTripStatus(owner: string, id: string): string | null {
  if (!owner || !id) return null;
  try { return localStorage.getItem(tripStatusKey(owner, id)); } catch { return null; }
}

/** A legacy pause is safe to preserve, but an unscoped legacy active state
 * cannot override a pause in the current context. A storage failure also
 * requires an explicit resume instead of silently starting the GPS. */
export function readInitialTripStatus(owner: string, id: string): 'ACTIVO' | 'PAUSADO' {
  if (!owner || !id) return 'PAUSADO';
  try {
    const current = localStorage.getItem(tripStatusKey(owner, id));
    if (current === 'ACTIVO' || current === 'PAUSADO') return current;
    return localStorage.getItem(`viaje_status_${id}`) === 'PAUSADO' ? 'PAUSADO' : 'ACTIVO';
  } catch { return 'PAUSADO'; }
}

export function writeTripSnapshot<T extends { id: string }>(owner: string, id: string, snapshot: T): void {
  if (!owner || !id || snapshot.id !== id) throw new Error('No se pudo identificar el contexto del viaje.');
  localStorage.setItem(tripSnapshotKey(owner, id), JSON.stringify(snapshot));
  localStorage.setItem(activeTripKey(owner), id);
}

export function clearTripSnapshot(owner: string, id: string): void {
  if (!owner || !id) return;
  localStorage.removeItem(tripSnapshotKey(owner, id));
  localStorage.removeItem(tripStatusKey(owner, id));
  if (localStorage.getItem(activeTripKey(owner)) === id) localStorage.removeItem(activeTripKey(owner));
}
