import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useFleetGps, type FleetGpsTarget } from '../../hooks/useFleetGps';

let locate: PositionCallback;
let fail: PositionErrorCallback;
const clearWatch = vi.fn();
const position = (age = 0) => ({
  coords: { latitude: -32.9, longitude: -68.8, accuracy: 10, speed: 0, heading: null },
  timestamp: Date.now() - age,
}) as GeolocationPosition;
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

beforeEach(() => {
  vi.useFakeTimers(); clearWatch.mockClear();
  vi.stubGlobal('navigator', { geolocation: {
    watchPosition: vi.fn((ok: PositionCallback, error: PositionErrorCallback) => { locate = ok; fail = error; return 17; }), clearWatch,
  } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('uses one watcher for explicitly chosen loads and preserves it when the selection changes', async () => {
  const a = vi.fn().mockResolvedValue({}), b = vi.fn().mockResolvedValue({}), c = vi.fn().mockResolvedValue({});
  const hook = renderHook(({ targets }) => useFleetGps(targets, true), { initialProps: { targets: [{ key: 'a', send: a }, { key: 'b', send: b }] as FleetGpsTarget[] } });
  await act(async () => { locate(position()); await flush(); });
  expect(a).toHaveBeenCalledOnce(); expect(b).toHaveBeenCalledOnce();
  expect(hook.result.current.deliveries.a.state).toBe('received');
  hook.rerender({ targets: [{ key: 'b', send: b }, { key: 'c', send: c }] });
  await act(flush);
  expect(c).toHaveBeenCalledOnce(); expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce();
  await act(async () => { vi.advanceTimersByTime(30000); locate(position()); await flush(); });
  expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenCalledTimes(2); expect(c).toHaveBeenCalledTimes(2);
  hook.unmount(); expect(clearWatch).toHaveBeenCalledWith(17);
});

it('drains the delivered load while the other load continues to send', async () => {
  let acknowledge!: () => void;
  const a = vi.fn(() => new Promise<void>(resolve => { acknowledge = resolve; })), b = vi.fn().mockResolvedValue({});
  const hook = renderHook(() => useFleetGps([{ key: 'a', send: a }, { key: 'b', send: b }], true));
  await act(async () => { locate(position()); await flush(); });
  let drained = false;
  const hold = hook.result.current.holdAndDrain('a').then(() => { drained = true; });
  expect(drained).toBe(false);
  await act(async () => { acknowledge(); await hold; await flush(); });
  expect(drained).toBe(true); expect(b).toHaveBeenCalledOnce();
  await act(async () => { vi.advanceTimersByTime(30000); locate(position()); await flush(); });
  expect(a).toHaveBeenCalledOnce(); expect(b).toHaveBeenCalledTimes(2);
  hook.unmount();
});

it('isolates a revoked or handed-off load without stopping the other GPS targets', async () => {
  const a = vi.fn().mockRejectedValue(Object.assign(new Error('El tramo cambió'), { status: 409 })), b = vi.fn().mockResolvedValue({});
  const hook = renderHook(() => useFleetGps([{ key: 'a', send: a }, { key: 'b', send: b }], true));
  await act(async () => { locate(position()); await flush(); });
  expect(hook.result.current.deliveries.a).toMatchObject({ state: 'error', terminal: true, statusCode: 409 });
  expect(hook.result.current.deliveries.b.state).toBe('received'); expect(hook.result.current.activeCount).toBe(1);
  await act(async () => { vi.advanceTimersByTime(30000); locate(position()); await flush(); });
  expect(a).toHaveBeenCalledOnce(); expect(b).toHaveBeenCalledTimes(2); expect(clearWatch).not.toHaveBeenCalled();
  a.mockResolvedValue({});
  await act(async () => { hook.result.current.resume('a'); await flush(); });
  expect(a).toHaveBeenCalledTimes(2); expect(hook.result.current.deliveries.a.state).toBe('received');
  hook.unmount();
});

it('never replays stale coordinates or acknowledges a failed upload as received', async () => {
  const send = vi.fn().mockRejectedValue(new Error('Sin conexión'));
  const hook = renderHook(() => useFleetGps([{ key: 'a', send }], true));
  await act(async () => { locate(position(70000)); await flush(); });
  expect(send).not.toHaveBeenCalled();
  await act(async () => { locate(position()); await flush(); });
  expect(hook.result.current.deliveries.a).toMatchObject({ state: 'error', terminal: false });
  expect(hook.result.current.deliveries.a.receivedAt).toBeUndefined();
  // The next upload starts after the last observation has expired.
  vi.setSystemTime(Date.now() + 70000);
  await act(async () => { vi.advanceTimersByTime(30000); await flush(); });
  expect(send).toHaveBeenCalledOnce(); expect(hook.result.current.status).toBe('acquiring');
  hook.unmount();
});

it('starts only when enabled and stops on disabled sessions or denied permission', async () => {
  const send = vi.fn().mockResolvedValue({});
  const hook = renderHook(({ enabled }) => useFleetGps([{ key: 'a', send }], enabled), { initialProps: { enabled: false } });
  expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();
  hook.rerender({ enabled: true });
  await act(async () => { fail({ code: 1 } as GeolocationPositionError); locate(position()); await flush(); });
  expect(send).not.toHaveBeenCalled();
  hook.rerender({ enabled: false }); expect(clearWatch).toHaveBeenCalledWith(17);
  hook.unmount();
});
