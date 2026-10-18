import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), authenticatedGet: vi.fn(), set: vi.fn(), clear: vi.fn() }));
vi.mock('axios', () => ({ default: { get: mocks.get } }));
vi.mock('../../services/api', () => ({ default: { get: mocks.authenticatedGet, defaults: { baseURL: '/api', timeout: 30000 } }, setTokensDurably: mocks.set, clearTokensDurably: mocks.clear, getAccessToken: vi.fn() }));
import { authService } from '../../services/auth.service';
it('uses the public client without touching or transmitting the existing login credentials', async () => {
  mocks.get.mockResolvedValue({ data: { message: 'OK', nextPath: '/mi-solicitud', verifiedUserId: 'owner' } });
  expect(await authService.verifyEmail('proof&not-a-query')).toEqual({ message: 'OK', nextPath: '/mi-solicitud', verifiedUserId: 'owner' });
  expect(mocks.get).toHaveBeenCalledWith('/auth/verify-email', { baseURL: '/api', timeout: 30000, params: { token: 'proof&not-a-query' } });
  expect(mocks.authenticatedGet).not.toHaveBeenCalled(); expect(mocks.set).not.toHaveBeenCalled(); expect(mocks.clear).not.toHaveBeenCalled();
});
