import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGPSTracking } from '../../hooks/useGPSTracking';
import { manifiestoService } from '../../services/manifiesto.service';
import { toast } from '../../components/ui/Toast';
import { GPS_DELIVERY_CONFIRMED_EVENT, gpsQueueKey } from '../../services/gpsQueue';

vi.mock('../../services/manifiesto.service', () => ({ manifiestoService: { actualizarUbicacion: vi.fn() } }));
vi.mock('../../components/ui/Toast', () => ({ toast: { error: vi.fn(), warning: vi.fn(), remove: vi.fn() } }));

const position = (latitude = -33, longitude = -69): GeolocationPosition => ({
  coords: { latitude, longitude, accuracy: 10, speed: null, heading: null, altitude: null, altitudeAccuracy: null },
  timestamp: Date.now(),
} as GeolocationPosition);
const error = (code: number) => ({ code, message: 'GPS test failure' } as GeolocationPositionError);
const trip = { ownerId: 'carrier-a', manifiestoId: 'gps-safety-trip', estado: 'EN_TRANSITO', viajeStatus: 'ACTIVO' as const };
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
    vi.mocked(toast.error).mockReturnValue('gps-permission-notice');
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
    expect(toast.remove).toHaveBeenCalledWith('gps-permission-notice');
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

  it('drains an in-flight GPS write before delivery and can resume after a failed delivery', async () => {
    let finish!: () => void;
    vi.mocked(manifiestoService.actualizarUbicacion).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchSuccess[0](position()));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(1);
    let drained = false;
    let stopping!: Promise<void>;
    act(() => { stopping = result.current.stopAndDrain().then(() => { drained = true; }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(drained).toBe(false);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); await stopping; });
    expect(drained).toBe(true);
    act(() => result.current.resumeGps());
    act(() => watchSuccess.at(-1)!(position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenLastCalledWith(trip.manifiestoId, -34, -70, null, null);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('retries a denied individual trip in one action without sending a stale position', async () => {
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchSuccess[0](position(-32, -68)));
    act(() => watchError[0](error(1)));
    expect(result.current.status).toBe('denied');
    await act(async () => { await result.current.retryGps(); });
    expect(toast.remove).toHaveBeenCalledWith('gps-permission-notice');
    expect(navigator.geolocation.clearWatch).toHaveBeenCalledWith(1);
    expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).not.toHaveBeenCalled();
    act(() => { watchSuccess[0](position(-31, -67)); watchSuccess[1](position(-34, -70)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.position).toEqual([-34, -70]);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledExactlyOnceWith(trip.manifiestoId, -34, -70, null, null);
    unmount();
  });

  it('coalesces rapid retry requests and never starts a paused trip', async () => {
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchError[0](error(1)));
    await act(async () => { await Promise.all([result.current.retryGps(), result.current.retryGps()]); });
    expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(2);
    unmount();
    vi.mocked(navigator.geolocation.watchPosition).mockClear();
    const paused = renderHook(() => useGPSTracking({ ...trip, viajeStatus:'PAUSADO' }));
    await act(async () => { await paused.result.current.retryGps(); });
    expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();
    paused.unmount();
  });

  it('does not replay an acknowledged queued point when retry interrupts a flush', async () => {
    let acknowledge!: () => void;
    vi.mocked(manifiestoService.actualizarUbicacion)
      .mockRejectedValueOnce(new Error('offline A'))
      .mockRejectedValueOnce(new Error('offline B'))
      .mockImplementationOnce(() => new Promise<void>(resolve => { acknowledge = resolve; }));
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchSuccess[0](position(-32, -68)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    act(() => watchSuccess[0](position(-33, -69)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.pendingCount).toBe(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(3);
    let retry!: Promise<void>;
    act(() => { retry = result.current.retryGps(); });
    await act(async () => { acknowledge(); await retry; await Promise.resolve(); await Promise.resolve(); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(4);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenLastCalledWith(trip.manifiestoId, -33, -69, null, null);
    expect(result.current.pendingCount).toBe(0);
    unmount();
  });

  it('waits for a failed in-flight point to be saved before a delivery or handoff continues', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(manifiestoService.actualizarUbicacion).mockImplementationOnce(() => new Promise<void>((_, fail) => { reject = fail; }));
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchSuccess[0](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    let stop!: Promise<void>;
    act(() => { stop = result.current.stopAndDrain(); });
    await act(async () => { reject(new Error('offline')); await stop; });
    expect(result.current.pendingCount).toBe(1);
    expect(JSON.parse(localStorage.getItem(gpsQueueKey(trip.ownerId, trip.manifiestoId))!)).toEqual([{ lat:-34, lng:-70, speed:null, heading:null }]);
    unmount();
  });

  it('never overlaps GPS sends when a previous request is still pending', async () => {
    let finish!: () => void;
    vi.mocked(manifiestoService.actualizarUbicacion).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const { unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchSuccess[0](position()));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('does not restart tracking after a delivery or handoff stops it during retry', async () => {
    let finish!: () => void;
    vi.mocked(manifiestoService.actualizarUbicacion).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchSuccess[0](position()));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    let retry!: Promise<void>, stop!: Promise<void>;
    act(() => { retry = result.current.retryGps(); stop = result.current.stopAndDrain(); });
    await act(async () => { finish(); await Promise.all([retry, stop]); });
    expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('requires a fresh location after switching to another manifest', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ id }: { id: string }) => useGPSTracking({ ...trip, manifiestoId: id }),
      { initialProps: { id: 'gps-trip-a' } },
    );
    act(() => watchSuccess[0](position(-32, -68)));
    rerender({ id: 'gps-trip-b' });
    act(() => watchSuccess[0](position(-31, -67)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.position).toBeNull();
    expect(manifiestoService.actualizarUbicacion).not.toHaveBeenCalled();
    act(() => watchSuccess[1](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledExactlyOnceWith('gps-trip-b', -34, -70, null, null);
    unmount();
  });

  it('keeps an interrupted queue with its original manifest when switching trips', async () => {
    let acknowledge!: () => void;
    vi.mocked(manifiestoService.actualizarUbicacion)
      .mockRejectedValueOnce(new Error('offline A'))
      .mockRejectedValueOnce(new Error('offline B'))
      .mockImplementationOnce(() => new Promise<void>(resolve => { acknowledge = resolve; }));
    const { result, rerender, unmount } = renderHook(
      ({ id }: { id: string }) => useGPSTracking({ ...trip, manifiestoId: id }),
      { initialProps: { id: 'gps-trip-a' } },
    );
    act(() => watchSuccess[0](position(-32, -68)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    act(() => watchSuccess[0](position(-33, -69)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    rerender({ id: 'gps-trip-b' });
    await act(async () => { acknowledge(); await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.pendingCount).toBe(0);
    expect(JSON.parse(localStorage.getItem(gpsQueueKey(trip.ownerId, 'gps-trip-a'))!)).toEqual([{ lat:-33, lng:-69, speed:null, heading:null }]);
    expect(localStorage.getItem(gpsQueueKey(trip.ownerId, 'gps-trip-b'))).toBeNull();
    act(() => watchSuccess[1](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(4);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenLastCalledWith('gps-trip-b', -34, -70, null, null);
    unmount();
  });

  it('does not move a queue or location to another account using the same manifest', async () => {
    vi.mocked(manifiestoService.actualizarUbicacion).mockRejectedValueOnce(new Error('offline'));
    const { result, rerender, unmount } = renderHook(
      ({ owner }: { owner: string }) => useGPSTracking({ ...trip, ownerId: owner }),
      { initialProps: { owner:'carrier-a' } },
    );
    act(() => watchSuccess[0](position(-32, -68)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    rerender({ owner:'carrier-b' });
    expect(result.current.position).toBeNull();
    expect(result.current.pendingCount).toBe(0);
    expect(localStorage.getItem(gpsQueueKey('carrier-a', trip.manifiestoId))).not.toBeNull();
    expect(localStorage.getItem(gpsQueueKey('carrier-b', trip.manifiestoId))).toBeNull();
    act(() => watchSuccess[1](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenLastCalledWith(trip.manifiestoId, -34, -70, null, null);
    unmount();
  });

  it('waits for an interrupted upload before reopening the same trip queue', async () => {
    let acknowledge!: () => void;
    vi.mocked(manifiestoService.actualizarUbicacion)
      .mockRejectedValueOnce(new Error('offline A'))
      .mockRejectedValueOnce(new Error('offline B'))
      .mockImplementationOnce(() => new Promise<void>(resolve => { acknowledge = resolve; }));
    const first = renderHook(() => useGPSTracking(trip));
    act(() => watchSuccess[0](position(-32, -68)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    act(() => watchSuccess[0](position(-33, -69)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(3);
    first.unmount();

    const reopened = renderHook(() => useGPSTracking(trip));
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(3);
    await act(async () => { acknowledge(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(4);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenLastCalledWith(trip.manifiestoId, -33, -69, null, null);
    expect(reopened.result.current.pendingCount).toBe(0);
    expect(localStorage.getItem(gpsQueueKey(trip.ownerId, trip.manifiestoId))).toBeNull();
    reopened.unmount();
  });

  it('does not replay saved points when a trip is already delivered', async () => {
    const point = { lat: -32, lng: -68, speed: null, heading: null };
    localStorage.setItem(gpsQueueKey(trip.ownerId, trip.manifiestoId), JSON.stringify([point]));
    const { unmount } = renderHook(() => useGPSTracking({ ...trip, estado: 'ENTREGADO' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(manifiestoService.actualizarUbicacion).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(gpsQueueKey(trip.ownerId, trip.manifiestoId))!)).toEqual([point]);
    unmount();
  });

  it('preserves earlier unsent points when more than 500 positions accumulate offline', async () => {
    const key = gpsQueueKey(trip.ownerId, trip.manifiestoId);
    const pending = Array.from({ length: 500 }, (_, index) => ({ lat: -33 + index / 10_000, lng: -69, speed: null, heading: null }));
    localStorage.setItem(key, JSON.stringify(pending));
    vi.mocked(manifiestoService.actualizarUbicacion).mockRejectedValue(new Error('offline'));
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    await act(async () => {});
    act(() => watchSuccess[0](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.pendingCount).toBe(501);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([...pending, { lat: -34, lng: -70, speed: null, heading: null }]);
    unmount();
  });

  it('sends queued points before a transition and keeps the unacknowledged tail on failure', async () => {
    const key = gpsQueueKey(trip.ownerId, trip.manifiestoId);
    const first = { lat:-32, lng:-68, speed:null, heading:null }, second = { lat:-33, lng:-69, speed:null, heading:null };
    localStorage.setItem(key, JSON.stringify([first, second]));
    vi.mocked(manifiestoService.actualizarUbicacion).mockRejectedValueOnce(new Error('offline'));
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    await act(async () => {});
    await act(async () => { await result.current.stopAndDrain(); });
    vi.mocked(manifiestoService.actualizarUbicacion).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline'));
    let completed = true;
    await act(async () => { completed = await result.current.flushPending(); });
    expect(completed).toBe(false);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([second]);
    await act(async () => { completed = await result.current.flushPending(); });
    expect(completed).toBe(true);
    expect(localStorage.getItem(key)).toBeNull();
    unmount();
  });

  it('stops tracking without restoring a queue after an offline delivery sync succeeds', async () => {
    const key = gpsQueueKey(trip.ownerId, trip.manifiestoId);
    localStorage.setItem(key, JSON.stringify([{ lat:-32, lng:-68, speed:null, heading:null }]));
    vi.mocked(manifiestoService.actualizarUbicacion).mockRejectedValue(new Error('offline'));
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    await act(async () => {});
    localStorage.removeItem(key);
    act(() => window.dispatchEvent(new CustomEvent(GPS_DELIVERY_CONFIRMED_EVENT, { detail: { id:trip.manifiestoId, owner:trip.ownerId } })));
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.deliveryWasConfirmed()).toBe(true);
    expect(localStorage.getItem(key)).toBeNull();
    act(() => result.current.resumeGps());
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('warns when GPS cannot be stored and retains it in memory across reopening in the same page', async () => {
    const key = gpsQueueKey(trip.ownerId, trip.manifiestoId);
    const original = Storage.prototype.setItem;
    const unavailable = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
      if (name === key) throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, name, value);
    });
    vi.mocked(manifiestoService.actualizarUbicacion).mockRejectedValue(new Error('offline'));
    const first = renderHook(() => useGPSTracking(trip));
    act(() => watchSuccess[0](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(first.result.current.storageError).toBe(true);
    expect(first.result.current.pendingCount).toBe(1);
    expect(localStorage.getItem(key)).toBeNull();
    first.unmount();
    const reopened = renderHook(() => useGPSTracking(trip));
    await act(async () => {});
    expect(reopened.result.current.storageError).toBe(true);
    expect(reopened.result.current.pendingCount).toBe(1);
    unavailable.mockRestore();
    vi.mocked(manifiestoService.actualizarUbicacion).mockResolvedValue(undefined);
    await act(async () => { await reopened.result.current.retryGps(); await Promise.resolve(); });
    expect(reopened.result.current.storageError).toBe(false);
    expect(reopened.result.current.pendingCount).toBe(0);
    expect(localStorage.getItem(key)).toBeNull();
    reopened.unmount();
  });

  it('preserves unreadable GPS data and blocks transitions until it can be reviewed', async () => {
    const key = gpsQueueKey(trip.ownerId, trip.manifiestoId);
    localStorage.setItem(key, '{bad json');
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    await act(async () => {});
    expect(result.current.storageError).toBe(true);
    act(() => watchSuccess[0](position()));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); await result.current.stopAndDrain(); });
    let ready = true;
    await act(async () => { ready = await result.current.flushPending(); });
    expect(ready).toBe(false);
    expect(manifiestoService.actualizarUbicacion).not.toHaveBeenCalled();
    expect(localStorage.getItem(key)).toBe('{bad json');
    unmount();
  });

  it('keeps the newest 500 visual points while preserving existing unsent GPS data', async () => {
    const pending = { lat: -32, lng: -68, speed: null, heading: null };
    const key = gpsQueueKey(trip.ownerId, trip.manifiestoId);
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
