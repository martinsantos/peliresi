import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGPSTracking } from '../../hooks/useGPSTracking';
import { addToSyncQueue } from '../../services/indexeddb';
import { manifiestoService } from '../../services/manifiesto.service';
import { gpsPendingStorageKey } from '../../utils/userContext';

vi.mock('../../components/ui/Toast', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));
vi.mock('../../services/indexeddb', () => ({ addToSyncQueue: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../services/manifiesto.service', () => ({
  manifiestoService: { actualizarUbicacion: vi.fn().mockResolvedValue(undefined) },
}));

describe('useGPSTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
    });
    navigator.geolocation.watchPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: -32.89,
          longitude: -68.84,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: 90,
          speed: 10,
          toJSON: () => ({}),
        },
        timestamp: 1_800_000_000_000,
        toJSON: () => ({}),
      } as GeolocationPosition);
      return 7;
    });
    navigator.geolocation.clearWatch = vi.fn();
  });

  it('persists the first GPS fix immediately and stages it before delivery', async () => {
    const { result, unmount } = renderHook(() => useGPSTracking({
      manifiestoId: 'manifest-1',
      userId: 'user-1',
      estado: 'EN_TRANSITO',
      viajeStatus: 'ACTIVO',
    }));

    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(result.current.pendingCount).toBe(1);
    expect(localStorage.getItem(gpsPendingStorageKey('user-1', 'manifest-1'))).toContain(new Date(1_800_000_000_000).toISOString());

    let staged = 0;
    await act(async () => { staged = await result.current.stagePendingForSync('user-1'); });
    expect(staged).toBe(1);
    expect(addToSyncQueue).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: '/manifiestos/manifest-1/ubicacion',
      userId: 'user-1',
      data: expect.objectContaining({ timestamp: new Date(1_800_000_000_000).toISOString() }),
    }));
    expect(localStorage.getItem(gpsPendingStorageKey('user-1', 'manifest-1'))).toBeNull();
    expect(manifiestoService.actualizarUbicacion).not.toHaveBeenCalled();
    unmount();
  });

  it('marks an active GPS signal stale after 90 seconds without a new fix', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T12:00:00.000Z'));
    try {
      const { result, unmount } = renderHook(() => useGPSTracking({
        manifiestoId: 'manifest-stale',
        userId: 'user-1',
        estado: 'EN_TRANSITO',
        viajeStatus: 'ACTIVO',
      }));

      await act(async () => { await Promise.resolve(); });
      expect(result.current.status).toBe('active');
      expect(result.current.isStale).toBe(false);

      act(() => { vi.advanceTimersByTime(90_000); });
      expect(result.current.isStale).toBe(true);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});
