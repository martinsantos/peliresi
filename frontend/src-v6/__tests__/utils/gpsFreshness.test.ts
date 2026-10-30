import { describe, expect, it } from 'vitest';
import { gpsEventCoordinates, gpsFixFreshness, gpsObservationIsFresh } from '../../utils/gpsFreshness';

const now = 1_800_000_000_000;
const input = { position: [-33.334, -68.744] as [number, number], status: 'active' as const,
  lastUpdate: new Date(now - 59_999), tripActive: true };

describe('freshness of a device GPS fix', () => {
  it('accepts a recent fix but not one at the 60 second boundary', () => {
    expect(gpsFixFreshness(new Date(now - 59_999), now)).toBe('fresh');
    expect(gpsFixFreshness(new Date(now - 60_000), now)).toBe('stale');
    expect(gpsObservationIsFresh(now - 59_999, now)).toBe(true);
    expect(gpsObservationIsFresh(now - 60_000, now)).toBe(false);
    expect(gpsEventCoordinates(input, now)).toEqual({ latitud: -33.334, longitud: -68.744 });
    expect(gpsEventCoordinates({ ...input, lastUpdate: new Date(now - 60_000) }, now)).toBeUndefined();
  });

  it('does not infer freshness from missing, invalid, or future device times', () => {
    for (const time of [null, new Date(NaN), new Date(now + 1)]) {
      expect(gpsFixFreshness(time, now)).toBe('unknown');
      expect(gpsEventCoordinates({ ...input, lastUpdate: time }, now)).toBeUndefined();
    }
    for (const time of [null, undefined, NaN, now + 1]) expect(gpsObservationIsFresh(time, now)).toBe(false);
  });

  it('only attaches valid coordinates from an active sensor on an active trip', () => {
    expect(gpsEventCoordinates({ ...input, status: 'denied' }, now)).toBeUndefined();
    expect(gpsEventCoordinates({ ...input, tripActive: false }, now)).toBeUndefined();
    expect(gpsEventCoordinates({ ...input, position: null }, now)).toBeUndefined();
    expect(gpsEventCoordinates({ ...input, position: [NaN, -68] }, now)).toBeUndefined();
    expect(gpsEventCoordinates({ ...input, position: [-91, -68] }, now)).toBeUndefined();
  });
});
