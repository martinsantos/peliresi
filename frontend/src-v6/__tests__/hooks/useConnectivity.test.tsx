import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const processSyncQueue = vi.hoisted(() => vi.fn().mockResolvedValue(0));

vi.mock('../../services/indexeddb', () => ({ processSyncQueue }));

import { useConnectivity } from '../../hooks/useConnectivity';

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

describe('useConnectivity resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOnline(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('shows offline state and replays only the current principal queue on reconnect', async () => {
    const { result, unmount } = renderHook(() => useConnectivity({
      enablePing: false,
      debounceMs: 0,
      currentUserId: 'user-a',
    }));

    setOnline(false);
    act(() => window.dispatchEvent(new Event('offline')));
    await waitFor(() => expect(result.current.isOnline).toBe(false));
    expect(result.current.isApiReachable).toBe(false);
    expect(processSyncQueue).not.toHaveBeenCalled();

    setOnline(true);
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(result.current.isOnline).toBe(true));
    await waitFor(() => expect(processSyncQueue).toHaveBeenCalledWith('user-a'));
    expect(processSyncQueue).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('scopes service-worker requested replay to the authenticated principal', async () => {
    let onMessage: ((event: MessageEvent) => void) | undefined;
    const serviceWorker = {
      addEventListener: vi.fn((type: string, listener: (event: MessageEvent) => void) => {
        if (type === 'message') onMessage = listener;
      }),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: serviceWorker,
    });

    const { unmount } = renderHook(() => useConnectivity({
      enablePing: false,
      debounceMs: 0,
      currentUserId: 'user-b',
    }));

    expect(onMessage).toBeDefined();
    act(() => onMessage?.(new MessageEvent('message', { data: { type: 'SYNC_REQUEST' } })));
    await waitFor(() => expect(processSyncQueue).toHaveBeenCalledWith('user-b'));
    expect(processSyncQueue).toHaveBeenCalledTimes(1);
    unmount();
    expect(serviceWorker.removeEventListener).toHaveBeenCalledWith('message', onMessage);
  });

  it('distinguishes an unreachable API from a browser that is offline', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('controlled outage'));
    const { result, unmount } = renderHook(() => useConnectivity({
      enablePing: true,
      debounceMs: 0,
      pingInterval: 60_000,
      currentUserId: 'user-c',
    }));

    await waitFor(() => expect(result.current.isApiReachable).toBe(false));
    expect(result.current.isOnline).toBe(true);
    expect(processSyncQueue).not.toHaveBeenCalled();
    unmount();
  });
});
