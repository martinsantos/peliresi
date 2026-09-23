import type React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { filterCachedInspections, useInspections } from '../../hooks/useInspecciones';
import type { Inspection } from '../../types/inspection';

const mocks = vi.hoisted(() => ({ list: vi.fn(), getAllOffline: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'inspector-1' } }) }));
vi.mock('../../services/inspeccion.service', () => ({ inspeccionService: { list: mocks.list } }));
vi.mock('../../services/indexeddb', () => ({ getAllOffline: mocks.getAllOffline, getOffline: vi.fn(), saveOffline: vi.fn() }));

const cached = (id: string, numero: string, actorId: string, updatedAt: string): Inspection => ({
  id, numero, estado: 'EN_CAMPO', tipoActor: 'GENERADOR', inspectorId: 'inspector-1',
  inspector: { id: 'inspector-1', nombre: 'Inspectora' }, generador: { id: actorId, razonSocial: `Actor ${actorId}`, cuit: '30-12345678-9' },
  version: 1, createdAt: updatedAt, updatedAt, items: [], comparaciones: [], evidencias: [], eventos: [],
});

describe('local inspection discovery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters and paginates only cached cases while marking totals as local', () => {
    const cases = [cached('one', 'I-001', 'a-1', '2026-09-20T00:00:00Z'), cached('two', 'I-002', 'a-2', '2026-09-22T00:00:00Z')];
    expect(filterCachedInspections(cases, { actorId: 'a-1' })).toMatchObject({ offline: true, total: 1, items: [{ id: 'one' }] });
    expect(filterCachedInspections(cases, { page: 1, limit: 1 })).toMatchObject({ offline: true, total: 2, totalPages: 2, items: [{ id: 'two' }] });
    expect(filterCachedInspections(cases, { search: 'I-001' }).items.map((entry) => entry.id)).toEqual(['one']);
  });

  it('falls back only on a transport failure and only for the same user', async () => {
    mocks.list.mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }));
    mocks.getAllOffline.mockResolvedValue([
      { id: 'inspector-1:one', inspection: cached('one', 'I-001', 'a-1', '2026-09-20T00:00:00Z') },
      { id: 'inspector-2:two', inspection: cached('two', 'I-002', 'a-2', '2026-09-22T00:00:00Z') },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useInspections(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ offline: true, total: 1, items: [{ id: 'one' }] });
  });

  it('never substitutes a local copy for a permission error', async () => {
    mocks.list.mockRejectedValue(Object.assign(new Error('Forbidden'), { isAxiosError: true, code: 'ERR_BAD_REQUEST', response: { status: 403 } }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useInspections(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(mocks.getAllOffline).not.toHaveBeenCalled();
  });
});
