import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGPSTracking } from '../../hooks/useGPSTracking';
import { manifiestoService } from '../../services/manifiesto.service';
import { toast } from '../../components/ui/Toast';
import { GPS_DELIVERY_CONFIRMED_EVENT, GpsPendingError, gpsQueueKey } from '../../services/gpsQueue';
import { installMockGpsLocks } from '../utils/mockGpsLocks';

vi.mock('../../services/manifiesto.service', () => ({ manifiestoService: { actualizarUbicacion: vi.fn() } }));
vi.mock('../../components/ui/Toast', () => ({ toast: { error: vi.fn(), warning: vi.fn(), remove: vi.fn() } }));

const position = (latitude = -33, longitude = -69): GeolocationPosition => ({
  coords: { latitude, longitude, accuracy: 10, speed: null, heading: null, altitude: null, altitudeAccuracy: null },
  timestamp: Date.now(),
} as GeolocationPosition);
const error = (code: number) => ({ code, message: 'GPS test failure' } as GeolocationPositionError);
const trip = { ownerId: 'carrier-a', manifiestoId: 'gps-safety-trip', estado: 'EN_TRANSITO', viajeStatus: 'ACTIVO' as const };
const withReference = <T extends object>(point: T) => ({ ...point, puntoId: expect.any(String) });
let watchSuccess: PositionCallback[];
let watchError: PositionErrorCallback[];
let coarseSuccess: PositionCallback[];
let coarseError: PositionErrorCallback[];
let restoreLocks: () => void;

