import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConnectivity } from '../../hooks/useConnectivity';

let online = false;
let fetches: Array<(response: Response) => void>;
const reply = (ok: boolean) => ({ ok }) as Response;
function event(value: boolean) { online = value; window.dispatchEvent(new Event(value ? 'online' : 'offline')); }
beforeEach(() => {
  vi.useFakeTimers(); online = false; fetches = [];
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => fetches.push(resolve))));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('connectivity recovery races', () => {
  it.each([true, false])('does not let a rapid health reply (%s) discard the online event', async ok => {
    const { result } = renderHook(() => useConnectivity({ debounceMs: 100 }));
    act(() => event(true)); await act(async () => fetches[0](reply(ok)));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.isOnline).toBe(true); expect(result.current.isApiReachable).toBe(ok); expect(result.current.lastOnline).toBeInstanceOf(Date);
  });
  it('ignores a successful old ping arriving after loss of network', async () => {
    online = true; const { result } = renderHook(() => useConnectivity({ debounceMs: 100 }));
    act(() => event(false)); await act(async () => fetches[0](reply(true)));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.isOnline).toBe(false); expect(result.current.isApiReachable).toBe(false);
  });
  it('ignores the previous network epoch after offline and reconnect', async () => {
    online = true; const { result } = renderHook(() => useConnectivity({ debounceMs: 100 }));
    act(() => { event(false); event(true); });
    await act(async () => fetches[1](reply(true))); await act(async () => fetches[0](reply(false)));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.isOnline).toBe(true); expect(result.current.isApiReachable).toBe(true);
  });
  it('does not start a ping when disabled and cancels pending render on unmount', () => {
    const { unmount } = renderHook(() => useConnectivity({ enablePing: false, debounceMs: 100 }));
    act(() => event(true)); unmount(); act(() => vi.advanceTimersByTime(100));
    expect(fetch).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
});
