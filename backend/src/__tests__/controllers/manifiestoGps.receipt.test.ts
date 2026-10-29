import { createHash } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ query: vi.fn(), find: vi.fn(), create: vi.fn(), transaction: vi.fn(), emit: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { $transaction: db.transaction } }));
vi.mock('../../controllers/notification.controller', () => ({ anomaliaDetector: { detectarAnomalias: vi.fn() } }));
vi.mock('../../services/domainEvent.service', () => ({ domainEvents: { emit: db.emit } }));
import { consultarConfirmacionUbicacion } from '../../controllers/manifiesto-gps.controller';

const id = 'qa-receipt-trip', userId = 'qa-carrier-user', puntoId = 'c8256c28-2e6a-4fd0-9127-777a7db7af3e';
const trackingId = 'gpsv1_' + createHash('sha256').update(JSON.stringify([id, userId, puntoId])).digest('hex');
const trip = { estado: 'ENTREGADO', generadorId: 'gen', transportistaId: 'carrier', operadorId: 'op', contextoEmpresa: { empresaId: 'qa-company', establecimientoId: 'qa-site' } };
const point = { id: trackingId, manifiestoId: id, emisor: `usuario:${userId}`, tramoId: null, latitud: -32.88, longitud: -68.84, velocidad: 15, direccion: 180 };
const request = (reference = puntoId, carrier = 'carrier', account = userId) => ({ params: { id, puntoId: reference }, user: { id: account, rol: 'TRANSPORTISTA', transportista: { id: carrier } } }) as any;
const response = () => ({ json: vi.fn(), set: vi.fn() }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  db.query.mockResolvedValue([trip]);
  db.find.mockImplementation(async ({ where }: any) => where.id === trackingId ? point : null);
  db.transaction.mockImplementation(async fn => fn({ $queryRaw: db.query, trackingGPS: { findUnique: db.find, create: db.create } }));
});

it('reads a matching receipt after delivery without inserting a point or emitting an event', async () => {
  const next = vi.fn(), res = response(); await consultarConfirmacionUbicacion(request(), res, next);
  expect(next).not.toHaveBeenCalled();
  expect(res.set).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  expect(res.json).toHaveBeenCalledWith({ success: true, data: { idempotencia: { version: 1, puntoId, confirmado: true }, tracking: { latitud: -32.88, longitud: -68.84, velocidad: 15, direccion: 180 } } });
  expect(db.create).not.toHaveBeenCalled(); expect(db.emit).not.toHaveBeenCalled();
});

it('returns 404 for a missing receipt or another account even on the same carrier', async () => {
  const missing = vi.fn(); await consultarConfirmacionUbicacion(request('d8256c28-2e6a-4fd0-9127-777a7db7af3e'), response(), missing);
  expect(missing).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  const other = vi.fn(); await consultarConfirmacionUbicacion(request(puntoId, 'carrier', 'other-user'), response(), other);
  expect(other).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 })); expect(db.create).not.toHaveBeenCalled();
});

it('checks the live actor and site scope before looking up a receipt', async () => {
  const foreign = vi.fn(); await consultarConfirmacionUbicacion(request(puntoId, 'other-carrier'), response(), foreign);
  expect(foreign).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 })); expect(db.find).not.toHaveBeenCalled();
  const otherSite = request(); otherSite.user.empresaContexto = { empresaId: 'qa-company', establecimientoId: 'other-site', todasSedes: false };
  const denied = vi.fn(); await consultarConfirmacionUbicacion(otherSite, response(), denied);
  expect(denied).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 })); expect(db.find).not.toHaveBeenCalled();
  const own = request(); own.user.empresaContexto = { empresaId: 'qa-company', establecimientoId: 'qa-site', todasSedes: false };
  const allowed = response(), next = vi.fn(); await consultarConfirmacionUbicacion(own, allowed, next);
  expect(next).not.toHaveBeenCalled(); expect(allowed.json).toHaveBeenCalled();
  expect(db.query.mock.calls.some(([parts]: [TemplateStringsArray]) => parts.join('').includes('"contextoEmpresa"'))).toBe(true);
});

it('rejects an invalid reference and never reads a point or creates data', async () => {
  const next = vi.fn(); await consultarConfirmacionUbicacion(request('invalid'), response(), next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  expect(db.transaction).not.toHaveBeenCalled(); expect(db.find).not.toHaveBeenCalled(); expect(db.create).not.toHaveBeenCalled();
});
