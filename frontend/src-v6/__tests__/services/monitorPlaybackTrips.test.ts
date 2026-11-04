import { describe, expect, it } from 'vitest';
import { playbackTripList } from '../../pages/monitor/utils/playback-trips';
import type { TripState } from '../../pages/monitor/hooks/useTimeline';

describe('Viajes del historial del Monitor', () => {
  it('no presenta el lugar de retiro como una ubicación GPS recibida', () => {
    const trip: TripState = { numero: 'QA-01', lat: -33, lng: -69, trail: [],
      gpsCount: 0, lastGpsReceivedAt: null, positionSource: 'retiro' };
    expect(playbackTripList(new Map([['internal-id', trip]]))).toMatchObject([
      { numero: 'QA-01', ultimaPosicion: null, ruta: [], esHistorial: true },
    ]);
  });

  it('conserva la recepción real, no la hora del cursor del historial', () => {
    const trip: TripState = { numero: 'QA-02', lat: -33.1, lng: -69, trail: [[-33.1, -69]],
      gpsCount: 1, lastGpsReceivedAt: '2026-10-29T12:00:00.000Z', positionSource: 'gps' };
    const [view] = playbackTripList(new Map([['other-id', trip]]));
    expect(view.ultimaPosicion).toEqual({ latitud: -33.1, longitud: -69, timestamp: '2026-10-29T12:00:00.000Z' });
    expect(view.ruta).toHaveLength(1);
    expect(view.numero).toBe('QA-02');
  });
});
