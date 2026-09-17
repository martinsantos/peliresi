import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../services/api';
import { usePushNotifications } from '../../hooks/usePushNotifications';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const requestPermission = vi.fn();
const getSubscription = vi.fn();
const subscribe = vi.fn();
const addEventListener = vi.fn();
const removeEventListener = vi.fn();

const subscription = {
  endpoint: 'https://push.example/device-1',
  toJSON: vi.fn(() => ({
    endpoint: 'https://push.example/device-1',
    keys: { p256dh: 'p256dh', auth: 'auth' },
  })),
  unsubscribe: vi.fn().mockResolvedValue(true),
};

const registration = {
  scope: 'https://sitrep.example/app/',
  pushManager: { getSubscription, subscribe },
};

function configureBrowser(permission: NotificationPermission) {
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: { permission, requestPermission },
  });
  Object.defineProperty(window, 'PushManager', { configurable: true, value: class PushManager {} });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistrations: vi.fn().mockResolvedValue([registration]),
      getRegistration: vi.fn().mockResolvedValue(registration),
      addEventListener,
      removeEventListener,
    },
  });
  window.history.replaceState({}, '', '/app/configuracion?tab=notificaciones');
}

describe('usePushNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureBrowser('default');
    getSubscription.mockResolvedValue(null);
    subscribe.mockResolvedValue(subscription);
    requestPermission.mockResolvedValue('granted');
    vi.mocked(api.get).mockResolvedValue({ data: { data: { publicKey: 'AQID' } } } as any);
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } } as any);
  });

  it('never requests notification permission automatically on mount', async () => {
    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => expect(result.current.status).toBe('prompt'));
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('requests permission only after the explicit activate action', async () => {
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe('prompt'));

    let activated = false;
    await act(async () => { activated = await result.current.activate(); });

    expect(activated).toBe(true);
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(api.post).toHaveBeenCalledWith('/push/subscribe', subscription.toJSON());
    expect(result.current.status).toBe('subscribed');
  });

  it('rebinds an existing browser subscription to the authenticated user', async () => {
    configureBrowser('granted');
    getSubscription.mockResolvedValue(subscription);

    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => expect(result.current.status).toBe('subscribed'));
    expect(requestPermission).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith('/push/subscribe', subscription.toJSON());
  });

  it('sends the self-test only to the current browser endpoint', async () => {
    configureBrowser('granted');
    getSubscription.mockResolvedValue(subscription);
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe('subscribed'));
    vi.mocked(api.post).mockClear();

    let sent = false;
    await act(async () => { sent = await result.current.sendTest(); });

    expect(sent).toBe(true);
    expect(api.post).toHaveBeenCalledWith('/push/test', { endpoint: subscription.endpoint });
  });
});
