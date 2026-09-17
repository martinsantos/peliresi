import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

const auth = vi.hoisted(() => ({ currentUser: { id: 'admin-a' } as { id: string } | null }));
const saveOffline = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const getOffline = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const generadores = vi.hoisted(() => vi.fn());

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: auth.currentUser }),
}));

vi.mock('../../services/indexeddb', () => ({
  OFFLINE_CATALOG_KEYS: ['tipos-residuo', 'generadores', 'transportistas', 'operadores', 'vehiculos', 'choferes'],
  getOfflineCatalogKey: (userId: string, key: string) => `user_${userId}_${key}`,
  saveOffline,
  getOffline,
}));

vi.mock('../../services/catalogo.service', () => ({
  catalogoService: { generadores },
}));

import { useCatalogoGeneradores } from '../../hooks/useCatalogos';

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

describe('useCatalogoGeneradores offline privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.currentUser = { id: 'admin-a' };
    getOffline.mockResolvedValue(null);
  });

  it('persists a successful catalog response under the authenticated principal only', async () => {
    generadores.mockResolvedValue([{ id: 'actor-a', razonSocial: 'Actor A' }]);
    const { result } = renderHook(() => useCatalogoGeneradores(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(saveOffline).toHaveBeenCalledWith('catalogos', expect.objectContaining({
      id: 'user_admin-a_generadores',
    }));
    expect(saveOffline).not.toHaveBeenCalledWith('catalogos', expect.objectContaining({ id: 'generadores' }));
  });

  it('never reads a prior principal cache when the next principal is offline', async () => {
    auth.currentUser = { id: 'operador-b' };
    generadores.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useCatalogoGeneradores(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getOffline).toHaveBeenCalledWith('catalogos', 'user_operador-b_generadores');
    expect(getOffline).not.toHaveBeenCalledWith('catalogos', 'generadores');
    expect(getOffline).not.toHaveBeenCalledWith('catalogos', 'user_admin-a_generadores');
  });
});
