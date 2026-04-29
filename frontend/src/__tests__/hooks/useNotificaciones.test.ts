/**
 * SITREP v6 - useNotificaciones Unit Tests
 * Smoke-level: exports exist, hook renders without error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock notificacion service
vi.mock('@src/services/notificacion.service', () => ({
  notificacionService: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0, noLeidas: 0, page: 1, limit: 100, totalPages: 1 }),
    getNoLeidas: vi.fn().mockResolvedValue(0),
    marcarLeida: vi.fn().mockResolvedValue(undefined),
    marcarTodasLeidas: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock api — getAccessToken is used in useNotificacionesNoLeidas
vi.mock('@src/services/api', () => ({
  getAccessToken: vi.fn(() => 'mock-token'),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // eslint-disable-next-line react/display-name
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useNotificaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export useNotificaciones as a function', async () => {
    const { useNotificaciones } = await import('@src/hooks/useNotificaciones');
    expect(typeof useNotificaciones).toBe('function');
  });

  it('should return query data with default empty state', async () => {
    const { useNotificaciones } = await import('@src/hooks/useNotificaciones');
    const { result } = renderHook(() => useNotificaciones(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.items).toEqual([]);
    expect(result.current.data?.total).toBe(0);
  });

  it('should export useNotificacionesNoLeidas as a function', async () => {
    const { useNotificacionesNoLeidas } = await import('@src/hooks/useNotificaciones');
    expect(typeof useNotificacionesNoLeidas).toBe('function');
  });

  it('should query no-leidas count', async () => {
    const { useNotificacionesNoLeidas } = await import('@src/hooks/useNotificaciones');
    const { notificacionService } = await import('@src/services/notificacion.service');

    renderHook(() => useNotificacionesNoLeidas(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(notificacionService.getNoLeidas).toHaveBeenCalled();
    });
  });

  it('should export useMarcarLeida as a function', async () => {
    const { useMarcarLeida } = await import('@src/hooks/useNotificaciones');
    expect(typeof useMarcarLeida).toBe('function');
  });

  it('should export useMarcarTodasLeidas as a function', async () => {
    const { useMarcarTodasLeidas } = await import('@src/hooks/useNotificaciones');
    expect(typeof useMarcarTodasLeidas).toBe('function');
  });
});
