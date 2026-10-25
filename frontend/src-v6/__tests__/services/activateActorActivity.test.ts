import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), clear: vi.fn() }));
vi.mock('../../services/api', () => ({ api: { get: mocks.get } }));
vi.mock('../../services/actorActivity', () => ({ ACTIVITY_HEADER: 'X-SITREP-Activity', saveActorActivity: mocks.save }));
vi.mock('../../services/offlineSession', () => ({ clearOfflineSession: mocks.clear }));
import { activateActorActivity } from '../../services/activateActorActivity';
beforeEach(() => vi.resetAllMocks());
it('persists only the activity confirmed for the same account', async () => {
  mocks.get.mockResolvedValue({ data: { data: { user: { id: 'owner', rol: 'OPERADOR' } } } });
  await activateActorActivity('owner', 'OPERADOR');
  expect(mocks.get).toHaveBeenCalledWith('/auth/profile', { headers: { 'X-SITREP-Activity': 'OPERADOR' } });
  expect(mocks.save).toHaveBeenCalledWith('owner', 'OPERADOR');
  expect(mocks.clear).toHaveBeenCalledOnce();
});
it.each([{ id: 'other', rol: 'OPERADOR' }, { id: 'owner', rol: 'GENERADOR' }])('does not persist a mismatched confirmation %j', async user => {
  mocks.get.mockResolvedValue({ data: { data: { user } } });
  await expect(activateActorActivity('owner', 'OPERADOR')).rejects.toThrow('Actividad incompatible');
  expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.clear).not.toHaveBeenCalled();
});
it('does not change the local activity when the server rejects or disconnects', async () => {
  mocks.get.mockRejectedValue(new Error('Unavailable'));
  await expect(activateActorActivity('owner', 'OPERADOR')).rejects.toThrow('Unavailable');
  expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.clear).not.toHaveBeenCalled();
});
