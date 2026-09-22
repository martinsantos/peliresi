import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateQueries = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const useMutationMock = vi.hoisted(() => vi.fn((options: unknown) => options));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: useMutationMock,
    useQueryClient: () => ({ invalidateQueries }),
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'inspector-7' } }),
}));

vi.mock('../../services/inspeccion.service', () => ({ inspeccionService: {} }));
vi.mock('../../services/indexeddb', () => ({ getOffline: vi.fn(), saveOffline: vi.fn() }));

import { useInspectionMutation } from '../../hooks/useInspecciones';

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
