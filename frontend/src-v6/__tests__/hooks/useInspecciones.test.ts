import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { renderHook } from '@testing-library/react';

const invalidateQueries = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const useMutationMock = vi.hoisted(() => vi.fn((options: unknown) => options));
const useQueryMock = vi.hoisted(() => vi.fn((options: unknown) => options));
const getInspection = vi.hoisted(() => vi.fn());
const getOfflineMock = vi.hoisted(() => vi.fn());
const saveOfflineMock = vi.hoisted(() => vi.fn());
const listMock = vi.hoisted(() => vi.fn());
const getAllOfflineMock = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ currentUser: { id: 'inspector-7', rol: 'ADMIN', actorId: 'actor-1', empresaContexto: undefined as any } }));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: useMutationMock,
    useQuery: useQueryMock,
    useQueryClient: () => ({ invalidateQueries }),
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => auth,
}));

vi.mock('../../services/inspeccion.service', () => ({ inspeccionService: { get: getInspection, list: listMock } }));
vi.mock('../../services/indexeddb', () => ({ getOffline: getOfflineMock, getAllOffline: getAllOfflineMock, saveOffline: saveOfflineMock }));

import { useInspection, useInspections, useInspectionMutation } from '../../hooks/useInspecciones';
import { inspectionContextKey, inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';

describe('useInspection connectivity fallback', () => {
  const cached = { id: 'inspection-9', numero: 'DEMO' };
  const query = () => renderHook(() => useInspection('inspection-9')).result.current as unknown as { queryFn: () => Promise<unknown> };
  beforeEach(() => {
    vi.clearAllMocks();
    auth.currentUser = { id: 'inspector-7', rol: 'ADMIN', actorId: 'actor-1', empresaContexto: undefined };
    saveOfflineMock.mockResolvedValue(undefined);
    const owner = inspectionWorkspaceOwner(auth.currentUser);
    getOfflineMock.mockResolvedValue({ id: inspectionContextKey('inspector-7', owner, 'inspection-9'), owner, inspection: cached });
  });

  it.each(['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'])('recovers only the current user snapshot for %s', async (code) => {
    getInspection.mockRejectedValue(new AxiosError('Offline', code));
    await expect(query().queryFn()).resolves.toEqual(cached);
    expect(getOfflineMock).toHaveBeenCalledWith('inspection_cases', inspectionContextKey('inspector-7', inspectionWorkspaceOwner(auth.currentUser), 'inspection-9'));
  });

  it.each([401, 403, 404, 500, 503])('does not hide HTTP %s behind a cached case', async (status) => {
    const error = new AxiosError('Rejected', 'ERR_BAD_RESPONSE', undefined, undefined, { status } as never);
    getInspection.mockRejectedValue(error);
    await expect(query().queryFn()).rejects.toBe(error);
    expect(getOfflineMock).not.toHaveBeenCalled();
  });

  it('does not hide cancellations or unrelated exceptions', async () => {
    for (const error of [new AxiosError('Canceled', 'ERR_CANCELED'), new Error('Programming error')]) {
      getInspection.mockRejectedValue(error);
      await expect(query().queryFn()).rejects.toBe(error);
    }
    expect(getOfflineMock).not.toHaveBeenCalled();
  });

  it('keeps the network failure when no local snapshot exists', async () => {
    const error = new AxiosError('Offline', 'ERR_NETWORK');
    getInspection.mockRejectedValue(error);
    getOfflineMock.mockResolvedValue(null);
    await expect(query().queryFn()).rejects.toBe(error);
  });

  it('returns fresh data even if local storage fails', async () => {
    getInspection.mockResolvedValue(cached);
    saveOfflineMock.mockRejectedValue(new Error('quota'));
    await expect(query().queryFn()).resolves.toEqual(cached);
    expect(getOfflineMock).not.toHaveBeenCalled();
  });

  it.each([{ rol: 'ADMIN_GENERADOR' }, { actorId: 'another-actor' }, { empresaContexto: { empresaId: 'company-2', autorizacionId: 'grant-2', revision: 3 } }])('isolates the same account after changing context %j', async change => {
    const oldKey = (query() as any).queryKey;
    auth.currentUser = { ...auth.currentUser, ...change };
    const next = query();
    expect((next as any).queryKey).not.toEqual(oldKey);
    const error = new AxiosError('Offline', 'ERR_NETWORK');
    getInspection.mockRejectedValue(error);
    await expect(next.queryFn()).rejects.toBe(error);
  });

  it('rejects old unscoped offline copies and does not overwrite them', async () => {
    getOfflineMock.mockResolvedValue({ id: 'inspector-7:inspection-9', inspection: cached });
    const error = new AxiosError('Offline', 'ERR_NETWORK');
    getInspection.mockRejectedValue(error);
    await expect(query().queryFn()).rejects.toBe(error);
    expect(saveOfflineMock).not.toHaveBeenCalled();
  });

  it('does not report an empty registry when the current activity has no offline copy', async () => {
    const error = new AxiosError('Offline', 'ERR_NETWORK');
    listMock.mockRejectedValue(error);
    getAllOfflineMock.mockResolvedValue([{ id: 'inspector-7:inspection-9', inspection: cached }]);
    const { result } = renderHook(() => useInspections());
    await expect((result.current as any).queryFn()).rejects.toBe(error);
  });
});

describe('useInspectionMutation', () => {
  beforeEach(() => {
    invalidateQueries.mockClear();
    useMutationMock.mockClear();
  });

  it('refreshes the user-scoped inspection detail after a successful mutation', async () => {
    const mutation = useInspectionMutation(async () => ({ ok: true }), 'inspection-9') as unknown as {
      onSuccess: () => Promise<void>;
    };

    await mutation.onSuccess();

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['inspecciones', 'list'] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inspecciones', 'detail', 'inspector-7', 'inspection-9'],
    });
  });
});
