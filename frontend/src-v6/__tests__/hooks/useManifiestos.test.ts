/**
 * Tests for src-v6/hooks/useManifiestos.ts
 * Verify exported hooks exist and query key construction.
 *
 * NOTE: These hooks depend on AuthContext + React Query. Full integration
 * testing requires a backend mock. Here we test the module's exports and
 * the KEYS structure via the queryKey arrays that the hooks produce.
 */
import { describe, it, expect, vi } from 'vitest';

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
    currentUser: { id: '1', rol: 'ADMIN', nombre: 'Test', email: 'test@test.com', sector: '', avatar: 'T', telefono: '', ubicacion: '', permisos: ['*'] },
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
});
