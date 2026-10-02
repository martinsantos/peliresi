import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api, setTokens, getAccessToken } from '../../services/api';

beforeEach(() => { localStorage.clear(); setTokens('inspector-access', 'inspector-refresh'); });
afterEach(() => vi.restoreAllMocks());
const unauthorized = (config: InternalAxiosRequestConfig) => new AxiosError('Expired', 'ERR_BAD_REQUEST', config, undefined,
  { status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config });

it('never refreshes or replays an old inspection request with the next user credential', async () => {
  let rejectOld!: (error: unknown) => void;
  let original!: InternalAxiosRequestConfig;
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    if (adapter.mock.calls.length === 1) {
      original = config;
      return await new Promise<never>((_, reject) => { rejectOld = reject; });
    }
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config };
  });
  const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ data: { data: { accessToken: 'carrier-refreshed', refreshToken: 'carrier-refresh-2' } } });
  const pending = api.get('/inspecciones/old-inspection/intercambios', { adapter }).catch(error => error);
  await vi.waitFor(() => expect(adapter).toHaveBeenCalledOnce());
  expect(original.headers.Authorization).toBe('Bearer inspector-access');
  setTokens('carrier-access', 'carrier-refresh');
  rejectOld(unauthorized(original));
  const result = await pending;
  expect(refresh).not.toHaveBeenCalled();
  expect(adapter).toHaveBeenCalledOnce();
  expect(result.response.status).toBe(401);
  expect(getAccessToken()).toBe('carrier-access');
});

it('binds the token before another login can run ahead of an async interceptor', async () => {
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({ status: 200, statusText: 'OK', data: {}, headers: {}, config }));
  const pending = api.get('/inspecciones/old-inspection/intercambios', { adapter });
  setTokens('carrier-access', 'carrier-refresh');
  await pending;
  expect(adapter.mock.calls[0][0].headers.Authorization).toBe('Bearer inspector-access');
});

it('still refreshes an expired request belonging to the current session', async () => {
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    if (adapter.mock.calls.length === 1) throw unauthorized(config);
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config };
  });
  const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ data: { data: { accessToken: 'inspector-refreshed', refreshToken: 'inspector-refresh-2' } } });
  await api.get('/inspecciones/old-inspection/intercambios', { adapter });
  expect(refresh).toHaveBeenCalledOnce();
  expect(adapter).toHaveBeenCalledTimes(2);
  expect(adapter.mock.calls[1][0].headers.Authorization).toBe('Bearer inspector-refreshed');
});
