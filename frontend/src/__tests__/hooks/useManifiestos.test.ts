/**
 * SITREP v6 - useManifiestos Unit Tests
 * Smoke-level: exports exist, hook renders without error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock AuthContext — useManifiestos calls useAuth() for currentUser
vi.mock('@src/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    currentUser: { id: 1, nombre: 'Test User', email: 'test@test.com', rol: 'ADMIN' },
  })),
}));

// Mock manifiesto service — avoid actual API calls
vi.mock('@src/services/manifiesto.service', () => ({
  manifiestoService: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, totalPages: 1 }),
    getById: vi.fn().mockResolvedValue(null),
    dashboard: vi.fn().mockResolvedValue({}),
  },
}));

// Mock offline-sync — avoid IndexedDB calls
vi.mock('@src/services/offline-sync', () => ({
  getCachedManifiestos: vi.fn().mockResolvedValue([]),
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

describe('useManifiestos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export useManifiestos as a function', async () => {
    const { useManifiestos } = await import('@src/hooks/useManifiestos');
    expect(typeof useManifiestos).toBe('function');
  });

  it('should return query data with default empty state', async () => {
    const { useManifiestos } = await import('@src/hooks/useManifiestos');
    const { result } = renderHook(() => useManifiestos(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for query to resolve
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.items).toEqual([]);
    expect(result.current.data?.total).toBe(0);
  });

  it('should export useManifiesto as a function', async () => {
    const { useManifiesto } = await import('@src/hooks/useManifiestos');
    expect(typeof useManifiesto).toBe('function');
  });

  it('should export useManifiestoDashboard as a function', async () => {
    const { useManifiestoDashboard } = await import('@src/hooks/useManifiestos');
    expect(typeof useManifiestoDashboard).toBe('function');
  });

  it('should re-export workflow mutations from useManifiestoWorkflow', async () => {
    const mod = await import('@src/hooks/useManifiestos');
    expect(typeof mod.useCreateManifiesto).toBe('function');
    expect(typeof mod.useFirmarManifiesto).toBe('function');
    expect(typeof mod.useConfirmarRetiro).toBe('function');
    expect(typeof mod.useConfirmarEntrega).toBe('function');
    expect(typeof mod.useCerrarManifiesto).toBe('function');
    expect(typeof mod.useCancelarManifiesto).toBe('function');
  });

  it('should pass filters to the service', async () => {
    const { useManifiestos } = await import('@src/hooks/useManifiestos');
    const { manifiestoService } = await import('@src/services/manifiesto.service');

    const filters = { estado: 'APROBADO' as const, limit: 10 };
    renderHook(() => useManifiestos(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(manifiestoService.list).toHaveBeenCalledWith(filters);
    });
  });

  it('should call getById when useManifiesto is rendered with an id', async () => {
    const { useManifiesto } = await import('@src/hooks/useManifiestos');
    const { manifiestoService } = await import('@src/services/manifiesto.service');

    renderHook(() => useManifiesto('test-id-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(manifiestoService.getById).toHaveBeenCalledWith('test-id-123');
    });
  });
});
