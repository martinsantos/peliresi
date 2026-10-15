import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  get: vi.fn(), save: vi.fn(), all: vi.fn().mockResolvedValue([]), remove: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ items: [{ id: 'owned' }] }), activity: vi.fn(),
}));
vi.mock('../../services/indexeddb', () => ({ getOffline: mocks.get, saveOffline: mocks.save, getAllOffline: mocks.all, removeOffline: mocks.remove }));
vi.mock('../../services/manifiesto.service', () => ({ manifiestoService: { list: mocks.list } }));
vi.mock('../../services/api', () => ({ getAccessToken: () => 'qa-token' }));
vi.mock('../../services/actorActivity', () => ({ readActorActivity: mocks.activity }));
import { syncOfflineData, getCachedManifiestos, getLastSyncTime } from '../../services/offline-sync';
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'true'); });
afterEach(() => vi.unstubAllEnvs());
it('writes and reads only the selected activity cache', async () => {
  mocks.activity.mockReturnValue('OPERADOR');
  await syncOfflineData('same-account');
  expect(mocks.save).toHaveBeenCalledWith('manifiestos', expect.objectContaining({ id: 'user_same-account:activity:OPERADOR' }));
  mocks.activity.mockReturnValue('GENERADOR');
  await getCachedManifiestos('same-account');
  await getLastSyncTime('same-account');
  expect(mocks.get).toHaveBeenCalledWith('manifiestos', 'user_same-account:activity:GENERADOR');
  expect(mocks.get).not.toHaveBeenCalledWith('manifiestos', 'user_same-account:activity:OPERADOR');
});
it('keeps legacy cache behavior while the feature is disabled', async () => {
  vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED', 'false');
  await getCachedManifiestos('legacy');
  expect(mocks.get).toHaveBeenCalledWith('manifiestos', 'user_legacy');
});
