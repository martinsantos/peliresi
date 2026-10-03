import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api, setTokens, getAccessToken, clearTokens } from '../../services/api';
vi.mock('../../services/sessionCheckpoint', () => ({ readSessionCheckpoint: vi.fn(), writeSessionCheckpoint: vi.fn().mockResolvedValue(undefined) }));

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

it('replays a late 401 after another request already renewed the same session', async () => {
  let rejectLate!: (error: unknown) => void;
  let lateConfig!: InternalAxiosRequestConfig;
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    if (config.url === '/late' && !lateConfig) {
      lateConfig = config;
      return new Promise((_, reject) => { rejectLate = reject; });
    }
    if (config.headers.Authorization === 'Bearer inspector-access') throw unauthorized(config);
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config };
  });
  const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ data: { data: { accessToken: 'inspector-renewed', refreshToken: 'renewed-refresh' } } });
  const late = api.get('/late', { adapter }).catch(error => error);
  await api.get('/first', { adapter });
  rejectLate(unauthorized(lateConfig));
  expect((await late).status).toBe(200);
  expect(refresh).toHaveBeenCalledOnce();
  expect(adapter).toHaveBeenCalledTimes(4);
});

async function queuedRequests() {
  let finishRefresh!: (value: unknown) => void;
  let failRefresh!: (error: unknown) => void;
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    if (config.headers.Authorization === 'Bearer inspector-access') throw unauthorized(config);
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config };
  });
  const refresh = vi.spyOn(axios, 'post').mockImplementation(() => new Promise((resolve, reject) => { finishRefresh = resolve; failRefresh = reject; }));
  const first = api.get('/first', { adapter }).catch(error => error);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  const second = api.get('/queued', { adapter }).catch(error => error);
  await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
  // Let the response interceptor actually enqueue it, not only call its adapter.
  await new Promise(resolve => setTimeout(resolve, 0));
  return { adapter, first, second, finishRefresh, failRefresh };
}

it('never releases a queued inspection with another tab login token', async () => {
  const { adapter, first, second, finishRefresh } = await queuedRequests();
  setTokens('carrier-access', 'carrier-refresh');
  window.dispatchEvent(new StorageEvent('storage', { key: 'sitrep_access_token', oldValue: 'inspector-access', newValue: 'carrier-access', storageArea: localStorage }));
  const queued = await second;
  finishRefresh({ data: { data: { accessToken: 'old-renewed', refreshToken: 'old-renewed-refresh' } } });
  await first;
  expect(adapter).toHaveBeenCalledTimes(2);
  expect(queued).toBeInstanceOf(Error);
  expect(getAccessToken()).toBe('carrier-access');
});

it.each(['success', 'rejected'] as const)('releases a queue after another tab renews, even with local refresh %s', async outcome => {
  const { adapter, first, second, finishRefresh, failRefresh } = await queuedRequests();
  localStorage.setItem('sitrep_token_renewals', JSON.stringify([['inspector-access', 'inspector-renewed']]));
  localStorage.setItem('sitrep_refresh_token', 'renewed-refresh');
  localStorage.setItem('sitrep_access_token', 'inspector-renewed');
  window.dispatchEvent(new StorageEvent('storage', { key: 'sitrep_access_token', oldValue: 'inspector-access', newValue: 'inspector-renewed', storageArea: localStorage }));
  const queued = await second;
  if (outcome === 'success') finishRefresh({ data: { data: { accessToken: 'unused-renewed', refreshToken: 'unused-refresh' } } });
  else failRefresh(new Error('Refresh token already rotated'));
  const refreshed = await first;
  expect(queued.status).toBe(200);
  expect(refreshed.status).toBe(200);
  expect(adapter).toHaveBeenCalledTimes(4);
  expect(getAccessToken()).toBe('inspector-renewed');
});

it('bounds successful renewal history and preserves its exact order', async () => {
  let sequence = 0;
  const refresh = vi.spyOn(axios, 'post').mockImplementation(async () => {
    sequence += 1;
    return { data: { data: { accessToken: `access-${sequence}`, refreshToken: `refresh-${sequence}` } } };
  });
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    if (!(config as InternalAxiosRequestConfig & { _retry?: boolean })._retry) throw unauthorized(config);
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config };
  });
  for (let index = 0; index < 6; index += 1) await api.get('/renew', { adapter });
  expect(refresh).toHaveBeenCalledTimes(6);
  expect(JSON.parse(localStorage.getItem('sitrep_token_renewals') || 'null')).toEqual([
    ['access-2', 'access-3'], ['access-3', 'access-4'], ['access-4', 'access-5'], ['access-5', 'access-6'],
  ]);
});

it('never refreshes indefinitely when a proven renewal is still unauthorized', async () => {
  localStorage.setItem('sitrep_token_renewals', JSON.stringify([['old-access', 'inspector-access']]));
  let release!: (error: unknown) => void;
  let initial!: InternalAxiosRequestConfig;
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    if (adapter.mock.calls.length === 1) {
      initial = config;
      return new Promise((_, reject) => { release = reject; });
    }
    throw unauthorized(config);
  });
  const refresh = vi.spyOn(axios, 'post');
  const pending = api.get('/denied', { adapter }).catch(error => error);
  localStorage.setItem('sitrep_token_renewals', JSON.stringify([['inspector-access', 'inspector-renewed']]));
  localStorage.setItem('sitrep_access_token', 'inspector-renewed');
  release(unauthorized(initial));
  expect((await pending).response.status).toBe(401);
  expect(adapter).toHaveBeenCalledTimes(2);
  expect(refresh).not.toHaveBeenCalled();
});

it.each(['login', 'logout'] as const)('forgets renewal proof on %s', async boundary => {
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    if (adapter.mock.calls.length === 1) throw unauthorized(config);
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config };
  });
  vi.spyOn(axios, 'post').mockResolvedValue({ data: { data: { accessToken: 'inspector-renewed', refreshToken: 'renewed-refresh' } } });
  await api.get('/first', { adapter });
  expect(JSON.parse(localStorage.getItem('sitrep_token_renewals') || 'null')).toEqual([['inspector-access', 'inspector-renewed']]);
  if (boundary === 'login') setTokens('carrier-access', 'carrier-refresh');
  else clearTokens();
  expect(localStorage.getItem('sitrep_token_renewals')).toBeNull();
});
