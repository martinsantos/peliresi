/**
 * SITREP v6 - useAlertas Unit Tests
 * Smoke-level: exports exist, hook renders without error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock alerta service
vi.mock('@src/services/alerta.service', () => ({
  alertaService: {
    listReglas: vi.fn().mockResolvedValue([]),
    createRegla: vi.fn().mockResolvedValue({ id: '1' }),
    listAlertas: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, totalPages: 1 }),
    resolverAlerta: vi.fn().mockResolvedValue({}),
    updateRegla: vi.fn().mockResolvedValue({}),
    deleteRegla: vi.fn().mockResolvedValue(undefined),
    listAnomalias: vi.fn().mockResolvedValue([]),
  },
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

describe('useAlertas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exports', () => {
    it('should export useReglasAlerta as a function', async () => {
      const { useReglasAlerta } = await import('@src/hooks/useAlertas');
      expect(typeof useReglasAlerta).toBe('function');
    });

    it('should export useCreateReglaAlerta as a function', async () => {
      const { useCreateReglaAlerta } = await import('@src/hooks/useAlertas');
      expect(typeof useCreateReglaAlerta).toBe('function');
    });

    it('should export useAlertas as a function', async () => {
      const { useAlertas } = await import('@src/hooks/useAlertas');
      expect(typeof useAlertas).toBe('function');
    });

    it('should export useResolverAlerta as a function', async () => {
      const { useResolverAlerta } = await import('@src/hooks/useAlertas');
      expect(typeof useResolverAlerta).toBe('function');
    });

    it('should export useUpdateReglaAlerta as a function', async () => {
      const { useUpdateReglaAlerta } = await import('@src/hooks/useAlertas');
      expect(typeof useUpdateReglaAlerta).toBe('function');
    });

    it('should export useDeleteReglaAlerta as a function', async () => {
      const { useDeleteReglaAlerta } = await import('@src/hooks/useAlertas');
      expect(typeof useDeleteReglaAlerta).toBe('function');
    });

    it('should export useAnomalias as a function', async () => {
      const { useAnomalias } = await import('@src/hooks/useAlertas');
      expect(typeof useAnomalias).toBe('function');
    });
  });

  describe('queries', () => {
    it('useReglasAlerta should fetch reglas and return empty array', async () => {
      const { useReglasAlerta } = await import('@src/hooks/useAlertas');
      const { result } = renderHook(() => useReglasAlerta(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it('useAlertas should return default empty state', async () => {
      const { useAlertas } = await import('@src/hooks/useAlertas');
      const { result } = renderHook(() => useAlertas(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.items).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });

    it('useAlertas should be disabled when enabled=false', async () => {
      const { useAlertas } = await import('@src/hooks/useAlertas');
      const { result } = renderHook(() => useAlertas(undefined, false), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});
