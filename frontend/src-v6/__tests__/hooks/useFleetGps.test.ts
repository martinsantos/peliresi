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

it('does not replace a newer observation with a late older GPS callback', async () => {
  const send = vi.fn().mockResolvedValue({}), now = Date.now();
  const hook = renderHook(() => useFleetGps([{ key: 'a', send }], true));
  const fix = (lat: number, timestamp: number) => ({ ...position(), coords: { ...position().coords, latitude: lat }, timestamp } as GeolocationPosition);
  await act(async () => { locate(fix(-33, now)); await flush(); });
  vi.setSystemTime(now + 30_000);
  await act(async () => { locate(fix(-34, now - 1_000)); await flush(); });
  expect(hook.result.current.position?.latitud).toBe(-33);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls.some(([point]) => point.latitud === -34)).toBe(false);
  hook.unmount();
});

it('does not resend an already received fix without a new sensor observation', async () => {
  const send = vi.fn().mockResolvedValue({});
  const hook = renderHook(() => useFleetGps([{ key: 'a', send }], true));
  await act(async () => { locate(position()); await flush(); });
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); await flush(); });
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => { locate(position()); await flush(); });
  expect(send).toHaveBeenCalledTimes(2);
  hook.unmount();
});

it('retries a failed fix instead of treating it as received', async () => {
  const send = vi.fn().mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue({});
  const hook = renderHook(() => useFleetGps([{ key: 'a', send }], true));
  await act(async () => { locate(position()); await flush(); });
  expect(hook.result.current.deliveries.a.state).toBe('error');
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); await flush(); });
  expect(send).toHaveBeenCalledTimes(2);
  expect(hook.result.current.deliveries.a.state).toBe('received');
  hook.unmount();
});

it('reuses a stable reference when an acknowledged fleet upload loses its response', async () => {
  const a = vi.fn((..._args: any[]) => Promise.resolve()).mockRejectedValueOnce(new Error('Respuesta perdida'));
  const b = vi.fn((..._args: any[]) => Promise.resolve());
  const hook = renderHook(() => useFleetGps([{ key: 'a', send: a }, { key: 'b', send: b }], true));
  await act(async () => { locate(position()); await flush(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); await flush(); });
  expect(a).toHaveBeenCalledTimes(2);
  const first = a.mock.calls[0][1], retry = a.mock.calls[1][1], other = b.mock.calls[0][1];
  expect(first).toMatch(/^[0-9a-f-]{36}$/i);
  expect(retry).toBe(first);
  expect(other).toMatch(/^[0-9a-f-]{36}$/i);
  expect(other).not.toBe(first);
  hook.unmount();
});

it('retains a failed observation through a newer fix and blocks delivery until it is confirmed', async () => {
  const a = vi.fn((..._args: any[]) => Promise.resolve()).mockRejectedValueOnce(new Error('Sin conexión'));
  const b = vi.fn((..._args: any[]) => Promise.resolve());
  const hook = renderHook(() => useFleetGps([{ key: 'a', send: a }, { key: 'b', send: b }], true));
  await act(async () => { locate(position()); await flush(); });
  const [original, reference] = a.mock.calls[0];
  await act(async () => { vi.setSystemTime(Date.now() + 30_000); locate({ ...position(), coords: { ...position().coords, latitude: -34 } } as GeolocationPosition); await flush(); });
  expect(a).toHaveBeenCalledTimes(2);
  expect(a.mock.calls[1]).toEqual([original, reference]);
  expect(b).toHaveBeenCalledTimes(2);
  await expect(hook.result.current.holdAndDrain('a')).resolves.toBeUndefined();
  hook.unmount();
});

it('does not deliver after a failed upload or replay an expired fix as current', async () => {
  const a = vi.fn().mockRejectedValue(new Error('Sin conexión'));
  const b = vi.fn().mockResolvedValue({});
  const hook = renderHook(() => useFleetGps([{ key: 'a', send: a }, { key: 'b', send: b }], true));
  await act(async () => { locate(position()); await flush(); });
  await expect(hook.result.current.holdAndDrain('a')).rejects.toThrow(/ubicación pendiente sin confirmar/i);
  await act(async () => { hook.result.current.resume('a'); await flush(); });
  vi.setSystemTime(Date.now() + 70_000);
  await act(async () => { locate(position()); await flush(); });
  expect(a).toHaveBeenCalledTimes(2); // The immediate retry was still fresh.
  expect(b).toHaveBeenCalledTimes(2);
  expect(hook.result.current.deliveries.a.message).toMatch(/no se reenviará como ubicación actual/i);
  await expect(hook.result.current.holdAndDrain('a')).rejects.toThrow(/ubicación pendiente/i);
  hook.unmount();
});

