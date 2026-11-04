import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { useManifiesto } from '../../hooks/useManifiestos';

const mocks = vi.hoisted(() => ({ detail: vi.fn() }));
vi.mock('../../services/manifiesto.service', () => ({ manifiestoService: { getById: mocks.detail } }));
vi.mock('../../services/offline-sync', () => ({ getCachedManifiestos: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'training-admin' } }) }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.resetAllMocks(); });
const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000, refetchOnWindowFocus: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
};
it('reopening within the cache freshness window retrieves the closure made on another phone', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const { client, wrapper } = setup();
  mocks.detail.mockResolvedValueOnce({ id: 'shared', estado: 'EN_TRANSITO' });
  const first = renderHook(() => useManifiesto('shared'), { wrapper });
  await waitFor(() => expect(first.result.current.data?.estado).toBe('EN_TRANSITO'));
  first.unmount();
  mocks.detail.mockResolvedValueOnce({ id: 'shared', estado: 'TRATADO' });
  const second = renderHook(() => useManifiesto('shared'), { wrapper });
  await waitFor(() => expect(second.result.current.data?.estado).toBe('TRATADO'));
  expect(mocks.detail).toHaveBeenCalledTimes(2); client.clear();
});
it('an open detail receives another phone’s closure, then stops polling terminal state', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const { client, wrapper } = setup();
  mocks.detail.mockResolvedValue({ id: 'shared', estado: 'EN_TRANSITO' });
  const { result } = renderHook(() => useManifiesto('shared'), { wrapper });
  await waitFor(() => expect(result.current.data?.estado).toBe('EN_TRANSITO'));
  vi.useFakeTimers();
  // Remount installs the real query observer's interval using the controlled clock.
  cleanup();
  const open = renderHook(() => useManifiesto('shared'), { wrapper });
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  mocks.detail.mockResolvedValue({ id: 'shared', estado: 'TRATADO' });
  await act(async () => { await vi.advanceTimersByTimeAsync(30_001); });
  expect(open.result.current.data?.estado).toBe('TRATADO');
  const calls = mocks.detail.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
  expect(mocks.detail).toHaveBeenCalledTimes(calls); client.clear();
});