describe('GPS position provenance and cleanup', () => {
  beforeEach(() => {
    restoreLocks = installMockGpsLocks();
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
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); restoreLocks(); });

  it('reports a denied GPS permission as state without repeating it in a toast', () => {
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchError[0](error(1)));
    expect(result.current.status).toBe('denied');
    expect(toast.error).not.toHaveBeenCalled();
    unmount();
  });

  it('does not start the watcher if this browser cannot coordinate other pages', () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.sendError).toMatch(/navegador.*coordinar/i);
    unmount();
  });

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
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledExactlyOnceWith(trip.manifiestoId, -34, -70, null, null, expect.any(String));
    unmount();
  });

  it('ignores an old coarse response after pause and resume without suppressing the new GPS fix', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ viajeStatus }: { viajeStatus: 'ACTIVO' | 'PAUSADO' }) => useGPSTracking({ ...trip, viajeStatus }),
      { initialProps: { viajeStatus: 'ACTIVO' } },
    );
    rerender({ viajeStatus: 'PAUSADO' });
    rerender({ viajeStatus: 'ACTIVO' });
    await act(async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); });
    act(() => watchSuccess[1](position(-34, -70)));
    act(() => coarseSuccess[0](position(-31, -67)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.position).toEqual([-34, -70]);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledExactlyOnceWith(trip.manifiestoId, -34, -70, null, null, expect.any(String));
    unmount();
  });

  it('does not replace a newer watch fix with an older coarse response from the same watcher', async () => {
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    const now = Date.now();
    act(() => watchSuccess[0]({ ...position(-34, -70), timestamp: now }));
    act(() => coarseSuccess[0]({ ...position(-31, -67), timestamp: now - 1_000 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.position).toEqual([-34, -70]);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledExactlyOnceWith(trip.manifiestoId, -34, -70, null, null, expect.any(String));
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
    expect(manifiestoService.actualizarUbicacion).toHaveBeenLastCalledWith(trip.manifiestoId, -34, -70, null, null, expect.any(String));
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('retries a denied individual trip in one action without sending a stale position', async () => {
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchSuccess[0](position(-32, -68)));
    act(() => watchError[0](error(1)));
    expect(result.current.status).toBe('denied');
    await act(async () => { await result.current.retryGps(); });
    expect(navigator.geolocation.clearWatch).toHaveBeenCalledWith(1);
    expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).not.toHaveBeenCalled();
    act(() => { watchSuccess[0](position(-31, -67)); watchSuccess[1](position(-34, -70)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.position).toEqual([-34, -70]);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledExactlyOnceWith(trip.manifiestoId, -34, -70, null, null, expect.any(String));
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
    expect(manifiestoService.actualizarUbicacion).toHaveBeenLastCalledWith(trip.manifiestoId, -33, -69, null, null, expect.any(String));
    const calls = vi.mocked(manifiestoService.actualizarUbicacion).mock.calls;
    expect(calls[0][5]).toBe(calls[1][5]); expect(calls[1][5]).toBe(calls[2][5]);
    expect(calls[3][5]).not.toBe(calls[0][5]);
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
    expect(JSON.parse(localStorage.getItem(gpsQueueKey(trip.ownerId, trip.manifiestoId))!)).toEqual([withReference({ lat:-34, lng:-70, speed:null, heading:null })]);
    unmount();
  });

  it('preserves the latest fix when tracking stops before its next timed send', async () => {
    const key = gpsQueueKey(trip.ownerId, trip.manifiestoId);
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchSuccess[0](position(-34, -70)));
    await act(async () => { await result.current.stopAndDrain(); });
    const pending = JSON.parse(localStorage.getItem(key)!);
    expect(pending).toEqual([withReference({ lat:-34, lng:-70, speed:null, heading:null })]);
    expect(manifiestoService.actualizarUbicacion).not.toHaveBeenCalled();
    let flushed = false;
    await act(async () => { flushed = await result.current.flushPending(); });
    expect(flushed).toBe(true);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledExactlyOnceWith(trip.manifiestoId, -34, -70, null, null, pending[0].puntoId);
    expect(localStorage.getItem(key)).toBeNull();
    unmount();
  });

  it('stores the observation before its first request and retries the same reference after a lost response', async () => {
    const key = gpsQueueKey(trip.ownerId, trip.manifiestoId);
    let storedDuringRequest: any;
    vi.mocked(manifiestoService.actualizarUbicacion).mockImplementationOnce(async () => {
      storedDuringRequest = JSON.parse(localStorage.getItem(key)!)[0];
      throw new Error('response lost');
    });
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchSuccess[0](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    const calls = vi.mocked(manifiestoService.actualizarUbicacion).mock.calls;
    expect(storedDuringRequest.puntoId).toBe(calls[0][5]);
    expect(result.current.pendingCount).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(calls[1][5]).toBe(calls[0][5]);
    expect(calls).toHaveLength(2);
    expect(localStorage.getItem(key)).toBeNull();
    act(() => watchSuccess[0](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(calls[2][5]).not.toBe(calls[0][5]);
    unmount();
  });

  it('keeps an actionable server error visible when restoring an older queued point fails', async () => {
    const key = gpsQueueKey(trip.ownerId, trip.manifiestoId);
    localStorage.setItem(key, JSON.stringify([{ lat:-32, lng:-68, speed:null, heading:null }]));
    const message = 'No se pudo verificar el viaje o el servidor. Actualizá la pantalla y, si persiste, contactá a soporte.';
    vi.mocked(manifiestoService.actualizarUbicacion).mockRejectedValueOnce(new GpsPendingError(message));
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.sendStatus).toBe('error');
    expect(result.current.sendError).toBe(message);
    expect(result.current.pendingCount).toBe(1);
    unmount();
  });

  it.each([
    [401, 'No se pudo verificar tu sesión. Volvé a ingresar y retomá la sincronización.'],
    [403, 'Tu cuenta no tiene permiso para enviar ubicaciones de este viaje. Contactá a soporte.'],
  ])('explains GPS upload error %s without losing the point', async (status, message) => {
    vi.mocked(manifiestoService.actualizarUbicacion).mockRejectedValueOnce({ response: { status } });
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchSuccess[0](position()));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.sendError).toBe(message);
    expect(result.current.pendingCount).toBe(1);
    expect(JSON.parse(localStorage.getItem(gpsQueueKey(trip.ownerId, trip.manifiestoId))!)).toHaveLength(1);
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
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(1);
    act(() => watchSuccess[0](position()));
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
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledExactlyOnceWith('gps-trip-b', -34, -70, null, null, expect.any(String));
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
    const savedA = JSON.parse(localStorage.getItem(gpsQueueKey(trip.ownerId, 'gps-trip-a'))!);
    expect(savedA).toEqual([withReference({ lat:-33, lng:-69, speed:null, heading:null })]);
    expect(localStorage.getItem(gpsQueueKey(trip.ownerId, 'gps-trip-b'))).toBeNull();
    act(() => watchSuccess[1](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(4);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenLastCalledWith('gps-trip-b', -34, -70, null, null, expect.any(String));
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
    await act(async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); });
    expect(result.current.position).toBeNull();
    expect(result.current.pendingCount).toBe(0);
    expect(localStorage.getItem(gpsQueueKey('carrier-a', trip.manifiestoId))).not.toBeNull();
    expect(localStorage.getItem(gpsQueueKey('carrier-b', trip.manifiestoId))).toBeNull();
    act(() => watchSuccess[1](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenLastCalledWith(trip.manifiestoId, -34, -70, null, null, expect.any(String));
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
    await act(async () => { acknowledge(); for (let i = 0; i < 20; i++) await Promise.resolve(); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(4);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenLastCalledWith(trip.manifiestoId, -33, -69, null, null, expect.any(String));
    const calls = vi.mocked(manifiestoService.actualizarUbicacion).mock.calls;
    expect(calls[0][5]).toBe(calls[1][5]); expect(calls[1][5]).toBe(calls[2][5]);
    expect(calls[3][5]).not.toBe(calls[0][5]);
    expect(reopened.result.current.pendingCount).toBe(0);
    expect(localStorage.getItem(gpsQueueKey(trip.ownerId, trip.manifiestoId))).toBeNull();
    reopened.unmount();
  });

  it('preserves an observation appended by another tab while a saved point is being acknowledged', async () => {
    const key = gpsQueueKey(trip.ownerId, trip.manifiestoId);
    const first = { lat:-32, lng:-68, speed:null, heading:null, puntoId:'11111111-1111-4111-8111-111111111111' };
    const other = { lat:-33, lng:-69, speed:null, heading:null, puntoId:'22222222-2222-4222-8222-222222222222' };
    localStorage.setItem(key, JSON.stringify([first]));
    let acknowledge!: () => void;
    vi.mocked(manifiestoService.actualizarUbicacion).mockImplementationOnce(() => new Promise<void>(resolve => { acknowledge = resolve; }));
    const { unmount } = renderHook(() => useGPSTracking(trip));
    await act(async () => { await Promise.resolve(); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(1);
    localStorage.setItem(key, JSON.stringify([first, other]));
    await act(async () => { acknowledge(); await Promise.resolve(); });
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([other]);
    unmount();
  });

  it('preserves another tab’s queued observation when a live upload is acknowledged', async () => {
    const key = gpsQueueKey(trip.ownerId, trip.manifiestoId);
    const other = { lat:-33, lng:-69, speed:null, heading:null, puntoId:'22222222-2222-4222-8222-222222222222' };
    let acknowledge!: () => void;
    vi.mocked(manifiestoService.actualizarUbicacion).mockImplementationOnce(() => new Promise<void>(resolve => { acknowledge = resolve; }));
    const { unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchSuccess[0](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    const current = JSON.parse(localStorage.getItem(key)!);
    expect(current).toHaveLength(1);
    localStorage.setItem(key, JSON.stringify([...current, other]));
    await act(async () => { acknowledge(); await Promise.resolve(); });
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([other]);
    unmount();
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([other]);
  });

  it('does not replace another tab’s pending observations when GPS stops', async () => {
    const key = gpsQueueKey(trip.ownerId, trip.manifiestoId);
    const other = { lat:-33, lng:-69, speed:null, heading:null, puntoId:'22222222-2222-4222-8222-222222222222' };
    let acknowledge!: () => void;
    vi.mocked(manifiestoService.actualizarUbicacion).mockImplementationOnce(() => new Promise<void>(resolve => { acknowledge = resolve; }));
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    act(() => watchSuccess[0](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    const current = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key, JSON.stringify([...current, other]));
    act(() => result.current.cleanupGps());
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([...current, other]);
    await act(async () => { acknowledge(); await Promise.resolve(); });
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([other]);
    unmount();
  });

  it('reads a point added by another tab before queuing a new observation', async () => {
    const key = gpsQueueKey(trip.ownerId, trip.manifiestoId);
    const other = { lat:-33, lng:-69, speed:null, heading:null, puntoId:'22222222-2222-4222-8222-222222222222' };
    const { unmount } = renderHook(() => useGPSTracking(trip));
    localStorage.setItem(key, JSON.stringify([other]));
    act(() => watchSuccess[0](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    const calls = vi.mocked(manifiestoService.actualizarUbicacion).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual([trip.manifiestoId, -33, -69, null, null, other.puntoId]);
    expect(calls[1]).toEqual([trip.manifiestoId, -34, -70, null, null, expect.any(String)]);
    expect(localStorage.getItem(key)).toBeNull();
    unmount();
  });

  it('does not confirm a transition while a newly appended observation remains unsent', async () => {
    const key = gpsQueueKey(trip.ownerId, trip.manifiestoId);
    const first = { lat:-32, lng:-68, speed:null, heading:null, puntoId:'11111111-1111-4111-8111-111111111111' };
    const other = { lat:-33, lng:-69, speed:null, heading:null, puntoId:'22222222-2222-4222-8222-222222222222' };
    localStorage.setItem(key, JSON.stringify([first]));
    let acknowledge!: () => void;
    vi.mocked(manifiestoService.actualizarUbicacion)
      .mockRejectedValueOnce(new Error('offline initially'))
      .mockImplementationOnce(() => new Promise<void>(resolve => { acknowledge = resolve; }))
      .mockRejectedValueOnce(new Error('new point still offline'));
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await result.current.stopAndDrain(); });
    let ready!: Promise<boolean>;
    act(() => { ready = result.current.flushPending(); });
    await act(async () => { await Promise.resolve(); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(2);
    localStorage.setItem(key, JSON.stringify([first, other]));
    let completed = true;
    await act(async () => { acknowledge(); completed = await ready; });
    expect(completed).toBe(false);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenLastCalledWith(trip.manifiestoId, -33, -69, null, null, other.puntoId);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([other]);
    unmount();
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
    await act(async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); });
    act(() => watchSuccess[0](position(-34, -70)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.pendingCount).toBe(501);
    const saved = JSON.parse(localStorage.getItem(key)!);
    expect(saved).toEqual([...pending.map(withReference), withReference({ lat: -34, lng: -70, speed: null, heading: null })]);
    expect(new Set(saved.map((item: { puntoId: string }) => item.puntoId)).size).toBe(501);
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
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([withReference(second)]);
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
    await act(async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); });
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

  it('explains that an unowned legacy queue needs support before a transition', async () => {
    const legacy = `gps_pending_${trip.manifiestoId}`;
    localStorage.setItem(legacy, JSON.stringify([{ lat:-32, lng:-68, speed:null, heading:null }]));
    const { result, unmount } = renderHook(() => useGPSTracking(trip));
    await act(async () => { await result.current.stopAndDrain(); });
    let ready = true;
    await act(async () => { ready = await result.current.flushPending(); });
    expect(ready).toBe(false);
    expect(result.current.lastSendError()).toMatch(/sin titular identificado.*soporte/i);
    expect(localStorage.getItem(legacy)).not.toBeNull();
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
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([withReference(pending)]);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.pendingCount).toBe(2);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([withReference(pending), withReference({ lat: -33 + 619 / 10_000, lng: -69, speed: null, heading: null })]);
    unmount();
  });
});
