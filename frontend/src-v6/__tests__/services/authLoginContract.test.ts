import { beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ post: vi.fn(), setTokensDurably: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { post: api.post }, setTokensDurably: api.setTokensDurably, clearTokensDurably: vi.fn(), getAccessToken: vi.fn() }));
import { authService } from '../../services/auth.service';
import { restrictedSessionHint } from '../../services/registrationSession';

describe('login response contract', () => {
  beforeEach(() => vi.clearAllMocks());
  it('preserves restricted status and owned application through token persistence', async () => {
    const user = { id: 'pending', activo: false };
    api.post.mockResolvedValue({ data: { data: { user, tokens: { accessToken: 'access', refreshToken: 'refresh' }, restricted: true, solicitudId: 'owned-application' } } });
    const response = await authService.login({ email: 'qa@test.invalid', password: 'synthetic' });
    expect(response).toEqual({ user, accessToken: 'access', refreshToken: 'refresh', restricted: true, solicitudId: 'owned-application' });
    expect(api.setTokensDurably).toHaveBeenCalledWith('access', 'refresh');
  });
  it('does not invent a restriction for full-access login', async () => {
    api.post.mockResolvedValue({ data: { data: { user: { id: 'active', activo: true }, tokens: { accessToken: 'access', refreshToken: 'refresh' } } } });
    const response = await authService.login({ email: 'qa@test.invalid', password: 'synthetic' });
    expect(response.restricted).toBeUndefined();
    expect(response.solicitudId).toBeUndefined();
  });
  it('uses only strict restricted claims as a UI hint, never malformed tokens', () => {
    for (const restricted of [true, false, 'true', null]) {
      expect(restrictedSessionHint(`header.${btoa(JSON.stringify({ restricted }))}.signature`)).toBe(restricted === true);
    }
    expect(restrictedSessionHint('malformed')).toBe(false);
    expect(restrictedSessionHint('a.!invalid.c')).toBe(false);
  });
});
