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

  it.each([false, true])('acknowledges an already accepted point after delivery with warm cache = %s', async warm => {
    const first = response(); await actualizarUbicacionIdempotente(request(), first, vi.fn());
    const ended = { ...trip, estado: 'ENTREGADO' };
    db.manifest.mockResolvedValue(ended);
    db.query.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('pg_advisory_xact_lock') ? [] : [ended]);
    if (!warm) invalidateGpsCache(trip.id);
    const retry = response(), next = vi.fn();
    await actualizarUbicacionIdempotente(request(), retry, next);
    expect(next).not.toHaveBeenCalled(); expect(db.create).toHaveBeenCalledTimes(1);
    expect(retry.json.mock.calls[0][0].data.idempotencia).toEqual({ version: 1, puntoId: reference, repetido: true });
    expect(retry.json.mock.calls[0][0].data.tracking.id).toBe(first.json.mock.calls[0][0].data.tracking.id);
    expect(db.emit).not.toHaveBeenCalled();
  });

  it('acknowledges a point saved before a handoff but rejects a new original-carrier point', async () => {
    await actualizarUbicacionIdempotente(request(), response(), vi.fn());
    db.leg.mockResolvedValue({ id: 'replacement', tipo: 'EXTERNO' });
    const retry = response(), next = vi.fn();
    await actualizarUbicacionIdempotente(request(), retry, next);
    expect(next).not.toHaveBeenCalled(); expect(retry.json.mock.calls[0][0].data.idempotencia.repetido).toBe(true);
    const rejected = response(), nextNew = vi.fn();
    await actualizarUbicacionIdempotente(request({ ...point, puntoId: '3a999c28-2e6a-4fd0-9127-777a7db7af3e' }), rejected, nextNew);
    expect(nextNew).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(rejected.json).not.toHaveBeenCalled(); expect(db.create).toHaveBeenCalledTimes(1);
  });

  it('never admits a new point after delivery, even if another account reuses an existing reference', async () => {
    await actualizarUbicacionIdempotente(request(), response(), vi.fn());
    const ended = { ...trip, estado: 'ENTREGADO' };
    db.query.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('pg_advisory_xact_lock') ? [] : [ended]);
    const next = vi.fn(), res = response();
    await actualizarUbicacionIdempotente(request(point, 'other-carrier-user'), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(res.json).not.toHaveBeenCalled(); expect(db.create).toHaveBeenCalledTimes(1);
  });

  it('checks current authorization before acknowledging a previous point', async () => {
    await actualizarUbicacionIdempotente(request(), response(), vi.fn()); db.find.mockClear();
    const ended = { ...trip, estado: 'ENTREGADO', transportistaId: 'other-carrier' };
    db.query.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('pg_advisory_xact_lock') ? [] : [ended]);
    const next = vi.fn(), res = response(); await actualizarUbicacionIdempotente(request(), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(db.find).not.toHaveBeenCalled(); expect(res.json).not.toHaveBeenCalled(); expect(db.create).toHaveBeenCalledTimes(1);
  });

  it('authorizes a delegated company site and rejects another site even with a warm cache', async () => {
    const site = { empresaId: 'qa-company', establecimientoId: 'qa-site' };
    const scoped = { ...trip, contextoEmpresa: site };
    const own = request(); own.user.empresaContexto = { ...site, todasSedes: false };
    db.manifest.mockResolvedValue(scoped);
    db.query.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('pg_advisory_xact_lock') ? [] : [scoped]);
    const first = response(), next = vi.fn(); await actualizarUbicacionIdempotente(own, first, next);
    expect(next).not.toHaveBeenCalled(); expect(db.manifest.mock.calls[0][0].select.contextoEmpresa).toBe(true);
    expect(db.query.mock.calls.some(([parts]: [TemplateStringsArray]) => parts.join('').includes('"contextoEmpresa"'))).toBe(true);
    const foreign = request(); foreign.user.empresaContexto = { ...site, establecimientoId: 'other-site', todasSedes: false };
    const denied = vi.fn(); await actualizarUbicacionIdempotente(foreign, response(), denied);
    expect(denied).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(db.create).toHaveBeenCalledTimes(1);
  });

  it('checks the current company site before acknowledging after a scope change', async () => {
    const site = { empresaId: 'qa-company', establecimientoId: 'qa-site' };
    const scoped = { ...trip, contextoEmpresa: site };
    const own = request(); own.user.empresaContexto = { ...site, todasSedes: false };
    db.manifest.mockResolvedValue(scoped);
    db.query.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('pg_advisory_xact_lock') ? [] : [scoped]);
    await actualizarUbicacionIdempotente(own, response(), vi.fn()); db.find.mockClear();
    const moved = { ...scoped, estado: 'ENTREGADO', contextoEmpresa: { ...site, establecimientoId: 'other-site' } };
    db.query.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('pg_advisory_xact_lock') ? [] : [moved]);
    const denied = vi.fn(), res = response(); await actualizarUbicacionIdempotente(own, res, denied);
    expect(denied).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(db.find).not.toHaveBeenCalled(); expect(res.json).not.toHaveBeenCalled(); expect(db.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a changed payload after delivery instead of acknowledging it', async () => {
    await actualizarUbicacionIdempotente(request(), response(), vi.fn());
    const ended = { ...trip, estado: 'ENTREGADO' };
    db.query.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('pg_advisory_xact_lock') ? [] : [ended]);
    const next = vi.fn(), res = response();
    await actualizarUbicacionIdempotente(request({ ...point, latitud: -32.5 }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(res.json).not.toHaveBeenCalled(); expect(db.create).toHaveBeenCalledTimes(1);
  });

  it('does not automatically label a trip excessive solely because 24 hours elapsed', async () => {
    db.manifest.mockResolvedValue({ ...trip, fechaRetiro: new Date(Date.now() - 25 * 3600_000) });
    const next = vi.fn();
    await actualizarUbicacionIdempotente(request(), response(), next);
    expect(next).not.toHaveBeenCalled();
    expect(db.emit).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'TIEMPO_EXCESIVO' }));
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
