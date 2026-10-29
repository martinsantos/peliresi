import { GpsPendingError } from './gpsQueue';

// The same origin may have several pages open for one manifest. localStorage
// read/modify/write is not atomic, so every participating page uses one lock.
export const gpsLockName = (id: string) => `sitrep:gps:${id}`;
const busyMessage = 'El GPS de este manifiesto está activo en otra pestaña o ventana. Allí revisá y sincronizá sus ubicaciones, cerrá esa pantalla y reintentá.';
const unavailableMessage = 'Este navegador no puede coordinar el GPS entre ventanas. Actualizalo o usá un navegador compatible antes de continuar.';

export interface GpsLease {
  release: () => Promise<void>;
}

// A React screen can unmount and reopen in the same page while an upload is
// still draining. Let its successor await that local release before trying.
const closingLeases = new Map<string, Promise<void>>();
export function gpsLeaseClosing(id: string): Promise<void> | undefined { return closingLeases.get(id); }
export function rememberGpsLeaseClosing(id: string, release: Promise<void>): void {
  const previous = closingLeases.get(id);
  const combined = previous ? Promise.allSettled([previous, release]).then(() => undefined) : release;
  closingLeases.set(id, combined);
  void combined.finally(() => { if (closingLeases.get(id) === combined) closingLeases.delete(id); });
}

/** Start an exclusive lease without waiting behind another page. The callback
 * may arrive after release, in which case it must never start a GPS watcher. */
export function startGpsLease(id: string, onGranted: () => void, onError: (error: GpsPendingError) => void): GpsLease {
  let cancelled = false;
  let releaseHold!: () => void;
  const hold = new Promise<void>(resolve => { releaseHold = resolve; });
  if (typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function') {
    onError(new GpsPendingError(unavailableMessage));
    return { release: async () => { cancelled = true; releaseHold(); } };
  }
  let finished: Promise<void>;
  try {
    finished = navigator.locks.request<void>(gpsLockName(id), { mode: 'exclusive', ifAvailable: true }, async lock => {
      if (cancelled) return;
      if (!lock) { onError(new GpsPendingError(busyMessage)); return; }
      onGranted();
      await hold;
    }).catch(() => { if (!cancelled) onError(new GpsPendingError(unavailableMessage)); });
  } catch {
    onError(new GpsPendingError(unavailableMessage));
    finished = Promise.resolve();
  }
  return { release: async () => { cancelled = true; releaseHold(); await finished; } };
}

/** Hold the lock through both the queue flush and the server transition. */
export async function withGpsTransitionLock<T>(id: string, action: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function') throw new GpsPendingError(unavailableMessage);
  let entered = false;
  try {
    return await navigator.locks.request(gpsLockName(id), { mode: 'exclusive', ifAvailable: true }, async lock => {
      entered = true;
      if (!lock) throw new GpsPendingError(busyMessage);
      return action();
    });
  } catch (error) {
    if (error instanceof GpsPendingError) throw error;
    // Preserve a failure from the requested operation; do not misreport it as
    // an unsupported browser after it may have reached the server.
    if (!entered) throw new GpsPendingError(unavailableMessage);
    throw error;
  }
}
