import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { headingToCompass, useGPSTracking } from '../../hooks/useGPSTracking';
import { EstadoManifiesto } from '../../types/models';
import { manifiestoService } from '../../services/manifiesto.service';

vi.mock('../../services/manifiesto.service', () => ({
  manifiestoService: {
    actualizarUbicacion: vi.fn(),
  },
}));

vi.mock('../../components/ui/Toast', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('headingToCompass', () => {
  it('formats cardinal and southwest headings', () => {
    expect(headingToCompass(0)).toBe('N');
    expect(headingToCompass(90)).toBe('E');
    expect(headingToCompass(225)).toBe('SO');
    expect(headingToCompass(null)).toBe('-');
  });
});

describe('useGPSTracking', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('keeps tracking while Android has GPS enabled but no location fix yet', async () => {
    let errorCallback: PositionErrorCallback | null = null;
    vi.mocked(navigator.geolocation.watchPosition).mockImplementation((_success, error) => {
      errorCallback = error ?? null;
      return 7;
    });

    const { result, unmount } = renderHook(() =>
      useGPSTracking({
        manifiestoId: 'trip-2',
        estado: EstadoManifiesto.EN_TRANSITO,
        viajeStatus: 'ACTIVO',
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('acquiring'));
    vi.mocked(navigator.geolocation.clearWatch).mockClear();
    act(() => {
      errorCallback?.({ code: 2, message: 'location provider temporarily unavailable' } as GeolocationPositionError);
    });

    await waitFor(() => expect(result.current.status).toBe('acquiring'));
    expect(navigator.geolocation.clearWatch).not.toHaveBeenCalledWith(7);

    unmount();
  });

  it('uses a coarse Android fallback fix when high accuracy GPS times out', async () => {
    let errorCallback: PositionErrorCallback | null = null;
    vi.mocked(navigator.geolocation.watchPosition).mockImplementation((_success, error) => {
      errorCallback = error ?? null;
      return 8;
    });
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation((success) => {
      success({
        coords: {
          latitude: -32.8891,
          longitude: -68.8458,
          accuracy: 65,
          speed: null,
          heading: null,
          altitude: null,
          altitudeAccuracy: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });

    const { result, unmount } = renderHook(() =>
      useGPSTracking({
        manifiestoId: 'trip-3',
        estado: EstadoManifiesto.EN_TRANSITO,
        viajeStatus: 'ACTIVO',
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('acquiring'));
    act(() => {
      errorCallback?.({ code: 3, message: 'timeout expired' } as GeolocationPositionError);
    });

    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(result.current.position).toEqual([-32.8891, -68.8458]);
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled();

    unmount();
  });

  it('keeps GPS active after the first Android location fix', async () => {
    let successCallback: PositionCallback | null = null;
    vi.mocked(navigator.geolocation.watchPosition).mockImplementation((success) => {
      successCallback = success;
      return 9;
    });

    const { result, unmount } = renderHook(() =>
      useGPSTracking({
        manifiestoId: 'trip-4',
        estado: EstadoManifiesto.EN_TRANSITO,
        viajeStatus: 'ACTIVO',
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('acquiring'));
    act(() => {
      successCallback?.({
        coords: {
          latitude: -32.9,
          longitude: -68.8,
          accuracy: 12,
          speed: null,
          heading: null,
          altitude: null,
          altitudeAccuracy: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });

    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(result.current.position).toEqual([-32.9, -68.8]);
    expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('exposes restored pending GPS metadata before sync completes', async () => {
    vi.mocked(manifiestoService.actualizarUbicacion).mockRejectedValueOnce(new Error('offline'));
    localStorage.setItem(
      'gps_pending_trip-1',
      JSON.stringify([{ lat: -32.92871, lng: -68.85352, speed: null, heading: 90 }]),
    );

    const { result, unmount } = renderHook(() =>
      useGPSTracking({
        manifiestoId: 'trip-1',
        estado: EstadoManifiesto.EN_TRANSITO,
        viajeStatus: 'ACTIVO',
      }),
    );

    await waitFor(() => expect(result.current.pendingCount).toBe(1));
    expect(result.current.hasPending).toBe(true);
    expect(result.current.lastSyncAt).toBeNull();

    unmount();
  });
});
