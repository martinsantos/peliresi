import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Response } from 'express';

const { mockFindUnique, mockUpsert, mockDeleteMany, mockEnviarPushAlUsuario, mockLoggerError } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockEnviarPushAlUsuario: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    pushSubscripcion: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
      deleteMany: mockDeleteMany,
    },
  },
}));

vi.mock('../../services/push.service', () => ({
  enviarPushAlUsuario: mockEnviarPushAlUsuario,
}));

vi.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getVapidPublicKey, logWelcomePushFailure, subscribe } from '../../controllers/push.controller';

const flushPromises = () => Promise.resolve();

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('PushController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VAPID_PUBLIC_KEY;
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({ id: 'sub-1' });
    mockDeleteMany.mockResolvedValue({ count: 1 });
    mockEnviarPushAlUsuario.mockResolvedValue(undefined);
  });

  it('returns the configured VAPID public key', () => {
    process.env.VAPID_PUBLIC_KEY = 'public-key';
    const res = createResponse();

    getVapidPublicKey({} as any, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { publicKey: 'public-key' } });
  });

  it('returns a 503 response when push is not configured', () => {
    const res = createResponse();

    getVapidPublicKey({} as any, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      status: 503,
      message: 'Push no configurado',
    });
  });

  it('logs welcome push failures with subscription context', () => {
    const err = new Error('push unavailable');

    logWelcomePushFailure(err, {
      usuarioId: 'user-1',
      endpoint: 'https://push.example/sub-1',
    });

    expect(mockLoggerError).toHaveBeenCalledWith(
      {
        usuarioId: 'user-1',
        endpoint: 'https://push.example/sub-1',
        err,
      },
      'Error enviando push de bienvenida'
    );
  });

  it('keeps subscription successful when welcome push dispatch fails', async () => {
    const err = new Error('push unavailable');
    mockEnviarPushAlUsuario.mockRejectedValueOnce(err);
    const req = {
      body: {
        endpoint: 'https://push.example/sub-1',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      },
      headers: { 'user-agent': 'Vitest' },
      user: { id: 'user-1' },
    };
    const res = createResponse();

    await subscribe(req as any, res);
    await flushPromises();

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example/sub-1' },
      update: { p256dh: 'p256dh-key', auth: 'auth-key', userAgent: 'Vitest' },
      create: {
        usuarioId: 'user-1',
        endpoint: 'https://push.example/sub-1',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
        userAgent: 'Vitest',
      },
    });
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(mockLoggerError).toHaveBeenCalledWith(
      {
        usuarioId: 'user-1',
        endpoint: 'https://push.example/sub-1',
        err,
      },
      'Error enviando push de bienvenida'
    );
  });
});
