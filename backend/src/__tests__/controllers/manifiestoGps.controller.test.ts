import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn(), list: vi.fn(), emit: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  manifiesto: { findUnique: mocks.find }, trackingGPS: { create: mocks.create, findMany: mocks.list },
} }));
vi.mock('../../controllers/notification.controller', () => ({ anomaliaDetector: { detectarAnomalias: vi.fn() } }));
vi.mock('../../services/domainEvent.service', () => ({ domainEvents: { emit: mocks.emit } }));
import { actualizarUbicacion, getViajeActual, invalidateGpsCache } from '../../controllers/manifiesto-gps.controller';

const trip = {
  id: 'gps-qa-trip', estado: 'EN_TRANSITO', numero: 'QA-50', transportistaId: 'carrier-1',
  generadorId: 'generator-1', operadorId: 'operator-1', fechaRetiro: null,
  generador: null, operador: null,
};
const point = { latitud: -32.88, longitud: -68.84, velocidad: 15, direccion: 180 };
const request = (body: unknown = point, carrier = 'carrier-1') => ({
  params: { id: trip.id }, body,
  user: { id: `user-${carrier}`, rol: 'TRANSPORTISTA', transportista: { id: carrier } },
}) as any;
const response = () => ({ json: vi.fn() }) as any;

describe('GPS concurrency and recovery guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateGpsCache(trip.id);
    mocks.find.mockResolvedValue(trip);
    mocks.create.mockResolvedValue({ id: 'point-1', ...point });
    mocks.list.mockResolvedValue([]);
  });
  afterEach(() => { vi.restoreAllMocks(); invalidateGpsCache(trip.id); });

  it('persists each valid sample while reusing only a matching-owner cache', async () => {
    const next = vi.fn();
    await actualizarUbicacion(request(), response(), next);
    await actualizarUbicacion(request(), response(), next);
    expect(next).not.toHaveBeenCalled();
    expect(mocks.find).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create).toHaveBeenLastCalledWith({ data: { manifiestoId: trip.id, ...point } });
  });

  it.each([true, false])('rejects a foreign carrier with warm cache = %s', async (warm) => {
    if (warm) await actualizarUbicacion(request(), response(), vi.fn());
    mocks.create.mockClear();
    const next = vi.fn();
    await actualizarUbicacion(request(point, 'carrier-2'), response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects invalid coordinates without poisoning the next valid sample', async () => {
    const next = vi.fn();
    await actualizarUbicacion(request({ ...point, latitud: 91 }), response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    next.mockClear();
    await actualizarUbicacion(request(), response(), next);
    expect(next).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it('refreshes expired cache and rejects a trip no longer in transit', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(100_000);
    await actualizarUbicacion(request(), response(), vi.fn());
    clock.mockReturnValue(130_001);
    mocks.find.mockResolvedValue({ ...trip, estado: 'ENTREGADO' });
    const next = vi.fn();
    await actualizarUbicacion(request(), response(), next);
    expect(mocks.find).toHaveBeenCalledTimes(2);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('invalidates the cache immediately when delivery requests invalidation', async () => {
    await actualizarUbicacion(request(), response(), vi.fn());
    invalidateGpsCache(trip.id);
    mocks.find.mockResolvedValue({ ...trip, estado: 'ENTREGADO' });
    const next = vi.fn();
    await actualizarUbicacion(request(), response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it('does not return success on a database write failure and accepts a subsequent retry', async () => {
    const failure = new Error('QA database temporarily unavailable');
    mocks.create.mockRejectedValueOnce(failure);
    const res = response();
    const next = vi.fn();
    await actualizarUbicacion(request(), res, next);
    expect(next).toHaveBeenCalledWith(failure);
    expect(res.json).not.toHaveBeenCalled();
    next.mockClear();
    await actualizarUbicacion(request(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { tracking: expect.objectContaining({ id: 'point-1' }) } });
  });

  it('refuses track history to another carrier without querying points', async () => {
    const next = vi.fn();
    await getViajeActual(request(point, 'carrier-2'), response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
