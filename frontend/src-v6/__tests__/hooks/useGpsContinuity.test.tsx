import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGPSTracking } from '../../hooks/useGPSTracking';
import { useFleetGps, type FleetGpsTarget } from '../../hooks/useFleetGps';
import { manifiestoService } from '../../services/manifiesto.service';
import api from '../../services/api';
import { gpsQueueKey } from '../../services/gpsQueue';
import { readFleetGpsPoints } from '../../services/fleetGpsStorage';
import { installMockGpsLocks } from '../utils/mockGpsLocks';

vi.mock('../../services/manifiesto.service', () => ({ manifiestoService: { actualizarUbicacion: vi.fn() } }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../components/ui/Toast', () => ({ toast: { add: vi.fn().mockReturnValue('qa-notice'), error: vi.fn(), warning: vi.fn(), remove: vi.fn() } }));
vi.mock('../../utils/supportSession', () => ({ supportRequestContext: () => 'qa-session', supportSessionMatches: () => true }));

let locate: PositionCallback;
let restoreLocks: () => void;
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const fix = (latitude: number): GeolocationPosition => ({
  coords: { latitude, longitude: -69, accuracy: 10, speed: null, heading: null, altitude: null, altitudeAccuracy: null },
  timestamp: Date.now(),
} as GeolocationPosition);
const trip = { ownerId: 'qa-owner', manifiestoId: 'qa-trip-continuity', estado: 'EN_TRANSITO', viajeStatus: 'ACTIVO' as const };

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-02T12:00:00Z')); vi.resetAllMocks(); localStorage.clear();
  restoreLocks = installMockGpsLocks();
  vi.mocked(navigator.geolocation.watchPosition).mockImplementation(success => { locate = success; return 1; });
  vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(() => {});
  vi.mocked(manifiestoService.actualizarUbicacion).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  vi.mocked(api.get).mockImplementation(async (url) => {
    const puntoId = decodeURIComponent(String(url).split('/').at(-2)!);
    return { data: { success: true, data: { idempotencia: { version: 1, puntoId, confirmado: false }, tracking: null } } } as any;
  });
});
afterEach(() => { restoreLocks(); vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); });

