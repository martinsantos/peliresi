import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGPSTracking } from '../../hooks/useGPSTracking';
import { manifiestoService } from '../../services/manifiesto.service';

vi.mock('../../services/manifiesto.service', () => ({ manifiestoService: { actualizarUbicacion: vi.fn() } }));
vi.mock('../../components/ui/Toast', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));

const position = (latitude = -33, longitude = -69): GeolocationPosition => ({
  coords: { latitude, longitude, accuracy: 10, speed: null, heading: null, altitude: null, altitudeAccuracy: null },
  timestamp: Date.now(),
} as GeolocationPosition);
const error = (code: number) => ({ code, message: 'GPS test failure' } as GeolocationPositionError);
const trip = { manifiestoId: 'gps-safety-trip', estado: 'EN_TRANSITO', viajeStatus: 'ACTIVO' as const };
let watchSuccess: PositionCallback[];
let watchError: PositionErrorCallback[];
let coarseSuccess: PositionCallback[];
let coarseError: PositionErrorCallback[];

describe('GPS position provenance and cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    localStorage.clear();
    watchSuccess = []; watchError = []; coarseSuccess = []; coarseError = [];
    vi.mocked(navigator.geolocation.watchPosition).mockImplementation((success, failure) => {
      watchSuccess.push(success); watchError.push(failure!); return watchSuccess.length;
    });
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation((success, failure) => {
      coarseSuccess.push(success); coarseError.push(failure!);
    });
    vi.mocked(manifiestoService.actualizarUbicacion).mockResolvedValue(undefined);
  });
  afterEach(() => { vi.useRealTimers(); });

  it.each([1, 3, 4])('never sends a map default when geolocation fails before the first fix (code %s)', async (code) => {
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchError[0](error(code)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).not.toHaveBeenCalled();
    expect(result.current.position).toBeNull();
    expect(result.current.trackPoints).toEqual([]);
    expect(result.current.details.lastUpdate).toBeNull();
    unmount();
  });

  it('ignores late watch and coarse responses and stops all acquisition after explicit cleanup', async () => {
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => result.current.cleanupGps());
    act(() => { coarseSuccess[0](position()); coarseError[0](error(3)); watchSuccess[0](position()); watchError[0](error(1)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(result.current.position).toBeNull();
    expect(result.current.trackPoints).toEqual([]);
    expect(result.current.status).toBe('acquiring');
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(manifiestoService.actualizarUbicacion).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });

  it('ignores a pending fallback after permission denial but resumes on a new real watch fix', async () => {
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchError[0](error(1)));
    act(() => coarseSuccess[0](position(-31, -67)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.status).toBe('denied');
    expect(result.current.position).toBeNull();
    expect(manifiestoService.actualizarUbicacion).not.toHaveBeenCalled();

    act(() => watchSuccess[0](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.status).toBe('active');
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledExactlyOnceWith(trip.manifiestoId, -34, -70, null, null);
    unmount();
  });

  it('ignores an old coarse response after pause and resume without suppressing the new GPS fix', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ viajeStatus }: { viajeStatus: 'ACTIVO' | 'PAUSADO' }) => useGPSTracking({ ...trip, viajeStatus }),
      { initialProps: { viajeStatus: 'ACTIVO' } },
    );
    rerender({ viajeStatus: 'PAUSADO' });
    rerender({ viajeStatus: 'ACTIVO' });
    act(() => watchSuccess[1](position(-34, -70)));
    act(() => coarseSuccess[0](position(-31, -67)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.position).toEqual([-34, -70]);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledExactlyOnceWith(trip.manifiestoId, -34, -70, null, null);
    unmount();
  });

  it('keeps the newest 500 visual points while preserving existing unsent GPS data', async () => {
    const pending = { lat: -32, lng: -68, speed: null, heading: null };
    const key = `gps_pending_${trip.manifiestoId}`;
    localStorage.setItem(key, JSON.stringify([pending]));
    vi.mocked(manifiestoService.actualizarUbicacion).mockRejectedValue(new Error('offline'));
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    await act(async () => {});
    act(() => {
      for (let index = 0; index < 620; index++) watchSuccess[0](position(-33 + index / 10_000));
    });
    expect(result.current.trackPoints).toHaveLength(500);
    expect(result.current.trackPoints[0]).toEqual([-33 + 120 / 10_000, -69]);
    expect(result.current.trackPoints.at(-1)).toEqual([-33 + 619 / 10_000, -69]);
    expect(result.current.pendingCount).toBe(1);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([pending]);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.pendingCount).toBe(2);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([pending, { lat: -33 + 619 / 10_000, lng: -69, speed: null, heading: null }]);
    unmount();
  });
});