it('waits for an in-flight failure and warns before closing with an unconfirmed point', async () => {
  let reject!: (error: Error) => void;
  const send=vi.fn(()=>new Promise<void>((_, fail)=>{reject=fail;}));
  const hook=renderHook(()=>useFleetGps([{key:'a',send}],true));
  await act(async()=>{locate(position());await flush();});
  const closing=new Event('beforeunload',{cancelable:true});
  window.dispatchEvent(closing); expect(closing.defaultPrevented).toBe(true);
  const held=hook.result.current.holdAndDrain('a');
  const rejected=expect(held).rejects.toThrow(/ubicación pendiente/i);
  await act(async()=>{reject(new Error('Respuesta perdida'));await rejected;await flush();});
  hook.unmount();
});

it('continues sending new observations after the device clock is corrected backwards', async () => {
  const send = vi.fn().mockResolvedValue({}), now = Date.now();
  const hook = renderHook(() => useFleetGps([{ key: 'a', send }], true));
  await act(async () => { locate(position()); await flush(); });
  vi.setSystemTime(now - 60_000);
  await act(async () => { locate(position()); await flush(); });
  expect(send).toHaveBeenCalledTimes(2);
  hook.unmount();
});

it('starts only when enabled and stops on disabled sessions or denied permission', async () => {
  const send = vi.fn().mockResolvedValue({});
  const hook = renderHook(({ enabled }) => useFleetGps([{ key: 'a', send }], enabled), { initialProps: { enabled: false } });
  expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();
  act(() => hook.result.current.retryLocation());
  expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();
  hook.rerender({ enabled: true });
  await act(async () => { fail({ code: 1 } as GeolocationPositionError); locate(position()); await flush(); });
  expect(send).not.toHaveBeenCalled();
  hook.rerender({ enabled: false }); expect(clearWatch).toHaveBeenCalledWith(17);
  hook.unmount();
});

it('retries denied location in one action, replaces the watcher and ignores its old callbacks', async () => {
  const a = vi.fn().mockResolvedValue({}), b = vi.fn().mockResolvedValue({});
  const hook = renderHook(() => useFleetGps([{ key: 'a', send: a }, { key: 'b', send: b }], true));
  const oldLocate = locate, oldFail = fail;
  await act(async () => { fail({ code: 1 } as GeolocationPositionError); await flush(); });
  expect(hook.result.current.status).toBe('denied'); expect(a).not.toHaveBeenCalled(); expect(b).not.toHaveBeenCalled();
  act(() => hook.result.current.retryLocation());
  expect(clearWatch).toHaveBeenCalledOnce(); expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(2);
  await act(async () => { oldLocate(position()); oldFail({ code: 1 } as GeolocationPositionError); await flush(); });
  expect(hook.result.current.status).toBe('acquiring'); expect(a).not.toHaveBeenCalled(); expect(b).not.toHaveBeenCalled();
  await act(async () => { locate(position()); await flush(); });
  expect(a).toHaveBeenCalledOnce(); expect(b).toHaveBeenCalledOnce(); expect(hook.result.current.status).toBe('active');
  hook.unmount(); expect(clearWatch).toHaveBeenCalledTimes(2);
});

it('requires a fresh observation after retry and keeps a handed-off load blocked', async () => {
  const a = vi.fn().mockRejectedValue(Object.assign(new Error('El tramo cambió'), { status: 409 })), b = vi.fn().mockResolvedValue({});
  const hook = renderHook(() => useFleetGps([{ key: 'a', send: a }, { key: 'b', send: b }], true));
  await act(async () => { locate(position()); await flush(); fail({ code: 1 } as GeolocationPositionError); });
  expect(hook.result.current.deliveries.a).toMatchObject({ terminal: true, statusCode: 409 });
  act(() => hook.result.current.retryLocation());
  await act(async () => { vi.advanceTimersByTime(30000); await flush(); });
  expect(a).toHaveBeenCalledOnce(); expect(b).toHaveBeenCalledOnce();
  await act(async () => { locate(position()); await flush(); });
  expect(a).toHaveBeenCalledOnce(); expect(b).toHaveBeenCalledTimes(2);
  expect(hook.result.current.deliveries.a).toMatchObject({ terminal: true, statusCode: 409 });
  expect(hook.result.current.deliveries.b.state).toBe('received');
  hook.unmount();
});
