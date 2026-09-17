import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Response } from 'express';

const {
  mockFindUnique,
  mockUpsert,
  mockDeleteMany,
  mockEnviarPushAlUsuario,
  mockEnviarPushAlDispositivo,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockEnviarPushAlUsuario: vi.fn(),
  mockEnviarPushAlDispositivo: vi.fn(),
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
  enviarPushAlDispositivo: mockEnviarPushAlDispositivo,
}));

vi.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getVapidPublicKey, logWelcomePushFailure, subscribe, testPush } from '../../controllers/push.controller';

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
    mockEnviarPushAlDispositivo.mockResolvedValue(true);
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
      subscriptionId: 'sub-1',
    });

    expect(mockLoggerError).toHaveBeenCalledWith(
      {
        usuarioId: 'user-1',
        subscriptionId: 'sub-1',
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
      update: { usuarioId: 'user-1', p256dh: 'p256dh-key', auth: 'auth-key', userAgent: 'Vitest' },
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
        subscriptionId: 'sub-1',
        err,
      },
      'Error enviando push de bienvenida'
    );
  });

  it('sends a test push only to the authenticated user device', async () => {
    const req = {
      body: { endpoint: 'https://push.example/device-1' },
      user: { id: 'user-1' },
    };
    const res = createResponse();

    await testPush(req as any, res);

    expect(mockEnviarPushAlDispositivo).toHaveBeenCalledWith(
      'user-1',
      'https://push.example/device-1',
      expect.objectContaining({
        prioridad: 'ALTA',
        url: '/configuracion?tab=notificaciones',
        appUrl: '/app/configuracion?tab=notificaciones',
      }),
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { delivered: true } });
  });

  it('rejects a test endpoint that is not bound to the authenticated user', async () => {
    mockEnviarPushAlDispositivo.mockResolvedValueOnce(false);
    const res = createResponse();

    await expect(testPush({
      body: { endpoint: 'https://push.example/foreign-device' },
      user: { id: 'user-1' },
    } as any, res)).rejects.toThrow('La suscripción no existe o venció');

    expect(res.json).not.toHaveBeenCalled();
  });
});
