import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ id:'account-a', owner:'context-a', token:'token-a', process:vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser:{ id:mock.id, rol:'TRANSPORTISTA' }, isRestricted:false }) }));
vi.mock('../../hooks/useQueryOwner', () => ({ useQueryOwner: () => mock.owner }));
vi.mock('../../hooks/useConnectivity', () => ({ useConnectivity: () => ({ isOnline:true }) }));
vi.mock('../../services/indexeddb', () => ({ processSyncQueue: mock.process }));
vi.mock('../../services/api', () => ({ getAccessToken: () => mock.token }));
vi.mock('../../services/offline-sync', () => ({ syncOfflineData: vi.fn() }));
vi.mock('../../utils/supportSession', () => ({ supportRequestContext: () => 'context' }));
import { useOfflineSync } from '../../hooks/useOfflineSync';

beforeEach(() => { mock.id='account-a'; mock.owner='context-a'; mock.token='token-a'; mock.process.mockReset(); });

it('retries for the new account after a previous account finishes without displaying its result', async () => {
  let finish!: (value: unknown) => void;
  mock.process.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mock.process.mockResolvedValue({ processed:0, pending:0, retryable:0, terminal:0, auth:0, skipped:0 });
  const hook = renderHook(() => useOfflineSync({ downloadManifests:false }));
  await waitFor(() => expect(mock.process).toHaveBeenCalledWith('account-a', {owner:'context-a',role:'TRANSPORTISTA',companyScoped:false}, false, expect.any(Function)));
  mock.id='account-b'; mock.owner='context-b'; hook.rerender();
  await act(async () => { finish({ processed:0, pending:1, retryable:1, terminal:0, auth:0, skipped:0 }); });
  await waitFor(() => expect(mock.process).toHaveBeenCalledWith('account-b', {owner:'context-b',role:'TRANSPORTISTA',companyScoped:false}, false, expect.any(Function)));
  expect(hook.result.current.pending).toBe(0);
  hook.unmount();
});

it('rechecks pending work after the current account renews its token', async () => {
  let finish!: (value: unknown) => void;
  mock.process.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mock.process.mockResolvedValue({ processed:0, pending:0, retryable:0, terminal:0, auth:0, skipped:0 });
  const hook = renderHook(() => useOfflineSync({ downloadManifests:false }));
  await waitFor(() => expect(mock.process).toHaveBeenCalledTimes(1));
  mock.token='token-renewed';
  await act(async () => { finish({ processed:0, pending:1, retryable:1, terminal:0, auth:0, skipped:0 }); });
  await waitFor(() => expect(mock.process).toHaveBeenCalledTimes(2));
  expect(hook.result.current.pending).toBe(0);
  hook.unmount();
});

it('does not send queued work when the session token is unavailable', async () => {
  mock.token='';
  const hook = renderHook(() => useOfflineSync({ downloadManifests:false }));
  await waitFor(() => expect(hook.result.current.auth).toBe(1));
  expect(mock.process).not.toHaveBeenCalled();
  hook.unmount();
});
