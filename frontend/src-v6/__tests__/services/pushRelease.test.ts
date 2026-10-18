import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { releasePushSubscription } from '../../services/pushRelease';

const withPush = (endpoints: Array<string | null>) => {
  const registrations = endpoints.map(endpoint => ({ pushManager: { getSubscription: vi.fn().mockResolvedValue(endpoint ? { endpoint } : null) } }));
  vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: vi.fn().mockResolvedValue(registrations) } });
};

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('logout releases this device push endpoint for the person leaving', () => {
  it('sends each distinct endpoint with the ending credential only', async () => {
    withPush(['https://push.example.invalid/a', 'https://push.example.invalid/a', null]);
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { success: true } });
    await releasePushSubscription('ending-access', '/api');
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/push/unsubscribe', { endpoint: 'https://push.example.invalid/a' }, { baseURL: '/api', timeout: 5000, headers: { Authorization: 'Bearer ending-access' } });
  });
  it('never makes logout fail when the device or the server cannot answer', async () => {
    withPush(['https://push.example.invalid/b']);
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('offline'));
    await expect(releasePushSubscription('ending-access')).resolves.toBeUndefined();
  });
  it('does nothing without service workers', async () => {
    vi.stubGlobal('navigator', {});
    const post = vi.spyOn(axios, 'post');
    await releasePushSubscription('ending-access');
    expect(post).not.toHaveBeenCalled();
  });
});
