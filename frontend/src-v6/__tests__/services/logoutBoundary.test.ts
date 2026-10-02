import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import axios from 'axios';
import { api, setTokens, getAccessToken, getRefreshToken } from '../../services/api';
import { authService } from '../../services/auth.service';

beforeEach(() => { localStorage.clear(); setTokens('ending-access', 'ending-refresh'); });
afterEach(() => vi.restoreAllMocks());

it('removes both local tokens before waiting for the logout server, using only the ending credential', async () => {
  let finish!: () => void;
  const wait = new Promise<void>(resolve => { finish = resolve; });
  const post = vi.spyOn(axios, 'post').mockImplementation(async () => { await wait; return { data: {} }; });
  // Both boundaries are simulated so a regression cannot use the network.
  vi.spyOn(api, 'post').mockImplementation(async () => { await wait; return { data: {} }; });
  const ended = authService.logout();
  try {
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(post).toHaveBeenCalledWith('/auth/logout', undefined, expect.objectContaining({
      baseURL: '/api', headers: { Authorization: 'Bearer ending-access' }, timeout: 30000,
    }));
  } finally { finish(); await ended; }
});

it.each(['success', 'failure'])('a late logout %s cannot clear a newer login', async result => {
  let finish!: () => void;
  const wait = new Promise<void>(resolve => { finish = resolve; });
  const request = async () => { await wait; if (result === 'failure') throw new Error('offline'); return { data: {} }; };
  vi.spyOn(axios, 'post').mockImplementation(request);
  vi.spyOn(api, 'post').mockImplementation(request);
  const ended = authService.logout().catch(() => undefined);
  setTokens('next-access', 'next-refresh');
  finish(); await ended;
  expect(getAccessToken()).toBe('next-access');
  expect(getRefreshToken()).toBe('next-refresh');
});
