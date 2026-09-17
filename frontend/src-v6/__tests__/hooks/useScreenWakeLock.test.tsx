import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScreenWakeLock } from '../../hooks/useScreenWakeLock';

describe('useScreenWakeLock', () => {
  let releaseListener: (() => void) | null;
  const release = vi.fn().mockResolvedValue(undefined);
  const request = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    releaseListener = null;
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    request.mockImplementation(async () => ({
      released: false,
      release,
      addEventListener: vi.fn((_type: string, listener: () => void) => { releaseListener = listener; }),
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    });
  });

  it('keeps the screen awake for an active trip and releases it on cleanup', async () => {
    const { result, unmount } = renderHook(() => useScreenWakeLock(true));

    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(request).toHaveBeenCalledWith('screen');
    unmount();
    await waitFor(() => expect(release).toHaveBeenCalled());
  });

  it('reacquires the lock after the browser releases it and becomes visible', async () => {
    const { result } = renderHook(() => useScreenWakeLock(true));
    await waitFor(() => expect(result.current.status).toBe('active'));

    act(() => releaseListener?.());
    expect(result.current.status).toBe('released');
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.status).toBe('active'));
  });
});
