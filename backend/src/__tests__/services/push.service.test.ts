import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set VAPID keys and mocks BEFORE module imports (evaluated at module load time)
const { mockSendNotification, mockSetVapidDetails, mockFindMany, mockDeleteMany } = vi.hoisted(() => {
  process.env.VAPID_PUBLIC_KEY = 'test-public-key';
  process.env.VAPID_PRIVATE_KEY = 'test-private-key';
  return {
    mockSendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
    mockSetVapidDetails: vi.fn(),
    mockFindMany: vi.fn().mockResolvedValue([]),
    mockDeleteMany: vi.fn(),
  };
});

vi.mock('web-push', () => ({
  default: {
    sendNotification: mockSendNotification,
    setVapidDetails: mockSetVapidDetails,
  },
  sendNotification: mockSendNotification,
  setVapidDetails: mockSetVapidDetails,
}));

vi.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    pushSubscripcion: {
      findMany: mockFindMany,
      deleteMany: mockDeleteMany,
    },
  },
}));

vi.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { enviarPushAlUsuario } from '../../services/push.service';

describe('PushService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default resolved value for mockFindMany after clear
    mockFindMany.mockResolvedValue([]);
  });

  it('should be importable', () => {
    expect(enviarPushAlUsuario).toBeDefined();
  });

  it('enviarPushAlUsuario is a function', () => {
    expect(typeof enviarPushAlUsuario).toBe('function');
  });

  it('queries subscriptions for the user', async () => {
    await enviarPushAlUsuario('user-1', {
      title: 'Test',
      body: 'Test body',
    });

    expect(mockFindMany).toHaveBeenCalledWith({ where: { usuarioId: 'user-1' } });
  });

  it('returns early when user has no subscriptions', async () => {
    mockFindMany.mockResolvedValue([]);

    await enviarPushAlUsuario('user-1', { title: 'Test', body: 'Body' });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('sends notification to each subscription', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'sub-1', endpoint: 'https://endpoint1', p256dh: 'key1', auth: 'auth1' },
      { id: 'sub-2', endpoint: 'https://endpoint2', p256dh: 'key2', auth: 'auth2' },
    ]);

    await enviarPushAlUsuario('user-1', { title: 'Test', body: 'Body' });

    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });

  it('deletes stale subscriptions on 410 Gone response', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'sub-stale', endpoint: 'https://stale', p256dh: 'key', auth: 'auth' },
      { id: 'sub-ok', endpoint: 'https://ok', p256dh: 'key', auth: 'auth' },
    ]);
    mockSendNotification
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockResolvedValueOnce({ statusCode: 201 });

    await enviarPushAlUsuario('user-1', { title: 'Test', body: 'Body' });

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['sub-stale'] } },
    });
  });

  it('deletes stale subscriptions on 404 Not Found response', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'sub-gone', endpoint: 'https://gone', p256dh: 'key', auth: 'auth' },
    ]);
    mockSendNotification.mockRejectedValueOnce({ statusCode: 404 });

    await enviarPushAlUsuario('user-1', { title: 'Test', body: 'Body' });

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['sub-gone'] } },
    });
  });

  it('includes prioridad in the notification payload', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'sub-1', endpoint: 'https://endpoint1', p256dh: 'key1', auth: 'auth1' },
    ]);
    mockSendNotification.mockResolvedValue({ statusCode: 201 });

    await enviarPushAlUsuario('user-1', {
      title: 'Critical Alert',
      body: 'Something urgent',
      prioridad: 'CRITICA',
    });

    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    const payloadArg = mockSendNotification.mock.calls[0][1];
    const parsed = JSON.parse(payloadArg);
    expect(parsed.prioridad).toBe('CRITICA');
    expect(parsed.title).toBe('Critical Alert');
  });

  it('does not throw when sendNotification fails with non-stale error', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'sub-1', endpoint: 'https://endpoint1', p256dh: 'key1', auth: 'auth1' },
    ]);
    mockSendNotification.mockRejectedValueOnce({ statusCode: 500, message: 'Internal error' });

    await expect(
      enviarPushAlUsuario('user-1', { title: 'Test', body: 'Body' })
    ).resolves.toBeUndefined();

    // Non-stale errors should not trigger deletion
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });
});
