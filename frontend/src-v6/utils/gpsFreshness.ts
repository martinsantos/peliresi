import type { GpsStatus } from '../hooks/useGPSTracking';

// This is a device-fix freshness window, not a duration limit for the trip.
export const GPS_EVENT_MAX_AGE_MS = 60_000;

export type GpsFixFreshness = 'fresh' | 'stale' | 'unknown';

export function gpsFixFreshness(lastUpdate: Date | null, now = Date.now()): GpsFixFreshness {
  const measuredAt = lastUpdate?.getTime();
  if (measuredAt == null || !Number.isFinite(measuredAt) || !Number.isFinite(now) || measuredAt > now) return 'unknown';
  return now - measuredAt < GPS_EVENT_MAX_AGE_MS ? 'fresh' : 'stale';
}

export function gpsEventCoordinates(input: {
  position: [number, number] | null;
  status: GpsStatus;
  lastUpdate: Date | null;
  tripActive: boolean;
}, now = Date.now()): { latitud: number; longitud: number } | undefined {
  const { position, status, lastUpdate, tripActive } = input;
  if (!tripActive || status !== 'active' || !position || gpsFixFreshness(lastUpdate, now) !== 'fresh') return undefined;
  const [latitud, longitud] = position;
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud) || Math.abs(latitud) > 90 || Math.abs(longitud) > 180) return undefined;
  return { latitud, longitud };
}
