import { beforeAll, beforeEach, afterEach, it, expect, vi } from 'vitest';
import axios, { AxiosError } from 'axios';

let client: ReturnType<typeof axios.create>;
let monitor: typeof import('../../pages/monitor/api/monitor-api');
let calls: Array<{ url: string; token: string }>;

beforeAll(async () => {
  const create = axios.create.bind(axios);
  const capture = vi.spyOn(axios, 'create').mockImplementation(config => {
    client = create(config);
    return client;
  });
  monitor = await import('../../pages/monitor/api/monitor-api');
  capture.mockRestore();
  expect(client).toBeDefined();
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('sitrep_access_token', 'expired-access');
  localStorage.setItem('sitrep_refresh_token', 'valid-refresh');
  calls = [];
  // Only the HTTP boundary is simulated in this unit test. The actual request
  // and response interceptors execute; no DB, external provider or browser runs.
  client.defaults.adapter = async config => {
    const token = String(config.headers.Authorization ?? '');
    calls.push({ url: config.url!, token });
    if (token !== 'Bearer fresh-access') {
      // Bound the legacy refresh loop so a failed regression test cannot hang.
      const status = calls.length > 2 ? 500 : 401;
      throw new AxiosError('Unauthorized', 'ERR_BAD_RESPONSE', config, null,
        { data: {}, status, statusText: 'Unauthorized', headers: {}, config });
    }
    return { data: { success: true, data: config.url!.endsWith('active-days') ? { days: ['2026-10-02'] } : { estadisticas: { total: 1 } } }, status: 200, statusText: 'OK', headers: {}, config };
  };
});

afterEach(() => vi.restoreAllMocks());

it('refreshes a monitor request using the real nested token contract, never the string undefined', async () => {
  const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: {
    success: true, data: { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' },
  } });
  await expect(monitor.fetchMonitorLive()).resolves.toMatchObject({ estadisticas: { total: 1 } });
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith('/api/auth/refresh-token', { refreshToken: 'valid-refresh' });
  expect(calls.map(call => call.token)).toEqual(['Bearer expired-access', 'Bearer fresh-access']);
  expect(localStorage.getItem('sitrep_access_token')).toBe('fresh-access');
  expect(localStorage.getItem('sitrep_refresh_token')).toBe('fresh-refresh');
});

it('serializes simultaneous monitor refreshes instead of issuing one refresh for every poll', async () => {
  const post = vi.spyOn(axios, 'post').mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
    return { data: { success: true, data: { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' } } };
  });
  const results = await Promise.allSettled([monitor.fetchMonitorLive(), monitor.fetchActiveDays()]);
  expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled']);
  expect(post).toHaveBeenCalledTimes(1);
  expect(calls.filter(call => call.token === 'Bearer fresh-access')).toHaveLength(2);
});

it('rejects an expired refresh once and clears unusable session tokens', async () => {
  const failure = new Error('Refresh rejected');
  const post = vi.spyOn(axios, 'post').mockRejectedValue(failure);
  await expect(monitor.fetchMonitorLive()).rejects.toBe(failure);
  expect(post).toHaveBeenCalledTimes(1);
  expect(calls).toHaveLength(1);
  expect(localStorage.getItem('sitrep_access_token')).toBeNull();
  expect(localStorage.getItem('sitrep_refresh_token')).toBeNull();
});

it('does not attempt a refresh or widen permissions after a forbidden response', async () => {
  const post = vi.spyOn(axios, 'post');
  client.defaults.adapter = async config => {
    throw new AxiosError('Forbidden', 'ERR_BAD_RESPONSE', config, null,
      { data: {}, status: 403, statusText: 'Forbidden', headers: {}, config });
  };
  await expect(monitor.fetchMonitorLive()).rejects.toMatchObject({ response: { status: 403 } });
  expect(post).not.toHaveBeenCalled();
  expect(localStorage.getItem('sitrep_access_token')).toBe('expired-access');
});
