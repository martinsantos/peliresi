/** Order callbacks from one live sensor watcher without changing persisted
 * queues. The device clock can be corrected backwards while a trip is open;
 * in that case start a new comparison window instead of rejecting every fix. */
export function createGpsFixOrder() {
  let latest: number | null = null;
  let callbackClock: number | null = null;
  let epoch = 0;
  const accept = (capturedAt: number, now = Date.now()): boolean => {
    if (callbackClock !== null && now < callbackClock) { latest = null; epoch++; }
    callbackClock = now;
    // Unknown timestamps cannot be ordered. Preserve the existing handling of
    // those readings; this guard only rejects demonstrably older observations.
    if (!Number.isFinite(capturedAt) || capturedAt <= 0) return true;
    if (latest !== null && capturedAt < latest) return false;
    latest = capturedAt;
    return true;
  };
  accept.epoch = () => epoch;
  return accept;
}

/** Only identify a repeated fix when the sensor supplied a usable timestamp.
 * Unknown timestamps must not cause two distinct readings to be collapsed. */
export function gpsFixFingerprint(capturedAt: number, point: { latitud: number; longitud: number; precision?: number | null; velocidad?: number | null; direccion?: number | null }): string | null {
  if (!Number.isFinite(capturedAt) || capturedAt <= 0) return null;
  return JSON.stringify([capturedAt, point.latitud, point.longitud, point.precision ?? null, point.velocidad ?? null, point.direccion ?? null]);
}