it('continues with a fresh single-trip fix while retaining an older unconfirmed point', async () => {
  const hook = renderHook(() => useGPSTracking(trip));
  try {
    act(() => locate(fix(-32)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(1);
    act(() => locate(fix(-33)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(2);
    expect(manifiestoService.actualizarUbicacion).toHaveBeenLastCalledWith(trip.manifiestoId, -33, -69, null, null, expect.any(String));
    const pending = JSON.parse(localStorage.getItem(gpsQueueKey(trip.ownerId, trip.manifiestoId))!);
    expect(pending).toEqual([expect.objectContaining({ lat: -32 })]);
    expect(hook.result.current.pendingCount).toBe(1);
    expect(hook.result.current.sendError).toMatch(/ubicación anterior/i);
    await act(async () => { await hook.result.current.stopAndDrain(); });
    let completed = true;
    await act(async () => { completed = await hook.result.current.flushPending(); });
    expect(completed).toBe(false);
    expect(JSON.parse(localStorage.getItem(gpsQueueKey(trip.ownerId, trip.manifiestoId))!)).toEqual(pending);
  } finally { hook.unmount(); }
});

it('does not send a newer single-trip fix after an authorization failure', async () => {
  vi.mocked(api.get).mockRejectedValue({ response: { status: 403 } });
  const hook = renderHook(() => useGPSTracking(trip));
  try {
    act(() => locate(fix(-32)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    act(() => locate(fix(-33)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(gpsQueueKey(trip.ownerId, trip.manifiestoId))!)).toHaveLength(2);
  } finally { hook.unmount(); }
});

it.each(['older server', 'malformed receipt'] as const)('keeps the queue blocked when the %s cannot prove an absence', async reason => {
  if (reason === 'older server') vi.mocked(api.get).mockRejectedValue({ response: { status: 404 } });
  else vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: { tracking: null } } } as any);
  const hook = renderHook(() => useGPSTracking(trip));
  try {
    act(() => locate(fix(-32)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    act(() => locate(fix(-33)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(manifiestoService.actualizarUbicacion).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(gpsQueueKey(trip.ownerId, trip.manifiestoId))!)).toHaveLength(2);
  } finally { hook.unmount(); }
});

it.each(['MANIFIESTO', 'RELEVO'] as const)('continues fresh fleet GPS for %s while preserving an unconfirmed older point', async kind => {
  const key = JSON.stringify(['qa-owner', `${kind}:qa-load`]);
  const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const verify = vi.fn().mockResolvedValue(false);
  const target: FleetGpsTarget = { key, lockId: kind === 'RELEVO' ? 'relevo:qa-load' : 'qa-load', send, verify,
    ...(kind === 'RELEVO' ? { prepareCapability: async () => '00000000-0000-4000-8000-000000000001' } : {}) };
  const hook = renderHook(() => useFleetGps([target], true));
  try {
    await act(async () => { locate(fix(-32)); await flush(); });
    expect(send).toHaveBeenCalledTimes(1);
    const original = readFleetGpsPoints(key);
    expect(original).toHaveLength(1);
    vi.setSystemTime(Date.now() + 61_000);
    await act(async () => { locate(fix(-33)); await flush(); });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toEqual(expect.objectContaining({ latitud: -33 }));
    expect(readFleetGpsPoints(key)).toEqual(original);
    expect(hook.result.current.deliveries[key]).toMatchObject({ state: 'error', saved: true });
    await expect(hook.result.current.holdAndDrain(key)).rejects.toThrow(/ubicación pendiente/i);
  } finally { hook.unmount(); }
});

it.each([403, 404] as const)('does not continue fleet GPS when receipt verification returns %s', async status => {
  const key = JSON.stringify(['qa-owner', 'MANIFIESTO:qa-denied']);
  const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const verify = vi.fn().mockRejectedValue({ response: { status } });
  const hook = renderHook(() => useFleetGps([{ key, lockId: 'qa-denied', send, verify }], true));
  try {
    await act(async () => { locate(fix(-32)); await flush(); });
    const original = readFleetGpsPoints(key);
    vi.setSystemTime(Date.now() + 61_000);
    await act(async () => { locate(fix(-33)); await flush(); });
    expect(send).toHaveBeenCalledTimes(1);
    expect(readFleetGpsPoints(key)).toEqual(original);
    expect(hook.result.current.deliveries[key]).toMatchObject({ state: 'error', terminal: true, statusCode: status });
  } finally { hook.unmount(); }
});

it('keeps a denied manifest isolated while a simultaneous relay resumes with a fresh fix', async () => {
  const manifestKey = JSON.stringify(['qa-owner', 'MANIFIESTO:qa-denied']);
  const relayKey = JSON.stringify(['qa-owner', 'RELEVO:qa-allowed']);
  const manifestSend = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const relaySend = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const targets: FleetGpsTarget[] = [
    { key: manifestKey, lockId: 'qa-denied', send: manifestSend, verify: vi.fn().mockRejectedValue({ response: { status: 403 } }) },
    { key: relayKey, lockId: 'relevo:qa-allowed', send: relaySend, verify: vi.fn().mockResolvedValue(false),
      prepareCapability: async () => '00000000-0000-4000-8000-000000000001' },
  ];
  const hook = renderHook(() => useFleetGps(targets, true));
  try {
    await act(async () => { locate(fix(-32)); await flush(); });
    const manifestOriginal = readFleetGpsPoints(manifestKey), relayOriginal = readFleetGpsPoints(relayKey);
    expect(manifestOriginal).toHaveLength(1);
    expect(relayOriginal).toHaveLength(1);
    vi.setSystemTime(Date.now() + 61_000);
    await act(async () => { locate(fix(-33)); await flush(); });
    expect(manifestSend).toHaveBeenCalledTimes(1);
    expect(relaySend).toHaveBeenCalledTimes(2);
    expect(relaySend.mock.calls[1][0]).toEqual(expect.objectContaining({ latitud: -33 }));
    expect(readFleetGpsPoints(manifestKey)).toEqual(manifestOriginal);
    expect(readFleetGpsPoints(relayKey)).toEqual(relayOriginal);
  } finally { hook.unmount(); }
});
