import type React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { filterCachedInspections, useInspections } from '../../hooks/useInspecciones';
import { inspectionContextKey, inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
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

  it('applies phase states before offline pagination without including closed cases', () => {
    const cases = [cached('a', 'I-001', 'actor', '2026-09-21'), cached('b', 'I-002', 'actor', '2026-09-22'), cached('c', 'I-003', 'actor', '2026-09-23')];
    cases[0].estado = 'NOTIFICADA'; cases[1].estado = 'REQUIERE_SUBSANACION'; cases[2].estado = 'CERRADA_CONFORME';
    expect(filterCachedInspections(cases, { estados: ['NOTIFICADA', 'EN_DESCARGO', 'REQUIERE_SUBSANACION'], page: 2, limit: 1 })).toMatchObject({ offline: true, total: 2, totalPages: 2, items: [{ id: 'a' }] });
  });

  it('filters and paginates only cached cases while marking totals as local', () => {
    const cases = [cached('one', 'I-001', 'a-1', '2026-09-20T00:00:00Z'), cached('two', 'I-002', 'a-2', '2026-09-22T00:00:00Z')];
    expect(filterCachedInspections(cases, { actorId: 'a-1' })).toMatchObject({ offline: true, total: 1, items: [{ id: 'one' }] });
    expect(filterCachedInspections(cases, { page: 1, limit: 1 })).toMatchObject({ offline: true, total: 2, totalPages: 2, items: [{ id: 'two' }] });
    expect(filterCachedInspections(cases, { search: 'I-001' }).items.map((entry) => entry.id)).toEqual(['one']);
  });

  it('falls back on transport failure only for the same full context, excluding legacy copies', async () => {
    mocks.list.mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }));
    mocks.getAllOffline.mockResolvedValue([
      { id: 'inspector-1:legacy', inspection: cached('legacy', 'I-003', 'a-1', '2026-09-21') },
      { id: inspectionContextKey('inspector-1', 'other-activity', 'foreign'), owner: 'other-activity', inspection: cached('foreign', 'I-004', 'a-1', '2026-09-21') },
      { id: inspectionContextKey('inspector-1', inspectionWorkspaceOwner({ id: 'inspector-1' }), 'one'), owner: inspectionWorkspaceOwner({ id: 'inspector-1' }), inspection: cached('one', 'I-001', 'a-1', '2026-09-20T00:00:00Z') },
      { id: inspectionContextKey('inspector-2', inspectionWorkspaceOwner({ id: 'inspector-2' }), 'two'), owner: inspectionWorkspaceOwner({ id: 'inspector-2' }), inspection: cached('two', 'I-002', 'a-2', '2026-09-22T00:00:00Z') },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useInspections(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ offline: true, total: 1, items: [{ id: 'one' }] });
  });

  it('filters by the immutable inspection subject even after a generator is linked', () => {
    const cases = [cached('oil', 'PRP-2026-00001', 'a-1', '2026-09-20T00:00:00Z'), cached('legacy', 'I-2026-000002', 'a-2', '2026-09-22T00:00:00Z')];
    expect(filterCachedInspections(cases, { tipoInspeccion: 'PETROLEO' }).items.map(row => row.id)).toEqual(['oil']);
    expect(filterCachedInspections(cases, { tipoInspeccion: 'GENERADOR' }).items.map(row => row.id)).toEqual(['legacy']);
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
