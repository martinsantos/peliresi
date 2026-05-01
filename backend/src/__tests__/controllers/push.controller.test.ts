import { describe, it, expect, vi, afterEach } from 'vitest';
import { Response } from 'express';
import { getVapidPublicKey } from '../../controllers/push.controller';

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
});
