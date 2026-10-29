import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ owner: 'company-a', queue: vi.fn() }));
vi.mock('../../hooks/useQueryOwner', () => ({ useQueryOwner: () => mocks.owner }));
vi.mock('../../services/indexeddb', () => ({ getSyncQueue: mocks.queue }));
import { usePendingDeliveryIds } from '../../hooks/usePendingDeliveryIds';

beforeEach(() => { mocks.owner = 'company-a'; mocks.queue.mockReset().mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('identifies pending deliveries without confusing a pickup with a delivery', async () => {
  mocks.queue.mockResolvedValue([{type:'POST',endpoint:'/manifiestos/a/confirmar-entrega-idempotente'},
    {type:'POST',endpoint:'/manifiestos/b/confirmar-entrega'}, {type:'POST',endpoint:'/manifiestos/c/confirmar-retiro'}]);
  const {result} = renderHook(() => usePendingDeliveryIds());
  await waitFor(() => expect(result.current.checking).toBe(false));
  expect([...result.current.ids].sort()).toEqual(['a','b']);
});

it('does not display a late result from a previous company', async () => {
  let finish!: (value: unknown[]) => void;
  mocks.queue.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce([]);
  const {result,rerender} = renderHook(() => usePendingDeliveryIds());
  await waitFor(() => expect(mocks.queue).toHaveBeenCalledOnce());
  mocks.owner = 'company-b'; rerender();
  await waitFor(() => expect(result.current.checking).toBe(false));
  await act(async () => finish([{type:'POST',endpoint:'/manifiestos/other/confirmar-entrega'}]));
  expect([...result.current.ids]).toEqual([]);
});

it('exposes local storage failures and can retry', async () => {
  mocks.queue.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce([]);
  const {result} = renderHook(() => usePendingDeliveryIds());
  await waitFor(() => expect(result.current.error).toBe(true));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.error).toBe(false));
});
