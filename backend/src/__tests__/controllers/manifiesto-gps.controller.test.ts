import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../../middlewares/auth.middleware';

const { findManifest, findTracking, createTracking, emitDomainEvent } = vi.hoisted(() => ({
  findManifest: vi.fn(),
  findTracking: vi.fn(),
  createTracking: vi.fn(),
  emitDomainEvent: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  default: {
    manifiesto: { findUnique: findManifest },
    trackingGPS: { findFirst: findTracking, create: createTracking, findMany: vi.fn() },
  },
}));

vi.mock('../../controllers/notification.controller', () => ({
  anomaliaDetector: { detectarAnomalias: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../services/domainEvent.service', () => ({
  domainEvents: { emit: emitDomainEvent },
}));

import { actualizarUbicacion, invalidateGpsCache } from '../../controllers/manifiesto-gps.controller';

function requestFor(id: string, timestamp: string): AuthRequest {
  return {
    params: { id },
    body: { latitud: -32.89, longitud: -68.84, timestamp },
    user: { id: 'transport-1', rol: 'TRANSPORTISTA' },
  } as unknown as AuthRequest;
}

function responseMock(): Response {
  return { json: vi.fn().mockReturnThis() } as unknown as Response;
}

describe('manifiesto GPS offline replay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManifest.mockResolvedValue({
      id: 'manifest-1',
      estado: 'EN_TRANSITO',
      numero: 'M-001',
      fechaRetiro: null,
      generador: null,
      operador: null,
    });
  });

  it('returns the existing point when the same capture timestamp is replayed', async () => {
    const id = 'manifest-replay';
    const timestamp = '2020-01-02T03:04:05.000Z';
    const existing = { id: 'gps-existing', manifiestoId: id, timestamp: new Date(timestamp) };
    findTracking.mockResolvedValue(existing);
    invalidateGpsCache(id);
    const res = responseMock();
    const next = vi.fn() as NextFunction;

    await actualizarUbicacion(requestFor(id, timestamp), res, next);

    expect(findTracking).toHaveBeenCalledWith({
      where: { manifiestoId: id, timestamp: new Date(timestamp) },
    });
    expect(createTracking).not.toHaveBeenCalled();
    expect(emitDomainEvent).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { tracking: existing, replayed: true } });
    expect(next).not.toHaveBeenCalled();
  });

  it('preserves the original capture time for a new queued point', async () => {
    const id = 'manifest-new-point';
    const timestamp = '2020-02-03T04:05:06.000Z';
    const created = { id: 'gps-new', manifiestoId: id, timestamp: new Date(timestamp) };
    findTracking.mockResolvedValue(null);
    createTracking.mockResolvedValue(created);
    invalidateGpsCache(id);
    const res = responseMock();
    const next = vi.fn() as NextFunction;

    await actualizarUbicacion(requestFor(id, timestamp), res, next);

    expect(createTracking).toHaveBeenCalledWith({
      data: expect.objectContaining({
        manifiestoId: id,
        latitud: -32.89,
        longitud: -68.84,
        timestamp: new Date(timestamp),
      }),
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { tracking: created } });
    expect(next).not.toHaveBeenCalled();
  });
});
