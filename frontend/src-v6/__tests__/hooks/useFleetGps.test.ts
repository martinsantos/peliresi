import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useFleetGps, type FleetGpsTarget } from '../../hooks/useFleetGps';
import { withGpsTransitionLock } from '../../services/gpsCoordination';
import { assertNoStoredFleetGpsForManifest,saveFleetGpsPoint } from '../../services/fleetGpsStorage';
import { installMockGpsLocks } from '../utils/mockGpsLocks';

let locate: PositionCallback;
let fail: PositionErrorCallback;
const clearWatch = vi.fn();
const position = (age = 0) => ({
  coords: { latitude: -32.9, longitude: -68.8, accuracy: 10, speed: 0, heading: null },
  timestamp: Date.now() - age,
}) as GeolocationPosition;
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

beforeEach(() => {
  vi.useFakeTimers(); clearWatch.mockClear(); localStorage.clear();
  vi.stubGlobal('navigator', { geolocation: {
    watchPosition: vi.fn((ok: PositionCallback, error: PositionErrorCallback) => { locate = ok; fail = error; return 17; }), clearWatch,
  } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });

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

it('waits for an in-flight failure while preserving the attempted point in storage', async () => {
  let reject!: (error: Error) => void;
  const send=vi.fn(()=>new Promise<void>((_, fail)=>{reject=fail;}));
  const hook=renderHook(()=>useFleetGps([{key:'a',send}],true));
  await act(async()=>{locate(position());await flush();});
  const closing=new Event('beforeunload',{cancelable:true});
  window.dispatchEvent(closing); expect(closing.defaultPrevented).toBe(false);
  const held=hook.result.current.holdAndDrain('a');
  const rejected=expect(held).rejects.toThrow(/ubicación pendiente/i);
  await act(async()=>{reject(new Error('Respuesta perdida'));await rejected;await flush();});
  hook.unmount();
});

it('warns and does not send when the attempted point cannot be saved', async () => {
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
  const send=vi.fn().mockResolvedValue({});
  const hook=renderHook(()=>useFleetGps([{key:'a',send}],true));
  await act(async()=>{locate(position());await flush();});
  expect(send).not.toHaveBeenCalled();
  expect(hook.result.current.deliveries.a.message).toMatch(/almacenamiento/i);
  const closing=new Event('beforeunload',{cancelable:true});
  window.dispatchEvent(closing); expect(closing.defaultPrevented).toBe(true);
  await expect(hook.result.current.holdAndDrain('a')).rejects.toThrow(/ubicación pendiente/i);
  hook.unmount();
});

it('keeps a confirmed point recoverable if its saved record cannot yet be removed', async () => {
  vi.spyOn(Storage.prototype,'removeItem').mockImplementationOnce(()=>{throw new Error('storage unavailable');});
  const send=vi.fn().mockResolvedValue({});
  const hook=renderHook(()=>useFleetGps([{key:'a',send}],true));
  await act(async()=>{locate(position());await flush();});
  expect(send).toHaveBeenCalledOnce();expect(hook.result.current.deliveries.a.saved).toBe(true);expect(localStorage.length).toBe(1);
  const closing=new Event('beforeunload',{cancelable:true});window.dispatchEvent(closing);expect(closing.defaultPrevented).toBe(false);
  await act(async()=>{hook.result.current.resume('a');await flush();});
  expect(send).toHaveBeenCalledTimes(2);expect(send.mock.calls[0][1]).toEqual(send.mock.calls[1][1]);expect(localStorage.length).toBe(0);
  hook.unmount();
});

it('recovers a failed attempted point after the screen is reopened, with the same reference', async () => {
  const failed=vi.fn().mockRejectedValue(new Error('Sin conexión'));
  const first=renderHook(()=>useFleetGps([{key:'account-a:trip',send:failed}],true));
  await act(async()=>{locate(position());await flush();});
  const [point,reference]=failed.mock.calls[0]; first.unmount();
  const send=vi.fn().mockResolvedValue({});
  const reopened=renderHook(()=>useFleetGps([{key:'account-a:trip',send}],true));
  await act(flush);
  expect(send).toHaveBeenCalledWith(point,reference);
  expect(reopened.result.current.deliveries['account-a:trip'].state).toBe('received');
  await expect(reopened.result.current.holdAndDrain('account-a:trip')).resolves.toBeUndefined();
  reopened.unmount();
});

it('does not send the same sensor observation again after recovering it', async () => {
  const fix=position(),failed=vi.fn().mockRejectedValue(new Error('Sin conexión'));
  const first=renderHook(()=>useFleetGps([{key:'a',send:failed}],true));
  await act(async()=>{locate(fix);await flush();});first.unmount();
  const send=vi.fn().mockResolvedValue({});
  const reopened=renderHook(()=>useFleetGps([{key:'a',send}],true));await act(flush);
  expect(send).toHaveBeenCalledOnce();
  await act(async()=>{locate(fix);await vi.advanceTimersByTimeAsync(30_000);await flush();});
  expect(send).toHaveBeenCalledOnce();
  reopened.unmount();
});

it('can synchronize a saved point even if this device no longer exposes a GPS sensor', async () => {
  const failed=vi.fn().mockRejectedValue(new Error('Sin conexión'));
  const first=renderHook(()=>useFleetGps([{key:'a',send:failed}],true));
  await act(async()=>{locate(position());await flush();});
  const [point,reference]=failed.mock.calls[0];first.unmount();
  vi.stubGlobal('navigator',{});
  const send=vi.fn().mockResolvedValue({});
  const reopened=renderHook(()=>useFleetGps([{key:'a',send}],true));await act(flush);
  expect(send).toHaveBeenCalledWith(point,reference);expect(reopened.result.current.status).toBe('unavailable');
  expect(localStorage.length).toBe(0);reopened.unmount();
});

it('preserves an old point on reopen without replaying it as a current location', async () => {
  const first=renderHook(()=>useFleetGps([{key:'a',send:vi.fn().mockRejectedValue(new Error('Sin conexión'))}],true));
  await act(async()=>{locate(position());await flush();}); first.unmount();
  vi.setSystemTime(Date.now()+70_000);
  const send=vi.fn().mockResolvedValue({});
  const reopened=renderHook(()=>useFleetGps([{key:'a',send}],true));
  await act(flush);
  expect(send).not.toHaveBeenCalled();
  expect(reopened.result.current.deliveries.a.message).toMatch(/no se reenviará como ubicación actual/i);
  await expect(reopened.result.current.holdAndDrain('a')).rejects.toThrow(/contactá a soporte/i);
  expect(localStorage.length).toBeGreaterThan(0); reopened.unmount();
});

it('reconciles an older point that the server already received without sending it again', async () => {
  const failed=vi.fn().mockRejectedValue(new Error('Respuesta perdida'));
  const first=renderHook(()=>useFleetGps([{key:'a',send:failed}],true));
  await act(async()=>{locate(position());await flush();});
  const [point,reference]=failed.mock.calls[0];first.unmount();vi.setSystemTime(Date.now()+70_000);
  const send=vi.fn().mockResolvedValue({}),verify=vi.fn().mockResolvedValue(true);
  const reopened=renderHook(()=>useFleetGps([{key:'a',send,verify}],true));
  await act(flush);
  expect(verify).toHaveBeenCalledWith(point,reference);expect(send).not.toHaveBeenCalled();
  expect(reopened.result.current.deliveries.a.state).toBe('verified');
  expect(localStorage.length).toBe(0);await expect(reopened.result.current.holdAndDrain('a')).resolves.toBeUndefined();
  reopened.unmount();
});

it('retains an old point when receipt is not confirmed', async () => {
  const first=renderHook(()=>useFleetGps([{key:'a',send:vi.fn().mockRejectedValue(new Error('Sin conexión'))}],true));
  await act(async()=>{locate(position());await flush();});first.unmount();vi.setSystemTime(Date.now()+70_000);
  const send=vi.fn(),verify=vi.fn().mockResolvedValue(false);
  const reopened=renderHook(()=>useFleetGps([{key:'a',send,verify}],true));await act(flush);
  expect(verify).toHaveBeenCalledOnce();expect(send).not.toHaveBeenCalled();expect(localStorage.length).toBeGreaterThan(0);
  await expect(reopened.result.current.holdAndDrain('a')).rejects.toThrow(/contactá a soporte/i);reopened.unmount();
});

it('keeps warning about a second unsaved point after verifying a different saved point', async () => {
  vi.spyOn(Storage.prototype,'setItem').mockImplementationOnce(()=>{throw new Error('quota');});
  const send=vi.fn(),verify=vi.fn().mockResolvedValue(true),now=Date.now();
  const hook=renderHook(()=>useFleetGps([{key:'a',send,verify}],true));
  await act(async()=>{locate(position());await flush();});
  saveFleetGpsPoint({targetKey:'a',puntoId:'1949916e-22df-4dc1-9d1e-98f98a3eab26',observedAt:now-1000,point:{latitud:-34,longitud:-69,precision:10}});
  vi.setSystemTime(now+70_000);
  await act(async()=>{hook.result.current.resume('a');await flush();});
  expect(verify).toHaveBeenCalledOnce();expect(send).not.toHaveBeenCalled();
  expect(hook.result.current.deliveries.a).toMatchObject({state:'error',saved:false});
  expect(hook.result.current.deliveries.a.message).toMatch(/otra sin guardar/i);
  const closing=new Event('beforeunload',{cancelable:true});window.dispatchEvent(closing);expect(closing.defaultPrevented).toBe(true);
  hook.unmount();
});

it('does not resend an unresolved point as current after the device clock moves backwards', async () => {
  const send=vi.fn().mockRejectedValue(new Error('Sin conexión')),now=Date.now();
  const hook=renderHook(()=>useFleetGps([{key:'a',send}],true));
  await act(async()=>{locate(position());await flush();});
  vi.setSystemTime(now-70_000);
  await act(async()=>{locate(position());await flush();});
  expect(send).toHaveBeenCalledOnce();
  await expect(hook.result.current.holdAndDrain('a')).rejects.toThrow(/contactá a soporte/i);
  hook.unmount();
});

it('coordinates an in-flight fleet write with another transition in the same browser', async () => {
  const restoreLocks=installMockGpsLocks(); let reject!:(error:Error)=>void;
  const send=vi.fn(()=>new Promise<void>((_,fail)=>{reject=fail;}));
  const key=JSON.stringify(['carrier-a','MANIFIESTO:trip']);
  const hook=renderHook(()=>useFleetGps([{key,lockId:'trip',send}],true));
  await act(async()=>{locate(position());await flush();});
  await expect(withGpsTransitionLock('trip',async()=>{})).rejects.toThrow(/otra pestaña/i);
  await act(async()=>{reject(new Error('Sin conexión'));await flush();});
  await expect(withGpsTransitionLock('trip',async()=>assertNoStoredFleetGpsForManifest('trip'))).rejects.toThrow(/GPS de varias cargas sin confirmar/i);
  hook.unmount();restoreLocks();
});

it('keeps relay failures in memory until its capability version can be recovered safely', async () => {
  const send=vi.fn().mockRejectedValue(new Error('Sin conexión'));
  const hook=renderHook(()=>useFleetGps([{key:'relevo',persist:false,send}],true));
  await act(async()=>{locate(position());await flush();});
  expect(localStorage.length).toBe(0);
  expect(hook.result.current.deliveries.relevo.saved).toBe(false);
  const closing=new Event('beforeunload',{cancelable:true});window.dispatchEvent(closing);expect(closing.defaultPrevented).toBe(true);
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
