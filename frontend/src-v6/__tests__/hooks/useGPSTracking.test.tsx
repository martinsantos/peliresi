import { renderHook, waitFor } from '@testing-library/react';
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
