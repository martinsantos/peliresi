/**
 * Tests for src-v6/hooks/useManifiestos.ts
 * Verify exported hooks exist and query key construction.
 *
 * NOTE: These hooks depend on AuthContext + React Query. Full integration
 * testing requires a backend mock. Here we test the module's exports and
 * the KEYS structure via the queryKey arrays that the hooks produce.
 */
import { describe, it, expect, vi } from 'vitest';

const useQueryMock = vi.hoisted(() => vi.fn((options: any) => options));
const authState = vi.hoisted(() => ({
  currentUser: { id: '1', rol: 'ADMIN', actorId: 'actor-1', nombre: 'Test', email: 'test@test.com', sector: '', avatar: 'T', telefono: '', ubicacion: '', permisos: ['*'] },
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: useQueryMock,
  };
});

// Mock the dependencies that the hooks import
vi.mock('../../services/manifiesto.service', () => ({
  manifiestoService: {
    list: vi.fn(),
    getById: vi.fn(),
    dashboard: vi.fn(),
  },
}));

vi.mock('../../services/offline-sync', () => ({
  getCachedManifiestos: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: authState.currentUser,
  }),
}));

describe('useManifiestos module exports', () => {
  it('exports useManifiestos hook', async () => {
    const mod = await import('../../hooks/useManifiestos');
    expect(typeof mod.useManifiestos).toBe('function');
  });

  it('exports useManifiesto hook', async () => {
    const mod = await import('../../hooks/useManifiestos');
    expect(typeof mod.useManifiesto).toBe('function');
  });

  it('exports useManifiestoDashboard hook', async () => {
    const mod = await import('../../hooks/useManifiestos');
    expect(typeof mod.useManifiestoDashboard).toBe('function');
  });

  it('re-exports workflow hooks', async () => {
    // These are re-exported from useManifiestoWorkflow
    const mod = await import('../../hooks/useManifiestos');
    expect(typeof mod.useCreateManifiesto).toBe('function');
    expect(typeof mod.useFirmarManifiesto).toBe('function');
    expect(typeof mod.useConfirmarRetiro).toBe('function');
    expect(typeof mod.useConfirmarEntrega).toBe('function');
    expect(typeof mod.useCerrarManifiesto).toBe('function');
    expect(typeof mod.useCancelarManifiesto).toBe('function');
  });

  it('scopes list query keys by current user identity', async () => {
    const mod = await import('../../hooks/useManifiestos');

    authState.currentUser = { ...authState.currentUser, id: 'operator-1', rol: 'OPERADOR', actorId: 'op-1' };
    const operatorQuery = mod.useManifiestos({ estado: 'ENTREGADO' as any, limit: 5 }) as any;

    authState.currentUser = { ...authState.currentUser, id: 'operator-2', rol: 'OPERADOR', actorId: 'op-2' };
    const otherOperatorQuery = mod.useManifiestos({ estado: 'ENTREGADO' as any, limit: 5 }) as any;

    expect(operatorQuery.queryKey).not.toEqual(otherOperatorQuery.queryKey);
    expect(operatorQuery.queryKey).toContainEqual({ userId: 'operator-1', rol: 'OPERADOR', actorId: 'op-1' });
    expect(otherOperatorQuery.queryKey).toContainEqual({ userId: 'operator-2', rol: 'OPERADOR', actorId: 'op-2' });
  });
});
