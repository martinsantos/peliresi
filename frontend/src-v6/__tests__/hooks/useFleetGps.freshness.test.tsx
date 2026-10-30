import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useFleetGps, type FleetGpsTarget } from '../../hooks/useFleetGps';
import { readFleetGpsPoints } from '../../services/fleetGpsStorage';
import { installMockGpsLocks } from '../utils/mockGpsLocks';

let locate: PositionCallback;
let restoreLocks: () => void;
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const fix = () => ({ coords: { latitude: -32.9, longitude: -68.8, accuracy: 10, speed: 0, heading: null }, timestamp: Date.now() }) as GeolocationPosition;
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };

beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear();
  vi.stubGlobal('navigator', { geolocation: { watchPosition: (ok: PositionCallback) => { locate = ok; return 17; }, clearWatch: vi.fn() } });
  restoreLocks = installMockGpsLocks();
});
afterEach(() => { restoreLocks(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });

it('does not send a location that expired while checking for a pending delivery', async () => {
  const wait = deferred(), send = vi.fn().mockResolvedValue({});
  const key = JSON.stringify(['qa-scope', 'MANIFIESTO:qa-trip']);
  const target: FleetGpsTarget = { key, lockId: 'qa-trip', beforeSend: () => wait.promise, send };
  const hook = renderHook(() => useFleetGps([target], true));
  try {
    await act(async () => { locate(fix()); await flush(); });
    expect(send).not.toHaveBeenCalled();
    await act(async () => { vi.setSystemTime(Date.now() + 61_000); wait.resolve(); await flush(); });
    expect(send).not.toHaveBeenCalled();
    expect(readFleetGpsPoints(key)).toHaveLength(1);
    expect(hook.result.current.deliveries[key]).toMatchObject({ state: 'error', saved: true });
    await expect(hook.result.current.holdAndDrain(key)).rejects.toThrow(/ubicación pendiente/i);
  } finally { hook.unmount(); }
});

it('does not send a relay location that expired while obtaining authorization', async () => {
  const wait = deferred(), send = vi.fn().mockResolvedValue({});
  const key = JSON.stringify(['qa-scope', 'RELEVO:qa-leg']);
  const target: FleetGpsTarget = { key, lockId: 'relevo:qa-leg', prepareCapability: async () => { await wait.promise; return '00000000-0000-4000-8000-000000000001'; }, send };
  const hook = renderHook(() => useFleetGps([target], true));
  try {
    await act(async () => { locate(fix()); await flush(); });
    expect(readFleetGpsPoints(key)).toHaveLength(1);
    await act(async () => { vi.setSystemTime(Date.now() + 61_000); wait.resolve(); await flush(); });
    expect(send).not.toHaveBeenCalled();
    expect(readFleetGpsPoints(key)).toHaveLength(1);
    expect(hook.result.current.deliveries[key]).toMatchObject({ state: 'error', saved: true });
  } finally { hook.unmount(); }
});

it('does not start a GPS request after the screen stopped while a check was pending', async () => {
  const wait = deferred(), send = vi.fn().mockResolvedValue({});
  const key = JSON.stringify(['qa-scope', 'MANIFIESTO:qa-stopped']);
  const target: FleetGpsTarget = { key, lockId: 'qa-stopped', beforeSend: () => wait.promise, send };
  const hook = renderHook(() => useFleetGps([target], true));
  await act(async () => { locate(fix()); await flush(); });
  hook.unmount();
  await act(async () => { wait.resolve(); await flush(); });
  expect(send).not.toHaveBeenCalled();
  expect(readFleetGpsPoints(key)).toHaveLength(1);
});

it('does not present a late confirmation as a recent GPS update', async () => {
  const wait = deferred(), send = vi.fn(() => wait.promise);
  const key = JSON.stringify(['qa-scope', 'MANIFIESTO:qa-late']);
  const hook = renderHook(() => useFleetGps([{ key, lockId: 'qa-late', send }], true));
  try {
    await act(async () => { locate(fix()); await flush(); });
    expect(send).toHaveBeenCalledOnce();
    await act(async () => { vi.setSystemTime(Date.now() + 61_000); wait.resolve(); await flush(); });
    expect(hook.result.current.deliveries[key].state).toBe('verified');
    expect(hook.result.current.deliveries[key].receivedAt).toBeUndefined();
    expect(readFleetGpsPoints(key)).toHaveLength(0);
  } finally { hook.unmount(); }
});
