import { beforeEach, expect, it, vi } from 'vitest';
const checkpoint = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock('../../services/sessionCheckpoint', () => ({ readSessionCheckpoint: checkpoint.read, writeSessionCheckpoint: checkpoint.write }));
vi.mock('../../components/ui/Toast', () => ({ toast: { warning: vi.fn() } }));
beforeEach(() => { vi.resetModules(); localStorage.clear(); checkpoint.read.mockReset(); checkpoint.write.mockReset().mockResolvedValue(undefined); });
const token = (id: string, iat: number) => `header.${btoa(JSON.stringify({ id, iat, exp: iat + 3600 }))}.signature`;

it('restores the acknowledged inspector instead of a stale administrator localStorage commit', async () => {
  localStorage.setItem('sitrep_access_token', token('admin', 10)); localStorage.setItem('sitrep_refresh_token', 'old-admin-refresh');
  checkpoint.read.mockResolvedValue({ accessToken: token('inspector', 20), refreshToken: 'inspector-refresh' });
  const api = await import('../../services/api');
  await api.restoreSessionCheckpoint();
  expect(api.getAccessToken()).toBe(token('inspector', 20)); expect(api.getRefreshToken()).toBe('inspector-refresh');
});

it.each([20, 10])('never restores the administrator over a newer or ambiguous legacy login (iat %s)', async issued => {
  localStorage.setItem('sitrep_access_token', token('inspector', issued));
  localStorage.setItem('sitrep_refresh_token', 'new-inspector-refresh');
  checkpoint.read.mockResolvedValue({ accessToken: token('admin', 10), refreshToken: 'old-admin-refresh' });
  const api = await import('../../services/api');
  await expect(api.restoreSessionCheckpoint()).rejects.toThrow('Session');
  expect(api.getAccessToken()).toBeNull();
  expect(checkpoint.write).toHaveBeenCalledWith(null);
});

it('an unversioned legacy logout must not resurrect a durable administrator', async () => {
  checkpoint.read.mockResolvedValue({ accessToken: token('admin', 10), refreshToken: 'old-admin-refresh' });
  const api = await import('../../services/api');
  await expect(api.restoreSessionCheckpoint()).rejects.toThrow('Session');
  expect(api.getAccessToken()).toBeNull(); expect(checkpoint.write).toHaveBeenCalledWith(null);
});

it('an acknowledged logout cannot resurrect the administrator from stale localStorage', async () => {
  localStorage.setItem('sitrep_access_token', 'old-admin'); localStorage.setItem('sitrep_refresh_token', 'old-refresh');
  checkpoint.read.mockResolvedValue(null);
  const api = await import('../../services/api'); await api.restoreSessionCheckpoint();
  expect(api.getAccessToken()).toBeNull(); expect(api.getRefreshToken()).toBeNull();
});

it('fails closed if durable recovery fails, without using stale credentials', async () => {
  localStorage.setItem('sitrep_access_token', 'old-admin'); checkpoint.read.mockRejectedValue(new Error('storage unavailable'));
  const api = await import('../../services/api');
  await expect(api.restoreSessionCheckpoint()).rejects.toThrow('storage unavailable');
  expect(api.getAccessToken()).toBeNull();
});

it('a late startup read cannot replace a subsequent login', async () => {
  let complete!: (value: unknown) => void;
  checkpoint.read.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  const api = await import('../../services/api'); const restoring = api.restoreSessionCheckpoint();
  await api.setTokensDurably('new-inspector', 'new-refresh');
  complete({ accessToken: 'old-admin', refreshToken: 'old-refresh' }); await restoring;
  expect(api.getAccessToken()).toBe('new-inspector');
});

it('login acknowledgement waits for durable commit and rejects a login overtaken by logout', async () => {
  let complete!: () => void;
  checkpoint.write.mockImplementationOnce(() => new Promise<void>(resolve => { complete = resolve; }));
  const api = await import('../../services/api');
  const login = api.setTokensDurably('inspector', 'refresh'); const rejected = expect(login).rejects.toThrow('Session changed');
  await vi.waitFor(() => expect(checkpoint.write).toHaveBeenCalledOnce());
  const logout = api.clearTokensDurably(); complete(); await rejected; await logout;
  expect(api.getAccessToken()).toBeNull(); expect(checkpoint.write).toHaveBeenLastCalledWith(null);
});

it('does not expose a new identity until storage confirms it', async () => {
  let complete!: () => void;
  checkpoint.write.mockImplementationOnce(() => new Promise<void>(resolve => { complete = resolve; }));
  const api = await import('../../services/api');
  const login = api.setTokensDurably('inspector', 'refresh');
  await vi.waitFor(() => expect(checkpoint.write).toHaveBeenCalledOnce());
  expect(api.getAccessToken()).toBeNull(); complete(); await login;
  expect(api.getAccessToken()).toBe('inspector');
});

it('an obsolete startup failure cannot invalidate a newer confirmed login', async () => {
  let fail!: (error: Error) => void;
  checkpoint.read.mockReturnValue(new Promise((_, reject) => { fail = reject; }));
  const api = await import('../../services/api'); const restoration = api.restoreSessionCheckpoint();
  await api.setTokensDurably('inspector', 'refresh');
  fail(new Error('obsolete failure')); await restoration;
  expect(api.getAccessToken()).toBe('inspector');
});

it('migrates an existing complete legacy pair, but an incomplete pair becomes a logout tombstone', async () => {
  localStorage.setItem('sitrep_access_token', 'torn-admin'); checkpoint.read.mockResolvedValue(undefined);
  const api = await import('../../services/api'); await api.restoreSessionCheckpoint();
  expect(checkpoint.write).toHaveBeenCalledWith(null); expect(api.getAccessToken()).toBeNull();
});
