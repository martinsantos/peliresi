import { describe, it, expect, vi, afterEach } from 'vitest';
import { Response } from 'express';
import { getVapidPublicKey, subscribe, unsubscribe } from '../../controllers/push.controller';
import prisma from '../../lib/prisma';

vi.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    pushSubscripcion: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../../services/push.service', () => ({
  enviarPushAlUsuario: vi.fn(),
}));

function createResponse() {
  return {
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('push controller', () => {
  const originalVapidPublicKey = process.env.VAPID_PUBLIC_KEY;

  afterEach(() => {
    if (originalVapidPublicKey === undefined) {
      delete process.env.VAPID_PUBLIC_KEY;
    } else {
      process.env.VAPID_PUBLIC_KEY = originalVapidPublicKey;
    }
  });

  it('reports push as disabled when VAPID_PUBLIC_KEY is not configured', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const res = createResponse();

    await getVapidPublicKey({} as never, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { enabled: false, publicKey: null },
    });
  });

  it('returns the public key when push is configured', async () => {
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    const res = createResponse();

    await getVapidPublicKey({} as never, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { enabled: true, publicKey: 'test-public-key' },
    });
  });

  describe('shared devices', () => {
    const body = { endpoint: 'https://push.example.invalid/device', keys: { p256dh: 'p', auth: 'a' } };
    const request = (user: Record<string, unknown>) => ({ body, user, headers: { 'user-agent': 'unit' } }) as never;

    it('reassigns an existing device subscription to the person signed in now', async () => {
      vi.mocked(prisma.pushSubscripcion.findUnique).mockResolvedValue({ id: 'existing' } as never);
      await subscribe(request({ id: 'second-person' }), createResponse());
      expect(prisma.pushSubscripcion.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { endpoint: body.endpoint },
        update: expect.objectContaining({ usuarioId: 'second-person' }),
      }));
    });

    it('leaves the administrator device untouched while impersonating', async () => {
      vi.mocked(prisma.pushSubscripcion.upsert).mockClear();
      const res = createResponse();
      await subscribe(request({ id: 'impersonated', impersonatedBy: { id: 'admin', nombre: 'Admin' } }), res);
      expect(prisma.pushSubscripcion.upsert).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('only removes the caller own subscription', async () => {
      await unsubscribe({ body: { endpoint: body.endpoint }, user: { id: 'leaving-person' } } as never, createResponse());
      expect(prisma.pushSubscripcion.deleteMany).toHaveBeenCalledWith({ where: { endpoint: body.endpoint, usuarioId: 'leaving-person' } });
    });

    it('does not remove a device subscription from an impersonated session', async () => {
      vi.mocked(prisma.pushSubscripcion.deleteMany).mockClear();
      await unsubscribe({ body: { endpoint: body.endpoint }, user: { id: 'impersonated', impersonatedBy: { id: 'admin', nombre: 'Admin' } } } as never, createResponse());
      expect(prisma.pushSubscripcion.deleteMany).not.toHaveBeenCalled();
    });
  });
});
