import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ manifest: vi.fn(), query: vi.fn(), leg: vi.fn(), find: vi.fn(), create: vi.fn(), transaction: vi.fn(), emit: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  manifiesto: { findUnique: db.manifest }, trackingGPS: { findMany: vi.fn().mockResolvedValue([]) }, $transaction: db.transaction,
} }));
vi.mock('../../controllers/notification.controller', () => ({ anomaliaDetector: { detectarAnomalias: vi.fn() } }));
vi.mock('../../services/domainEvent.service', () => ({ domainEvents: { emit: db.emit } }));
import { actualizarUbicacionIdempotente, invalidateGpsCache } from '../../controllers/manifiesto-gps.controller';

const trip = { id: 'qa-gps-idempotency', estado: 'EN_TRANSITO', numero: 'QA-GPS-ID', transportistaId: 'carrier-1',
  generadorId: 'gen-1', operadorId: 'op-1', fechaRetiro: null, generador: null, operador: null };
const reference = 'c8256c28-2e6a-4fd0-9127-777a7db7af3e';
const point = { puntoId: reference, latitud: -32.88, longitud: -68.84, velocidad: 15, direccion: 180 };
const request = (body: unknown = point, userId = 'carrier-user') => ({
  params: { id: trip.id }, body, user: { id: userId, rol: 'TRANSPORTISTA', transportista: { id: 'carrier-1' } },
}) as any;
const response = () => ({ json: vi.fn() }) as any;

describe('GPS retry idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks(); invalidateGpsCache(trip.id);
    const rows = new Map<string, any>();
    db.manifest.mockResolvedValue(trip);
    db.query.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('pg_advisory_xact_lock') ? [] : [trip]);
    db.leg.mockResolvedValue(null);
    db.find.mockImplementation(async ({ where }: any) => rows.get(where.id) ?? null);
    db.create.mockImplementation(async ({ data }: any) => { const row = { ...data, tramoId: null, timestamp: new Date() }; rows.set(row.id, row); return row; });
    db.transaction.mockImplementation(async fn => fn({ $queryRaw: db.query, tramoTransporte: { findFirst: db.leg }, trackingGPS: { findUnique: db.find, create: db.create } }));
  });

  it('acknowledges a lost-response retry without saving the point or emitting the event twice', async () => {
    db.manifest.mockResolvedValue({ ...trip, fechaRetiro: new Date(Date.now() - 25 * 3600_000) });
    const first = response(), retry = response(), next = vi.fn();
    await actualizarUbicacionIdempotente(request(), first, next);
    await actualizarUbicacionIdempotente(request(), retry, next);
    expect(next).not.toHaveBeenCalled();
    expect(db.create).toHaveBeenCalledTimes(1);
    expect(first.json.mock.calls[0][0].data.tracking.id).toBe(retry.json.mock.calls[0][0].data.tracking.id);
    expect(first.json.mock.calls[0][0].data.idempotencia).toEqual({ version: 1, puntoId: reference, repetido: false });
    expect(retry.json.mock.calls[0][0].data.idempotencia).toEqual({ version: 1, puntoId: reference, repetido: true });
    expect(db.emit).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of a reference with different coordinates', async () => {
    await actualizarUbicacionIdempotente(request(), response(), vi.fn());
    const next = vi.fn(), res = response();
    await actualizarUbicacionIdempotente(request({ ...point, latitud: -32.5 }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(db.create).toHaveBeenCalledTimes(1); expect(res.json).not.toHaveBeenCalled();
  });

  it('recognizes the same UUID even if a client changes letter case', async () => {
    await actualizarUbicacionIdempotente(request(), response(), vi.fn());
    const next = vi.fn(), retry = response();
    await actualizarUbicacionIdempotente(request({ ...point, puntoId: reference.toUpperCase() }), retry, next);
    expect(next).not.toHaveBeenCalled(); expect(db.create).toHaveBeenCalledTimes(1);
    expect(retry.json.mock.calls[0][0].data.idempotencia).toEqual({ version: 1, puntoId: reference.toUpperCase(), repetido: true });
  });

  it('scopes the same reference to the authenticated account', async () => {
    await actualizarUbicacionIdempotente(request(), response(), vi.fn());
    const res = response(), next = vi.fn();
    await actualizarUbicacionIdempotente(request(point, 'second-carrier-user'), res, next);
    expect(next).not.toHaveBeenCalled(); expect(db.create).toHaveBeenCalledTimes(2);
    expect(db.create.mock.calls[0][0].data.id).not.toBe(db.create.mock.calls[1][0].data.id);
  });

  it.each([undefined, 'not-a-uuid'])('rejects a missing or invalid point reference before writing', async puntoId => {
    const next = vi.fn(), res = response();
    await actualizarUbicacionIdempotente(request({ ...point, puntoId }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(db.create).not.toHaveBeenCalled(); expect(res.json).not.toHaveBeenCalled();
  });
});
